import { FastifyReply } from 'fastify';
import { prisma, findManyWithFilters, findOneWithFilters } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditCreate, auditUpdate } from '../utils/audit';
import {
  allocateNextCounter,
  peekNextCounter,
  scanMaxSalesPOSuffix,
  soSequenceKey,
} from '../utils/documentSequence';
import { z } from 'zod';

// Validation schemas
const createSalesPOSchema = z.object({
  /** Gửi từ UI preview; server luôn cấp số mới trong DB để tránh trùng / race */
  salesPONumber: z.string().min(1).optional(),
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
  effectiveDate: z.string().optional(), // PO Date (ISO or YYYY-MM-DD)
  notes: z.string().optional(),
  action: z.enum(['SAVE_DRAFT', 'ACTIVATE']).default('ACTIVATE'),
  // Section 3–5
  projectManager: z.string().optional(),
  salesUserId: z.string().uuid().optional().nullable(),
  deliveryDeadline: z.string().optional(),
  paymentTerms: z.string().optional(),
  advancePercent: z.number().min(0).max(100).optional(),
  projectDescription: z.string().optional(),
});

const updateSalesPOSchema = createSalesPOSchema.partial();

const generateSalesPONumberPreview = async () => {
  const year = new Date().getFullYear();
  const key = soSequenceKey(year);
  const next = await peekNextCounter(prisma, key, () => scanMaxSalesPOSuffix(prisma, year));
  return `SO-${year}-${String(next).padStart(3, '0')}`;
};

// Get Next Sales PO Number (preview)
export const getNextSalesPONumber = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const salesPONumber = await generateSalesPONumberPreview();
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

