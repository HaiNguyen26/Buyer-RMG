import { FastifyReply } from 'fastify';
import { Prisma, StockIssueStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  allocateReservationsForIssueItem,
  adjustIssueItemReservations,
  fulfillIssueItemShipment,
  fulfillStockIssueShipments,
  InsufficientStockError,
  INVENTORY_COMPANY_ID,
  releaseAllReservationsForStockIssue,
  releaseReservationsForIssueItem,
} from '../utils/inventoryReservation';
import {
  allocateNextCounter,
  peekNextCounter,
  scanMaxStockIssueDaySuffix,
  stockIssueSequenceKey,
} from '../utils/documentSequence';

const ALL_STOCK_ISSUE_STATUSES: StockIssueStatus[] = [
  'DRAFT',
  'RESERVED',
  'APPROVED',
  'ISSUED',
  'REJECTED',
  'CANCELLED',
];

function parseStatusList(raw: string | undefined, fallback: StockIssueStatus[]): StockIssueStatus[] {
  const parts = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return fallback;
  const picked = parts.filter((s): s is StockIssueStatus =>
    ALL_STOCK_ISSUE_STATUSES.includes(s as StockIssueStatus)
  );
  return picked.length ? picked : fallback;
}

async function reservationSumsForItemIds(itemIds: string[]): Promise<Record<string, number>> {
  if (!itemIds.length) return {};
  const rows = await prisma.inventoryReservation.groupBy({
    by: ['refId'],
    where: { refType: 'ISSUE', refId: { in: itemIds } },
    _sum: { qty: true },
  });
  const m: Record<string, number> = {};
  for (const row of rows) {
    m[row.refId] = Number(row._sum.qty ?? 0);
  }
  return m;
}

const stockIssueInclude = {
  requestor: { select: { id: true, username: true, fullName: true } as const },
  salesPO: { select: { id: true, salesPONumber: true, customerPONumber: true } as const },
  purchaseRequest: {
    select: {
      id: true,
      prNumber: true,
      projectCode: true,
      projectName: true,
    } as const,
  },
  items: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' as const } },
} as const;

const REQUESTOR = 'REQUESTOR';
const DEPARTMENT_HEAD = 'DEPARTMENT_HEAD';
const WAREHOUSE_ROLES = ['WAREHOUSE', 'SYSTEM_ADMIN'];

/** Gắn phiếu xuất với PR — chỉ PR của user hoặc (DEPARTMENT_HEAD) cùng phòng ban với PR. */
async function resolvePurchaseRequestIdForStockIssue(
  purchaseRequestId: string | undefined | null,
  userId: string,
  role: string | undefined
): Promise<{ id: string | null; error?: string; status?: number }> {
  const raw = purchaseRequestId?.trim();
  if (!raw) return { id: null };
  const pr = await prisma.purchaseRequest.findFirst({
    where: { id: raw, deletedAt: null },
    select: { id: true, requestorId: true, department: true },
  });
  if (!pr) return { id: null, error: 'PR không tồn tại', status: 400 };
  if (pr.requestorId === userId) return { id: pr.id };
  if (role === DEPARTMENT_HEAD) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { department: true },
    });
    const d = me?.department ?? '';
    const pd = pr.department ?? '';
    if (d && pd && d === pd) return { id: pr.id };
  }
  return { id: null, error: 'Không được gắn phiếu xuất với PR này', status: 403 };
}

/** Người tạo phiếu xuất (cùng quy tắc requestorId = user hiện tại). */
const STOCK_ISSUE_CREATOR_ROLES = [REQUESTOR, DEPARTMENT_HEAD] as const;

function isWarehouse(role: string | undefined) {
  return !!role && WAREHOUSE_ROLES.includes(role);
}

function isStockIssueCreator(role: string | undefined) {
  return !!role && (STOCK_ISSUE_CREATOR_ROLES as readonly string[]).includes(role);
}

const getYYYYMMDD = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
};

