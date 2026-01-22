import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditCreate, auditUpdate, auditDelete } from '../utils/audit';
import { z } from 'zod';

const createCustomerSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxCode: z.string().optional(),
  contactPerson: z.string().optional(),
  notes: z.string().optional(),
});

const updateCustomerSchema = createCustomerSchema.partial();

export const getCustomers = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const { search } = request.query as any;

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

    const customers = await prisma.customer.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    reply.send({ customers });
  } catch (error: any) {
    console.error('Get customers error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

export const getCustomerById = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };

    const customer = await prisma.customer.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!customer) {
      return reply.code(404).send({ error: 'Customer not found' });
    }

    reply.send({ customer });
  } catch (error: any) {
    console.error('Get customer by ID error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

export const createCustomer = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const validation = createCustomerSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const data = validation.data;

    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        code: data.code,
        email: data.email,
        phone: data.phone,
        address: data.address,
        taxCode: data.taxCode,
        contactPerson: data.contactPerson,
        notes: data.notes,
        companyId: null, // TODO: Get from request context
      },
    });

    await auditCreate('customers', customer.id, data, { userId, companyId: null });

    reply.code(201).send({ customer });
  } catch (error: any) {
    console.error('Create customer error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

export const updateCustomer = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const userId = request.user?.userId;

    const validation = updateCustomerSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const existing = await prisma.customer.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Customer not found' });
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: validation.data,
    });

    await auditUpdate('customers', id, existing, validation.data, { userId, companyId: null });

    reply.send({ customer });
  } catch (error: any) {
    console.error('Update customer error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

export const deleteCustomer = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const { id } = request.params as { id: string };
    const userId = request.user?.userId;

    const existing = await prisma.customer.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!existing) {
      return reply.code(404).send({ error: 'Customer not found' });
    }

    // Soft delete
    const customer = await prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await auditDelete('customers', id, existing, { userId, companyId: null });

    reply.send({ customer });
  } catch (error: any) {
    console.error('Delete customer error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

