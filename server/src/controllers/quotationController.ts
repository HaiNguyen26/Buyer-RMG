import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditCreate, auditUpdate } from '../utils/audit';
import { z } from 'zod';
import { createNotification, NotificationTemplates } from '../utils/notifications';
import { getIO } from '../utils/getIO';

// Validation schemas
const createQuotationSchema = z.object({
  rfqId: z.string().min(1),
  supplierId: z.string().min(1),
  quotationNumber: z.string().optional(),
  totalAmount: z.number().min(0),
  currency: z.string().default('VND'),
  leadTime: z.number().int().min(0).optional(),
  deliveryTerms: z.string().optional(),
  paymentTerms: z.string().optional(),
  warranty: z.string().optional(),
  riskNotes: z.string().optional(),
  validUntil: z.string().optional(), // ISO date string
  items: z.array(
    z.object({
      purchaseRequestItemId: z.string().optional(),
      lineNo: z.number().int().min(1),
      description: z.string().min(1),
      qty: z.number().min(0),
      unit: z.string().optional(),
      unitPrice: z.number().min(0),
      notes: z.string().optional(),
    })
  ).min(1),
});

const updateQuotationSchema = createQuotationSchema.partial();

// Calculate Recommendation Score
const calculateRecommendationScore = async (quotationId: string, rfqId: string) => {
  // Get all valid quotations for this RFQ
  const allQuotations = await prisma.quotation.findMany({
    where: {
      rfqId,
      status: { in: ['VALID', 'PENDING'] },
      deletedAt: null,
    },
    orderBy: {
      totalAmount: 'asc',
    },
  });

  if (allQuotations.length < 2) {
    return null; // Need at least 2 quotations to calculate score
  }

  const currentQuotation = allQuotations.find((q) => q.id === quotationId);
  if (!currentQuotation) {
    return null;
  }

  // Find lowest price (best price)
  const lowestPrice = Number(allQuotations[0].totalAmount);
  const currentPrice = Number(currentQuotation.totalAmount);

  // Find shortest lead time (best lead time)
  const leadTimes = allQuotations
    .map((q) => q.leadTime || 999)
    .filter((lt) => lt > 0)
    .sort((a, b) => a - b);
  const shortestLeadTime = leadTimes[0] || 999;
  const currentLeadTime = currentQuotation.leadTime || 999;

  // Calculate scores (0-100 scale)
  // Price score (70%): Lower price = higher score
  const priceScore = lowestPrice > 0
    ? Math.max(0, 100 - ((currentPrice - lowestPrice) / lowestPrice) * 100)
    : 50;

  // Lead time score (20%): Shorter lead time = higher score
  const leadTimeScore = shortestLeadTime > 0 && currentLeadTime > 0
    ? Math.max(0, 100 - ((currentLeadTime - shortestLeadTime) / shortestLeadTime) * 100)
    : 50;

  // Payment terms score (10%): Better terms = higher score
  // Simple heuristic: COD = 50, Net 30 = 80, Net 60+ = 40
  let paymentScore = 50;
  if (currentQuotation.paymentTerms) {
    const terms = currentQuotation.paymentTerms.toLowerCase();
    if (terms.includes('cod') || terms.includes('cash on delivery')) {
      paymentScore = 50;
    } else if (terms.includes('net 30') || terms.includes('30 days')) {
      paymentScore = 80;
    } else if (terms.includes('net 60') || terms.includes('60 days')) {
      paymentScore = 60;
    } else if (terms.includes('net 90') || terms.includes('90 days')) {
      paymentScore = 40;
    } else if (terms.includes('advance') || terms.includes('prepaid')) {
      paymentScore = 30;
    }
  }

  // Weighted total score
  const totalScore = (priceScore * 0.7) + (leadTimeScore * 0.2) + (paymentScore * 0.1);

  return Math.round(totalScore * 100) / 100; // Round to 2 decimal places
};

