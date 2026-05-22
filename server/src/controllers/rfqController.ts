import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditCreate, auditUpdate } from '../utils/audit';
import { computePRStatusFromItemStatuses } from '../utils/prStatusFromItems';
import {
  isRfqAwardCompleteFromCounts,
  prHasActivePurchaseOrder,
} from '../utils/rfqAwardComplete';
import {
  itemDepartmentOutcomeAllowsProcurement,
  prismaDepartmentOutcomeRowActive,
  resolveBuyerAssignedItemIds,
} from '../utils/departmentPrItemReview';
import { allocateNextRfqNumber } from '../utils/rfqNumber';
import { loadRfqExportScopeForBuyer } from '../utils/rfqExportScope';
import { parseRfqQuotationExcelBuffer } from '../utils/rfqQuotationExcelImport';
import { resolveSupplierForQuotationExcelImport } from '../utils/rfqQuotationSupplierResolve';
import {
  buildRfqQuotationExcelBuffer,
  buildRfqQuotationExcelFilename,
  buildRfqNccQuoteLines,
  excelContentDisposition,
} from '../utils/rfqQuotationExcelExport';
import { z } from 'zod';

import { prSalesPOSelect, serializePRSalesOrder } from '../utils/prSalesOrder';
import { isPrItemAwaitingRepurchase } from '../utils/buyerPrDisplayStatus';

// Validation schemas
const createRFQSchema = z.object({
  purchaseRequestId: z.string().min(1),
  notes: z.string().optional(),
  itemIds: z.array(z.string()).optional(), // Items that belong to this RFQ
});

const updateRFQSchema = z.object({
  notes: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT', 'QUOTATION_RECEIVED', 'READY_FOR_COMPARISON', 'CLOSED']).optional(),
});

