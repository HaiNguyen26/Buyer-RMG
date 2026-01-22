import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditCreate, auditUpdate } from '../utils/audit';
import { z } from 'zod';

// Validation schemas
const createRFQSchema = z.object({
  purchaseRequestId: z.string().min(1),
  notes: z.string().optional(),
});

const updateRFQSchema = z.object({
  notes: z.string().optional(),
  status: z.enum(['DRAFT', 'SENT', 'QUOTATION_RECEIVED', 'CLOSED']).optional(),
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

    if (pr.status !== 'ASSIGNED_TO_BUYER') {
      return reply.code(400).send({ error: 'PR must be assigned to buyer first' });
    }

    if (pr.assignments.length === 0) {
      return reply.code(403).send({ error: 'PR is not assigned to you' });
    }

    // Generate RFQ number
    const rfqNumber = await generateRFQNumber();

    // Create RFQ
    const rfq = await prisma.rFQ.create({
      data: {
        purchaseRequestId: body.purchaseRequestId,
        rfqNumber,
        buyerId: userId,
        status: 'DRAFT',
        notes: body.notes || null,
        companyId: pr.companyId || null,
      },
    });

    // Update PR status
    await prisma.purchaseRequest.update({
      where: { id: body.purchaseRequestId },
      data: {
        status: 'RFQ_IN_PROGRESS',
      },
    });

    // Audit log
    await auditCreate('rfqs', rfq.id, userId, rfq);

    reply.code(201).send({
      id: rfq.id,
      rfqNumber: rfq.rfqNumber,
      purchaseRequestId: rfq.purchaseRequestId,
      status: rfq.status,
      notes: rfq.notes,
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
          },
        },
        quotations: {
          where: { deletedAt: null },
          select: {
            id: true,
            supplier: {
              select: {
                name: true,
              },
            },
            totalAmount: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    const mappedRFQs = rfqs.map((rfq) => ({
      id: rfq.id,
      rfqNumber: rfq.rfqNumber,
      prNumber: rfq.purchaseRequest.prNumber,
      prId: rfq.purchaseRequest.id,
      department: rfq.purchaseRequest.department,
      status: rfq.status,
      quotationsCount: rfq.quotations.length,
      quotations: rfq.quotations.map((q: any) => ({
        id: q.id,
        supplierName: q.supplier.name,
        totalAmount: Number(q.totalAmount),
        status: q.status,
      })),
      sentDate: rfq.sentDate?.toISOString(),
      notes: rfq.notes,
      createdAt: rfq.createdAt.toISOString(),
    }));

    reply.send({ rfqs: mappedRFQs });
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

    // Filter items based on assignment scope
    let assignedItemIds: string[] = [];
    if (assignment.scope === 'FULL') {
      assignedItemIds = rfq.purchaseRequest.items.map(item => item.id);
    } else if (assignment.scope === 'PARTIAL' && assignment.assignedItemIds) {
      assignedItemIds = JSON.parse(assignment.assignedItemIds) as string[];
    }

    // Filter items to only show assigned ones
    const assignedItems = rfq.purchaseRequest.items.filter(item => assignedItemIds.includes(item.id));

    reply.send({
      id: rfq.id,
      rfqNumber: rfq.rfqNumber,
      status: rfq.status,
      notes: rfq.notes,
      sentDate: rfq.sentDate?.toISOString(),
      purchaseRequest: {
        id: rfq.purchaseRequest.id,
        prNumber: rfq.purchaseRequest.prNumber,
        department: rfq.purchaseRequest.department,
        totalAmount: rfq.purchaseRequest.totalAmount ? Number(rfq.purchaseRequest.totalAmount) : null,
        currency: rfq.purchaseRequest.currency,
        requestor: rfq.purchaseRequest.requestor,
        items: assignedItems.map((item: any) => ({
          id: item.id,
          lineNo: item.lineNo,
          description: item.description,
          partNo: item.partNo,
          spec: item.spec,
          manufacturer: item.manufacturer,
          qty: Number(item.qty),
          unit: item.unit,
          unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
          amount: item.amount ? Number(item.amount) : null,
        })),
      },
      quotations: rfq.quotations.map((q: any) => ({
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
      createdAt: rfq.createdAt.toISOString(),
      updatedAt: rfq.updatedAt.toISOString(),
    });
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