// Update Recommendation Flags
const updateRecommendations = async (rfqId: string) => {
  const quotations = await prisma.quotation.findMany({
    where: {
      rfqId,
      status: { in: ['VALID', 'PENDING'] },
      deletedAt: null,
    },
  });

  if (quotations.length < 2) {
    // Not enough quotations, clear all recommendations
    await prisma.quotation.updateMany({
      where: { rfqId },
      data: {
        isRecommended: false,
        recommendationScore: null,
      },
    });
    return;
  }

  // Calculate scores for all quotations
  const scores = await Promise.all(
    quotations.map(async (q) => ({
      id: q.id,
      score: await calculateRecommendationScore(q.id, rfqId),
    }))
  );

  // Find highest score
  const validScores = scores.filter((s) => s.score !== null);
  if (validScores.length === 0) {
    return;
  }

  const maxScore = Math.max(...validScores.map((s) => s.score!));
  const recommendedQuotation = validScores.find((s) => s.score === maxScore);

  // Update all quotations
  for (const q of quotations) {
    const scoreData = scores.find((s) => s.id === q.id);
    const score = scoreData?.score || null;
    const isRecommended = recommendedQuotation?.id === q.id;

    await prisma.quotation.update({
      where: { id: q.id },
      data: {
        recommendationScore: score,
        isRecommended,
      },
    });
  }
};

// Check if RFQ has enough quotations and update status
const checkRFQStatus = async (rfqId: string) => {
  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfqId },
    include: {
      purchaseRequest: {
        include: {
          supplierSelections: {
            where: { deletedAt: null },
            take: 1,
            include: {
              buyerLeader: {
                select: { id: true, role: true },
              },
            },
          },
        },
      },
      quotations: {
        where: {
          status: { in: ['VALID', 'SELECTED'] },
          deletedAt: null,
        },
      },
    },
  });

  if (!rfq) {
    return;
  }

  // If has at least 2 valid quotations, update RFQ and PR status
  if (rfq.quotations.length >= 2 && rfq.status === 'SENT') {
    const previousStatus = rfq.status;
    
    await prisma.rFQ.update({
      where: { id: rfqId },
      data: {
        status: 'QUOTATION_RECEIVED',
      },
    });

    await prisma.purchaseRequest.update({
      where: { id: rfq.purchaseRequestId },
      data: {
        status: 'QUOTATION_RECEIVED',
      },
    });

    // Send notification to BUYER_LEADER: PR đã đủ báo giá
    const buyerLeader = rfq.purchaseRequest.supplierSelections[0]?.buyerLeader;
    if (buyerLeader) {
      const template = NotificationTemplates.PR_QUOTATIONS_COMPLETE(rfq.purchaseRequest.prNumber);
      await createNotification(getIO(), {
        userId: buyerLeader.id,
        role: buyerLeader.role,
        type: 'PR_QUOTATIONS_COMPLETE',
        title: template.title,
        message: template.message,
        relatedId: rfq.purchaseRequestId,
        relatedType: 'PR',
        metadata: { prNumber: rfq.purchaseRequest.prNumber, quotationCount: rfq.quotations.length },
        companyId: rfq.purchaseRequest.companyId,
      });
    }
  }
};