// Create RFQ
export const createRFQ = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = createRFQSchema.parse(request.body);

    // Check if PR exists and is assigned to this buyer
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: body.purchaseRequestId },
      include: {
        items: {
          where: { deletedAt: null, ...prismaDepartmentOutcomeRowActive },
        },
        assignments: {
          where: {
            buyerId: userId,
            deletedAt: null,
          },
        },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    // Buyer phải có assignment thì mới được tạo RFQ (kiểm tra trước để dùng trong điều kiện status)
    if (pr.assignments.length === 0) {
      return reply.code(403).send({ error: 'PR is not assigned to you' });
    }

    // Cho phép tạo RFQ khi PR đang trong giai đoạn có thể hỏi giá (đã có phân công cho buyer này):
    // - BUYER_LEADER_PENDING / BRANCH_MANAGER_APPROVED: phân công một phần, PR chưa chuyển ASSIGNED_TO_BUYER
    // - ASSIGNED_TO_BUYER: đã phân công (toàn bộ hoặc phần còn lại)
    // - RFQ_IN_PROGRESS: đang hỏi giá
    // - QUOTATION_RECEIVED: đã có báo giá, vẫn có thể tạo RFQ cho item chưa nằm trong RFQ nào
    const allowedStatuses = [
      'BUYER_LEADER_PENDING',
      'BRANCH_MANAGER_APPROVED',
      'ASSIGNED_TO_BUYER',
      'RFQ_IN_PROGRESS',
      'QUOTATION_RECEIVED',
    ];
    if (!allowedStatuses.includes(pr.status)) {
      return reply.code(400).send({
        error: `PR hiện đang ở trạng thái ${pr.status}, không thể tạo RFQ mới. Vui lòng kiểm tra lại luồng nghiệp vụ.`,
      });
    }

    const assignment = pr.assignments[0];
    if (!assignment) {
      return reply.code(403).send({ error: 'PR is not assigned to you' });
    }

    const assignedItemIds = resolveBuyerAssignedItemIds(assignment, pr.items);

    // Validate itemIds if provided
    if (body.itemIds && Array.isArray(body.itemIds) && body.itemIds.length > 0) {
      // Validate all itemIds belong to assigned items (cùng tập với getPRDetails)
      const invalidItems = body.itemIds.filter((id) => !assignedItemIds.includes(id));
      if (invalidItems.length > 0) {
        return reply.code(400).send({
          error: 'Some items are not assigned to you',
          message: 'Một hoặc nhiều dòng không thuộc phạm vi phân công của bạn.',
          invalidItems,
        });
      }

      // Check if any selected items already belong to another RFQ (items are locked)
      // Lấy tất cả RFQ của PR (mọi buyer) để khóa item theo đúng nghiệp vụ:
      // mỗi item chỉ thuộc về một RFQ tại một thời điểm.
      const existingRFQs = await prisma.rFQ.findMany({
        where: {
          purchaseRequestId: body.purchaseRequestId,
          deletedAt: null,
        },
        select: {
          id: true,
          rfqNumber: true,
          notes: true,
        },
      });

      // Collect all items that are already locked by existing RFQs
      const lockedItemIds = new Set<string>();
      const itemToRFQMap: Record<string, { id: string; rfqNumber: string }> = {};
      
      for (const existingRFQ of existingRFQs) {
        let rfqItemIds: string[] = [];
        
        // Extract itemIds from notes if exists
        if (existingRFQ.notes) {
          const match = existingRFQ.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              if (parsed.itemIds && Array.isArray(parsed.itemIds)) {
                rfqItemIds = parsed.itemIds as string[];
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }

        rfqItemIds.forEach((itemId) => {
          const prItem = pr.items.find((i) => i.id === itemId);
          if (prItem && isPrItemAwaitingRepurchase(prItem)) return;
          lockedItemIds.add(itemId);
          if (!itemToRFQMap[itemId]) {
            itemToRFQMap[itemId] = {
              id: existingRFQ.id,
              rfqNumber: existingRFQ.rfqNumber,
            };
          }
        });
      }

      // Check if any selected items are already locked
      const selectedLockedItems = body.itemIds.filter(id => lockedItemIds.has(id));
      if (selectedLockedItems.length > 0) {
        const lockedItemsInfo = selectedLockedItems.map(itemId => ({
          itemId,
          rfqId: itemToRFQMap[itemId].id,
          rfqNumber: itemToRFQMap[itemId].rfqNumber,
        }));
        
        return reply.code(400).send({
          error: 'Some items are already locked by another RFQ',
          lockedItems: lockedItemsInfo,
          message: 'Các items đã được chọn vào RFQ khác. Vui lòng chọn items chưa thuộc RFQ nào.',
        });
      }
    }

    // Prepare notes: combine user notes with itemIds (stored as JSON in notes)
    let notesContent = body.notes || '';
    if (body.itemIds && Array.isArray(body.itemIds) && body.itemIds.length > 0) {
      const itemIdsJson = JSON.stringify({ itemIds: body.itemIds });
      notesContent = notesContent 
        ? `${notesContent}\n\n[RFQ_ITEMS]${itemIdsJson}[/RFQ_ITEMS]`
        : `[RFQ_ITEMS]${itemIdsJson}[/RFQ_ITEMS]`;
      console.log(`[createRFQ] Saving itemIds to notes:`, body.itemIds);
      console.log(`[createRFQ] Notes content:`, notesContent);
    } else {
      console.warn(`[createRFQ] No itemIds provided! body.itemIds:`, body.itemIds);
    }

    const rfq = await prisma.$transaction(
      async (tx) => {
        const rfqNumber = await allocateNextRfqNumber(tx, pr.prNumber, {
          department: pr.department,
          location: pr.location,
        });
        return tx.rFQ.create({
          data: {
            purchaseRequestId: body.purchaseRequestId,
            rfqNumber,
            buyerId: userId,
            status: 'DRAFT',
            notes: notesContent || null,
            companyId: pr.companyId || null,
          },
        });
      },
      { maxWait: 10000, timeout: 30000 }
    );

    // Cập nhật trạng thái ITEM: RFQ_CREATED cho các item thuộc RFQ này
    if (body.itemIds && Array.isArray(body.itemIds) && body.itemIds.length > 0) {
      await prisma.purchaseRequestItem.updateMany({
        where: {
          id: { in: body.itemIds },
          purchaseRequestId: body.purchaseRequestId,
          deletedAt: null,
          ...prismaDepartmentOutcomeRowActive,
        },
        data: { status: 'RFQ_CREATED' as any },
      });
    }

    // Tổng hợp PR status từ trạng thái item
    const prItemsForStatus = await prisma.purchaseRequestItem.findMany({
      where: { purchaseRequestId: body.purchaseRequestId, deletedAt: null },
      select: { status: true, departmentItemOutcome: true },
    });
    const aggregatedStatus = computePRStatusFromItemStatuses(
      prItemsForStatus
        .filter((i) => itemDepartmentOutcomeAllowsProcurement(i.departmentItemOutcome))
        .map((i) => i.status)
    );
    let prStatusToSet = aggregatedStatus;
    if (body.itemIds && body.itemIds.length > 0) {
      if (!prStatusToSet || prStatusToSet === 'RFQ_COMPLETED' || prStatusToSet === 'SUPPLIER_SELECTED') {
        prStatusToSet = 'RFQ_IN_PROGRESS';
      }
    }
    if (prStatusToSet) {
      await prisma.purchaseRequest.update({
        where: { id: body.purchaseRequestId },
        data: { status: prStatusToSet },
      });
    }

    // Audit log
    await auditCreate('rfqs', rfq.id, rfq, {
      userId,
      companyId: rfq.companyId ?? pr.companyId ?? undefined,
    });

    // Extract itemIds from notes for response
    let itemIds: string[] = [];
    if (rfq.notes) {
      const match = rfq.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          itemIds = parsed.itemIds || [];
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    reply.code(201).send({
      id: rfq.id,
      rfqNumber: rfq.rfqNumber,
      purchaseRequestId: rfq.purchaseRequestId,
      status: rfq.status,
      notes: rfq.notes,
      itemIds: itemIds.length > 0 ? itemIds : undefined,
      createdAt: rfq.createdAt.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Create RFQ error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get RFQs
export const getRFQs = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { status } = request.query as { status?: string };

    const where: any = {
      buyerId: userId,
      deletedAt: null,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    // Fetch RFQs without quotations relation to avoid dependency on quotation_attachments table
    const rfqs = await prisma.rFQ.findMany({
      where,
      include: {
        purchaseRequest: {
          select: {
            id: true,
            prNumber: true,
            department: true,
            totalAmount: true,
            currency: true,
            status: true,
          },
        },
        quotations: {
          where: { deletedAt: null },
          select: { id: true }, // Only select id for counting
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    const mappedRFQs = rfqs.map((rfq) => {
      // Extract itemIds from notes
      let itemIds: string[] = [];
      if (rfq.notes) {
        const match = rfq.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            if (parsed.itemIds && Array.isArray(parsed.itemIds)) {
              itemIds = parsed.itemIds as string[];
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      const quotationsCount = rfq.quotations?.length ?? 0;
      
      return {
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
        prNumber: rfq.purchaseRequest.prNumber,
        prId: rfq.purchaseRequest.id,
        department: rfq.purchaseRequest.department,
        prStatus: rfq.purchaseRequest.status,
        status: rfq.status,
        quotationsCount: quotationsCount,
        quotations: [], // Omit full quotation list to avoid quotation_attachments; use RFQ detail when needed
        sentDate: rfq.sentDate?.toISOString(),
        notes: rfq.notes,
        itemIds: itemIds,
        itemCount: itemIds.length,
        createdAt: rfq.createdAt.toISOString(),
      };
    });

    const filteredRFQs = mappedRFQs.filter((rfq) => {
      const rfqNumber = String(rfq.rfqNumber || '').toUpperCase();
      const prNumber = String(rfq.prNumber || '').toUpperCase();
      return !rfqNumber.startsWith('MOCK-') && !prNumber.startsWith('MOCK-');
    });

    const allRfqItemIds = [...new Set(filteredRFQs.flatMap((r) => r.itemIds))];
    const prIds = [...new Set(filteredRFQs.map((r) => r.prId))];

    const [selectionRows, poRows, prItemRows] = await Promise.all([
      allRfqItemIds.length > 0
        ? prisma.supplierSelection.findMany({
            where: { purchaseRequestItemId: { in: allRfqItemIds } },
            select: { purchaseRequestItemId: true },
          })
        : Promise.resolve([]),
      prIds.length > 0
        ? prisma.purchaseOrder.findMany({
            where: { purchaseRequestId: { in: prIds }, deletedAt: null },
            select: { purchaseRequestId: true, status: true },
          })
        : Promise.resolve([]),
      allRfqItemIds.length > 0
        ? prisma.purchaseRequestItem.findMany({
            where: { id: { in: allRfqItemIds }, deletedAt: null },
            select: { id: true, status: true, purchaseQty: true },
          })
        : Promise.resolve([]),
    ]);

    const selectedItemIdSet = new Set(selectionRows.map((s) => s.purchaseRequestItemId));
    const posByPrId = new Map<string, Array<{ status: string }>>();
    for (const po of poRows) {
      const list = posByPrId.get(po.purchaseRequestId) ?? [];
      list.push({ status: String(po.status) });
      posByPrId.set(po.purchaseRequestId, list);
    }
    const prItemById = new Map(
      prItemRows.map((it) => [
        it.id,
        { status: String(it.status), purchaseQty: Number(it.purchaseQty ?? 0) },
      ])
    );

    const rfqItemSettled = (itemId: string): boolean => {
      const it = prItemById.get(itemId);
      if (!it) return false;
      if (it.status === 'FULFILLED') return true;
      if (it.status === 'SUPPLIER_SELECTED' && it.purchaseQty <= 1e-9) return true;
      return false;
    };

    const rfqsWithAward = filteredRFQs.map((rfq) => {
      const selectedCount = rfq.itemIds.filter((id) => selectedItemIdSet.has(id)).length;
      const settledItemCount = rfq.itemIds.filter((id) => rfqItemSettled(id)).length;
      const hasNonDraftPo = prHasActivePurchaseOrder(posByPrId.get(rfq.prId));
      const awardComplete = isRfqAwardCompleteFromCounts({
        rfqStatus: String(rfq.status),
        prStatus: String(rfq.prStatus),
        itemIds: rfq.itemIds,
        selectedCount,
        hasNonDraftPo,
        settledItemCount,
      });
      const displayStatus =
        awardComplete && String(rfq.status) === 'READY_FOR_COMPARISON' ? 'CLOSED' : rfq.status;
      return {
        ...rfq,
        status: displayStatus,
        awardComplete,
        selectedItemCount: selectedCount,
        settledItemCount,
        hasNonDraftPo,
      };
    });

    const legacyCloseIds = rfqsWithAward.filter((r) => r.awardComplete).map((r) => r.id);
    if (legacyCloseIds.length > 0) {
      await prisma.rFQ.updateMany({
        where: {
          id: { in: legacyCloseIds },
          status: 'READY_FOR_COMPARISON' as any,
        },
        data: { status: 'CLOSED' as any },
      });
    }

    console.log(`[getRFQs] Returning ${rfqsWithAward.length} RFQs for buyer ${userId}`);
    reply.send({ rfqs: rfqsWithAward });
  } catch (error: any) {
    console.error('Get RFQs error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get RFQ by ID
export const getRFQById = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const rfq = await prisma.rFQ.findUnique({
      where: { id },
      include: {
        purchaseRequest: {
          include: {
            items: {
              where: { deletedAt: null },
              orderBy: { lineNo: 'asc' },
            },
            requestor: {
              select: {
                username: true,
                email: true,
                fullName: true,
              },
            },
            salesPO: {
              select: {
                ...prSalesPOSelect,
                deliveryDeadline: true,
              },
            },
            assignments: {
              where: {
                buyerId: userId,
                deletedAt: null,
              },
            },
          },
        },
        quotations: {
          where: { deletedAt: null },
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                code: true,
                email: true,
                phone: true,
              },
            },
            items: {
              orderBy: { lineNo: 'asc' },
            },
          },
        },
      },
    });

    if (!rfq) {
      return reply.code(404).send({ error: 'RFQ not found' });
    }

    if (rfq.buyerId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // Get assignment for this buyer to filter items
    const assignment = rfq.purchaseRequest.assignments[0];
    if (!assignment) {
      return reply.code(403).send({ error: 'PR is not assigned to you' });
    }

    // Extract itemIds from RFQ notes
    let rfqItemIds: string[] = [];
    if (rfq.notes) {
      const match = rfq.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.itemIds && Array.isArray(parsed.itemIds)) {
            rfqItemIds = parsed.itemIds as string[];
            console.log(`[getRFQById] Extracted itemIds from notes:`, rfqItemIds);
          }
        } catch (e) {
          console.error('[getRFQById] Error parsing RFQ itemIds from notes:', e);
          console.error('[getRFQById] Notes content:', rfq.notes);
        }
      } else {
        console.warn(`[getRFQById] No RFQ_ITEMS tag found in notes. RFQ ID: ${rfq.id}`);
        console.warn(`[getRFQById] Notes content:`, rfq.notes);
      }
    } else {
      console.warn(`[getRFQById] RFQ has no notes. RFQ ID: ${rfq.id}`);
    }

    // Filter items based on assignment scope
    let assignedItemIds: string[] = [];
    if (assignment.scope === 'FULL') {
      assignedItemIds = rfq.purchaseRequest.items.map(item => item.id);
    } else if (assignment.scope === 'PARTIAL' && assignment.assignedItemIds) {
      assignedItemIds = JSON.parse(assignment.assignedItemIds) as string[];
    }

    // Filter items: if RFQ has specific itemIds, use those; otherwise use all assigned items
    let itemsToShow = rfq.purchaseRequest.items;
    if (rfqItemIds.length > 0) {
      // RFQ has specific items - filter by both RFQ itemIds AND assigned items
      itemsToShow = rfq.purchaseRequest.items.filter(item => 
        rfqItemIds.includes(item.id) && assignedItemIds.includes(item.id)
      );
    } else {
      // RFQ doesn't have specific items - use all assigned items (backward compatibility)
      itemsToShow = rfq.purchaseRequest.items.filter(item => assignedItemIds.includes(item.id));
    }

    const resolvePrItemUnitPrice = (item: any): number | null => {
      const estimated = Number(item?.estimatedUnitPriceVnd ?? 0);
      if (Number.isFinite(estimated) && estimated > 0) return estimated;
      const unitPrice = Number(item?.unitPrice ?? 0);
      return Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null;
    };
    const resolvePrItemAmount = (item: any): number | null => {
      const amount = Number(item?.amount ?? 0);
      if (Number.isFinite(amount) && amount > 0) return amount;
      const qty = Number(item?.qty ?? 0);
      const unitPrice = resolvePrItemUnitPrice(item);
      if (!Number.isFinite(qty) || qty <= 0 || unitPrice == null) return null;
      return qty * unitPrice;
    };

    // Baseline = giá PR từng item (để so sánh với báo giá NCC)
    const prItemsBaseline = itemsToShow.map((item: any) => ({
      id: item.id,
      lineNo: item.lineNo,
      unitPrice: resolvePrItemUnitPrice(item),
      amount: resolvePrItemAmount(item),
      qty: Number(item.qty) || 0,
    }));

    // Supplier selections (per item) cho PR này – để hiển thị "Item thắng" / "Tổng tiền item thắng" theo NCC
    const supplierSelections = await prisma.supplierSelection.findMany({
      where: { purchaseRequestId: rfq.purchaseRequest.id },
      select: { quotationId: true, purchaseRequestItemId: true },
    });
    const selectedItemIdsByQuotationId = new Map<string, string[]>();
    for (const sel of supplierSelections) {
      if (sel.purchaseRequestItemId && sel.quotationId) {
        const arr = selectedItemIdsByQuotationId.get(sel.quotationId) ?? [];
        if (!arr.includes(sel.purchaseRequestItemId)) arr.push(sel.purchaseRequestItemId);
        selectedItemIdsByQuotationId.set(sel.quotationId, arr);
      }
    }

    const prPos = await prisma.purchaseOrder.findMany({
      where: { purchaseRequestId: rfq.purchaseRequest.id, deletedAt: null },
      select: { status: true },
    });
    const rfqScopeIds = rfqItemIds.length > 0 ? rfqItemIds : itemsToShow.map((i) => i.id);
    const selectedForRfq = supplierSelections.filter((s) =>
      rfqScopeIds.includes(s.purchaseRequestItemId)
    ).length;
    const settledItemCount = rfqScopeIds.filter((id) => {
      const it = rfq.purchaseRequest.items.find((i) => i.id === id);
      if (!it) return false;
      const st = String(it.status);
      return st === 'FULFILLED' || (st === 'SUPPLIER_SELECTED' && Number(it.purchaseQty) <= 0);
    }).length;
    const awardComplete = isRfqAwardCompleteFromCounts({
      rfqStatus: String(rfq.status),
      prStatus: String(rfq.purchaseRequest.status),
      itemIds: rfqScopeIds,
      selectedCount: selectedForRfq,
      hasNonDraftPo: prHasActivePurchaseOrder(prPos),
      settledItemCount,
    });
    let rfqStatusOut = String(rfq.status);
    if (awardComplete && rfqStatusOut === 'READY_FOR_COMPARISON') {
      await prisma.rFQ.update({
        where: { id: rfq.id },
        data: { status: 'CLOSED' as any },
      });
      rfqStatusOut = 'CLOSED';
    }

    const { computeQuotationBaseline } = await import('../utils/baseline');

    const salesOrder = serializePRSalesOrder(rfq.purchaseRequest as any);

    /** Route Buyer `/buyer/rfqs/:id` — không trả các trường giá (PR + báo giá NCC). */
    const stripBuyerFacingPrices = (payload: Record<string, any>) => {
      if (payload.purchaseRequest) {
        payload.purchaseRequest.totalAmount = null;
        payload.purchaseRequest.items = (payload.purchaseRequest.items || []).map((it: any) => ({
          ...it,
          unitPrice: null,
          amount: null,
          baselineUnitPrice: null,
          estimatedUnitPriceVnd: null,
        }));
      }
      if (payload.quotations?.length) {
        payload.quotations = payload.quotations.map((q: any) => ({
          ...q,
          totalAmount: null,
          selectedItemsTotalAmount: null,
          overBaseline: false,
          itemsBaseline: [],
          items: (q.items || []).map((it: any) => ({
            ...it,
            unitPrice: null,
            totalPrice: null,
          })),
        }));
      }
    };

    const responsePayload = {
      id: rfq.id,
      rfqNumber: rfq.rfqNumber,
      status: rfqStatusOut,
      awardComplete,
      notes: rfq.notes,
      sentDate: rfq.sentDate?.toISOString(),
      itemIds: rfqItemIds.length > 0 ? rfqItemIds : undefined,
      itemCount: itemsToShow.length,
      purchaseRequest: {
        id: rfq.purchaseRequest.id,
        prNumber: rfq.purchaseRequest.prNumber,
        department: rfq.purchaseRequest.department,
        salesPOId: rfq.purchaseRequest.salesPOId,
        customerPO: rfq.purchaseRequest.customerPO,
        projectCode: rfq.purchaseRequest.projectCode,
        projectName: rfq.purchaseRequest.projectName,
        customerName: rfq.purchaseRequest.customerName,
        location: rfq.purchaseRequest.location,
        requiredDate: rfq.purchaseRequest.requiredDate?.toISOString() ?? null,
        totalAmount: rfq.purchaseRequest.totalAmount ? Number(rfq.purchaseRequest.totalAmount) : null,
        currency: rfq.purchaseRequest.currency,
        requestor: rfq.purchaseRequest.requestor,
        salesPO: rfq.purchaseRequest.salesPO,
        /** Cùng shape với API danh sách PR (`salesOrder`) — dùng cho PDF / UI */
        salesOrder,
        salesOrderSummary: salesOrder,
        items: itemsToShow.map((item: any) => ({
          id: item.id,
          lineNo: item.lineNo,
          description: item.description,
          partNo: item.partNo,
          spec: item.spec,
          manufacturer: item.manufacturer,
          qty: Number(item.qty),
          unit: item.unit,
          desiredDeliveryDate: item.desiredDeliveryDate
            ? new Date(item.desiredDeliveryDate).toISOString().slice(0, 10)
            : null,
          remark: item.remark ?? null,
          unitPrice: resolvePrItemUnitPrice(item),
          amount: resolvePrItemAmount(item),
          baselineUnitPrice: resolvePrItemUnitPrice(item),
          estimatedUnitPriceVnd:
            Number(item?.estimatedUnitPriceVnd ?? 0) > 0 ? Number(item.estimatedUnitPriceVnd) : null,
        })),
      },
      quotations: rfq.quotations.map((q: any) => {
        const baselineResult = computeQuotationBaseline(prItemsBaseline, q.items.map((item: any) => ({
          purchaseRequestItemId: item.purchaseRequestItemId,
          unitPrice: item.unitPrice,
          lineNo: item.lineNo,
        })));
        const selectedItemIds = selectedItemIdsByQuotationId.get(q.id) ?? [];
        const selectedItemsTotalAmount = q.items
          .filter((item: any) => selectedItemIds.includes(item.purchaseRequestItemId))
          .reduce((sum: number, item: any) => sum + Number(item.totalPrice || 0), 0);
        return {
          id: q.id,
          supplier: q.supplier,
          quotationNumber: q.quotationNumber,
          totalAmount: Number(q.totalAmount),
          currency: q.currency,
          leadTime: q.leadTime,
          deliveryTerms: q.deliveryTerms,
          paymentTerms: q.paymentTerms,
          warranty: q.warranty,
          riskNotes: q.riskNotes,
          status: q.status,
          overBaseline: baselineResult.overBaseline,
          itemsBaseline: baselineResult.items,
          selectedItemCount: selectedItemIds.length,
          selectedItemsTotalAmount,
          selectedItemIds,
          items: q.items.map((item: any) => ({
            id: item.id,
            lineNo: item.lineNo,
            description: item.description,
            qty: Number(item.qty),
            unit: item.unit,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            purchaseRequestItemId: item.purchaseRequestItemId,
          })),
        };
      }),
      createdAt: rfq.createdAt.toISOString(),
      updatedAt: rfq.updatedAt.toISOString(),
    };

    stripBuyerFacingPrices(responsePayload);
    (responsePayload as Record<string, unknown>).buyerPriceFieldsHidden = true;

    // Explicitly set headers to prevent compression issues
    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Encoding', 'identity');
    reply.code(200);
    reply.send(responsePayload);
  } catch (error: any) {
    console.error('Get RFQ by ID error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Update RFQ
export const updateRFQ = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const body = updateRFQSchema.parse(request.body);

    const rfq = await prisma.rFQ.findUnique({
      where: { id },
    });

    if (!rfq) {
      return reply.code(404).send({ error: 'RFQ not found' });
    }

    if (rfq.buyerId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // Khóa RFQ khi đã submit (READY_FOR_COMPARISON) - buyer không thể sửa
    if (rfq.status === 'READY_FOR_COMPARISON') {
      return reply.code(403).send({
        error: 'RFQ đã được submit và bị khóa. Không thể chỉnh sửa.',
        currentStatus: rfq.status,
      });
    }

    const updateData: any = {};
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status) updateData.status = body.status;
    if (body.status === 'SENT') updateData.sentDate = new Date();

    const updatedRFQ = await prisma.rFQ.update({
      where: { id },
      data: updateData,
    });

    // Update PR status if RFQ is sent
    if (body.status === 'SENT') {
      await prisma.purchaseRequest.update({
        where: { id: rfq.purchaseRequestId },
        data: {
          status: 'RFQ_IN_PROGRESS',
        },
      });
    }

    // Audit log
    await auditUpdate(
      'rfqs',
      id,
      rfq,
      updatedRFQ,
      { userId, companyId: rfq.companyId || undefined }
    );

    reply.send({
      id: updatedRFQ.id,
      rfqNumber: updatedRFQ.rfqNumber,
      status: updatedRFQ.status,
      notes: updatedRFQ.notes,
      sentDate: updatedRFQ.sentDate?.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Update RFQ error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Send RFQ
export const sendRFQ = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const rfq = await prisma.rFQ.findUnique({
      where: { id },
    });

    if (!rfq) {
      return reply.code(404).send({ error: 'RFQ not found' });
    }

    if (rfq.buyerId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    if (rfq.status !== 'DRAFT') {
      return reply.code(400).send({ error: 'RFQ can only be sent from DRAFT status' });
    }

    // Update RFQ status
    const updatedRFQ = await prisma.rFQ.update({
      where: { id },
      data: {
        status: 'SENT',
        sentDate: new Date(),
      },
    });

    // Update PR status
    await prisma.purchaseRequest.update({
      where: { id: rfq.purchaseRequestId },
      data: {
        status: 'RFQ_IN_PROGRESS',
      },
    });

    // Audit log
    await auditUpdate(
      'rfqs',
      id,
      rfq,
      updatedRFQ,
      { userId, companyId: rfq.companyId || undefined }
    );

    reply.send({
      message: 'RFQ sent successfully',
      rfq: {
        id: updatedRFQ.id,
        rfqNumber: updatedRFQ.rfqNumber,
        status: updatedRFQ.status,
        sentDate: updatedRFQ.sentDate?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Send RFQ error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/** Import Excel báo giá NCC → JSON điền modal buyer. */
export const importRFQQuotationExcel = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const scope = await loadRfqExportScopeForBuyer(id, userId);
    if (!scope) return reply.code(404).send({ error: 'RFQ not found' });
    if ('forbidden' in scope) return reply.code(403).send({ error: 'Access denied' });

    let fileBuffer: Buffer | null = null;
    let quotationDateYmd: string | undefined;
    const multipartRequest = request as AuthenticatedRequest & {
      isMultipart?: boolean;
      parts?: () => AsyncIterableIterator<{
        type: string;
        fieldname: string;
        value?: string;
        toBuffer?: () => Promise<Buffer>;
        filename?: string;
      }>;
    };

    if (multipartRequest.isMultipart && multipartRequest.parts) {
      for await (const part of multipartRequest.parts()) {
        if (part.type === 'file' && part.fieldname === 'file' && part.toBuffer) {
          fileBuffer = await part.toBuffer();
          continue;
        }
        if (part.type === 'field' && part.fieldname === 'quotationDateYmd' && part.value) {
          quotationDateYmd = String(part.value).trim().slice(0, 10);
        }
      }
    }

    if (!fileBuffer?.length) {
      return reply.code(400).send({ error: 'Vui lòng upload file Excel (.xlsx)' });
    }

    const parsed = await parseRfqQuotationExcelBuffer(fileBuffer, scope.items, {
      quotationDateYmd,
    });
    const resolved = await resolveSupplierForQuotationExcelImport(
      parsed.supplierId,
      parsed.supplierName
    );
    if (resolved) {
      return reply.send({
        ...parsed,
        supplierId: resolved.id,
        supplierName: resolved.name,
      });
    }
    if (!parsed.supplierId && !parsed.supplierName) {
      parsed.warnings.push(
        'Không đọc được NCC từ file — chọn NCC thủ công trước khi lưu báo giá.'
      );
    } else {
      parsed.warnings.push(
        `Không tìm thấy NCC «${parsed.supplierName ?? parsed.supplierId}» trong hệ thống — chọn NCC thủ công.`
      );
    }
    return reply.send(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Import Excel thất bại';
    console.error('importRFQQuotationExcel error:', error);
    return reply.code(400).send({ error: message });
  }
};

/** Excel mẫu báo giá gửi NCC — field_name snake_case để import lại. */
export const exportRFQExcel = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const { supplierId } = request.query as { supplierId?: string };
    if (!supplierId?.trim()) {
      return reply.code(400).send({ error: 'supplierId là bắt buộc (chọn NCC trước khi tải Excel)' });
    }

    const scope = await loadRfqExportScopeForBuyer(id, userId);
    if (!scope) return reply.code(404).send({ error: 'RFQ not found' });
    if ('forbidden' in scope) return reply.code(403).send({ error: 'Access denied' });

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId.trim(), deletedAt: null },
    });
    if (!supplier) return reply.code(404).send({ error: 'NCC không tồn tại' });

    const { rfq, items } = scope;
    const pr = rfq.purchaseRequest;

    const lines = buildRfqNccQuoteLines(items);
    const buffer = await buildRfqQuotationExcelBuffer({
      rfqNumber: rfq.rfqNumber,
      prNumber: pr.prNumber,
      supplierId: supplier.id,
      supplierName: supplier.name,
      lines,
    });
    const filename = buildRfqQuotationExcelFilename(rfq.rfqNumber, supplier.name);

    reply
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      .header('Content-Disposition', excelContentDisposition(filename))
      .send(buffer);
  } catch (error: any) {
    console.error('exportRFQExcel error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

// Export RFQ (PDF/JSON)
export const exportRFQ = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const { format } = request.query as { format?: string };

    const rfq = await prisma.rFQ.findUnique({
      where: { id },
      include: {
        purchaseRequest: {
          include: {
            items: {
              where: { deletedAt: null },
              orderBy: { lineNo: 'asc' },
            },
            requestor: {
              select: {
                username: true,
                email: true,
              },
            },
          },
        },
        quotations: {
          where: { deletedAt: null },
          include: {
            supplier: {
              select: {
                name: true,
                code: true,
              },
            },
            items: {
              orderBy: { lineNo: 'asc' },
            },
          },
        },
      },
    });

    if (!rfq) {
      return reply.code(404).send({ error: 'RFQ not found' });
    }

    if (rfq.buyerId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // For now, return JSON data. PDF generation can be added later
    const exportData = {
      rfqNumber: rfq.rfqNumber,
      status: rfq.status,
      notes: rfq.notes,
      sentDate: rfq.sentDate?.toISOString(),
      createdAt: rfq.createdAt.toISOString(),
      purchaseRequest: {
        prNumber: rfq.purchaseRequest.prNumber,
        department: rfq.purchaseRequest.department,
        totalAmount: rfq.purchaseRequest.totalAmount ? Number(rfq.purchaseRequest.totalAmount) : null,
        currency: rfq.purchaseRequest.currency,
        requestor: rfq.purchaseRequest.requestor,
        items: rfq.purchaseRequest.items.map((item: any) => ({
          lineNo: item.lineNo,
          description: item.description,
          partNo: item.partNo,
          qty: Number(item.qty),
          unit: item.unit,
          unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
          amount: item.amount ? Number(item.amount) : null,
        })),
      },
      quotations: rfq.quotations.map((q: any) => ({
        supplier: q.supplier,
        quotationNumber: q.quotationNumber,
        totalAmount: Number(q.totalAmount),
        currency: q.currency,
        leadTime: q.leadTime,
        paymentTerms: q.paymentTerms,
        deliveryTerms: q.deliveryTerms,
        warranty: q.warranty,
        items: q.items.map((item: any) => ({
          lineNo: item.lineNo,
          description: item.description,
          qty: Number(item.qty),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
      })),
    };

    if (format === 'pdf') {
      // TODO: Implement PDF generation using a library like pdfkit or puppeteer
      // For now, return JSON
      reply.type('application/json');
      reply.header('Content-Disposition', `attachment; filename="RFQ_${rfq.rfqNumber}.json"`);
      reply.send(exportData);
    } else {
      // Return JSON
      reply.type('application/json');
      reply.header('Content-Disposition', `attachment; filename="RFQ_${rfq.rfqNumber}.json"`);
      reply.send(exportData);
    }
  } catch (error: any) {
    console.error('Export RFQ error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Complete RFQ - Buyer xác nhận hoàn thành nhập báo giá, sẵn sàng để Buyer Leader so sánh
export const completeRFQ = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const rfq = await prisma.rFQ.findUnique({
      where: { id },
      include: {
        purchaseRequest: {
          select: {
            id: true,
            prNumber: true,
            companyId: true,
          },
        },
        quotations: {
          where: { deletedAt: null },
        },
      },
    });

    if (!rfq) {
      return reply.code(404).send({ error: 'RFQ not found' });
    }

    if (rfq.buyerId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // Kiểm tra RFQ phải có ít nhất 1 báo giá để hoàn thành
    if (rfq.quotations.length < 1) {
      return reply.code(400).send({
        error: 'RFQ phải có ít nhất 1 báo giá trước khi hoàn thành',
        quotationsCount: rfq.quotations.length,
      });
    }

    // Cho phép chuyển từ DRAFT, SENT hoặc QUOTATION_RECEIVED sang READY_FOR_COMPARISON
    // Nếu là DRAFT nhưng đã có >= 2 báo giá, cho phép submit
    if (rfq.status !== 'DRAFT' && rfq.status !== 'SENT' && rfq.status !== 'QUOTATION_RECEIVED') {
      return reply.code(400).send({
        error: `RFQ ở trạng thái ${rfq.status}, không thể hoàn thành`,
        currentStatus: rfq.status,
      });
    }

    // Update RFQ status (raw query: id::text = $1 để tránh lỗi text = uuid)
    try {
      const updateSql = `UPDATE rfqs SET status = 'READY_FOR_COMPARISON'::"RFQStatus", updated_at = NOW() WHERE id::text = $1`;
      await prisma.$executeRawUnsafe(updateSql, id);
    } catch (rawErr: any) {
      if (rawErr?.message?.includes('invalid input value') || rawErr?.message?.includes('RFQStatus')) {
        console.error('Complete RFQ: DB enum RFQStatus may not have READY_FOR_COMPARISON. Run: npx prisma migrate deploy');
        return reply.code(500).send({
          error: 'Cấu hình database chưa đúng. Vui lòng chạy migration: npx prisma migrate deploy (trong thư mục server)',
        });
      }
      throw rawErr;
    }
    const updatedRFQ = await prisma.rFQ.findUnique({
      where: { id },
    });
    if (!updatedRFQ) {
      return reply.code(500).send({ error: 'RFQ update failed' });
    }

    // Cập nhật trạng thái ITEM: RFQ_SUBMITTED / READY_FOR_REVIEW cho các item thuộc RFQ này
    try {
      // Lấy itemIds từ notes (đã lưu khi tạo RFQ)
      let itemIds: string[] = [];
      if (rfq.notes) {
        const match = rfq.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            if (parsed.itemIds && Array.isArray(parsed.itemIds)) {
              itemIds = parsed.itemIds as string[];
            }
          } catch {
            // ignore parse error
          }
        }
      }
      if (itemIds.length > 0) {
        await prisma.purchaseRequestItem.updateMany({
          where: {
            id: { in: itemIds },
            deletedAt: null,
          },
          data: {
            status: 'READY_FOR_REVIEW' as any,
          },
        });
      }
      // Tổng hợp PR status từ trạng thái item
      const prId = rfq.purchaseRequestId;
      const prItemsForStatus = await prisma.purchaseRequestItem.findMany({
        where: { purchaseRequestId: prId, deletedAt: null },
        select: { status: true, departmentItemOutcome: true },
      });
      const aggregatedStatus = computePRStatusFromItemStatuses(
        prItemsForStatus
          .filter((i) => itemDepartmentOutcomeAllowsProcurement(i.departmentItemOutcome))
          .map((i) => i.status)
      );
      if (aggregatedStatus) {
        await prisma.purchaseRequest.update({
          where: { id: prId },
          data: { status: aggregatedStatus },
        });
      }
    } catch (e) {
      console.error('[completeRFQ] Failed to update item statuses:', (e as any)?.message || e);
    }

    // Audit log
    await auditUpdate(
      'rfqs',
      id,
      rfq,
      updatedRFQ,
      { userId, companyId: rfq.companyId || undefined }
    );

    // Send notifications to Buyer Leader and Buyer Manager (non-blocking)
    try {
      const { createNotification, NotificationTemplates } = await import('../utils/notifications');
      const { getIO } = await import('../utils/getIO');
      const io = getIO();

      const buyerLeader = await prisma.user.findFirst({
        where: { role: 'BUYER_LEADER', deletedAt: null },
        select: { id: true },
      });

      const buyerManager = await prisma.user.findFirst({
        where: { role: 'BUYER_MANAGER', deletedAt: null },
        select: { id: true },
      });

      const quotationCount = rfq.quotations.length;
      const prNumber = rfq.purchaseRequest?.prNumber || 'N/A';

      if (buyerLeader) {
        const template = NotificationTemplates.RFQ_SUBMITTED(updatedRFQ.rfqNumber, prNumber, quotationCount);
        await createNotification(io, {
          userId: buyerLeader.id,
          role: 'BUYER_LEADER',
          type: 'RFQ_SUBMITTED',
          title: template.title,
          message: template.message,
          relatedId: id,
          relatedType: 'RFQ',
          metadata: {
            rfqNumber: updatedRFQ.rfqNumber,
            prNumber,
            quotationCount,
          },
          companyId: rfq.companyId || null,
        });
      }

      if (buyerManager) {
        const template = NotificationTemplates.RFQ_SUBMITTED(updatedRFQ.rfqNumber, prNumber, quotationCount);
        await createNotification(io, {
          userId: buyerManager.id,
          role: 'BUYER_MANAGER',
          type: 'RFQ_SUBMITTED',
          title: template.title,
          message: template.message,
          relatedId: id,
          relatedType: 'RFQ',
          metadata: {
            rfqNumber: updatedRFQ.rfqNumber,
            prNumber,
            quotationCount,
          },
          companyId: rfq.companyId || null,
        });
      }
    } catch (notifError: any) {
      console.error('Complete RFQ: notification error (RFQ still completed):', notifError?.message || notifError);
    }

    reply.send({
      id: updatedRFQ.id,
      rfqNumber: updatedRFQ.rfqNumber,
      status: updatedRFQ.status,
      message: 'RFQ đã được đánh dấu hoàn thành. Buyer Leader có thể so sánh báo giá.',
    });
  } catch (error: any) {
    console.error('Complete RFQ error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