async function previewStockIssueNumber(): Promise<string> {
  const yyyymmdd = getYYYYMMDD();
  const key = stockIssueSequenceKey(yyyymmdd);
  const next = await peekNextCounter(prisma, key, () => scanMaxStockIssueDaySuffix(prisma, yyyymmdd));
  return `PX-${yyyymmdd}-${String(next).padStart(4, '0')}`;
}

type ItemInput = {
  partInternalCode: string;
  partName?: string;
  unit?: string;
  qty: number;
  description?: string;
};

/** GET preview số phiếu */
export async function getNextStockIssueNumber(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    if (!isStockIssueCreator(request.user?.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const issueNumber = await previewStockIssueNumber();
    return reply.send({ issueNumber });
  } catch (e: any) {
    console.error(e);
    return reply.code(500).send({ error: e?.message || 'Lỗi' });
  }
}

/** GET tồn khả dụng theo danh sách mã part (aggregate theo part) */
export async function getPartStockAvailability(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    if (!isStockIssueCreator(request.user?.role) && !isWarehouse(request.user?.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const q = request.query as { codes?: string };
    const raw = (q.codes ?? '').split(',').map((c) => c.trim()).filter(Boolean);
    if (raw.length === 0) {
      return reply.send({ byPart: {} });
    }
    const rows = await prisma.inventoryBalance.groupBy({
      by: ['partInternalCode'],
      where: { partInternalCode: { in: raw }, companyId: INVENTORY_COMPANY_ID },
      _sum: { quantityAvailable: true, quantityReserved: true },
    });
    const byPart: Record<string, { available: number; onHand: number; reserved: number }> = {};
    for (const r of rows) {
      const onHand = Number(r._sum.quantityAvailable ?? 0);
      const reserved = Number(r._sum.quantityReserved ?? 0);
      const available = Math.max(0, onHand - reserved);
      byPart[r.partInternalCode] = { available, onHand, reserved };
    }
    for (const c of raw) {
      if (!byPart[c]) byPart[c] = { available: 0, onHand: 0, reserved: 0 };
    }
    return reply.send({ byPart });
  } catch (e: any) {
    console.error(e);
    return reply.code(500).send({ error: e?.message || 'Lỗi' });
  }
}

function mapIssue(
  row: {
    id: string;
    issueNumber: string;
    status: string;
    purpose: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    requestor?: { id: string; username: string; fullName: string | null };
    salesPO?: { id: string; salesPONumber: string; customerPONumber: string | null } | null;
    purchaseRequest?: {
      id: string;
      prNumber: string;
      projectCode: string | null;
      projectName: string | null;
    } | null;
    items?: Array<{
      id: string;
      lineNo: number;
      partInternalCode: string;
      partName: string | null;
      unit: string | null;
      qty: Prisma.Decimal;
      qtyShipped?: Prisma.Decimal | null;
      description: string | null;
    }>;
  },
  reservedByItemId: Record<string, number> = {}
) {
  return {
    id: row.id,
    issueNumber: row.issueNumber,
    status: row.status,
    purpose: row.purpose,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    requestor: row.requestor,
    salesPO: row.salesPO
      ? {
          id: row.salesPO.id,
          salesPONumber: row.salesPO.salesPONumber,
          customerPONumber: row.salesPO.customerPONumber,
        }
      : null,
    purchaseRequest: row.purchaseRequest
      ? {
          id: row.purchaseRequest.id,
          prNumber: row.purchaseRequest.prNumber,
          projectCode: row.purchaseRequest.projectCode,
          projectName: row.purchaseRequest.projectName,
        }
      : null,
    items: (row.items ?? []).map((it) => ({
      id: it.id,
      lineNo: it.lineNo,
      partInternalCode: it.partInternalCode,
      partName: it.partName,
      unit: it.unit,
      qty: Number(it.qty),
      qtyShipped: Number(it.qtyShipped ?? 0),
      reservedQty: reservedByItemId[it.id] ?? 0,
      description: it.description,
    })),
  };
}

async function loadIssueDto(id: string) {
  const full = await prisma.stockIssue.findUnique({
    where: { id },
    include: stockIssueInclude,
  });
  if (!full) return null;
  const resMap = await reservationSumsForItemIds(full.items.map((i) => i.id));
  return mapIssue(full, resMap);
}

/** Danh sách phiếu của requestor */
export async function listMyStockIssues(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    if (!isStockIssueCreator(request.user?.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = request.query as { status?: string; from?: string; to?: string; salesPo?: string };
    const where: Prisma.StockIssueWhereInput = { requestorId: userId, deletedAt: null };
    where.status = { in: parseStatusList(q.status, ALL_STOCK_ISSUE_STATUSES) };
    if (q.from?.trim() || q.to?.trim()) {
      where.createdAt = {};
      if (q.from?.trim()) where.createdAt.gte = new Date(q.from);
      if (q.to?.trim()) {
        const t = new Date(q.to);
        t.setHours(23, 59, 59, 999);
        where.createdAt.lte = t;
      }
    }
    if (q.salesPo?.trim()) {
      const term = q.salesPo.trim();
      where.salesPO = {
        OR: [
          { salesPONumber: { contains: term, mode: 'insensitive' } },
          { customerPONumber: { contains: term, mode: 'insensitive' } },
        ],
      };
    }
    const list = await prisma.stockIssue.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        items: stockIssueInclude.items,
        salesPO: stockIssueInclude.salesPO,
        purchaseRequest: stockIssueInclude.purchaseRequest,
      },
    });
    const itemIds = list.flatMap((r) => r.items.map((i) => i.id));
    const resMap = await reservationSumsForItemIds(itemIds);
    return reply.send({ issues: list.map((r) => mapIssue(r, resMap)) });
  } catch (e: any) {
    console.error(e);
    return reply.code(500).send({ error: e?.message || 'Lỗi' });
  }
}

