/**
 * PO Module (Phase 3) – Buyer: tạo PO, submit. Buyer Leader duyệt (trong buyerLeaderController).
 *
 * NGHIỆP VỤ:
 * - PO thuộc PR (purchaseRequestId), KHÔNG thuộc RFQ. Quan hệ: PR → PO, PR → RFQ (độc lập).
 * - Buyer tạo PO dựa trên kết quả "Supplier Selected" của PR (SupplierSelection), group theo supplier.
 * - Một PR có thể có nhiều RFQ; PO chỉ quan tâm item + supplier đã được Buyer Leader chọn (group theo NCC).
 * - Luồng: RFQ hoàn tất → PR = RFQ_COMPLETED → Buyer vào "PR chờ tạo PO" → tạo PO từ PR (không từ RFQ).
 */
import { FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  allocateNextCounter,
  poDraftSequenceKey,
  scanMaxPODraftYearSuffix,
} from '../utils/documentSequence';
import { getProcurementCompletePrItemIdsForPurchaseRequests, parsePoItemIdsJson } from '../utils/procurementItemGates';
import { prismaDepartmentOutcomeRowActive } from '../utils/departmentPrItemReview';
import { inferVatPercentFromLine } from '../utils/quotationLine';
import { resolveRfqNumbersForPo } from '../utils/poRfqResolve';
import {
  parseIsoDateOnly,
  parseSupplierConfirmLines,
  resolveLineStatusAfterReceive,
  toPoNum,
} from '../utils/poLineConfirmation';
import {
  effectiveSupplierTaxCode,
  mapSupplierTaxForPoView,
  trimSupplierTaxCode,
} from '../utils/poSupplierTax';
import {
  buildPoExcelFlatRows,
  excelContentDisposition,
  fetchPosForExcelExport,
  writePoExcelBuffer,
} from '../utils/poExcelExport';
import {
  executePoPartialLineCancel,
  formatPoPartialLineCancelMessage,
  resolveLegacyCancelRequestedPo,
} from '../utils/executePoPartialLineCancel';

import {
  buildQuotationDeliveryMaps,
  resolvePoLineExpectedDeliveryYmd,
} from '../utils/poLineEta';

function maxQuotationDeliveryDate(items: Array<{ deliveryDate?: Date | null }>): Date | undefined {
  const dates = items.map((it) => it.deliveryDate).filter((d): d is Date => d != null);
  if (dates.length === 0) return undefined;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

/**
 * Keep this list backward-compatible with databases that have not run the
 * latest PO cancellation enum migration yet.
 */
const ACTIVE_PO_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'ISSUED',
  'CREATED',
  'SENT',
  'CONFIRMED',
  'PARTIAL_RECEIVED',
] as const;

/** Dòng báo giá khớp selection — truy vấn trực tiếp, tránh lệch do filter include trên quotation.items. */
async function findQuotationLineForSelection(
  quotationId: string,
  purchaseRequestItemId: string | null | undefined
) {
  if (!purchaseRequestItemId) return null;
  return prisma.quotationItem.findFirst({
    where: {
      quotationId,
      purchaseRequestItemId,
      deletedAt: null,
    },
  });
}

async function getReceivedByPoItemIds(poItemIds: string[]) {
  if (poItemIds.length === 0) return new Map<string, number>();
  const rows = await prisma.goodsReceiptLine.groupBy({
    by: ['poItemId'],
    where: { poItemId: { in: poItemIds } },
    _sum: { qtyReceived: true },
  });
  const receivedMap = new Map<string, number>();
  for (const row of rows) {
    receivedMap.set(row.poItemId, Number(row._sum.qtyReceived || 0));
  }
  return receivedMap;
}

