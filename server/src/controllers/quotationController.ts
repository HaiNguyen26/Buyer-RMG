import { FastifyReply } from 'fastify';
import { allocateNextRfqNumber } from '../utils/rfqNumber';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditCreate, auditUpdate } from '../utils/audit';
import { z } from 'zod';
import { createNotification, NotificationTemplates } from '../utils/notifications';
import { getIO } from '../utils/getIO';
import { handleMultipleFileUpload } from '../utils/storage';
import { computeQuotationBaseline } from '../utils/baseline';
import { mapQuotationItemAmounts, normalizeVatPercent } from '../utils/quotationLine';
import { resolveQuotationTotalAmount } from '../utils/quotationTotals';
import { validateQuotationCommercialTermsInput } from '../utils/quotationCommercialTerms';
import {
  coerceToValidCalendarYmd,
  computeLeadTimeDaysFromDelivery,
  parseWarrantyMonthsInput,
  todayYmdLocal,
} from '../utils/quotationLeadTime';
import { Prisma } from '@prisma/client';

// Validation schemas
const createQuotationSchema = z.object({
  rfqId: z.string().min(1),
  supplierId: z.string().min(1),
  quotationNumber: z.string().optional(),
  totalAmount: z.number().min(0),
  currency: z.string().default('VND'),
  leadTime: z.number().int().min(1).optional(),
  deliveryTerms: z.string().optional(),
  paymentTerms: z.string().trim().min(1, 'Điều kiện thanh toán là bắt buộc'),
  warranty: z.string().trim().min(1).optional(),
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
      vatPercent: z
        .union([z.number(), z.string()])
        .optional()
        .transform((v) => (v === undefined || v === '' ? undefined : normalizeVatPercent(v))),
      leadTimeDays: z.number().int().min(1).optional(),
      warrantyMonths: z.number().int().min(0).optional(),
      deliveryDate: z.string().optional(),
      notes: z.string().optional(),
    })
  ).min(1),
  quotationDate: z.string().optional(),
});

const updateQuotationSchema = createQuotationSchema.partial();

// DB Decimal(15,2) max absolute value < 10^13 (PostgreSQL)
const MAX_DECIMAL_15_2 = 9999999999999.99;
const MAX_DECIMAL_10_2 = 99999999.99; // for qty

function roundDecimal(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

type QuotationItemBody = {
  lineNo: number;
  purchaseRequestItemId?: string;
  description: string;
  qty: number;
  unitPrice: number;
  vatPercent?: number;
  unit?: string;
  leadTimeDays?: number;
  warrantyMonths?: number;
  deliveryDate?: string;
  notes?: string;
};

type SafeQuotationItemRow = QuotationItemBody & {
  qty: number;
  unitPrice: number;
  vatPercent: number;
  totalPrice: number;
  leadTimeDays: number;
  warrantyMonths: number;
  deliveryDateYmd: string;
};

function normalizeQuotationItemCommercial(
  item: QuotationItemBody,
  quotationDateYmd: string,
  lineNo: number
): { ok: true; leadTimeDays: number; warrantyMonths: number; deliveryDateYmd: string } | { ok: false; error: string } {
  let leadTimeDays = item.leadTimeDays;
  let deliveryDateYmd = coerceToValidCalendarYmd(item.deliveryDate) || null;

  if (deliveryDateYmd) {
    const calc = computeLeadTimeDaysFromDelivery(deliveryDateYmd, quotationDateYmd);
    if (!calc.leadTimeDays || !calc.deliveryDateYmd) {
      return { ok: false, error: `Dòng ${lineNo}: ngày giao phải sau ngày nhập báo giá (${quotationDateYmd})` };
    }
    leadTimeDays = calc.leadTimeDays;
    deliveryDateYmd = calc.deliveryDateYmd;
  } else if (item.leadTimeDays != null && item.leadTimeDays >= 1) {
    const [y, m, d] = quotationDateYmd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + item.leadTimeDays));
    deliveryDateYmd = todayYmdLocal(dt);
    leadTimeDays = item.leadTimeDays;
  } else {
    return { ok: false, error: `Dòng ${lineNo}: cần ngày giao NCC hoặc lead time (ngày)` };
  }

  const warrantyMonths =
    item.warrantyMonths != null
      ? Math.round(Number(item.warrantyMonths))
      : parseWarrantyMonthsInput(item.notes);
  if (warrantyMonths == null || warrantyMonths < 0) {
    return { ok: false, error: `Dòng ${lineNo}: bảo hành (tháng) không hợp lệ` };
  }

  return { ok: true, leadTimeDays, warrantyMonths, deliveryDateYmd };
}

function aggregateHeaderCommercialFromItems(items: SafeQuotationItemRow[]) {
  const leadTime = Math.max(...items.map((i) => i.leadTimeDays));
  const warrantyMonths = Math.max(...items.map((i) => i.warrantyMonths));
  return {
    leadTime,
    warranty: `${warrantyMonths} tháng`,
  };
}

function mapSafeItemToPrismaCreate(item: SafeQuotationItemRow, companyId: string | null) {
  return {
    lineNo: item.lineNo,
    purchaseRequestItemId: item.purchaseRequestItemId || null,
    description: item.description,
    qty: item.qty,
    unit: item.unit || null,
    unitPrice: item.unitPrice,
    vatPercent: item.vatPercent,
    totalPrice: item.totalPrice,
    leadTimeDays: item.leadTimeDays,
    warrantyMonths: item.warrantyMonths,
    deliveryDate: new Date(`${item.deliveryDateYmd}T00:00:00.000Z`),
    notes: item.notes || null,
    companyId,
  };
}

