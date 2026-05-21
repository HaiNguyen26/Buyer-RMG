import fs from 'fs/promises';
import path from 'path';
import { FastifyReply } from 'fastify';
import { prSalesPOSelect, serializePRSalesOrder } from '../utils/prSalesOrder';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { getFileUrl } from '../config/s3';
import { prismaDepartmentOutcomeRowActive } from '../utils/departmentPrItemReview';

const LOCAL_ATTACHMENT_ROOT = path.resolve(process.cwd(), 'uploads', 'attachments');

// Buyer Dashboard - Tổng quan công việc Buyer
export const getBuyerDashboard = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Get assigned PRs (ready/in progress for RFQ)
    const assignedPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: {
          in: ['ASSIGNED_TO_BUYER', 'RFQ_IN_PROGRESS', 'QUOTATION_RECEIVED'],
        },
        deletedAt: null,
        assignments: {
          some: {
            buyerId: userId,
          },
        },
      },
    });

    const rfqInProgress = assignedPRs.filter((pr) => pr.status === 'RFQ_IN_PROGRESS').length;

    // Count PRs needing more info
    const prsNeedMoreInfo = await prisma.purchaseRequest.findMany({
      where: {
        status: 'NEED_MORE_INFO',
        deletedAt: null,
      },
    });

    // Count quotations completed (PRs with supplier selected)
    const quotationsCompleted = await prisma.purchaseRequest.findMany({
      where: {
        status: 'SUPPLIER_SELECTED',
        deletedAt: null,
      },
    });

    // Get today's PRs (created today or updated today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: {
          in: ['ASSIGNED_TO_BUYER', 'RFQ_IN_PROGRESS', 'QUOTATION_RECEIVED', 'SUPPLIER_SELECTED'],
        },
        deletedAt: null,
        assignments: {
          some: {
            buyerId: userId,
          },
        },
        OR: [
          {
            createdAt: {
              gte: today,
            },
          },
          {
            updatedAt: {
              gte: today,
            },
          },
        ],
      },
      include: {
        assignments: {
          select: {
            buyerId: true,
            scope: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 10,
    });

    reply.send({
      assignedPRs: assignedPRs.length,
      rfqInProgress,
      prsNeedMoreInfo: prsNeedMoreInfo.length,
      quotationsCompleted: quotationsCompleted.length,
      todayPRs: todayPRs.map((pr) => ({
        id: pr.id,
        prNumber: pr.prNumber,
        status:
          pr.status === 'ASSIGNED_TO_BUYER'
            ? 'READY_FOR_RFQ'
            : pr.status === 'RFQ_IN_PROGRESS'
              ? 'COLLECTING_QUOTATION'
              : 'QUOTATION_COMPLETED',
      })),
    });
  } catch (error: any) {
    console.error('Get buyer dashboard error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Assigned PRs
export const getAssignedPRs = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { status } = request.query as any;

    // Lấy mọi PR có phân công cho buyer này (kể cả khi PR vẫn BUYER_LEADER_PENDING do chưa phân công hết item)
    const where: any = {
      deletedAt: null,
      status: {
        in: [
          'BUYER_LEADER_PENDING',
          'BRANCH_MANAGER_APPROVED',
          'ASSIGNED_TO_BUYER',
          'RFQ_IN_PROGRESS',
          'QUOTATION_RECEIVED',
          'SUPPLIER_SELECTED',
        ],
      },
      assignments: {
        some: {
          buyerId: userId,
          deletedAt: null,
        },
      },
    };

    const prs = await prisma.purchaseRequest.findMany({
      where,
      include: {
        requestor: {
          select: {
            username: true,
            location: true,
          },
        },
        // Include this buyer's RFQs to compute per-buyer status
        rfqs: {
          where: {
            buyerId: userId,
            deletedAt: null,
          },
          select: {
            id: true,
            status: true,
          },
        },
        // Mọi dòng chưa xóa (đồng bộ với getPRDetails) — không chỉ NEED_PURCHASE
        items: {
          where: { deletedAt: null, ...prismaDepartmentOutcomeRowActive },
          select: { id: true },
        },
        assignments: {
          where: {
            buyerId: userId,
            deletedAt: null,
          },
          select: {
            scope: true,
            assignedItemIds: true,
          },
        },
        salesPO: { select: prSalesPOSelect },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    // Compute per-buyer status based on their own RFQs (not the PR-level status)
    const allMappedPRs = prs.map((pr: any) => {
      const buyerRFQs = pr.rfqs || [];
      let statusLabel = 'READY_FOR_RFQ';

      // Trạng thái per-buyer CHỈ phụ thuộc vào RFQ của chính buyer đó.
      // PR-level status (QUOTATION_RECEIVED, SUPPLIER_SELECTED, ...) KHÔNG được dùng để
      // hiển thị "Đã hoàn thành báo giá" cho buyer khác chưa tạo RFQ.
      if (buyerRFQs.length > 0) {
        const allDone = buyerRFQs.every((r: any) => r.status === 'READY_FOR_COMPARISON' || r.status === 'CLOSED');
        if (allDone) {
          statusLabel = 'QUOTATION_COMPLETED';
        } else {
          statusLabel = 'COLLECTING_QUOTATION';
        }
      }

      // Phạm vi phụ trách: số dòng được giao cho buyer này / tổng dòng PR (chỉ tính id còn tồn tại)
      const allItemIds: string[] = (pr.items || []).map((it: any) => it.id);
      const itemIdSet = new Set(allItemIds);
      const totalItems = allItemIds.length;
      let assignedItemCount = 0;
      if (pr.assignments && pr.assignments.length > 0 && totalItems > 0) {
        const assignedSet = new Set<string>();

        for (const asg of pr.assignments as any[]) {
          if (asg.scope === 'FULL') {
            allItemIds.forEach((id) => assignedSet.add(id));
          } else if (asg.scope === 'PARTIAL' && asg.assignedItemIds) {
            try {
              const parsed = JSON.parse(asg.assignedItemIds) as string[];
              parsed.forEach((id) => {
                if (itemIdSet.has(id)) assignedSet.add(id);
              });
            } catch {
              // ignore parse error
            }
          }
        }
        assignedItemCount = assignedSet.size;
      }

      const scopeLabel =
        totalItems > 0 ? `${assignedItemCount}/${totalItems} item` : '0 item';

      const totalRaw = pr.totalAmount != null ? Number(pr.totalAmount) : 0;
      const totalAmount = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : null;

      return {
        id: pr.id,
        prNumber: pr.prNumber,
        salesOrder: serializePRSalesOrder(pr as any),
        scope: scopeLabel,
        status: statusLabel,
        assignedDate: pr.createdAt.toISOString(),
        department: pr.department ?? null,
        totalAmount,
        deadline: pr.requiredDate?.toISOString() ?? null,
      };
    });

    // Apply status filter after computing per-buyer status
    let mappedPRs = allMappedPRs.filter((pr: any) => {
      const prNumber = String(pr?.prNumber || '');
      return !prNumber.toUpperCase().startsWith('MOCK-');
    });
    if (status && status !== 'all') {
      mappedPRs = mappedPRs.filter((pr: any) => pr.status === status);
    }

    reply.send({ prs: mappedPRs });
  } catch (error: any) {
    console.error('Get assigned PRs error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Project Cost Reference (View Only)
// Note: Sales PO feature removed - returning empty array
export const getProjectCostReference = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Sales PO feature no longer exists
    reply.send({ projects: [] });
  } catch (error: any) {
    console.error('Get project cost reference error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get PR Details for Buyer (only assigned items)
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

    console.log(`[getPRDetails] Fetching PR ${prId} for buyer ${userId}`);

    // Get PR with assignment check
    const pr = await prisma.purchaseRequest.findFirst({
      where: {
        id: prId,
        deletedAt: null,
        assignments: {
          some: {
            buyerId: userId,
            deletedAt: null,
          },
        },
      },
      include: {
        requestor: {
          select: {
            id: true,
            username: true,
            email: true,
            location: true,
          },
        },
        salesPO: { select: prSalesPOSelect },
        attachments: {
          where: { deletedAt: null },
          select: { id: true, fileName: true, fileSize: true, contentType: true },
        },
        // Buyer cần thấy mọi dòng trong phạm vi phân công (ASSIGNED, RFQ_*, v.v.),
        // không chỉ NEED_PURCHASE — lọc NEED_PURCHASE khiến danh sách trống dù đã phân công.
        items: {
          where: { deletedAt: null, ...prismaDepartmentOutcomeRowActive },
          orderBy: {
            lineNo: 'asc',
          },
          include: {
            attachments: {
              where: { deletedAt: null },
              select: { id: true, fileName: true, fileSize: true, contentType: true },
            },
          },
        },
      },
    });

    if (!pr) {
      console.error(`[getPRDetails] PR ${prId} not found or not assigned to buyer ${userId}`);
      // Check if PR exists but not assigned
      const prExists = await prisma.purchaseRequest.findFirst({
        where: { id: prId, deletedAt: null },
        select: { id: true, prNumber: true },
      });
      if (prExists) {
        console.error(`[getPRDetails] PR ${prId} exists but not assigned to buyer ${userId}`);
        return reply.code(403).send({ 
          error: 'PR not assigned to you',
          message: 'PR này không được phân công cho bạn. Vui lòng liên hệ Buyer Leader.',
        });
      }
      return reply.code(404).send({ 
        error: 'PR not found',
        message: 'PR không tồn tại hoặc đã bị xóa.',
      });
    }

    console.log(`[getPRDetails] PR ${prId} found: ${pr.prNumber}`);

    // Get assignment for this buyer
    const assignment = await prisma.pRAssignment.findFirst({
      where: {
        purchaseRequestId: prId,
        buyerId: userId,
        deletedAt: null,
      },
    });

    if (!assignment) {
      console.error(`[getPRDetails] Assignment not found for PR ${prId} and buyer ${userId}`);
      return reply.code(404).send({ 
        error: 'Assignment not found',
        message: 'Không tìm thấy thông tin phân công. Vui lòng liên hệ Buyer Leader.',
      });
    }

    console.log(`[getPRDetails] Assignment found: scope=${assignment.scope}, assignedItemIds=${assignment.assignedItemIds}`);

    // Filter items based on assignment scope
    let assignedItemIds: string[] = [];
    if (assignment.scope === 'FULL') {
      // All items are assigned
      assignedItemIds = pr.items.map(item => item.id);
    } else if (assignment.scope === 'PARTIAL' && assignment.assignedItemIds) {
      // Only specific items
      try {
        assignedItemIds = JSON.parse(assignment.assignedItemIds) as string[];
      } catch (e) {
        console.error('Error parsing assignedItemIds:', e);
        // If parsing fails, return empty array
        assignedItemIds = [];
      }
    }

    // Filter items to only show assigned ones
    const assignedItems = pr.items.filter(item => assignedItemIds.includes(item.id));

    // Link tham khảo spec (danh mục PartMaster, mã = partNo trên dòng PR)
    const partCodes = [
      ...new Set(
        assignedItems
          .map((it) => it.partNo?.trim())
          .filter((c): c is string => Boolean(c))
      ),
    ];
    const referenceUrlByPartCode = new Map<string, string | null>();
    if (partCodes.length > 0) {
      const masters = await prisma.partMaster.findMany({
        where: {
          partInternalCode: { in: partCodes },
          OR: [{ companyId: pr.companyId }, { companyId: null }],
        },
        select: { partInternalCode: true, referenceUrl: true, companyId: true },
      });
      const tenantId = pr.companyId;
      for (const m of masters) {
        const url = m.referenceUrl?.trim() || null;
        if (m.companyId != null && m.companyId === tenantId && url) {
          referenceUrlByPartCode.set(m.partInternalCode, url);
        }
      }
      for (const m of masters) {
        if (m.companyId != null) continue;
        if (referenceUrlByPartCode.has(m.partInternalCode)) continue;
        referenceUrlByPartCode.set(m.partInternalCode, m.referenceUrl?.trim() || null);
      }
    }

    // Log warning if no items are assigned
    if (assignedItems.length === 0) {
      console.warn(`PR ${prId} has no items assigned to buyer ${userId}. Scope: ${assignment.scope}, assignedItemIds: ${assignment.assignedItemIds}`);
    }

    // Get all RFQs for this PR (của buyer hiện tại) để:
    // - kiểm tra item đã nằm trong RFQ nào (lock)
    // - tính trạng thái per-buyer cho PR
    const allRFQs = await prisma.rFQ.findMany({
      where: {
        purchaseRequestId: prId,
        buyerId: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        rfqNumber: true,
        notes: true,
        status: true,
        quotations: {
          where: { deletedAt: null },
          select: {
            id: true,
            supplier: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            totalAmount: true,
            status: true,
            quotationNumber: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build map of locked items (itemId -> RFQ info)
    const lockedItemsMap: Record<string, { rfqId: string; rfqNumber: string; status: string }> = {};
    allRFQs.forEach(rfq => {
      let rfqItemIds: string[] = [];
      if (rfq.notes) {
        const match = rfq.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            if (parsed.itemIds && Array.isArray(parsed.itemIds)) {
              rfqItemIds = parsed.itemIds as string[];
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
      rfqItemIds.forEach(itemId => {
        if (!lockedItemsMap[itemId]) {
          lockedItemsMap[itemId] = {
            rfqId: rfq.id,
            rfqNumber: rfq.rfqNumber,
            status: rfq.status,
          };
        }
      });
    });

    // Get the first RFQ for backward compatibility (if exists)
    const rfq = allRFQs.length > 0 ? allRFQs[0] : null;

    // Tính trạng thái PR theo GÓC NHÌN của buyer hiện tại (giống getAssignedPRs):
    // - Chỉ dựa vào RFQ của buyer này, không dùng PR.status tổng thể.
    let buyerStatus: 'READY_FOR_RFQ' | 'COLLECTING_QUOTATION' | 'QUOTATION_COMPLETED';
    if (allRFQs.length === 0) {
      buyerStatus = 'READY_FOR_RFQ';
    } else {
      const allDone = allRFQs.every(
        (r: any) => r.status === 'READY_FOR_COMPARISON' || r.status === 'CLOSED'
      );
      buyerStatus = allDone ? 'QUOTATION_COMPLETED' : 'COLLECTING_QUOTATION';
    }

    console.log(`[getPRDetails] Sending response for PR ${prId}. Items count: ${assignedItems.length}`);

    const attachmentBase = `/api/buyer/prs/${pr.id}/attachments`;
    const mapPrAttachment = (a: { id: string; fileName: string; fileSize: number; contentType: string }) => ({
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      contentType: a.contentType,
      fileUrl: `${attachmentBase}/${a.id}`,
    });

    const resolveItemUnitPrice = (item: any): number | null => {
      const estimated = Number(item?.estimatedUnitPriceVnd ?? 0);
      if (Number.isFinite(estimated) && estimated > 0) return estimated;
      const unitPrice = Number(item?.unitPrice ?? 0);
      return Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : null;
    };
    const resolveItemAmount = (item: any): number | null => {
      const amount = Number(item?.amount ?? 0);
      if (Number.isFinite(amount) && amount > 0) return amount;
      const qty = Number(item?.qty ?? 0);
      const unitPrice = resolveItemUnitPrice(item);
      if (!Number.isFinite(qty) || qty <= 0 || unitPrice == null || unitPrice <= 0) return null;
      return qty * unitPrice;
    };
    const computedAssignedTotal = assignedItems.reduce((sum, item: any) => {
      return sum + (resolveItemAmount(item) ?? 0);
    }, 0);

    const responseData = {
      id: pr.id,
      prNumber: pr.prNumber,
      salesOrder: serializePRSalesOrder(pr as any),
      attachments: (pr.attachments ?? []).map(mapPrAttachment),
      department: pr.department,
      purpose: pr.purpose,
      requiredDate: pr.requiredDate?.toISOString(),
      totalAmount:
        Number(pr.totalAmount ?? 0) > 0 ? Number(pr.totalAmount) : (computedAssignedTotal > 0 ? computedAssignedTotal : null), // Giá dự kiến (baseline budget)
      currency: pr.currency,
      // status: trạng thái per-buyer để hiển thị cho Buyer (READY_FOR_RFQ / COLLECTING_QUOTATION / QUOTATION_COMPLETED)
      status: buyerStatus,
      // prStatus: trạng thái thật của PR (để debug / mở rộng nếu cần)
      prStatus: pr.status,
      requestor: pr.requestor,
      createdAt: pr.createdAt.toISOString(), // Add createdAt for frontend
      items: assignedItems.map((item) => ({
        id: item.id,
        lineNo: item.lineNo,
        description: item.description,
        partNo: item.partNo,
        spec: item.spec,
        manufacturer: item.manufacturer,
        referenceUrl: item.partNo?.trim()
          ? referenceUrlByPartCode.get(item.partNo.trim()) ?? null
          : null,
        qty: Number(item.qty),
        unit: item.unit,
        unitPrice: resolveItemUnitPrice(item),
        amount: resolveItemAmount(item),
        estimatedUnitPriceVnd:
          Number(item.estimatedUnitPriceVnd ?? 0) > 0 ? Number(item.estimatedUnitPriceVnd) : null,
        purpose: item.purpose,
        remark: item.remark,
        status: item.status,
        attachments: (item.attachments ?? []).map(mapPrAttachment),
        // Add locked status - item is locked if it belongs to an RFQ
        isLocked: !!lockedItemsMap[item.id],
        lockedByRFQ: lockedItemsMap[item.id] || null,
      })),
      notes: pr.notes,
      assignment: {
        scope: assignment.scope,
        note: assignment.note,
        assignedItemIds: assignedItemIds,
      },
      rfq: rfq ? {
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
        status: rfq.status,
        quotations: rfq.quotations.map((q: any) => ({
          id: q.id,
          supplier: q.supplier,
          quotationNumber: q.quotationNumber,
          totalAmount: Number(q.totalAmount),
          currency: q.currency,
          leadTime: q.leadTime,
          paymentTerms: q.paymentTerms,
          warranty: q.warranty,
          riskNotes: q.riskNotes,
          status: q.status,
          isRecommended: q.isRecommended,
          createdAt: q.createdAt.toISOString(),
          attachments: Array.isArray(q.attachments) ? q.attachments.map((a: any) => ({
            id: a.id,
            fileName: a.fileName,
            fileUrl: a.fileUrl,
            fileSize: a.fileSize,
            contentType: a.contentType,
          })) : [],
        })),
      } : null,
    };

    console.log(`[getPRDetails] Response data prepared. Has items: ${responseData.items.length > 0}, Has RFQ: ${!!responseData.rfq}`);
    console.log(`[getPRDetails] Response data keys:`, Object.keys(responseData));
    console.log(`[getPRDetails] Response data sample:`, {
      id: responseData.id,
      prNumber: responseData.prNumber,
      itemsCount: responseData.items.length,
      hasRequestor: !!responseData.requestor,
    });
    
    // Serialize to JSON string to verify data structure
    let jsonString: string;
    try {
      jsonString = JSON.stringify(responseData);
      console.log(`[getPRDetails] JSON string length: ${jsonString.length}`);
      console.log(`[getPRDetails] JSON string preview (first 500 chars):`, jsonString.substring(0, 500));
    } catch (serializeError: any) {
      console.error(`[getPRDetails] Error serializing response:`, serializeError);
      return reply.code(500).send({
        error: 'Failed to serialize response',
        message: serializeError.message,
      });
    }
    
    // Disable compression for this response to prevent premature close issues
    // Similar to notificationController approach
    if (request.headers['accept-encoding']) {
      // Don't delete, but set header to prevent compression issues
      reply.header('Content-Encoding', 'identity');
    }
    reply.removeHeader('content-encoding');
    reply.header('Content-Type', 'application/json; charset=utf-8');
    
    // Ensure we're sending a proper JSON response with explicit content type
    // Use reply.send() which Fastify will handle properly
    reply.code(200).type('application/json').send(responseData);
    
    console.log(`[getPRDetails] Response sent successfully. Content-Length: ${jsonString.length}`);
  } catch (error: any) {
    console.error('Get PR details error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/** Tải file đính kèm PR / dòng hàng — buyer đã được phân công (Bearer). */
export const downloadBuyerPRAttachment = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { prId, attachmentId } = request.params as { prId: string; attachmentId: string };
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const pr = await prisma.purchaseRequest.findFirst({
      where: {
        id: prId,
        deletedAt: null,
        assignments: { some: { buyerId: userId, deletedAt: null } },
      },
      select: { id: true },
    });
    if (!pr) {
      return reply.code(404).send({ error: 'PR not found', message: 'PR không tồn tại hoặc không được phân công cho bạn.' });
    }

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
    console.error('downloadBuyerPRAttachment error:', error);
    return reply.code(500).send({ error: 'Internal server error', message: error?.message });
  }
};

// Get Buyer Notifications
export const getBuyerNotifications = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const notifications: any[] = [];

    // Get newly assigned PRs
    const newPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: 'ASSIGNED_TO_BUYER',
        deletedAt: null,
        assignments: {
          some: {
            buyerId: userId,
          },
        },
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      take: 10,
    });

    newPRs.forEach((pr) => {
      notifications.push({
        id: `pr-assigned-${pr.id}`,
        type: 'PR_ASSIGNED',
        title: 'PR được phân công mới',
        message: `Bạn đã được phân công PR ${pr.prNumber}`,
        prNumber: pr.prNumber,
        createdAt: pr.createdAt.toISOString(),
        read: false,
      });
    });

    // Get PRs returned with comments (if notes contains RETURNED)
    const returnedPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: 'NEED_MORE_INFO',
        deletedAt: null,
        notes: {
          contains: 'RETURNED',
        },
      },
      take: 10,
    });

    returnedPRs.forEach((pr) => {
      notifications.push({
        id: `pr-returned-${pr.id}`,
        type: 'PR_RETURNED',
        title: 'PR cần bổ sung thông tin',
        message: `PR ${pr.prNumber} cần bổ sung thông tin từ Requestor`,
        prNumber: pr.prNumber,
        comment: pr.notes || 'Cần bổ sung thông tin',
        createdAt: pr.updatedAt.toISOString(),
        read: false,
      });
    });

    // Sort by createdAt desc
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    reply.send({ notifications: notifications.slice(0, 50) });
  } catch (error: any) {
    console.error('Get buyer notifications error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/** Ngưỡng % vượt: <= 10% = vượt nhẹ, > 10% = vượt nghiêm trọng */
const OVER_BUDGET_LIGHT_MAX_PCT = 10;

// Cảnh báo vượt ngân sách — danh sách item đang vượt baseline (theo RFQ của buyer)
export const getOverBudgetAlerts = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const rfqs = await prisma.rFQ.findMany({
      where: {
        buyerId: userId,
        deletedAt: null,
      },
      include: {
        purchaseRequest: {
          include: {
            items: { where: { deletedAt: null, ...prismaDepartmentOutcomeRowActive }, orderBy: { lineNo: 'asc' } },
            assignments: {
              where: { buyerId: userId, deletedAt: null },
            },
          },
        },
        quotations: {
          where: { deletedAt: null },
          include: {
            items: { orderBy: { lineNo: 'asc' } },
            supplier: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const { computeQuotationBaseline } = await import('../utils/baseline');
    const alerts: Array<{
      id: string;
      prId: string;
      prNumber: string;
      rfqId: string;
      rfqNumber: string;
      itemId: string;
      itemDesc: string;
      supplierName: string;
      baselineUnitPrice: number;
      rfqUnitPrice: number;
      overAmount: number;
      overPercent: number;
      severity: 'light' | 'serious';
    }> = [];

    for (const rfq of rfqs) {
      const pr = rfq.purchaseRequest as any;
      if (!pr?.items?.length || !rfq.quotations?.length) continue;

      const assignment = pr.assignments?.[0];
      if (!assignment) continue;

      let rfqItemIds: string[] = [];
      if (rfq.notes) {
        const match = rfq.notes.match(/\[RFQ_ITEMS\](.+?)\[\/RFQ_ITEMS\]/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            if (parsed.itemIds && Array.isArray(parsed.itemIds)) {
              rfqItemIds = parsed.itemIds as string[];
            }
          } catch (_) {}
        }
      }

      let assignedItemIds: string[] = [];
      if (assignment.scope === 'FULL') {
        assignedItemIds = pr.items.map((i: any) => i.id);
      } else if (assignment.scope === 'PARTIAL' && assignment.assignedItemIds) {
        try {
          assignedItemIds = JSON.parse(assignment.assignedItemIds) as string[];
        } catch (_) {
          assignedItemIds = [];
        }
      }

      let itemsToShow = pr.items;
      if (rfqItemIds.length > 0) {
        itemsToShow = pr.items.filter(
          (i: any) => rfqItemIds.includes(i.id) && assignedItemIds.includes(i.id)
        );
      } else {
        itemsToShow = pr.items.filter((i: any) => assignedItemIds.includes(i.id));
      }

      const prItemsBaseline = itemsToShow.map((item: any) => ({
        id: item.id,
        lineNo: item.lineNo,
        unitPrice: item.unitPrice != null ? Number(item.unitPrice) : null,
        amount: item.amount != null ? Number(item.amount) : null,
        qty: Number(item.qty) || 0,
      }));
      const prItemsMap = new Map(itemsToShow.map((i: any) => [i.id, i]));

      for (const q of rfq.quotations as any[]) {
        const baselineResult = computeQuotationBaseline(
          prItemsBaseline,
          (q.items || []).map((qi: any) => ({
            purchaseRequestItemId: qi.purchaseRequestItemId,
            unitPrice: qi.unitPrice,
            lineNo: qi.lineNo,
          }))
        );
        const supplierName = q.supplier?.name || q.supplier?.code || 'NCC';

        for (const bl of baselineResult.items) {
          if (!bl.overBaseline || bl.baselineUnitPrice == null) continue;
          const prItem = bl.purchaseRequestItemId
            ? prItemsMap.get(bl.purchaseRequestItemId)
            : null;
          const overAmount = bl.quotationUnitPrice - bl.baselineUnitPrice;
          const overPercent =
            bl.baselineUnitPrice !== 0
              ? (overAmount / bl.baselineUnitPrice) * 100
              : 0;
          const severity: 'light' | 'serious' =
            overPercent <= OVER_BUDGET_LIGHT_MAX_PCT ? 'light' : 'serious';

          alerts.push({
            id: `${rfq.id}-${q.id}-${bl.purchaseRequestItemId || bl.lineNo}`,
            prId: pr.id,
            prNumber: pr.prNumber,
            rfqId: rfq.id,
            rfqNumber: rfq.rfqNumber,
            itemId: bl.purchaseRequestItemId || '',
            itemDesc: (prItem as any)?.description || `Item #${bl.lineNo}`,
            supplierName,
            baselineUnitPrice: bl.baselineUnitPrice,
            rfqUnitPrice: bl.quotationUnitPrice,
            overAmount,
            overPercent,
            severity,
          });
        }
      }
    }    reply.send({ alerts });
  } catch (error: any) {
    console.error('Get over-budget alerts error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};