// Get Sales POs List (SALES role: xem tất cả; role khác: chỉ POs của mình)
export const getSalesPOs = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const role = request.user?.role;
    const { status, customerId, search, dateFrom, dateTo } = request.query as any;

    const where: any = { deletedAt: null };
    if (role !== 'SALES') {
      where.salesUserId = userId;
    }
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as any).gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        (where.createdAt as any).lte = end;
      }
    }
    if (search) {
      where.OR = [
        { salesPONumber: { contains: search, mode: 'insensitive' } },
        { customerPONumber: { contains: search, mode: 'insensitive' } },
        { projectName: { contains: search, mode: 'insensitive' } },
        { projectCode: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const salesPOs = await prisma.salesPO.findMany({
      where,
      include: {
        customer: true,
        salesUser: { select: { id: true, username: true, fullName: true } },
        purchaseRequests: {
          where: { deletedAt: null },
          select: {
            id: true,
            items: {
              where: { deletedAt: null },
              select: { status: true },
            },
            payments: {
              where: {
                status: 'DONE',
                deletedAt: null,
              },
              select: { amount: true, status: true },
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
      let totalItems = 0;
      let itemsCompleted = 0;
      const prCount = po.purchaseRequests.length;
      po.purchaseRequests.forEach((pr) => {
        pr.payments.forEach((payment) => {
          if (payment.status === 'DONE') {
            actualCost += Number(payment.amount);
          }
        });
        pr.items.forEach((it) => {
          totalItems += 1;
          if (it.status === 'SUPPLIER_SELECTED') {
            itemsCompleted += 1;
          }
        });
      });
      const salesUser = (po as any).salesUser;
      const itemProgressPercent =
        totalItems === 0 ? 0 : Math.round((itemsCompleted / totalItems) * 100);
      return {
        id: po.id,
        salesPONumber: po.salesPONumber,
        customerPONumber: po.customerPONumber,
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
        salesOwner: salesUser ? (salesUser.fullName || salesUser.username) : null,
        prCount,
        totalItems,
        itemsCompleted,
        itemProgressPercent,
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

// Get Sales PO by ID (SALES role: xem bất kỳ; role khác: chỉ PO của mình)
export const getSalesPOById = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as { id: string };
    const userId = request.user?.userId;
    const role = request.user?.role;

    const salesPO = await prisma.salesPO.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(role !== 'SALES' ? { salesUserId: userId } : {}),
      },
      include: {
        customer: true,
        salesUser: { select: { id: true, username: true, fullName: true } },
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
    const year = new Date().getFullYear();

    const salesPO = await prisma.$transaction(
      async (tx) => {
        const key = soSequenceKey(year);
        const seq = await allocateNextCounter(tx, key, () => scanMaxSalesPOSuffix(tx, year));
        const salesPONumber = `SO-${year}-${String(seq).padStart(3, '0')}`;
        return tx.salesPO.create({
          data: {
            salesPONumber,
            customerPONumber: data.customerPONumber || null,
            customerId: data.customerId,
            projectName: data.projectName,
            projectCode: data.projectCode || null,
            amount: data.totalPOValue ?? (data as any).amount,
            currency: data.currency,
            effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : new Date(),
            status: data.action === 'ACTIVATE' ? 'ACTIVE' : 'DRAFT',
            salesUserId: data.salesUserId ?? userId,
            companyId: null,
            notes: data.internalNotes || data.notes,
            projectManager: data.projectManager || null,
            deliveryDeadline: data.deliveryDeadline ? new Date(data.deliveryDeadline) : null,
            paymentTerms: data.paymentTerms || null,
            advancePercent: data.advancePercent ?? null,
            projectDescription: data.projectDescription || null,
          },
          include: {
            customer: true,
            salesUser: { select: { id: true, username: true, fullName: true } },
          },
        });
      },
      { maxWait: 10000, timeout: 30000 }
    );

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
    const role = request.user?.role;

    const salesPO = await prisma.salesPO.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(role !== 'SALES' ? { salesUserId: userId } : {}),
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

/** Full SO workspace: overview metrics, PR rows, cost lines, activity (Sales / owner). */
export const getSalesPOWorkspace = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const { id } = request.params as { id: string };
    const userId = request.user?.userId;
    const role = request.user?.role;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const salesPO = await prisma.salesPO.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(role !== 'SALES' ? { salesUserId: userId } : {}),
      },
      include: {
        customer: true,
        salesUser: {
          select: { id: true, username: true, fullName: true, email: true },
        },
        purchaseRequests: {
          where: { deletedAt: null },
          include: {
            requestor: {
              select: { id: true, username: true, fullName: true, email: true },
            },
            items: {
              where: { deletedAt: null },
              select: {
                id: true,
                lineNo: true,
                description: true,
                partNo: true,
                qty: true,
                unit: true,
                unitPrice: true,
                amount: true,
                status: true,
              },
              orderBy: { lineNo: 'asc' },
            },
            assignments: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                buyer: { select: { id: true, username: true, fullName: true } },
              },
            },
            supplier: { select: { id: true, name: true } },
            payments: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!salesPO) {
      return reply.code(404).send({ error: 'Sales PO not found' });
    }

    let totalCost = 0;
    let totalItems = 0;
    let itemsCompleted = 0;

    const purchaseRows = salesPO.purchaseRequests.map((pr) => {
      let prCost = 0;
      pr.payments.forEach((p) => {
        if (p.status === 'DONE') {
          const a = Number(p.amount);
          prCost += a;
          totalCost += a;
        }
      });
      const itCount = pr.items.length;
      const itDone = pr.items.filter((i) => i.status === 'SUPPLIER_SELECTED').length;
      totalItems += itCount;
      itemsCompleted += itDone;
      const prProgress = itCount === 0 ? 0 : Math.round((itDone / itCount) * 100);
      const assign = pr.assignments[0];
      const buyerLabel = assign?.buyer
        ? assign.buyer.fullName || assign.buyer.username
        : '—';

      return {
        id: pr.id,
        prNumber: pr.prNumber,
        createdAt: pr.createdAt,
        requestorName: pr.requestor?.fullName || pr.requestor?.username || '—',
        itemCount: itCount,
        status: pr.status,
        buyerName: buyerLabel,
        progressPercent: prProgress,
        actualCost: prCost,
      };
    });

    const itemProgressPercent =
      totalItems === 0 ? 0 : Math.round((itemsCompleted / totalItems) * 100);
    const waitingPercent = totalItems === 0 ? 100 : Math.max(0, 100 - itemProgressPercent);

    const costLines: Array<{
      prNumber: string;
      part: string;
      qty: string;
      cost: number;
      source: string;
      currency: string;
    }> = [];

    for (const pr of salesPO.purchaseRequests) {
      for (const it of pr.items) {
        const qtyNum = Number(it.qty);
        const amt =
          it.amount != null
            ? Number(it.amount)
            : it.unitPrice != null
              ? qtyNum * Number(it.unitPrice)
              : 0;
        const isStockLike =
          (it.unitPrice != null && Number(it.unitPrice) === 0) ||
          (it.amount != null && Number(it.amount) === 0);
        costLines.push({
          prNumber: pr.prNumber,
          part: it.partNo ? `${it.partNo} — ${it.description}` : it.description,
          qty: `${qtyNum}${it.unit ? ` ${it.unit}` : ''}`,
          cost: amt,
          source: isStockLike ? 'Stock' : 'Purchase',
          currency: salesPO.currency,
        });
      }
    }

    const activities: Array<{ at: string; message: string; kind: string }> = [];

    activities.push({
      at: salesPO.createdAt.toISOString(),
      kind: 'so',
      message: `SO ${salesPO.salesPONumber} được tạo`,
    });

    for (const pr of salesPO.purchaseRequests) {
      activities.push({
        at: pr.createdAt.toISOString(),
        kind: 'pr',
        message: `PR ${pr.prNumber} đã tạo`,
      });
      const asn = pr.assignments[0];
      if (asn) {
        const bn = asn.buyer.fullName || asn.buyer.username;
        activities.push({
          at: asn.createdAt.toISOString(),
          kind: 'assign',
          message: `PR ${pr.prNumber} — giao Buyer ${bn}`,
        });
      }
      if (pr.supplier) {
        activities.push({
          at: pr.updatedAt.toISOString(),
          kind: 'supplier',
          message: `PR ${pr.prNumber} — NCC: ${pr.supplier.name}`,
        });
      }
      const donePayments = pr.payments.filter((p) => p.status === 'DONE');
      for (const p of donePayments) {
        activities.push({
          at: (p.updatedAt || p.createdAt).toISOString(),
          kind: 'payment',
          message: `PR ${pr.prNumber} — thanh toán ${Number(p.amount).toLocaleString('vi-VN')} ${salesPO.currency}`,
        });
      }
    }

    activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const contract = Number(salesPO.amount);
    const budgetUsagePercent =
      contract > 0 ? Math.min(100, Math.round((totalCost / contract) * 100)) : 0;

    const now = new Date();
    const deadline = salesPO.deliveryDeadline ? new Date(salesPO.deliveryDeadline) : null;
    const isDelayed =
      deadline != null && deadline < now && salesPO.status !== 'CLOSED';

    reply.send({
      salesPO: {
        id: salesPO.id,
        salesPONumber: salesPO.salesPONumber,
        customerPONumber: salesPO.customerPONumber,
        projectName: salesPO.projectName,
        projectCode: salesPO.projectCode,
        status: salesPO.status,
        amount: contract,
        currency: salesPO.currency,
        effectiveDate: salesPO.effectiveDate,
        deliveryDeadline: salesPO.deliveryDeadline,
        notes: salesPO.notes,
        projectDescription: salesPO.projectDescription,
        customer: salesPO.customer,
        salesOwner: salesPO.salesUser
          ? {
              id: salesPO.salesUser.id,
              name: salesPO.salesUser.fullName || salesPO.salesUser.username,
              email: salesPO.salesUser.email,
            }
          : null,
      },
      overview: {
        totalPR: salesPO.purchaseRequests.length,
        totalItems,
        itemsCompleted,
        itemProgressPercent,
        waitingPercent,
        totalCost,
        contractValue: contract,
        budgetUsagePercent,
        isDelayed,
      },
      purchaseRequests: purchaseRows,
      costLines,
      activityLog: activities,
    });
  } catch (error: any) {
    console.error('Get sales PO workspace error:', error);
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