/** Hàng đợi kho */
export async function listWarehouseStockIssues(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    if (!isWarehouse(request.user?.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const q = request.query as { status?: string; from?: string; to?: string; salesPo?: string };
    const statuses = parseStatusList(q.status, ['RESERVED', 'APPROVED']);
    const where: Prisma.StockIssueWhereInput = {
      deletedAt: null,
      status: { in: statuses },
    };
    if (q.from?.trim() || q.to?.trim()) {
      where.createdAt = {};
      if (q.from?.trim()) where.createdAt.gte = new Date(q.from);
      if (q.to?.trim()) {
        const t = new Date(q.to);
        t.setHours(23, 59, 59, 999);
        where.createdAt.lte = t;
      }
    }
    if (q.salesPo?.trim()) {
      const term = q.salesPo.trim();
      where.salesPO = {
        OR: [
          { salesPONumber: { contains: term, mode: 'insensitive' } },
          { customerPONumber: { contains: term, mode: 'insensitive' } },
        ],
      };
    }
    const list = await prisma.stockIssue.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 500,
      include: {
        requestor: stockIssueInclude.requestor,
        items: stockIssueInclude.items,
        salesPO: stockIssueInclude.salesPO,
        purchaseRequest: stockIssueInclude.purchaseRequest,
      },
    });
    const itemIds = list.flatMap((r) => r.items.map((i) => i.id));
    const resMap = await reservationSumsForItemIds(itemIds);
    return reply.send({ issues: list.map((r) => mapIssue(r, resMap)) });
  } catch (e: any) {
    console.error(e);
    return reply.code(500).send({ error: e?.message || 'Lỗi' });
  }
}

export async function getStockIssueById(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id: string };
    const row = await prisma.stockIssue.findFirst({
      where: { id, deletedAt: null },
      include: stockIssueInclude,
    });
    if (!row) return reply.code(404).send({ error: 'Not found' });
    const uid = request.user?.userId;
    const role = request.user?.role;
    if ((role === REQUESTOR || role === DEPARTMENT_HEAD) && row.requestorId !== uid) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    if (role === REQUESTOR || role === DEPARTMENT_HEAD || isWarehouse(role)) {
      const resMap = await reservationSumsForItemIds(row.items.map((i) => i.id));
      return reply.send(mapIssue(row, resMap));
    }
    return reply.code(403).send({ error: 'Forbidden' });
  } catch (e: any) {
    console.error(e);
    return reply.code(500).send({ error: e?.message || 'Lỗi' });
  }
}