/** Tính thành tiền từng dòng = SL × đơn giá × (1 + VAT%) */
function buildSafeQuotationItems(
  items: QuotationItemBody[],
  reply: FastifyReply,
  quotationDateYmd: string
): SafeQuotationItemRow[] | null {
  const safeItems: SafeQuotationItemRow[] = [];
  for (const item of items) {
    const qty = roundDecimal(Number(item.qty), 2);
    const unitPrice = roundDecimal(Number(item.unitPrice), 2);
    const vatPercent = normalizeVatPercent(item.vatPercent);
    const { totalPrice } = mapQuotationItemAmounts({ qty, unitPrice, vatPercent });
    if (qty < 0 || qty > MAX_DECIMAL_10_2 || !Number.isFinite(qty)) {
      reply.code(400).send({ error: `Số lượng không hợp lệ tại dòng ${item.lineNo}`, maxQty: MAX_DECIMAL_10_2 });
      return null;
    }
    if (unitPrice < 0 || unitPrice > MAX_DECIMAL_15_2 || !Number.isFinite(unitPrice)) {
      reply.code(400).send({ error: `Đơn giá không hợp lệ tại dòng ${item.lineNo}`, maxAmount: MAX_DECIMAL_15_2 });
      return null;
    }
    if (totalPrice < 0 || totalPrice > MAX_DECIMAL_15_2 || !Number.isFinite(totalPrice)) {
      reply.code(400).send({ error: `Thành tiền vượt giới hạn tại dòng ${item.lineNo}`, maxAmount: MAX_DECIMAL_15_2 });
      return null;
    }
    const commercial = normalizeQuotationItemCommercial(item, quotationDateYmd, item.lineNo);
    if (!commercial.ok) {
      reply.code(400).send({ error: commercial.error });
      return null;
    }
    safeItems.push({
      lineNo: item.lineNo,
      purchaseRequestItemId: item.purchaseRequestItemId,
      description: item.description,
      qty,
      unitPrice,
      vatPercent,
      totalPrice,
      unit: item.unit,
      notes: item.notes,
      leadTimeDays: commercial.leadTimeDays,
      warrantyMonths: commercial.warrantyMonths,
      deliveryDateYmd: commercial.deliveryDateYmd,
    });
  }
  return safeItems;
}

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
    // Get Buyer Leader separately (not from supplierSelections as it may not exist yet)
    const buyerLeader = await prisma.user.findFirst({
      where: { role: 'BUYER_LEADER', deletedAt: null },
      select: { id: true, role: true },
    });
    
    if (buyerLeader && rfq.purchaseRequest) {
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
        companyId: rfq.purchaseRequest.companyId || null,
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

    // Khóa RFQ khi đã submit (READY_FOR_COMPARISON) - buyer không thể thêm báo giá mới
    if (rfq.status === 'READY_FOR_COMPARISON' as any) {
      return reply.code(403).send({
        error: 'RFQ đã được submit và bị khóa. Không thể thêm báo giá mới.',
        currentStatus: rfq.status,
      });
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

    const quotationDateYmd = body.quotationDate?.trim().slice(0, 10) || todayYmdLocal();
    const safeItems = buildSafeQuotationItems(body.items, reply, quotationDateYmd);
    if (!safeItems) return;

    const headerCommercial = aggregateHeaderCommercialFromItems(safeItems);
    const commercialCheck = validateQuotationCommercialTermsInput({
      leadTime: headerCommercial.leadTime,
      paymentTerms: body.paymentTerms,
      warranty: headerCommercial.warranty,
    });
    if (!commercialCheck.ok) {
      return reply.code(400).send({ error: commercialCheck.error });
    }

    const calculatedTotal = roundDecimal(
      safeItems.reduce((sum, item) => sum + item.totalPrice, 0),
      2
    );
    if (calculatedTotal < 0 || calculatedTotal > MAX_DECIMAL_15_2 || !Number.isFinite(calculatedTotal)) {
      return reply.code(400).send({
        error: 'Tổng giá trị báo giá không hợp lệ (vượt quá giới hạn hoặc không hợp lệ)',
        maxAllowed: MAX_DECIMAL_15_2,
      });
    }
    const providedTotal = roundDecimal(Number(body.totalAmount), 2);
    if (Math.abs(calculatedTotal - providedTotal) > 0.01) {
      console.warn('[createQuotation] Client total mismatch — using sum of lines', {
        calculatedTotal,
        providedTotal,
      });
    }

    // Create quotation with safe decimal values
    const quotation = await prisma.quotation.create({
      data: {
        rfqId: body.rfqId,
        supplierId: body.supplierId,
        quotationNumber: body.quotationNumber || null,
        totalAmount: calculatedTotal,
        currency: body.currency,
        leadTime: headerCommercial.leadTime,
        deliveryTerms: body.deliveryTerms || null,
        paymentTerms: body.paymentTerms,
        warranty: headerCommercial.warranty,
        riskNotes: body.riskNotes || null,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        status: 'PENDING',
        companyId: rfq.companyId || null,
        items: {
          create: safeItems.map((item) =>
            mapSafeItemToPrismaCreate(item, rfq.companyId || null)
          ),
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
    await auditCreate('quotations', quotation.id, quotation, {
      userId,
      companyId: quotation.companyId || undefined,
    });

    // Baseline preview: so sánh với giá PR từng item (chỉ cảnh báo, chưa lan toàn hệ thống)
    const prItemsForBaseline = rfq.purchaseRequest.items.map((p: any) => ({
      id: p.id,
      lineNo: p.lineNo,
      unitPrice: p.unitPrice != null ? Number(p.unitPrice) : null,
      amount: p.amount != null ? Number(p.amount) : null,
      qty: Number(p.qty) || 0,
    }));
    const baselinePreview = computeQuotationBaseline(prItemsForBaseline, safeItems.map((it) => ({
      purchaseRequestItemId: it.purchaseRequestItemId ?? null,
      unitPrice: it.unitPrice,
      lineNo: it.lineNo,
    })));

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
        vatPercent: item.vatPercent != null ? Number(item.vatPercent) : 10,
        totalPrice: Number(item.totalPrice),
      })),
      baselinePreview: {
        overBaseline: baselinePreview.overBaseline,
        items: baselinePreview.items,
      },
      createdAt: quotation.createdAt.toISOString(),
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      console.error('Create quotation Prisma validation:', error.message);
      return reply.code(500).send({
        error:
          'Server chưa đồng bộ schema (Prisma). Dừng server, chạy `npx prisma generate` trong thư mục server, rồi khởi động lại.',
        message: error.message,
      });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Create quotation error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message,
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
          include: {
            purchaseRequest: {
              include: {
                items: {
                  where: { deletedAt: null },
                  select: {
                    id: true,
                    lineNo: true,
                    unitPrice: true,
                    amount: true,
                    qty: true,
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
          },
        },
        items: {
          select: {
            purchaseRequestItemId: true,
            unitPrice: true,
            lineNo: true,
            totalPrice: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    console.log(`[getQuotations] Found ${quotations.length} quotations for buyer ${userId}`, {
      filters: { rfqId, supplierId, status },
      statuses: quotations.map((q) => q.status),
    });

    // Map các selection theo quotationId để biết NCC thắng bao nhiêu item và tổng tiền item thắng
    const quotationIds = quotations.map((q) => q.id);
    const selections = await prisma.supplierSelection.findMany({
      where: {
        quotationId: { in: quotationIds },
        purchaseRequestItemId: { not: null },
      },
      select: {
        quotationId: true,
        purchaseRequestItemId: true,
      },
    });
    const selectedMap = new Map<string, string[]>();
    for (const s of selections) {
      const list = selectedMap.get(s.quotationId) ?? [];
      if (s.purchaseRequestItemId && !list.includes(s.purchaseRequestItemId)) {
        list.push(s.purchaseRequestItemId);
      }
      selectedMap.set(s.quotationId, list);
    }

    // PO theo (purchaseRequestId, supplierId) do buyer này tạo – để hiển thị nút Xuất PO khi đã duyệt
    const prSupplierPairs = quotations.map((q) => ({
      prId: (q.rfq as any).purchaseRequest?.id,
      supplierId: q.supplierId,
    })).filter((p) => p.prId && p.supplierId);
    const poByPrSupplier = new Map<string, { id: string; poNumber: string; status: string }>();
    if (prSupplierPairs.length > 0) {
      const pos = await prisma.purchaseOrder.findMany({
        where: {
          deletedAt: null,
          createdById: userId,
          OR: prSupplierPairs.map((p) => ({
            purchaseRequestId: p.prId,
            supplierId: p.supplierId,
          })),
        },
        select: { id: true, poNumber: true, status: true, purchaseRequestId: true, supplierId: true },
      });
      for (const po of pos) {
        poByPrSupplier.set(`${po.purchaseRequestId}-${po.supplierId}`, {
          id: po.id,
          poNumber: po.poNumber,
          status: po.status,
        });
      }
    }

    const mappedQuotations = quotations.map((q) => {
      const pr = (q.rfq as any).purchaseRequest;
      const prItems = (pr?.items ?? []).map((p: any) => ({
        id: p.id,
        lineNo: p.lineNo,
        unitPrice: p.unitPrice != null ? Number(p.unitPrice) : null,
        amount: p.amount != null ? Number(p.amount) : null,
        qty: Number(p.qty) || 0,
      }));
      const baselineResult = computeQuotationBaseline(prItems, (q.items as any).map((it: any) => ({
        purchaseRequestItemId: it.purchaseRequestItemId,
        unitPrice: it.unitPrice,
        lineNo: it.lineNo,
      })));
      const selectedItemIds = selectedMap.get(q.id) ?? [];
      const selectedItemsTotalAmount = (q.items as any[])
        .filter((it: any) => selectedItemIds.includes(it.purchaseRequestItemId))
        .reduce((sum: number, it: any) => sum + Number(it.totalPrice || 0), 0);

      const poInfo = pr?.id && q.supplierId
        ? poByPrSupplier.get(`${pr.id}-${q.supplierId}`)
        : undefined;

      return {
        id: q.id,
        rfqId: q.rfqId,
        rfqNumber: (q.rfq as any).rfqNumber,
        rfqStatus: (q.rfq as any).status,
        prNumber: pr?.prNumber,
        purchaseRequestId: pr?.id,
        supplier: q.supplier,
        supplierId: q.supplierId,
        quotationNumber: q.quotationNumber,
        totalAmount: resolveQuotationTotalAmount(q.totalAmount, q.items as Array<{ totalPrice?: unknown }>),
        currency: q.currency,
        leadTime: q.leadTime,
        paymentTerms: q.paymentTerms,
        status: q.status,
        isRecommended: q.isRecommended,
        recommendationScore: q.recommendationScore ? Number(q.recommendationScore) : null,
        overBaseline: baselineResult.overBaseline,
        selectedItemCount: selectedItemIds.length,
        selectedItemsTotalAmount,
        poId: poInfo?.id ?? null,
        poNumber: poInfo?.poNumber ?? null,
        poStatus: poInfo?.status ?? null,
        createdAt: q.createdAt.toISOString(),
      };
    });

    const filteredQuotations = mappedQuotations.filter((q) => {
      const rfqNumber = String(q.rfqNumber || '').toUpperCase();
      const prNumber = String(q.prNumber || '').toUpperCase();
      const quotationNumber = String(q.quotationNumber || '').toUpperCase();
      return (
        !rfqNumber.startsWith('MOCK-') &&
        !prNumber.startsWith('MOCK-') &&
        !quotationNumber.startsWith('MOCK-')
      );
    });

    console.log(`[getQuotations] Returning ${filteredQuotations.length} mapped quotations`);
    
    // Explicitly set headers to prevent compression issues
    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Encoding', 'identity');
    reply.code(200);
    reply.send({ quotations: filteredQuotations });
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

    // Filter PR items to only assigned items
    const assignedPRItems = quotation.rfq.purchaseRequest.items.filter((p: any) => 
      assignedItemIds.includes(p.id)
    );
    
    const prItems = assignedPRItems.map((p: any) => ({
      id: p.id,
      lineNo: p.lineNo,
      unitPrice: p.unitPrice != null ? Number(p.unitPrice) : null,
      amount: p.amount != null ? Number(p.amount) : null,
      qty: Number(p.qty) || 0,
    }));
    
    const baselineResult = computeQuotationBaseline(
      prItems,
      filteredQuotationItems.map((it: any) => ({
        purchaseRequestItemId: it.purchaseRequestItemId,
        unitPrice: it.unitPrice,
        lineNo: it.lineNo,
      }))
    );

    // Calculate baseline total from PR items (only assigned items)
    const baselineTotal = prItems.reduce((sum: number, prItem: any) => {
      const amount = prItem.amount != null ? Number(prItem.amount) : 0;
      return sum + amount;
    }, 0);

    const quotationTotal = Number(quotation.totalAmount);
    const difference = quotationTotal - baselineTotal;
    const differencePercent = baselineTotal > 0 ? (difference / baselineTotal) * 100 : 0;
    
    // Determine baseline status: 🟢 Trong ngân sách / 🟡 Vượt nhẹ / 🔴 Vượt nhiều
    let baselineStatus: 'within' | 'slight_over' | 'heavy_over' = 'within';
    if (difference > 0) {
      if (differencePercent <= 5) {
        baselineStatus = 'slight_over'; // Vượt nhẹ (<= 5%)
      } else {
        baselineStatus = 'heavy_over'; // Vượt nhiều (> 5%)
      }
    }

    // Supplier selections cho báo giá này (để biết item nào được Buyer Leader chọn)
    const selections = await prisma.supplierSelection.findMany({
      where: {
        quotationId: id,
        purchaseRequestItemId: { not: null },
      },
      select: { purchaseRequestItemId: true },
    });
    const selectedItemIds = selections.map((s) => s.purchaseRequestItemId!).filter(Boolean);
    const selectedItemsTotalAmount = filteredQuotationItems
      .filter((item) => item.purchaseRequestItemId && selectedItemIds.includes(item.purchaseRequestItemId))
      .reduce((sum: number, item) => sum + Number(item.totalPrice || 0), 0);

    const prId = quotation.rfq.purchaseRequest.id;
    const relatedPO = await prisma.purchaseOrder.findFirst({
      where: {
        deletedAt: null,
        purchaseRequestId: prId,
        supplierId: quotation.supplierId,
        createdById: userId,
      },
      select: { id: true, poNumber: true, status: true },
    });

    reply.send({
      id: quotation.id,
      rfqId: quotation.rfqId,
      rfqNumber: quotation.rfq.rfqNumber,
      prNumber: quotation.rfq.purchaseRequest.prNumber,
      supplier: quotation.supplier,
      poId: relatedPO?.id ?? null,
      poNumber: relatedPO?.poNumber ?? null,
      poStatus: relatedPO?.status ?? null,
      quotationNumber: quotation.quotationNumber,
      totalAmount: quotationTotal,
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
      overBaseline: baselineResult.overBaseline,
      baselineTotal: baselineTotal,
      baselineStatus: baselineStatus,
      baselineDifference: difference,
      baselineDifferencePercent: differencePercent,
      itemsBaseline: baselineResult.items,
      selectedItemIds,
      selectedItemCount: selectedItemIds.length,
      selectedItemsTotalAmount,
      items: filteredQuotationItems.map((item: any) => {
        const bi = baselineResult.items.find(
          (b) => b.purchaseRequestItemId === item.purchaseRequestItemId && b.lineNo === item.lineNo
        );
        return {
          id: item.id,
          lineNo: item.lineNo,
          purchaseRequestItemId: item.purchaseRequestItemId,
          description: item.description,
          qty: Number(item.qty),
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          vatPercent: item.vatPercent != null ? Number(item.vatPercent) : 10,
          totalPrice: Number(item.totalPrice),
          notes: item.notes,
          baselineUnitPrice: bi?.baselineUnitPrice ?? null,
          overBaseline: bi?.overBaseline ?? false,
        };
      }),
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

    // Khóa RFQ khi đã submit (READY_FOR_COMPARISON) - buyer không thể sửa báo giá
    if (quotation.rfq.status === 'READY_FOR_COMPARISON' as any) {
      return reply.code(403).send({
        error: 'RFQ đã được submit và bị khóa. Không thể chỉnh sửa báo giá.',
        currentStatus: quotation.rfq.status,
      });
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
    if (body.totalAmount !== undefined) {
      const safe = roundDecimal(Number(body.totalAmount), 2);
      if (safe < 0 || safe > MAX_DECIMAL_15_2 || !Number.isFinite(safe)) {
        return reply.code(400).send({ error: 'Tổng giá trị báo giá vượt giới hạn', maxAllowed: MAX_DECIMAL_15_2 });
      }
      updateData.totalAmount = safe;
    }
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
      const quotationItemIds = body.items
        .map((item: any) => item.purchaseRequestItemId)
        .filter((id: any) => id !== undefined && id !== null) as string[];
      const invalidItems = quotationItemIds.filter(id => !assignedItemIds.includes(id));
      if (invalidItems.length > 0) {
        return reply.code(400).send({
          error: 'Some items in quotation are not assigned to you',
          invalidItems,
        });
      }

      const quotationDateYmd = body.quotationDate?.trim().slice(0, 10) || todayYmdLocal();
      const safeItems = buildSafeQuotationItems(body.items, reply, quotationDateYmd);
      if (!safeItems) return;

      const headerCommercial = aggregateHeaderCommercialFromItems(safeItems);
      updateData.leadTime = headerCommercial.leadTime;
      updateData.warranty = headerCommercial.warranty;

      await prisma.quotationItem.deleteMany({
        where: { quotationId: id },
      });
      await prisma.quotationItem.createMany({
        data: safeItems.map((item) => ({
          quotationId: id,
          ...mapSafeItemToPrismaCreate(item, quotation.rfq.companyId || null),
        })),
      });
      const calculatedTotal = safeItems.reduce((sum, item) => sum + item.totalPrice, 0);
      updateData.totalAmount = roundDecimal(calculatedTotal, 2);
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

// Create Quotation for PR (Phase 2 - Auto-create RFQ DRAFT if needed)
// This API allows Buyer to input quotation directly for PR without creating RFQ first
// Accepts JSON body (files can be uploaded separately via upload endpoint)
export const createQuotationForPR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { prId } = request.params as { prId: string };
    const body = request.body as any;

    const {
      supplierId,
      quotationNumber,
      totalAmount,
      currency = 'VND',
      leadTime,
      deliveryTerms,
      paymentTerms,
      warranty,
      riskNotes,
      validUntil,
      items,
    } = body;

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ error: 'supplierId and items are required' });
    }

    const purchaseRequestId = prId;
    if (!purchaseRequestId) {
      return reply.code(400).send({ error: 'purchaseRequestId is required' });
    }

    // Check if PR exists and is assigned to buyer
    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: purchaseRequestId },
      include: {
        requestor: {
          select: {
            id: true,
            directManagerCode: true,
          },
        },
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
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    if (pr.assignments.length === 0) {
      return reply.code(403).send({ error: 'PR is not assigned to you' });
    }

    // Get quotation item IDs from request
    const quotationItemIds = items
      .map((item: any) => item.purchaseRequestItemId)
      .filter((id: string) => id !== undefined && id !== null) as string[];

    // Check if rfqId is provided in body
    let rfq;
    if (body.rfqId) {
      // Use provided RFQ
      rfq = await prisma.rFQ.findFirst({
        where: {
          id: body.rfqId,
          purchaseRequestId,
          buyerId: userId,
          deletedAt: null,
        },
      });
      if (!rfq) {
        return reply.code(404).send({ error: 'RFQ not found or access denied' });
      }
      // Khóa RFQ khi đã submit (READY_FOR_COMPARISON) - buyer không thể thêm báo giá mới
      if (rfq.status === 'READY_FOR_COMPARISON' as any) {
        return reply.code(403).send({
          error: 'RFQ đã được submit và bị khóa. Không thể thêm báo giá mới.',
          currentStatus: rfq.status,
        });
      }
    } else {
      // Auto-find or create RFQ based on items
      // Find existing RFQs for this PR
      const existingRFQs = await prisma.rFQ.findMany({
        where: {
          purchaseRequestId,
          buyerId: userId,
          deletedAt: null,
        },
        include: {
          quotations: {
            where: { deletedAt: null },
            include: {
              items: {
                where: { deletedAt: null },
              },
            },
          },
        },
      });

      // Try to find RFQ with matching items
      rfq = existingRFQs.find((existingRFQ) => {
        // First, check if RFQ has predefined itemIds in notes
        let rfqItemIds = new Set<string>();
        if (existingRFQ.notes) {
          const match = existingRFQ.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              if (parsed.itemIds && Array.isArray(parsed.itemIds)) {
                rfqItemIds = new Set(parsed.itemIds);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
        
        // If RFQ doesn't have predefined items, get items from quotations
        if (rfqItemIds.size === 0) {
          existingRFQ.quotations.forEach((quotation) => {
            quotation.items.forEach((item) => {
              if (item.purchaseRequestItemId) {
                rfqItemIds.add(item.purchaseRequestItemId);
              }
            });
          });
        }
        
        // Check if quotation items match RFQ items
        const quotationItemSet = new Set(quotationItemIds);
        return (
          rfqItemIds.size === quotationItemSet.size &&
          Array.from(rfqItemIds).every((id) => quotationItemSet.has(id))
        );
      });

      // If no matching RFQ found, create new one
      if (!rfq) {
        let notesContent = '';
        if (quotationItemIds.length > 0) {
          const itemIdsJson = JSON.stringify({ itemIds: quotationItemIds });
          notesContent = `[RFQ_ITEMS]${itemIdsJson}[/RFQ_ITEMS]`;
        }

        rfq = await prisma.$transaction(
          async (tx) => {
            const rfqNumber = await allocateNextRfqNumber(tx, pr.prNumber, {
              department: pr.department,
              location: pr.location,
            });
            return tx.rFQ.create({
              data: {
                purchaseRequestId,
                rfqNumber,
                buyerId: userId,
                status: 'DRAFT',
                companyId: pr.companyId || null,
                notes: notesContent || null,
              },
            });
          },
          { maxWait: 10000, timeout: 30000 }
        );

        if (pr.status === 'ASSIGNED_TO_BUYER') {
          await prisma.purchaseRequest.update({
            where: { id: purchaseRequestId },
            data: {
              status: 'RFQ_IN_PROGRESS',
            },
          });
        }
      } else {
        // Khóa RFQ khi đã submit (READY_FOR_COMPARISON) - buyer không thể thêm báo giá mới
        if (rfq.status === 'READY_FOR_COMPARISON' as any) {
          return reply.code(403).send({
            error: 'RFQ đã được submit và bị khóa. Không thể thêm báo giá mới.',
            currentStatus: rfq.status,
          });
        }
        // Validate quotation items match RFQ predefined items (if RFQ has predefined items)
        if (rfq.notes) {
          const match = rfq.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              if (parsed.itemIds && Array.isArray(parsed.itemIds)) {
                const rfqItemIds = parsed.itemIds as string[];
                const rfqItemSet = new Set<string>(rfqItemIds);
                const quotationItemSet = new Set<string>(quotationItemIds);
                if (
                  rfqItemSet.size !== quotationItemSet.size ||
                  !rfqItemIds.every((id: string) => quotationItemSet.has(id))
                ) {
                  return reply.code(400).send({
                    error: 'Quotation items do not match RFQ items',
                    rfqItems: rfqItemIds,
                    quotationItems: Array.from(quotationItemSet),
                  });
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    }

    // Validate supplier
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return reply.code(404).send({ error: 'Supplier not found' });
    }

    const quotationDateYmd = body.quotationDate?.trim().slice(0, 10) || todayYmdLocal();
    const safeItems = buildSafeQuotationItems(items, reply, quotationDateYmd);
    if (!safeItems) return;

    const headerCommercial = aggregateHeaderCommercialFromItems(safeItems);
    const commercialCheck = validateQuotationCommercialTermsInput({
      leadTime: headerCommercial.leadTime,
      paymentTerms,
      warranty: headerCommercial.warranty,
    });
    if (!commercialCheck.ok) {
      return reply.code(400).send({ error: commercialCheck.error });
    }

    const calculatedTotal = roundDecimal(
      safeItems.reduce((sum, item) => sum + item.totalPrice, 0),
      2
    );
    if (calculatedTotal < 0 || calculatedTotal > MAX_DECIMAL_15_2 || !Number.isFinite(calculatedTotal)) {
      return reply.code(400).send({
        error: 'Tổng giá trị báo giá không hợp lệ (vượt quá giới hạn hoặc không hợp lệ)',
        maxAllowed: MAX_DECIMAL_15_2,
      });
    }

    // Get assignment to validate items
    const assignment = pr.assignments[0];
    let assignedItemIds: string[] = [];
    if (assignment.scope === 'FULL') {
      assignedItemIds = pr.items.map(item => item.id);
    } else if (assignment.scope === 'PARTIAL' && assignment.assignedItemIds) {
      assignedItemIds = JSON.parse(assignment.assignedItemIds) as string[];
    }

    // Validate items belong to assignment (quotationItemIds already declared at line 965)
    const invalidItems = quotationItemIds.filter(id => !assignedItemIds.includes(id));
    if (invalidItems.length > 0) {
      return reply.code(400).send({
        error: 'Some items in quotation are not assigned to you',
        invalidItems,
      });
    }

    // Create quotation with safe decimal values
    const quotation = await prisma.quotation.create({
      data: {
        rfqId: rfq.id,
        supplierId,
        quotationNumber: quotationNumber || null,
        totalAmount: calculatedTotal,
        currency,
        leadTime: headerCommercial.leadTime,
        deliveryTerms: deliveryTerms || null,
        paymentTerms: paymentTerms!.trim(),
        warranty: headerCommercial.warranty,
        riskNotes: riskNotes || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        status: 'PENDING',
        companyId: pr.companyId || null,
        items: {
          create: safeItems.map((item) =>
            mapSafeItemToPrismaCreate(item, pr.companyId || null)
          ),
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
    const score = await calculateRecommendationScore(quotation.id, rfq.id);
    if (score !== null) {
      await prisma.quotation.update({
        where: { id: quotation.id },
        data: {
          recommendationScore: score,
        },
      });
    }

    // Update recommendations
    await updateRecommendations(rfq.id);

    // Check RFQ status
    await checkRFQStatus(rfq.id);

    // Check if over budget
    const prTotalAmount = pr.totalAmount ? Number(pr.totalAmount) : 0;
    const quotationTotalAmount = Number(quotation.totalAmount);
    
    if (quotationTotalAmount > prTotalAmount) {
      // Mark PR as over budget
      await prisma.purchaseRequest.update({
        where: { id: purchaseRequestId },
        data: {
          status: 'BUDGET_EXCEPTION',
        },
      });

      // Create budget exception
      const overPercent = prTotalAmount > 0 
        ? ((quotationTotalAmount - prTotalAmount) / prTotalAmount) * 100 
        : 0;
      
      const budgetException = await prisma.budgetException.create({
        data: {
          purchaseRequestId,
          prAmount: prTotalAmount,
          purchaseAmount: quotationTotalAmount,
          overPercent: overPercent,
          status: 'PENDING',
          companyId: pr.companyId || null,
        },
      });


      // Get users to notify
      const requestor = await prisma.user.findUnique({
        where: { id: pr.requestorId },
        select: { id: true, role: true, directManagerCode: true },
      });

      // Get Buyer Leader
      const buyerLeader = await prisma.user.findFirst({
        where: { role: 'BUYER_LEADER', deletedAt: null },
        select: { id: true },
      });

      // Get Department Head (requestor's manager)
      let departmentHead: { id: string } | null = null;
      if (requestor?.directManagerCode) {
        const manager = await prisma.user.findFirst({
          where: {
            username: requestor.directManagerCode,
            role: 'DEPARTMENT_HEAD',
            deletedAt: null,
          },
          select: { id: true },
        });
        if (manager) departmentHead = manager;
      }

      // Get Branch Manager
      const branchManager = await prisma.user.findFirst({
        where: { role: 'BRANCH_MANAGER', deletedAt: null },
        select: { id: true },
      });

      // Send notifications
      const io = getIO();
      
      // Notify Buyer (current user)
      if (userId) {
        const buyerTemplate = NotificationTemplates.PR_OVER_BUDGET(pr.prNumber);
        await createNotification(io, {
          userId,
          role: 'BUYER',
          type: 'PR_OVER_BUDGET',
          title: buyerTemplate.title,
          message: buyerTemplate.message,
          relatedId: purchaseRequestId,
          relatedType: 'PURCHASE_REQUEST',
          metadata: {
            prNumber: pr.prNumber,
            overPercent: overPercent.toFixed(2),
            budgetExceptionId: budgetException.id,
          },
          companyId: pr.companyId || null,
        });
      }

      // Notify Buyer Leader
      if (buyerLeader) {
        const buyerLeaderTemplate = NotificationTemplates.PR_OVER_BUDGET_ACTION_REQUIRED(pr.prNumber);
        await createNotification(io, {
          userId: buyerLeader.id,
          role: 'BUYER_LEADER',
          type: 'PR_OVER_BUDGET',
          title: buyerLeaderTemplate.title,
          message: buyerLeaderTemplate.message,
          relatedId: purchaseRequestId,
          relatedType: 'PURCHASE_REQUEST',
          metadata: {
            prNumber: pr.prNumber,
            overPercent: overPercent.toFixed(2),
            budgetExceptionId: budgetException.id,
          },
          companyId: pr.companyId || null,
        });
      }

      // Notify Department Head
      if (departmentHead) {
        const deptHeadTemplate = NotificationTemplates.PR_OVER_BUDGET_INFO(pr.prNumber);
        await createNotification(io, {
          userId: departmentHead.id,
          role: 'DEPARTMENT_HEAD',
          type: 'PR_OVER_BUDGET',
          title: deptHeadTemplate.title,
          message: deptHeadTemplate.message,
          relatedId: purchaseRequestId,
          relatedType: 'PURCHASE_REQUEST',
          metadata: {
            prNumber: pr.prNumber,
            overPercent: overPercent.toFixed(2),
            budgetExceptionId: budgetException.id,
          },
          companyId: pr.companyId || null,
        });
      }

      // Notify Branch Manager (if over threshold, e.g., > 10%)
      if (branchManager && overPercent > 10) {
        const branchManagerTemplate = NotificationTemplates.PR_OVER_BUDGET_DECISION_REQUIRED(pr.prNumber, overPercent);
        await createNotification(io, {
          userId: branchManager.id,
          role: 'BRANCH_MANAGER',
          type: 'PR_OVER_BUDGET',
          title: branchManagerTemplate.title,
          message: branchManagerTemplate.message,
          relatedId: purchaseRequestId,
          relatedType: 'PURCHASE_REQUEST',
          metadata: {
            prNumber: pr.prNumber,
            overPercent: overPercent.toFixed(2),
            budgetExceptionId: budgetException.id,
          },
          companyId: pr.companyId || null,
        });
      }
    }

    // Audit log
    await auditCreate('quotations', quotation.id, quotation, {
      userId,
      companyId: quotation.companyId || undefined,
    });

    reply.code(201).send({
      id: quotation.id,
      rfqId: quotation.rfqId,
      rfqNumber: rfq.rfqNumber,
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
        vatPercent: item.vatPercent != null ? Number(item.vatPercent) : 10,
        totalPrice: Number(item.totalPrice),
      })),
      attachments: Array.isArray((quotation as any).attachments)
        ? (quotation as any).attachments.map((a: { id: string; fileName: string; fileUrl: string; fileSize: number; contentType: string }) => ({
            id: a.id,
            fileName: a.fileName,
            fileUrl: a.fileUrl,
            fileSize: a.fileSize,
            contentType: a.contentType,
          }))
        : [],
      createdAt: quotation.createdAt.toISOString(),
      isOverBudget: quotationTotalAmount > prTotalAmount,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Create quotation for PR error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Upload File Attachments for Quotation
export const uploadQuotationAttachments = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { quotationId } = request.params as { quotationId: string };

    // Check if quotation exists and belongs to buyer
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        rfq: {
          include: {
            purchaseRequest: {
              select: {
                companyId: true,
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

    // Upload files
    const uploadedFiles = await handleMultipleFileUpload(
      request,
      'attachment',
      quotation.rfq.purchaseRequest.companyId || null,
      userId
    );

    // Create attachment records
    const attachments = await Promise.all(
      uploadedFiles.map(file =>
        prisma.quotationAttachment.create({
          data: {
            quotationId,
            fileKey: file.key,
            fileUrl: file.url,
            fileName: file.filename,
            fileSize: file.size,
            contentType: file.contentType,
            companyId: quotation.rfq.purchaseRequest.companyId || null,
          },
        })
      )
    );

    reply.code(201).send({
      attachments: attachments.map(a => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileSize: a.fileSize,
        contentType: a.contentType,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('Upload quotation attachments error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Upload File Attachments for Quotation via RFQ ID (Phase 2)
// This allows uploading attachments by RFQ ID, automatically finding the latest quotation
export const uploadQuotationAttachmentsByRFQ = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { rfqId } = request.params as { rfqId: string };
    
    // Read quotationId and file buffers from multipart form data
    // Note: We need to read buffers immediately as stream can only be consumed once
    let quotationId: string | undefined;
    const fileBuffers: Array<{
      buffer: Buffer;
      filename: string;
      contentType: string;
    }> = [];
    
    const multipartRequest = request as any;
    if (multipartRequest.isMultipart && multipartRequest.parts) {
      const parts = multipartRequest.parts();
      for await (const part of parts) {
        if (part.type === 'field' && part.fieldname === 'quotationId') {
          quotationId = part.value as string;
        } else if (part.type === 'file' && part.fieldname === 'attachment') {
          // Read buffer immediately (stream can only be consumed once)
          const buffer = await part.toBuffer();
          fileBuffers.push({
            buffer,
            filename: part.filename || 'unknown',
            contentType: part.mimetype || 'application/octet-stream',
          });
        }
      }
    } else {
      // Fallback: try to read from body (for non-multipart requests)
      const body = request.body as any;
      quotationId = body?.quotationId;
    }

    // Check if RFQ exists and belongs to buyer
    const rfq = await prisma.rFQ.findUnique({
      where: { id: rfqId },
      include: {
        purchaseRequest: {
          select: {
            id: true,
            companyId: true,
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

    if (!rfq.purchaseRequest) {
      return reply.code(404).send({ error: 'Purchase request not found for this RFQ' });
    }

    // Khóa RFQ khi đã submit/so sánh: không cho upload thêm file báo giá
    if (rfq.status === 'READY_FOR_COMPARISON' as any || rfq.status === 'CLOSED' as any) {
      return reply.code(403).send({
        error: 'RFQ đã được submit và bị khóa. Không thể upload thêm file báo giá.',
        currentStatus: rfq.status,
      });
    }

    // Find quotation - use provided quotationId or find latest
    let quotation;
    if (quotationId) {
      quotation = await prisma.quotation.findUnique({
        where: { id: quotationId },
        include: {
          rfq: {
            include: {
              purchaseRequest: {
                select: {
                  companyId: true,
                },
              },
            },
          },
        },
      });

      if (!quotation) {
        return reply.code(404).send({ error: 'Quotation not found' });
      }

      // Verify quotation belongs to this RFQ
      if (quotation.rfqId !== rfqId) {
        return reply.code(400).send({ error: 'Quotation does not belong to this RFQ' });
      }
    } else {
      // Find latest quotation for this RFQ
      const latestQuotation = await prisma.quotation.findFirst({
        where: {
          rfqId,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          rfq: {
            include: {
              purchaseRequest: {
                select: {
                  companyId: true,
                },
              },
            },
          },
        },
      });

      if (!latestQuotation) {
        return reply.code(404).send({ 
          error: 'No quotation found for this RFQ. Please create a quotation first.',
          message: 'Vui lòng tạo báo giá từ PR trước khi upload file. Bạn có thể tạo báo giá từ trang "PR được phân công" hoặc "Nhập báo giá".'
        });
      }

      quotation = latestQuotation;
    }

    // Now process file buffers (after we have rfq and quotation with companyId)
    const uploadedFiles: Array<{
      key: string;
      url: string;
      filename: string;
      size: number;
      contentType: string;
    }> = [];
    
    // Import storage utilities from s3 config
    const { generateFileKey, uploadFile, getFileUrl } = await import('../config/s3');
    
    for (const fileData of fileBuffers) {
      const key = generateFileKey('attachment', fileData.filename, rfq.purchaseRequest?.companyId || null, userId);
      await uploadFile(key, fileData.buffer, fileData.contentType);
      const url = await getFileUrl(key);
      
      uploadedFiles.push({
        key,
        url,
        filename: fileData.filename,
        size: fileData.buffer.length,
        contentType: fileData.contentType,
      });
    }

    // Validate files were uploaded
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return reply.code(400).send({ 
        error: 'No files uploaded. Please select at least one file.' 
      });
    }

    // Create attachment records
    const attachments = await Promise.all(
      uploadedFiles.map(file =>
        prisma.quotationAttachment.create({
          data: {
            quotationId: quotation.id,
            fileKey: file.key,
            fileUrl: file.url,
            fileName: file.filename,
            fileSize: file.size,
            contentType: file.contentType,
            companyId: rfq.purchaseRequest?.companyId || null,
          },
        })
      )
    );

    reply.code(201).send({
      quotationId: quotation.id,
      rfqId: rfq.id,
      attachments: attachments.map(a => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileSize: a.fileSize,
        contentType: a.contentType,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('Upload quotation attachments by RFQ error:', error);
    console.error('Error stack:', error.stack);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// Delete Quotation Attachment
export const deleteQuotationAttachment = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { attachmentId } = request.params as { attachmentId: string };

    // Check if attachment exists and belongs to buyer's quotation
    const attachment = await prisma.quotationAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        quotation: {
          include: {
            rfq: true,
          },
        },
      },
    });

    if (!attachment) {
      return reply.code(404).send({ error: 'Attachment not found' });
    }

    if (attachment.quotation.rfq.buyerId !== userId) {
      return reply.code(403).send({ error: 'Access denied' });
    }

    // Soft delete
    await prisma.quotationAttachment.update({
      where: { id: attachmentId },
      data: {
        deletedAt: new Date(),
      },
    });

    reply.send({
      message: 'Attachment deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete quotation attachment error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};


