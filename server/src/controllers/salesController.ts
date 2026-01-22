import { FastifyReply } from 'fastify';
import { prisma, findManyWithFilters, findOneWithFilters } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditCreate, auditUpdate } from '../utils/audit';
import { z } from 'zod';

// Validation schemas
const createSalesPOSchema = z.object({
  salesPONumber: z.string().min(1),
  customerId: z.string().uuid(),
  projectName: z.string().min(1),
  projectCode: z.string().optional(),
  customerPONumber: z.string().optional(),
  expectedDeliveryPeriod: z.string().optional(),
  totalPOValue: z.number().positive(),
  tax: z.number().min(0).optional(),
  poDescription: z.string().optional(),
  internalNotes: z.string().optional(),
  currency: z.string().default('VND'),
  effectiveDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  action: z.enum(['SAVE_DRAFT', 'ACTIVATE']).default('SAVE_DRAFT'),
});

const updateSalesPOSchema = createSalesPOSchema.partial();

// Helper function to generate Sales PO Number
const generateSalesPONumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `SO-${year}-`;
  
  // Find all existing Sales POs with this prefix
  const existingPOs = await prisma.salesPO.findMany({
    where: { salesPONumber: { startsWith: prefix } },
    select: { salesPONumber: true },
  });
  
  // Extract sequence numbers and find the next available one
  const existingSequences = existingPOs
    .map(po => {
      const match = po.salesPONumber.match(/-(\d{3})$/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(num => num > 0)
    .sort((a, b) => b - a);
  
  // Find the first available sequence number starting from 001
  let nextSeq = 1;
  for (const seq of existingSequences) {
    if (seq === nextSeq) {
      nextSeq++;
    } else if (seq > nextSeq) {
      break;
    }
  }
  
  const seq = String(nextSeq).padStart(3, '0');
  return `${prefix}${seq}`;
};

// Get Next Sales PO Number (preview)
export const getNextSalesPONumber = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const salesPONumber = await generateSalesPONumber();
    reply.send({ salesPONumber });
  } catch (error: any) {
    console.error('Get next Sales PO number error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

// Get Sales Dashboard Overview
export const getSalesDashboard = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Get active Sales POs
    const activeSalesPOs = await prisma.salesPO.findMany({
      where: {
        salesUserId: userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        customer: true,
        purchaseRequests: {
          include: {
            payments: {
              where: {
                status: 'DONE',
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    // Calculate totals
    const totalSalesPOAmount = activeSalesPOs.reduce(
      (sum, po) => sum + Number(po.amount),
      0
    );

    // Calculate actual cost (only Payment DONE)
    let actualCost = 0;
    activeSalesPOs.forEach((po) => {
      po.purchaseRequests.forEach((pr) => {
        pr.payments.forEach((payment) => {
          if (payment.status === 'DONE') {
            actualCost += Number(payment.amount);
          }
        });
      });
    });

    const remainingBudget = totalSalesPOAmount - actualCost;

    // Get warnings (POs approaching or exceeding budget)
    const warnings = activeSalesPOs
      .map((po) => {
        let poActualCost = 0;
        po.purchaseRequests.forEach((pr) => {
          pr.payments.forEach((payment) => {
            if (payment.status === 'DONE') {
              poActualCost += Number(payment.amount);
            }
          });
        });

        const poRemaining = Number(po.amount) - poActualCost;
        const usagePercent = (poActualCost / Number(po.amount)) * 100;

        // Cảnh báo thông minh: >= 80% chi tiêu
        if (usagePercent >= 100) {
          return {
            type: 'exceeded',
            salesPOId: po.id,
            salesPONumber: po.salesPONumber,
            projectName: po.projectName,
            amount: Number(po.amount),
            actualCost: poActualCost,
            remaining: poRemaining,
            usagePercent: usagePercent.toFixed(1),
          };
        } else if (usagePercent >= 80) {
          return {
            type: 'approaching',
            salesPOId: po.id,
            salesPONumber: po.salesPONumber,
            projectName: po.projectName,
            amount: Number(po.amount),
            actualCost: poActualCost,
            remaining: poRemaining,
            usagePercent: usagePercent.toFixed(1),
          };
        }
        return null;
      })
      .filter((w) => w !== null);

    // Calculate trend data (last 6 months) - So sánh ngân sách và chi phí thực tế
    const trendData = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

      // Calculate budget for this month (POs effective in this month)
      const monthBudget = activeSalesPOs
        .filter((po) => {
          const poDate = new Date(po.effectiveDate);
          return poDate >= monthStart && poDate <= monthEnd;
        })
        .reduce((sum, po) => sum + Number(po.amount), 0);

      // Calculate actual cost for this month (payments done in this month)
      // Sử dụng updatedAt khi status = DONE (thời điểm payment được hoàn thành)
      let monthActualCost = 0;
      activeSalesPOs.forEach((po) => {
        po.purchaseRequests.forEach((pr) => {
          pr.payments.forEach((payment: any) => {
            if (payment.status === 'DONE') {
              // Dùng updatedAt khi status = DONE (thời điểm payment được cập nhật thành DONE)
              const paymentDate = new Date(payment.updatedAt || payment.createdAt || new Date());
              if (paymentDate >= monthStart && paymentDate <= monthEnd) {
                monthActualCost += Number(payment.amount);
              }
            }
          });
        });
      });

      trendData.push({
        month: monthDate.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' }),
        budget: monthBudget,
        actualCost: monthActualCost,
      });
    }

    reply.send({
      activeSalesPOs: activeSalesPOs.length,
      totalSalesPOAmount,
      actualCost,
      remainingBudget,
      warnings,
      trendData,
      salesPOs: activeSalesPOs.map((po) => ({
        id: po.id,
        salesPONumber: po.salesPONumber,
        customer: po.customer.name,
        projectName: po.projectName,
        projectCode: po.projectCode,
        amount: Number(po.amount),
        currency: po.currency,
        effectiveDate: po.effectiveDate,
        status: po.status,
      })),
    });
  } catch (error: any) {
    console.error('Get sales dashboard error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Sales POs List
export const getSalesPOs = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { status, customerId, search } = request.query as any;

    const where: any = {
      salesUserId: userId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (search) {
      where.OR = [
        { salesPONumber: { contains: search, mode: 'insensitive' } },
        { projectName: { contains: search, mode: 'insensitive' } },
        { projectCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const salesPOs = await prisma.salesPO.findMany({
      where,
      include: {
        customer: true,
        purchaseRequests: {
          include: {
            payments: {
              where: {
                status: 'DONE',
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const result = salesPOs.map((po) => {
      let actualCost = 0;
      po.purchaseRequests.forEach((pr) => {
        pr.payments.forEach((payment) => {
          if (payment.status === 'DONE') {
            actualCost += Number(payment.amount);
          }
        });
      });

      return {
        id: po.id,
        salesPONumber: po.salesPONumber,
        customer: {
          id: po.customer.id,
          name: po.customer.name,
          code: po.customer.code,
        },
        projectName: po.projectName,
        projectCode: po.projectCode,
        amount: Number(po.amount),
        currency: po.currency,
        effectiveDate: po.effectiveDate,
        status: po.status,
        actualCost,
        remainingBudget: Number(po.amount) - actualCost,
        createdAt: po.createdAt,
        updatedAt: po.updatedAt,
      };
    });

    reply.send({ salesPOs: result });
  } catch (error: any) {
    console.error('Get sales POs error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Sales PO by ID
export const getSalesPOById = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as { id: string };
    const userId = request.user?.userId;

    const salesPO = await prisma.salesPO.findFirst({
      where: {
        id,
        salesUserId: userId,
        deletedAt: null,
      },
      include: {
        customer: true,
        purchaseRequests: {
          include: {
            requestor: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
            supplier: true,
            payments: {
              where: {
                deletedAt: null,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!salesPO) {
      return reply.code(404).send({ error: 'Sales PO not found' });
    }

    // Calculate financial summary
    let actualCost = 0;
    salesPO.purchaseRequests.forEach((pr) => {
      pr.payments.forEach((payment) => {
        if (payment.status === 'DONE') {
          actualCost += Number(payment.amount);
        }
      });
    });

    const remainingBudget = Number(salesPO.amount) - actualCost;
    const progressPercent = (actualCost / Number(salesPO.amount)) * 100;

    reply.send({
      ...salesPO,
      amount: Number(salesPO.amount),
      financialSummary: {
        salesPOAmount: Number(salesPO.amount),
        actualCost,
        remainingBudget,
        progressPercent: progressPercent.toFixed(2),
      },
    });
  } catch (error: any) {
    console.error('Get sales PO by ID error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Create Sales PO
export const createSalesPO = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const validation = createSalesPOSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const data = validation.data;

    const salesPO = await prisma.salesPO.create({
      data: {
        salesPONumber: data.salesPONumber,
        customerId: data.customerId,
        projectName: data.projectName,
        projectCode: data.projectCode || data.customerPONumber,
        amount: data.totalPOValue || data.amount,
        currency: data.currency,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : new Date(),
        status: data.action === 'ACTIVATE' ? 'ACTIVE' : 'DRAFT',
        salesUserId: userId,
        companyId: null, // TODO: Get from request context
        notes: data.internalNotes || data.notes,
      },
      include: {
        customer: true,
      },
    });

    await auditCreate(
      'sales_pos',
      salesPO.id,
      { ...data, salesUserId: userId },
      { userId, companyId: null }
    );

    reply.code(201).send({
      ...salesPO,
      amount: Number(salesPO.amount),
    });
  } catch (error: any) {
    console.error('Create sales PO error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Update Sales PO
export const updateSalesPO = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as { id: string };
    const userId = request.user?.userId;

    const validation = updateSalesPOSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: 'Validation error',
        details: validation.error.errors,
      });
    }

    const existingPO = await prisma.salesPO.findFirst({
      where: {
        id,
        salesUserId: userId,
        deletedAt: null,
      },
    });

    if (!existingPO) {
      return reply.code(404).send({ error: 'Sales PO not found' });
    }

    const updateData: any = {};
    if (validation.data.salesPONumber) updateData.salesPONumber = validation.data.salesPONumber;
    if (validation.data.customerId) updateData.customerId = validation.data.customerId;
    if (validation.data.projectName !== undefined) updateData.projectName = validation.data.projectName;
    if (validation.data.projectCode !== undefined) updateData.projectCode = validation.data.projectCode;
    if (validation.data.amount) updateData.amount = validation.data.amount;
    if (validation.data.currency) updateData.currency = validation.data.currency;
    if (validation.data.effectiveDate) updateData.effectiveDate = new Date(validation.data.effectiveDate);
    if (validation.data.notes !== undefined) updateData.notes = validation.data.notes;

    const salesPO = await prisma.salesPO.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
      },
    });

    await auditUpdate(
      'sales_pos',
      id,
      existingPO,
      updateData,
      { userId, companyId: null }
    );

    reply.send({
      ...salesPO,
      amount: Number(salesPO.amount),
    });
  } catch (error: any) {
    console.error('Update sales PO error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Close Sales PO
export const closeSalesPO = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as { id: string };
    const userId = request.user?.userId;

    const existingPO = await prisma.salesPO.findFirst({
      where: {
        id,
        salesUserId: userId,
        deletedAt: null,
      },
    });

    if (!existingPO) {
      return reply.code(404).send({ error: 'Sales PO not found' });
    }

    const salesPO = await prisma.salesPO.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    await auditUpdate(
      'sales_pos',
      id,
      { status: existingPO.status },
      { status: 'CLOSED' },
      { userId, companyId: null }
    );

    reply.send({
      ...salesPO,
      amount: Number(salesPO.amount),
    });
  } catch (error: any) {
    console.error('Close sales PO error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Reopen Sales PO
export const reopenSalesPO = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as { id: string };
    const userId = request.user?.userId;

    const existingPO = await prisma.salesPO.findFirst({
      where: {
        id,
        salesUserId: userId,
        deletedAt: null,
      },
    });

    if (!existingPO) {
      return reply.code(404).send({ error: 'Sales PO not found' });
    }

    const salesPO = await prisma.salesPO.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    await auditUpdate(
      'sales_pos',
      id,
      { status: existingPO.status },
      { status: 'ACTIVE' },
      { userId, companyId: null }
    );

    reply.send({
      ...salesPO,
      amount: Number(salesPO.amount),
    });
  } catch (error: any) {
    console.error('Reopen sales PO error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Sales PO Detail (with PRs and financial summary)
export const getSalesPODetail = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as { id: string };
    const userId = request.user?.userId;

    const salesPO = await prisma.salesPO.findFirst({
      where: {
        id,
        salesUserId: userId,
        deletedAt: null,
      },
      include: {
        customer: true,
        purchaseRequests: {
          include: {
            requestor: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
            supplier: true,
            payments: {
              where: {
                deletedAt: null,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!salesPO) {
      return reply.code(404).send({ error: 'Sales PO not found' });
    }

    // Calculate financial summary
    let actualCost = 0;
    const prsWithStatus = salesPO.purchaseRequests.map((pr) => {
      let prActualCost = 0;
      const hasPaymentDone = pr.payments.some((p) => p.status === 'DONE');

      pr.payments.forEach((payment) => {
        if (payment.status === 'DONE') {
          prActualCost += Number(payment.amount);
          actualCost += Number(payment.amount);
        }
      });

      let status = pr.status;
      if (hasPaymentDone) status = 'PAYMENT_DONE';
      else if (pr.supplierId) status = 'SUPPLIER_SELECTED';

      return {
        ...pr,
        status,
        actualCost: prActualCost,
      };
    });

    const remainingBudget = Number(salesPO.amount) - actualCost;
    const progressPercent = (actualCost / Number(salesPO.amount)) * 100;

    reply.send({
      salesPO: {
        ...salesPO,
        amount: Number(salesPO.amount),
      },
      purchaseRequests: prsWithStatus,
      financialSummary: {
        salesPOAmount: Number(salesPO.amount),
        actualCost,
        remainingBudget,
        progressPercent: progressPercent.toFixed(2),
      },
    });
  } catch (error: any) {
    console.error('Get sales PO detail error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Cost Overview (for charts)
export const getCostOverview = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { startDate, endDate } = request.query as any;

    const where: any = {
      salesUserId: userId,
      deletedAt: null,
    };

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const salesPOs = await prisma.salesPO.findMany({
      where,
      include: {
        customer: true,
        purchaseRequests: {
          include: {
            payments: {
              where: {
                status: 'DONE',
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const overview = salesPOs.map((po) => {
      let actualCost = 0;
      po.purchaseRequests.forEach((pr) => {
        pr.payments.forEach((payment) => {
          if (payment.status === 'DONE') {
            actualCost += Number(payment.amount);
          }
        });
      });

      return {
        salesPOId: po.id,
        salesPONumber: po.salesPONumber,
        projectName: po.projectName,
        customerName: po.customer.name,
        salesPOAmount: Number(po.amount),
        actualCost,
        remainingBudget: Number(po.amount) - actualCost,
        createdAt: po.createdAt,
      };
    });

    reply.send({ overview });
  } catch (error: any) {
    console.error('Get cost overview error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Export Reports
export const exportReports = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { type, format } = request.query as any; // type: 'sales-po' | 'project' | 'customer', format: 'excel' | 'pdf'

    // TODO: Implement Excel/PDF export using ExcelJS and Puppeteer
    reply.send({
      message: 'Export functionality will be implemented',
      type,
      format,
    });
  } catch (error: any) {
    console.error('Export reports error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