/** Tạo phiếu DRAFT hoặc submit thẳng RESERVED */
export async function createStockIssue(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    if (!isStockIssueCreator(request.user?.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const body = request.body as {
      purpose?: string;
      notes?: string;
      salesPoId?: string;
      purchaseRequestId?: string;
      items: ItemInput[];
      action?: 'DRAFT' | 'SUBMIT';
    };
    if (!body.items?.length) {
      return reply.code(400).send({ error: 'Cần ít nhất một dòng vật tư' });
    }
    for (const it of body.items) {
      if (!it.partInternalCode?.trim() || !Number(it.qty) || Number(it.qty) <= 0) {
        return reply.code(400).send({ error: 'Mỗi dòng cần mã vật tư và số lượng > 0' });
      }
    }

    let salesPoId: string | null = null;
    if (body.salesPoId?.trim()) {
      const sid = body.salesPoId.trim();
      const po = await prisma.salesPO.findFirst({
        where: { id: sid, deletedAt: null },
        select: { id: true },
      });
      if (!po) return reply.code(400).send({ error: 'Sales PO không tồn tại' });
      salesPoId = sid;
    }

    const prResolved = await resolvePurchaseRequestIdForStockIssue(
      body.purchaseRequestId,
      userId,
      request.user?.role
    );
    if (prResolved.error && prResolved.status) {
      return reply.code(prResolved.status).send({ error: prResolved.error });
    }
    const purchaseRequestId = prResolved.id;

    const action = body.action === 'SUBMIT' ? 'SUBMIT' : 'DRAFT';
    const yyyymmdd = getYYYYMMDD();
    const seqKey = stockIssueSequenceKey(yyyymmdd);

    const created = await prisma.$transaction(async (tx) => {
      const seq = await allocateNextCounter(tx, seqKey, () => scanMaxStockIssueDaySuffix(tx, yyyymmdd));
      const issueNumber = `PX-${yyyymmdd}-${String(seq).padStart(4, '0')}`;
      const issue = await tx.stockIssue.create({
        data: {
          issueNumber,
          requestorId: userId,
          salesPoId,
          purchaseRequestId,
          status: action === 'SUBMIT' ? 'RESERVED' : 'DRAFT',
          purpose: body.purpose ?? null,
          notes: body.notes ?? null,
          companyId: INVENTORY_COMPANY_ID,
          items: {
            create: body.items.map((it, idx) => ({
              lineNo: idx + 1,
              partInternalCode: it.partInternalCode.trim(),
              partName: it.partName?.trim() || null,
              unit: it.unit?.trim() || null,
              qty: new Prisma.Decimal(it.qty),
              description: it.description?.trim() || null,
              companyId: INVENTORY_COMPANY_ID,
            })),
          },
        },
        include: {
          items: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } },
        },
      });

      if (action === 'SUBMIT') {
        for (const item of issue.items) {
          await allocateReservationsForIssueItem(tx, {
            issueItemId: item.id,
            partInternalCode: item.partInternalCode,
            qty: Number(item.qty),
            userId,
          });
        }
      }

      return issue;
    });

    const dto = await loadIssueDto(created.id);
    if (!dto) return reply.code(500).send({ error: 'Không tải được phiếu sau khi tạo' });
    return reply.code(201).send(dto);
  } catch (e: any) {
    if (e instanceof InsufficientStockError) {
      return reply.code(400).send({
        error: e.message,
        code: e.code,
        partCode: e.partCode,
        requested: e.requested,
        available: e.available,
      });
    }
    console.error(e);
    return reply.code(500).send({ error: e?.message || 'Lỗi' });
  }
}

