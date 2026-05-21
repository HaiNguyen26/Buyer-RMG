import { FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { INVENTORY_COMPANY_ID } from '../utils/inventoryReservation';
import {
  allocateNextCounter,
  grnSequenceKey,
  scanMaxGrnYearSuffix,
} from '../utils/documentSequence';
import {
  computeIncomingLineDisplayStatus,
  lineReceiveCap,
  lineRemainingQty,
  poItemLabel,
  resolveLineStatusAfterReceive,
  toPoNum,
  todayDateOnlyUtc,
} from '../utils/poLineConfirmation';
import { syncPurchaseRequestAfterGoodsReceipt } from '../utils/syncPrAfterGrn';
import {
  buildGrnTimeline,
  computeGrnDisplayStatus,
  formatGrnHistoryDateTime,
  grnItemLabel,
  type GrnHistoryDisplayStatus,
} from '../utils/grnHistoryStatus';
import { parseReceiveDateInput } from '../utils/grnReceiveDate';
import { emitWarehouseGrnUpdate } from '../config/socket';
import { getIO } from '../utils/getIO';

const ROLES = ['WAREHOUSE', 'SYSTEM_ADMIN'];

function allow(role: string | undefined): boolean {
  return !!role && ROLES.includes(role);
}

function toNum(d: Prisma.Decimal | null | undefined): number {
  return toPoNum(d);
}

function computePoReceiveTotals(
  items: Array<{ id: string; qty: Prisma.Decimal; confirmedQty: Prisma.Decimal | null }>,
  receivedMap: Map<string, number>
): { received: number; cap: number } {
  let cap = 0;
  let received = 0;
  for (const it of items) {
    cap += lineReceiveCap(it.confirmedQty, it.qty);
    received += receivedMap.get(it.id) ?? 0;
  }
  return {
    received: Math.round(received * 1000) / 1000,
    cap: Math.round(cap * 1000) / 1000,
  };
}

function buildGrnNote(
  note: string | null,
  attachmentNames: string[]
): string | null {
  const base = note?.trim() || '';
  const files = attachmentNames.map((n) => n.trim()).filter(Boolean);
  if (!files.length) return base || null;
  const attachLine = `[Đính kèm] ${files.join(', ')}`;
  return base ? `${base}\n${attachLine}` : attachLine;
}

async function sumReceivedByPoItemIds(
  tx: Prisma.TransactionClient,
  poItemIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!poItemIds.length) return map;
  const grouped = await tx.goodsReceiptLine.groupBy({
    by: ['poItemId'],
    where: { poItemId: { in: poItemIds } },
    _sum: { qtyReceived: true },
  });
  for (const g of grouped) {
    map.set(g.poItemId, toNum(g._sum.qtyReceived));
  }
  return map;
}

type PoGrnSummary = {
  id: string;
  grnNumber: string;
  receivedAt: string;
  status: GrnHistoryDisplayStatus;
};

async function buildPoGrnSummariesByPoId(poIds: string[]): Promise<Record<string, PoGrnSummary[]>> {
  const out: Record<string, PoGrnSummary[]> = {};
  if (!poIds.length) return out;

  const grns = await prisma.goodsReceipt.findMany({
    where: { purchaseOrderId: { in: poIds } },
    orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      grnNumber: true,
      receivedAt: true,
      note: true,
      purchaseOrderId: true,
      lines: { select: { poItemId: true, qtyReceived: true } },
      purchaseOrder: {
        select: {
          items: {
            where: { lineStatus: { not: 'CANCELLED' } },
            select: {
              id: true,
              lineNo: true,
              qty: true,
              confirmedQty: true,
              description: true,
              purchaseRequestItem: { select: { partNo: true, description: true } },
            },
          },
        },
      },
    },
  });

  const byPo = new Map<string, typeof grns>();
  for (const g of grns) {
    const list = byPo.get(g.purchaseOrderId) ?? [];
    list.push(g);
    byPo.set(g.purchaseOrderId, list);
  }

  for (const [poId, poGrns] of byPo) {
    const chron = [...poGrns].sort(
      (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id)
    );
    out[poId] = chron.map((grn) => {
      const poItems = new Map(grn.purchaseOrder.items.map((i) => [i.id, i]));
      const before = receivedBeforeForGrn(chron, grn.id);
      const status = computeGrnDisplayStatus(grn.note, grn.lines, poItems, before);
      return {
        id: grn.id,
        grnNumber: grn.grnNumber,
        receivedAt: grn.receivedAt.toISOString(),
        status,
      };
    });
  }
  return out;
}

