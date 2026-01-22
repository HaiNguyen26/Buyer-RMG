import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditCreate, auditUpdate, auditDelete } from '../utils/audit';
import { z } from 'zod';

// Validation schemas
const createSupplierSchema = z.object({
  name: z.string().min(1, 'Tên NCC là bắt buộc'),
  code: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxCode: z.string().optional(),
  contactPerson: z.string().optional(),
  notes: z.string().optional(),
});

const updateSupplierSchema = createSupplierSchema.partial();

// Get Suppliers
export const getSuppliers = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { search, code } = request.query as { search?: string; code?: string };

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (code) {
      where.code = code;
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: {
            quotations: {
              where: {
                deletedAt: null,
                status: { in: ['VALID', 'SELECTED'] },
              },
            },
            purchaseRequests: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      take: 100,
    });

    const mappedSuppliers = suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      taxCode: supplier.taxCode,
      contactPerson: supplier.contactPerson,
      notes: supplier.notes,
      quotationsCount: supplier._count.quotations,
      purchaseRequestsCount: supplier._count.purchaseRequests,
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
    }));

    reply.send({ suppliers: mappedSuppliers });
  } catch (error: any) {
    console.error('Get suppliers error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Supplier by ID
export const getSupplierById = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        quotations: {
          where: { deletedAt: null },
          include: {
            rfq: {
              select: {
                rfqNumber: true,
                purchaseRequest: {
                  select: {
                    prNumber: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        purchaseRequests: {
          where: { deletedAt: null },
          select: {
            id: true,
            prNumber: true,
            status: true,
            totalAmount: true,
            currency: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!supplier) {
      return reply.code(404).send({ error: 'Supplier not found' });
    }

    reply.send({
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      taxCode: supplier.taxCode,
      contactPerson: supplier.contactPerson,
      notes: supplier.notes,
      recentQuotations: supplier.quotations.map((q: any) => ({
        id: q.id,
        rfqNumber: q.rfq.rfqNumber,
        prNumber: q.rfq.purchaseRequest.prNumber,
        totalAmount: Number(q.totalAmount),
        currency: q.currency,
        status: q.status,
        createdAt: q.createdAt.toISOString(),
      })),
      recentPurchaseRequests: supplier.purchaseRequests.map((pr: any) => ({
        id: pr.id,
        prNumber: pr.prNumber,
        status: pr.status,
        totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
        currency: pr.currency,
        createdAt: pr.createdAt.toISOString(),
      })),
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Get supplier by ID error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Create Supplier
export const createSupplier = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = createSupplierSchema.parse(request.body);

    // Check if code already exists
    if (body.code) {
      const existing = await prisma.supplier.findFirst({
        where: {
          code: body.code,
          deletedAt: null,
        },
      });

      if (existing) {
        return reply.code(400).send({ error: 'Supplier code already exists' });
      }
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: body.name,
        code: body.code || null,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
        taxCode: body.taxCode || null,
        contactPerson: body.contactPerson || null,
        notes: body.notes || null,
      },
    });

    // Audit log
    await auditCreate('suppliers', supplier.id, userId, supplier);

    reply.code(201).send({
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      taxCode: supplier.taxCode,
      contactPerson: supplier.contactPerson,
      notes: supplier.notes,
      createdAt: supplier.createdAt.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Create supplier error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Update Supplier
export const updateSupplier = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const body = updateSupplierSchema.parse(request.body);

    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      return reply.code(404).send({ error: 'Supplier not found' });
    }

    // Check if code already exists (if updating code)
    if (body.code && body.code !== supplier.code) {
      const existing = await prisma.supplier.findFirst({
        where: {
          code: body.code,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (existing) {
        return reply.code(400).send({ error: 'Supplier code already exists' });
      }
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.code !== undefined) updateData.code = body.code || null;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.taxCode !== undefined) updateData.taxCode = body.taxCode || null;
    if (body.contactPerson !== undefined) updateData.contactPerson = body.contactPerson || null;
    if (body.notes !== undefined) updateData.notes = body.notes || null;

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await auditUpdate(
      'suppliers',
      id,
      supplier,
      updatedSupplier,
      { userId }
    );

    reply.send({
      id: updatedSupplier.id,
      name: updatedSupplier.name,
      code: updatedSupplier.code,
      email: updatedSupplier.email,
      phone: updatedSupplier.phone,
      address: updatedSupplier.address,
      taxCode: updatedSupplier.taxCode,
      contactPerson: updatedSupplier.contactPerson,
      notes: updatedSupplier.notes,
      updatedAt: updatedSupplier.updatedAt.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Update supplier error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Delete Supplier (Soft Delete)
export const deleteSupplier = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        quotations: {
          where: {
            deletedAt: null,
            status: { in: ['VALID', 'SELECTED'] },
          },
        },
        purchaseRequests: {
          where: {
            deletedAt: null,
            status: { not: 'CANCELLED' },
          },
        },
      },
    });

    if (!supplier) {
      return reply.code(404).send({ error: 'Supplier not found' });
    }

    // Check if supplier has active quotations or purchase requests
    if (supplier.quotations.length > 0 || supplier.purchaseRequests.length > 0) {
      return reply.code(400).send({
        error: 'Cannot delete supplier with active quotations or purchase requests',
        activeQuotations: supplier.quotations.length,
        activePurchaseRequests: supplier.purchaseRequests.length,
      });
    }

    // Soft delete
    await prisma.supplier.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    // Audit log
    await auditDelete('suppliers', id, supplier, { userId });

    reply.send({ message: 'Supplier deleted successfully' });
  } catch (error: any) {
    console.error('Delete supplier error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};