/** Cập nhật phiếu DRAFT (thay toàn bộ dòng) */
export async function updateDraftStockIssue(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    if (!isStockIssueCreator(request.user?.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = request.params as { id: string };
    const body = request.body as {
      purpose?: string;
      notes?: string;
      salesPoId?: string;
      purchaseRequestId?: string | null;
      items: ItemInput[];
    };
    const issue = await prisma.stockIssue.findFirst({
      where: { id, requestorId: userId, deletedAt: null },
    });
    if (!issue) return reply.code(404).send({ error: 'Not found' });
    if (issue.status !== 'DRAFT') {
      return reply.code(400).send({ error: 'Chỉ sửa được phiếu ở trạng thái DRAFT' });
    }
    if (!body.items?.length) {
      return reply.code(400).send({ error: 'Cần ít nhất một dòng vật tư' });
    }

    let salesPoId: string | null | undefined = undefined;
    if (body.salesPoId !== undefined) {
      if (body.salesPoId === '' || body.salesPoId == null) {
        salesPoId = null;
      } else {
        const sid = body.salesPoId.trim();
        const po = await prisma.salesPO.findFirst({
          where: { id: sid, deletedAt: null },
          select: { id: true },
        });
        if (!po) return reply.code(400).send({ error: 'Sales PO không tồn tại' });
        salesPoId = sid;
      }
    }

    let purchaseRequestIdUpdate: string | null | undefined = undefined;
    if (body.purchaseRequestId !== undefined) {
      if (body.purchaseRequestId === '' || body.purchaseRequestId == null) {
        purchaseRequestIdUpdate = null;
      } else {
        const prResolved = await resolvePurchaseRequestIdForStockIssue(
          body.purchaseRequestId,
          userId,
          request.user?.role
        );
        if (prResolved.error && prResolved.status) {
          return reply.code(prResolved.status).send({ error: prResolved.error });
        }
        purchaseRequestIdUpdate = prResolved.id;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockIssueItem.updateMany({
        where: { stockIssueId: id },
        data: { deletedAt: new Date() },
      });
      let line = 1;
      for (const it of body.items) {
        await tx.stockIssueItem.create({
          data: {
            stockIssueId: id,
            lineNo: line++,
            partInternalCode: it.partInternalCode.trim(),
            partName: it.partName?.trim() || null,
            unit: it.unit?.trim() || null,
            qty: new Prisma.Decimal(it.qty),
            description: it.description?.trim() || null,
            companyId: INVENTORY_COMPANY_ID,
          },
        });
      }
      await tx.stockIssue.update({
        where: { id },
        data: {
          purpose: body.purpose ?? issue.purpose,
          notes: body.notes ?? issue.notes,
          ...(salesPoId !== undefined ? { salesPoId } : {}),
          ...(purchaseRequestIdUpdate !== undefined ? { purchaseRequestId: purchaseRequestIdUpdate } : {}),
        },
      });
    });

    const dto = await loadIssueDto(id);
    if (!dto) return reply.code(500).send({ error: 'Không tải được phiếu' });
    return reply.send(dto);
  } catch (e: any) {
    console.error(e);
    return reply.code(500).send({ error: e?.message || 'Lỗi' });
  }
}

/** DRAFT → RESERVED + reserve */
export async function submitStockIssue(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    if (!isStockIssueCreator(request.user?.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = request.params as { id: string };
    const issue = await prisma.stockIssue.findFirst({
      where: { id, requestorId: userId, deletedAt: null },
      include: { items: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } } },
    });
    if (!issue) return reply.code(404).send({ error: 'Not found' });
    if (issue.status !== 'DRAFT') {
      return reply.code(400).send({ error: 'Phiếu đã gửi hoặc không còn DRAFT' });
    }
    if (!issue.items.length) {
      return reply.code(400).send({ error: 'Không có dòng vật tư' });
    }

    await prisma.$transaction(async (tx) => {
      for (const item of issue.items) {
        await allocateReservationsForIssueItem(tx, {
          issueItemId: item.id,
          partInternalCode: item.partInternalCode,
          qty: Number(item.qty),
          userId,
        });
      }
      await tx.stockIssue.update({
        where: { id },
        data: { status: 'RESERVED' },
      });
    });

    const dto = await loadIssueDto(id);
    if (!dto) return reply.code(500).send({ error: 'Không tải được phiếu' });
    return reply.send(dto);
  } catch (e: any) {
    if (e instanceof InsufficientStockError) {
      return reply.code(400).send({
        error: e.message,
        code: e.code,
        partCode: e.partCode,
        requested: e.requested,
        available: e.available,
      });
    }
    console.error(e);
    return reply.code(500).send({ error: e?.message || 'Lỗi' });
  }
}