/** Danh sách PO chờ nhận — flatten theo dòng PO */
export async function listIncomingPurchaseOrders(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  if (!allow(request.user?.role)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }

  const q = (request.query as Record<string, string>) ?? {};
  const vendor = (q.vendor ?? '').trim();
  const from = (q.from ?? '').trim();
  const to = (q.to ?? '').trim();
  const statusFilter = (q.status ?? 'all').trim().toLowerCase();

  let statuses: Array<'SENT' | 'CONFIRMED' | 'PARTIAL_RECEIVED'> = [
    'SENT',
    'CONFIRMED',
    'PARTIAL_RECEIVED',
  ];
  if (statusFilter === 'pending') statuses = ['SENT', 'CONFIRMED'];
  else if (statusFilter === 'partial') statuses = ['PARTIAL_RECEIVED'];

  const dateFrom = from ? new Date(from) : null;
  const dateTo = to ? new Date(to) : null;
  if (dateFrom && Number.isNaN(dateFrom.getTime())) {
    return reply.code(400).send({ error: 'from không hợp lệ' });
  }
  if (dateTo && Number.isNaN(dateTo.getTime())) {
    return reply.code(400).send({ error: 'to không hợp lệ' });
  }

  const pos = await prisma.purchaseOrder.findMany({
    where: {
      deletedAt: null,
      status: { in: statuses },
      ...(vendor
        ? {
            supplier: {
              OR: [
                { name: { contains: vendor, mode: 'insensitive' } },
                { code: { contains: vendor, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    },
    orderBy: [{ deliveryDate: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      poNumber: true,
      status: true,
      deliveryDate: true,
      supplier: { select: { name: true, code: true } },
      items: {
        where: { lineStatus: { not: 'CANCELLED' } },
        orderBy: { lineNo: 'asc' },
        include: {
          purchaseRequestItem: { select: { partNo: true, description: true } },
        },
      },
    },
  });

  const allItemIds = pos.flatMap((p) => p.items.map((i) => i.id));
  const receivedMap = await sumReceivedByPoItemIds(prisma, allItemIds);
  const today = todayDateOnlyUtc();

  type Row = {
    poId: string;
    poNumber: string;
    vendor: string;
    vendorCode: string | null;
    poItemId: string;
    lineNo: number;
    itemLabel: string;
    partNo: string | null;
    expectedDate: string | null;
    confirmedQty: number | null;
    orderedQty: number;
    receivedQty: number;
    remainingQty: number;
    lineStatus: string;
    displayStatus: ReturnType<typeof computeIncomingLineDisplayStatus>;
    poHeaderStatus: string;
    listStatus: 'Sent' | 'Confirmed' | 'Partial';
  };

  const rows: Row[] = [];

  for (const p of pos) {
    const listStatus: Row['listStatus'] =
      p.status === 'PARTIAL_RECEIVED'
        ? 'Partial'
        : p.status === 'CONFIRMED'
          ? 'Confirmed'
          : 'Sent';

    for (const it of p.items) {
      const received = receivedMap.get(it.id) ?? 0;
      const confirmed = it.confirmedQty != null ? toNum(it.confirmedQty) : null;
      const ordered = toNum(it.qty);
      const remaining = lineRemainingQty(it.confirmedQty, it.qty, received);
      const expectedDate = it.expectedDeliveryDate
        ? it.expectedDeliveryDate.toISOString().slice(0, 10)
        : p.deliveryDate
          ? p.deliveryDate.toISOString().slice(0, 10)
          : null;

      const displayStatus = computeIncomingLineDisplayStatus({
        poHeaderStatus: p.status,
        confirmedQty: confirmed,
        receivedQty: received,
        expectedDate,
        today,
      });

      if (statusFilter === 'delayed' && displayStatus !== 'Delayed') continue;
      if (statusFilter === 'partial' && displayStatus !== 'Partial') continue;
      if (displayStatus === 'Received') continue;

      if (dateFrom || dateTo) {
        if (!expectedDate) continue;
        if (dateFrom && expectedDate < from) continue;
        if (dateTo && expectedDate > to) continue;
      }

      rows.push({
        poId: p.id,
        poNumber: p.poNumber,
        vendor: p.supplier.name,
        vendorCode: p.supplier.code,
        poItemId: it.id,
        lineNo: it.lineNo,
        itemLabel: poItemLabel(
          it.purchaseRequestItem.partNo,
          it.description,
          it.lineNo
        ),
        partNo: it.purchaseRequestItem.partNo,
        expectedDate,
        confirmedQty: confirmed,
        orderedQty: ordered,
        receivedQty: received,
        remainingQty: remaining,
        lineStatus: it.lineStatus,
        displayStatus,
        poHeaderStatus: p.status,
        listStatus,
      });
    }
  }

  rows.sort((a, b) => {
    const da = a.expectedDate ?? '9999-12-31';
    const db = b.expectedDate ?? '9999-12-31';
    if (da !== db) return da.localeCompare(db);
    return a.poNumber.localeCompare(b.poNumber) || a.lineNo - b.lineNo;
  });

  const poProgress: Record<string, { received: number; cap: number }> = {};
  for (const p of pos) {
    poProgress[p.id] = computePoReceiveTotals(p.items, receivedMap);
  }

  const poIds = [...new Set(rows.map((r) => r.poId))];
  const poGrns = await buildPoGrnSummariesByPoId(poIds);

  return reply.send({ rows, poGrns, poProgress });
}

export async function getPurchaseOrderForGrn(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!allow(request.user?.role)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }
  const poId = (request.params as { poId?: string }).poId?.trim();
  if (!poId) return reply.code(400).send({ error: 'Thiếu poId' });

  const po = await prisma.purchaseOrder.findFirst({
    where: {
      id: poId,
      deletedAt: null,
      status: { in: ['SENT', 'CONFIRMED', 'PARTIAL_RECEIVED'] },
    },
    include: {
      supplier: { select: { name: true, code: true } },
      items: {
        where: { lineStatus: { not: 'CANCELLED' } },
        orderBy: { lineNo: 'asc' },
        include: {
          purchaseRequestItem: { select: { partNo: true, description: true, unit: true } },
        },
      },
    },
  });

  if (!po) {
    return reply.code(404).send({
      error:
        'Không tìm thấy PO hoặc PO chưa ở trạng thái SENT/CONFIRMED/PARTIAL (chưa gửi NCC thì không nhập kho).',
    });
  }

  const poItemIds = po.items.map((i) => i.id);
  const receivedMap = await sumReceivedByPoItemIds(prisma, poItemIds);

  const user = await prisma.user.findUnique({
    where: { id: request.user!.userId },
    select: { username: true, fullName: true },
  });

  const lines = po.items.map((it) => {
    const ordered = toNum(it.qty);
    const already = receivedMap.get(it.id) ?? 0;
    const confirmed = it.confirmedQty != null ? toNum(it.confirmedQty) : null;
    const remaining = lineRemainingQty(it.confirmedQty, it.qty, already);
    const canReceive = confirmed != null && remaining > 0;
    const label = poItemLabel(it.purchaseRequestItem.partNo, it.description, it.lineNo);
    return {
      poItemId: it.id,
      lineNo: it.lineNo,
      itemLabel: label,
      partNo: it.purchaseRequestItem.partNo,
      description: it.description,
      unit: it.unit ?? it.purchaseRequestItem.unit ?? '',
      ordered,
      confirmedQty: confirmed,
      expectedDeliveryDate: it.expectedDeliveryDate
        ? it.expectedDeliveryDate.toISOString().slice(0, 10)
        : po.deliveryDate
          ? po.deliveryDate.toISOString().slice(0, 10)
          : null,
      alreadyReceived: already,
      remaining,
      canReceive,
      lineStatus: it.lineStatus,
    };
  });

  const earliestEta = lines
    .map((l) => l.expectedDeliveryDate)
    .filter(Boolean)
    .sort()[0] ?? null;

  const existingGrns = (await buildPoGrnSummariesByPoId([po.id]))[po.id] ?? [];
  const receiveProgress = computePoReceiveTotals(po.items, receivedMap);

  return reply.send({
    po: {
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      vendor: po.supplier.name,
      vendorCode: po.supplier.code,
      deliveryDate: po.deliveryDate ? po.deliveryDate.toISOString().slice(0, 10) : null,
      earliestExpectedDate: earliestEta,
    },
    receiver: {
      id: request.user!.userId,
      displayName: user?.fullName?.trim() || user?.username || request.user!.userId,
    },
    lines,
    existingGrns,
    receiveProgress,
  });
}

/** Xem PO (readonly) — mọi trạng thái sau khi phát hành; kèm GRN đã tạo. */
export async function getIncomingPoView(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!allow(request.user?.role)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }
  const poId = (request.params as { poId?: string }).poId?.trim();
  if (!poId) return reply.code(400).send({ error: 'Thiếu poId' });

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: poId, deletedAt: null },
    include: {
      supplier: { select: { name: true, code: true } },
      items: {
        where: { lineStatus: { not: 'CANCELLED' } },
        orderBy: { lineNo: 'asc' },
        include: {
          purchaseRequestItem: { select: { partNo: true, description: true, unit: true } },
        },
      },
    },
  });

  if (!po) {
    return reply.code(404).send({ error: 'Không tìm thấy PO' });
  }

  const poItemIds = po.items.map((i) => i.id);
  const receivedMap = await sumReceivedByPoItemIds(prisma, poItemIds);
  const existingGrns = (await buildPoGrnSummariesByPoId([po.id]))[po.id] ?? [];

  const lines = po.items.map((it) => {
    const ordered = toNum(it.qty);
    const already = receivedMap.get(it.id) ?? 0;
    const confirmed = it.confirmedQty != null ? toNum(it.confirmedQty) : null;
    const remaining = lineRemainingQty(it.confirmedQty, it.qty, already);
    return {
      poItemId: it.id,
      lineNo: it.lineNo,
      itemLabel: poItemLabel(it.purchaseRequestItem.partNo, it.description, it.lineNo),
      partNo: it.purchaseRequestItem.partNo,
      ordered,
      confirmedQty: confirmed,
      alreadyReceived: already,
      remaining,
      lineStatus: it.lineStatus,
      unit: it.unit ?? it.purchaseRequestItem.unit ?? '',
    };
  });

  const earliestEta = po.items
    .map((it) =>
      it.expectedDeliveryDate
        ? it.expectedDeliveryDate.toISOString().slice(0, 10)
        : po.deliveryDate
          ? po.deliveryDate.toISOString().slice(0, 10)
          : null
    )
    .filter(Boolean)
    .sort()[0] ?? null;

  return reply.send({
    po: {
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      vendor: po.supplier.name,
      vendorCode: po.supplier.code,
      deliveryDate: po.deliveryDate ? po.deliveryDate.toISOString().slice(0, 10) : null,
      earliestExpectedDate: earliestEta,
    },
    lines,
    existingGrns,
  });
}

type GrnLineBody = { poItemId: string; qtyReceived: number };

export async function submitGoodsReceipt(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!allow(request.user?.role)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }
  const poId = (request.params as { poId?: string }).poId?.trim();
  if (!poId) return reply.code(400).send({ error: 'Thiếu poId' });

  const body = request.body as {
    lines?: GrnLineBody[];
    note?: string | null;
    warehouseCode?: string | null;
    receivedAt?: string | null;
    attachmentNames?: string[];
  };
  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  const note = buildGrnNote(
    body.note ?? null,
    Array.isArray(body.attachmentNames) ? body.attachmentNames : []
  );
  const warehouseCode = (body.warehouseCode ?? '').trim() || 'MAIN';
  const receivedAtParsed = parseReceiveDateInput(body.receivedAt);
  if (!body.receivedAt?.trim()) {
    return reply.code(400).send({ error: 'Vui lòng chọn ngày nhận (Receive Date)' });
  }
  if (!receivedAtParsed) {
    return reply.code(400).send({ error: 'Ngày nhận không hợp lệ (YYYY-MM-DD)' });
  }
  const receivedAt = receivedAtParsed;
  const userId = request.user!.userId;

  const normalized: Map<string, number> = new Map();
  for (const row of rawLines) {
    const id = row.poItemId?.trim();
    const q = Number(row.qtyReceived);
    if (!id) continue;
    if (!Number.isFinite(q) || q < 0) {
      return reply.code(400).send({ error: `Số lượng không hợp lệ cho dòng ${id}` });
    }
    normalized.set(id, (normalized.get(id) ?? 0) + q);
  }

  const positiveEntries = [...normalized.entries()].filter(([, q]) => q > 0);
  if (!positiveEntries.length) {
    return reply.code(400).send({ error: 'Cần ít nhất một dòng có số lượng nhận > 0' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: {
          id: poId,
          deletedAt: null,
          status: { in: ['SENT', 'CONFIRMED', 'PARTIAL_RECEIVED'] },
        },
        include: {
          purchaseRequest: { select: { id: true } },
          items: {
            where: { lineStatus: { not: 'CANCELLED' } },
            include: {
              purchaseRequestItem: { select: { partNo: true, description: true, unit: true } },
            },
          },
        },
      });
      if (!po) {
        return { error: 'Không tìm thấy PO hoặc PO không ở trạng thái chờ nhận', status: 404 as const };
      }

      const itemById = new Map(po.items.map((i) => [i.id, i]));
      const receivedMap = await sumReceivedByPoItemIds(
        tx,
        po.items.map((i) => i.id)
      );

      for (const [poItemId, qty] of positiveEntries) {
        const it = itemById.get(poItemId);
        if (!it) {
          return { error: 'Chỉ được nhận hàng cho dòng thuộc PO này', status: 400 as const };
        }
        if (it.confirmedQty == null) {
          return {
            error: `Dòng ${it.lineNo} chưa được Buyer ghi nhận xác nhận NCC — không thể nhập kho`,
            status: 400 as const,
          };
        }
        const already = receivedMap.get(poItemId) ?? 0;
        const remaining = lineRemainingQty(it.confirmedQty, it.qty, already);
        if (qty > remaining + 1e-9) {
          return {
            error: `Số nhận vượt quá còn lại (${remaining}) cho dòng ${it.lineNo}`,
            status: 400 as const,
          };
        }
        const partNo = it.purchaseRequestItem.partNo?.trim();
        if (!partNo) {
          return {
            error: `Dòng ${it.lineNo} thiếu mã vật tư (part no) trên PR — không thể ghi tồn kho`,
            status: 400 as const,
          };
        }
      }

      const year = new Date().getFullYear();
      const seqKey = grnSequenceKey(year);
      const seq = await allocateNextCounter(tx, seqKey, () => scanMaxGrnYearSuffix(tx, year));
      const grnNumber = `GRN-${year}-${String(seq).padStart(5, '0')}`;

      const grn = await tx.goodsReceipt.create({
        data: {
          companyId: INVENTORY_COMPANY_ID,
          purchaseOrderId: po.id,
          grnNumber,
          warehouseCode,
          receivedAt,
          receivedById: userId,
          note,
          lines: {
            create: positiveEntries.map(([poItemId, qtyReceived]) => ({
              poItemId,
              qtyReceived: new Prisma.Decimal(qtyReceived),
            })),
          },
        },
        include: { lines: true },
      });

      for (const [poItemId, qtyReceived] of positiveEntries) {
        const it = itemById.get(poItemId)!;
        const partNo = it.purchaseRequestItem.partNo!.trim();
        const partName = (it.purchaseRequestItem.description || it.description || partNo).trim();
        const unit = (it.unit ?? it.purchaseRequestItem.unit ?? 'EA').trim() || 'EA';
        const delta = new Prisma.Decimal(qtyReceived);
        const companyId = INVENTORY_COMPANY_ID;
        const invWhere =
          companyId != null
            ? { partInternalCode: partNo, warehouseCode, companyId }
            : { partInternalCode: partNo, warehouseCode };

        const existing = await tx.inventoryBalance.findFirst({ where: invWhere });
        const prev = existing ? toNum(existing.quantityAvailable) : 0;
        const nextQty = prev + qtyReceived;

        if (existing) {
          await tx.inventoryBalance.update({
            where: { id: existing.id },
            data: {
              quantityAvailable: new Prisma.Decimal(nextQty),
              partName: partName || existing.partName,
            },
          });
        } else {
          await tx.inventoryBalance.create({
            data: {
              ...(companyId != null ? { companyId } : {}),
              partInternalCode: partNo,
              partName: partName || null,
              unit,
              quantityAvailable: delta,
              quantityReserved: new Prisma.Decimal(0),
              warehouseCode,
              location: null,
            },
          });
        }

        await tx.inventoryActivity.create({
          data: {
            companyId,
            partInternalCode: partNo,
            warehouseCode,
            partName: partName || null,
            changeType: 'IN',
            deltaAvailable: delta,
            quantityAfter: new Prisma.Decimal(nextQty),
            note: `GRN ${grn.grnNumber} · PO ${po.poNumber}`,
            createdById: userId,
          },
        });
      }

      const receivedAfter = await sumReceivedByPoItemIds(
        tx,
        po.items.map((i) => i.id)
      );

      let allComplete = true;
      for (const it of po.items) {
        if (it.lineStatus === 'CANCELLED') continue;
        const cap = lineReceiveCap(it.confirmedQty, it.qty);
        if (cap <= 0) continue;
        const got = receivedAfter.get(it.id) ?? 0;
        if (got + 1e-9 < cap) {
          allComplete = false;
          break;
        }
      }

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: allComplete ? 'FULLY_RECEIVED' : 'PARTIAL_RECEIVED' },
      });

      for (const it of po.items) {
        const got = receivedAfter.get(it.id) ?? 0;
        const lineStatus = resolveLineStatusAfterReceive(
          it.confirmedQty,
          it.qty,
          got,
          it.lineStatus
        );
        await tx.pOItem.update({
          where: { id: it.id },
          data: { lineStatus: lineStatus as any },
        });
      }

      const prSync = await syncPurchaseRequestAfterGoodsReceipt(
        tx,
        po.purchaseRequest.id
      );

      return { grn, allComplete, prStatus: prSync.prStatus };
    });

    if ('error' in result && result.error) {
      return reply.code(result.status ?? 400).send({ error: result.error });
    }

    const { grn, allComplete, prStatus } = result as {
      grn: { id: string; grnNumber: string };
      allComplete: boolean;
      prStatus?: string | null;
    };
    const poStatus = allComplete ? 'FULLY_RECEIVED' : 'PARTIAL_RECEIVED';
    const io = getIO();
    if (io) {
      emitWarehouseGrnUpdate(io, {
        poId,
        grnId: grn.id,
        grnNumber: grn.grnNumber,
        poStatus,
        allComplete,
        prStatus: prStatus ?? undefined,
      });
    }
    return reply.code(201).send({
      success: true,
      created: true,
      grnId: grn.id,
      grnNumber: grn.grnNumber,
      poStatus,
      prStatus: prStatus ?? undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('submitGoodsReceipt error:', err);
    return reply.code(500).send({ error: message });
  }
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function receivedBeforeForGrn(
  allGrns: Array<{ id: string; receivedAt: Date; lines: { poItemId: string; qtyReceived: Prisma.Decimal }[] }>,
  targetId: string
): Map<string, number> {
  const target = allGrns.find((g) => g.id === targetId);
  if (!target) return new Map();
  const map = new Map<string, number>();
  for (const g of allGrns) {
    if (g.receivedAt > target.receivedAt) continue;
    if (g.receivedAt.getTime() === target.receivedAt.getTime() && g.id >= target.id) continue;
    for (const line of g.lines) {
      map.set(line.poItemId, (map.get(line.poItemId) ?? 0) + toNum(line.qtyReceived));
    }
  }
  return map;
}

function grnEstimatedValue(
  lines: { poItemId: string; qtyReceived: Prisma.Decimal }[],
  poItems: Map<string, { unitPrice: Prisma.Decimal }>
): number {
  let sum = 0;
  for (const line of lines) {
    const it = poItems.get(line.poItemId);
    if (!it) continue;
    sum += toNum(line.qtyReceived) * toNum(it.unitPrice);
  }
  return sum;
}

/** Lịch sử GRN — danh sách + summary (đã nhận, khác incoming). */
export async function listGrnHistory(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!allow(request.user?.role)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }

  const q = (request.query as Record<string, string>) ?? {};
  const search = (q.search ?? q.q ?? '').trim();
  const from = (q.from ?? '').trim();
  const to = (q.to ?? '').trim();
  const statusFilter = (q.status ?? 'ALL').trim().toUpperCase().replace(/\s+/g, '_');

  const dateFrom = from ? new Date(from) : null;
  const dateTo = to ? new Date(to) : null;
  if (dateFrom && Number.isNaN(dateFrom.getTime())) {
    return reply.code(400).send({ error: 'from không hợp lệ' });
  }
  if (dateTo && Number.isNaN(dateTo.getTime())) {
    return reply.code(400).send({ error: 'to không hợp lệ' });
  }

  const receivedAtWhere: Prisma.DateTimeFilter | undefined =
    dateFrom || dateTo
      ? {
          ...(dateFrom ? { gte: startOfDayUtc(dateFrom) } : {}),
          ...(dateTo ? { lte: endOfDayUtc(dateTo) } : {}),
        }
      : undefined;

  const grns = await prisma.goodsReceipt.findMany({
    where: {
      ...(receivedAtWhere ? { receivedAt: receivedAtWhere } : {}),
      ...(search
        ? {
            OR: [
              { grnNumber: { contains: search, mode: 'insensitive' } },
              { purchaseOrder: { poNumber: { contains: search, mode: 'insensitive' } } },
              {
                purchaseOrder: {
                  supplier: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { code: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ receivedAt: 'desc' }, { grnNumber: 'desc' }],
    include: {
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          status: true,
          totalAmount: true,
          currency: true,
          issuedAt: true,
          supplierConfirmedAt: true,
          supplier: { select: { name: true, code: true } },
          items: {
            where: { lineStatus: { not: 'CANCELLED' } },
            include: { purchaseRequestItem: { select: { partNo: true, description: true } } },
          },
        },
      },
      receivedBy: { select: { username: true, fullName: true } },
      lines: { select: { poItemId: true, qtyReceived: true } },
    },
  });

  const chron = [...grns].sort(
    (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id)
  );

  const now = new Date();
  const todayStart = startOfDayUtc(now);
  const todayEnd = endOfDayUtc(now);
  const monthStart = startOfMonthUtc(now);

  let receivedTodayPoCount = 0;
  const todayPoIds = new Set<string>();
  let itemsReceivedQty = 0;
  let partialGrnCount = 0;
  let totalValueMonthVnd = 0;

  const rows: Array<{
    id: string;
    grnNumber: string;
    poId: string;
    poNumber: string;
    vendor: string;
    vendorCode: string | null;
    receivedAt: string;
    receivedDate: string;
    receivedTime: string;
    status: GrnHistoryDisplayStatus;
    receiver: string;
    lineCount: number;
    estimatedValueVnd: number;
  }> = [];

  for (const grn of grns) {
    const po = grn.purchaseOrder;
    const poItems = new Map(po.items.map((i) => [i.id, i]));
    const unitPriceMap = new Map(po.items.map((i) => [i.id, { unitPrice: i.unitPrice }]));
    const poChron = chron.filter((g) => g.purchaseOrder.id === po.id);
    const before = receivedBeforeForGrn(poChron, grn.id);
    const status = computeGrnDisplayStatus(grn.note, grn.lines, poItems, before);

    if (statusFilter !== 'ALL' && status !== statusFilter) continue;

    const { date, time } = formatGrnHistoryDateTime(grn.receivedAt);
    const receiver =
      grn.receivedBy.fullName?.trim() || grn.receivedBy.username?.trim() || '—';
    const est = grnEstimatedValue(grn.lines, unitPriceMap);

    if (status === 'PARTIAL') partialGrnCount += 1;

    rows.push({
      id: grn.id,
      grnNumber: grn.grnNumber,
      poId: po.id,
      poNumber: po.poNumber,
      vendor: po.supplier.name,
      vendorCode: po.supplier.code,
      receivedAt: grn.receivedAt.toISOString(),
      receivedDate: date,
      receivedTime: time,
      status,
      receiver,
      lineCount: grn.lines.length,
      estimatedValueVnd: est,
    });

    for (const line of grn.lines) {
      const qty = toNum(line.qtyReceived);
      itemsReceivedQty += qty;
      if (grn.receivedAt >= todayStart && grn.receivedAt <= todayEnd) {
        todayPoIds.add(po.id);
      }
      if (grn.receivedAt >= monthStart) {
        totalValueMonthVnd += qty * toNum(unitPriceMap.get(line.poItemId)?.unitPrice);
      }
    }
  }

  receivedTodayPoCount = todayPoIds.size;

  let overdueIncomingLines = 0;
  try {
    const today = todayDateOnlyUtc();
    const incomingPos = await prisma.purchaseOrder.findMany({
      where: {
        deletedAt: null,
        status: { in: ['SENT', 'CONFIRMED', 'PARTIAL_RECEIVED'] },
      },
      select: {
        status: true,
        items: {
          where: { lineStatus: { not: 'CANCELLED' } },
          select: {
            id: true,
            confirmedQty: true,
            qty: true,
            expectedDeliveryDate: true,
          },
        },
      },
    });
    const ids = incomingPos.flatMap((p) => p.items.map((i) => i.id));
    const recv = await sumReceivedByPoItemIds(prisma, ids);
    for (const po of incomingPos) {
      for (const it of po.items) {
        const got = recv.get(it.id) ?? 0;
        const remaining = lineRemainingQty(it.confirmedQty, it.qty, got);
        if (remaining <= 0) continue;
        const expectedDate = it.expectedDeliveryDate
          ? it.expectedDeliveryDate.toISOString().slice(0, 10)
          : null;
        const st = computeIncomingLineDisplayStatus({
          poHeaderStatus: po.status,
          confirmedQty: it.confirmedQty != null ? toNum(it.confirmedQty) : null,
          receivedQty: got,
          expectedDate,
          today,
        });
        if (st === 'Delayed') overdueIncomingLines += 1;
      }
    }
  } catch {
    overdueIncomingLines = 0;
  }

  return reply.send({
    summary: {
      receivedTodayPoCount,
      itemsReceivedQty: Math.round(itemsReceivedQty * 1000) / 1000,
      partialGrnCount,
      totalValueMonthVnd: Math.round(totalValueMonthVnd),
      overdueIncomingLines,
    },
    grns: rows,
  });
}

/** Chi tiết một GRN — dòng vật tư + timeline. */
export async function getGrnHistoryDetail(request: AuthenticatedRequest, reply: FastifyReply) {
  if (!allow(request.user?.role)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }

  const id = (request.params as { id?: string }).id?.trim();
  if (!id) return reply.code(400).send({ error: 'Thiếu id' });

  const grn = await prisma.goodsReceipt.findUnique({
    where: { id },
    include: {
      purchaseOrder: {
        select: {
          id: true,
          poNumber: true,
          status: true,
          totalAmount: true,
          currency: true,
          issuedAt: true,
          supplierConfirmedAt: true,
          supplier: { select: { name: true, code: true } },
          items: {
            where: { lineStatus: { not: 'CANCELLED' } },
            orderBy: { lineNo: 'asc' },
            include: { purchaseRequestItem: { select: { partNo: true, description: true } } },
          },
        },
      },
      receivedBy: { select: { username: true, fullName: true } },
      lines: {
        include: {
          poItem: {
            include: { purchaseRequestItem: { select: { partNo: true, description: true } } },
          },
        },
      },
    },
  });

  if (!grn) return reply.code(404).send({ error: 'Không tìm thấy phiếu GRN' });

  const poGrns = await prisma.goodsReceipt.findMany({
    where: { purchaseOrderId: grn.purchaseOrderId },
    orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
    select: { id: true, receivedAt: true, lines: { select: { poItemId: true, qtyReceived: true } } },
  });

  const poItems = new Map(grn.purchaseOrder.items.map((i) => [i.id, i]));
  const before = receivedBeforeForGrn(poGrns, grn.id);
  const status = computeGrnDisplayStatus(grn.note, grn.lines, poItems, before);
  const receiver =
    grn.receivedBy.fullName?.trim() || grn.receivedBy.username?.trim() || '—';
  const { date, time } = formatGrnHistoryDateTime(grn.receivedAt);

  const receivedTotalMap = await sumReceivedByPoItemIds(
    prisma,
    grn.purchaseOrder.items.map((i) => i.id)
  );

  const items = grn.lines.map((line) => {
    const it = line.poItem;
    const ordered = toNum(it.qty);
    const confirmed = toNum(it.confirmedQty ?? it.qty);
    const receivedThis = toNum(line.qtyReceived);
    const receivedTotal = receivedTotalMap.get(it.id) ?? 0;
    const partNo = it.purchaseRequestItem.partNo?.trim() || null;
    return {
      poItemId: it.id,
      lineNo: it.lineNo,
      name: grnItemLabel(it),
      partNo,
      ordered,
      confirmed,
      receivedThis,
      receivedTotal,
      unit: (it.unit ?? 'EA').trim() || 'EA',
    };
  });

  const estimatedValueVnd = grnEstimatedValue(
    grn.lines.map((l) => ({ poItemId: l.poItemId, qtyReceived: l.qtyReceived })),
    new Map(grn.purchaseOrder.items.map((i) => [i.id, { unitPrice: i.unitPrice }]))
  );

  const timeline = buildGrnTimeline({
    po: {
      poNumber: grn.purchaseOrder.poNumber,
      issuedAt: grn.purchaseOrder.issuedAt,
      supplierConfirmedAt: grn.purchaseOrder.supplierConfirmedAt,
      status: grn.purchaseOrder.status,
    },
    grn: { receivedAt: grn.receivedAt, note: grn.note },
    receiverDisplay: receiver,
    displayStatus: status,
  });

  return reply.send({
    id: grn.id,
    grnNumber: grn.grnNumber,
    warehouseCode: grn.warehouseCode,
    note: grn.note,
    poId: grn.purchaseOrder.id,
    poNumber: grn.purchaseOrder.poNumber,
    poStatus: grn.purchaseOrder.status,
    vendor: grn.purchaseOrder.supplier.name,
    vendorFull: grn.purchaseOrder.supplier.name,
    vendorCode: grn.purchaseOrder.supplier.code,
    receivedAt: grn.receivedAt.toISOString(),
    receivedDate: date,
    receivedTime: time,
    status,
    receiver,
    currency: grn.purchaseOrder.currency ?? 'VND',
    estimatedValueVnd: Math.round(estimatedValueVnd),
    poTotalAmount: toNum(grn.purchaseOrder.totalAmount),
    items,
    timeline,
  });
}
