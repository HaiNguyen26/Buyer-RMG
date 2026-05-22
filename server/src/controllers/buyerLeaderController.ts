import { FastifyReply } from 'fastify';
import { POStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditCreate, auditUpdate } from '../utils/audit';
import { z } from 'zod';
import { createNotification, NotificationTemplates, markNotificationAsResolved } from '../utils/notifications';
import { getIO } from '../utils/getIO';
import { computeQuotationBaseline } from '../utils/baseline';
import { computePRStatusFromItemStatuses } from '../utils/prStatusFromItems';
import { prSalesPOSelect, serializePRSalesOrder } from '../utils/prSalesOrder';
import { parsePoItemIdsJson } from '../utils/procurementItemGates';
import {
  itemDepartmentOutcomeAllowsProcurement,
  prismaPurchaseItemNeedPurchaseDepartmentActive,
} from '../utils/departmentPrItemReview';
import {
  normalizePOApprovalQueueFilter,
  PO_PENDING_STATUSES,
  poManagerApprovedByUserWhere,
  poManagerRejectedByUserWhere,
  periodStartDaysAgo,
} from '../utils/poApprovalQueue';
import { inferVatPercentFromLine } from '../utils/quotationLine';
import {
  comparePoTotalToPrProposedBudget,
  computePrProposedBudgetAmount,
} from '../utils/prProposedBudget';
import {
  applySupplierTaxCodeOnPoApproval,
  mapSupplierTaxForPoView,
} from '../utils/poSupplierTax';
import {
  executePoPartialLineCancel,
  formatPoPartialLineCancelMessage,
  resolveAllLegacyCancelRequestedPos,
  resolveLegacyCancelRequestedPo,
} from '../utils/executePoPartialLineCancel';

// Validation schemas
const assignPRSchema = z.object({
  buyerId: z.string().min(1),
  scope: z.enum(['FULL', 'PARTIAL']),
  assignedItemIds: z.array(z.string()).optional(),
  note: z.string().min(1, 'Note phân công là bắt buộc'),
});

const selectSupplierSchema = z.object({
  purchaseRequestId: z.string().min(1),
  selectionReason: z.string().min(1, 'Lý do chọn NCC là bắt buộc'),
  overBudgetReason: z.string().optional(),
  // Full RFQ: chọn 1 NCC cho toàn bộ RFQ (gửi quotationId)
  quotationId: z.string().optional(),
  // Per-item (mix): chọn NCC theo từng item – selections: [{ purchaseRequestItemId, quotationId }]
  selections: z.array(z.object({
    purchaseRequestItemId: z.string().min(1),
    quotationId: z.string().min(1),
  })).optional(),
}).refine(
  (data) => data.quotationId != null || (data.selections != null && data.selections.length > 0),
  { message: 'Cần quotationId (chọn 1 NCC) hoặc selections (chọn NCC theo từng item)' }
);

type SelectSupplierParsedBody = z.infer<typeof selectSupplierSchema>;

const optimizeAwardBodySchema = z.object({
  mode: z.enum(['lowest_cost', 'cost_plus_leadtime']),
  selections: z.record(z.string()),
});

const approveAwardBodySchema = z.object({
  selections: z.record(z.string()),
  justification: z.string().optional(),
});

// Generate RFQ Number
const generateRFQNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `RFQ-${year}-`;
  
  const existingRFQs = await prisma.rFQ.findMany({
    where: { rfqNumber: { startsWith: prefix } },
    select: { rfqNumber: true },
  });
  
  const existingSequences = existingRFQs
    .map((rfq) => {
      const match = rfq.rfqNumber.match(/-(\d{4})$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((num) => num > 0)
    .sort((a, b) => b - a);
  
  let nextSeq = 1;
  for (const seq of existingSequences) {
    if (seq === nextSeq) {
      nextSeq++;
    } else if (seq > nextSeq) {
      break;
    }
  }
  
  const seq = String(nextSeq).padStart(4, '0');
  return `${prefix}${seq}`;
};

// Check Budget Exception
const checkBudgetException = async (prId: string, purchaseAmount: number) => {
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    select: {
      id: true,
      totalAmount: true,
      companyId: true,
    },
  });

  if (!pr || !pr.totalAmount) {
    return null;
  }

  const prAmount = Number(pr.totalAmount);
  if (purchaseAmount <= prAmount) {
    return null; // No exception
  }

  const overPercent = ((purchaseAmount - prAmount) / prAmount) * 100;

  // Create budget exception
  const exception = await prisma.budgetException.create({
    data: {
      purchaseRequestId: prId,
      prAmount: prAmount,
      purchaseAmount: purchaseAmount,
      overPercent: overPercent,
      status: 'PENDING',
      companyId: pr.companyId || null,
    },
  });

  // Update PR status
  await prisma.purchaseRequest.update({
    where: { id: prId },
    data: {
      status: 'BUDGET_EXCEPTION',
    },
  });

  return exception;
};