/** Requestor hủy: RESERVED → CANCELLED + release */
export async function cancelStockIssue(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    if (!isStockIssueCreator(request.user?.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = request.params as { id: string };
    const issue = await prisma.stockIssue.findFirst({
      where: { id, requestorId: userId, deletedAt: null },
    });
    if (!issue) return reply.code(404).send({ error: 'Not found' });
    if (issue.status !== 'DRAFT' && issue.status !== 'RESERVED') {
      return reply.code(400).send({ error: 'Chỉ hủy được DRAFT hoặc RESERVED' });
    }

    await prisma.$transaction(async (tx) => {
      if (issue.status === 'RESERVED') {
        await releaseAllReservationsForStockIssue(tx, id, userId, 'Requestor hủy phiếu');
      }
      await tx.stockIssue.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    });

    const dto = await loadIssueDto(id);
    if (!dto) return reply.code(500).send({ error: 'Không tải được phiếu' });
    return reply.send(dto);
  } catch (e: any) {
    console.error(e);
    return reply.code(500).send({ error: e?.message || 'Lỗi' });
  }
}

/** Điều chỉnh SL một dòng (RESERVED) */
export async function patchStockIssueItemQty(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    if (!isStockIssueCreator(request.user?.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id, itemId } = request.params as { id: string; itemId: string };
    const body = request.body as { qty: number };
    const newQty = Number(body.qty);
    if (!Number.isFinite(newQty) || newQty <= 0) {
      return reply.code(400).send({ error: 'qty phải > 0' });
    }

    const issue = await prisma.stockIssue.findFirst({
      where: { id, requestorId: userId, deletedAt: null },
    });
    if (!issue) return reply.code(404).send({ error: 'Not found' });
    if (issue.status !== 'RESERVED') {
      return reply.code(400).send({ error: 'Chỉ đổi SL khi phiếu RESERVED' });
    }

    const item = await prisma.stockIssueItem.findFirst({
      where: { id: itemId, stockIssueId: id, deletedAt: null },
    });
    if (!item) return reply.code(404).send({ error: 'Dòng không tồn tại' });
    if (Number(item.qtyShipped ?? 0) > 1e-9) {
      return reply.code(400).send({ error: 'Không đổi SL sau khi đã xuất một phần' });
    }

    await prisma.$transaction(async (tx) => {
      await adjustIssueItemReservations(tx, {
        issueItemId: item.id,
        partInternalCode: item.partInternalCode,
        newQty,
        userId,
      });
      await tx.stockIssueItem.update({
        where: { id: item.id },
        data: { qty: new Prisma.Decimal(newQty) },
      });
    });

    const dto = await loadIssueDto(id);
    if (!dto) return reply.code(500).send({ error: 'Không tải được phiếu' });
    return reply.send(dto);
  } catch (e: any) {
    if (e instanceof InsufficientStockError) {
      return reply.code(400).send({
        error: e.message,
        code: e.code,
        partCode: e.partCode,
        requested: e.requested,
        available: e.available,
      });
    }
    console.error(e);
    return reply.code(500).send({ error: e?.message || 'Lỗi' });
  }
}

/** Kho duyệt RESERVED → APPROVED */
export async function approveStockIssue(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    if (!isWarehouse(request.user?.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = request.params as { id: string };
    const issue = await prisma.stockIssue.findFirst({ where: { id, deletedAt: null } });
    if (!issue) return reply.code(404).send({ error: 'Not found' });
    if (issue.status !== 'RESERVED') {
      return reply.code(400).send({ error: 'Chỉ duyệt phiếu RESERVED' });
    }
    await prisma.stockIssue.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: userId },
    });
    const dto = await loadIssueDto(id);
    if (!dto) return reply.code(500).send({ error: 'Không tải được phiếu' });
    return reply.send(dto);
  } catch (e: any) {
    console.error(e);
    return reply.code(500).send({ error: e?.message || 'Lỗi' });
  }
}

