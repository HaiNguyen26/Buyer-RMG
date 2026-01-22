import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditCreate, auditUpdate } from '../utils/audit';
import { z } from 'zod';
import { createNotification, NotificationTemplates, markNotificationAsResolved } from '../utils/notifications';
import { getIO } from '../utils/getIO';

// Validation schemas
const assignPRSchema = z.object({
  buyerId: z.string().min(1),
  scope: z.enum(['FULL', 'PARTIAL']),
  assignedItemIds: z.array(z.string()).optional(),
  note: z.string().min(1, 'Note phân công là bắt buộc'),
});

const selectSupplierSchema = z.object({
  purchaseRequestId: z.string().min(1),
  quotationId: z.string().min(1),
  selectionReason: z.string().min(1, 'Lý do chọn NCC là bắt buộc'),
  overBudgetReason: z.string().optional(), // Lý do đề xuất vượt ngân sách (bắt buộc nếu over-budget)
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
      },
    });

    // Check PRs with assignments
    const prsWithAssignments = await prisma.purchaseRequest.findMany({
      where: {
        status: { in: ['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'] },
        deletedAt: null,
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
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
          take: 100, // Limit items per PR to prevent large responses
        },
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
      totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
      currency: pr.currency || 'VND',
      requestor: pr.requestor || null,
      items: pr.items.map((item: any) => ({
        id: item.id,
        lineNo: item.lineNo,
        description: item.description || '',
        qty: Number(item.qty) || 0,
        unit: item.unit || null,
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        amount: item.amount ? Number(item.amount) : null,
      })),
      createdAt: pr.createdAt.toISOString(),
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
        deletedAt: null,
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

    // Only update PR status to ASSIGNED_TO_BUYER if all items are assigned
    if (allItemsAssigned) {
      await prisma.purchaseRequest.update({
        where: { id: prId },
        data: {
          status: 'ASSIGNED_TO_BUYER',
        },
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
    await auditCreate('pr_assignments', assignment.id, userId, assignment);

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

    const mappedAssignments = assignments.map((assignment) => ({
      id: assignment.id,
      prNumber: assignment.purchaseRequest.prNumber,
      prId: assignment.purchaseRequest.id,
      prStatus: assignment.purchaseRequest.status,
      buyer: assignment.buyer,
      scope: assignment.scope,
      assignedItemIds: assignment.assignedItemIds
        ? JSON.parse(assignment.assignedItemIds)
        : null,
      note: assignment.note,
      createdAt: assignment.createdAt.toISOString(),
    }));

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

    const rfq = await prisma.rFQ.findUnique({
      where: { id: rfqId },
      include: {
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
            status: { in: ['VALID', 'SELECTED'] },
            deletedAt: null,
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

    reply.send({
      rfq: {
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
        prNumber: rfq.purchaseRequest.prNumber,
        prId: rfq.purchaseRequest.id,
        prItems: rfq.purchaseRequest.items.map((item: any) => ({
          id: item.id,
          lineNo: item.lineNo,
          description: item.description,
          qty: Number(item.qty),
          unit: item.unit,
          unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        })),
      },
      quotations: rfq.quotations.map((q) => ({
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
        isRecommended: q.isRecommended,
        recommendationScore: q.recommendationScore ? Number(q.recommendationScore) : null,
        items: q.items.map((item: any) => ({
          id: item.id,
          lineNo: item.lineNo,
          description: item.description,
          qty: Number(item.qty),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        })),
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
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = selectSupplierSchema.parse(request.body);

    // Check if PR exists
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: body.purchaseRequestId },
      include: {
        rfqs: {
          include: {
            quotations: {
              where: { id: body.quotationId },
            },
          },
        },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    // Check if quotation exists and belongs to PR's RFQ
    const quotation = await prisma.quotation.findUnique({
      where: { id: body.quotationId },
      include: {
        rfq: true,
        supplier: true,
      },
    });

    if (!quotation) {
      return reply.code(404).send({ error: 'Quotation not found' });
    }

    if (quotation.rfq.purchaseRequestId !== body.purchaseRequestId) {
      return reply.code(400).send({ error: 'Quotation does not belong to this PR' });
    }

    if (quotation.status !== 'VALID') {
      return reply.code(400).send({ error: 'Quotation must be valid' });
    }

    // Check if already selected
    const existingSelection = await prisma.supplierSelection.findUnique({
      where: { quotationId: body.quotationId },
    });

    if (existingSelection) {
      return reply.code(400).send({ error: 'Supplier already selected for this PR' });
    }

    // Check budget exception BEFORE creating selection
    const purchaseAmount = Number(quotation.totalAmount);
    const prAmount = pr.totalAmount ? Number(pr.totalAmount) : 0;
    const isOverBudget = purchaseAmount > prAmount && prAmount > 0;

    // If over-budget, require overBudgetReason
    if (isOverBudget && (!body.overBudgetReason || body.overBudgetReason.trim().length === 0)) {
      return reply.code(400).send({
        error: 'Lý do đề xuất vượt ngân sách là bắt buộc',
        overBudgetInfo: {
          prAmount,
          purchaseAmount,
          overAmount: purchaseAmount - prAmount,
          overPercent: ((purchaseAmount - prAmount) / prAmount) * 100,
        },
      });
    }

    // Create supplier selection
    const selection = await prisma.supplierSelection.create({
      data: {
        purchaseRequestId: body.purchaseRequestId,
        quotationId: body.quotationId,
        buyerLeaderId: userId,
        selectionReason: body.selectionReason,
        companyId: pr.companyId || null,
      },
    });

    // Update quotation status
    await prisma.quotation.update({
      where: { id: body.quotationId },
      data: {
        status: 'SELECTED',
      },
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
      await prisma.purchaseRequest.update({
        where: { id: body.purchaseRequestId },
        data: {
          status: 'BUDGET_EXCEPTION',
          supplierId: quotation.supplierId, // Still set supplier, but status is BUDGET_EXCEPTION
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
      await auditCreate('budget_exceptions', exception.id, userId, exception);
      await auditCreate('supplier_selections', selection.id, userId, selection);

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
          supplier: quotation.supplier,
          selectionReason: selection.selectionReason,
        },
        budgetException: {
          id: exception.id,
          status: exception.status,
        },
      });
      return;
    }

    // Normal case: No over-budget
    // Update PR status and supplier
    await prisma.purchaseRequest.update({
      where: { id: body.purchaseRequestId },
      data: {
        status: 'SUPPLIER_SELECTED',
        supplierId: quotation.supplierId,
      },
    });

    // Audit log
    await auditCreate('supplier_selections', selection.id, userId, selection);

    reply.send({
      message: 'Supplier selected successfully',
      selection: {
        id: selection.id,
        prId: selection.purchaseRequestId,
        quotationId: selection.quotationId,
        supplier: quotation.supplier,
        selectionReason: selection.selectionReason,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Select supplier error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
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
          where: { deletedAt: null },
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
      department: pr.department || '',
      requiredDate: pr.requiredDate ? pr.requiredDate.toISOString() : null,
      purpose: pr.purpose || null,
      status: pr.status,
      notes: pr.notes || null,
      totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
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
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        amount: item.amount ? Number(item.amount) : null,
        purpose: item.purpose || null,
        remark: item.remark || null,
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