// Create Quotation
export const createQuotation = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = createQuotationSchema.parse(request.body);

    // Check if RFQ exists and belongs to buyer
    const rfq = await prisma.rFQ.findUnique({
      where: { id: body.rfqId },
      include: {
        purchaseRequest: {
          include: {
            items: {
              where: { deletedAt: null },
            },
            assignments: {
              where: {
                buyerId: userId,
                deletedAt: null,
              },
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

    // Get assignment to validate items
    const assignment = rfq.purchaseRequest.assignments[0];
    if (!assignment) {
      return reply.code(403).send({ error: 'PR is not assigned to you' });
    }

    // Get assigned item IDs
    let assignedItemIds: string[] = [];
    if (assignment.scope === 'FULL') {
      assignedItemIds = rfq.purchaseRequest.items.map(item => item.id);
    } else if (assignment.scope === 'PARTIAL' && assignment.assignedItemIds) {
      assignedItemIds = JSON.parse(assignment.assignedItemIds) as string[];
    }

    // Validate that all quotation items belong to assigned items
    if (body.items && body.items.length > 0) {
      const quotationItemIds = body.items
        .map(item => item.purchaseRequestItemId)
        .filter(id => id !== undefined && id !== null) as string[];
      
      const invalidItems = quotationItemIds.filter(id => !assignedItemIds.includes(id));
      if (invalidItems.length > 0) {
        return reply.code(400).send({
          error: 'Some items in quotation are not assigned to you',
          invalidItems,
        });
      }
    }

    // Check if supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: body.supplierId },
    });

    if (!supplier) {
      return reply.code(404).send({ error: 'Supplier not found' });
    }

    // Calculate total from items
    const calculatedTotal = body.items.reduce((sum, item) => {
      return sum + (item.qty * item.unitPrice);
    }, 0);

    // Validate total amount matches calculated total
    if (Math.abs(calculatedTotal - body.totalAmount) > 0.01) {
      return reply.code(400).send({
        error: 'Total amount does not match sum of items',
        calculatedTotal,
        providedTotal: body.totalAmount,
      });
    }

    // Create quotation
    const quotation = await prisma.quotation.create({
      data: {
        rfqId: body.rfqId,
        supplierId: body.supplierId,
        quotationNumber: body.quotationNumber || null,
        totalAmount: body.totalAmount,
        currency: body.currency,
        leadTime: body.leadTime || null,
        deliveryTerms: body.deliveryTerms || null,
        paymentTerms: body.paymentTerms || null,
        warranty: body.warranty || null,
        riskNotes: body.riskNotes || null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        status: 'PENDING',
        companyId: rfq.companyId || null,
        items: {
          create: body.items.map((item) => ({
            lineNo: item.lineNo,
            purchaseRequestItemId: item.purchaseRequestItemId || null,
            description: item.description,
            qty: item.qty,
            unit: item.unit || null,
            unitPrice: item.unitPrice,
            totalPrice: item.qty * item.unitPrice,
            notes: item.notes || null,
            companyId: rfq.companyId || null,
          })),
        },
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
    });

    // Calculate recommendation score
    const score = await calculateRecommendationScore(quotation.id, body.rfqId);
    if (score !== null) {
      await prisma.quotation.update({
        where: { id: quotation.id },
        data: {
          recommendationScore: score,
        },
      });
    }

    // Update recommendations for all quotations in RFQ
    await updateRecommendations(body.rfqId);

    // Check RFQ status
    await checkRFQStatus(body.rfqId);

    // Audit log
    await auditCreate('quotations', quotation.id, userId, quotation);

    reply.code(201).send({
      id: quotation.id,
      rfqId: quotation.rfqId,
      supplier: quotation.supplier,
      quotationNumber: quotation.quotationNumber,
      totalAmount: Number(quotation.totalAmount),
      currency: quotation.currency,
      leadTime: quotation.leadTime,
      status: quotation.status,
      recommendationScore: quotation.recommendationScore ? Number(quotation.recommendationScore) : null,
      isRecommended: quotation.isRecommended,
      items: quotation.items.map((item: any) => ({
        id: item.id,
        lineNo: item.lineNo,
        description: item.description,
        qty: Number(item.qty),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
      createdAt: quotation.createdAt.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Create quotation error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Quotations
export const getQuotations = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { rfqId, supplierId, status } = request.query as {
      rfqId?: string;
      supplierId?: string;
      status?: string;
    };

    const where: any = {
      deletedAt: null,
      rfq: {
        buyerId: userId,
      },
    };

    if (rfqId) {
      where.rfqId = rfqId;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    const quotations = await prisma.quotation.findMany({
      where,
      include: {
        rfq: {
          select: {
            id: true,
            rfqNumber: true,
            purchaseRequest: {
              select: {
                prNumber: true,
              },
            },
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    const mappedQuotations = quotations.map((q) => ({
      id: q.id,
      rfqId: q.rfqId,
      rfqNumber: q.rfq.rfqNumber,
      prNumber: q.rfq.purchaseRequest.prNumber,
      supplier: q.supplier,
      quotationNumber: q.quotationNumber,
      totalAmount: Number(q.totalAmount),
      currency: q.currency,
      leadTime: q.leadTime,
      status: q.status,
      isRecommended: q.isRecommended,
      recommendationScore: q.recommendationScore ? Number(q.recommendationScore) : null,
      createdAt: q.createdAt.toISOString(),
    }));

    reply.send({ quotations: mappedQuotations });
  } catch (error: any) {
    console.error('Get quotations error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Quotation by ID
export const getQuotationById = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        rfq: {
          include: {
            purchaseRequest: {
              include: {
                items: {
                  where: { deletedAt: null },
                  orderBy: { lineNo: 'asc' },
                },
                assignments: {
                  where: {
                    buyerId: userId,
                    deletedAt: null,
                  },
                },
              },
            },
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            code: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        items: {
          orderBy: { lineNo: 'asc' },
        },
      },
    });

    if (!quotation) {
      return reply.code(404).send({ error: 'Quotation not found' });
    }

    if (quotation.rfq.buyerId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // Get assignment to filter items
    const assignment = quotation.rfq.purchaseRequest.assignments[0];
    if (!assignment) {
      return reply.code(403).send({ error: 'PR is not assigned to you' });
    }

    // Get assigned item IDs
    let assignedItemIds: string[] = [];
    if (assignment.scope === 'FULL') {
      assignedItemIds = quotation.rfq.purchaseRequest.items.map(item => item.id);
    } else if (assignment.scope === 'PARTIAL' && assignment.assignedItemIds) {
      assignedItemIds = JSON.parse(assignment.assignedItemIds) as string[];
    }

    // Filter quotation items to only show those matching assigned items
    const filteredQuotationItems = quotation.items.filter(item => 
      !item.purchaseRequestItemId || assignedItemIds.includes(item.purchaseRequestItemId)
    );

    reply.send({
      id: quotation.id,
      rfqId: quotation.rfqId,
      rfqNumber: quotation.rfq.rfqNumber,
      prNumber: quotation.rfq.purchaseRequest.prNumber,
      supplier: quotation.supplier,
      quotationNumber: quotation.quotationNumber,
      totalAmount: Number(quotation.totalAmount),
      currency: quotation.currency,
      leadTime: quotation.leadTime,
      deliveryTerms: quotation.deliveryTerms,
      paymentTerms: quotation.paymentTerms,
      warranty: quotation.warranty,
      riskNotes: quotation.riskNotes,
      validUntil: quotation.validUntil?.toISOString(),
      status: quotation.status,
      isRecommended: quotation.isRecommended,
      recommendationScore: quotation.recommendationScore ? Number(quotation.recommendationScore) : null,
      items: filteredQuotationItems.map((item: any) => ({
        id: item.id,
        lineNo: item.lineNo,
        purchaseRequestItemId: item.purchaseRequestItemId,
        description: item.description,
        qty: Number(item.qty),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        notes: item.notes,
      })),
      createdAt: quotation.createdAt.toISOString(),
      updatedAt: quotation.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Get quotation by ID error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Update Quotation
export const updateQuotation = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const body = updateQuotationSchema.parse(request.body);

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        rfq: {
          include: {
            purchaseRequest: {
              include: {
                items: {
                  where: { deletedAt: null },
                },
                assignments: {
                  where: {
                    buyerId: userId,
                    deletedAt: null,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!quotation) {
      return reply.code(404).send({ error: 'Quotation not found' });
    }

    if (quotation.rfq.buyerId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    if (quotation.status === 'SELECTED') {
      return reply.code(400).send({ error: 'Cannot update selected quotation' });
    }

    // Get assignment to validate items
    const assignment = quotation.rfq.purchaseRequest.assignments[0];
    if (!assignment) {
      return reply.code(403).send({ error: 'PR is not assigned to you' });
    }

    // Get assigned item IDs
    let assignedItemIds: string[] = [];
    if (assignment.scope === 'FULL') {
      assignedItemIds = quotation.rfq.purchaseRequest.items.map(item => item.id);
    } else if (assignment.scope === 'PARTIAL' && assignment.assignedItemIds) {
      assignedItemIds = JSON.parse(assignment.assignedItemIds) as string[];
    }

    const updateData: any = {};
    if (body.totalAmount !== undefined) updateData.totalAmount = body.totalAmount;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.leadTime !== undefined) updateData.leadTime = body.leadTime;
    if (body.deliveryTerms !== undefined) updateData.deliveryTerms = body.deliveryTerms;
    if (body.paymentTerms !== undefined) updateData.paymentTerms = body.paymentTerms;
    if (body.warranty !== undefined) updateData.warranty = body.warranty;
    if (body.riskNotes !== undefined) updateData.riskNotes = body.riskNotes;
    if (body.validUntil !== undefined) {
      updateData.validUntil = body.validUntil ? new Date(body.validUntil) : null;
    }

    // Update items if provided
    if (body.items && body.items.length > 0) {
      // Validate that all quotation items belong to assigned items
      const quotationItemIds = body.items
        .map(item => item.purchaseRequestItemId)
        .filter(id => id !== undefined && id !== null) as string[];
      
      const invalidItems = quotationItemIds.filter(id => !assignedItemIds.includes(id));
      if (invalidItems.length > 0) {
        return reply.code(400).send({
          error: 'Some items in quotation are not assigned to you',
          invalidItems,
        });
      }

      // Delete existing items
      await prisma.quotationItem.deleteMany({
        where: { quotationId: id },
      });

      // Create new items
      await prisma.quotationItem.createMany({
        data: body.items.map((item) => ({
          quotationId: id,
          lineNo: item.lineNo,
          purchaseRequestItemId: item.purchaseRequestItemId || null,
          description: item.description,
          qty: item.qty,
          unit: item.unit || null,
          unitPrice: item.unitPrice,
          totalPrice: item.qty * item.unitPrice,
          notes: item.notes || null,
          companyId: quotation.rfq.companyId || null,
        })),
      });

      // Recalculate total
      const calculatedTotal = body.items.reduce((sum, item) => {
        return sum + (item.qty * item.unitPrice);
      }, 0);
      updateData.totalAmount = calculatedTotal;
    }

    const updatedQuotation = await prisma.quotation.update({
      where: { id },
      data: updateData,
    });

    // Recalculate recommendation score
    const score = await calculateRecommendationScore(id, quotation.rfqId);
    if (score !== null) {
      await prisma.quotation.update({
        where: { id },
        data: {
          recommendationScore: score,
        },
      });
    }

    // Update recommendations
    await updateRecommendations(quotation.rfqId);

    // Audit log
    await auditUpdate(
      'quotations',
      id,
      quotation,
      updatedQuotation,
      { userId, companyId: quotation.rfq.companyId || undefined }
    );

    reply.send({
      id: updatedQuotation.id,
      totalAmount: Number(updatedQuotation.totalAmount),
      status: updatedQuotation.status,
      recommendationScore: updatedQuotation.recommendationScore
        ? Number(updatedQuotation.recommendationScore)
        : null,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Update quotation error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Validate/Invalidate Quotation
export const validateQuotation = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const { valid } = request.body as { valid: boolean };

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        rfq: true,
      },
    });

    if (!quotation) {
      return reply.code(404).send({ error: 'Quotation not found' });
    }

    if (quotation.rfq.buyerId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    const updatedQuotation = await prisma.quotation.update({
      where: { id },
      data: {
        status: valid ? 'VALID' : 'INVALID',
      },
    });

    // Update recommendations if validated
    if (valid) {
      await updateRecommendations(quotation.rfqId);
      await checkRFQStatus(quotation.rfqId);
    }

    // Audit log
    await auditUpdate(
      'quotations',
      id,
      quotation,
      updatedQuotation,
      { userId, companyId: quotation.rfq.companyId || undefined }
    );

    reply.send({
      message: `Quotation ${valid ? 'validated' : 'invalidated'} successfully`,
      status: updatedQuotation.status,
    });
  } catch (error: any) {
    console.error('Validate quotation error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};