/** Kho từ chối */
export async function rejectStockIssue(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    if (!isWarehouse(request.user?.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = request.params as { id: string };
    const body = request.body as { reason?: string };
    const issue = await prisma.stockIssue.findFirst({ where: { id, deletedAt: null } });
    if (!issue) return reply.code(404).send({ error: 'Not found' });
    if (issue.status !== 'RESERVED' && issue.status !== 'APPROVED') {
      return reply.code(400).send({ error: 'Không thể từ chối trạng thái này' });
    }

    await prisma.$transaction(async (tx) => {
      await releaseAllReservationsForStockIssue(
        tx,
        id,
        userId,
        body.reason?.trim() || 'Kho từ chối'
      );
      await tx.stockIssue.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedReason: body.reason?.trim() || null,
        },
      });
    });

    const dto = await loadIssueDto(id);
    if (!dto) return reply.code(500).send({ error: 'Không tải được phiếu' });
    return reply.send(dto);
  } catch (e: any) {
    console.error(e);
    return reply.code(500).send({ error: e?.message || 'Lỗi' });
  }
}

/** Xuất kho APPROVED → ISSUED (một phần hoặc hết; ISSUED khi mọi dòng đủ qty) */
export async function shipStockIssue(request: AuthenticatedRequest, reply: FastifyReply) {
  try {
    if (!isWarehouse(request.user?.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = request.params as { id: string };
    const body = request.body as { items?: { itemId: string; qty: number }[] } | undefined;
    const issue = await prisma.stockIssue.findFirst({ where: { id, deletedAt: null } });
    if (!issue) return reply.code(404).send({ error: 'Not found' });
    if (issue.status !== 'APPROVED') {
      return reply.code(400).send({ error: 'Chỉ xuất khi phiếu APPROVED' });
    }

    const itemRows = await prisma.stockIssueItem.findMany({
      where: { stockIssueId: id, deletedAt: null },
    });
    const validIds = new Set(itemRows.map((r) => r.id));

    if (body?.items?.length) {
      for (const row of body.items) {
        const iid = row.itemId?.trim();
        if (!iid || !validIds.has(iid)) {
          return reply.code(400).send({ error: 'itemId không hợp lệ' });
        }
        const q = Number(row.qty);
        if (!Number.isFinite(q) || q <= 0) {
          return reply.code(400).send({ error: 'Mỗi dòng xuất cần qty > 0' });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (body?.items?.length) {
        for (const row of body.items!) {
          await fulfillIssueItemShipment(tx, {
            issueItemId: row.itemId.trim(),
            shipQty: Number(row.qty),
            userId,
          });
        }
      } else {
        await fulfillStockIssueShipments(tx, id, userId);
      }

      const after = await tx.stockIssueItem.findMany({
        where: { stockIssueId: id, deletedAt: null },
      });
      const allDone = after.every(
        (it) => Number(it.qtyShipped ?? 0) >= Number(it.qty) - 1e-9
      );
      if (allDone) {
        await tx.stockIssue.update({
          where: { id },
          data: { status: 'ISSUED', issuedById: userId },
        });
      }
    });

    const dto = await loadIssueDto(id);
    if (!dto) return reply.code(500).send({ error: 'Không tải được phiếu' });
    return reply.send(dto);
  } catch (e: any) {
    if (e instanceof InsufficientStockError) {
      return reply.code(400).send({
        error: e.message,
        code: e.code,
        partCode: e.partCode,
        requested: e.requested,
        available: e.available,
      });
    }
    console.error(e);
    return reply.code(500).send({ error: e?.message || 'Lỗi' });
  }
}
