import { FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditCreate, auditUpdate } from '../utils/audit';
import { z } from 'zod';
import { createNotification, NotificationTemplates } from '../utils/notifications';
import { getIO } from '../utils/getIO';
import { prSalesPOSelect, serializePRSalesOrder } from '../utils/prSalesOrder';
import {
  buildBusinessTimeline,
  buildBusinessTimelineFromPrStatus,
  buildCurrentStepBadge,
  buildDeliverySummary,
  buildProcurementListSnapshot,
  computeProcurementCostInsight,
  enrichProcurementCostInsight,
  computeTrackingSla,
  isReadyForStockIssuePickup,
  type PurchaseOrderCostInput,
  type SupplierSelectionCostInput,
  deriveItemProcurementRow,
  getRequestorPrStatusLabel,
} from '../utils/requestorProcurementTracking';
import { generateFileKey, getFileUrl, uploadFile } from '../config/s3';
import {
  allocateNextCounter,
  peekNextCounter,
  prSequenceKey,
  scanMaxPRSeq,
  scanMaxSalesPOSuffix,
  soSequenceKey,
} from '../utils/documentSequence';

/** JSON có thể gửi "", null hoặc string cho số — chuẩn hoá trước khi validate */
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

const optionalTrimmedString = z.preprocess(
  emptyToUndefined,
  z.string().trim().optional()
);

// Validation schemas
const createPRSchema = z.object({
  department: z.string().trim().min(1),
  type: z.enum(['COMMERCIAL', 'PRODUCTION', 'PROJECT', 'OFFICE']).default('PRODUCTION'),
  requiredDate: z.preprocess(emptyToUndefined, z.string().optional()),
  currency: z.string().default('VND'),
  tax: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  notes: optionalTrimmedString,
  // Phần 1 — Liên kết Customer PO (chọn từ dropdown → thông tin dự án read-only)
  salesPOId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  // Denormalized (dùng khi không chọn Sales PO / PR nội bộ)
  customerPO: optionalTrimmedString,
  projectCode: optionalTrimmedString,
  projectName: optionalTrimmedString,
  customerName: optionalTrimmedString,
  salesPersonId: optionalTrimmedString,
  purpose: optionalTrimmedString,
  items: z
    .array(
      z.object({
        description: z.preprocess(
          (v) => (typeof v === 'string' ? v.trim() : v),
          z.string().min(1)
        ),
        partNo: z.preprocess(
          (v) => (typeof v === 'string' ? v.trim() : v),
          z.string().min(1, 'Chọn mã vật tư từ danh mục hoặc tạo mới')
        ),
        spec: optionalTrimmedString,
        manufacturer: optionalTrimmedString,
        qty: z.coerce.number().positive(),
        unit: z.preprocess(
          (v) => (typeof v === 'string' ? v.trim() : v),
          z.string().min(1, 'Thiếu đơn vị')
        ),
        /** Requestor không nhập giá — Buyer xác định sau */
        unitPrice: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
        /** Giá dự kiến VND (requestor / tham chiếu dự toán) — tách khỏi unitPrice do buyer báo giá */
        estimatedUnitPriceVnd: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
        /** Ngày mong muốn giao (YYYY-MM-DD) */
        desiredDeliveryDate: z.preprocess(emptyToUndefined, z.string().trim().optional()),
        purpose: optionalTrimmedString,
        remark: optionalTrimmedString,
      })
    )
    .min(1),
  action: z.enum(['SAVE', 'SUBMIT']).default('SAVE'),
});

const updatePRSchema = createPRSchema
  .omit({ department: true })
  .partial()
  .extend({
    action: z.enum(['UPDATE', 'RESUBMIT']).default('UPDATE'),
  });

/** Requestor chỉnh sửa dòng bị Trưởng phòng yêu cầu revision (không replace toàn bộ PR). */
const resubmitDepartmentRevisionItemSchema = z.object({
  description: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(1)),
  partNo: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(1)),
  spec: optionalTrimmedString,
  manufacturer: optionalTrimmedString,
  qty: z.coerce.number().positive(),
  unit: z.preprocess((v) => (typeof v === 'string' ? v.trim() : v), z.string().min(1)),
  estimatedUnitPriceVnd: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  desiredDeliveryDate: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  purpose: optionalTrimmedString,
  remark: optionalTrimmedString,
});

type UploadedAttachmentInput = {
  lineNo?: number;
  filename: string;
  contentType: string;
  buffer: Buffer;
};

const LOCAL_ATTACHMENT_ROOT = path.resolve(process.cwd(), 'uploads', 'attachments');