// Get Pending Assignments (PRs approved by Branch Manager)
export const getPendingAssignments = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // First, check total count of PRs waiting for Buyer Leader assignment
    const totalApprovedPRs = await prisma.purchaseRequest.count({
      where: {
        status: { in: ['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'] },
        deletedAt: null,
        items: {
          some: { ...prismaPurchaseItemNeedPurchaseDepartmentActive },
        },
      },
    });

    // Check PRs with assignments
    const prsWithAssignments = await prisma.purchaseRequest.findMany({
      where: {
        status: { in: ['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'] },
        deletedAt: null,
        items: {
          some: { ...prismaPurchaseItemNeedPurchaseDepartmentActive },
        },
        assignments: {
          some: {
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        prNumber: true,
      },
    });

    console.log('Buyer Leader getPendingAssignments - Debug:', {
      userId,
      totalApprovedPRs,
      prsWithAssignmentsCount: prsWithAssignments.length,
      prsWithAssignments: prsWithAssignments.map(p => p.prNumber),
    });

    const prs = await prisma.purchaseRequest.findMany({
      where: {
        status: { in: ['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'] },
        deletedAt: null,
        items: {
          some: { ...prismaPurchaseItemNeedPurchaseDepartmentActive },
        },
        assignments: {
          none: {
            deletedAt: null,
          },
        },
      },
      include: {
        requestor: {
          select: {
            username: true,
            email: true,
            location: true,
          },
        },
        items: {
          where: { ...prismaPurchaseItemNeedPurchaseDepartmentActive },
          orderBy: { lineNo: 'asc' },
          take: 100, // Limit items per PR to prevent large responses
        },
        salesPO: { select: prSalesPOSelect },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('Buyer Leader getPendingAssignments - Result:', {
      foundPRs: prs.length,
      prNumbers: prs.map(p => p.prNumber),
    });

    const mappedPRs = prs.length > 0 ? prs.map((pr) => ({
      id: pr.id,
      prNumber: pr.prNumber,
      department: pr.department || '',
      totalAmount: (function () {
        const calculatedTotal = (pr.items || []).reduce((sum, item: any) => {
          const qty = Number(item.qty) || 0;
          const estimatedUnitPrice = Number(item.estimatedUnitPriceVnd) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          const effectiveUnitPrice = estimatedUnitPrice > 0 ? estimatedUnitPrice : unitPrice;
          return sum + qty * effectiveUnitPrice;
        }, 0);
        const totalAmount = pr.totalAmount ? Number(pr.totalAmount) : 0;
        return totalAmount > 0 ? totalAmount : calculatedTotal > 0 ? calculatedTotal : null;
      })(),
      currency: pr.currency || 'VND',
      requestor: pr.requestor || null,
      items: pr.items.map((item: any) => ({
        id: item.id,
        lineNo: item.lineNo,
        description: item.description || '',
        qty: Number(item.qty) || 0,
        fromStockQty: Number(item.fromStockQty || 0),
        purchaseQty: Number(item.purchaseQty || 0),
        status: item.status || 'NEED_PURCHASE',
        unit: item.unit || null,
        unitPrice:
          Number(item.estimatedUnitPriceVnd) > 0
            ? Number(item.estimatedUnitPriceVnd)
            : item.unitPrice
              ? Number(item.unitPrice)
              : null,
        amount:
          item.amount && Number(item.amount) > 0
            ? Number(item.amount)
            : (() => {
                const qty = Number(item.qty) || 0;
                const estimated = Number(item.estimatedUnitPriceVnd) || 0;
                const unit = Number(item.unitPrice) || 0;
                const effectiveUnitPrice = estimated > 0 ? estimated : unit;
                return effectiveUnitPrice > 0 ? qty * effectiveUnitPrice : null;
              })(),
        estimatedUnitPriceVnd:
          Number(item.estimatedUnitPriceVnd) > 0 ? Number(item.estimatedUnitPriceVnd) : null,
      })),
      createdAt: pr.createdAt.toISOString(),
      salesOrder: serializePRSalesOrder(pr),
    })) : [];

    const response = { prs: mappedPRs };
    return reply.code(200).send(response);
  } catch (error: any) {
    console.error('Get pending assignments error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Assign PR to Buyer
export const assignPR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { prId } = request.params as { prId: string };
    const body = assignPRSchema.parse(request.body);

    // Check if PR exists and is approved
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: prId },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    if (!['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'].includes(pr.status)) {
      return reply.code(400).send({ error: 'PR must be approved and waiting for Buyer Leader assignment' });
    }

    // Check if buyer exists
    const buyer = await prisma.user.findUnique({
      where: { id: body.buyerId },
      select: { role: true },
    });

    if (!buyer || buyer.role !== 'BUYER') {
      return reply.code(400).send({ error: 'Invalid buyer ID' });
    }

    // Get all PR items
    const prItems = await prisma.purchaseRequestItem.findMany({
      where: {
        purchaseRequestId: prId,
        ...prismaPurchaseItemNeedPurchaseDepartmentActive,
      },
      select: { id: true },
    });

    const totalItemsCount = prItems.length;
    const itemIds = prItems.map(item => item.id);

    // If PARTIAL assignment, validate assignedItemIds
    if (body.scope === 'PARTIAL' && body.assignedItemIds) {
      // Validate all assigned items belong to this PR
      const invalidItems = body.assignedItemIds.filter(id => !itemIds.includes(id));
      if (invalidItems.length > 0) {
        return reply.code(400).send({ 
          error: 'Some assigned items do not belong to this PR',
          invalidItems 
        });
      }

      // Check if any of these items are already assigned to another buyer
      const existingAssignments = await prisma.pRAssignment.findMany({
        where: {
          purchaseRequestId: prId,
          deletedAt: null,
        },
        select: {
          assignedItemIds: true,
          buyerId: true,
        },
      });

      for (const existingAssignment of existingAssignments) {
        if (existingAssignment.assignedItemIds) {
          const existingItemIds = JSON.parse(existingAssignment.assignedItemIds) as string[];
          const overlap = body.assignedItemIds.filter(id => existingItemIds.includes(id));
          if (overlap.length > 0) {
            return reply.code(400).send({ 
              error: `Items already assigned to another buyer`,
              conflictingItems: overlap,
              assignedToBuyer: existingAssignment.buyerId,
            });
          }
        }
      }
    }

    // Create assignment
    const assignment = await prisma.pRAssignment.create({
      data: {
        purchaseRequestId: prId,
        buyerLeaderId: userId,
        buyerId: body.buyerId,
        scope: body.scope,
        assignedItemIds: body.scope === 'PARTIAL' && body.assignedItemIds
          ? JSON.stringify(body.assignedItemIds)
          : null,
        note: body.note,
        companyId: pr.companyId || null,
      },
    });

    // Check if all items are now assigned
    const allAssignments = await prisma.pRAssignment.findMany({
      where: {
        purchaseRequestId: prId,
        deletedAt: null,
      },
      select: {
        scope: true,
        assignedItemIds: true,
      },
    });

    let allItemsAssigned = false;
    if (allAssignments.some(a => a.scope === 'FULL')) {
      allItemsAssigned = true;
    } else {
      const assignedItemIdsSet = new Set<string>();
      allAssignments.forEach(a => {
        if (a.assignedItemIds) {
          const itemIds = JSON.parse(a.assignedItemIds) as string[];
          itemIds.forEach(id => assignedItemIdsSet.add(id));
        }
      });
      allItemsAssigned = assignedItemIdsSet.size === totalItemsCount;
    }

    // Cập nhật trạng thái ITEM: ASSIGNED cho các item thuộc phạm vi phân công mới
    // Schema có field status (PurchaseRequestItemStatus) nhưng generated client có thể chưa sync → dùng type assertion
    const itemUpdateData = { status: 'ASSIGNED' as const };
    if (body.scope === 'FULL') {
      await prisma.purchaseRequestItem.updateMany({
        where: {
          purchaseRequestId: prId,
          ...prismaPurchaseItemNeedPurchaseDepartmentActive,
        },
        data: itemUpdateData as Parameters<typeof prisma.purchaseRequestItem.updateMany>[0]['data'],
      });
    } else if (body.scope === 'PARTIAL' && body.assignedItemIds && body.assignedItemIds.length > 0) {
      await prisma.purchaseRequestItem.updateMany({
        where: {
          id: { in: body.assignedItemIds },
          ...prismaPurchaseItemNeedPurchaseDepartmentActive,
        },
        data: itemUpdateData as Parameters<typeof prisma.purchaseRequestItem.updateMany>[0]['data'],
      });
    }

    // Tổng hợp PR status từ trạng thái item (chỉ cập nhật khi aggregate trả về giá trị)
    const allItems = await prisma.purchaseRequestItem.findMany({
      where: { purchaseRequestId: prId, deletedAt: null },
      select: { status: true, departmentItemOutcome: true } as any,
    });
    const aggregatedStatus = computePRStatusFromItemStatuses(
      allItems
        .filter((i) =>
          itemDepartmentOutcomeAllowsProcurement((i as unknown as { departmentItemOutcome: string | null }).departmentItemOutcome)
        )
        .map((i) => (i as unknown as { status: string }).status)
    );
    if (aggregatedStatus) {
      await prisma.purchaseRequest.update({
        where: { id: prId },
        data: { status: aggregatedStatus },
      });
    }

    // Get assigned items count for notification
    const assignedItemCount = body.scope === 'FULL' 
      ? totalItemsCount 
      : (body.assignedItemIds?.length || 0);

    // Send notification to BUYER: Được giao PR/item
    const template = NotificationTemplates.PR_ASSIGNED(pr.prNumber, assignedItemCount);
    await createNotification(getIO(), {
      userId: body.buyerId,
      role: 'BUYER',
      type: 'PR_ASSIGNED',
      title: template.title,
      message: template.message,
      relatedId: prId,
      relatedType: 'PR',
      metadata: { prNumber: pr.prNumber, itemCount: assignedItemCount },
      companyId: pr.companyId,
    });

    // Mark old notification as resolved if all items assigned
    if (allItemsAssigned) {
      await markNotificationAsResolved(prId, 'PR', 'PR_READY_FOR_ASSIGNMENT');
    }

    // Audit log
    await auditCreate('pr_assignments', assignment.id, assignment, {
      userId,
      companyId: assignment.companyId ?? undefined,
    });

    reply.send({
      message: 'PR assigned successfully',
      assignment: {
        id: assignment.id,
        prId: assignment.purchaseRequestId,
        buyerId: assignment.buyerId,
        scope: assignment.scope,
        note: assignment.note,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Assign PR error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Assignments History
export const getAssignments = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const assignments = await prisma.pRAssignment.findMany({
      where: {
        buyerLeaderId: userId,
        deletedAt: null,
      },
      include: {
        purchaseRequest: {
          select: {
            id: true,
            prNumber: true,
            department: true,
            status: true,
            _count: {
              select: {
                items: {
                  where: { ...prismaPurchaseItemNeedPurchaseDepartmentActive },
                },
              },
            },
          },
        },
        buyer: {
          select: {
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    const mappedAssignments = assignments.map((assignment) => {
      const assignedItemIds = assignment.assignedItemIds
        ? (JSON.parse(assignment.assignedItemIds) as string[])
        : [];
      const prTotalItems = assignment.purchaseRequest._count.items ?? 0;
      const assignedItemCount = assignment.scope === 'FULL' ? prTotalItems : assignedItemIds.length;
      return {
        id: assignment.id,
        prNumber: assignment.purchaseRequest.prNumber,
        prId: assignment.purchaseRequest.id,
        prStatus: assignment.purchaseRequest.status,
        buyer: assignment.buyer,
        scope: assignment.scope,
        assignedItemIds: assignedItemIds,
        assignedItemCount,
        prTotalItems,
        note: assignment.note,
        createdAt: assignment.createdAt.toISOString(),
      };
    });

    reply.send({ assignments: mappedAssignments });
  } catch (error: any) {
    console.error('Get assignments error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Compare Quotations for RFQ
export const compareQuotations = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { rfqId } = request.params as { rfqId: string };

    // Lấy RFQ với tất cả quotations (không filter status ở database level)
    const rfq = await prisma.rFQ.findUnique({
      where: { id: rfqId },
      include: {
        buyer: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        purchaseRequest: {
          include: {
            items: {
              where: { deletedAt: null },
              orderBy: { lineNo: 'asc' },
            },
          },
        },
        quotations: {
          where: {
            deletedAt: null, // Chỉ filter deletedAt, không filter status
          },
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            items: {
              orderBy: { lineNo: 'asc' },
            },
            attachments: {
              where: { deletedAt: null },
              select: { id: true, fileName: true, fileUrl: true, fileSize: true, contentType: true },
            },
          },
          orderBy: {
            totalAmount: 'asc',
          },
        },
      },
    });

    if (!rfq) {
      return reply.code(404).send({ error: 'RFQ not found' });
    }

    // Parse item IDs that belong to THIS specific RFQ (stored in notes as [RFQ_ITEMS]{...}[/RFQ_ITEMS])
    let rfqItemIds: string[] | null = null;
    if (rfq.notes) {
      const match = rfq.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.itemIds && Array.isArray(parsed.itemIds) && parsed.itemIds.length > 0) {
            rfqItemIds = parsed.itemIds as string[];
          }
        } catch (_) { /* ignore parse errors */ }
      }
    }

    // Filter PR items to only those belonging to this RFQ (if itemIds are specified)
    const rfqPrItems = rfqItemIds
      ? rfq.purchaseRequest.items.filter((item: any) => rfqItemIds!.includes(item.id))
      : rfq.purchaseRequest.items;

    console.log(`[compareQuotations] RFQ ${rfq.rfqNumber} - rfqItemIds: ${rfqItemIds ? rfqItemIds.join(', ') : 'ALL'}, filtered prItems: ${rfqPrItems.length}/${rfq.purchaseRequest.items.length}`);

    // Lưu tổng số quotations ban đầu (trước khi filter)
    const totalQuotationsCount = rfq.quotations.length;
    
    // Filter quotations ở application level để đảm bảo chắc chắn
    const validStatuses = ['PENDING', 'VALID', 'SELECTED'];
    
    console.log(`[compareQuotations] RFQ ${rfq.rfqNumber} - Status: ${rfq.status}`);
    console.log(`[compareQuotations] Total quotations fetched from DB: ${totalQuotationsCount}`);
    
    if (totalQuotationsCount > 0) {
      console.log(`[compareQuotations] Quotations details (before filter):`, rfq.quotations.map((q: any) => ({
        id: q.id,
        status: q.status,
        statusType: typeof q.status,
        supplier: q.supplier?.name || 'N/A',
        itemsCount: q.items?.length || 0,
      })));
      
      console.log(`[compareQuotations] Quotations by status:`, 
        rfq.quotations.reduce((acc: any, q: any) => {
          const status = String(q.status); // Đảm bảo convert sang string
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {})
      );
    }
    
    const validQuotations = rfq.quotations.filter((q: any) => {
      const status = String(q.status).toUpperCase(); // Convert và uppercase để so sánh
      const isValid = validStatuses.includes(status);
      if (!isValid) {
        console.log(`[compareQuotations] Quotation ${q.id} filtered out - status: "${q.status}" (type: ${typeof q.status})`);
      }
      return isValid;
    });
    
    console.log(`[compareQuotations] Valid quotations (PENDING/VALID/SELECTED): ${validQuotations.length}`);
    
    if (validQuotations.length === 0 && totalQuotationsCount > 0) {
      console.log(`[compareQuotations] ⚠️ WARNING: RFQ có ${totalQuotationsCount} quotations nhưng không có quotations nào với status PENDING/VALID/SELECTED`);
      console.log(`[compareQuotations] Expected statuses:`, validStatuses);
      console.log(`[compareQuotations] Actual statuses found:`, [...new Set(rfq.quotations.map((q: any) => String(q.status)))]);
    }
    
    // Gán lại quotations đã filter
    rfq.quotations = validQuotations;

    // Find recommended quotation and generate reason
    const recommendedQuotation = rfq.quotations.find(q => q.isRecommended);
    let recommendationReason = null;
    
    if (recommendedQuotation && rfq.quotations.length >= 2) {
      const allQuotations = rfq.quotations.sort((a, b) => Number(a.totalAmount) - Number(b.totalAmount));
      const lowestPrice = Number(allQuotations[0].totalAmount);
      const recommendedPrice = Number(recommendedQuotation.totalAmount);
      
      const leadTimes = rfq.quotations
        .map(q => q.leadTime || 999)
        .filter(lt => lt > 0)
        .sort((a, b) => a - b);
      const shortestLeadTime = leadTimes[0] || 999;
      const recommendedLeadTime = recommendedQuotation.leadTime || 999;
      
      const reasons: string[] = [];
      
      // Price reason
      if (recommendedPrice === lowestPrice) {
        reasons.push('Giá thấp nhất');
      } else {
        const priceDiff = ((recommendedPrice - lowestPrice) / lowestPrice) * 100;
        if (priceDiff <= 5) {
          reasons.push('Giá cạnh tranh (chênh lệch < 5%)');
        }
      }
      
      // Lead time reason
      if (recommendedLeadTime === shortestLeadTime) {
        reasons.push('Thời gian giao hàng ngắn nhất');
      } else if (recommendedLeadTime <= shortestLeadTime * 1.2) {
        reasons.push('Thời gian giao hàng hợp lý');
      }
      
      // Payment terms reason
      if (recommendedQuotation.paymentTerms) {
        const terms = recommendedQuotation.paymentTerms.toLowerCase();
        if (terms.includes('net 30') || terms.includes('30 days')) {
          reasons.push('Điều khoản thanh toán tốt (Net 30)');
        }
      }
      
      // Warranty reason
      if (recommendedQuotation.warranty) {
        reasons.push('Có bảo hành');
      }
      
      recommendationReason = reasons.length > 0 
        ? reasons.join(', ') 
        : 'Điểm tổng hợp cao nhất';
    }

    // Baseline = giá PR từng item (chỉ các items thuộc RFQ này)
    const prItemsBaseline = rfqPrItems.map((item: any) => ({
      id: item.id,
      lineNo: item.lineNo,
      unitPrice: item.unitPrice != null ? Number(item.unitPrice) : null,
      amount: item.amount != null ? Number(item.amount) : null,
      qty: Number(item.qty) || 0,
    }));

    // Tính baseline cho từng quotation hợp lệ (chỉ dựa trên items của RFQ này)
    const quotationsWithBaseline = validQuotations.map((q) => {
      // Only include quotation items that match this RFQ's items
      const rfqQuotationItems = rfqItemIds
        ? q.items.filter((it: any) => rfqItemIds!.includes(it.purchaseRequestItemId))
        : q.items;

      const baselineResult = computeQuotationBaseline(
        prItemsBaseline,
        rfqQuotationItems.map((it: any) => ({
          purchaseRequestItemId: it.purchaseRequestItemId,
          unitPrice: it.unitPrice,
          lineNo: it.lineNo,
        }))
      );

      // Recalculate totalAmount for this RFQ's items only
      const rfqTotalAmount = rfqItemIds
        ? rfqQuotationItems.reduce((sum: number, it: any) => sum + Number(it.totalPrice || 0), 0)
        : Number(q.totalAmount);

      return { quotation: q, baselineResult, rfqQuotationItems, rfqTotalAmount };
    });

    // Tính min/max total amount dựa trên items của RFQ này
    const rfqTotalAmounts = quotationsWithBaseline.map((x) => x.rfqTotalAmount).filter((v) => v > 0);
    const minTotalAmount = rfqTotalAmounts.length > 0 ? Math.min(...rfqTotalAmounts) : null;
    const maxTotalAmount = rfqTotalAmounts.length > 0 ? Math.max(...rfqTotalAmounts) : null;
    const itemCount = rfqPrItems.length;
    const quotationsCount = validQuotations.length;

    // Baseline total chỉ tính từ items của RFQ này
    const rfqBaselineTotal = prItemsBaseline.reduce(
      (sum, item) => sum + (item.unitPrice != null ? item.unitPrice * item.qty : 0),
      0
    );

    // Explicitly set headers to prevent compression issues
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Encoding', 'identity');

    reply.send({
      rfq: {
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
        prNumber: rfq.purchaseRequest.prNumber,
        prId: rfq.purchaseRequest.id,
        prPurpose: (rfq.purchaseRequest as any).purpose || null,
        prDepartment: (rfq.purchaseRequest as any).department || null,
        prTotalAmount: rfq.purchaseRequest.totalAmount ? Number(rfq.purchaseRequest.totalAmount) : null,
        status: rfq.status,
        buyer: rfq.buyer ? {
          id: rfq.buyer.id,
          username: rfq.buyer.username,
          email: rfq.buyer.email,
        } : null,
        baselineTotal: rfqBaselineTotal > 0 ? rfqBaselineTotal : (rfq.purchaseRequest.totalAmount ? Number(rfq.purchaseRequest.totalAmount) : null),
        itemCount,
        quotationsCount,
        totalQuotationsCount,
        minTotalAmount,
        maxTotalAmount,
        prItems: rfqPrItems.map((item: any) => ({
          id: item.id,
          lineNo: item.lineNo,
          description: item.description,
          qty: Number(item.qty),
          unit: item.unit,
          baselineUnitPrice: item.unitPrice ? Number(item.unitPrice) : null,
          baselineAmount: item.amount ? Number(item.amount) : null,
        })),
      },
      quotations: quotationsWithBaseline.map(({ quotation: q, baselineResult, rfqQuotationItems, rfqTotalAmount }) => ({
        id: q.id,
        supplier: q.supplier,
        quotationNumber: q.quotationNumber,
        totalAmount: rfqTotalAmount,
        currency: q.currency,
        leadTime: q.leadTime,
        deliveryTerms: q.deliveryTerms,
        paymentTerms: q.paymentTerms,
        warranty: q.warranty,
        riskNotes: q.riskNotes,
        isRecommended: q.isRecommended,
        recommendationScore: q.recommendationScore ? Number(q.recommendationScore) : null,
        overBaseline: baselineResult.overBaseline,
        itemsBaseline: baselineResult.items,
        attachments: Array.isArray((q as any).attachments)
          ? (q as any).attachments.map((a: { id: string; fileName: string; fileUrl: string; fileSize: number; contentType: string }) => ({
              id: a.id,
              fileName: a.fileName,
              fileUrl: a.fileUrl,
              fileSize: a.fileSize,
              contentType: a.contentType,
            }))
          : [],
        items: rfqQuotationItems.map((item: any) => {
          const bi = baselineResult.items.find(
            (b) => b.purchaseRequestItemId === item.purchaseRequestItemId && b.lineNo === item.lineNo
          );
          return {
            id: item.id,
            lineNo: item.lineNo,
            description: item.description,
            qty: Number(item.qty),
            unit: item.unit,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            purchaseRequestItemId: item.purchaseRequestItemId,
            leadTimeDays: item.leadTimeDays != null ? Number(item.leadTimeDays) : null,
            warrantyMonths: item.warrantyMonths != null ? Number(item.warrantyMonths) : null,
            deliveryDate: item.deliveryDate?.toISOString?.() ?? null,
            baselineUnitPrice: bi?.baselineUnitPrice ?? null,
            overBaseline: bi?.overBaseline ?? false,
          };
        }),
      })),
      recommendation: recommendedQuotation ? {
        quotationId: recommendedQuotation.id,
        supplier: recommendedQuotation.supplier,
        reason: recommendationReason,
        score: recommendedQuotation.recommendationScore ? Number(recommendedQuotation.recommendationScore) : null,
      } : null,
    });
  } catch (error: any) {
    console.error('Compare quotations error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Recommendations
export const getRecommendations = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { rfqId } = request.params as { rfqId: string };

    const quotations = await prisma.quotation.findMany({
      where: {
        rfqId,
        status: 'VALID',
        deletedAt: null,
      },
      include: {
        supplier: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        recommendationScore: 'desc',
      },
    });

    const recommendations = quotations.map((q) => ({
      quotationId: q.id,
      supplier: q.supplier,
      totalAmount: Number(q.totalAmount),
      recommendationScore: q.recommendationScore ? Number(q.recommendationScore) : null,
      isRecommended: q.isRecommended,
      leadTime: q.leadTime,
      paymentTerms: q.paymentTerms,
    }));

    reply.send({ recommendations });
  } catch (error: any) {
    console.error('Get recommendations error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get PR quotations for supplier selection
export const getPRForSupplierSelection = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { prId } = request.params as { prId: string };
    const { rfqId } = request.query as { rfqId?: string };

    // Get PR with RFQ and quotations
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: prId },
      include: {
        rfqs: rfqId
          ? {
              where: { id: rfqId },
              include: {
                quotations: {
                  where: {
                    status: { in: ['VALID', 'SELECTED'] },
                    deletedAt: null,
                  },
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
                  },
                  orderBy: [
                    { isRecommended: 'desc' },
                    { recommendationScore: 'desc' },
                  ],
                },
              },
            }
          : {
              include: {
                quotations: {
                  where: {
                    status: { in: ['VALID', 'SELECTED'] },
                    deletedAt: null,
                  },
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
                  },
                  orderBy: [
                    { isRecommended: 'desc' },
                    { recommendationScore: 'desc' },
                  ],
                },
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
        requestor: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    const rfq = Array.isArray(pr.rfqs) ? pr.rfqs[0] : pr.rfqs;
    if (!rfq || !rfq.quotations || rfq.quotations.length === 0) {
      return reply.code(404).send({ error: 'No valid quotations found for this PR' });
    }

    const quotations = rfq.quotations;
    const recommendedQuotation = quotations.find(q => q.isRecommended);

    // Calculate over-budget percentage
    const prTotalAmount = pr.totalAmount ? Number(pr.totalAmount) : 0;
    let overBudgetInfo: any = null;
    
    if (recommendedQuotation) {
      const quotationAmount = Number(recommendedQuotation.totalAmount);
      if (quotationAmount > prTotalAmount && prTotalAmount > 0) {
        const overBudgetPercent = ((quotationAmount - prTotalAmount) / prTotalAmount) * 100;
        overBudgetInfo = {
          isOverBudget: true,
          prAmount: prTotalAmount,
          quotationAmount,
          overBudgetAmount: quotationAmount - prTotalAmount,
          overBudgetPercent: Math.round(overBudgetPercent * 100) / 100,
        };
      }
    }

    reply.send({
      pr: {
        id: pr.id,
        prNumber: pr.prNumber,
        department: pr.department,
        totalAmount: prTotalAmount,
        currency: pr.currency,
        requestor: pr.requestor,
      },
      rfq: {
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
      },
      recommendedQuotation: recommendedQuotation ? {
        id: recommendedQuotation.id,
        supplier: recommendedQuotation.supplier,
        quotationNumber: recommendedQuotation.quotationNumber,
        totalAmount: Number(recommendedQuotation.totalAmount),
        currency: recommendedQuotation.currency,
        leadTime: recommendedQuotation.leadTime,
        deliveryTerms: recommendedQuotation.deliveryTerms,
        paymentTerms: recommendedQuotation.paymentTerms,
        warranty: recommendedQuotation.warranty,
        riskNotes: recommendedQuotation.riskNotes,
        recommendationScore: recommendedQuotation.recommendationScore
          ? Number(recommendedQuotation.recommendationScore)
          : null,
      } : null,
      otherQuotations: quotations
        .filter(q => !q.isRecommended)
        .map(q => ({
          id: q.id,
          supplier: q.supplier,
          quotationNumber: q.quotationNumber,
          totalAmount: Number(q.totalAmount),
          currency: q.currency,
          leadTime: q.leadTime,
          recommendationScore: q.recommendationScore
            ? Number(q.recommendationScore)
            : null,
        })),
      overBudgetInfo,
    });
  } catch (error: any) {
    console.error('Get PR for supplier selection error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Select Supplier (Final Selection)
export const selectSupplier = async (
  request: AuthenticatedRequest,
  reply: FastifyReply,
  options?: { parsedBody?: SelectSupplierParsedBody }
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body =
      options?.parsedBody != null
        ? options.parsedBody
        : selectSupplierSchema.parse(request.body);
    const perItemMode = body.selections != null && body.selections.length > 0;

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: body.purchaseRequestId },
      include: { rfqs: { include: { quotations: { include: { supplier: true, items: true } } } } },
    });
    if (!pr) return reply.code(404).send({ error: 'PR not found' });

    const prAmount = pr.totalAmount ? Number(pr.totalAmount) : 0;
    let selectionsToCreate: { purchaseRequestItemId: string; quotationId: string }[] = [];
    let firstQuotation: { id: string; totalAmount: any; supplierId: string; supplier: any; rfqId: string } | null = null;
    let isOverBudget = false;
    let purchaseAmount = 0;

    if (perItemMode) {
      // Per-item (mix): selections = [{ purchaseRequestItemId, quotationId }]
      for (const sel of body.selections!) {
        const item = await prisma.purchaseRequestItem.findFirst({
          where: { id: sel.purchaseRequestItemId, purchaseRequestId: body.purchaseRequestId, deletedAt: null },
        });
        if (!item) return reply.code(400).send({ error: `Item ${sel.purchaseRequestItemId} không thuộc PR` });
        const quotation = await prisma.quotation.findFirst({
          where: { id: sel.quotationId },
          include: { rfq: true, supplier: true, items: true },
        });
        if (!quotation || quotation.rfq.purchaseRequestId !== body.purchaseRequestId) {
          return reply.code(400).send({ error: `Quotation ${sel.quotationId} không thuộc PR` });
        }
        const existingList = await prisma.supplierSelection.findMany({
          where: { purchaseRequestId: body.purchaseRequestId, purchaseRequestItemId: sel.purchaseRequestItemId },
          take: 1,
        });
        if (existingList.length > 0) return reply.code(400).send({ error: `Item đã được chọn NCC` });
        selectionsToCreate.push({ purchaseRequestItemId: sel.purchaseRequestItemId, quotationId: sel.quotationId });
      }
      // Over-budget: tổng tiền các item đã chọn (theo từng quotation item)
      let totalSelected = 0;
      for (const sel of selectionsToCreate) {
        const qi = await prisma.quotationItem.findFirst({
          where: { quotationId: sel.quotationId, purchaseRequestItemId: sel.purchaseRequestItemId, deletedAt: null },
        });
        if (qi) totalSelected += Number(qi.totalPrice || 0);
      }
      isOverBudget = prAmount > 0 && totalSelected > prAmount;
      purchaseAmount = totalSelected;
      if (isOverBudget && (!body.overBudgetReason || !body.overBudgetReason.trim())) {
        return reply.code(400).send({
          error: 'Lý do đề xuất vượt ngân sách là bắt buộc',
          overBudgetInfo: { prAmount, purchaseAmount: totalSelected, overAmount: totalSelected - prAmount, overPercent: prAmount ? ((totalSelected - prAmount) / prAmount) * 100 : 0 },
        });
      }
    } else {
      // Full RFQ: một quotation cho toàn bộ RFQ
      const quotation = await prisma.quotation.findUnique({
        where: { id: body.quotationId! },
        include: { rfq: true, supplier: true },
      });
      if (!quotation) return reply.code(404).send({ error: 'Quotation not found' });
      if (quotation.rfq.purchaseRequestId !== body.purchaseRequestId) {
        return reply.code(400).send({ error: 'Quotation does not belong to this PR' });
      }
      if (!['VALID', 'PENDING'].includes(String(quotation.status))) {
        return reply.code(400).send({ error: 'Quotation must be in valid or pending status' });
      }
      firstQuotation = quotation as any;
      const rfq = await prisma.rFQ.findUnique({ where: { id: quotation.rfqId }, select: { notes: true } });
      let itemIds: string[] = [];
      if (rfq?.notes) {
        const match = rfq.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            itemIds = Array.isArray(parsed?.itemIds) ? parsed.itemIds : [];
          } catch (_) {}
        }
      }
      if (itemIds.length === 0) return reply.code(400).send({ error: 'RFQ không có item nào' });
      const existingAnyList = await prisma.supplierSelection.findMany({
        where: { purchaseRequestId: body.purchaseRequestId, purchaseRequestItemId: { in: itemIds } },
        take: 1,
      });
      if (existingAnyList.length > 0) return reply.code(400).send({ error: 'Supplier already selected for this PR' });
      purchaseAmount = Number(quotation.totalAmount);
      isOverBudget = purchaseAmount > prAmount && prAmount > 0;
      if (isOverBudget && (!body.overBudgetReason || !body.overBudgetReason.trim())) {
        return reply.code(400).send({
          error: 'Lý do đề xuất vượt ngân sách là bắt buộc',
          overBudgetInfo: { prAmount, purchaseAmount, overAmount: purchaseAmount - prAmount, overPercent: prAmount ? ((purchaseAmount - prAmount) / prAmount) * 100 : 0 },
        });
      }
      selectionsToCreate = itemIds.map((id) => ({ purchaseRequestItemId: id, quotationId: quotation.id }));
    }

    // Create one SupplierSelection per item (selected_supplier_per_item)
    const created = await prisma.$transaction(
      selectionsToCreate.map((sel) =>
        prisma.supplierSelection.create({
          data: {
            purchaseRequestId: body.purchaseRequestId,
            purchaseRequestItemId: sel.purchaseRequestItemId,
            quotationId: sel.quotationId,
            buyerLeaderId: userId,
            selectionReason: body.selectionReason,
            companyId: pr.companyId || null,
          },
        })
      )
    );
    const selection = created[0];

    // Mark quotations as SELECTED (ít nhất một item đã chọn)
    const quotationIds = [...new Set(selectionsToCreate.map((s) => s.quotationId))];
    await prisma.quotation.updateMany({
      where: { id: { in: quotationIds } },
      data: { status: 'SELECTED' },
    });

    // Update item status to SUPPLIER_SELECTED
    await prisma.purchaseRequestItem.updateMany({
      where: { id: { in: selectionsToCreate.map((s) => s.purchaseRequestItemId) }, deletedAt: null },
      data: { status: 'SUPPLIER_SELECTED' as any },
    });

    // Handle over-budget case
    if (isOverBudget) {
      const overPercent = ((purchaseAmount - prAmount) / prAmount) * 100;

      // Create budget exception with Buyer Leader's reason
      const exception = await prisma.budgetException.create({
        data: {
          purchaseRequestId: body.purchaseRequestId,
          prAmount: prAmount,
          purchaseAmount: purchaseAmount,
          overPercent: overPercent,
          status: 'PENDING',
          comment: body.overBudgetReason, // Lý do từ Buyer Leader
          companyId: pr.companyId || null,
        },
      });

      // Update PR status to BUDGET_EXCEPTION (waiting for Branch Manager approval)
      const anyQuotationId = firstQuotation?.id ?? selectionsToCreate[0]?.quotationId;
      const quotForSupplier = anyQuotationId ? await prisma.quotation.findUnique({ where: { id: anyQuotationId }, select: { supplierId: true } }) : null;
      await prisma.purchaseRequest.update({
        where: { id: body.purchaseRequestId },
        data: {
          status: 'BUDGET_EXCEPTION',
          supplierId: quotForSupplier?.supplierId ?? undefined,
        },
      });

      // Get requestor and branch managers for notifications
      const requestor = await prisma.user.findUnique({
        where: { id: pr.requestorId },
        select: { id: true, role: true },
      });

      const branchManagers = await prisma.user.findMany({
        where: {
          role: 'BRANCH_MANAGER',
          location: pr.location || undefined,
          deletedAt: null,
        },
        select: { id: true, role: true },
      });

      // Send notification to REQUESTOR: PR vượt ngân sách
      if (requestor) {
        const template = NotificationTemplates.PR_OVER_BUDGET(pr.prNumber);
        await createNotification(getIO(), {
          userId: requestor.id,
          role: requestor.role,
          type: 'PR_OVER_BUDGET',
          title: template.title,
          message: template.message,
          relatedId: body.purchaseRequestId,
          relatedType: 'PR',
          metadata: { prNumber: pr.prNumber, overPercent: Math.round(overPercent * 100) / 100 },
          companyId: pr.companyId,
        });
      }

      // Send notification to BRANCH_MANAGER: PR vượt ngân sách cần quyết định
      for (const manager of branchManagers) {
        const template = NotificationTemplates.PR_OVER_BUDGET_DECISION_REQUIRED(
          pr.prNumber,
          Math.round(overPercent * 100) / 100
        );
        await createNotification(getIO(), {
          userId: manager.id,
          role: manager.role,
          type: 'PR_OVER_BUDGET_DECISION_REQUIRED',
          title: template.title,
          message: template.message,
          relatedId: body.purchaseRequestId,
          relatedType: 'PR',
          metadata: { prNumber: pr.prNumber, overPercent: Math.round(overPercent * 100) / 100 },
          companyId: pr.companyId,
        });
      }

      // Send notification to BUYER_LEADER: PR vượt ngân sách cần xử lý (self-notification)
      const template = NotificationTemplates.PR_OVER_BUDGET_ACTION_REQUIRED(pr.prNumber);
      await createNotification(getIO(), {
        userId: userId,
        role: 'BUYER_LEADER',
        type: 'PR_OVER_BUDGET_ACTION_REQUIRED',
        title: template.title,
        message: template.message,
        relatedId: body.purchaseRequestId,
        relatedType: 'PR',
        metadata: { prNumber: pr.prNumber },
        companyId: pr.companyId,
      });

      // Audit log
      await auditCreate('budget_exceptions', exception.id, exception, { userId, companyId: exception.companyId ?? undefined });
      await auditCreate('supplier_selections', selection.id, selection, { userId, companyId: selection.companyId ?? undefined });

      reply.send({
        message: 'Supplier selected, but PR requires Branch Manager approval due to over-budget',
        isOverBudget: true,
        overBudgetInfo: {
          prAmount,
          purchaseAmount,
          overAmount: purchaseAmount - prAmount,
          overPercent: Math.round(overPercent * 100) / 100,
        },
        selection: {
          id: selection.id,
          prId: selection.purchaseRequestId,
          quotationId: selection.quotationId,
          supplier: firstQuotation?.supplier ?? (await prisma.quotation.findUnique({ where: { id: selection.quotationId }, include: { supplier: true } }))?.supplier ?? null,
          selectionReason: selection.selectionReason,
        },
        budgetException: {
          id: exception.id,
          status: exception.status,
        },
      });
      return;
    }

    // Normal case: No over-budget – đóng RFQ(s) và tổng hợp PR status
    const rfqIdsToClose = new Set<string>();
    if (firstQuotation?.rfqId) rfqIdsToClose.add(firstQuotation.rfqId);
    for (const sel of selectionsToCreate) {
      const q = await prisma.quotation.findUnique({ where: { id: sel.quotationId }, select: { rfqId: true } });
      if (q?.rfqId) rfqIdsToClose.add(q.rfqId);
    }
    for (const rfqId of rfqIdsToClose) {
      const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { notes: true } });
      let itemIds: string[] = [];
      if (rfq?.notes) {
        const match = rfq.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            itemIds = Array.isArray(parsed?.itemIds) ? parsed.itemIds : [];
          } catch (_) {}
        }
      }
      const selectedForRfq = await prisma.supplierSelection.count({
        where: { purchaseRequestId: body.purchaseRequestId, purchaseRequestItemId: { in: itemIds } },
      });
      if (itemIds.length > 0 && selectedForRfq >= itemIds.length) {
        await prisma.rFQ.update({ where: { id: rfqId }, data: { status: 'CLOSED' } });
      }
    }

    if (!isOverBudget) {
      const allItems = await prisma.purchaseRequestItem.findMany({
        where: { purchaseRequestId: body.purchaseRequestId, deletedAt: null },
        select: { status: true, departmentItemOutcome: true } as any,
      });
      const aggregatedStatus = computePRStatusFromItemStatuses(
        allItems
          .filter((i) =>
            itemDepartmentOutcomeAllowsProcurement(
              (i as unknown as { departmentItemOutcome: string | null }).departmentItemOutcome
            )
          )
          .map((i) => (i as unknown as { status: string }).status)
      );
      if (aggregatedStatus) {
        const updateData: { status: string; supplierId?: string } = { status: aggregatedStatus };
        if (aggregatedStatus === 'RFQ_COMPLETED') {
          let supplierIdOut: string | undefined = firstQuotation?.supplierId ?? undefined;
          if (!supplierIdOut && selectionsToCreate.length > 0) {
            const q0 = await prisma.quotation.findUnique({
              where: { id: selectionsToCreate[0].quotationId },
              select: { supplierId: true },
            });
            supplierIdOut = q0?.supplierId ?? undefined;
          }
          if (supplierIdOut) updateData.supplierId = supplierIdOut;
        }
        await prisma.purchaseRequest.update({
          where: { id: body.purchaseRequestId },
          data: updateData as Parameters<typeof prisma.purchaseRequest.update>[0]['data'],
        });
      }
    }

    const quotationForReply = await prisma.quotation.findUnique({
      where: { id: selection.quotationId },
      include: { supplier: true },
    });

    await auditCreate('supplier_selections', selection.id, selection, { userId, companyId: selection.companyId ?? undefined });

    reply.send({
      message: 'Supplier selected successfully',
      selection: {
        id: selection.id,
        prId: selection.purchaseRequestId,
        quotationId: selection.quotationId,
        supplier: quotationForReply?.supplier ?? null,
        selectionReason: selection.selectionReason,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('Select supplier validation error:', {
        issues: error.errors,
        rawBody: request.body,
      });
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return reply.code(409).send({
        error: 'Dòng PR đã được ghi nhận chọn NCC trước đó (trùng khóa duy nhất). Vui lòng tải lại trang và thử lại.',
      });
    }
    console.error('Select supplier error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/** Compare/Award workspace — client đã áp dụng bản đồ lựa chọn cục bộ; server chỉ xác nhận RFQ tồn tại (tránh 404). */
export const optimizeAwardStrategy = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const { rfqId } = request.params as { rfqId: string };
    optimizeAwardBodySchema.parse(request.body);

    const rfq = await prisma.rFQ.findFirst({
      where: { id: rfqId, deletedAt: null },
      select: { id: true, rfqNumber: true },
    });
    if (!rfq) {
      return reply.code(404).send({ error: 'RFQ không tồn tại' });
    }

    return reply.send({ ok: true, rfqNumber: rfq.rfqNumber });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('optimizeAwardStrategy error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Workspace So sánh & trao thầu: Buyer Leader nhấn «Duyệt» → ghi SupplierSelection như POST /supplier-selections (theo-từng-dòng).
 * URL dùng rfqId; body chứa selections: { [purchaseRequestItemId]: quotationId }.
 */
export const approveAwardDecision = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  const userId = request.user?.userId;
  if (!userId) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  try {
    const { rfqId } = request.params as { rfqId: string };
    const bodyIn = approveAwardBodySchema.parse(request.body);

    const rfqRow = await prisma.rFQ.findFirst({
      where: { id: rfqId, deletedAt: null },
      include: {
        purchaseRequest: {
          include: {
            items: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } },
          },
        },
      },
    });

    if (!rfqRow) {
      return reply.code(404).send({ error: 'RFQ không tồn tại' });
    }

    const prId = rfqRow.purchaseRequestId;
    let rfqItemIds: string[] | null = null;
    if (rfqRow.notes) {
      const match = rfqRow.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.itemIds && Array.isArray(parsed.itemIds) && parsed.itemIds.length > 0) {
            rfqItemIds = parsed.itemIds as string[];
          }
        } catch {
          /* ignore */
        }
      }
    }

    const targetItems = rfqItemIds
      ? rfqRow.purchaseRequest.items.filter((item) => rfqItemIds!.includes(item.id))
      : rfqRow.purchaseRequest.items;

    if (targetItems.length === 0) {
      return reply.code(400).send({ error: 'RFQ không có dòng PR để trao thầu' });
    }

    const selectionsToCreate: { purchaseRequestItemId: string; quotationId: string }[] = [];

    for (const item of targetItems) {
      const qid = bodyIn.selections[item.id];
      if (!qid || !String(qid).trim()) {
        return reply.code(400).send({
          error: `Thiếu nhà cung cấp (báo giá) cho dòng ${item.lineNo}`,
        });
      }

      const itemRow = await prisma.purchaseRequestItem.findFirst({
        where: { id: item.id, purchaseRequestId: prId, deletedAt: null },
      });
      if (!itemRow) {
        return reply.code(400).send({ error: `Dòng PR không hợp lệ (line ${item.lineNo})` });
      }

      const quotation = await prisma.quotation.findFirst({
        where: { id: qid, rfqId, deletedAt: null },
        include: { rfq: true },
      });
      if (!quotation || quotation.rfq.purchaseRequestId !== prId) {
        return reply.code(400).send({ error: 'Báo giá không thuộc RFQ/PR này' });
      }

      const qi = await prisma.quotationItem.findFirst({
        where: { quotationId: qid, purchaseRequestItemId: item.id, deletedAt: null },
      });
      if (!qi) {
        return reply.code(400).send({
          error: `Báo giá đã chọn không có đủ dòng khớp dòng PR thứ ${item.lineNo}`,
        });
      }

      const existingList = await prisma.supplierSelection.findMany({
        where: { purchaseRequestId: prId, purchaseRequestItemId: item.id },
        take: 1,
      });
      if (existingList.length > 0) {
        return reply.code(400).send({
          error: 'Một hoặc nhiều dòng PR đã được chọn NCC — không duyệt lại được trên cùng lô',
        });
      }

      selectionsToCreate.push({ purchaseRequestItemId: item.id, quotationId: qid });
    }

    const prAmount = rfqRow.purchaseRequest.totalAmount ? Number(rfqRow.purchaseRequest.totalAmount) : 0;
    let totalSelected = 0;
    for (const sel of selectionsToCreate) {
      const qiRow = await prisma.quotationItem.findFirst({
        where: { quotationId: sel.quotationId, purchaseRequestItemId: sel.purchaseRequestItemId, deletedAt: null },
      });
      if (qiRow) totalSelected += Number(qiRow.totalPrice || 0);
    }

    const isOverBudget = prAmount > 0 && totalSelected > prAmount;
    const selectionReason =
      (bodyIn.justification && bodyIn.justification.trim()) ||
      'Buyer Leader đã duyệt tra thầu sau so sánh báo giá.';
    const overBudgetReason = isOverBudget ? selectionReason : undefined;

    if (isOverBudget && (!overBudgetReason || !overBudgetReason.trim())) {
      return reply.code(400).send({
        error: 'Lý do đề xuất vượt ngân sách là bắt buộc',
        overBudgetInfo: {
          prAmount,
          purchaseAmount: totalSelected,
          overAmount: totalSelected - prAmount,
          overPercent: prAmount ? ((totalSelected - prAmount) / prAmount) * 100 : 0,
        },
      });
    }

    const parsedSelectBody = selectSupplierSchema.parse({
      purchaseRequestId: prId,
      selectionReason,
      overBudgetReason,
      selections: selectionsToCreate,
    });

    return selectSupplier(request, reply, { parsedBody: parsedSelectBody });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('approveAwardDecision error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Get Over-Budget PRs
export const getOverBudgetPRs = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { status } = request.query as { status?: string };

    // Filter PRs by budget exception statuses
    const where: any = {
      status: {
        in: ['BUDGET_EXCEPTION', 'BUDGET_APPROVED', 'BUDGET_REJECTED'],
      },
      deletedAt: null,
    };

    // Filter by specific status if provided
    if (status && status !== 'all') {
      if (status === 'pending') {
        where.status = 'BUDGET_EXCEPTION';
      } else if (status === 'approved') {
        where.status = 'BUDGET_APPROVED';
      } else if (status === 'rejected') {
        where.status = 'BUDGET_REJECTED';
      }
    }

    const prs = await prisma.purchaseRequest.findMany({
      where,
      include: {
        requestor: {
          select: {
            username: true,
            email: true,
            department: true,
          },
        },
        supplier: {
          select: {
            name: true,
            code: true,
          },
        },
        budgetExceptions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            branchManager: {
              select: {
                username: true,
              },
            },
          },
        },
        rfqs: {
          include: {
            quotations: {
              where: {
                status: 'SELECTED',
                deletedAt: null,
              },
              take: 1,
            },
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 100,
    });

    const mappedPRs = prs.map((pr) => {
      const budgetException = pr.budgetExceptions[0];
      const selectedQuotation = pr.rfqs[0]?.quotations[0];
      
      // Calculate over-budget info
      const prAmount = pr.totalAmount ? Number(pr.totalAmount) : 0;
      const purchaseAmount = selectedQuotation 
        ? Number(selectedQuotation.totalAmount)
        : budgetException
          ? Number(budgetException.purchaseAmount)
          : prAmount;
      
      const overAmount = purchaseAmount - prAmount;
      const overPercent = prAmount > 0 ? ((overAmount / prAmount) * 100) : 0;

      // Map status to Vietnamese
      let statusLabel = 'Chờ GĐ CN';
      let statusColor = 'amber';
      if (pr.status === 'BUDGET_APPROVED') {
        statusLabel = 'Đã duyệt';
        statusColor = 'green';
      } else if (pr.status === 'BUDGET_REJECTED') {
        statusLabel = 'Bị từ chối';
        statusColor = 'red';
      }

      return {
        id: pr.id,
        prNumber: pr.prNumber,
        department: pr.department,
        requestor: pr.requestor,
        supplier: pr.supplier,
        prAmount,
        purchaseAmount,
        overAmount,
        overPercent: Math.round(overPercent * 100) / 100,
        currency: pr.currency,
        status: pr.status,
        statusLabel,
        statusColor,
        budgetException: budgetException ? {
          id: budgetException.id,
          status: budgetException.status,
          action: budgetException.action,
          comment: budgetException.comment,
          branchManager: budgetException.branchManager?.username,
          createdAt: budgetException.createdAt.toISOString(),
        } : null,
        createdAt: pr.createdAt.toISOString(),
        updatedAt: pr.updatedAt.toISOString(),
        salesOrder: serializePRSalesOrder(pr),
      };
    });

    reply.send({ prs: mappedPRs });
  } catch (error: any) {
    console.error('Get over-budget PRs error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get RFQ Monitoring - RFQ đang mở, chờ đủ báo giá, quá hạn
// Get RFQs suitable for comparison/supplier selection (rich dropdown data)
export const getRFQsForComparison = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const now = new Date();
    const DEADLINE_DAYS = 7;

    // Debug: đếm từng bước lọc để tìm nguyên nhân danh sách trống
    const [countByStatus, countWithPrAndAssignment, countWithQuotation] = await Promise.all([
      prisma.rFQ.count({ where: { deletedAt: null, status: { in: ['SENT', 'QUOTATION_RECEIVED', 'READY_FOR_COMPARISON'] } } }),
      prisma.rFQ.count({
        where: {
          deletedAt: null,
          status: { in: ['SENT', 'QUOTATION_RECEIVED', 'READY_FOR_COMPARISON'] },
          purchaseRequest: {
            deletedAt: null,
            status: { notIn: ['SUPPLIER_SELECTED', 'BUDGET_EXCEPTION', 'BUDGET_APPROVED', 'BUDGET_REJECTED', 'PAYMENT_DONE', 'CANCELLED'] },
            assignments: { some: { deletedAt: null } },
          },
        },
      }),
      prisma.rFQ.count({
        where: {
          deletedAt: null,
          status: { in: ['SENT', 'QUOTATION_RECEIVED', 'READY_FOR_COMPARISON'] },
          purchaseRequest: {
            deletedAt: null,
            status: { notIn: ['SUPPLIER_SELECTED', 'BUDGET_EXCEPTION', 'BUDGET_APPROVED', 'BUDGET_REJECTED', 'PAYMENT_DONE', 'CANCELLED'] },
            assignments: { some: { deletedAt: null } },
          },
          quotations: { some: { deletedAt: null } },
        },
      }),
    ]);
    console.log('[getRFQsForComparison] debug counts:', {
      rfqStatusOk: countByStatus,
      afterPrAndAssignment: countWithPrAndAssignment,
      afterAnyQuotation: countWithQuotation,
    });

    const rfqs = await prisma.rFQ.findMany({
      where: {
        deletedAt: null,
        status: { in: ['SENT', 'QUOTATION_RECEIVED', 'READY_FOR_COMPARISON'] },
        purchaseRequest: {
          deletedAt: null,
          status: { notIn: ['SUPPLIER_SELECTED', 'BUDGET_EXCEPTION', 'BUDGET_APPROVED', 'BUDGET_REJECTED', 'PAYMENT_DONE', 'CANCELLED'] },
          assignments: { some: { deletedAt: null } },
        },
        quotations: { some: { deletedAt: null } },
      },
      include: {
        buyer: { select: { id: true, username: true, email: true } },
        purchaseRequest: {
          select: {
            id: true,
            prNumber: true,
            totalAmount: true,
            currency: true,
            status: true,
            requiredDate: true,
            purpose: true,
            department: true,
            createdAt: true,
            items: {
              where: { deletedAt: null },
              select: { id: true, unitPrice: true, qty: true },
            },
          },
        },
        quotations: {
          where: { deletedAt: null, status: { in: ['PENDING', 'VALID', 'SELECTED'] } },
          select: { id: true, totalAmount: true, supplierId: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const mapped = rfqs.map((rfq) => {
      const daysSinceSent = rfq.sentDate
        ? Math.floor((now.getTime() - rfq.sentDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const isOverdue = rfq.status === 'SENT' && daysSinceSent !== null && daysSinceSent > DEADLINE_DAYS;
      const daysOverdue = isOverdue && daysSinceSent !== null ? daysSinceSent - DEADLINE_DAYS : 0;
      const deadlineDate = rfq.sentDate
        ? new Date(rfq.sentDate.getTime() + DEADLINE_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const daysLeft = deadlineDate && !isOverdue && rfq.status === 'SENT' && daysSinceSent !== null
        ? DEADLINE_DAYS - daysSinceSent : null;

      const quotationsCount = rfq.quotations.length;
      const totalAmounts = rfq.quotations
        .map((q) => (q.totalAmount ? Number(q.totalAmount) : 0))
        .filter((a) => a > 0);
      const minAmount = totalAmounts.length ? Math.min(...totalAmounts) : null;
      const maxAmount = totalAmounts.length ? Math.max(...totalAmounts) : null;

      // Baseline total = sum of (prItem.unitPrice × qty) for all PR items
      const prItems = (rfq.purchaseRequest as any).items || [];
      const baselineTotal = prItems.reduce((sum: number, item: any) => {
        return sum + (Number(item.unitPrice || 0) * Number(item.qty || 0));
      }, 0);

      // Last quotation submission date
      const lastQuotationDate = rfq.quotations.length > 0
        ? rfq.quotations[0].updatedAt.toISOString()
        : null;

      // Budget status: compare best (min) quotation vs baseline
      const budgetStatus = baselineTotal > 0 && minAmount !== null
        ? (minAmount > baselineTotal ? 'OVER' : 'OK')
        : 'UNKNOWN';

      return {
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
        status: rfq.status,
        buyer: rfq.buyer,
        prId: rfq.purchaseRequest.id,
        prNumber: rfq.purchaseRequest.prNumber,
        prStatus: rfq.purchaseRequest.status,
        prTotalAmount: rfq.purchaseRequest.totalAmount ? Number(rfq.purchaseRequest.totalAmount) : null,
        prCurrency: rfq.purchaseRequest.currency || 'VND',
        prPurpose: rfq.purchaseRequest.purpose || null,
        prDepartment: rfq.purchaseRequest.department || null,
        quotationsCount,
        minAmount,
        maxAmount,
        baselineTotal: baselineTotal > 0 ? baselineTotal : null,
        budgetStatus,
        lastQuotationDate,
        deadlineDate,
        daysLeft,
        daysOverdue,
        isOverdue,
        createdAt: rfq.createdAt.toISOString(),
        closed: false,
      };
    });

    // RFQ đã đóng (đã chọn NCC hoặc bị thay thế) — hiển thị để Leader vẫn thấy, không "mất"
    let closedMapped: any[] = [];
    try {
      // Lấy tất cả RFQ đã đóng (cho mọi PR) để Leader vẫn xem được lịch sử
      const closedRfqs = await prisma.rFQ.findMany({
        where: {
          deletedAt: null,
          status: 'CLOSED',
        },
        include: {
          buyer: { select: { id: true, username: true, email: true } },
          purchaseRequest: {
            select: {
              id: true,
              prNumber: true,
              totalAmount: true,
              currency: true,
              status: true,
              purpose: true,
              department: true,
              items: { where: { deletedAt: null }, select: { id: true, unitPrice: true, qty: true } },
            },
          },
          quotations: {
            where: { deletedAt: null },
            select: { id: true, totalAmount: true, updatedAt: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });

      closedMapped = closedRfqs.map((rfq) => {
        const prItems = (rfq.purchaseRequest as any).items || [];
        const baselineTotal = prItems.reduce(
          (sum: number, item: any) => sum + (Number(item.unitPrice || 0) * Number(item.qty || 0)),
          0
        );
        const sortedQuotations = [...rfq.quotations].sort(
          (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)
        );
        const totalAmounts = rfq.quotations.map((q) => Number(q.totalAmount || 0)).filter((a) => a > 0);
        const minAmount = totalAmounts.length ? Math.min(...totalAmounts) : null;
        const lastQuotationDate =
          sortedQuotations.length > 0 ? sortedQuotations[0].updatedAt.toISOString() : null;
        const budgetStatus =
          baselineTotal > 0 && minAmount !== null ? (minAmount > baselineTotal ? 'OVER' : 'OK') : 'UNKNOWN';

        return {
          id: rfq.id,
          rfqNumber: rfq.rfqNumber,
          status: rfq.status,
          buyer: rfq.buyer,
          prId: rfq.purchaseRequest.id,
          prNumber: rfq.purchaseRequest.prNumber,
          prStatus: rfq.purchaseRequest.status,
          prTotalAmount: rfq.purchaseRequest.totalAmount
            ? Number(rfq.purchaseRequest.totalAmount)
            : null,
          prCurrency: rfq.purchaseRequest.currency || 'VND',
          prPurpose: rfq.purchaseRequest.purpose || null,
          prDepartment: rfq.purchaseRequest.department || null,
          quotationsCount: rfq.quotations.length,
          minAmount,
          maxAmount: totalAmounts.length ? Math.max(...totalAmounts) : null,
          baselineTotal: baselineTotal > 0 ? baselineTotal : null,
          budgetStatus,
          lastQuotationDate,
          deadlineDate: null,
          daysLeft: null,
          daysOverdue: 0,
          isOverdue: false,
          createdAt: rfq.createdAt.toISOString(),
          closed: true,
        };
      });
    } catch (err: any) {
      console.error('Get closed RFQs for comparison error:', err?.message || err);
      closedMapped = [];
    }

    console.log(`[getRFQsForComparison] open: ${mapped.length}, closed: ${closedMapped.length}`);
    return reply.code(200).send({ rfqs: mapped, closedRfqs: closedMapped });
  } catch (error: any) {
    console.error('Get RFQs for comparison error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

export const getRFQMonitoring = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { filter } = request.query as { filter?: 'open' | 'waiting_quotations' | 'overdue' | 'all' };

    // Get all RFQs that are assigned to buyers (through PR assignments)
    // Buyer Leader can see all RFQs from PRs that have been assigned
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago for overdue check

    // Buyer Leader có thể xem tất cả RFQ từ các PR đã được assign
    // Lưu ý: RFQ được tạo từ PR đã assign, nên điều kiện này đảm bảo chỉ lấy RFQ hợp lệ
    const where: any = {
      deletedAt: null,
      purchaseRequest: {
        deletedAt: null,
        assignments: {
          some: {
            deletedAt: null,
          },
        },
      },
    };

    console.log(`[getRFQMonitoring] Filter: ${filter || 'undefined'}, UserId: ${userId}`);
    console.log(`[getRFQMonitoring] Where clause (before status filter):`, JSON.stringify(where, null, 2));

    // Filter by RFQ status
    if (filter === 'open') {
      where.status = 'SENT';
      // Exclude overdue ones (will filter after mapping)
    } else if (filter === 'waiting_quotations') {
      where.status = 'SENT';
      // RFQ chờ đủ báo giá: đã SENT nhưng chưa có đủ quotations (check after mapping)
    } else if (filter === 'overdue') {
      where.status = 'SENT';
      where.sentDate = { lt: sevenDaysAgo }; // Sent more than 7 days ago
    } else if (filter === 'all') {
      // Bao gồm tất cả status bao gồm DRAFT
      where.status = { in: ['DRAFT', 'SENT', 'QUOTATION_RECEIVED', 'READY_FOR_COMPARISON', 'CLOSED'] };
    } else {
      // Default: bao gồm tất cả status để Buyer Leader có thể giám sát toàn bộ
      where.status = { in: ['DRAFT', 'SENT', 'QUOTATION_RECEIVED', 'READY_FOR_COMPARISON', 'CLOSED'] };
    }

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
            createdAt: true,
          items: {
              where: { deletedAt: null },
              select: {
                id: true,
                lineNo: true,
                unitPrice: true,
                amount: true,
                qty: true,
                estimatedUnitPriceVnd: true,
              },
            },
          },
        },
        buyer: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        quotations: {
          where: { 
            deletedAt: null,
            // Chỉ đếm quotations hợp lệ (đồng bộ với compareQuotations)
            status: {
              in: ['PENDING', 'VALID', 'SELECTED'],
            },
          },
          select: {
            id: true,
            supplier: {
              select: {
                name: true,
              },
            },
            totalAmount: true,
            status: true,
            createdAt: true,
            items: {
              select: {
                id: true,
                purchaseRequestItemId: true,
                lineNo: true,
                unitPrice: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Sắp xếp theo ngày tạo để RFQ mới nhất lên đầu
      },
      take: 200,
    });

    console.log(`[getRFQMonitoring] Found ${rfqs.length} RFQs before filtering`);
    if (rfqs.length === 0) {
      console.log(`[getRFQMonitoring] No RFQs found. Checking if there are any RFQs in database...`);
      // Debug query: Check total RFQs without filters
      const totalRFQs = await prisma.rFQ.count({
        where: { deletedAt: null },
      });
      console.log(`[getRFQMonitoring] Total RFQs in database (not deleted): ${totalRFQs}`);
      
      // Check RFQs with assignments
      const rfqsWithAssignments = await prisma.rFQ.count({
        where: {
          deletedAt: null,
          purchaseRequest: {
            deletedAt: null,
            assignments: {
              some: {
                deletedAt: null,
              },
            },
          },
        },
      });
      console.log(`[getRFQMonitoring] RFQs with assignments: ${rfqsWithAssignments}`);
    }

    // Import computeQuotationBaseline để tính toán baseline
    const { computeQuotationBaseline } = await import('../utils/baseline');

    /** Đơn giá baseline dòng PR — đồng bộ với rfqController (ưu tiên estimatedUnitPriceVnd). */
    const resolveBaselineUnitForMonitoring = (item: {
      unitPrice?: unknown | null;
      estimatedUnitPriceVnd?: unknown | null;
    }): number | null => {
      const est = Number(item.estimatedUnitPriceVnd ?? 0);
      if (Number.isFinite(est) && est > 0) return est;
      const u = Number(item.unitPrice ?? 0);
      return Number.isFinite(u) && u > 0 ? u : null;
    };

    /** Tổng giá trị PR ước tính từ các dòng khi totalAmount header trống. */
    const sumPrLineTotalsForMonitoring = (
      items: Array<{
        qty?: unknown;
        unitPrice?: unknown | null;
        amount?: unknown | null;
        estimatedUnitPriceVnd?: unknown | null;
      }>
    ): number => {
      let sum = 0;
      for (const item of items) {
        const direct = Number(item.amount ?? 0);
        if (Number.isFinite(direct) && direct > 0) {
          sum += direct;
          continue;
        }
        const qty = Number(item.qty ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        const unit = resolveBaselineUnitForMonitoring(item);
        if (unit != null && unit > 0) sum += qty * unit;
      }
      return sum;
    };

    // Map RFQs with monitoring info
    const mappedRFQs = rfqs.map((rfq) => {
      const quotationsCount = rfq.quotations.length;
      const daysSinceSent = rfq.sentDate
        ? Math.floor((now.getTime() - rfq.sentDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      // Tính toán itemCount từ notes
      let itemCount = 0;
      if (rfq.notes) {
        const match = rfq.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            if (parsed.itemIds && Array.isArray(parsed.itemIds)) {
              itemCount = parsed.itemIds.length;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      
      // Nếu không có itemCount từ notes, dùng số items từ PR
      if (itemCount === 0 && rfq.purchaseRequest.items) {
        itemCount = rfq.purchaseRequest.items.length;
      }

      // Tính toán hasOverBaseline: kiểm tra xem có quotation nào vượt baseline không
      let hasOverBaseline = false;
      if (rfq.quotations.length > 0 && rfq.purchaseRequest.items && rfq.purchaseRequest.items.length > 0) {
        // Baseline đơn giá: có estimatedUnitPriceVnd hoặc unitPrice (>0)
        const prItemsBaseline = rfq.purchaseRequest.items
          .map((item: any) => {
            const unitPx = resolveBaselineUnitForMonitoring(item);
            if (unitPx == null || !(unitPx > 0)) return null;
            return {
              id: item.id,
              lineNo: item.lineNo,
              unitPrice: unitPx,
              amount: item.amount != null ? Number(item.amount) : null,
              qty: Number(item.qty) || 0,
            };
          })
          .filter(Boolean) as import('../utils/baseline').PRItemBaseline[];

        // Debug: Log PR items baseline
        console.log(`[getRFQMonitoring] RFQ ${rfq.rfqNumber} - PR items baseline (có unitPrice):`, 
          prItemsBaseline.map((p: any) => ({ id: p.id, unitPrice: p.unitPrice })));
        console.log(`[getRFQMonitoring] RFQ ${rfq.rfqNumber} - Tổng PR items: ${rfq.purchaseRequest.items.length}, Items có unitPrice: ${prItemsBaseline.length}`);
        
        // Nếu không có PR items nào có unitPrice, không thể kiểm tra baseline
        if (prItemsBaseline.length === 0) {
          console.log(`[getRFQMonitoring] RFQ ${rfq.rfqNumber} - Không có PR items nào có unitPrice để so sánh baseline`);
        }

        // Kiểm tra từng quotation
        for (const quotation of rfq.quotations) {
          if (quotation.items && quotation.items.length > 0) {
            // Lọc quotation items có purchaseRequestItemId để có thể so sánh với PR items
            const quotationItems = quotation.items
              .filter((it: any) => it.purchaseRequestItemId != null) // Chỉ lấy items có link với PR item
              .map((it: any) => ({
                purchaseRequestItemId: it.purchaseRequestItemId,
                unitPrice: Number(it.unitPrice) || 0,
                lineNo: it.lineNo,
              }));
            
            // Nếu không có quotation items nào có purchaseRequestItemId, skip
            if (quotationItems.length === 0) {
              console.log(`[getRFQMonitoring] RFQ ${rfq.rfqNumber} - Quotation ${quotation.id} has no items with purchaseRequestItemId`);
              continue;
            }
            
            // Nếu không có PR items baseline để so sánh, skip
            if (prItemsBaseline.length === 0) {
              console.log(`[getRFQMonitoring] RFQ ${rfq.rfqNumber} - Quotation ${quotation.id} không thể so sánh: không có PR items có unitPrice`);
              continue;
            }
            
            // Debug: Log quotation items
            console.log(`[getRFQMonitoring] RFQ ${rfq.rfqNumber} - Quotation ${quotation.id} items (có purchaseRequestItemId):`, 
              quotationItems.map((q: any) => ({ 
                purchaseRequestItemId: q.purchaseRequestItemId, 
                unitPrice: q.unitPrice 
              })));
            
            const baselineResult = computeQuotationBaseline(prItemsBaseline, quotationItems);
            
            // Debug: Log baseline result chi tiết
            console.log(`[getRFQMonitoring] RFQ ${rfq.rfqNumber} - Quotation ${quotation.id} baseline result:`, {
              overBaseline: baselineResult.overBaseline,
              itemsChecked: baselineResult.items.length,
              itemsOverBaseline: baselineResult.items.filter((i: any) => i.overBaseline).length,
              itemsDetail: baselineResult.items.map((i: any) => ({
                prItemId: i.purchaseRequestItemId,
                baseline: i.baselineUnitPrice,
                quotation: i.quotationUnitPrice,
                over: i.overBaseline
              }))
            });
            
            if (baselineResult.overBaseline) {
              hasOverBaseline = true;
              console.log(`[getRFQMonitoring] ⚠️ RFQ ${rfq.rfqNumber} - DETECTED OVER BASELINE! Quotation ${quotation.id}`);
              break; // Chỉ cần 1 quotation vượt baseline là đủ
            }
          } else {
            console.log(`[getRFQMonitoring] RFQ ${rfq.rfqNumber} - Quotation ${quotation.id} has no items`);
          }
        }
      } else {
        console.log(`[getRFQMonitoring] RFQ ${rfq.rfqNumber} - Cannot check baseline: quotations=${rfq.quotations.length}, prItems=${rfq.purchaseRequest.items?.length || 0}`);
      }

      const DEADLINE_DAYS = 7; // Default deadline: 7 days from sentDate
      const isOverdue = rfq.status === 'SENT' && daysSinceSent !== null && daysSinceSent > DEADLINE_DAYS;
      const daysOverdue = isOverdue && daysSinceSent !== null ? daysSinceSent - DEADLINE_DAYS : 0;
      const deadlineDate = rfq.sentDate
        ? new Date(rfq.sentDate.getTime() + DEADLINE_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const daysLeft = rfq.sentDate && !isOverdue && rfq.status === 'SENT' && daysSinceSent !== null
        ? DEADLINE_DAYS - daysSinceSent
        : null;

      // Cycle time: days from PR created to RFQ created
      const daysPRtoRFQ = rfq.purchaseRequest.createdAt
        ? Math.floor((rfq.createdAt.getTime() - rfq.purchaseRequest.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // Cycle time: days from RFQ created to submit (updatedAt when READY_FOR_COMPARISON)
      const daysRFQtoSubmit = (rfq.status === 'READY_FOR_COMPARISON' || rfq.status === 'CLOSED')
        ? Math.floor((rfq.updatedAt.getTime() - rfq.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const isWaitingQuotations = rfq.status === 'SENT' && quotationsCount < 2; // Chờ đủ ít nhất 2 báo giá
      const isReadyForComparison = rfq.status === 'READY_FOR_COMPARISON'; // Buyer đã hoàn thành, sẵn sàng so sánh
      const isCompleted = rfq.status === 'READY_FOR_COMPARISON' || rfq.status === 'CLOSED'; // Đã hoàn tất

      // Trạng thái chi tiết cho Buyer Leader
      let statusDetail = '';
      if (isCompleted) {
        statusDetail = 'Đã hoàn tất';
      } else if (isReadyForComparison) {
        statusDetail = 'Sẵn sàng so sánh';
      } else if (isWaitingQuotations) {
        statusDetail = 'Đang nhập báo giá';
      } else if (quotationsCount === 0) {
        statusDetail = 'Chưa có báo giá';
      } else {
        statusDetail = 'Đang nhập báo giá';
      }

      return {
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
        statusDetail,
        isReadyForComparison,
        isCompleted,
        prNumber: rfq.purchaseRequest.prNumber,
        prId: rfq.purchaseRequest.id,
        department: rfq.purchaseRequest.department,
        prStatus: rfq.purchaseRequest.status,
        status: rfq.status,
        buyer: {
          id: rfq.buyer.id,
          username: rfq.buyer.username,
          email: rfq.buyer.email,
        },
        quotationsCount,
        quotations: rfq.quotations.map((q: any) => ({
          id: q.id,
          supplierName: q.supplier.name,
          totalAmount: Number(q.totalAmount),
          status: q.status,
          receivedDate: q.createdAt.toISOString(),
        })),
        sentDate: rfq.sentDate?.toISOString() || null,
        daysSinceSent,
        deadlineDate,
        daysLeft,
        daysOverdue,
        isOverdue,
        isWaitingQuotations,
        notes: rfq.notes,
        itemCount: itemCount,
        hasOverBaseline: hasOverBaseline,
        prTotalAmount: (() => {
          const header = rfq.purchaseRequest.totalAmount != null ? Number(rfq.purchaseRequest.totalAmount) : null;
          if (header != null && Number.isFinite(header) && header > 0) {
            return header;
          }
          const summed = sumPrLineTotalsForMonitoring(rfq.purchaseRequest.items ?? []);
          return summed > 0 ? Math.round(summed * 100) / 100 : null;
        })(),
        prCurrency: rfq.purchaseRequest.currency || 'VND',
        daysPRtoRFQ,
        daysRFQtoSubmit,
        createdAt: rfq.createdAt.toISOString(),
        updatedAt: rfq.updatedAt.toISOString(),
      };
    });

    // Filter after mapping to check quotations count and exclude overdue from 'open'
    let filteredRFQs = mappedRFQs;
    if (filter === 'waiting_quotations') {
      filteredRFQs = mappedRFQs.filter((rfq) => rfq.isWaitingQuotations);
    } else if (filter === 'overdue') {
      filteredRFQs = mappedRFQs.filter((rfq) => rfq.isOverdue);
    } else if (filter === 'open') {
      // Open RFQs: SENT but not overdue and not waiting for quotations
      filteredRFQs = mappedRFQs.filter(
        (rfq) => rfq.status === 'SENT' && !rfq.isOverdue && !rfq.isWaitingQuotations
      );
    }

    console.log(`[getRFQMonitoring] Returning ${filteredRFQs.length} RFQs after filtering`);
    
    // Log sample RFQ để debug
    if (filteredRFQs.length > 0) {
      console.log(`[getRFQMonitoring] Sample RFQ:`, {
        id: filteredRFQs[0].id,
        rfqNumber: filteredRFQs[0].rfqNumber,
        status: filteredRFQs[0].status,
        prNumber: filteredRFQs[0].prNumber,
        buyer: filteredRFQs[0].buyer.username,
        quotationsCount: filteredRFQs[0].quotationsCount,
      });
    } else {
      console.log(`[getRFQMonitoring] No RFQs found. Check query conditions.`);
      console.log(`[getRFQMonitoring] Where clause:`, JSON.stringify(where, null, 2));
    }

    // Đảm bảo response được serialize đúng
    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Encoding', 'identity');
    reply.code(200).send({ rfqs: filteredRFQs });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Get RFQ Monitoring error:', err?.message, err?.stack);
    reply.code(500).send({
      error: 'Internal server error',
      message: err?.message ?? 'Unknown error',
    });
  }
};

// Get Buyers List
export const getBuyers = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Get all active buyers (role = BUYER)
    const buyers = await prisma.user.findMany({
      where: {
        role: 'BUYER',
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        location: true,
        createdAt: true,
      },
      orderBy: {
        username: 'asc',
      },
    });

    const response = { buyers };
    return reply.code(200).send(response);
  } catch (error: any) {
    console.error('Get buyers error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get PR Details by ID
export const getPRDetails = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { prId } = request.params as { prId: string };

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: prId },
      include: {
        salesPO: { select: prSalesPOSelect },
        requestor: {
          select: {
            id: true,
            username: true,
            email: true,
            location: true,
            department: true,
          },
        },
        items: {
          where: { ...prismaPurchaseItemNeedPurchaseDepartmentActive },
          orderBy: { lineNo: 'asc' },
        },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    const response = {
      id: pr.id,
      prNumber: pr.prNumber,
      salesOrder: serializePRSalesOrder(pr),
      department: pr.department || '',
      requiredDate: pr.requiredDate ? pr.requiredDate.toISOString() : null,
      purpose: pr.purpose || null,
      status: pr.status,
      notes: pr.notes || null,
      totalAmount: (() => {
        const calculatedTotal = (pr.items || []).reduce((sum, item: any) => {
          const qty = Number(item.qty) || 0;
          const estimatedUnitPrice = Number(item.estimatedUnitPriceVnd) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          const effectiveUnitPrice = estimatedUnitPrice > 0 ? estimatedUnitPrice : unitPrice;
          return sum + qty * effectiveUnitPrice;
        }, 0);
        const totalAmount = pr.totalAmount ? Number(pr.totalAmount) : 0;
        return totalAmount > 0 ? totalAmount : calculatedTotal > 0 ? calculatedTotal : null;
      })(),
      currency: pr.currency || 'VND',
      tax: pr.tax ? Number(pr.tax) : null,
      requestor: pr.requestor,
      items: pr.items.map((item: any) => ({
        id: item.id,
        lineNo: item.lineNo,
        description: item.description || '',
        partNo: item.partNo || null,
        spec: item.spec || null,
        manufacturer: item.manufacturer || null,
        qty: Number(item.qty) || 0,
        unit: item.unit || null,
        unitPrice:
          Number(item.estimatedUnitPriceVnd) > 0
            ? Number(item.estimatedUnitPriceVnd)
            : item.unitPrice
              ? Number(item.unitPrice)
              : null,
        amount:
          item.amount && Number(item.amount) > 0
            ? Number(item.amount)
            : (() => {
                const qty = Number(item.qty) || 0;
                const estimated = Number(item.estimatedUnitPriceVnd) || 0;
                const unit = Number(item.unitPrice) || 0;
                const effectiveUnitPrice = estimated > 0 ? estimated : unit;
                return effectiveUnitPrice > 0 ? qty * effectiveUnitPrice : null;
              })(),
        estimatedUnitPriceVnd:
          Number(item.estimatedUnitPriceVnd) > 0 ? Number(item.estimatedUnitPriceVnd) : null,
        purpose: item.purpose || null,
        remark: item.remark || null,
        fromStockQty: item.fromStockQty ? Number(item.fromStockQty) : 0,
        purchaseQty: item.purchaseQty ? Number(item.purchaseQty) : 0,
        status: item.status || 'NEED_PURCHASE',
      })),
      createdAt: pr.createdAt.toISOString(),
      updatedAt: pr.updatedAt.toISOString(),
    };

    return reply.code(200).send(response);
  } catch (error: any) {
    console.error('Get PR details error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get RFQs for a specific PR (Buyer Leader view)
export const getPRRFQs = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { prId } = request.params as { prId: string };

    const rfqs = await prisma.rFQ.findMany({
      where: { purchaseRequestId: prId, deletedAt: null },
      include: {
        purchaseRequest: {
          select: { status: true },
        },
        buyer: {
          select: { id: true, username: true, email: true },
        },
        quotations: {
          where: { deletedAt: null },
          select: {
            id: true,
            quotationNumber: true,
            totalAmount: true,
            status: true,
            supplier: { select: { id: true, name: true, code: true } },
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const mapped = rfqs.map((rfq) => ({
      id: rfq.id,
      rfqNumber: rfq.rfqNumber,
      status: rfq.status,
      prStatus: rfq.purchaseRequest.status,
      buyer: rfq.buyer,
      quotationCount: rfq.quotations.length,
      quotations: rfq.quotations.map((q) => ({
        id: q.id,
        quotationNumber: q.quotationNumber,
        supplier: q.supplier,
        totalAmount: q.totalAmount ? Number(q.totalAmount) : null,
        status: q.status,
        createdAt: q.createdAt.toISOString(),
      })),
      createdAt: rfq.createdAt.toISOString(),
      updatedAt: rfq.updatedAt.toISOString(),
    }));

    return reply.code(200).send({ rfqs: mapped });
  } catch (error: any) {
    console.error('Get PR RFQs error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

// Remind buyer to submit RFQ
export const remindBuyerRFQ = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { rfqId } = request.params as { rfqId: string };

    const rfq = await prisma.rFQ.findUnique({
      where: { id: rfqId },
      include: {
        buyer: { select: { id: true, username: true } },
        purchaseRequest: { select: { prNumber: true } },
      },
    });
    if (!rfq) return reply.code(404).send({ error: 'RFQ not found' });

    const { createNotification } = await import('../utils/notifications');
    const { getIO } = await import('../utils/getIO');
    await createNotification(getIO(), {
      userId: rfq.buyer.id,
      role: 'BUYER',
      type: 'RFQ_REMINDER',
      title: `Nhắc nhở: RFQ ${rfq.rfqNumber} cần xử lý`,
      message: `Buyer Leader nhắc bạn cần hoàn thành và submit RFQ ${rfq.rfqNumber} (PR: ${rfq.purchaseRequest.prNumber}) sớm nhất.`,
      relatedId: rfqId,
      relatedType: 'RFQ',
      metadata: { rfqNumber: rfq.rfqNumber, prNumber: rfq.purchaseRequest.prNumber },
      companyId: rfq.companyId || null,
    });

    return reply.code(200).send({ message: `Đã gửi nhắc nhở tới Buyer ${rfq.buyer.username}` });
  } catch (error: any) {
    console.error('Remind buyer error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

// Escalate RFQ to Buyer Manager
export const escalateRFQ = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { rfqId } = request.params as { rfqId: string };
    const { reason } = (request.body as any) || {};

    const rfq = await prisma.rFQ.findUnique({
      where: { id: rfqId },
      include: {
        buyer: { select: { id: true, username: true } },
        purchaseRequest: { select: { prNumber: true } },
      },
    });
    if (!rfq) return reply.code(404).send({ error: 'RFQ not found' });

    const buyerManager = await prisma.user.findFirst({
      where: { role: 'BUYER_MANAGER', deletedAt: null },
      select: { id: true },
    });

    if (buyerManager) {
      const { createNotification } = await import('../utils/notifications');
      const { getIO } = await import('../utils/getIO');
      await createNotification(getIO(), {
        userId: buyerManager.id,
        role: 'BUYER_MANAGER',
        type: 'RFQ_ESCALATED',
        title: `Escalate: RFQ ${rfq.rfqNumber} cần chú ý`,
        message: `Buyer Leader đã escalate RFQ ${rfq.rfqNumber} (PR: ${rfq.purchaseRequest.prNumber}) - Buyer: ${rfq.buyer.username}. ${reason ? 'Lý do: ' + reason : ''}`,
        relatedId: rfqId,
        relatedType: 'RFQ',
        metadata: { rfqNumber: rfq.rfqNumber, prNumber: rfq.purchaseRequest.prNumber, buyerUsername: rfq.buyer.username, reason },
        companyId: rfq.companyId || null,
      });
    }

    return reply.code(200).send({ message: `Đã escalate RFQ ${rfq.rfqNumber} tới Buyer Manager` });
  } catch (error: any) {
    console.error('Escalate RFQ error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

// ----- Theo dõi PR & Tiến độ RFQ (Buyer Leader giám sát) -----
const DEADLINE_DAYS = 7;

/** Danh sách PR có phân công – tổng quan tiến độ Phase 2 */
export const getPRTrackingList = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const prs = await prisma.purchaseRequest.findMany({
      where: {
        deletedAt: null,
        status: {
          in: [
            'BUYER_LEADER_PENDING',
            'BRANCH_MANAGER_APPROVED',
            'ASSIGNED_TO_BUYER',
            'RFQ_IN_PROGRESS',
            'QUOTATION_RECEIVED',
            'SUPPLIER_SELECTED',
            'BUDGET_EXCEPTION',
            'BUDGET_APPROVED',
            'BUDGET_REJECTED',
          ],
        },
        assignments: { some: { deletedAt: null } },
      },
      include: {
        items: { where: { deletedAt: null }, select: { id: true, status: true } as any },
        assignments: {
          where: { deletedAt: null },
          select: { buyerId: true, scope: true, assignedItemIds: true },
        },
        rfqs: {
          where: { deletedAt: null },
          select: { id: true, sentDate: true, status: true },
        },
        budgetExceptions: {
          where: { status: { in: ['PENDING', 'APPROVED'] } },
          select: { id: true },
        },
        salesPO: { select: prSalesPOSelect },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const now = new Date();
    const list = prs.map((pr) => {
      const items = (pr.items as unknown) as { id: string; status: string }[];
      const totalItems = items.length;
      const buyerIds = new Set(pr.assignments.map((a) => a.buyerId));
      const statusCounts = { NEW: 0, ASSIGNED: 0, RFQ_CREATED: 0, RFQ_SUBMITTED: 0, READY_FOR_REVIEW: 0, SUPPLIER_SELECTED: 0 };
      items.forEach((i) => {
        const s = (i.status || 'NEW') as keyof typeof statusCounts;
        if (s in statusCounts) statusCounts[s]++;
      });
      const itemsNotInRFQ = statusCounts.NEW + statusCounts.ASSIGNED;
      const itemsSubmitted = statusCounts.RFQ_SUBMITTED + statusCounts.READY_FOR_REVIEW;
      const itemsSupplierSelected = statusCounts.SUPPLIER_SELECTED;
      const phase2Done = itemsSupplierSelected + statusCounts.READY_FOR_REVIEW;
      const phase2Percent = totalItems > 0 ? Math.round((phase2Done / totalItems) * 100) : 0;
      let overdue = false;
      for (const rfq of pr.rfqs) {
        if (rfq.status === 'SENT' && rfq.sentDate) {
          const deadline = new Date(rfq.sentDate);
          deadline.setDate(deadline.getDate() + DEADLINE_DAYS);
          if (now > deadline) {
            overdue = true;
            break;
          }
        }
      }
      return {
        prId: pr.id,
        prNumber: pr.prNumber,
        totalItems,
        buyerCount: buyerIds.size,
        phase2Percent,
        itemsNotInRFQ,
        itemsSubmitted,
        itemsSupplierSelected,
        overBudget: pr.budgetExceptions.length > 0,
        overdue,
        prStatus: pr.status,
        salesOrder: serializePRSalesOrder(pr),
      };
    });

    reply.send({ prs: list });
  } catch (error: any) {
    console.error('Get PR tracking list error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** Chi tiết một PR theo từng item – Buyer, RFQ, trạng thái, báo giá, chọn NCC, vượt giá */
export const getPRTrackingDetail = async (
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
        salesPO: { select: prSalesPOSelect },
        items: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } },
        assignments: {
          where: { deletedAt: null },
          include: { buyer: { select: { id: true, username: true, email: true } } },
        },
        rfqs: {
          where: { deletedAt: null },
          include: {
            buyer: { select: { id: true, username: true } },
            quotations: { where: { deletedAt: null }, select: { id: true, totalAmount: true } },
          },
        },
        budgetExceptions: {
          where: { status: { in: ['PENDING', 'APPROVED'] } },
          select: { id: true },
        },
      },
    });

    if (!pr) return reply.code(404).send({ error: 'PR not found' });

    const itemIdToAssignment = new Map<string, { buyer: { id: string; username: string; email: string | null } }>();
    for (const a of pr.assignments) {
      if (a.scope === 'FULL') {
        pr.items.forEach((i) => itemIdToAssignment.set(i.id, { buyer: a.buyer }));
      } else if (a.assignedItemIds) {
        try {
          const ids = JSON.parse(a.assignedItemIds) as string[];
          ids.forEach((id) => itemIdToAssignment.set(id, { buyer: a.buyer }));
        } catch (_) {}
      }
    }

    const itemIdToRfq = new Map<string, { rfqId: string; rfqNumber: string; buyerUsername: string; quotationCount: number; status: string }>();
    for (const rfq of pr.rfqs) {
      let itemIds: string[] = [];
      if (rfq.notes) {
        const m = rfq.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
        if (m) {
          try {
            const parsed = JSON.parse(m[1]);
            if (parsed?.itemIds && Array.isArray(parsed.itemIds)) itemIds = parsed.itemIds;
          } catch (_) {}
        }
      }
      const quotationCount = rfq.quotations.length;
      const row = {
        rfqId: rfq.id,
        rfqNumber: rfq.rfqNumber,
        buyerUsername: rfq.buyer.username,
        quotationCount,
        status: rfq.status,
      };
      itemIds.forEach((id) => itemIdToRfq.set(id, row));
    }

    const supplierSelections = await prisma.supplierSelection.findMany({
      where: { purchaseRequestId: prId },
      select: { quotationId: true },
    });
    const selectedQuotationIds = new Set(supplierSelections.map((s) => s.quotationId));
    const quotationToMinAmount = new Map<string, number>();
    for (const q of await prisma.quotation.findMany({
      where: { id: { in: Array.from(selectedQuotationIds) }, deletedAt: null },
      select: { id: true, totalAmount: true },
    })) {
      quotationToMinAmount.set(q.id, Number(q.totalAmount || 0));
    }

    const prTotalAmount = pr.totalAmount ? Number(pr.totalAmount) : null;
    const items = pr.items.map((item) => {
      const itemStatus = (item as any).status || 'NEW';
      const assignment = itemIdToAssignment.get(item.id);
      const rfqInfo = itemIdToRfq.get(item.id);
      const hasQuotation = (rfqInfo?.quotationCount ?? 0) > 0;
      const supplierSelected = itemStatus === 'SUPPLIER_SELECTED';
      let overBudget = false;
      if (prTotalAmount != null && supplierSelected && rfqInfo) {
        for (const q of (pr.rfqs.find((r) => r.id === rfqInfo.rfqId)?.quotations ?? []) as { id: string; totalAmount: unknown }[]) {
          if (selectedQuotationIds.has(q.id)) {
            const amt = quotationToMinAmount.get(q.id) ?? Number(q.totalAmount || 0);
            if (amt > prTotalAmount) overBudget = true;
          }
        }
      }
      return {
        itemId: item.id,
        lineNo: item.lineNo,
        description: item.description,
        partNo: item.partNo,
        qty: Number(item.qty),
        unit: item.unit,
        status: itemStatus,
        buyer: assignment?.buyer?.username ?? '-',
        rfqNumber: rfqInfo?.rfqNumber ?? '-',
        rfqId: rfqInfo?.rfqId ?? null,
        hasQuotation: hasQuotation,
        quotationCount: rfqInfo?.quotationCount ?? 0,
        supplierSelected,
        overBudget,
        rfqStatus: rfqInfo?.status ?? null,
      };
    });

    const totalItems = items.length;
    const statusCounts = { RFQ_CREATED: 0, READY_FOR_REVIEW: 0, SUPPLIER_SELECTED: 0 };
    items.forEach((i) => {
      if (i.status === 'RFQ_CREATED') statusCounts.RFQ_CREATED++;
      else if (i.status === 'READY_FOR_REVIEW' || i.status === 'RFQ_SUBMITTED') statusCounts.READY_FOR_REVIEW++;
      else if (i.status === 'SUPPLIER_SELECTED') statusCounts.SUPPLIER_SELECTED++;
    });
    const progress = {
      rfqCreated: totalItems > 0 ? Math.round((statusCounts.RFQ_CREATED / totalItems) * 100) : 0,
      readyForReview: totalItems > 0 ? Math.round((statusCounts.READY_FOR_REVIEW / totalItems) * 100) : 0,
      supplierSelected: totalItems > 0 ? Math.round((statusCounts.SUPPLIER_SELECTED / totalItems) * 100) : 0,
    };

    reply.send({
      prId: pr.id,
      prNumber: pr.prNumber,
      prStatus: pr.status,
      totalAmount: prTotalAmount,
      currency: pr.currency,
      overBudget: pr.budgetExceptions.length > 0,
      salesOrder: serializePRSalesOrder(pr),
      items,
      progress,
    });
  } catch (error: any) {
    console.error('Get PR tracking detail error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

// ----- PO Approval (Phase 3) – Trưởng phòng Mua hàng (BUYER_MANAGER) duyệt/từ chối, không tạo PO -----
/** Danh sách PO theo hàng chờ duyệt (pending / approved / rejected / all). */
export const getPOsPendingApproval = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const queue = normalizePOApprovalQueueFilter((request.query as { queue?: string })?.queue);
    const periodStart = periodStartDaysAgo(365);

    const pendingStatuses = [...PO_PENDING_STATUSES].filter((s) =>
      Object.values(POStatus).includes(s as POStatus),
    ) as POStatus[];

    let where: Prisma.PurchaseOrderWhereInput = { deletedAt: null };

    if (queue === 'pending') {
      where = { ...where, status: { in: pendingStatuses } };
    } else if (queue === 'approved') {
      where = { ...where, ...poManagerApprovedByUserWhere(userId, periodStart) };
    } else if (queue === 'rejected') {
      where = { ...where, ...poManagerRejectedByUserWhere(userId, periodStart) };
    } else {
      where = {
        ...where,
        OR: [
          { status: { in: pendingStatuses } },
          poManagerApprovedByUserWhere(userId, periodStart),
          poManagerRejectedByUserWhere(userId, periodStart),
        ],
      };
    }

    const orderBy =
      queue === 'pending'
        ? { submittedAt: 'desc' as const }
        : queue === 'approved'
          ? { approvedAt: 'desc' as const }
          : queue === 'rejected'
            ? { rejectedAt: 'desc' as const }
            : { updatedAt: 'desc' as const };

    if (queue === 'pending') {
      await resolveAllLegacyCancelRequestedPos();
    }

    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: {
        purchaseRequest: { select: { id: true, prNumber: true } },
        supplier: { select: { id: true, name: true, code: true } },
        createdBy: { select: { username: true } },
      },
      orderBy,
      take: 100,
    });

    const list = pos.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      prId: po.purchaseRequest.id,
      prCode: po.purchaseRequest.prNumber,
      supplier: po.supplier,
      totalAmount: Number(po.totalAmount),
      currency: po.currency,
      buyer: po.createdBy?.username ?? '-',
      status: po.status,
      submittedAt: po.submittedAt?.toISOString() ?? null,
      approvedAt: po.approvedAt?.toISOString() ?? null,
      rejectedAt: po.rejectedAt?.toISOString() ?? null,
      rejectReason: po.rejectReason,
      cancelRequestReason: (po.status as string) === 'CANCEL_REQUESTED' ? po.rejectReason : null,
    }));

    reply.send({ pos: list, queue });
  } catch (error: any) {
    console.error('Get POs pending approval error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** Chi tiết PO cho Trưởng phòng Mua hàng review (Approve/Reject) */
export const getPODetailForApproval = async (
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
        purchaseRequest: {
          select: {
            id: true,
            prNumber: true,
            totalAmount: true,
            currency: true,
            items: {
              where: { deletedAt: null },
              select: { qty: true, unitPrice: true, estimatedUnitPriceVnd: true },
            },
          },
        },
        supplier: true,
        createdBy: { select: { username: true } },
        items: true,
      },
    });

    if (!po) return reply.code(404).send({ error: 'PO not found' });

    if (String(po.status) === 'CANCEL_REQUESTED') {
      await resolveLegacyCancelRequestedPo(po.id, userId);
      po = await prisma.purchaseOrder.findFirst({
        where: { id: poId, deletedAt: null },
        include: {
          purchaseRequest: {
          select: {
            id: true,
            prNumber: true,
            totalAmount: true,
            currency: true,
            items: {
              where: { deletedAt: null },
              select: { qty: true, unitPrice: true, estimatedUnitPriceVnd: true },
            },
          },
        },
          supplier: true,
          createdBy: { select: { username: true } },
          items: true,
        },
      });
      if (!po) return reply.code(404).send({ error: 'PO not found' });
    }

    const reviewStatus = po.status as string;
    const isPending = reviewStatus === 'SUBMITTED' || reviewStatus === 'CANCEL_REQUESTED';
    const isOwnHistory = po.approvedById === userId || po.rejectedById === userId;
    if (!isPending && !isOwnHistory) {
      return reply.code(403).send({ error: 'Không có quyền xem PO này' });
    }

    const poItemIds = po.items.map((i) => i.id);
    const receivedRows =
      poItemIds.length > 0
        ? await prisma.goodsReceiptLine.groupBy({
            by: ['poItemId'],
            where: { poItemId: { in: poItemIds } },
            _sum: { qtyReceived: true },
          })
        : [];
    const receivedMap = new Map<string, number>(
      receivedRows.map((row) => [row.poItemId, Number(row._sum.qtyReceived || 0)])
    );

    const prItemIds = po.items.map((i) => i.purchaseRequestItemId).filter(Boolean);
    const prItems =
      prItemIds.length > 0
        ? await prisma.purchaseRequestItem.findMany({
            where: { id: { in: prItemIds } },
            select: { id: true, partNo: true, spec: true, remark: true },
          })
        : [];
    const prItemDetailMap = new Map(prItems.map((p) => [p.id, p]));

    const quotationItemIds = po.items
      .map((i) => i.quotationItemId)
      .filter((id): id is string => Boolean(id));
    const quotationItems =
      quotationItemIds.length > 0
        ? await prisma.quotationItem.findMany({
            where: { id: { in: quotationItemIds }, deletedAt: null },
            select: { id: true, vatPercent: true },
          })
        : [];
    const vatPercentByQuotationItemId = new Map(
      quotationItems.map((qi) => [qi.id, qi.vatPercent != null ? Number(qi.vatPercent) : null])
    );

    const prItemsForBudget = po.purchaseRequest.items ?? [];
    const prProposedFromItems = computePrProposedBudgetAmount(prItemsForBudget);
    const prProposedAmount =
      prProposedFromItems > 0
        ? prProposedFromItems
        : po.purchaseRequest.totalAmount
          ? Number(po.purchaseRequest.totalAmount)
          : 0;
    const poTotalAmount = Number(po.totalAmount);
    const budgetComparison = comparePoTotalToPrProposedBudget(
      poTotalAmount,
      prProposedAmount
    );

    reply.send({
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      canAct: isPending,
      prId: po.purchaseRequest.id,
      prCode: po.purchaseRequest.prNumber,
      supplier: mapSupplierTaxForPoView(po.supplier, po.buyerSupplierTaxCode),
      buyerSupplierTaxCode: po.buyerSupplierTaxCode,
      totalAmount: poTotalAmount,
      currency: po.currency,
      paymentTerms: po.paymentTerms,
      deliveryAddress: po.deliveryAddress,
      incoterms: po.incoterms,
      projectCode: po.projectCode,
      deliveryDate: po.deliveryDate?.toISOString() ?? null,
      note: po.note,
      prBudget: prProposedAmount > 0 ? prProposedAmount : null,
      budgetComparison,
      buyer: po.createdBy?.username,
      createdAt: po.createdAt.toISOString(),
      submittedAt: po.submittedAt?.toISOString() ?? null,
      approvedAt: po.approvedAt?.toISOString() ?? null,
      rejectedAt: po.rejectedAt?.toISOString() ?? null,
      rejectReason: po.rejectReason,
      cancelRequestReason: reviewStatus === 'CANCEL_REQUESTED' ? po.rejectReason : null,
      cancelRequestedPoItemIds: parsePoItemIdsJson((po as { cancelRequestedPoItemIds?: string | null }).cancelRequestedPoItemIds),
      items: po.items.map((i) => {
        const prDetail = prItemDetailMap.get(i.purchaseRequestItemId);
        const vatFromQuotation =
          i.quotationItemId != null
            ? vatPercentByQuotationItemId.get(i.quotationItemId) ?? null
            : null;
        return {
          id: i.id,
          lineNo: i.lineNo,
          description: i.description,
          qty: Number(i.qty),
          unit: i.unit,
          unitPrice: Number(i.unitPrice),
          amount: Number(i.amount),
          purchaseRequestItemId: i.purchaseRequestItemId,
          prItemCode: prDetail?.partNo ?? null,
          spec: prDetail?.spec ?? null,
          remark: prDetail?.remark ?? null,
          vatPercent:
            vatFromQuotation ??
            inferVatPercentFromLine(Number(i.qty), Number(i.unitPrice), Number(i.amount)),
          qtyReceived: receivedMap.get(i.id) ?? 0,
          qtyRemaining: Math.max(0, Number(i.qty) - (receivedMap.get(i.id) ?? 0)),
          lineStatus: (i as { lineStatus?: string }).lineStatus ?? 'OPEN',
          lineCancelReason: (i as { lineCancelReason?: string | null }).lineCancelReason ?? null,
          cancelledRemainingQty:
            (i as { cancelledRemainingQty?: { toString(): string } | null }).cancelledRemainingQty !=
            null
              ? Number(
                  (i as { cancelledRemainingQty: { toString(): string } }).cancelledRemainingQty
                )
              : null,
        };
      }),
    });
  } catch (error: any) {
    console.error('Get PO detail for approval error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** Trưởng phòng Mua hàng duyệt PO → CREATED (buyer gửi NCC ngoài hệ thống, sau đó Mark as Sent → SENT). */
export const approvePO = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { poId } = request.params as { poId: string };

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, deletedAt: null },
      include: { purchaseRequest: true, supplier: true },
    });
    if (!po) return reply.code(404).send({ error: 'PO not found' });
    const approveStatus = po.status as string;
    if (approveStatus !== 'SUBMITTED' && approveStatus !== 'CANCEL_REQUESTED') {
      return reply.code(400).send({ error: 'Chỉ duyệt được PO đang chờ duyệt hoặc chờ duyệt hủy' });
    }

    if (approveStatus === 'SUBMITTED') {
      const taxSynced = await prisma.$transaction(async (tx) => {
        const synced = await applySupplierTaxCodeOnPoApproval(
          tx,
          po.supplierId,
          po.supplier?.taxCode,
          po.buyerSupplierTaxCode
        );
        await tx.purchaseOrder.update({
          where: { id: poId },
          data: { status: 'CREATED' as any, approvedAt: new Date(), approvedById: userId },
        });
        return synced;
      });

      return reply.send({
        message:
          'Đã duyệt PO. Trạng thái CREATED — buyer xuất PDF / gửi mail NCC ngoài hệ thống, sau đó bấm Mark as Sent.',
        supplierTaxSynced: taxSynced,
      });
    }

    const cancelPoItemIds = parsePoItemIdsJson(
      (po as { cancelRequestedPoItemIds?: string | null }).cancelRequestedPoItemIds
    );
    if (!cancelPoItemIds?.length) {
      return reply.code(400).send({
        error: 'PO không có danh sách dòng yêu cầu hủy. Buyer cần gửi lại yêu cầu hủy theo từng dòng.',
      });
    }

    const lineCancelReason =
      typeof po.rejectReason === 'string' ? po.rejectReason.trim() : '';
    if (!lineCancelReason) {
      return reply.code(400).send({ error: 'Thiếu lý do hủy dòng trên PO.' });
    }

    const result = await executePoPartialLineCancel({
      purchaseOrderId: po.id,
      cancelPoItemIds,
      lineCancelReason,
      actorUserId: userId,
    });

    reply.send({
      message: formatPoPartialLineCancelMessage(result),
      cancelledLineCount: result.cancelledLineCount,
      poRemainsActive: result.poRemainsActive,
    });
  } catch (error: any) {
    console.error('Approve PO error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** Trưởng phòng Mua hàng từ chối PO → REJECTED (bắt buộc nhập lý do) */
export const rejectPO = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { poId } = request.params as { poId: string };
    const body = request.body as { reason: string };
    if (!body?.reason?.trim()) {
      return reply.code(400).send({ error: 'Lý do từ chối là bắt buộc' });
    }

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: poId, deletedAt: null },
    });
    if (!po) return reply.code(404).send({ error: 'PO not found' });
    const rejectStatus = po.status as string;
    if (rejectStatus !== 'SUBMITTED' && rejectStatus !== 'CANCEL_REQUESTED') {
      return reply.code(400).send({ error: 'Chỉ từ chối được PO đang chờ duyệt hoặc yêu cầu hủy' });
    }
    if (rejectStatus === 'SUBMITTED') {
      await prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: 'REJECTED' as any,
          rejectedAt: new Date(),
          rejectedById: userId,
          rejectReason: body.reason.trim(),
        },
      });
      return reply.send({ message: 'Đã từ chối PO. Buyer có thể chỉnh sửa và gửi lại.' });
    }

    await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: 'SENT' as any,
        rejectedAt: new Date(),
        rejectedById: userId,
        cancelRequestedPoItemIds: null,
      } as any,
    });

    reply.send({ message: 'Đã từ chối yêu cầu hủy PO. PO quay lại trạng thái SENT.' });
  } catch (error: any) {
    console.error('Reject PO error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};