/** Danh sách PR chờ tạo PO (Buyer chỉ thấy PR mình có assignment, còn item đủ điều kiện tạo PO – không phụ thuộc toàn bộ PR đã RFQ xong hay chưa) */
export const getPRsWaitingPO = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const prs = await prisma.purchaseRequest.findMany({
      where: {
        deletedAt: null,
        // Không khóa theo status PR, chỉ cần có assignment + đã có SupplierSelection
        assignments: { some: { buyerId: userId, deletedAt: null } },
        supplierSelections: { some: {} },
      },
      include: {
        requestor: { select: { username: true } },
        supplierSelections: {
          include: {
            quotation: {
              select: {
                totalAmount: true,
                supplier: { select: { id: true, name: true } },
              },
            },
          },
        },
        assignments: {
          where: { buyerId: userId, deletedAt: null },
          select: { id: true, scope: true, assignedItemIds: true, buyerId: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    // Lấy tất cả PO items để biết item nào đã có PO
    const prIds = prs.map((pr) => pr.id);
    const poItems = await prisma.pOItem.findMany({
      where: {
        purchaseOrder: {
          purchaseRequestId: { in: prIds },
          deletedAt: null,
          status: { in: ACTIVE_PO_STATUSES as any },
        },
      },
      select: {
        purchaseRequestItemId: true,
        purchaseOrder: { select: { purchaseRequestId: true } },
      },
    });
    const poItemsByPR = new Map<string, Set<string>>();
    for (const item of poItems) {
      const pid = item.purchaseOrder.purchaseRequestId;
      if (!poItemsByPR.has(pid)) {
        poItemsByPR.set(pid, new Set());
      }
      poItemsByPR.get(pid)!.add(item.purchaseRequestItemId);
    }

    const procurementComplete = await getProcurementCompletePrItemIdsForPurchaseRequests(prIds);

    const list: Array<{
      prId: string;
      prCode: string;
      requestor: string;
      department: string;
      totalBudget: number | null;
      selectedAmount: number | null;
      currency: string;
      supplierCount: number;
      hasPO: boolean;
      canCreateMorePO: boolean;
      pendingItemCount: number;
      status: string;
      action: string;
    }> = [];

    for (const pr of prs) {
      const assignment = pr.assignments[0];
      if (!assignment) continue;

      let allowedItemIds: string[] | null = null;
      if (assignment.scope === 'PARTIAL') {
        if (!assignment.assignedItemIds) continue;
        try {
          allowedItemIds = JSON.parse(assignment.assignedItemIds) as string[];
        } catch (e) {
          console.error('Invalid assignedItemIds JSON in PRAssignment (getPRsWaitingPO):', assignment.assignedItemIds, e);
          continue;
        }
      }

      const poItemIds = poItemsByPR.get(pr.id) ?? new Set<string>();

      const selectionInScope = (sel: { purchaseRequestItemId: string | null }) => {
        if (!sel.purchaseRequestItemId) return false;
        if (allowedItemIds && !allowedItemIds.includes(sel.purchaseRequestItemId)) return false;
        return true;
      };

      // Tìm các selection thỏa: có item, thuộc assignment (nếu PARTIAL), và chưa có PO
      const remainingSelections = pr.supplierSelections.filter((sel) => {
        if (!selectionInScope(sel)) return false;
        if (poItemIds.has(sel.purchaseRequestItemId!)) return false;
        if (procurementComplete.has(sel.purchaseRequestItemId!)) return false;
        return true;
      });

      if (remainingSelections.length === 0) continue;

      const totalBudget = pr.totalAmount ? Number(pr.totalAmount) : null;

      /** Tổng thành tiền từng dòng đã chọn NCC (có VAT) — không cộng lặp quotation.totalAmount. */
      let selectedAmount = 0;
      for (const sel of pr.supplierSelections) {
        if (!selectionInScope(sel)) continue;
        const qi = await findQuotationLineForSelection(sel.quotationId, sel.purchaseRequestItemId);
        if (qi) selectedAmount += Number(qi.totalPrice || 0);
      }

      const supplierCount = new Set(
        remainingSelections.map((s) => s.quotation?.supplier?.id).filter(Boolean)
      ).size;

      list.push({
        prId: pr.id,
        prCode: pr.prNumber,
        requestor: pr.requestor?.username ?? '-',
        department: pr.department ?? '-',
        totalBudget,
        selectedAmount: selectedAmount > 0 ? selectedAmount : null,
        currency: pr.currency,
        supplierCount,
        hasPO: poItemIds.size > 0,
        canCreateMorePO: remainingSelections.length > 0,
        pendingItemCount: remainingSelections.length,
        status: pr.status,
        action: 'Create PO',
      });
    }

    reply.send({ prs: list });
  } catch (error: any) {
    console.error('Get PRs waiting PO error:', error);
    const message = error?.message || 'Internal server error';
    const code = error?.code;
    reply.code(500).send({
      error: 'Internal server error',
      message,
      ...(code && { code }),
    });
  }
};

/** Chi tiết PR để tạo PO: group theo supplier */
export const getPRDetailForPO = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { prId } = request.params as { prId: string };

    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: prId, deletedAt: null },
      include: {
        requestor: { select: { username: true, location: true } },
        supplierSelections: {
          include: {
            quotation: {
              include: {
                supplier: { select: { id: true, name: true, code: true, address: true, taxCode: true } },
                items: {
                  where: { deletedAt: null },
                  orderBy: { lineNo: 'asc' },
                },
              },
            },
          },
        },
        purchaseOrders: {
          where: { deletedAt: null },
          include: { supplier: { select: { id: true, name: true, code: true } }, items: true },
        },
      },
    });

    if (!pr) return reply.code(404).send({ error: 'PR not found' });
    const assignment = await prisma.pRAssignment.findFirst({
      where: { purchaseRequestId: prId, buyerId: userId, deletedAt: null },
    });
    if (!assignment) return reply.code(403).send({ error: 'Bạn không được phân công PR này' });
    // Cho phép Buyer tạo PO miễn là PR chưa bị hủy/đóng và đã có SupplierSelection cho item của mình.
    // Không bắt buộc toàn bộ PR phải RFQ_COMPLETED.

    const totalBudget = pr.totalAmount ? Number(pr.totalAmount) : null;

    // Lấy thông tin PO cho từng PR item (để hiển thị cột PO ✔/✖ trong UI)
    const poItems = await prisma.pOItem.findMany({
      where: {
        purchaseOrder: {
          purchaseRequestId: prId,
          deletedAt: null,
          status: { in: ACTIVE_PO_STATUSES as any },
        },
      },
      select: {
        purchaseRequestItemId: true,
        purchaseOrder: {
          select: { poNumber: true },
        },
      },
    });
    const itemToPO = new Map<string, { poNumber: string }>();
    for (const it of poItems) {
      itemToPO.set(it.purchaseRequestItemId, { poNumber: it.purchaseOrder.poNumber });
    }

    const procurementComplete = await getProcurementCompletePrItemIdsForPurchaseRequests([prId]);

    // Chỉ tính các item thuộc phạm vi phân công của Buyer hiện tại
    const bySupplier = new Map<
      string,
      { supplier: any; quotationId: string; items: any[]; totalAmount: number }
    >();
    for (const sel of pr.supplierSelections) {
      const q = sel.quotation;
      if (!q?.supplier) continue;

      // Filter theo assignment: Buyer chỉ thấy item mình phụ trách
      if (assignment.scope === 'PARTIAL') {
        if (!sel.purchaseRequestItemId) {
          // Legacy selection không gắn item cụ thể → bỏ qua cho buyer được phân công theo item
          continue;
        }
        if (!assignment.assignedItemIds) {
          continue;
        }
        let assignedItemIds: string[];
        try {
          assignedItemIds = JSON.parse(assignment.assignedItemIds) as string[];
        } catch (e) {
          console.error('Invalid assignedItemIds JSON in PRAssignment:', assignment.assignedItemIds, e);
          continue;
        }
        if (!assignedItemIds.includes(sel.purchaseRequestItemId)) {
          continue;
        }
      }

      if (!sel.purchaseRequestItemId) continue;

      const sid = q.supplier.id;
      if (!bySupplier.has(sid)) {
        bySupplier.set(sid, { supplier: q.supplier, quotationId: q.id, items: [], totalAmount: 0 });
      }
      const group = bySupplier.get(sid)!;
      const qi = await findQuotationLineForSelection(q.id, sel.purchaseRequestItemId);
      if (!qi) continue;

      const poInfo = itemToPO.get(sel.purchaseRequestItemId);
      group.items.push({
        quotationItemId: qi.id,
        purchaseRequestItemId: sel.purchaseRequestItemId,
        lineNo: qi.lineNo,
        description: qi.description,
        qty: Number(qi.qty),
        unit: qi.unit,
        unitPrice: Number(qi.unitPrice),
        amount: Number(qi.totalPrice || 0),
        hasPO: !!poInfo,
        poNumber: poInfo?.poNumber ?? null,
      });
      group.totalAmount += Number(qi.totalPrice || 0);
    }
    const supplierGroups = Array.from(bySupplier.values()).filter((g) => g.items.length > 0);
    const selectedAmount = supplierGroups.reduce((sum, g) => sum + g.totalAmount, 0);

    reply.send({
      prId: pr.id,
      prCode: pr.prNumber,
      requestor: pr.requestor?.username ?? '-',
      department: pr.department ?? '-',
      approvedBudget: totalBudget,
      totalSelectedAmount: selectedAmount,
      currency: pr.currency,
      supplierGroups,
      existingPOs: pr.purchaseOrders.map((po) => ({
        id: po.id,
        poNumber: po.poNumber,
        status: po.status,
        supplier: po.supplier,
        totalAmount: Number(po.totalAmount),
        itemCount: po.items.length,
      })),
    });
  } catch (error: any) {
    console.error('Get PR detail for PO error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** Buyer tạo draft PO từ PR: lấy item + supplier đã chọn (SupplierSelection), group theo supplier → 1 PO / NCC. PO thuộc PR, không gắn RFQ. */
export const createDraftPOs = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { prId } = request.params as { prId: string };

    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: prId, deletedAt: null },
      include: {
        // Baseline ngày giao của Requestor: requiredDate của PR
        supplierSelections: {
          include: {
            quotation: {
              include: {
                supplier: true,
                items: {
                  where: {
                    deletedAt: null,
                    OR: [
                      { purchaseRequestItemId: null },
                      {
                        purchaseRequestItem: {
                          is: { deletedAt: null, ...prismaDepartmentOutcomeRowActive },
                        },
                      },
                    ],
                  },
                  orderBy: { lineNo: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!pr) return reply.code(404).send({ error: 'PR not found' });
    const assignment = await prisma.pRAssignment.findFirst({
      where: { purchaseRequestId: prId, buyerId: userId, deletedAt: null },
    });
    if (!assignment) return reply.code(403).send({ error: 'Bạn không được phân công PR này' });
    // Cho phép Buyer xem chi tiết tạo PO miễn là được phân công và PR chưa bị hủy,
    // không bắt buộc toàn bộ PR đã RFQ_COMPLETED.

    // Lấy danh sách PR item đã nằm trong bất kỳ PO nào của PR này
    const existingPOItems = await prisma.pOItem.findMany({
      where: {
        purchaseOrder: {
          purchaseRequestId: prId,
          deletedAt: null,
          status: { in: ACTIVE_PO_STATUSES as any },
        },
      },
      select: { purchaseRequestItemId: true },
    });
    const poItemIds = new Set(existingPOItems.map((i) => i.purchaseRequestItemId));

    const procurementComplete = await getProcurementCompletePrItemIdsForPurchaseRequests([prId]);

    // Group theo supplier: mỗi SupplierSelection = (item, quotation). 1 PO / NCC, mỗi PO chứa các item đã chọn NCC đó.
    const bySupplier = new Map<string, { quotation: any; supplier: any; items: any[] }>();
    for (const sel of pr.supplierSelections) {
      const q = sel.quotation;
      if (!q?.supplier) continue;

      // Chỉ tạo PO cho các item thuộc phạm vi phân công của Buyer hiện tại
      if (assignment.scope === 'PARTIAL') {
        if (!sel.purchaseRequestItemId) {
          // Legacy selection toàn RFQ (không gắn item cụ thể) → không dùng cho buyer được phân công theo item
          continue;
        }
        if (!assignment.assignedItemIds) {
          continue;
        }
        let assignedItemIds: string[];
        try {
          assignedItemIds = JSON.parse(assignment.assignedItemIds) as string[];
        } catch (e) {
          console.error('Invalid assignedItemIds JSON in PRAssignment:', assignment.assignedItemIds, e);
          continue;
        }
        if (!assignedItemIds.includes(sel.purchaseRequestItemId)) {
          continue;
        }
      }

      // Bỏ qua các item đã có PO
      if (sel.purchaseRequestItemId && poItemIds.has(sel.purchaseRequestItemId)) {
        continue;
      }

      if (sel.purchaseRequestItemId && procurementComplete.has(sel.purchaseRequestItemId)) {
        continue;
      }

      if (!sel.purchaseRequestItemId) continue;

      const sid = q.supplier.id;
      if (!bySupplier.has(sid)) {
        bySupplier.set(sid, { quotation: q, supplier: q.supplier, items: [] });
      }
      const qi = await findQuotationLineForSelection(q.id, sel.purchaseRequestItemId);
      if (qi) bySupplier.get(sid)!.items.push(qi);
    }

    for (const [sid, group] of [...bySupplier.entries()]) {
      if (group.items.length === 0) bySupplier.delete(sid);
    }

    // Nếu không còn item nào đủ điều kiện tạo PO → chặn
    if (bySupplier.size === 0) {
      return reply.code(400).send({ error: 'Không còn item nào đủ điều kiện tạo PO (đã có PO hoặc không được phân công).' });
    }

    const year = new Date().getFullYear();
    const seqKey = poDraftSequenceKey(year);

    const created = await prisma.$transaction(
      async (tx) => {
        const list: any[] = [];
        for (const [, group] of bySupplier) {
          if (group.items.length === 0) continue;
          const seq = await allocateNextCounter(tx, seqKey, () => scanMaxPODraftYearSuffix(tx, year));
          const poNumber = `PO-DRAFT-${year}-${String(seq).padStart(3, '0')}`;
          const totalAmount = group.items.reduce((s, it) => s + Number(it.totalPrice || 0), 0);
          const poDeliveryDate =
            maxQuotationDeliveryDate(group.items) ??
            (pr.requiredDate ? new Date(pr.requiredDate) : undefined);
          const po = await tx.purchaseOrder.create({
            data: {
              purchaseRequestId: prId,
              supplierId: group.supplier.id,
              poNumber,
              status: 'DRAFT',
              totalAmount,
              currency: pr.currency,
              deliveryDate: poDeliveryDate,
              createdById: userId,
              companyId: pr.companyId,
            },
          });
          for (const it of group.items) {
            const prItemId = it.purchaseRequestItemId;
            if (!prItemId) continue;
            await tx.pOItem.create({
              data: {
                purchaseOrderId: po.id,
                purchaseRequestItemId: prItemId,
                quotationItemId: it.id,
                lineNo: it.lineNo,
                description: it.description,
                qty: it.qty,
                unit: it.unit,
                unitPrice: it.unitPrice,
                amount: it.totalPrice ?? 0,
                expectedDeliveryDate: it.deliveryDate ?? undefined,
              },
            });
            await tx.purchaseRequestItem.updateMany({
              where: {
                id: prItemId,
                deletedAt: null,
                status: 'FULFILLED' as any,
              },
              data: { status: 'SUPPLIER_SELECTED' as any },
            });
          }
          list.push({
            id: po.id,
            poNumber: po.poNumber,
            supplierId: group.supplier.id,
            supplierName: group.supplier.name,
            totalAmount: Number(po.totalAmount),
            itemCount: group.items.length,
          });
        }

        if (pr.status === 'RFQ_COMPLETED' || pr.status === 'PO_PENDING') {
          await tx.purchaseRequest.update({
            where: { id: prId },
            data: { status: 'PO_IN_PROGRESS' as any },
          });
        }

        return list;
      },
      { maxWait: 15000, timeout: 60000 }
    );

    reply.send({ message: 'Đã tạo draft PO', pos: created });
  } catch (error: any) {
    console.error('Create draft POs error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** Danh sách PO của Buyer (createdBy = userId hoặc PR có assignment) */
export const getPOList = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const q = request.query as { poCode?: string; prCode?: string; supplier?: string; status?: string; from?: string; to?: string };

    const staleCancel = await prisma.purchaseOrder.findMany({
      where: { deletedAt: null, createdById: userId, status: 'CANCEL_REQUESTED' as any },
      select: { id: true },
    });
    for (const row of staleCancel) {
      try {
        await resolveLegacyCancelRequestedPo(row.id, userId);
      } catch (err) {
        console.warn('resolveLegacyCancelRequestedPo list', row.id, err);
      }
    }

    const pos = await prisma.purchaseOrder.findMany({
      where: {
        deletedAt: null,
        createdById: userId,
      },
      include: {
        purchaseRequest: { select: { id: true, prNumber: true } },
        supplier: { select: { id: true, name: true, code: true } },
        createdBy: { select: { username: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    let list = pos.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      prId: po.purchaseRequest.id,
      prCode: po.purchaseRequest.prNumber,
      supplier: po.supplier,
      totalAmount: Number(po.totalAmount),
      currency: po.currency,
      buyer: po.createdBy?.username ?? '-',
      status: po.status,
      cancelRequestReason: po.status === 'CANCEL_REQUESTED' || po.status === 'CANCELLED' ? po.rejectReason : null,
      createdAt: po.createdAt.toISOString(),
    }));
    list = list.filter((p) => {
      const poNumber = String(p.poNumber || '').toUpperCase();
      const prCode = String(p.prCode || '').toUpperCase();
      return !poNumber.startsWith('MOCK-') && !prCode.startsWith('MOCK-');
    });

    if (q.poCode) list = list.filter((p) => p.poNumber?.toLowerCase().includes(q.poCode!.toLowerCase()));
    if (q.prCode) list = list.filter((p) => p.prCode?.toLowerCase().includes(q.prCode!.toLowerCase()));
    if (q.supplier) list = list.filter((p) => p.supplier.name?.toLowerCase().includes(q.supplier!.toLowerCase()));
    if (q.status) list = list.filter((p) => p.status === q.status);

    reply.send({ pos: list });
  } catch (error: any) {
    console.error('Get PO list error:', error);
    const message = error?.message || 'Internal server error';
    const code = error?.code;
    reply.code(500).send({
      error: 'Internal server error',
      message,
      ...(code && { code }),
    });
  }
};

/** Chi tiết 1 PO (Buyer xem / sửa draft) */
export const getPODetail = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { poId } = request.params as { poId: string };

    let po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, deletedAt: null },
      include: {
        purchaseRequest: { select: { id: true, prNumber: true, totalAmount: true, currency: true, requiredDate: true } },
        supplier: true,
        createdBy: { select: { username: true } },
        items: true,
        attachments: { where: { deletedAt: null } },
      },
    });

    if (!po) return reply.code(404).send({ error: 'PO not found' });
    if (po.createdById !== userId) return reply.code(403).send({ error: 'Bạn không có quyền xem PO này' });

    if (String(po.status) === 'CANCEL_REQUESTED') {
      await resolveLegacyCancelRequestedPo(po.id, userId);
      po = await prisma.purchaseOrder.findFirst({
        where: { id: poId, deletedAt: null },
        include: {
          purchaseRequest: { select: { id: true, prNumber: true, totalAmount: true, currency: true, requiredDate: true } },
          supplier: true,
          createdBy: { select: { username: true } },
          items: true,
          attachments: { where: { deletedAt: null } },
        },
      });
      if (!po) return reply.code(404).send({ error: 'PO not found' });
    }

    const prItemIds = po.items.map((i) => i.purchaseRequestItemId).filter(Boolean);
    const prItems =
      prItemIds.length > 0
        ? await prisma.purchaseRequestItem.findMany({
            where: { id: { in: prItemIds } },
            select: {
              id: true,
              partNo: true,
              manufacturer: true,
              desiredDeliveryDate: true,
            },
          })
        : [];
    const prItemMetaMap = new Map(
      prItems.map((p) => [
        p.id,
        {
          partNo: p.partNo ?? '',
          manufacturer: p.manufacturer ?? '',
          desiredDeliveryDate: p.desiredDeliveryDate,
        },
      ])
    );

    const supplierSelections = await prisma.supplierSelection.findMany({
      where: { purchaseRequestId: po.purchaseRequestId },
      select: {
        purchaseRequestItemId: true,
        quotation: {
          select: {
            supplierId: true,
            items: {
              where: { deletedAt: null },
              select: {
                id: true,
                purchaseRequestItemId: true,
                deliveryDate: true,
              },
            },
          },
        },
      },
    });
    const selectionForPoSupplier = supplierSelections.filter(
      (s) => s.quotation.supplierId === po.supplierId
    );
    const { byQuotationItemId, byPrItemId } =
      buildQuotationDeliveryMaps(selectionForPoSupplier);

    const rfqNumbers = await resolveRfqNumbersForPo(
      po.purchaseRequestId,
      po.items.map((i) => i.quotationItemId)
    );
    const receivedByItem = await getReceivedByPoItemIds(po.items.map((i) => i.id));

    const quotationItemIds = po.items
      .map((i) => i.quotationItemId)
      .filter((id): id is string => Boolean(id));
    const quotationItems =
      quotationItemIds.length > 0
        ? await prisma.quotationItem.findMany({
            where: { id: { in: quotationItemIds }, deletedAt: null },
            select: { id: true, vatPercent: true, deliveryDate: true },
          })
        : [];
    const vatPercentByQuotationItemId = new Map(
      quotationItems.map((qi) => [qi.id, qi.vatPercent != null ? Number(qi.vatPercent) : null])
    );
    for (const qi of quotationItems) {
      const ymd = qi.deliveryDate ? qi.deliveryDate.toISOString().slice(0, 10) : null;
      if (ymd) byQuotationItemId.set(qi.id, ymd);
    }

    let approvedByUsername: string | null = null;
    if (po.approvedById) {
      const approver = await prisma.user.findUnique({
        where: { id: po.approvedById },
        select: { username: true },
      });
      approvedByUsername = approver?.username ?? null;
    }

    reply.send({
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      prId: po.purchaseRequest.id,
      prCode: po.purchaseRequest.prNumber,
      rfqRef: rfqNumbers.length > 0 ? rfqNumbers.join(', ') : null,
      rfqNumbers,
      supplier: mapSupplierTaxForPoView(po.supplier, po.buyerSupplierTaxCode),
      buyerSupplierTaxCode: po.buyerSupplierTaxCode,
      totalAmount: Number(po.totalAmount),
      currency: po.currency,
      paymentTerms: po.paymentTerms,
      deliveryAddress: po.deliveryAddress,
      incoterms: po.incoterms,
      projectCode: po.projectCode,
      /** Baseline ngày giao lấy từ Requestor ban đầu (PR.requiredDate). */
      baselineDeliveryDate: po.purchaseRequest.requiredDate?.toISOString() ?? null,
      /** Nếu PO chưa set deliveryDate thì fallback theo baseline của PR. */
      deliveryDate: (po.deliveryDate ?? po.purchaseRequest.requiredDate)?.toISOString() ?? null,
      note: po.note,
      prBudget: po.purchaseRequest.totalAmount ? Number(po.purchaseRequest.totalAmount) : null,
      buyer: po.createdBy?.username,
      approvedByUsername,
      createdAt: po.createdAt.toISOString(),
      submittedAt: po.submittedAt?.toISOString() ?? null,
      approvedAt: po.approvedAt?.toISOString() ?? null,
      supplierConfirmedAt: po.supplierConfirmedAt?.toISOString() ?? null,
      rejectReason: po.rejectReason,
      /** Thành tiền dòng & tổng PO lấy từ báo giá NCC (đã gồm VAT khi buyer nhập VAT trên báo giá). */
      amountsIncludeVat: true,
      items: po.items.map((i) => {
        const received = receivedByItem.get(i.id) ?? 0;
        const confirmed = i.confirmedQty != null ? toPoNum(i.confirmedQty) : null;
        const remaining =
          confirmed != null
            ? Math.max(0, confirmed - received)
            : Math.max(0, Number(i.qty) - received);
        return {
        id: i.id,
        lineNo: i.lineNo,
        purchaseRequestItemId: i.purchaseRequestItemId,
        quotationItemId: i.quotationItemId,
        prItemCode: prItemMetaMap.get(i.purchaseRequestItemId)?.partNo || '-',
        model: prItemMetaMap.get(i.purchaseRequestItemId)?.partNo || null,
        brand: prItemMetaMap.get(i.purchaseRequestItemId)?.manufacturer || null,
        description: i.description,
        qty: Number(i.qty),
        unit: i.unit,
        unitPrice: Number(i.unitPrice),
        amount: Number(i.amount),
        vatPercent: (() => {
          const fromQuotation =
            i.quotationItemId != null
              ? vatPercentByQuotationItemId.get(i.quotationItemId) ?? null
              : null;
          if (fromQuotation != null) return fromQuotation;
          return inferVatPercentFromLine(Number(i.qty), Number(i.unitPrice), Number(i.amount));
        })(),
        confirmedQty: confirmed,
        expectedDeliveryDate: resolvePoLineExpectedDeliveryYmd({
          expectedDeliveryDate: i.expectedDeliveryDate,
          quotationItemId: i.quotationItemId,
          purchaseRequestItemId: i.purchaseRequestItemId,
          quotationDeliveryByQuotationItemId: byQuotationItemId,
          quotationDeliveryByPrItemId: byPrItemId,
          desiredDeliveryDate:
            prItemMetaMap.get(i.purchaseRequestItemId)?.desiredDeliveryDate ?? null,
        }),
        supplierConfirmedAt: i.supplierConfirmedAt?.toISOString() ?? null,
        qtyReceived: received,
        qtyRemaining: remaining,
        lineStatus: i.lineStatus,
        lineCancelReason: (i as { lineCancelReason?: string | null }).lineCancelReason ?? null,
        cancelledRemainingQty:
          (i as { cancelledRemainingQty?: { toString(): string } | null }).cancelledRemainingQty !=
          null
            ? toPoNum(
                (i as { cancelledRemainingQty: { toString(): string } }).cancelledRemainingQty
              )
            : null,
      };
      }),
      attachments: po.attachments.map((a) => ({ id: a.id, fileName: a.fileName, fileUrl: a.fileUrl })),
      cancelRequestReason: po.status === 'CANCEL_REQUESTED' || po.status === 'CANCELLED' ? po.rejectReason : null,
      cancelRequestedPoItemIds: parsePoItemIdsJson(po.cancelRequestedPoItemIds),
    });
  } catch (error: any) {
    console.error('Get PO detail error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** Buyer hủy phần còn lại trên dòng PO (áp dụng ngay, không chờ duyệt). */
export const requestCancelPO = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { poId } = request.params as { poId: string };
    const body = request.body as { reason?: string; poItemIds?: string[] };
    const reason = body?.reason?.trim();
    if (!reason) return reply.code(400).send({ error: 'Lý do hủy dòng PO là bắt buộc' });

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, deletedAt: null, createdById: userId },
      include: { items: true },
    });
    if (!po) return reply.code(404).send({ error: 'PO not found' });
    if ((po.status as string) === 'CANCEL_REQUESTED') {
      const legacyIds = parsePoItemIdsJson(po.cancelRequestedPoItemIds);
      const legacyReason = po.rejectReason?.trim();
      if (legacyIds?.length && legacyReason) {
        const result = await executePoPartialLineCancel({
          purchaseOrderId: po.id,
          cancelPoItemIds: legacyIds,
          lineCancelReason: legacyReason,
          actorUserId: userId,
        });
        return reply.send({
          message: formatPoPartialLineCancelMessage(result),
          status: result.poNextStatus,
          cancelledLineCount: result.cancelledLineCount,
          poRemainsActive: result.poRemainsActive,
        });
      }
      return reply.code(400).send({
        error: 'PO kẹt trạng thái chờ hủy nhưng thiếu lý do hoặc danh sách dòng. Liên hệ IT.',
      });
    }
    if (!['CREATED', 'SENT', 'CONFIRMED', 'PARTIAL_RECEIVED'].includes(po.status as string)) {
      return reply.code(400).send({ error: 'Chỉ hủy dòng được khi PO đã duyệt và còn phần chưa nhận kho.' });
    }

    const receivedByItem = await getReceivedByPoItemIds(po.items.map((i) => i.id));
    const eligibleIds = po.items
      .filter((i) => Number(i.qty) > (receivedByItem.get(i.id) ?? 0) + 1e-9)
      .map((i) => i.id);
    const eligibleSet = new Set(eligibleIds);

    let cancelPoItemIds: string[] = [];
    if (Array.isArray(body.poItemIds) && body.poItemIds.length > 0) {
      for (const id of body.poItemIds) {
        if (!eligibleSet.has(id)) {
          return reply.code(400).send({
            error: 'poItemIds chỉ được chứa dòng PO còn thiếu so với số lượng đã nhận kho.',
          });
        }
      }
      cancelPoItemIds = [...new Set(body.poItemIds)];
    } else if (eligibleIds.length > 0) {
      cancelPoItemIds = eligibleIds;
    }

    if (cancelPoItemIds.length === 0) {
      return reply.code(400).send({
        error: 'Không còn dòng nào có phần chưa nhận kho để hủy.',
      });
    }

    const result = await executePoPartialLineCancel({
      purchaseOrderId: po.id,
      cancelPoItemIds,
      lineCancelReason: reason,
      actorUserId: userId,
    });

    reply.send({
      message: formatPoPartialLineCancelMessage(result),
      status: result.poNextStatus,
      cancelledLineCount: result.cancelledLineCount,
      poRemainsActive: result.poRemainsActive,
    });
  } catch (error: any) {
    const msg = error?.message ?? 'Internal server error';
    if (
      msg.includes('not found') ||
      msg.includes('không hợp lệ') ||
      msg.includes('Không có dòng') ||
      msg.includes('bắt buộc')
    ) {
      return reply.code(400).send({ error: msg });
    }
    console.error('requestCancelPO error:', error);
    reply.code(500).send({ error: 'Internal server error', message: msg });
  }
};

/** Buyer cập nhật draft PO (chỉ DRAFT hoặc REJECTED, không sửa giá) */
export const updatePODraft = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { poId } = request.params as { poId: string };
    const body = request.body as {
      paymentTerms?: string;
      deliveryAddress?: string;
      incoterms?: string;
      projectCode?: string;
      deliveryDate?: string;
      note?: string;
      supplierName?: string;
      supplierAddress?: string;
      supplierTaxCode?: string;
      supplierPhone?: string;
      supplierBankName?: string;
      supplierBankAccount?: string;
    };

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, deletedAt: null },
    });
    if (!po) return reply.code(404).send({ error: 'PO not found' });
    if (po.createdById !== userId) return reply.code(403).send({ error: 'Bạn không có quyền sửa PO này' });
    if (po.status !== 'DRAFT' && po.status !== 'REJECTED') {
      return reply.code(400).send({ error: 'Chỉ được sửa PO ở trạng thái Draft hoặc Rejected' });
    }

    // Cập nhật master NCC (trừ MST — MST buyer nhập chỉ lưu trên PO, đồng bộ master khi Trưởng phòng duyệt)
    const supplierUpdateData: Record<string, string> = {};
    if (body.supplierName !== undefined) supplierUpdateData.name = body.supplierName;
    if (body.supplierAddress !== undefined) supplierUpdateData.address = body.supplierAddress;
    if (body.supplierPhone !== undefined) supplierUpdateData.phone = body.supplierPhone;
    if (body.supplierBankName !== undefined) supplierUpdateData.bankName = body.supplierBankName;
    if (body.supplierBankAccount !== undefined) supplierUpdateData.bankAccount = body.supplierBankAccount;

    const poUpdateData: {
      paymentTerms?: string | null;
      deliveryAddress?: string | null;
      incoterms?: string | null;
      projectCode?: string | null;
      note?: string | null;
      deliveryDate?: Date | null;
      buyerSupplierTaxCode?: string | null;
      status?: any;
      rejectReason?: null;
      rejectedAt?: null;
      rejectedById?: null;
    } = {
      paymentTerms: body.paymentTerms ?? po.paymentTerms,
      deliveryAddress: body.deliveryAddress ?? po.deliveryAddress,
      incoterms: body.incoterms ?? po.incoterms,
      projectCode: body.projectCode ?? po.projectCode,
      note: body.note ?? po.note,
      deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : po.deliveryDate,
      ...(po.status === 'REJECTED'
        ? { status: 'DRAFT' as any, rejectReason: null, rejectedAt: null, rejectedById: null }
        : {}),
    };
    if (body.supplierTaxCode !== undefined) {
      poUpdateData.buyerSupplierTaxCode = trimSupplierTaxCode(body.supplierTaxCode);
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(supplierUpdateData).length > 0) {
        await tx.supplier.update({
          where: { id: po.supplierId },
          data: supplierUpdateData,
        });
      }
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: poUpdateData,
      });
    });

    reply.send({ message: 'Đã cập nhật PO' });
  } catch (error: any) {
    console.error('Update PO draft error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** Buyer submit PO để Trưởng phòng Mua hàng (Buyer Manager) duyệt */
export const submitPO = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { poId } = request.params as { poId: string };
    const body = (request.body ?? {}) as { supplierTaxCode?: string };

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, deletedAt: null },
      include: { purchaseRequest: true, supplier: true },
    });
    if (!po) return reply.code(404).send({ error: 'PO not found' });
    if (po.createdById !== userId) return reply.code(403).send({ error: 'Bạn không có quyền submit PO này' });
    if (po.status !== 'DRAFT') {
      return reply.code(400).send({ error: 'Chỉ submit được PO ở trạng thái Draft' });
    }

    const buyerTaxFromBody =
      body.supplierTaxCode !== undefined
        ? trimSupplierTaxCode(body.supplierTaxCode)
        : po.buyerSupplierTaxCode;
    const effectiveTax = effectiveSupplierTaxCode(po.supplier.taxCode, buyerTaxFromBody);
    if (!effectiveTax) {
      return reply.code(400).send({
        error: 'Vui lòng nhập Mã số thuế (MST) nhà cung cấp trước khi gửi duyệt.',
      });
    }

    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: 'SUBMITTED' as any,
        submittedAt: new Date(),
        ...(body.supplierTaxCode !== undefined
          ? { buyerSupplierTaxCode: buyerTaxFromBody }
          : {}),
      },
    });

    await prisma.purchaseRequest.update({
      where: { id: po.purchaseRequestId },
      data: { status: 'PO_IN_PROGRESS' as any },
    });

    reply.send({ message: 'Đã gửi PO chờ Trưởng phòng Mua hàng duyệt' });
  } catch (error: any) {
    console.error('Submit PO error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** Buyer: sau khi gửi mail/liên hệ NCC ngoài hệ thống — CREATED → SENT (kho mới thấy PO chờ nhận). */
export const markPOSent = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { poId } = request.params as { poId: string };
    if (!poId?.trim()) return reply.code(400).send({ error: 'Thiếu poId' });

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId.trim(), deletedAt: null, createdById: userId },
    });
    if (!po) return reply.code(404).send({ error: 'Không tìm thấy PO' });
    if (po.status !== 'CREATED' && po.status !== 'APPROVED') {
      return reply
        .code(400)
        .send({ error: 'Chỉ đánh dấu Sent khi PO ở trạng thái CREATED (đã duyệt, chưa gửi NCC trong hệ thống).' });
    }

    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'SENT' as any },
    });
    reply.send({ message: 'Đã đánh dấu đã gửi NCC (SENT).' });
  } catch (error: any) {
    console.error('markPOSent error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** Buyer: NCC đã xác nhận — SENT → CONFIRMED + ghi nhận qty/ETA từng dòng. */
export const markPOConfirmed = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { poId } = request.params as { poId: string };
    if (!poId?.trim()) return reply.code(400).send({ error: 'Thiếu poId' });

    const parsed = parseSupplierConfirmLines(request.body);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });
    const note =
      typeof (request.body as { note?: unknown })?.note === 'string'
        ? (request.body as { note: string }).note.trim()
        : '';

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId.trim(), deletedAt: null, createdById: userId },
      include: { items: true },
    });
    if (!po) return reply.code(404).send({ error: 'Không tìm thấy PO' });
    if (po.status !== 'SENT' && po.status !== 'ISSUED') {
      return reply.code(400).send({ error: 'Chỉ xác nhận khi PO đang SENT.' });
    }

    const itemById = new Map(po.items.map((i) => [i.id, i]));
    for (const line of parsed.lines) {
      const it = itemById.get(line.poItemId);
      if (!it) return reply.code(400).send({ error: 'Dòng không thuộc PO này' });
      if (line.confirmedQty > toPoNum(it.qty) + 1e-9) {
        return reply.code(400).send({
          error: `Dòng ${it.lineNo}: SL confirm (${line.confirmedQty}) vượt SL đặt (${toPoNum(it.qty)})`,
        });
      }
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const line of parsed.lines) {
        const it = itemById.get(line.poItemId)!;
        const eta = line.confirmedQty > 0 ? parseIsoDateOnly(line.expectedDeliveryDate) : null;
        await tx.pOItem.update({
          where: { id: it.id },
          data: {
            confirmedQty: new Prisma.Decimal(line.confirmedQty),
            expectedDeliveryDate: eta,
            supplierConfirmedAt: now,
            lineStatus:
              line.confirmedQty > 0 ? ('CONFIRMED' as const) : (it.lineStatus as any),
          },
        });
      }
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: 'CONFIRMED' as any,
          supplierConfirmedAt: now,
          ...(note ? { note: note || po.note } : {}),
        },
      });
    });

    reply.send({ message: 'Đã cập nhật CONFIRMED và ghi nhận xác nhận NCC theo dòng.' });
  } catch (error: any) {
    console.error('markPOConfirmed error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** Buyer: cập nhật qty/ETA confirm sau khi NCC delay hoặc điều chỉnh. */
export const updateSupplierConfirmation = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { poId } = request.params as { poId: string };
    if (!poId?.trim()) return reply.code(400).send({ error: 'Thiếu poId' });

    const parsed = parseSupplierConfirmLines(request.body);
    if (!parsed.ok) return reply.code(400).send({ error: parsed.error });

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId.trim(), deletedAt: null, createdById: userId },
      include: { items: true },
    });
    if (!po) return reply.code(404).send({ error: 'Không tìm thấy PO' });
    if (po.status !== 'CONFIRMED' && po.status !== 'PARTIAL_RECEIVED') {
      return reply.code(400).send({ error: 'Chỉ cập nhật khi PO đang CONFIRMED hoặc PARTIAL_RECEIVED.' });
    }

    const itemById = new Map(po.items.map((i) => [i.id, i]));
    const receivedMap = await getReceivedByPoItemIds(po.items.map((i) => i.id));

    for (const line of parsed.lines) {
      const it = itemById.get(line.poItemId);
      if (!it) return reply.code(400).send({ error: 'Dòng không thuộc PO này' });
      if (line.confirmedQty > toPoNum(it.qty) + 1e-9) {
        return reply.code(400).send({
          error: `Dòng ${it.lineNo}: SL confirm vượt SL đặt`,
        });
      }
      const received = receivedMap.get(line.poItemId) ?? 0;
      if (line.confirmedQty + 1e-9 < received) {
        return reply.code(400).send({
          error: `Dòng ${it.lineNo}: SL confirm không được nhỏ hơn đã nhận (${received})`,
        });
      }
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const line of parsed.lines) {
        const it = itemById.get(line.poItemId)!;
        const received = receivedMap.get(line.poItemId) ?? 0;
        const eta = line.confirmedQty > 0 ? parseIsoDateOnly(line.expectedDeliveryDate) : null;
        const nextStatus = resolveLineStatusAfterReceive(
          line.confirmedQty,
          it.qty,
          received,
          it.lineStatus
        );
        await tx.pOItem.update({
          where: { id: it.id },
          data: {
            confirmedQty: new Prisma.Decimal(line.confirmedQty),
            expectedDeliveryDate: eta,
            supplierConfirmedAt: now,
            lineStatus: nextStatus as any,
          },
        });
      }
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { supplierConfirmedAt: now },
      });
    });

    reply.send({ message: 'Đã cập nhật xác nhận NCC theo dòng.' });
  } catch (error: any) {
    console.error('updateSupplierConfirmation error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** Dashboard PO: đếm PR waiting PO, PO Draft, PO Waiting Approval, PO Issued */
export const getPODashboard = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const [prWaitingPO, poDraft, poSubmitted, poIssued] = await Promise.all([
      prisma.purchaseRequest.count({
        where: {
          deletedAt: null,
          prNumber: { not: { startsWith: 'MOCK-' } },
          status: { in: ['RFQ_COMPLETED', 'PO_PENDING'] },
          assignments: { some: { buyerId: userId, deletedAt: null } },
          supplierSelections: { some: {} },
          purchaseOrders: { none: { deletedAt: null } },
        },
      }),
      prisma.purchaseOrder.count({
        where: {
          deletedAt: null,
          createdById: userId,
          status: 'DRAFT',
          poNumber: { not: { startsWith: 'MOCK-' } },
          purchaseRequest: { prNumber: { not: { startsWith: 'MOCK-' } } },
        },
      }),
      prisma.purchaseOrder.count({
        where: {
          deletedAt: null,
          createdById: userId,
          status: 'SUBMITTED',
          poNumber: { not: { startsWith: 'MOCK-' } },
          purchaseRequest: { prNumber: { not: { startsWith: 'MOCK-' } } },
        },
      }),
      prisma.purchaseOrder.count({
        where: {
          deletedAt: null,
          createdById: userId,
          poNumber: { not: { startsWith: 'MOCK-' } },
          purchaseRequest: { prNumber: { not: { startsWith: 'MOCK-' } } },
          status: { in: ['SENT', 'CONFIRMED', 'PARTIAL_RECEIVED', 'FULLY_RECEIVED'] },
        },
      }),
    ]);

    reply.send({
      prWaitingPO,
      poDraft,
      poWaitingApproval: poSubmitted,
      poIssued,
    });
  } catch (error: any) {
    console.error('Get PO dashboard error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** Xuất Excel PO (mỗi dòng hàng = 1 row) — Buyer, theo bộ lọc danh sách PO */
export const exportBuyerPOExcel = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const q = request.query as {
      poCode?: string;
      prCode?: string;
      supplier?: string;
      status?: string;
    };

    let pos = await fetchPosForExcelExport({
      createdById: userId,
      poNumber: { not: { startsWith: 'MOCK-' } },
      purchaseRequest: { prNumber: { not: { startsWith: 'MOCK-' } } },
    });

    if (q.poCode?.trim()) {
      const needle = q.poCode.trim().toLowerCase();
      pos = pos.filter((p) => p.poNumber.toLowerCase().includes(needle));
    }
    if (q.prCode?.trim()) {
      const needle = q.prCode.trim().toLowerCase();
      pos = pos.filter((p) => p.purchaseRequest.prNumber.toLowerCase().includes(needle));
    }
    if (q.supplier?.trim()) {
      const needle = q.supplier.trim().toLowerCase();
      pos = pos.filter((p) => p.supplier.name.toLowerCase().includes(needle));
    }
    if (q.status?.trim()) {
      pos = pos.filter((p) => p.status === q.status.trim());
    }

    const flatRows = await buildPoExcelFlatRows(pos, 'buyer');
    const buf = await writePoExcelBuffer(flatRows, 'Danh sách PO');
    const stamp = new Date().toISOString().slice(0, 10);
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header(
        'Content-Disposition',
        excelContentDisposition(`PO_Buyer_${stamp}.xlsx`)
      );
    return reply.send(buf);
  } catch (error: any) {
    console.error('exportBuyerPOExcel error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};