const storeAttachmentLocal = async (
  purchaseRequestId: string,
  fileName: string,
  fileBuffer: Buffer
) => {
  const safeName = fileName.replace(/[^\w.\-]+/g, '_');
  const relativeKey = `local/${purchaseRequestId}/${Date.now()}-${randomUUID()}-${safeName}`;
  const absolutePath = path.join(LOCAL_ATTACHMENT_ROOT, relativeKey.replace(/^local\//, ''));
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, fileBuffer);
  return relativeKey;
};

async function parseCreatePRRequest(
  request: AuthenticatedRequest
): Promise<{ body: z.infer<typeof createPRSchema>; attachments: UploadedAttachmentInput[] }> {
  const req = request as AuthenticatedRequest & {
    isMultipart?: (() => boolean) | boolean;
    parts?: () => AsyncIterable<any>;
  };
  const canReadParts = typeof req.parts === 'function';
  const contentType = String(request.headers['content-type'] ?? '').toLowerCase();
  const isMultipartRequest = contentType.includes('multipart/form-data');
  if (!canReadParts || !isMultipartRequest) {
    return {
      body: createPRSchema.parse(request.body),
      attachments: [],
    };
  }

  let payloadRaw: unknown = null;
  const formFields: Record<string, unknown> = {};
  const attachments: UploadedAttachmentInput[] = [];
  const parts = req.parts!();
  for await (const part of parts) {
    if (part.type === 'field') {
      formFields[part.fieldname] = part.value;
      if (part.fieldname === 'payload') {
        payloadRaw = part.value;
      }
      continue;
    }
    if (part.type !== 'file') continue;
    const buffer = await part.toBuffer();
    const filename = part.filename || 'attachment';
    const contentType = part.mimetype || 'application/octet-stream';
    const lineNoRaw = String(part.fieldname || '').match(/^itemAttachment:(\d+)$/);
    attachments.push({
      lineNo: lineNoRaw ? Number(lineNoRaw[1]) : undefined,
      filename,
      contentType,
      buffer,
    });
  }

  const unwrapPayloadLike = (v: unknown): unknown => {
    if (v == null) return v;
    if (typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
      return (v as Record<string, unknown>).value;
    }
    return v;
  };
  const parseUnknownPayload = (v: unknown): unknown => {
    const u = unwrapPayloadLike(v);
    if (typeof u === 'string') {
      const raw = u.trim();
      if (!raw) return {};
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return u;
  };

  let payloadObj: unknown = parseUnknownPayload(payloadRaw);
  if (payloadObj == null || (typeof payloadObj === 'object' && Object.keys(payloadObj as object).length === 0)) {
    const bodyAny = request.body as Record<string, unknown> | undefined;
    payloadObj = parseUnknownPayload(bodyAny?.payload ?? bodyAny);
  }
  if (payloadObj == null || (typeof payloadObj === 'object' && Object.keys(payloadObj as object).length === 0)) {
    // Fallback cuối: dựng từ field rời trong multipart form.
    const candidate: Record<string, unknown> = { ...formFields };
    if (typeof candidate.items === 'string') {
      try {
        candidate.items = JSON.parse(candidate.items);
      } catch {
        /* ignore */
      }
    }
    payloadObj = candidate;
  }
  return {
    body: createPRSchema.parse(payloadObj),
    attachments,
  };
}

const normalizeDepartmentCode = (raw: string) =>
  raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '');

const ALLOWED_SITE_CODES = new Set(['HCM', 'HN', 'QN']);
const normalizeSiteCode = (raw?: string | null) => {
  const value = String(raw ?? '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (ALLOWED_SITE_CODES.has(value)) return value;
  return 'HCM';
};

const getYYYYMMDD = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
};

/** Xem trước / cấp số PR — luôn tăng dần theo ngày + phòng, không lấp lỗ (không trùng khi concurrent). */
const generatePRNumberPreview = async (department: string, siteCode?: string | null): Promise<string> => {
  const dept = normalizeDepartmentCode(department);
  const site = normalizeSiteCode(siteCode);
  const yyyymmdd = getYYYYMMDD();
  const key = prSequenceKey(dept, yyyymmdd, site);
  const next = await peekNextCounter(prisma, key, () => scanMaxPRSeq(prisma, dept, yyyymmdd, site));
  return `${site}-${dept}-${yyyymmdd}-${String(next).padStart(4, '0')}`;
};

// Get Next PR Number (preview)
export const getNextPRNumber = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { department } = request.query as { department?: string };
    if (!department) {
      return reply.code(400).send({ error: 'department is required' });
    }

    const requestorUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { location: true },
    });
    const prNumber = await generatePRNumberPreview(department, requestorUser?.location);
    reply.send({ prNumber });
  } catch (error: any) {
    console.error('Get next PR number error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Requestor Dashboard
export const getRequestorDashboard = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Get all PRs for this requestor - Optimized with select only needed fields
    const prs = await prisma.purchaseRequest.findMany({
      where: {
        requestorId: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        prNumber: true,
        type: true,
        status: true,
        notes: true,
        department: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        salesPOId: true,
        customerPO: true,
        projectName: true,
        projectCode: true,
        customerName: true,
        salesPO: { select: prSalesPOSelect },
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
          select: {
            description: true,
            qty: true,
            unitPrice: true,
          },
          take: 100, // Limit items per PR to prevent large responses
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to 100 PRs for dashboard performance
    });

    // Calculate totals
    const totalPRs = prs.length;

    // Group by status
    const statusCounts: { [key: string]: number } = {};
    prs.forEach((pr) => {
      statusCounts[pr.status] = (statusCounts[pr.status] || 0) + 1;
    });

    const prsByStatus = Object.keys(statusCounts).map((status) => ({
      status,
      count: statusCounts[status],
    }));

    const typeLabelMap: { [key: string]: string } = {
      MATERIAL: 'Vật tư',
      SERVICE: 'Dịch vụ',
      COMMERCIAL: 'Thương mại',
      PRODUCTION: 'Sản xuất',
      PROJECT: 'Dự án',
      OFFICE: 'Văn phòng',
    };
    const typeCounts: { [key: string]: number } = {};
    const monthCounts: { [key: string]: number } = {};
    prs.forEach((pr) => {
      const tk = String(pr.type || 'PRODUCTION');
      typeCounts[tk] = (typeCounts[tk] || 0) + 1;
      const d = pr.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthCounts[key] = (monthCounts[key] || 0) + 1;
    });
    const prsByType = Object.keys(typeCounts).map((k) => ({
      type: typeLabelMap[k] || k,
      typeKey: k,
      count: typeCounts[k],
    }));
    const prsByMonth = Object.keys(monthCounts)
      .sort()
      .map((k) => {
        const [y, m] = k.split('-');
        return {
          monthKey: k,
          label: `Tháng ${Number(m)}/${y}`,
          count: monthCounts[k],
        };
      });

    // Get PRs that need more info
    const prsNeedMoreInfo = prs
      .filter((pr) => pr.status === 'NEED_MORE_INFO' && pr.notes)
      .map((pr) => {
        // Calculate total from items - prioritize items calculation
        let calculatedTotal = 0;
        if (pr.items.length > 0) {
          calculatedTotal = pr.items.reduce((sum, item) => {
            const qty = Number(item.qty) || 0;
            const unitPrice = Number(item.unitPrice) || 0;
            return sum + (qty * unitPrice);
          }, 0);
        }
        // Use totalAmount from DB if it exists and is greater than calculated, otherwise use calculated
        const finalTotal = (pr.totalAmount && Number(pr.totalAmount) > calculatedTotal) 
          ? Number(pr.totalAmount) 
          : calculatedTotal;
        
        // Get item name from first item with description
        let itemName = null;
        if (pr.items.length > 0) {
          // Find first item with non-empty description
          const firstItemWithDesc = pr.items.find(item => item.description && item.description.trim());
          if (firstItemWithDesc) {
            itemName = firstItemWithDesc.description.trim();
          } else {
            // If no description, show item count
            itemName = `${pr.items.length} mặt hàng`;
          }
        }
        
        return {
          id: pr.id,
          prNumber: pr.prNumber,
          itemName: itemName,
          department: pr.department || undefined,
          totalAmount: finalTotal > 0 ? finalTotal : null,
          currency: pr.currency || 'VND',
          notes: pr.notes || undefined,
        };
      });

    // Get recent PRs (last 10)
    const recentPRs = prs.slice(0, 10).map((pr) => {
      // Calculate total from items - prioritize items calculation
      let calculatedTotal = 0;
      if (pr.items.length > 0) {
        calculatedTotal = pr.items.reduce((sum, item) => {
          const qty = Number(item.qty) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          return sum + (qty * unitPrice);
        }, 0);
      }
      // Use totalAmount from DB if it exists and is greater than calculated, otherwise use calculated
      const finalTotal = (pr.totalAmount && Number(pr.totalAmount) > calculatedTotal) 
        ? Number(pr.totalAmount) 
        : calculatedTotal;
      
      // Get item name from first item with description
      let itemName = null;
      if (pr.items.length > 0) {
        // Find first item with non-empty description
        const firstItemWithDesc = pr.items.find(item => item.description && item.description.trim());
        if (firstItemWithDesc) {
          itemName = firstItemWithDesc.description.trim();
        } else {
          // If no description, show item count
          itemName = `${pr.items.length} mặt hàng`;
        }
      }
      
      return {
        id: pr.id,
        prNumber: pr.prNumber,
        itemName: itemName,
        department: pr.department || undefined,
        itemCount: pr.items.length,
        status: pr.status,
        totalAmount: finalTotal > 0 ? finalTotal : null,
        currency: pr.currency || 'VND',
        createdAt: pr.createdAt.toISOString(),
        salesOrder: serializePRSalesOrder(pr),
      };
    });

    // Ensure response is properly formatted even with empty data
    const response = {
      totalPRs,
      prsByStatus: prsByStatus || [],
      prsByType: prsByType || [],
      prsByMonth: prsByMonth || [],
      prsNeedMoreInfo: prsNeedMoreInfo || [],
      recentPRs: recentPRs || [],
    };

    return reply.code(200).send(response);
  } catch (error: any) {
    console.error('Get requestor dashboard error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get My PRs
export const getMyPRs = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const requestorId = String(userId);

    const { status } = request.query as { status?: string };
    const where: any = {
      requestorId,
      deletedAt: null,
    };
    if (status && status !== 'all') {
      where.status = status;
    }

    const prs = await prisma.purchaseRequest.findMany({
      where,
      select: {
        id: true,
        prNumber: true,
        department: true,
        requiredDate: true,
        purpose: true,
        status: true,
        notes: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        salesPOId: true,
        customerPO: true,
        projectName: true,
        projectCode: true,
        customerName: true,
        salesPO: { select: prSalesPOSelect },
        items: {
          where: { deletedAt: null },
          select: {
            id: true,
            lineNo: true,
            description: true,
            partNo: true,
            spec: true,
            manufacturer: true,
            qty: true,
            unit: true,
            unitPrice: true,
            amount: true,
            purpose: true,
            remark: true,
          },
          orderBy: { lineNo: 'asc' },
          take: 100, // Limit items per PR to prevent large responses
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to 100 PRs for performance
    });

    // Map PRs to response format
    const mappedPRs = prs.length > 0 ? prs.map((pr) => {
      const firstItem = pr.items[0];
      return {
        id: pr.id,
        prNumber: pr.prNumber,
        department: pr.department || '',
        itemName: firstItem?.description || 'N/A',
        totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
        currency: pr.currency || 'VND',
        requiredDate: pr.requiredDate ? pr.requiredDate.toISOString() : null,
        purpose: pr.purpose || null,
        status: pr.status,
        notes: pr.notes || null,
        items: pr.items.map((it) => ({
          id: it.id,
          lineNo: it.lineNo,
          description: it.description || '',
          partNo: it.partNo || undefined,
          spec: it.spec || undefined,
          manufacturer: it.manufacturer || undefined,
          qty: Number(it.qty) || 0,
          unit: it.unit || undefined,
          unitPrice: it.unitPrice ? Number(it.unitPrice) : null,
          amount: it.amount ? Number(it.amount) : null,
          estimatedUnitPriceVnd: (it as any).estimatedUnitPriceVnd != null ? Number((it as any).estimatedUnitPriceVnd) : null,
          desiredDeliveryDate: (it as any).desiredDeliveryDate
            ? new Date((it as any).desiredDeliveryDate).toISOString().slice(0, 10)
            : undefined,
          purpose: it.purpose || undefined,
          remark: it.remark || undefined,
        })),
        createdAt: pr.createdAt.toISOString(),
        updatedAt: pr.updatedAt.toISOString(),
        salesOrder: serializePRSalesOrder(pr),
      };
    }) : [];

    // Ensure response is sent properly even with empty array
    const response = { prs: mappedPRs };
    return reply.code(200).send(response);
  } catch (error: any) {
    console.error('Get my PRs error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get PR by ID
export const getPRById = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const pr = await prisma.purchaseRequest.findFirst({
      where: {
        id,
        requestorId: userId,
        deletedAt: null,
      },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
        },
        purchaseOrders: {
          where: { deletedAt: null },
          select: { totalAmount: true, status: true },
        },
        budgetExceptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { purchaseAmount: true, status: true, overPercent: true },
        },
        supplierSelections: {
          select: {
            purchaseRequestItemId: true,
            quotation: {
              select: {
                totalAmount: true,
                items: {
                  where: { deletedAt: null },
                  select: { purchaseRequestItemId: true, totalPrice: true },
                },
              },
            },
          },
        },
        salesPO: { select: prSalesPOSelect },
        requestor: {
          select: {
            id: true,
            username: true,
            email: true,
            directManagerCode: true,
          },
        },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    const prAttachments = await prisma.$queryRaw<Array<{
      id: string;
      file_name: string;
      file_url: string;
      file_size: number;
      content_type: string;
    }>>`SELECT id, file_name, file_url, file_size, content_type
        FROM purchase_request_attachments
        WHERE purchase_request_id = ${pr.id} AND deleted_at IS NULL
        ORDER BY created_at ASC`;
    const itemIds = pr.items.map((it: any) => it.id);
    const itemAttachmentRows =
      itemIds.length > 0
        ? await prisma.$queryRaw<Array<{
            id: string;
            purchase_request_item_id: string;
            file_name: string;
            file_url: string;
            file_size: number;
            content_type: string;
          }>>`SELECT id, purchase_request_item_id, file_name, file_url, file_size, content_type
              FROM purchase_request_item_attachments
              WHERE purchase_request_item_id IN (${Prisma.join(itemIds)}) AND deleted_at IS NULL
              ORDER BY created_at ASC`
        : [];
    const itemAttachmentMap = new Map<
      string,
      Array<{ id: string; fileName: string; fileUrl: string; fileSize: number; contentType: string }>
    >();
    for (const row of itemAttachmentRows) {
      const existing = itemAttachmentMap.get(row.purchase_request_item_id) ?? [];
      existing.push({
        id: row.id,
        fileName: row.file_name,
        fileUrl: `/api/requestor/prs/${pr.id}/attachments/${row.id}`,
        fileSize: Number(row.file_size ?? 0),
        contentType: row.content_type,
      });
      itemAttachmentMap.set(row.purchase_request_item_id, existing);
    }

    const firstItem = pr.items[0];
    const partNos = [
      ...new Set(pr.items.map((it: any) => it.partNo?.trim()).filter(Boolean) as string[]),
    ];
    const stockByPart = new Map<string, number>();
    if (partNos.length > 0) {
      const stockRows = await prisma.inventoryBalance.groupBy({
        by: ['partInternalCode'],
        where: { partInternalCode: { in: partNos }, companyId: null },
        _sum: { quantityAvailable: true, quantityReserved: true },
      });
      stockRows.forEach((r) => {
        const available = Number(r._sum.quantityAvailable ?? 0);
        const reserved = Number(r._sum.quantityReserved ?? 0);
        stockByPart.set(r.partInternalCode, Math.max(0, available - reserved));
      });
    }
    reply.send({
      id: pr.id,
      prNumber: pr.prNumber,
      department: pr.department || '',
      itemName: firstItem?.description || 'N/A',
      totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
      currency: pr.currency || 'VND',
      requiredDate: pr.requiredDate?.toISOString(),
      purpose: pr.purpose,
      status: pr.status,
      notes: pr.notes,
      attachments: prAttachments.map((a) => ({
        id: a.id,
        fileName: a.file_name,
        fileUrl: `/api/requestor/prs/${pr.id}/attachments/${a.id}`,
        fileSize: Number(a.file_size ?? 0),
        contentType: a.content_type,
      })),
      location: pr.location || undefined,
      salesOrder: serializePRSalesOrder(pr),
      requestor: pr.requestor ? {
        id: pr.requestor.id,
        username: pr.requestor.username,
        email: pr.requestor.email,
      } : undefined,
      items: pr.items.map((it: any) => ({
        ...(function deriveSource() {
          const qty = Number(it.qty || 0);
          const fromStockQty = Number((it as any).fromStockQty || 0);
          const purchaseQty = Number((it as any).purchaseQty || 0);
          const rawStatus = String((it as any).status || 'NEW');
          const partNo = it.partNo?.trim();
          const liveStock = partNo ? Number(stockByPart.get(partNo) ?? 0) : 0;

          // Ưu tiên dữ liệu đã split; fallback theo tồn kho hiện tại nếu item chưa split.
          if (rawStatus === 'FROM_STOCK' || (fromStockQty > 0 && purchaseQty <= 0)) {
            return {
              sourceStatus: 'FROM_STOCK',
              fromStockQty: fromStockQty > 0 ? fromStockQty : qty,
              purchaseQty: purchaseQty > 0 ? purchaseQty : 0,
            };
          }
          if (rawStatus === 'NEED_PURCHASE' || purchaseQty > 0) {
            return {
              sourceStatus: 'NEED_PURCHASE',
              fromStockQty,
              purchaseQty: purchaseQty > 0 ? purchaseQty : Math.max(0, qty - fromStockQty),
            };
          }
          // NEW / chưa split: tự đo theo tồn kho
          if (qty > 0 && partNo) {
            const from = Math.min(qty, Math.max(0, liveStock));
            const buy = Math.max(0, qty - from);
            return {
              sourceStatus: buy > 0 ? 'NEED_PURCHASE' : 'FROM_STOCK',
              fromStockQty: from,
              purchaseQty: buy,
            };
          }
          return {
            sourceStatus: 'UNKNOWN',
            fromStockQty,
            purchaseQty,
          };
        })(),
        id: it.id,
        lineNo: it.lineNo,
        description: it.description,
        partNo: it.partNo || undefined,
        spec: it.spec || undefined,
        manufacturer: it.manufacturer || undefined,
        qty: Number(it.qty),
        status: (it as any).status || 'NEW',
        unit: it.unit || undefined,
        unitPrice: it.unitPrice ? Number(it.unitPrice) : null,
        amount: it.amount ? Number(it.amount) : null,
        estimatedUnitPriceVnd: (it as any).estimatedUnitPriceVnd != null ? Number((it as any).estimatedUnitPriceVnd) : null,
        desiredDeliveryDate: (it as any).desiredDeliveryDate
          ? new Date((it as any).desiredDeliveryDate).toISOString().slice(0, 10)
          : undefined,
        attachments: itemAttachmentMap.get(it.id) ?? [],
        purpose: it.purpose || undefined,
        remark: it.remark || undefined,
        departmentItemOutcome: (it as { departmentItemOutcome?: string | null }).departmentItemOutcome ?? null,
        departmentDecisionNote: (it as { departmentDecisionNote?: string | null }).departmentDecisionNote ?? null,
        departmentRevisionSubmittedAt: (it as { departmentRevisionSubmittedAt?: Date | null })
          .departmentRevisionSubmittedAt
          ? new Date((it as { departmentRevisionSubmittedAt?: Date | null }).departmentRevisionSubmittedAt!).toISOString()
          : null,
      })),
      createdAt: pr.createdAt.toISOString(),
      updatedAt: pr.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Get PR by ID error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/** Requestor cập nhật một dòng NEED_PURCHASE đang REVISION_REQUIRED và đánh dấu đã gửi lại cho Trưởng phòng. */
export const resubmitPRItemDepartmentRevision = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id: prId, itemId } = request.params as { id: string; itemId: string };
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = resubmitDepartmentRevisionItemSchema.parse(request.body);

    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: prId, requestorId: userId, deletedAt: null },
      select: { id: true, tax: true },
    });
    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    const item = await prisma.purchaseRequestItem.findFirst({
      where: { id: itemId, purchaseRequestId: prId, deletedAt: null },
    });
    if (!item) {
      return reply.code(404).send({ error: 'Dòng PR không tồn tại' });
    }
    if (String(item.status) !== 'NEED_PURCHASE') {
      return reply.code(400).send({ error: 'Chỉ dòng cần mua mới được resubmit theo luồng này' });
    }
    if (item.departmentItemOutcome !== 'REVISION_REQUIRED') {
      return reply.code(400).send({ error: 'Dòng không đang ở trạng thái chờ chỉnh sửa' });
    }

    const desiredRaw = body.desiredDeliveryDate?.trim();
    let desiredDeliveryDate: Date | null = null;
    if (desiredRaw) {
      const iso = desiredRaw.length >= 10 ? desiredRaw.slice(0, 10) : desiredRaw;
      const d = new Date(`${iso}T00:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) desiredDeliveryDate = d;
    }

    const qtyDec = new Prisma.Decimal(body.qty);
    const est =
      body.estimatedUnitPriceVnd != null && Number.isFinite(body.estimatedUnitPriceVnd)
        ? new Prisma.Decimal(body.estimatedUnitPriceVnd)
        : null;

    const updated = await prisma.purchaseRequestItem.update({
      where: { id: itemId },
      data: {
        description: body.description,
        partNo: body.partNo,
        spec: body.spec ?? null,
        manufacturer: body.manufacturer ?? null,
        qty: qtyDec,
        fromStockQty: new Prisma.Decimal(0),
        purchaseQty: qtyDec,
        unit: body.unit,
        estimatedUnitPriceVnd: est,
        unitPrice: null,
        amount: est != null ? qtyDec.mul(est) : null,
        desiredDeliveryDate,
        purpose: body.purpose ?? null,
        remark: body.remark ?? null,
        departmentRevisionSubmittedAt: new Date(),
      },
    });

    const items = await prisma.purchaseRequestItem.findMany({
      where: { purchaseRequestId: prId, deletedAt: null },
    });
    let total = 0;
    for (const it of items) {
      const q = Number(it.qty) || 0;
      const e = Number((it as { estimatedUnitPriceVnd?: unknown }).estimatedUnitPriceVnd) || 0;
      const u = Number(it.unitPrice) || 0;
      const unit = e > 0 ? e : u;
      if (unit > 0 && q > 0) total += q * unit;
    }
    const taxRate = Number(pr.tax ?? 0);
    const totalWithTax = total * (1 + taxRate / 100);
    await prisma.purchaseRequest.update({
      where: { id: prId },
      data: { totalAmount: totalWithTax },
    });

    reply.send({
      ok: true,
      item: {
        id: updated.id,
        departmentRevisionSubmittedAt: updated.departmentRevisionSubmittedAt?.toISOString() ?? null,
      },
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: e.errors });
    }
    console.error('resubmitPRItemDepartmentRevision', e);
    reply.code(500).send({ error: e?.message || 'Internal server error' });
  }
};

// Resolve attachment URL (legacy-safe): always return fresh signed URL from file_key
export const getPRAttachmentDownload = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id: prId, attachmentId } = request.params as { id: string; attachmentId: string };
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: prId, requestorId: userId, deletedAt: null },
      select: { id: true },
    });
    if (!pr) return reply.code(404).send({ error: 'PR not found' });

    const globalRows = await prisma.$queryRaw<Array<{ file_key: string | null }>>`
      SELECT file_key
      FROM purchase_request_attachments
      WHERE id = ${attachmentId}
        AND purchase_request_id = ${prId}
        AND deleted_at IS NULL
      LIMIT 1
    `;
    let fileKey = globalRows[0]?.file_key ?? null;

    if (!fileKey) {
      const itemRows = await prisma.$queryRaw<Array<{ file_key: string | null }>>`
        SELECT pia.file_key
        FROM purchase_request_item_attachments pia
        JOIN purchase_request_items pri ON pri.id = pia.purchase_request_item_id
        WHERE pia.id = ${attachmentId}
          AND pri.purchase_request_id = ${prId}
          AND pri.deleted_at IS NULL
          AND pia.deleted_at IS NULL
        LIMIT 1
      `;
      fileKey = itemRows[0]?.file_key ?? null;
    }

    if (!fileKey) return reply.code(404).send({ error: 'Attachment not found' });

    if (fileKey.startsWith('local/')) {
      const absolutePath = path.join(LOCAL_ATTACHMENT_ROOT, fileKey.replace(/^local\//, ''));
      const file = await fs.readFile(absolutePath);
      const ext = path.extname(absolutePath).toLowerCase();
      const mime =
        ext === '.pdf'
          ? 'application/pdf'
          : ext === '.png'
            ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg'
              ? 'image/jpeg'
              : ext === '.webp'
                ? 'image/webp'
                : 'application/octet-stream';
      reply.header('Content-Type', mime);
      reply.header('Cache-Control', 'private, max-age=300');
      return reply.send(file);
    }

    const freshUrl = await getFileUrl(fileKey);
    return reply.redirect(freshUrl);
  } catch (error: any) {
    console.error('getPRAttachmentDownload error:', error);
    return reply.code(500).send({ error: 'Internal server error', message: error?.message });
  }
};

const PART_CATALOG_ROLES = ['REQUESTOR', 'DEPARTMENT_HEAD', 'SYSTEM_ADMIN', 'WAREHOUSE'];

/** Danh mục vật tư (PartMaster) — chọn khi tạo PR */
export const listPartCatalog = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const role = request.user?.role;
    if (!role || !PART_CATALOG_ROLES.includes(role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const q = String((request.query as { q?: string })?.q ?? '').trim();
    const parts = await prisma.partMaster.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { partInternalCode: { contains: q, mode: 'insensitive' } },
                { partName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { partInternalCode: 'asc' },
      take: 800,
    });
    const partCodes = [...new Set(parts.map((p) => p.partInternalCode).filter(Boolean))];
    const stockByCode = new Map<string, number>();
    if (partCodes.length > 0) {
      try {
        const stockRows = await prisma.inventoryBalance.groupBy({
          by: ['partInternalCode'],
          where: { partInternalCode: { in: partCodes }, companyId: null },
          _sum: { quantityAvailable: true, quantityReserved: true },
        });
        stockRows.forEach((row) => {
          const available = Number(row._sum.quantityAvailable ?? 0);
          const reserved = Number(row._sum.quantityReserved ?? 0);
          stockByCode.set(row.partInternalCode, Math.max(0, available - reserved));
        });
      } catch (stockErr) {
        console.error('listPartCatalog: stock aggregation skipped', stockErr);
        /* Vẫn trả danh mục vật tư; tồn kho = 0 nếu aggregate lỗi */
      }
    }

    return reply.send({
      parts: parts.map((p) => ({
        id: p.id,
        partInternalCode: p.partInternalCode,
        partName: p.partName,
        unit: p.unit,
        manufacturer: p.manufacturer ?? null,
        referenceUrl: p.referenceUrl ?? null,
        stockAvailable: stockByCode.get(p.partInternalCode) ?? 0,
      })),
    });
  } catch (error: unknown) {
    console.error('listPartCatalog', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const resolvePartCatalogBody = z.object({
  codes: z.array(z.string()).max(500),
});

/** Tra cứu danh mục + tồn kho theo danh sách mã (import PR / batch) */
export const resolvePartCatalogByCodes = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const role = request.user?.role;
    if (!role || !PART_CATALOG_ROLES.includes(role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const body = resolvePartCatalogBody.parse(request.body);
    const rawCodes = [...new Set(body.codes.map((c) => String(c ?? '').trim()).filter(Boolean))];
    if (rawCodes.length === 0) {
      return reply.send({ parts: [], notFound: [] as string[] });
    }

    const collected: Array<{
      id: string;
      partInternalCode: string;
      partName: string;
      unit: string | null;
      manufacturer: string | null;
      referenceUrl: string | null;
    }> = [];
    const seenIds = new Set<string>();
    for (let i = 0; i < rawCodes.length; i += 30) {
      const chunk = rawCodes.slice(i, i + 30);
      const rows = await prisma.partMaster.findMany({
        where: {
          companyId: null,
          OR: chunk.map((code) => ({
            partInternalCode: { equals: code, mode: 'insensitive' as const },
          })),
        },
      });
      for (const r of rows) {
        if (seenIds.has(r.id)) continue;
        seenIds.add(r.id);
        collected.push({
          id: r.id,
          partInternalCode: r.partInternalCode,
          partName: r.partName,
          unit: r.unit,
          manufacturer: r.manufacturer ?? null,
          referenceUrl: r.referenceUrl ?? null,
        });
      }
    }

    const byInsensitive = new Map<string, (typeof collected)[0]>();
    for (const p of collected) {
      byInsensitive.set(p.partInternalCode.toUpperCase(), p);
    }

    const notFoundUnique = [...new Set(rawCodes.filter((c) => !byInsensitive.has(c.toUpperCase())))];

    const partCodes = collected.map((p) => p.partInternalCode);
    const stockByCode = new Map<string, number>();
    if (partCodes.length > 0) {
      try {
        const stockRows = await prisma.inventoryBalance.groupBy({
          by: ['partInternalCode'],
          where: { partInternalCode: { in: partCodes }, companyId: null },
          _sum: { quantityAvailable: true, quantityReserved: true },
        });
        stockRows.forEach((row) => {
          const available = Number(row._sum.quantityAvailable ?? 0);
          const reserved = Number(row._sum.quantityReserved ?? 0);
          stockByCode.set(row.partInternalCode, Math.max(0, available - reserved));
        });
      } catch (stockErr) {
        console.error('resolvePartCatalogByCodes: stock aggregation skipped', stockErr);
      }
    }

    return reply.send({
      parts: collected.map((p) => ({
        id: p.id,
        partInternalCode: p.partInternalCode,
        partName: p.partName,
        unit: p.unit,
        manufacturer: p.manufacturer ?? null,
        referenceUrl: p.referenceUrl ?? null,
        stockAvailable: stockByCode.get(p.partInternalCode) ?? 0,
      })),
      notFound: notFoundUnique,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: error.errors });
    }
    console.error('resolvePartCatalogByCodes', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const createPartCatalogBody = z.object({
  partInternalCode: z.string().min(1).max(80),
  partName: z.string().min(1).max(500),
  unit: z.string().min(1).max(40),
  manufacturer: z.string().max(200).optional(),
  /** Link datasheet / spec cho buyer tham khảo khi mua */
  referenceUrl: z.string().max(2000).optional(),
});

export const createPartCatalogEntry = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const role = request.user?.role;
    if (!role || !['REQUESTOR', 'DEPARTMENT_HEAD', 'SYSTEM_ADMIN'].includes(role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const body = createPartCatalogBody.parse(request.body);
    const code = body.partInternalCode.trim();
    const exists = await prisma.partMaster.findFirst({
      where: { partInternalCode: code, companyId: null },
    });
    if (exists) {
      return reply.code(409).send({ error: `Mã vật tư "${code}" đã tồn tại trong danh mục` });
    }
    const created = await prisma.partMaster.create({
      data: {
        partInternalCode: code,
        partName: body.partName.trim(),
        unit: body.unit.trim(),
        manufacturer: body.manufacturer?.trim() || null,
        referenceUrl: body.referenceUrl?.trim() || null,
        companyId: null,
      },
    });
    return reply.code(201).send({
      part: {
        id: created.id,
        partInternalCode: created.partInternalCode,
        partName: created.partName,
        unit: created.unit,
        manufacturer: created.manufacturer,
        referenceUrl: created.referenceUrl,
        stockAvailable: 0,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation failed', details: error.errors });
    }
    console.error('createPartCatalogEntry', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

// Create PR
export const createPR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const userRole = request.user?.role;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { body, attachments } = await parseCreatePRRequest(request);

    console.log('📝 ========== CREATE PR REQUEST ==========');
    console.log('📝 User ID:', userId);
    console.log('📝 User Role:', userRole);
    console.log('📝 Body Action:', body.action);
    console.log('📝 Body Department:', body.department);

    // Get requestor's user info to check department
    const requestorUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { department: true, username: true, role: true, location: true, directManagerCode: true },
    });

    console.log('📝 Requestor User:', {
      username: requestorUser?.username,
      department: requestorUser?.department,
      role: requestorUser?.role,
      directManagerCode: requestorUser?.directManagerCode,
    });

    const directManagerCode = requestorUser?.directManagerCode?.trim();
    let directManager: { id: string; role: string; username: string } | null = null;
    if (body.action === 'SUBMIT') {
      if (!directManagerCode) {
        return reply.code(400).send({
          error: 'Thiếu direct_manager_code - không thể submit PR',
        });
      }

      directManager = await prisma.user.findFirst({
        where: {
          username: directManagerCode,
          role: 'DEPARTMENT_HEAD',
          deletedAt: null,
        },
        select: { id: true, role: true, username: true },
      });

      if (!directManager) {
        return reply.code(400).send({
          error: `Không tìm thấy quản lý trực tiếp (${directManagerCode})`,
        });
      }
    }

    // Use department from form, or fallback to requestor's department
    const prDepartment = body.department || requestorUser?.department || 'GENERAL';
    console.log('📝 Final PR Department:', prDepartment);

    // Nếu chọn Customer PO (salesPOId): lấy thông tin dự án từ SalesPO để fill denormalized
    let salesPOData: {
      customerPO: string | null;
      projectCode: string | null;
      projectName: string | null;
      customerName: string | null;
      salesPersonId: string | null;
    } = {
      customerPO: body.customerPO || null,
      projectCode: body.projectCode || null,
      projectName: body.projectName || null,
      customerName: body.customerName || null,
      salesPersonId: body.salesPersonId || null,
    };
    if (body.salesPOId) {
      const salesPO = await prisma.salesPO.findFirst({
        where: { id: body.salesPOId, deletedAt: null },
        include: { customer: true, salesUser: { select: { id: true, username: true } } },
      });
      if (salesPO) {
        salesPOData = {
          customerPO: salesPO.customerPONumber || salesPO.salesPONumber,
          projectCode: salesPO.projectCode,
          projectName: salesPO.projectName,
          customerName: salesPO.customer?.name ?? null,
          salesPersonId: salesPO.salesUserId || (salesPO.salesUser?.username ?? null),
        };
      }
    }
    console.log('📝 =======================================');

    const totalAmount = body.items.reduce((sum, it) => {
      const estimated =
        it.estimatedUnitPriceVnd != null && Number.isFinite(it.estimatedUnitPriceVnd) && it.estimatedUnitPriceVnd > 0
          ? it.estimatedUnitPriceVnd
          : 0;
      const unit =
        it.unitPrice != null && Number.isFinite(it.unitPrice) && it.unitPrice > 0
          ? it.unitPrice
          : 0;
      const baselineUnitPrice = estimated > 0 ? estimated : unit;
      return sum + (it.qty || 0) * baselineUnitPrice;
    }, 0);
    const taxAmount = totalAmount * ((body.tax || 0) / 100);
    const totalWithTax = totalAmount + taxAmount;

    const firstItem = body.items[0];
    const itemName = firstItem?.description || 'N/A';
    const firstItemQty = firstItem?.qty || 0;
    const firstItemUnit = firstItem?.unit || '';

    // Số PR: cấp nguyên tử trong transaction (không trùng khi nhiều request song song)
    let pr;
    pr = await prisma.$transaction(
      async (tx) => {
        // Chỉ khi SUBMIT mới ghi part mới vào master data (tránh rác khi user mới nhập tạm trên UI).
        if (body.action === 'SUBMIT') {
          const partSeedMap = new Map<
            string,
            { partName: string; unit: string; manufacturer: string | null; referenceUrl: string | null }
          >();
          for (const it of body.items) {
            const code = String(it.partNo ?? '').trim();
            if (!code) continue;
            if (!partSeedMap.has(code)) {
              partSeedMap.set(code, {
                partName: String(it.description ?? '').trim() || code,
                unit: String(it.unit ?? '').trim() || 'pcs',
                manufacturer: it.manufacturer?.trim() || null,
                referenceUrl: it.spec?.trim() || null,
              });
            }
          }

          for (const [code, seed] of partSeedMap.entries()) {
            const exists = await tx.partMaster.findFirst({
              where: { partInternalCode: code, companyId: null },
            });
            if (exists) continue;
            await tx.partMaster.create({
              data: {
                companyId: null,
                partInternalCode: code,
                partName: seed.partName,
                unit: seed.unit,
                manufacturer: seed.manufacturer,
                referenceUrl: seed.referenceUrl,
              },
            });
          }
        }

        const dept = normalizeDepartmentCode(prDepartment);
        const site = normalizeSiteCode(requestorUser?.location);
        const yyyymmdd = getYYYYMMDD();
        const key = prSequenceKey(dept, yyyymmdd, site);
        const seq = await allocateNextCounter(tx, key, () => scanMaxPRSeq(tx, dept, yyyymmdd, site));
        const prNumber = `${site}-${dept}-${yyyymmdd}-${String(seq).padStart(4, '0')}`;

        const created = await tx.purchaseRequest.create({
          data: {
            prNumber,
            requestorId: userId,
            department: prDepartment,
            type: body.type || 'PRODUCTION',
            itemName: itemName,
            specifications: firstItem?.spec || null,
            quantity: firstItemQty,
            unit: firstItemUnit,
            requiredDate: body.requiredDate ? new Date(body.requiredDate) : null,
            notes: body.notes,
            purpose: body.purpose || null,
            salesPOId: body.salesPOId || null,
            customerPO: salesPOData.customerPO,
            projectCode: salesPOData.projectCode,
            projectName: salesPOData.projectName,
            customerName: salesPOData.customerName,
            salesPersonId: salesPOData.salesPersonId,
            status: body.action === 'SUBMIT' ? 'MANAGER_PENDING' : 'DRAFT',
            location: requestorUser?.location || null,
            totalAmount: totalWithTax,
            currency: body.currency || 'VND',
            tax: body.tax || null,
            items: {
              create: body.items.map((it, idx) => {
                const itemQty = it.qty || 0;
                const hasPrice = it.unitPrice != null && it.unitPrice > 0;
                const itemUnitPrice = hasPrice ? it.unitPrice! : null;
                const estimatedUnitPrice =
                  it.estimatedUnitPriceVnd != null && Number.isFinite(it.estimatedUnitPriceVnd) && it.estimatedUnitPriceVnd > 0
                    ? Number(it.estimatedUnitPriceVnd)
                    : 0;
                const itemAmount =
                  estimatedUnitPrice > 0
                    ? itemQty * estimatedUnitPrice
                    : hasPrice
                      ? itemQty * Number(it.unitPrice)
                      : null;
                const desiredRaw = it.desiredDeliveryDate?.trim();
                let desiredDeliveryDate: Date | null = null;
                if (desiredRaw) {
                  const iso = desiredRaw.length >= 10 ? desiredRaw.slice(0, 10) : desiredRaw;
                  const d = new Date(`${iso}T00:00:00.000Z`);
                  if (!Number.isNaN(d.getTime())) desiredDeliveryDate = d;
                }
                const est =
                  it.estimatedUnitPriceVnd != null && Number.isFinite(it.estimatedUnitPriceVnd)
                    ? new Prisma.Decimal(it.estimatedUnitPriceVnd)
                    : null;
                return {
                  lineNo: idx + 1,
                  description: it.description,
                  partNo: it.partNo,
                  spec: it.spec,
                  manufacturer: it.manufacturer,
                  qty: itemQty,
                  fromStockQty: 0,
                  purchaseQty: itemQty,
                  status: 'NEED_PURCHASE',
                  unit: it.unit,
                  unitPrice: itemUnitPrice,
                  amount: itemAmount,
                  estimatedUnitPriceVnd: est,
                  desiredDeliveryDate,
                  purpose: it.purpose,
                  remark: it.remark,
                };
              }),
            },
          },
          include: {
            items: {
              where: { deletedAt: null },
              orderBy: { lineNo: 'asc' },
            },
            salesPO: { select: prSalesPOSelect },
          },
        });

        if (body.action === 'SUBMIT') {
          const activeItems = await tx.purchaseRequestItem.findMany({
            where: { purchaseRequestId: created.id, deletedAt: null },
            orderBy: { lineNo: 'asc' },
          });
          for (const item of activeItems) {
            const qty = Number(item.qty || 0);
            await tx.purchaseRequestItem.update({
              where: { id: item.id },
              data: {
                fromStockQty: 0,
                purchaseQty: qty,
                status: 'NEED_PURCHASE',
              } as any,
            });
          }
        }

        return tx.purchaseRequest.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            items: {
              where: { deletedAt: null },
              orderBy: { lineNo: 'asc' },
            },
            salesPO: { select: prSalesPOSelect },
          },
        });
      },
      { maxWait: 10000, timeout: 60000 }
    );

    if (!pr) {
      return reply.code(500).send({
        error: 'Không thể tạo PR. Vui lòng thử lại sau.',
      });
    }

    if (attachments.length > 0) {
      const itemByLineNo = new Map<number, string>();
      pr.items.forEach((it) => itemByLineNo.set(it.lineNo, it.id));
      for (const file of attachments) {
        let key = generateFileKey('attachment', file.filename, pr.companyId || null, userId);
        try {
          await uploadFile(key, file.buffer, file.contentType);
        } catch (uploadErr) {
          console.error('createPR attachment upload S3 failed, using local fallback:', uploadErr);
          key = await storeAttachmentLocal(pr.id, file.filename, file.buffer);
        }

        if (file.lineNo && itemByLineNo.has(file.lineNo)) {
          const attachmentId = randomUUID();
          const internalUrl = `/api/requestor/prs/${pr.id}/attachments/${attachmentId}`;
          await prisma.$executeRaw`
            INSERT INTO purchase_request_item_attachments
              (id, company_id, purchase_request_item_id, file_key, file_url, file_name, file_size, content_type)
            VALUES
              (${attachmentId}, ${pr.companyId || null}, ${itemByLineNo.get(file.lineNo)!}, ${key}, ${internalUrl}, ${file.filename}, ${file.buffer.length}, ${file.contentType})
          `;
        } else {
          const attachmentId = randomUUID();
          const internalUrl = `/api/requestor/prs/${pr.id}/attachments/${attachmentId}`;
          await prisma.$executeRaw`
            INSERT INTO purchase_request_attachments
              (id, company_id, purchase_request_id, file_key, file_url, file_name, file_size, content_type)
            VALUES
              (${attachmentId}, ${pr.companyId || null}, ${pr.id}, ${key}, ${internalUrl}, ${file.filename}, ${file.buffer.length}, ${file.contentType})
          `;
        }
      }
    }

    // Audit log
    await auditCreate('purchase_requests', pr.id, userId, pr);

    // Debug: Log PR creation details
    console.log('📋 ========== PR CREATED ==========');
    console.log('📋 PR Number:', pr.prNumber);
    console.log('📋 PR ID:', pr.id);
    console.log('📋 PR Status:', pr.status);
    console.log('📋 Body Action:', body.action);
    console.log('📋 User Role:', userRole);
    console.log('📋 PR Department:', prDepartment);
    console.log('📋 Condition check - body.action === "SUBMIT":', body.action === 'SUBMIT');
    console.log('📋 Condition check - pr.status === "MANAGER_PENDING":', pr.status === 'MANAGER_PENDING');
    console.log('📋 Will send notification?', body.action === 'SUBMIT' && pr.status === 'MANAGER_PENDING');
    console.log('📋 ====================================');

    // Send notification to Direct Manager when PR is submitted
    if (body.action === 'SUBMIT' && pr.status === 'MANAGER_PENDING') {
      try {
        console.log('🔔 ========== SENDING NOTIFICATION ==========');
        console.log('🔔 PR Number:', pr.prNumber);
        console.log('🔔 PR ID:', pr.id);
        console.log('🔔 PR Department:', prDepartment);
        console.log('🔔 PR Status:', pr.status);
        console.log('🔔 Requestor ID:', userId);
        if (!directManager) {
          console.error('❌ ERROR: Direct Manager not found, notification skipped');
          console.log('🔔 ==========================================');
          return;
        }

        if (directManager.id === userId) {
          console.log('⚠️ Direct Manager is the same as Requestor, skipping notification');
          console.log('🔔 ==========================================');
          return;
        }

        const template = NotificationTemplates.PR_PENDING_APPROVAL(pr.prNumber, requestorUser?.username || 'N/A');
        console.log('🔔 Notification template:', template);

        const io = getIO();
        console.log('🔔 Socket.IO instance:', io ? '✅ Available' : '❌ NULL');
        if (!io) {
          console.error('❌ ERROR: Socket.IO instance is NULL! Cannot emit notification.');
        }

        const notificationId = await createNotification(io, {
          userId: directManager.id,
          role: directManager.role,
          type: 'PR_PENDING_APPROVAL',
          title: template.title,
          message: template.message,
          relatedId: pr.id,
          relatedType: 'PR',
          metadata: { prNumber: pr.prNumber, requestorName: requestorUser?.username },
          companyId: pr.companyId,
        });

        console.log('✅ Notification created with ID:', notificationId);
        console.log('🔔 ==========================================');
      } catch (notificationError: any) {
        // Log but don't fail PR creation if notification fails
        console.error('❌ ERROR: Failed to send notification:', notificationError);
        console.error('❌ Error stack:', notificationError.stack);
        console.log('🔔 ==========================================');
      }
    } else {
      console.log('🔔 Notification skipped - action:', body.action, 'status:', pr.status);
    }

    const createdFirstItem = pr.items[0];
    reply.code(201).send({
      id: pr.id,
      prNumber: pr.prNumber,
      department: pr.department || '',
      itemName: createdFirstItem?.description || 'N/A',
      totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
      currency: pr.currency || 'VND',
      requiredDate: pr.requiredDate?.toISOString(),
      status: pr.status,
      notes: pr.notes,
      salesOrder: serializePRSalesOrder(pr as any),
      items: (pr.items ?? []).map((it: any) => ({
        id: it.id,
        lineNo: it.lineNo,
        description: it.description,
        partNo: it.partNo || undefined,
        spec: it.spec || undefined,
        manufacturer: it.manufacturer || undefined,
        qty: Number(it.qty),
        fromStockQty: Number((it as any).fromStockQty || 0),
        purchaseQty: Number((it as any).purchaseQty || 0),
        status: (it as any).status || 'NEW',
        unit: it.unit || undefined,
        estimatedUnitPriceVnd: it.estimatedUnitPriceVnd != null ? Number(it.estimatedUnitPriceVnd) : null,
        desiredDeliveryDate: it.desiredDeliveryDate
          ? new Date(it.desiredDeliveryDate).toISOString().slice(0, 10)
          : undefined,
        purpose: it.purpose || undefined,
        remark: it.remark || undefined,
      })),
      createdAt: pr.createdAt.toISOString(),
      updatedAt: pr.updatedAt.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Create PR error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

export const uploadPRAttachments = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const pr = await prisma.purchaseRequest.findFirst({
      where: { id, requestorId: userId, deletedAt: null },
      include: { items: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } } },
    });
    if (!pr) return reply.code(404).send({ error: 'PR not found' });

    const req = request as AuthenticatedRequest & { parts?: () => AsyncIterable<any> };
    if (!req.parts) {
      return reply.code(200).send({ success: true, uploaded: 0, skipped: 'no_multipart_reader' });
    }
    const lineToItemId = new Map<number, string>();
    pr.items.forEach((it: any) => lineToItemId.set(Number(it.lineNo), it.id));

    let created = 0;
    let parts: AsyncIterable<any>;
    try {
      parts = req.parts();
    } catch {
      return reply.code(200).send({ success: true, uploaded: 0, skipped: 'invalid_content_type' });
    }
    for await (const part of parts) {
      if (part.type !== 'file') continue;
      const fileBuffer = await part.toBuffer();
      const filename = part.filename || 'attachment';
      const contentType = part.mimetype || 'application/octet-stream';
      let key = generateFileKey('attachment', filename, pr.companyId || null, userId);
      try {
        await uploadFile(key, fileBuffer, contentType);
      } catch (uploadErr) {
        console.error('uploadPRAttachments S3 failed, using local fallback:', uploadErr);
        key = await storeAttachmentLocal(pr.id, filename, fileBuffer);
      }

      const lineNoMatch = String(part.fieldname || '').match(/^itemAttachment:(\d+)$/);
      if (lineNoMatch) {
        const itemId = lineToItemId.get(Number(lineNoMatch[1]));
        if (itemId) {
          const attachmentId = randomUUID();
          const internalUrl = `/api/requestor/prs/${pr.id}/attachments/${attachmentId}`;
          await prisma.$executeRaw`
            INSERT INTO purchase_request_item_attachments
              (id, company_id, purchase_request_item_id, file_key, file_url, file_name, file_size, content_type)
            VALUES
              (${attachmentId}, ${pr.companyId || null}, ${itemId}, ${key}, ${internalUrl}, ${filename}, ${fileBuffer.length}, ${contentType})
          `;
          created += 1;
          continue;
        }
      }

      const attachmentId = randomUUID();
      const internalUrl = `/api/requestor/prs/${pr.id}/attachments/${attachmentId}`;
      await prisma.$executeRaw`
        INSERT INTO purchase_request_attachments
          (id, company_id, purchase_request_id, file_key, file_url, file_name, file_size, content_type)
        VALUES
          (${attachmentId}, ${pr.companyId || null}, ${pr.id}, ${key}, ${internalUrl}, ${filename}, ${fileBuffer.length}, ${contentType})
      `;
      created += 1;
    }

    return reply.code(201).send({ success: true, uploaded: created });
  } catch (error: any) {
    if (error?.code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
      return reply.code(200).send({ success: true, uploaded: 0, skipped: 'invalid_content_type' });
    }
    console.error('uploadPRAttachments error:', error);
    return reply.code(500).send({ error: 'Upload attachment thất bại', message: error?.message });
  }
};

// Update PR
export const updatePR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Check if PR exists and belongs to user
    const existingPR = await prisma.purchaseRequest.findFirst({
      where: {
        id,
        requestorId: userId,
        deletedAt: null,
      },
    });

    if (!existingPR) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    // Only allow editing if status is DRAFT or NEED_MORE_INFO
    if (existingPR.status !== 'DRAFT' && existingPR.status !== 'NEED_MORE_INFO') {
      return reply.code(403).send({ error: 'PR cannot be edited in current status' });
    }

    const body = updatePRSchema.parse(request.body);

    const updateData: any = {};
    if (body.requiredDate) updateData.requiredDate = new Date(body.requiredDate);
    if (body.notes !== undefined) updateData.notes = body.notes;

    if (body.action === 'RESUBMIT') {
      // Nếu PR bị trả ở cấp quản lý trực tiếp hoặc GĐ chi nhánh, resubmit về cấp quản lý trực tiếp
      if (existingPR.status === 'MANAGER_RETURNED' || existingPR.status === 'BRANCH_MANAGER_RETURNED') {
        updateData.status = 'MANAGER_PENDING';
      } else {
        updateData.status = 'MANAGER_PENDING';
      }
    }

    // Calculate total amount if items are updated
    if (body.items && body.items.length > 0) {
      const totalAmount = body.items.reduce((sum, it) => {
        const estimated =
          it.estimatedUnitPriceVnd != null && Number.isFinite(it.estimatedUnitPriceVnd) && it.estimatedUnitPriceVnd > 0
            ? it.estimatedUnitPriceVnd
            : 0;
        const unit =
          it.unitPrice != null && Number.isFinite(it.unitPrice) && it.unitPrice > 0
            ? it.unitPrice
            : 0;
        const baselineUnitPrice = estimated > 0 ? estimated : unit;
        return sum + (it.qty || 0) * baselineUnitPrice;
      }, 0);
      const taxAmount = totalAmount * ((body.tax || existingPR.tax || 0) / 100);
      const totalWithTax = totalAmount + taxAmount;
      updateData.totalAmount = totalWithTax;
      if (body.currency) updateData.currency = body.currency;
      if (body.tax !== undefined) updateData.tax = body.tax;
    }

    const pr = await prisma.purchaseRequest.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
        },
      },
    });

    // Update items if provided
    if (body.items && body.items.length > 0) {
      // Soft delete existing items
      await prisma.purchaseRequestItem.updateMany({
        where: { purchaseRequestId: pr.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      // Create new items
      await prisma.purchaseRequestItem.createMany({
        data: body.items.map((it, idx) => {
          const itemQty = it.qty || 0;
          const hasPrice = it.unitPrice != null && it.unitPrice > 0;
          const itemUnitPrice = hasPrice ? it.unitPrice! : null;
          const estimatedUnitPrice =
            it.estimatedUnitPriceVnd != null && Number.isFinite(it.estimatedUnitPriceVnd) && it.estimatedUnitPriceVnd > 0
              ? Number(it.estimatedUnitPriceVnd)
              : 0;
          const itemAmount =
            estimatedUnitPrice > 0
              ? itemQty * estimatedUnitPrice
              : hasPrice
                ? itemQty * Number(it.unitPrice)
                : null;
          const desiredRaw = it.desiredDeliveryDate?.trim();
          let desiredDeliveryDate: Date | null = null;
          if (desiredRaw) {
            const iso = desiredRaw.length >= 10 ? desiredRaw.slice(0, 10) : desiredRaw;
            const d = new Date(`${iso}T00:00:00.000Z`);
            if (!Number.isNaN(d.getTime())) desiredDeliveryDate = d;
          }
          const est =
            it.estimatedUnitPriceVnd != null && Number.isFinite(it.estimatedUnitPriceVnd)
              ? new Prisma.Decimal(it.estimatedUnitPriceVnd)
              : null;
          return {
            purchaseRequestId: pr.id,
            lineNo: idx + 1,
            description: it.description,
            partNo: it.partNo,
            spec: it.spec,
            manufacturer: it.manufacturer,
            qty: itemQty,
            fromStockQty: 0,
            purchaseQty: itemQty,
            status: 'NEED_PURCHASE',
            unit: it.unit,
            unitPrice: itemUnitPrice,
            amount: itemAmount,
            estimatedUnitPriceVnd: est,
            desiredDeliveryDate,
            purpose: it.purpose,
            remark: it.remark,
          };
        }),
      });
    }

    // Audit log
    await auditUpdate('purchase_requests', pr.id, userId, existingPR, pr);

    const fresh = await prisma.purchaseRequest.findUnique({
      where: { id: pr.id },
      include: {
        items: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } },
      },
    });

    const firstItem = fresh?.items[0];
    reply.send({
      id: fresh!.id,
      prNumber: fresh!.prNumber,
      department: fresh!.department || '',
      itemName: firstItem?.description || 'N/A',
      totalAmount: fresh!.totalAmount ? Number(fresh!.totalAmount) : null,
      currency: fresh!.currency || 'VND',
      requiredDate: fresh!.requiredDate?.toISOString(),
      status: fresh!.status,
      notes: fresh!.notes,
      items: fresh!.items.map((it) => ({
        id: it.id,
        lineNo: it.lineNo,
        description: it.description,
        partNo: it.partNo || undefined,
        spec: it.spec || undefined,
        manufacturer: it.manufacturer || undefined,
        qty: Number(it.qty),
        unit: it.unit || undefined,
        unitPrice: it.unitPrice ? Number(it.unitPrice) : null,
        amount: it.amount ? Number(it.amount) : null,
        estimatedUnitPriceVnd: (it as any).estimatedUnitPriceVnd != null ? Number((it as any).estimatedUnitPriceVnd) : null,
        desiredDeliveryDate: (it as any).desiredDeliveryDate
          ? new Date((it as any).desiredDeliveryDate).toISOString().slice(0, 10)
          : undefined,
        purpose: it.purpose || undefined,
        remark: it.remark || undefined,
      })),
      createdAt: fresh!.createdAt.toISOString(),
      updatedAt: fresh!.updatedAt.toISOString(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Update PR error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get PR Tracking (single PR detail)
export const getPRTracking = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const pr = await prisma.purchaseRequest.findFirst({
      where: {
        id,
        requestorId: userId,
        deletedAt: null,
      },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
          take: 1,
        },
        assignments: {
          where: { deletedAt: null },
          include: {
            buyer: {
              select: {
                username: true,
                fullName: true,
                role: true,
                jobTitle: true,
                location: true,
                department: true,
              },
            },
          },
        },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    const status = pr.status;
    const firstItem = pr.items[0];
    const afterSubmitted = [
      'SUBMITTED',
      'DEPARTMENT_HEAD_PENDING',
      'DEPARTMENT_HEAD_APPROVED',
      'DEPARTMENT_HEAD_REJECTED',
      'DEPARTMENT_HEAD_RETURNED',
      'MANAGER_PENDING',
      'MANAGER_APPROVED',
      'MANAGER_REJECTED',
      'MANAGER_RETURNED',
      'BRANCH_MANAGER_PENDING',
      'BRANCH_MANAGER_APPROVED',
      'BRANCH_MANAGER_REJECTED',
      'BRANCH_MANAGER_RETURNED',
      'BUYER_LEADER_PENDING',
      'NEED_MORE_INFO',
      'ASSIGNED_TO_BUYER',
      'RFQ_IN_PROGRESS',
      'QUOTATION_RECEIVED',
      'SUPPLIER_SELECTED',
      'PAYMENT_DONE',
      'CANCELLED',
    ];
    const afterManagerApproved = [
      'MANAGER_APPROVED',
      'BRANCH_MANAGER_PENDING',
      'BRANCH_MANAGER_APPROVED',
      'BUYER_LEADER_PENDING',
      'ASSIGNED_TO_BUYER',
      'RFQ_IN_PROGRESS',
      'QUOTATION_RECEIVED',
      'SUPPLIER_SELECTED',
      'PAYMENT_DONE',
    ];
    const afterBuyerLeaderPending = [
      'BRANCH_MANAGER_APPROVED',
      'BUYER_LEADER_PENDING',
      'ASSIGNED_TO_BUYER',
      'RFQ_IN_PROGRESS',
      'QUOTATION_RECEIVED',
      'SUPPLIER_SELECTED',
      'PAYMENT_DONE',
    ];
    const afterAssignedToBuyer = [
      'ASSIGNED_TO_BUYER',
      'RFQ_IN_PROGRESS',
      'QUOTATION_RECEIVED',
      'SUPPLIER_SELECTED',
      'PAYMENT_DONE',
    ];

    // Build timeline (Requestor → Quản lý trực tiếp → GĐ Chi nhánh → Buyer Leader → Buyer)
    const timeline = [
      {
        status: 'Draft',
        completed: status !== 'DRAFT',
        date: pr.createdAt.toISOString(),
        handler: 'Requestor',
      },
      {
        status: 'Chờ quản lý trực tiếp duyệt',
        completed: afterSubmitted.includes(status) && !['DRAFT', 'MANAGER_PENDING', 'DEPARTMENT_HEAD_PENDING'].includes(status),
        date: [
          'MANAGER_PENDING',
          'MANAGER_APPROVED',
          'MANAGER_REJECTED',
          'MANAGER_RETURNED',
          'DEPARTMENT_HEAD_PENDING',
          'DEPARTMENT_HEAD_APPROVED',
          'DEPARTMENT_HEAD_REJECTED',
          'DEPARTMENT_HEAD_RETURNED',
        ].includes(status)
          ? pr.updatedAt.toISOString()
          : undefined,
        handler: 'Quản lý trực tiếp',
      },
      {
        status: 'Chờ GĐ Chi nhánh duyệt',
        completed: afterManagerApproved.includes(status) && !['MANAGER_APPROVED', 'DEPARTMENT_HEAD_APPROVED', 'BRANCH_MANAGER_PENDING'].includes(status),
        date: ['BRANCH_MANAGER_PENDING', 'BRANCH_MANAGER_APPROVED', 'BRANCH_MANAGER_REJECTED', 'BRANCH_MANAGER_RETURNED'].includes(status)
          ? pr.updatedAt.toISOString()
          : undefined,
        handler: 'Giám đốc Chi nhánh',
      },
      {
        status: 'Chờ Buyer Leader phân công',
        completed: afterBuyerLeaderPending.includes(status),
        date: afterBuyerLeaderPending.includes(status) ? pr.updatedAt.toISOString() : undefined,
        handler: 'Buyer Leader',
      },
      {
        status: 'Ready for RFQ',
        completed: afterAssignedToBuyer.includes(status),
        date: afterAssignedToBuyer.includes(status) ? pr.updatedAt.toISOString() : undefined,
        handler: 'Buyer',
      },
      {
        status: 'Need more info',
        completed: status === 'NEED_MORE_INFO',
        date: status === 'NEED_MORE_INFO' ? pr.updatedAt.toISOString() : undefined,
        handler: 'Buyer',
        comment: status === 'NEED_MORE_INFO' ? pr.notes || undefined : undefined,
      },
    ];

    // Current handler (display label) + detail
    let currentHandler: string | undefined;
    let currentHandlerInfo: {
      name: string;
      role: string;
      title?: string | null;
      branch?: string | null;
      department?: string | null;
    } | null = null;
    if (status === 'DRAFT' || status === 'NEED_MORE_INFO' || status === 'MANAGER_RETURNED' || status === 'DEPARTMENT_HEAD_RETURNED' || status === 'BRANCH_MANAGER_RETURNED') {
      currentHandler = 'Requestor';
    } else if (status === 'MANAGER_PENDING' || status === 'DEPARTMENT_HEAD_PENDING') {
      currentHandler = 'Quản lý trực tiếp';
    } else if (status === 'MANAGER_APPROVED' || status === 'DEPARTMENT_HEAD_APPROVED' || status === 'BRANCH_MANAGER_PENDING') {
      currentHandler = 'Giám đốc Chi nhánh';
    } else if (status === 'BUYER_LEADER_PENDING' || status === 'BRANCH_MANAGER_APPROVED') {
      currentHandler = 'Buyer Leader';
    }
    else if (status === 'SUBMITTED') currentHandler = 'Giám đốc Chi nhánh'; // Legacy
    else currentHandler = 'Buyer';

    const requestorUser = await prisma.user.findUnique({
      where: { id: pr.requestorId },
      select: { directManagerCode: true, location: true, department: true },
    });

    if (currentHandler === 'Quản lý trực tiếp') {
      const managerCode = requestorUser?.directManagerCode?.trim();
      if (managerCode) {
        const manager = await prisma.user.findFirst({
          where: { username: managerCode, role: 'DEPARTMENT_HEAD', deletedAt: null },
          select: { fullName: true, username: true, role: true, jobTitle: true, location: true, department: true },
        });
        if (manager) {
          currentHandlerInfo = {
            name: manager.fullName || manager.username,
            role: manager.role,
            title: manager.jobTitle || null,
            branch: manager.location || null,
            department: manager.department || null,
          };
        }
      }
    } else if (currentHandler === 'Giám đốc Chi nhánh') {
      const branchCode = pr.location || requestorUser?.location || null;
      const branchManager = await prisma.user.findFirst({
        where: { role: 'BRANCH_MANAGER', location: branchCode || undefined, deletedAt: null },
        select: { fullName: true, username: true, role: true, jobTitle: true, location: true, department: true },
      });
      if (branchManager) {
        currentHandlerInfo = {
          name: branchManager.fullName || branchManager.username,
          role: branchManager.role,
          title: branchManager.jobTitle || null,
          branch: branchManager.location || null,
          department: branchManager.department || null,
        };
      }
    } else if (currentHandler === 'Buyer Leader') {
      const buyerLeader = await prisma.user.findFirst({
        where: { role: 'BUYER_LEADER', deletedAt: null },
        select: { fullName: true, username: true, role: true, jobTitle: true, location: true, department: true },
      });
      if (buyerLeader) {
        currentHandlerInfo = {
          name: buyerLeader.fullName || buyerLeader.username,
          role: buyerLeader.role,
          title: buyerLeader.jobTitle || null,
          branch: buyerLeader.location || null,
          department: buyerLeader.department || null,
        };
      }
    } else if (currentHandler === 'Buyer' && pr.assignments.length > 0) {
      const assignedBuyer = pr.assignments[0]?.buyer;
      if (assignedBuyer) {
        currentHandlerInfo = {
          name: assignedBuyer.fullName || assignedBuyer.username,
          role: assignedBuyer.role,
          title: assignedBuyer.jobTitle || null,
          branch: assignedBuyer.location || null,
          department: assignedBuyer.department || null,
        };
      }
    }

    // Extract comments from notes
    const comments = pr.notes
      ? [
          {
            from: 'Buyer',
            message: pr.notes,
            date: pr.updatedAt.toISOString(),
          },
        ]
      : [];

    reply.send({
      pr: {
        id: pr.id,
        prNumber: pr.prNumber,
        department: pr.department || '',
        itemName: firstItem?.description || 'N/A',
        totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
        currency: pr.currency || 'VND',
        requiredDate: pr.requiredDate?.toISOString(),
        purpose: pr.purpose,
        status: pr.status,
        notes: pr.notes,
        createdAt: pr.createdAt.toISOString(),
        updatedAt: pr.updatedAt.toISOString(),
      },
      timeline,
      currentHandler,
      currentHandlerInfo,
      comments,
    });
  } catch (error: any) {
    console.error('Get PR tracking error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Safe decimal/number conversion for Prisma Decimal fields
const toNum = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'object' && v !== null && typeof (v as { toNumber?: () => number }).toNumber === 'function') {
    return (v as { toNumber: () => number }).toNumber();
  }
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

/** Full procurement tracking for requestor modal (items + PO + GRN + business timeline). */
export const getPRProcurementTracking = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    if (!id?.trim()) return reply.code(400).send({ error: 'Thiếu id PR' });

    const pr = await prisma.purchaseRequest.findFirst({
      where: { id: id.trim(), requestorId: userId, deletedAt: null },
      include: {
        items: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } },
        salesPO: { select: prSalesPOSelect },
        purchaseOrders: {
          where: { deletedAt: null },
          include: {
            items: true,
            supplier: { select: { name: true } },
          },
        },
        supplierSelections: {
          select: {
            purchaseRequestItemId: true,
            quotation: {
              select: {
                totalAmount: true,
                items: {
                  where: { deletedAt: null },
                  select: { purchaseRequestItemId: true, totalPrice: true },
                },
              },
            },
          },
        },
        budgetExceptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { purchaseAmount: true },
        },
      },
    });

    if (!pr) return reply.code(404).send({ error: 'PR not found' });

    const detailQuotationItemIds = [
      ...new Set(
        pr.purchaseOrders.flatMap((po) =>
          po.items
            .map((it) => it.quotationItemId)
            .filter((id): id is string => Boolean(id))
        )
      ),
    ];
    const detailQuotationItems =
      detailQuotationItemIds.length > 0
        ? await prisma.quotationItem.findMany({
            where: { id: { in: detailQuotationItemIds } },
            select: { id: true, vatPercent: true },
          })
        : [];
    const detailVatByQuotationItemId = new Map(
      detailQuotationItems.map((qi) => [
        qi.id,
        qi.vatPercent != null ? toNum(qi.vatPercent) : null,
      ])
    );

    const poLines = pr.purchaseOrders.flatMap((po) =>
      po.items.map((it) => ({
        id: it.id,
        purchaseRequestItemId: it.purchaseRequestItemId,
        qty: it.qty,
        confirmedQty: it.confirmedQty,
        expectedDeliveryDate: it.expectedDeliveryDate,
        lineStatus: it.lineStatus,
        purchaseOrder: { poNumber: po.poNumber, status: po.status as string },
      }))
    );

    const poItemIds = poLines.map((l) => l.id);
    const receivedRows =
      poItemIds.length > 0
        ? await prisma.goodsReceiptLine.groupBy({
            by: ['poItemId'],
            where: { poItemId: { in: poItemIds } },
            _sum: { qtyReceived: true },
          })
        : [];
    const receivedByPoItemId = new Map(
      receivedRows.map((r) => [r.poItemId, toNum(r._sum.qtyReceived)])
    );

    const prStatus = String(pr.status ?? '');
    const itemRows = pr.items.map((item) =>
      deriveItemProcurementRow(
        {
          id: item.id,
          lineNo: item.lineNo,
          description: item.description,
          partNo: item.partNo,
          qty: item.qty,
          status: String(item.status ?? 'NEW'),
          departmentItemOutcome: item.departmentItemOutcome,
          branchItemOutcome: item.branchItemOutcome,
          desiredDeliveryDate: item.desiredDeliveryDate,
        },
        poLines,
        receivedByPoItemId,
        prStatus
      )
    );

    const timeline = buildBusinessTimeline(prStatus, itemRows, poLines);
    const deliverySummary = buildDeliverySummary(itemRows);
    const currentStep = buildCurrentStepBadge(prStatus, itemRows, deliverySummary);
    const sla = computeTrackingSla(prStatus, timeline.percentage, pr.createdAt);

    const totalAmount = pr.totalAmount ? Number(pr.totalAmount) : null;
    let proposedCalculatedTotal = 0;
    for (const item of pr.items) {
      const qty = toNum(item.qty);
      const estimatedUnitPrice = toNum(item.estimatedUnitPriceVnd);
      const unitPrice = toNum(item.unitPrice);
      const proposedUnitPrice = estimatedUnitPrice > 0 ? estimatedUnitPrice : unitPrice;
      proposedCalculatedTotal += qty * proposedUnitPrice;
    }
    const prTotal = toNum(pr.totalAmount);
    let calculatedTotal = 0;
    for (const item of pr.items) {
      const qty = toNum(item.qty);
      const unitPrice = toNum(item.unitPrice);
      const estimatedUnitPrice = toNum(item.estimatedUnitPriceVnd);
      const effectiveUnitPrice = unitPrice > 0 ? unitPrice : estimatedUnitPrice;
      calculatedTotal += qty * effectiveUnitPrice;
    }
    const proposedAmount =
      proposedCalculatedTotal > 0
        ? proposedCalculatedTotal
        : calculatedTotal > 0
          ? calculatedTotal
          : 0;

    const costInsightBase = computeProcurementCostInsight(
      proposedAmount,
      (pr.supplierSelections || []) as SupplierSelectionCostInput[],
      (pr.purchaseOrders || []).map((po) => ({
        status: String(po.status ?? ''),
        totalAmount: po.totalAmount,
        items: po.items.map((it) => ({
          qty: it.qty,
          unitPrice: it.unitPrice,
          amount: it.amount,
          confirmedQty: it.confirmedQty,
        })),
      })) as PurchaseOrderCostInput[]
    );
    const poLinesForCost = poLines.map((l) => {
      const src = pr.purchaseOrders
        .flatMap((po) => po.items)
        .find((it) => it.id === l.id);
      const qid = src?.quotationItemId ?? null;
      return {
        id: l.id,
        unitPrice: src?.unitPrice ?? 0,
        qty: src?.qty ?? 0,
        amount: src?.amount ?? null,
        vatPercent:
          qid != null ? (detailVatByQuotationItemId.get(qid) ?? null) : null,
      };
    });
    const costInsight = enrichProcurementCostInsight(
      costInsightBase,
      deliverySummary,
      poLinesForCost,
      receivedByPoItemId
    );

    return reply.send({
      pr: {
        id: pr.id,
        prNumber: pr.prNumber,
        status: prStatus,
        statusLabel: getRequestorPrStatusLabel(prStatus),
        department: pr.department || null,
        purpose: pr.purpose || null,
        totalAmount,
        currency: (pr.currency as string) || 'VND',
        createdAt: pr.createdAt.toISOString(),
        updatedAt: pr.updatedAt.toISOString(),
        salesOrder: serializePRSalesOrder(pr),
      },
      timeline,
      currentStep,
      deliverySummary,
      items: itemRows,
      sla,
      costInsight,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('getPRProcurementTracking error:', err?.message, err?.stack);
    return reply.code(500).send({
      error: 'Internal server error',
      message: err.message,
    });
  }
};

// Get PR Tracking List (with SLA and progress) - NEW FUNCTION
export const getPRTrackingList = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const requestorId = String(userId);

    // Same filter as getMyPRs: all PRs where current user is requestor
    const prs = await prisma.purchaseRequest.findMany({
      where: {
        requestorId,
        deletedAt: null,
      },
      include: {
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
        },
        purchaseOrders: {
          where: { deletedAt: null },
          select: {
            poNumber: true,
            status: true,
            totalAmount: true,
            items: {
              select: {
                id: true,
                purchaseRequestItemId: true,
                quotationItemId: true,
                qty: true,
                unitPrice: true,
                amount: true,
                confirmedQty: true,
                expectedDeliveryDate: true,
                lineStatus: true,
              },
            },
          },
        },
        budgetExceptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { purchaseAmount: true, status: true, overPercent: true },
        },
        supplierSelections: {
          select: {
            purchaseRequestItemId: true,
            quotation: {
              select: {
                totalAmount: true,
                items: {
                  where: { deletedAt: null },
                  select: { purchaseRequestItemId: true, totalPrice: true },
                },
              },
            },
          },
        },
        salesPO: { select: prSalesPOSelect },
        requestor: {
          select: {
            id: true,
            username: true,
            email: true,
            directManagerCode: true,
          },
        },
        assignments: {
          include: {
            buyer: {
              select: {
                username: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const trackingQuotationItemIds = [
      ...new Set(
        prs.flatMap((pr) =>
          (pr.purchaseOrders || []).flatMap((po) =>
            (po.items || [])
              .map((it) => it.quotationItemId)
              .filter((id): id is string => Boolean(id))
          )
        )
      ),
    ];
    const trackingQuotationItems =
      trackingQuotationItemIds.length > 0
        ? await prisma.quotationItem.findMany({
            where: { id: { in: trackingQuotationItemIds } },
            select: { id: true, vatPercent: true },
          })
        : [];
    const vatPercentByQuotationItemId = new Map(
      trackingQuotationItems.map((qi) => [
        qi.id,
        qi.vatPercent != null ? toNum(qi.vatPercent) : null,
      ])
    );

    // Batch-fetch handlers once (avoid N+1 queries and premature stream close)
    const managerCodes = [...new Set(prs.map((p) => p.requestor?.directManagerCode?.trim()).filter(Boolean) as string[])];
    const [managers, branchManager, buyerLeader] = await Promise.all([
      managerCodes.length > 0
        ? prisma.user.findMany({
            where: { username: { in: managerCodes }, role: 'DEPARTMENT_HEAD', deletedAt: null },
            select: { username: true },
          })
        : Promise.resolve([]),
      prisma.user.findFirst({ where: { role: 'BRANCH_MANAGER', deletedAt: null }, select: { username: true } }),
      prisma.user.findFirst({ where: { role: 'BUYER_LEADER', deletedAt: null }, select: { username: true } }),
    ]);
    const managerByCode = new Map((managers || []).map((m) => [m.username, m.username]));
    const branchManagerUsername = branchManager?.username ?? null;
    const buyerLeaderUsername = buyerLeader?.username ?? null;

    const allPoItemIds: string[] = [];
    for (const pr of prs) {
      for (const po of pr.purchaseOrders || []) {
        for (const it of po.items || []) {
          allPoItemIds.push(it.id);
        }
      }
    }
    const receivedRowsGlobal =
      allPoItemIds.length > 0
        ? await prisma.goodsReceiptLine.groupBy({
            by: ['poItemId'],
            where: { poItemId: { in: allPoItemIds } },
            _sum: { qtyReceived: true },
          })
        : [];
    const receivedByPoItemIdGlobal = new Map(
      receivedRowsGlobal.map((r) => [r.poItemId, toNum(r._sum.qtyReceived)])
    );

    const prIds = prs.map((p) => p.id);
    const stockIssuesForPrs =
      prIds.length > 0
        ? await prisma.stockIssue.findMany({
            where: {
              purchaseRequestId: { in: prIds },
              requestorId,
              deletedAt: null,
            },
            select: {
              id: true,
              purchaseRequestId: true,
              issueNumber: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          })
        : [];
    const latestStockIssueByPrId = new Map<
      string,
      { id: string; issueNumber: string; status: string }
    >();
    for (const si of stockIssuesForPrs) {
      const prKey = si.purchaseRequestId;
      if (!prKey || latestStockIssueByPrId.has(prKey)) continue;
      latestStockIssueByPrId.set(prKey, {
        id: si.id,
        issueNumber: si.issueNumber,
        status: String(si.status),
      });
    }

    // Map PRs with tracking (sync, no per-PR DB calls; wrap in try/catch so one bad PR doesn't break stream)
    const prsWithTracking = prs.map((pr) => {
      try {
        const items = pr.items || [];
        let calculatedTotal = 0;
        let proposedCalculatedTotal = 0;
        if (items.length > 0) {
          calculatedTotal = items.reduce((sum, item) => {
            const qty = toNum(item.qty);
            const unitPrice = toNum(item.unitPrice);
            const estimatedUnitPrice = toNum(item.estimatedUnitPriceVnd);
            const effectiveUnitPrice = unitPrice > 0 ? unitPrice : estimatedUnitPrice;
            return sum + (qty * effectiveUnitPrice);
          }, 0);
          proposedCalculatedTotal = items.reduce((sum, item) => {
            const qty = toNum(item.qty);
            const estimatedUnitPrice = toNum(item.estimatedUnitPriceVnd);
            const unitPrice = toNum(item.unitPrice);
            const proposedUnitPrice = estimatedUnitPrice > 0 ? estimatedUnitPrice : unitPrice;
            return sum + (qty * proposedUnitPrice);
          }, 0);
        }
        const finalTotal =
          pr.totalAmount && toNum(pr.totalAmount) > calculatedTotal
            ? toNum(pr.totalAmount)
            : calculatedTotal;
        const proposedAmount =
          proposedCalculatedTotal > 0
            ? proposedCalculatedTotal
            : calculatedTotal > 0
              ? calculatedTotal
              : 0;
        const costInsightBase = computeProcurementCostInsight(
          proposedAmount,
          (pr.supplierSelections || []) as Parameters<typeof computeProcurementCostInsight>[1],
          (pr.purchaseOrders || []).map((po) => ({
            status: String(po.status ?? ''),
            totalAmount: po.totalAmount,
            items: (po.items || []).map((it) => ({
              qty: it.qty,
              unitPrice: it.unitPrice,
              amount: it.amount,
              confirmedQty: it.confirmedQty,
            })),
          }))
        );

        let itemName: string | null = null;
        if (items.length > 0) {
          const firstItemWithDesc = items.find(item => item.description && item.description.trim());
          itemName = firstItemWithDesc ? firstItemWithDesc.description.trim() : `${items.length} mặt hàng`;
        }

        const prStatus = String(pr.status ?? '');
        const poLines = (pr.purchaseOrders || []).flatMap((po) =>
          (po.items || []).map((it) => ({
            id: it.id,
            purchaseRequestItemId: it.purchaseRequestItemId,
            qty: it.qty,
            confirmedQty: it.confirmedQty,
            expectedDeliveryDate: it.expectedDeliveryDate,
            lineStatus: it.lineStatus,
            purchaseOrder: { poNumber: po.poNumber, status: String(po.status ?? '') },
          }))
        );
        const receivedByPoItemId = new Map(
          poLines.map((l) => [l.id, receivedByPoItemIdGlobal.get(l.id) ?? 0])
        );
        const prItemInputs = items.map((item) => ({
          id: item.id,
          lineNo: item.lineNo,
          description: item.description,
          partNo: item.partNo,
          qty: item.qty,
          status: String(item.status ?? 'NEW'),
          departmentItemOutcome: item.departmentItemOutcome,
          branchItemOutcome: item.branchItemOutcome,
          desiredDeliveryDate: item.desiredDeliveryDate,
        }));
        const itemRows = prItemInputs.map((item) =>
          deriveItemProcurementRow(item, poLines, receivedByPoItemId, prStatus)
        );
        const { stages, percentage: progressPercentage } =
          itemRows.length > 0 || poLines.length > 0
            ? buildBusinessTimeline(prStatus, itemRows, poLines)
            : buildBusinessTimelineFromPrStatus(prStatus);
        const currentStage = stages.find((s) => s.current) ?? stages[stages.length - 1] ?? null;

        let currentHandler: string | null = null;
        const assignments = (pr.assignments || []).filter((a) => !(a as { deletedAt?: Date | null }).deletedAt);
        if (['MANAGER_PENDING', 'MANAGER_APPROVED', 'DEPARTMENT_HEAD_PENDING', 'DEPARTMENT_HEAD_APPROVED'].includes(prStatus)) {
          const managerCode = pr.requestor?.directManagerCode?.trim();
          currentHandler = (managerCode && managerByCode.get(managerCode)) ?? null;
        } else if (prStatus === 'BRANCH_MANAGER_PENDING') {
          currentHandler = branchManagerUsername;
        } else if (['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'].includes(prStatus)) {
          currentHandler = buyerLeaderUsername;
        } else if (assignments.length > 0) {
          currentHandler = assignments[0]?.buyer?.username || null;
        }

        const createdAt = pr.createdAt ? new Date(pr.createdAt) : new Date();
        let slaStatus: 'on_time' | 'warning' | 'overdue' | 'completed' = 'on_time';
        let timeRemaining: string | null = null;
        let timeOverdue: string | null = null;

        const slaComputed = computeTrackingSla(
          prStatus,
          progressPercentage,
          createdAt
        );
        slaStatus = slaComputed.status;
        timeRemaining = slaComputed.timeRemaining;
        timeOverdue = slaComputed.timeOverdue;
        const percentConsumed = slaComputed.percentConsumed;
        const estimatedSlaDays = slaComputed.estimatedDays;

        let procurementSnapshot = buildProcurementListSnapshot(
          prStatus,
          prItemInputs,
          poLines,
          receivedByPoItemId
        );
        const poLinesForCost = poLines.map((l) => {
          const src = (pr.purchaseOrders || [])
            .flatMap((po) => po.items || [])
            .find((it) => it.id === l.id);
          const qid = src?.quotationItemId ?? null;
          return {
            id: l.id,
            unitPrice: src?.unitPrice ?? 0,
            qty: src?.qty ?? 0,
            amount: src?.amount ?? null,
            vatPercent:
              qid != null ? (vatPercentByQuotationItemId.get(qid) ?? null) : null,
          };
        });
        const costInsightComputed = enrichProcurementCostInsight(
          costInsightBase,
          {
            receivedCount: procurementSnapshot.receivedCount,
            totalCount: procurementSnapshot.totalCount,
            partialCount: procurementSnapshot.partialCount,
          },
          poLinesForCost,
          receivedByPoItemId
        );
        if (items.length > 0 && procurementSnapshot.totalCount === 0 && procurementSnapshot.itemPreview.length === 0) {
          procurementSnapshot = {
            ...procurementSnapshot,
            totalCount: items.length,
            itemPreview: itemRows.slice(0, 3).map((r) => ({
              label: r.label,
              statusLabel: r.statusLabel,
              statusKey: r.statusKey,
              eta: r.eta,
              qtyReceived: r.qtyReceived,
              qtyCap: r.qtyCap,
            })),
          };
        }

        return {
          id: pr.id,
          prNumber: pr.prNumber,
          itemName,
          purpose: pr.purpose || null,
          department: pr.department || null,
          status: prStatus,
          totalAmount: finalTotal > 0 ? finalTotal : null,
          currency: (pr.currency as string) || 'VND',
          createdAt: pr.createdAt ? (pr.createdAt as Date).toISOString() : null,
          updatedAt: pr.updatedAt ? (pr.updatedAt as Date).toISOString() : null,
          progress: {
            percentage: progressPercentage,
            stages,
            currentStage,
          },
          currentHandler,
          sla: {
            status: slaStatus,
            timeRemaining,
            timeOverdue,
            daysSinceCreated: slaComputed.daysSinceCreated,
            percentConsumed,
            estimatedDays: estimatedSlaDays,
          },
          costInsight: costInsightComputed,
          procurementSnapshot,
          salesOrder: serializePRSalesOrder(pr),
          stockIssuePickup: {
            ready: isReadyForStockIssuePickup({
              receivedCount: procurementSnapshot.receivedCount,
              totalCount: procurementSnapshot.totalCount,
              partialCount: procurementSnapshot.partialCount,
              nextEta: procurementSnapshot.nextEta,
            }),
            linkedStockIssue: latestStockIssueByPrId.get(pr.id) ?? null,
          },
        };
      } catch (err) {
        console.warn('getPRTrackingList: map PR failed', pr.id, (err as Error)?.message);
        return {
          id: pr.id,
          prNumber: pr.prNumber,
          itemName: null,
          purpose: null,
          department: pr.department || null,
          status: String(pr.status ?? ''),
          totalAmount: null,
          currency: 'VND',
          createdAt: pr.createdAt ? (pr.createdAt as Date).toISOString() : null,
          updatedAt: pr.updatedAt ? (pr.updatedAt as Date).toISOString() : null,
          progress: { percentage: 0, stages: [], currentStage: null },
          currentHandler: null,
          sla: {
            status: 'on_time' as const,
            timeRemaining: null,
            timeOverdue: null,
            daysSinceCreated: 0,
            percentConsumed: 0,
            estimatedDays: 3,
          },
          costInsight: {
            proposedAmount: null,
            procurementCostAmount: null,
            buyerTargetAmount: null,
            costSource: 'none' as const,
            isFinalized: false,
            awaitingVendorConfirm: false,
            deltaAmount: 0,
            deltaPercent: 0,
            status: 'unknown' as const,
          },
          procurementSnapshot: {
            nextEta: null,
            receivedCount: 0,
            totalCount: 0,
            partialCount: 0,
            hasDelay: false,
            delayHint: null,
            itemPreview: [],
          },
          salesOrder: serializePRSalesOrder(pr),
          stockIssuePickup: {
            ready: false,
            linkedStockIssue: null,
          },
        };
      }
    });

    const payload = { prs: Array.isArray(prsWithTracking) ? prsWithTracking : [] };
    return reply
      .code(200)
      .header('Cache-Control', 'no-store')
      .type('application/json')
      .send(payload);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Get PR Tracking List error:', err?.message, err?.stack);
    reply.code(500).send({
      error: 'Internal server error',
      message: err?.message ?? 'Unknown error',
    });
  }
};

// Submit PR (DRAFT → Approval Workflow)
// Module 2: Approval Configuration - Auto-determine approvers based on rules
export const submitPR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    console.log('📋 ========== SUBMIT PR ==========');
    console.log('📋 PR ID:', id);
    console.log('📋 User ID:', userId);

    // Get Requestor info
    const requestor = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        location: true, // branch_code
        department: true, // department_code
        directManagerCode: true,
      },
    });

    if (!requestor) {
      return reply.code(404).send({ error: 'Requestor not found' });
    }

    console.log('📋 Requestor:', {
      username: requestor.username,
      branch_code: requestor.location,
      department_code: requestor.department,
      direct_manager_code: requestor.directManagerCode,
    });

    // Check if PR exists and belongs to user
    const pr = await prisma.purchaseRequest.findFirst({
      where: {
        id,
        requestorId: userId,
        deletedAt: null,
      },
      include: {
        items: {
          where: { deletedAt: null },
        },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    // Only allow submitting if status is DRAFT
    if (pr.status !== 'DRAFT') {
      return reply.code(400).send({ error: 'PR can only be submitted from DRAFT status' });
    }

    if (pr.items.length === 0) {
      return reply.code(400).send({ error: 'PR must have at least one item' });
    }

    // ============================================
    // BƯỚC 1: DUYỆT CẤP 1 LUÔN TỒN TẠI (Direct Manager)
    // ============================================
    console.log('📋 Step 1: Finding Level 1 Approver (Direct Manager)...');

    if (!requestor.directManagerCode) {
      return reply.code(400).send({
        error: 'Thiếu direct_manager_code - không thể submit PR',
      });
    }

    const directManager = await prisma.user.findFirst({
      where: {
        username: requestor.directManagerCode,
        role: 'DEPARTMENT_HEAD',
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
      },
    });

    if (!directManager) {
      return reply.code(400).send({
        error: `Không tìm thấy quản lý trực tiếp (${requestor.directManagerCode})`,
      });
    }

    const level1ApproverId = directManager.id;
    const level1ApproverUsername = directManager.username;

    console.log('✅ Found Level 1 Approver:', {
      id: directManager.id,
      username: directManager.username,
      name: directManager.fullName,
      role: directManager.role,
    });

    const nextStatus = 'MANAGER_PENDING';

    // PR chỉ mua hàng — toàn bộ dòng NEED_PURCHASE, không reserve kho.
    const updatedPR = await prisma.$transaction(async (tx) => {
      const activeItems = await tx.purchaseRequestItem.findMany({
        where: { purchaseRequestId: id, deletedAt: null },
        orderBy: { lineNo: 'asc' },
      });
      for (const item of activeItems) {
        const qty = Number(item.qty || 0);
        await tx.purchaseRequestItem.update({
          where: { id: item.id },
          data: {
            fromStockQty: 0,
            purchaseQty: qty,
            status: 'NEED_PURCHASE',
          } as any,
        });
      }
      return tx.purchaseRequest.update({
        where: { id },
        data: {
          status: nextStatus as any,
          location: requestor.location || pr.location,
        },
      });
    });

    // Note: KHÔNG tạo PRApproval ở bước submit. PRApproval chỉ tạo khi người duyệt thực hiện APPROVE/REJECT/RETURN.

    // ============================================
    // CREATE NOTIFICATIONS
    // ============================================
    const io = getIO();
    
    if (level1ApproverId && io) {
      io.to(`user:${level1ApproverId}`).emit('notification', {
        type: 'PR_PENDING_APPROVAL',
        title: 'PR cần duyệt',
        message: `PR ${pr.prNumber} đang chờ bạn duyệt`,
        relatedId: id,
        relatedType: 'PR',
      });
      console.log('✅ Sent notification to Level 1 Approver');
    }

    // Audit log
    await auditUpdate('purchase_requests', id, userId, { status: pr.status }, { status: nextStatus });

    console.log('✅ PR submitted successfully');
    console.log('📋 Final status:', nextStatus);
    console.log('📋 =================================\n');

    reply.send({
      message: 'PR submitted successfully',
      pr: {
        id: updatedPR.id,
        prNumber: updatedPR.prNumber,
        status: updatedPR.status,
      },
      approvalFlow: {
        level1Approver: level1ApproverUsername,
        // bước 2 theo chi nhánh sẽ được quyết định SAU khi cấp 1 duyệt
        needBranchManager: null,
        level2Approver: null,
      },
    });
  } catch (error: any) {
    console.error('❌ Submit PR error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Requestor xóa/thu hồi PR đã lỡ gửi (soft delete)
export const deletePR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const pr = await prisma.purchaseRequest.findFirst({
      where: { id, requestorId: userId, deletedAt: null },
      include: { rfqs: { select: { id: true } }, purchaseOrders: { select: { id: true } } },
    });
    if (!pr) return reply.code(404).send({ error: 'PR not found' });

    const cancellableStatuses = new Set([
      'SUBMITTED',
      'MANAGER_PENDING',
      'DEPARTMENT_HEAD_PENDING',
      'BRANCH_MANAGER_PENDING',
    ]);
    if (!cancellableStatuses.has(pr.status)) {
      return reply.code(403).send({ error: 'Chỉ được xóa PR đã gửi nhưng chưa vào xử lý mua hàng.' });
    }

    if ((pr.rfqs?.length ?? 0) > 0 || (pr.purchaseOrders?.length ?? 0) > 0) {
      return reply.code(409).send({ error: 'PR đã phát sinh RFQ/PO, không thể xóa.' });
    }

    const now = new Date();
    const prItems = await prisma.purchaseRequestItem.findMany({
      where: { purchaseRequestId: id, deletedAt: null },
      select: { partNo: true },
    });
    const candidatePartCodes = Array.from(
      new Set(
        prItems
          .map((it) => String(it.partNo ?? '').trim())
          .filter(Boolean)
      )
    );
    let cleanedPartCount = 0;
    await prisma.$transaction(async (tx) => {
      await tx.purchaseRequestItem.updateMany({
        where: { purchaseRequestId: id, deletedAt: null },
        data: { deletedAt: now },
      });
      await tx.purchaseRequest.update({
        where: { id },
        data: { deletedAt: now },
      });
      await tx.notification.deleteMany({
        where: { relatedId: id, relatedType: { in: ['PR', 'PURCHASE_REQUEST'] } },
      });

      for (const partCode of candidatePartCodes) {
        const stillUsedByActivePR = await tx.purchaseRequestItem.count({
          where: { partNo: partCode, deletedAt: null },
        });
        if (stillUsedByActivePR > 0) continue;

        const stock = await tx.inventoryBalance.aggregate({
          where: { partInternalCode: partCode, companyId: null },
          _sum: { quantityAvailable: true, quantityReserved: true },
        });
        const available = Number(stock._sum.quantityAvailable ?? 0);
        const reserved = Number(stock._sum.quantityReserved ?? 0);
        const stockAvailable = Math.max(0, available - reserved);
        if (stockAvailable > 0) continue;

        const removed = await tx.partMaster.deleteMany({
          where: { partInternalCode: partCode, companyId: null },
        });
        if (removed.count > 0) cleanedPartCount += removed.count;
      }
    });

    return reply.send({ success: true, cleanedPartCount });
  } catch (error: any) {
    console.error('Delete PR error:', error);
    return reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

// Get Notifications
export const getNotifications = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Get PRs with status changes
    const prs = await prisma.purchaseRequest.findMany({
      where: {
        requestorId: userId,
        deletedAt: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 50,
    });

    // Generate notifications from PRs
    const notifications = prs.map((pr) => {
      let type = 'PR_SUBMITTED';
      let message = `PR ${pr.prNumber} đã được gửi`;

      if (pr.status === 'MANAGER_RETURNED' || pr.status === 'DEPARTMENT_HEAD_RETURNED' || pr.status === 'BRANCH_MANAGER_RETURNED' || (pr.status === 'NEED_MORE_INFO' && pr.notes)) {
        type = 'PR_RETURNED';
        message = `PR ${pr.prNumber} bị trả kèm comment`;
      } else if (pr.status === 'MANAGER_APPROVED' || pr.status === 'DEPARTMENT_HEAD_APPROVED') {
        type = 'PR_APPROVED';
        message = `PR ${pr.prNumber} đã được quản lý trực tiếp duyệt`;
      } else if (pr.status === 'BUYER_LEADER_PENDING' || pr.status === 'BRANCH_MANAGER_APPROVED') {
        type = 'PR_APPROVED';
        message = `PR ${pr.prNumber} đã được duyệt – chờ Buyer Leader phân công`;
      } else if (pr.status === 'ASSIGNED_TO_BUYER') {
        type = 'PR_READY_FOR_RFQ';
        message = `PR ${pr.prNumber} chuyển sang bước mua (Ready for RFQ)`;
      }

      return {
        id: pr.id,
        type,
        message,
        prNumber: pr.prNumber,
        comment: pr.notes || undefined,
        createdAt: pr.updatedAt.toISOString(),
      };
    });

    reply.send({ notifications });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// --- Customer PO (Sales PO) for PR dropdown — cùng chuỗi SO với module Sales ---
const generateSalesPONumberPreview = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const key = soSequenceKey(year);
  const next = await peekNextCounter(prisma, key, () => scanMaxSalesPOSuffix(prisma, year));
  return `SO-${year}-${String(next).padStart(3, '0')}`;
};

const createCustomerPOSchema = z.object({
  customerPONumber: z.string().min(1, 'Số PO khách hàng là bắt buộc'),
  customerId: z.string().uuid('Vui lòng chọn khách hàng'),
  projectName: z.string().min(1, 'Tên dự án là bắt buộc'),
  projectCode: z.string().optional(),
  salesUserId: z.string().uuid().optional().nullable(),
  contractValue: z.number().positive('Giá trị hợp đồng phải lớn hơn 0'),
  currency: z.string().default('VND'),
});

/** GET /requestor/customer-pos — Danh sách Customer PO cho dropdown (PO Number | Customer | Project) */
export const listCustomerPOs = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const list = await prisma.salesPO.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      include: {
        customer: { select: { id: true, name: true } },
        salesUser: { select: { id: true, username: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const customerPOs = list.map((po) => ({
      id: po.id,
      poNumber: po.customerPONumber || po.salesPONumber,
      salesPONumber: po.salesPONumber,
      customer: po.customer?.name ?? '',
      projectName: po.projectName ?? '',
      projectCode: po.projectCode ?? null,
      contractValue: Number(po.amount),
      currency: po.currency,
      salesOwner: po.salesUser ? (po.salesUser.fullName || po.salesUser.username) : null,
    }));

    reply.send({ customerPOs });
  } catch (error: any) {
    console.error('List customer POs error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** GET /requestor/customer-pos/:id — Chi tiết 1 Customer PO (read-only khi chọn trong form PR) */
export const getCustomerPOById = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const po = await prisma.salesPO.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: { select: { id: true, name: true, code: true } },
        salesUser: { select: { id: true, username: true, fullName: true } },
        purchaseRequests: {
          where: { deletedAt: null },
          select: { id: true, prNumber: true, totalAmount: true, status: true },
        },
      },
    });

    if (!po) return reply.code(404).send({ error: 'Customer PO not found' });

    const totalPRs = po.purchaseRequests.length;
    const totalProcurementCost = po.purchaseRequests.reduce((sum, pr) => sum + Number(pr.totalAmount ?? 0), 0);
    const contractValue = Number(po.amount);
    const remainingBudget = contractValue - totalProcurementCost;

    reply.send({
      id: po.id,
      poNumber: po.customerPONumber || po.salesPONumber,
      salesPONumber: po.salesPONumber,
      customer: po.customer ? { id: po.customer.id, name: po.customer.name, code: po.customer.code } : null,
      projectName: po.projectName,
      projectCode: po.projectCode,
      contractValue,
      currency: po.currency,
      salesOwner: po.salesUser ? { id: po.salesUser.id, name: po.salesUser.fullName || po.salesUser.username } : null,
      totalPRs,
      totalProcurementCost,
      remainingBudget,
      purchaseRequests: po.purchaseRequests.map((pr) => ({
        id: pr.id,
        prNumber: pr.prNumber,
        totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
        status: pr.status,
      })),
    });
  } catch (error: any) {
    console.error('Get customer PO error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};

/** POST /requestor/customer-pos — Tạo PO khách hàng mới (từ form Tạo PR) */
export const createCustomerPO = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const body = createCustomerPOSchema.parse(request.body);

    const year = new Date().getFullYear();
    const salesPO = await prisma.$transaction(
      async (tx) => {
        const key = soSequenceKey(year);
        const seq = await allocateNextCounter(tx, key, () => scanMaxSalesPOSuffix(tx, year));
        const salesPONumber = `SO-${year}-${String(seq).padStart(3, '0')}`;
        return tx.salesPO.create({
          data: {
            salesPONumber,
            customerPONumber: body.customerPONumber,
            customerId: body.customerId,
            projectName: body.projectName,
            projectCode: body.projectCode || null,
            amount: body.contractValue,
            currency: body.currency,
            effectiveDate: new Date(),
            status: 'ACTIVE',
            salesUserId: body.salesUserId || null,
            companyId: null,
          },
          include: {
            customer: true,
            salesUser: { select: { id: true, username: true, fullName: true } },
          },
        });
      },
      { maxWait: 10000, timeout: 30000 }
    );

    await auditCreate('sales_pos', salesPO.id, { ...body, salesPONumber }, { userId });

    reply.code(201).send({
      id: salesPO.id,
      poNumber: salesPO.customerPONumber || salesPO.salesPONumber,
      salesPONumber: salesPO.salesPONumber,
      customer: salesPO.customer ? { id: salesPO.customer.id, name: salesPO.customer.name } : null,
      projectName: salesPO.projectName,
      projectCode: salesPO.projectCode,
      contractValue: Number(salesPO.amount),
      currency: salesPO.currency,
      salesOwner: salesPO.salesUser ? (salesPO.salesUser.fullName || salesPO.salesUser.username) : null,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: 'Validation error', details: error.errors });
    }
    console.error('Create customer PO error:', error);
    reply.code(500).send({ error: 'Internal server error', message: error.message });
  }
};
