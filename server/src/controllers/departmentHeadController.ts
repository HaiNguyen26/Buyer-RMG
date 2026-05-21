import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditUpdate } from '../utils/audit';
import { createNotification, NotificationTemplates, markNotificationAsResolved } from '../utils/notifications';
import { getIO } from '../utils/getIO';
import { randomUUID } from 'crypto';
import { prSalesPOSelect, serializePRSalesOrder } from '../utils/prSalesOrder';
import {
  hasActivePurchasingAfterDecisions,
  itemEligibleForDepartmentOutcome,
  itemLineAmountForTotal,
  purchaseRequestNeedsDepartmentHeadRevisionResubmitReview,
  purchaseRequestStillPendingDepartmentHeadQueue,
  sumAllLinesSnapshot,
  sumPurchaseTotalAfterDepartmentDecisions,
  type DepartmentItemOutcomeValue,
} from '../utils/departmentPrItemReview';
import {
  DEPT_HEAD_REJECTED_STATUSES,
  DEPT_HEAD_RETURNED_STATUSES,
  departmentHeadApprovedByUserWhere,
  departmentHeadRejectedByUserWhere,
  departmentHeadReturnedByUserWhere,
  isDepartmentHeadPartialApproval,
  normalizeApprovalQueueFilter,
  periodStartDaysAgo,
} from '../utils/prApprovalQueue';

const PR_TYPE_LABEL_MAP: Record<string, string> = {
  COMMERCIAL: 'Thương mại',
  PRODUCTION: 'Sản xuất',
  PROJECT: 'Dự án',
  OFFICE: 'Văn phòng',
  MATERIAL: 'Vật tư',
  SERVICE: 'Dịch vụ',
};

const PR_STATUS_BLOCKING_DEPT_REVISION_REVIEW = new Set([
  'DRAFT',
  'MANAGER_REJECTED',
  'MANAGER_RETURNED',
  'CANCELLED',
]);

/** Gộp PR chờ duyệt lần đầu + PR có dòng resubmit revision, tránh trùng id. */
function mergeDepartmentHeadPendingPrs<T extends { id: string; createdAt: Date }>(
  primary: T[],
  revisionQueue: T[]
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of primary) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  for (const p of revisionQueue) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  out.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return out;
}

const prItemSafeSelect = {
  id: true,
  purchaseRequestId: true,
  lineNo: true,
  description: true,
  partNo: true,
  spec: true,
  manufacturer: true,
  qty: true,
  fromStockQty: true,
  purchaseQty: true,
  unit: true,
  unitPrice: true,
  amount: true,
  estimatedUnitPriceVnd: true,
  desiredDeliveryDate: true,
  purpose: true,
  remark: true,
  status: true,
  departmentItemOutcome: true,
  departmentDecisionNote: true,
  departmentDecidedById: true,
  departmentDecidedAt: true,
  departmentRevisionSubmittedAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

// Get Department Head Dashboard
export const getDepartmentHeadDashboard = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    const managerCode = user?.username;
    if (!managerCode) {
      return reply.code(400).send({ error: 'Không xác định được mã nhân viên (username) của người duyệt' });
    }

    // CẤP 1: chỉ hiển thị PR mà Requestor có direct_manager_code = username của người đang đăng nhập
    const whereClause: any = {
      status: { in: ['MANAGER_PENDING', 'DEPARTMENT_HEAD_PENDING'] },
      deletedAt: null,
      // Exclude PRs created by the department head themselves
      requestorId: { not: userId },
      requestor: {
        directManagerCode: managerCode,
      },
    };

    // Get pending PRs (waiting for approval)
    const pendingPRsRaw = await prisma.purchaseRequest.findMany({
      where: whereClause,
      include: {
        requestor: {
          select: {
            id: true,
            username: true,
            email: true,
            location: true,
            directManagerCode: true,
          },
        },
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
          select: prItemSafeSelect,
        },
        salesPO: { select: prSalesPOSelect },
      },
      orderBy: { createdAt: 'asc' },
    });

    const pendingRevisionRaw = await prisma.purchaseRequest.findMany({
      where: {
        deletedAt: null,
        requestorId: { not: userId },
        requestor: {
          directManagerCode: managerCode,
        },
        status: {
          notIn: [
            'DRAFT',
            'MANAGER_PENDING',
            'DEPARTMENT_HEAD_PENDING',
            'MANAGER_REJECTED',
            'MANAGER_RETURNED',
            'CANCELLED',
          ],
        },
        items: {
          some: {
            deletedAt: null,
            status: 'NEED_PURCHASE',
            departmentItemOutcome: 'REVISION_REQUIRED',
            departmentRevisionSubmittedAt: { not: null },
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
            directManagerCode: true,
          },
        },
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
          select: prItemSafeSelect,
        },
        salesPO: { select: prSalesPOSelect },
      },
      orderBy: { createdAt: 'asc' },
    });

    const pendingPRs = mergeDepartmentHeadPendingPrs(
      pendingPRsRaw.filter((pr) => purchaseRequestStillPendingDepartmentHeadQueue(pr)),
      pendingRevisionRaw.filter((pr) => purchaseRequestNeedsDepartmentHeadRevisionResubmitReview(pr))
    );

    // Note: bỏ log debug spam ở môi trường dev

    // Get period (last 30 days)
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30);

    // Get approved PRs - query through PR Approvals (because after approval, PRs move to next status)
    const approvedApprovals = await prisma.pRApproval.findMany({
      where: {
        approverId: userId,
        action: 'APPROVE',
        createdAt: {
          gte: periodStart,
        },
        purchaseRequest: {
          deletedAt: null,
        },
      },
      include: {
        purchaseRequest: {
          select: {
            id: true,
            prNumber: true,
            status: true,
            department: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const approvedPRs = approvedApprovals
      .map(approval => approval.purchaseRequest)
      .filter(pr => pr !== null);

    console.log('Department Head Dashboard - Approved PRs:', {
      approvedApprovalsCount: approvedApprovals.length,
      approvedPRsCount: approvedPRs.length,
      approvedPRsNumbers: approvedPRs.map(pr => pr.prNumber),
    });

    // Get rejected/returned PRs - query through PR Approvals
    const rejectedApprovals = await prisma.pRApproval.findMany({
      where: {
        approverId: userId,
        action: { in: ['REJECT', 'RETURN'] },
        createdAt: {
          gte: periodStart,
        },
        purchaseRequest: {
          deletedAt: null,
        },
      },
      include: {
        purchaseRequest: {
          select: {
            id: true,
            prNumber: true,
            status: true,
            department: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rejectedPRs = rejectedApprovals
      .map(approval => approval.purchaseRequest)
      .filter(pr => pr !== null);

    console.log('Department Head Dashboard - Final Response:', {
      pendingCount: pendingPRs.length,
      approvedCount: approvedPRs.length,
      rejectedCount: rejectedPRs.length,
    });

    // Set headers to prevent compression issues
    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Encoding', 'identity');
    
    reply.send({
      pendingCount: pendingPRs.length,
      approvedCount: approvedPRs.length,
      rejectedCount: rejectedPRs.length,
      pendingPRs: pendingPRs.map((pr) => {
        // Calculate total from items
        let calculatedTotal = 0;
        if (pr.items.length > 0) {
          calculatedTotal = pr.items.reduce((sum, item) => {
            const qty = Number(item.qty) || 0;
            const unitPrice = Number(item.unitPrice) || 0;
            return sum + (qty * unitPrice);
          }, 0);
        }
        const finalTotal = (pr.totalAmount && Number(pr.totalAmount) > calculatedTotal) 
          ? Number(pr.totalAmount) 
          : calculatedTotal;

        // Get item name from first item
        let itemName = null;
        if (pr.items.length > 0) {
          const firstItemWithDesc = pr.items.find(item => item.description && item.description.trim());
          if (firstItemWithDesc) {
            itemName = firstItemWithDesc.description.trim();
          } else {
            itemName = `${pr.items.length} mặt hàng`;
          }
        }

        return {
          id: pr.id,
          prNumber: pr.prNumber,
          status: pr.status,
          type: pr.type,
          typeLabel: PR_TYPE_LABEL_MAP[String(pr.type || '').toUpperCase()] || String(pr.type || ''),
          department: pr.department,
          itemName: itemName,
          itemCount: pr.items.length,
          totalAmount: finalTotal > 0 ? finalTotal : null,
          currency: pr.currency || 'VND',
          requestor: pr.requestor,
          requiredDate: pr.requiredDate?.toISOString(),
          createdAt: pr.createdAt.toISOString(),
          salesOrder: serializePRSalesOrder(pr),
        };
      }),
    });
  } catch (error: any) {
    console.error('Get department head dashboard error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Pending PRs for Approval
export const getPendingPRs = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    const managerCode = user?.username;
    if (!managerCode) {
      return reply.code(400).send({ error: 'Không xác định được mã nhân viên (username) của người duyệt' });
    }

    const queue = normalizeApprovalQueueFilter((request.query as { queue?: string })?.queue);

    const deptHeadPrInclude = {
      requestor: {
        select: {
          id: true,
          username: true,
          email: true,
          location: true,
          directManagerCode: true,
        },
      },
      items: {
        where: { deletedAt: null },
        orderBy: { lineNo: 'asc' as const },
        select: prItemSafeSelect,
      },
      approvals: {
        where: { approverId: userId },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
      salesPO: { select: prSalesPOSelect },
    };

    const scopeBase = {
      deletedAt: null,
      requestorId: { not: userId },
      requestor: { directManagerCode: managerCode },
    };

    let prs: Awaited<ReturnType<typeof prisma.purchaseRequest.findMany>>;

    if (queue !== 'pending') {
      const periodStart = periodStartDaysAgo(365);
      const whereClause: Record<string, unknown> = {
        ...scopeBase,
      };

      if (queue === 'approved') {
        Object.assign(whereClause, departmentHeadApprovedByUserWhere(userId, periodStart));
      } else if (queue === 'rejected') {
        Object.assign(whereClause, departmentHeadRejectedByUserWhere(userId, periodStart));
      } else if (queue === 'returned') {
        Object.assign(whereClause, departmentHeadReturnedByUserWhere(userId, periodStart));
      } else if (queue === 'partial') {
        whereClause.updatedAt = { gte: periodStart };
        whereClause.status = {
          notIn: [
            'DRAFT',
            'CANCELLED',
            ...DEPT_HEAD_REJECTED_STATUSES,
            ...DEPT_HEAD_RETURNED_STATUSES,
            'MANAGER_PENDING',
            'DEPARTMENT_HEAD_PENDING',
          ],
        };
      } else {
        whereClause.status = { notIn: ['DRAFT', 'CANCELLED'] };
        whereClause.updatedAt = { gte: periodStart };
      }

      const prsRaw = await prisma.purchaseRequest.findMany({
        where: whereClause as any,
        include: deptHeadPrInclude,
        orderBy: { updatedAt: 'desc' },
        take: 200,
      });

      prs =
        queue === 'partial'
          ? prsRaw.filter((pr) => isDepartmentHeadPartialApproval(pr))
          : prsRaw;
    } else {
      const whereClause: any = {
        status: { in: ['MANAGER_PENDING', 'DEPARTMENT_HEAD_PENDING'] },
        ...scopeBase,
      };

      const prsRaw = await prisma.purchaseRequest.findMany({
        where: whereClause,
        include: deptHeadPrInclude,
        orderBy: { createdAt: 'asc' },
      });

      const revisionRaw = await prisma.purchaseRequest.findMany({
        where: {
          ...scopeBase,
          status: {
            notIn: [
              'DRAFT',
              'MANAGER_PENDING',
              'DEPARTMENT_HEAD_PENDING',
              'MANAGER_REJECTED',
              'MANAGER_RETURNED',
              'CANCELLED',
            ],
          },
          items: {
            some: {
              deletedAt: null,
              status: 'NEED_PURCHASE',
              departmentItemOutcome: 'REVISION_REQUIRED',
              departmentRevisionSubmittedAt: { not: null },
            },
          },
        },
        include: deptHeadPrInclude,
        orderBy: { createdAt: 'asc' },
      });

      prs = mergeDepartmentHeadPendingPrs(
        prsRaw.filter((pr) => purchaseRequestStillPendingDepartmentHeadQueue(pr)),
        revisionRaw.filter((pr) => purchaseRequestNeedsDepartmentHeadRevisionResubmitReview(pr)),
      );
    }

    const partNos = [
      ...new Set(
        prs.flatMap((pr) => pr.items.map((item) => item.partNo?.trim()).filter(Boolean) as string[])
      ),
    ];
    const stockByPart = new Map<string, number>();
    if (partNos.length > 0) {
      const stockRows = await prisma.inventoryBalance.groupBy({
        by: ['partInternalCode'],
        where: {
          partInternalCode: { in: partNos },
          companyId: null,
        },
        _sum: {
          quantityAvailable: true,
          quantityReserved: true,
        },
      });

      stockRows.forEach((row) => {
        const available = Number(row._sum.quantityAvailable ?? 0);
        const reserved = Number(row._sum.quantityReserved ?? 0);
        stockByPart.set(row.partInternalCode, Math.max(0, available - reserved));
      });
    }

    const mappedPRs = prs.map((pr) => {
      const remainingStockByPart = new Map(stockByPart);
      // Calculate total from items
      let calculatedTotal = 0;
      if (pr.items.length > 0) {
        calculatedTotal = pr.items.reduce((sum, item) => {
          const qty = Number(item.qty) || 0;
          const estimatedUnitPrice = Number((item as any).estimatedUnitPriceVnd) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          const effectiveUnitPrice = estimatedUnitPrice > 0 ? estimatedUnitPrice : unitPrice;
          return sum + (qty * effectiveUnitPrice);
        }, 0);
      }
      const finalTotal = (pr.totalAmount && Number(pr.totalAmount) > calculatedTotal) 
        ? Number(pr.totalAmount) 
        : calculatedTotal;

      // Get item name from first item
      let itemName = null;
      if (pr.items.length > 0) {
        const firstItemWithDesc = pr.items.find(item => item.description && item.description.trim());
        if (firstItemWithDesc) {
          itemName = firstItemWithDesc.description.trim();
        } else {
          itemName = `${pr.items.length} mặt hàng`;
        }
      }

      return {
        id: pr.id,
        prNumber: pr.prNumber,
        status: pr.status,
        type: pr.type,
        typeLabel: PR_TYPE_LABEL_MAP[String(pr.type || '').toUpperCase()] || String(pr.type || ''),
        department: pr.department,
        itemName: itemName,
        itemCount: pr.items.length,
        totalAmount: finalTotal > 0 ? finalTotal : null,
        currency: pr.currency || 'VND',
        requestor: pr.requestor,
        requiredDate: pr.requiredDate?.toISOString(),
        purpose: pr.purpose,
        notes: pr.notes,
        totalAmountSnapshot:
          pr.totalAmountSnapshot != null && Number.isFinite(Number(pr.totalAmountSnapshot))
            ? Number(pr.totalAmountSnapshot)
            : null,
        createdAt: pr.createdAt.toISOString(),
        salesOrder: serializePRSalesOrder(pr),
        items: pr.items.map((item) => ({
          ...(function deriveSource() {
            const qty = Number(item.qty || 0);
            const fromStockQty = Number((item as any).fromStockQty || 0);
            const purchaseQty = Number((item as any).purchaseQty || 0);
            const rawStatus = String((item as any).status || 'NEW');
            if (rawStatus === 'FROM_STOCK' || (fromStockQty > 0 && purchaseQty <= 0)) {
              return { sourceStatus: 'FROM_STOCK', fromStockQty: fromStockQty > 0 ? fromStockQty : qty, purchaseQty: purchaseQty > 0 ? purchaseQty : 0 };
            }
            if (rawStatus === 'NEED_PURCHASE' || purchaseQty > 0) {
              return { sourceStatus: 'NEED_PURCHASE', fromStockQty, purchaseQty: purchaseQty > 0 ? purchaseQty : Math.max(0, qty - fromStockQty) };
            }
            // Legacy item chưa được split: suy luận theo tồn khả dụng hiện tại để hiển thị.
            const partNo = item.partNo?.trim();
            // Không có mã vật tư => không thể đối chiếu tồn kho, mặc định cần mua toàn bộ.
            if (!partNo) {
              return {
                sourceStatus: qty > 0 ? 'NEED_PURCHASE' : 'UNKNOWN',
                fromStockQty: 0,
                purchaseQty: qty > 0 ? qty : purchaseQty,
              };
            }
            const liveStock = Number(remainingStockByPart.get(partNo) ?? 0);
            const from = Math.min(qty, Math.max(0, liveStock));
            const buy = Math.max(0, qty - from);
            remainingStockByPart.set(partNo, Math.max(0, liveStock - from));
            return { sourceStatus: buy > 0 ? 'NEED_PURCHASE' : 'FROM_STOCK', fromStockQty: from, purchaseQty: buy };
          })(),
          id: item.id,
          lineNo: item.lineNo,
          description: item.description,
          partNo: item.partNo,
          spec: item.spec,
          manufacturer: item.manufacturer,
          qty: Number(item.qty),
          status: (item as any).status || 'NEW',
          unit: item.unit,
          unitPrice:
            Number((item as any).estimatedUnitPriceVnd) > 0
              ? Number((item as any).estimatedUnitPriceVnd)
              : item.unitPrice
                ? Number(item.unitPrice)
                : null,
          amount:
            item.amount && Number(item.amount) > 0
              ? Number(item.amount)
              : (() => {
                  const qty = Number(item.qty) || 0;
                  const estimated = Number((item as any).estimatedUnitPriceVnd) || 0;
                  const unit = Number(item.unitPrice) || 0;
                  const effectiveUnitPrice = estimated > 0 ? estimated : unit;
                  return effectiveUnitPrice > 0 ? qty * effectiveUnitPrice : null;
                })(),
          estimatedUnitPriceVnd:
            Number((item as any).estimatedUnitPriceVnd) > 0
              ? Number((item as any).estimatedUnitPriceVnd)
              : null,
          purpose: item.purpose,
          remark: item.remark,
          departmentItemOutcome: (item as { departmentItemOutcome?: string | null }).departmentItemOutcome ?? null,
          departmentDecisionNote: (item as { departmentDecisionNote?: string | null }).departmentDecisionNote ?? null,
          departmentRevisionSubmittedAt: (item as { departmentRevisionSubmittedAt?: Date | null })
            .departmentRevisionSubmittedAt
            ? new Date(
                (item as { departmentRevisionSubmittedAt?: Date | null }).departmentRevisionSubmittedAt as Date
              ).toISOString()
            : null,
        })),
        hasPreviousApproval: pr.approvals.length > 0,
      };
    });

    reply.send({ prs: mappedPRs, queue });
  } catch (error: any) {
    console.error('Get pending PRs error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Approve PR (optional partial: itemDecisions per NEED_PURCHASE line)
export const approvePR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };
    const {
      comment,
      itemDecisions,
    } = (request.body as {
      comment?: string;
      itemDecisions?: Array<{
        itemId: string;
        outcome: DepartmentItemOutcomeValue;
        note?: string;
      }>;
    }) || {};

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const pr = await prisma.purchaseRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: {
          where: { deletedAt: null },
          select: prItemSafeSelect,
        },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    const approver = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, role: true },
    });
    if (!approver?.username) {
      return reply.code(400).send({ error: 'Không xác định được mã người duyệt' });
    }
    if (approver.role !== 'DEPARTMENT_HEAD') {
      return reply.code(403).send({ error: 'Forbidden - chỉ quản lý trực tiếp mới được duyệt cấp 1' });
    }

    const requestor = await prisma.user.findUnique({
      where: { id: pr.requestorId },
      select: { id: true, role: true, location: true, directManagerCode: true },
    });
    if (!requestor) {
      return reply.code(404).send({ error: 'Requestor not found' });
    }

    if ((requestor.directManagerCode || '').trim() !== approver.username.trim()) {
      return reply.code(403).send({
        error: 'Forbidden - chỉ quản lý trực tiếp mới được duyệt cấp 1',
      });
    }

    const branchCode = pr.location || requestor?.location || null;
    if (!branchCode) {
      return reply.code(400).send({ error: 'PR thiếu branch_code (location) - không thể xác định luồng duyệt' });
    }

    const isInitialPending =
      pr.status === 'MANAGER_PENDING' || pr.status === 'DEPARTMENT_HEAD_PENDING';
    const isRevisionReReview =
      !isInitialPending &&
      !PR_STATUS_BLOCKING_DEPT_REVISION_REVIEW.has(pr.status) &&
      purchaseRequestNeedsDepartmentHeadRevisionResubmitReview(pr);

    if (!isInitialPending && !isRevisionReReview) {
      return reply.code(404).send({ error: 'PR not found or not pending approval' });
    }

    if (isRevisionReReview) {
      const allowedReReview = new Set<DepartmentItemOutcomeValue>([
        'APPROVED',
        'REJECTED',
        'REVISION_REQUIRED',
        'ON_HOLD',
      ]);
      const reDecisionInput = new Map<string, { outcome: DepartmentItemOutcomeValue; note?: string }>();
      for (const row of itemDecisions || []) {
        if (!row?.itemId || !row?.outcome) continue;
        if (!allowedReReview.has(row.outcome)) {
          return reply.code(400).send({ error: `Outcome không hợp lệ: ${row.outcome}` });
        }
        reDecisionInput.set(row.itemId, { outcome: row.outcome, note: row.note });
      }
      if (reDecisionInput.size === 0) {
        return reply.code(400).send({ error: 'Cần gửi itemDecisions cho các dòng chờ duyệt lại' });
      }

      const eligibleIds = new Set(
        pr.items
          .filter(
            (i) =>
              String((i as { status?: string }).status || '') === 'NEED_PURCHASE' &&
              String((i as { departmentItemOutcome?: string | null }).departmentItemOutcome || '') ===
                'REVISION_REQUIRED' &&
              (i as { departmentRevisionSubmittedAt?: Date | null }).departmentRevisionSubmittedAt != null
          )
          .map((i) => i.id)
      );
      for (const itemId of reDecisionInput.keys()) {
        if (!eligibleIds.has(itemId)) {
          return reply.code(400).send({
            error: 'Chỉ được duyệt các dòng đã resubmit sau khi Trưởng phòng yêu cầu chỉnh sửa',
          });
        }
      }

      for (const [, d] of reDecisionInput) {
        if ((d.outcome === 'REJECTED' || d.outcome === 'REVISION_REQUIRED') && !d.note?.trim()) {
          return reply.code(400).send({
            error: 'Cần ghi chú (note) khi từ chối hoặc yêu cầu chỉnh sửa lại',
          });
        }
      }

      const decidedAt = new Date();
      let updatedPR: { id: string; prNumber: string; status: string; totalAmount: unknown; totalAmountSnapshot: unknown };

      await prisma.$transaction(async (tx) => {
        for (const [itemId, d] of reDecisionInput) {
          const item = pr.items.find((x) => x.id === itemId)!;
          await tx.purchaseRequestItem.update({
            where: { id: itemId },
            data: {
              departmentItemOutcome: d.outcome as any,
              departmentDecisionNote: d.note?.trim() ? d.note.trim() : null,
              departmentDecidedById: userId,
              departmentDecidedAt: decidedAt,
              departmentRevisionSubmittedAt: null,
            },
          });
          await tx.prItemDepartmentDecision.create({
            data: {
              id: randomUUID(),
              companyId: pr.companyId,
              purchaseRequestItemId: itemId,
              purchaseRequestId: id,
              actorId: userId,
              outcome: d.outcome as any,
              note: d.note?.trim() ? d.note.trim() : null,
              lineAmountAtDecision: itemLineAmountForTotal(item as any),
            },
          });
        }

        const allItems = await tx.purchaseRequestItem.findMany({
          where: { purchaseRequestId: id, deletedAt: null },
          select: prItemSafeSelect,
        });
        const rowsWithOutcome = allItems.map((it) => {
          const st = String(it.status || 'NEW');
          const o = it.departmentItemOutcome;
          const outcome = (
            itemEligibleForDepartmentOutcome(st)
              ? ((o || 'APPROVED') as DepartmentItemOutcomeValue)
              : 'APPROVED'
          ) as DepartmentItemOutcomeValue;
          return {
            id: it.id,
            status: st,
            departmentItemOutcome: outcome,
            departmentDecisionNote: it.departmentDecisionNote ?? null,
            amount: it.amount,
            qty: it.qty,
            unitPrice: it.unitPrice,
            estimatedUnitPriceVnd: it.estimatedUnitPriceVnd,
          };
        });
        const newTotal = sumPurchaseTotalAfterDepartmentDecisions(rowsWithOutcome);
        updatedPR = await tx.purchaseRequest.update({
          where: { id },
          data: { totalAmount: newTotal },
        });
      });

      await auditUpdate(
        'purchase_requests',
        id,
        { status: pr.status, totalAmount: pr.totalAmount },
        { status: updatedPR!.status, totalAmount: Number(updatedPR!.totalAmount ?? 0) },
        { userId, companyId: pr.companyId || undefined }
      );

      if (requestor) {
        await createNotification(getIO(), {
          userId: requestor.id,
          role: requestor.role,
          type: 'PR_DEPARTMENT_HEAD_APPROVED',
          title: 'Dòng PR đã được xem xét',
          message: `Trưởng phòng đã cập nhật quyết định cho một hoặc nhiều dòng trên ${pr.prNumber}.`,
          relatedId: id,
          relatedType: 'PR',
          metadata: { prNumber: pr.prNumber },
          companyId: pr.companyId,
        });
      }

      reply.send({
        message: 'Đã cập nhật quyết định theo dòng',
        pr: {
          id: updatedPR!.id,
          prNumber: updatedPR!.prNumber,
          status: updatedPR!.status,
          totalAmount: Number(updatedPR!.totalAmount ?? 0),
          totalAmountSnapshot:
            updatedPR!.totalAmountSnapshot != null ? Number(updatedPR!.totalAmountSnapshot) : null,
        },
      });
      return;
    }

    const decisionInput = new Map<string, { outcome: DepartmentItemOutcomeValue; note?: string }>();
    for (const row of itemDecisions || []) {
      if (!row?.itemId || !row?.outcome) continue;
      if (!['APPROVED', 'REJECTED', 'ON_HOLD', 'REVISION_REQUIRED'].includes(row.outcome)) {
        return reply.code(400).send({ error: `Outcome không hợp lệ: ${row.outcome}` });
      }
      decisionInput.set(row.itemId, { outcome: row.outcome, note: row.note });
    }

    const itemIds = new Set(pr.items.map((i) => i.id));
    for (const itemId of decisionInput.keys()) {
      if (!itemIds.has(itemId)) {
        return reply.code(400).send({ error: `Dòng không thuộc PR: ${itemId}` });
      }
    }

    const decidedAt = new Date();
    const rowsWithOutcome: Array<{
      id: string;
      status: string;
      departmentItemOutcome: DepartmentItemOutcomeValue;
      departmentDecisionNote: string | null;
      amount?: unknown;
      qty?: unknown;
      unitPrice?: unknown;
      estimatedUnitPriceVnd?: unknown;
    }> = [];

    for (const item of pr.items) {
      const st = String((item as { status?: string }).status || 'NEW');
      let outcome: DepartmentItemOutcomeValue;
      let note: string | null = null;

      if (!itemEligibleForDepartmentOutcome(st)) {
        outcome = 'APPROVED';
        note = null;
      } else {
        const d = decisionInput.get(item.id);
        outcome = d?.outcome ?? 'APPROVED';
        note = d?.note?.trim() ? d.note.trim() : null;
        if (outcome === 'REJECTED' || outcome === 'REVISION_REQUIRED') {
          if (!note) {
            return reply.code(400).send({
              error: `Dòng "${(item as { description?: string }).description ?? item.id}" cần lý do khi từ chối hoặc yêu cầu chỉnh sửa (note).`,
            });
          }
        }
      }

      rowsWithOutcome.push({
        id: item.id,
        status: st,
        departmentItemOutcome: outcome,
        departmentDecisionNote: note,
        amount: (item as { amount?: unknown }).amount,
        qty: (item as { qty?: unknown }).qty,
        unitPrice: (item as { unitPrice?: unknown }).unitPrice,
        estimatedUnitPriceVnd: (item as { estimatedUnitPriceVnd?: unknown }).estimatedUnitPriceVnd,
      });
    }

    const snapshotExisting =
      pr.totalAmountSnapshot != null ? Number(pr.totalAmountSnapshot) : null;
    const snapshotValue =
      snapshotExisting != null && Number.isFinite(snapshotExisting)
        ? snapshotExisting
        : sumAllLinesSnapshot(pr.items as Parameters<typeof sumAllLinesSnapshot>[0]);

    const newTotal = sumPurchaseTotalAfterDepartmentDecisions(rowsWithOutcome);
    const hasActive = hasActivePurchasingAfterDecisions(rowsWithOutcome);

    let needBranchManagerApproval = true;
    try {
      const branch = await prisma.branch.findFirst({
        where: { branchCode, deletedAt: null },
        select: { id: true },
      });
      if (branch) {
        const rule = await prisma.branchApprovalRule.findFirst({
          where: { branchId: branch.id, deletedAt: null },
          select: { needBranchManagerApproval: true },
        });
        if (rule) needBranchManagerApproval = rule.needBranchManagerApproval;
      }
    } catch (e: any) {
      console.warn('⚠️ Không đọc được BranchApprovalRule, dùng mặc định YES:', e?.message || e);
    }

    const nextStatus = needBranchManagerApproval ? 'BRANCH_MANAGER_PENDING' : 'BUYER_LEADER_PENDING';

    const { updatedPR, finalPrStatus } = await prisma.$transaction(async (tx) => {
      for (const row of rowsWithOutcome) {
        await tx.purchaseRequestItem.update({
          where: { id: row.id },
          data: {
            departmentItemOutcome: row.departmentItemOutcome as any,
            departmentDecisionNote: row.departmentDecisionNote,
            departmentDecidedById: userId,
            departmentDecidedAt: decidedAt,
            departmentRevisionSubmittedAt: null,
          },
        });
        await tx.prItemDepartmentDecision.create({
          data: {
            id: randomUUID(),
            companyId: pr.companyId,
            purchaseRequestItemId: row.id,
            purchaseRequestId: id,
            actorId: userId,
            outcome: row.departmentItemOutcome as any,
            note: row.departmentDecisionNote,
            lineAmountAtDecision: itemLineAmountForTotal(row),
          },
        });
      }

      if (!hasActive) {
        const rejected = await tx.purchaseRequest.update({
          where: { id },
          data: {
            status: 'MANAGER_REJECTED',
            notes: comment?.trim() || 'Tất cả dòng mua bị từ chối, tạm hoãn hoặc chờ chỉnh sửa',
            totalAmount: newTotal,
            ...(pr.totalAmountSnapshot == null ? { totalAmountSnapshot: snapshotValue } : {}),
            location: branchCode,
          },
        });
        await tx.pRApproval.create({
          data: {
            purchaseRequestId: id,
            approverId: userId,
            action: 'REJECT',
            comment: comment?.trim() || 'Không còn dòng mua được duyệt',
          },
        });
        return { updatedPR: rejected, finalPrStatus: 'MANAGER_REJECTED' as const };
      }

      const updated = await tx.purchaseRequest.update({
        where: { id },
        data: {
          status: nextStatus as any,
          location: branchCode,
          totalAmount: newTotal,
          ...(pr.totalAmountSnapshot == null ? { totalAmountSnapshot: snapshotValue } : {}),
        },
      });
      await tx.pRApproval.create({
        data: {
          purchaseRequestId: id,
          approverId: userId,
          action: 'APPROVE',
          comment: comment || null,
        },
      });
      return { updatedPR: updated, finalPrStatus: nextStatus as string };
    });

    if (requestor) {
      if (finalPrStatus === 'MANAGER_REJECTED') {
        const template = NotificationTemplates.PR_RETURNED(
          pr.prNumber,
          comment?.trim() || 'Tất cả dòng mua bị từ chối, tạm hoãn hoặc chờ chỉnh sửa'
        );
        await createNotification(getIO(), {
          userId: requestor.id,
          role: requestor.role,
          type: 'PR_RETURNED',
          title: template.title,
          message: template.message,
          relatedId: id,
          relatedType: 'PR',
          metadata: { prNumber: pr.prNumber, reason: comment },
          companyId: pr.companyId,
        });
      } else {
        const template = NotificationTemplates.PR_DEPARTMENT_HEAD_APPROVED(pr.prNumber);
        await createNotification(getIO(), {
          userId: requestor.id,
          role: requestor.role,
          type: 'PR_DEPARTMENT_HEAD_APPROVED',
          title: template.title,
          message: template.message,
          relatedId: id,
          relatedType: 'PR',
          metadata: { prNumber: pr.prNumber },
          companyId: pr.companyId,
        });
      }
      await markNotificationAsResolved(id, 'PR', 'PR_PENDING_APPROVAL');
    }

    if (hasActive && needBranchManagerApproval) {
      const branchManagers = await prisma.user.findMany({
        where: {
          role: 'BRANCH_MANAGER',
          location: branchCode,
          deletedAt: null,
        },
        select: { id: true, role: true },
      });

      for (const manager of branchManagers) {
        const template = NotificationTemplates.PR_PENDING_APPROVAL_BRANCH(
          pr.prNumber,
          pr.department || 'N/A'
        );
        await createNotification(getIO(), {
          userId: manager.id,
          role: manager.role,
          type: 'PR_PENDING_APPROVAL_BRANCH',
          title: template.title,
          message: template.message,
          relatedId: id,
          relatedType: 'PR',
          metadata: { prNumber: pr.prNumber, department: pr.department },
          companyId: pr.companyId,
        });
      }
    } else if (hasActive && !needBranchManagerApproval) {
      const buyerLeaders = await prisma.user.findMany({
        where: {
          role: 'BUYER_LEADER',
          deletedAt: null,
        },
        select: { id: true, role: true },
      });

      for (const leader of buyerLeaders) {
        const template = NotificationTemplates.PR_READY_FOR_ASSIGNMENT(pr.prNumber);
        await createNotification(getIO(), {
          userId: leader.id,
          role: leader.role,
          type: 'PR_READY_FOR_ASSIGNMENT',
          title: template.title,
          message: template.message,
          relatedId: id,
          relatedType: 'PR',
          metadata: { prNumber: pr.prNumber },
          companyId: pr.companyId,
        });
      }
    }

    await auditUpdate(
      'purchase_requests',
      id,
      { status: pr.status, totalAmount: pr.totalAmount },
      { status: finalPrStatus, totalAmount: newTotal },
      { userId, companyId: pr.companyId || undefined }
    );

    reply.send({
      message:
        finalPrStatus === 'MANAGER_REJECTED'
          ? 'PR bị từ chối do không còn dòng mua được duyệt'
          : 'PR approved successfully',
      pr: {
        id: updatedPR.id,
        prNumber: updatedPR.prNumber,
        status: updatedPR.status,
        totalAmount: Number(updatedPR.totalAmount ?? 0),
        totalAmountSnapshot: updatedPR.totalAmountSnapshot != null ? Number(updatedPR.totalAmountSnapshot) : null,
      },
    });
  } catch (error: any) {
    console.error('Approve PR error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Reject PR
export const rejectPR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };
    const { comment } = (request.body as { comment?: string }) || {};

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (!comment) {
      return reply.code(400).send({ error: 'Comment is required for rejection' });
    }

    // Check if PR exists and is pending
    const pr = await prisma.purchaseRequest.findFirst({
      where: {
        id,
        status: 'MANAGER_PENDING',
        deletedAt: null,
      },
      include: {
        items: {
          where: { deletedAt: null },
          select: prItemSafeSelect,
        },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found or not pending approval' });
    }

    // CẤP 1: bắt buộc đúng người quản lý trực tiếp (direct_manager_code)
    const approver = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, role: true },
    });
    const requestorForAuth = await prisma.user.findUnique({
      where: { id: pr.requestorId },
      select: { directManagerCode: true },
    });
    if (!approver?.username || !requestorForAuth) {
      return reply.code(400).send({ error: 'Thiếu dữ liệu để xác thực quyền duyệt' });
    }
    if (approver.role !== 'DEPARTMENT_HEAD') {
      return reply.code(403).send({ error: 'Forbidden - chỉ quản lý trực tiếp mới được từ chối PR cấp 1' });
    }
    if ((requestorForAuth.directManagerCode || '').trim() !== approver.username.trim()) {
      return reply.code(403).send({
        error: 'Forbidden - chỉ quản lý trực tiếp mới được từ chối PR cấp 1',
      });
    }

    const decidedAt = new Date();
    const snapshotValue =
      pr.totalAmountSnapshot != null && Number.isFinite(Number(pr.totalAmountSnapshot))
        ? Number(pr.totalAmountSnapshot)
        : sumAllLinesSnapshot(pr.items as Parameters<typeof sumAllLinesSnapshot>[0]);

    const updatedPR = await prisma.$transaction(async (tx) => {
      for (const item of pr.items) {
        await tx.purchaseRequestItem.update({
          where: { id: item.id },
          data: {
            departmentItemOutcome: 'REJECTED' as any,
            departmentDecisionNote: comment,
            departmentDecidedById: userId,
            departmentDecidedAt: decidedAt,
          },
        });
        await tx.prItemDepartmentDecision.create({
          data: {
            id: randomUUID(),
            companyId: pr.companyId,
            purchaseRequestItemId: item.id,
            purchaseRequestId: id,
            actorId: userId,
            outcome: 'REJECTED' as any,
            note: comment,
            lineAmountAtDecision: itemLineAmountForTotal(item as Parameters<typeof itemLineAmountForTotal>[0]),
          },
        });
      }

      await tx.pRApproval.create({
        data: {
          purchaseRequestId: id,
          approverId: userId,
          action: 'REJECT',
          comment: comment,
        },
      });

      return tx.purchaseRequest.update({
        where: { id },
        data: {
          status: 'MANAGER_REJECTED',
          notes: comment,
          totalAmount: 0,
          ...(pr.totalAmountSnapshot == null ? { totalAmountSnapshot: snapshotValue } : {}),
        },
      });
    });

    // Get requestor info for notification
    const requestor = await prisma.user.findUnique({
      where: { id: pr.requestorId },
      select: { id: true, role: true },
    });

    // Send notification to REQUESTOR: PR bị trả
    if (requestor) {
      const template = NotificationTemplates.PR_RETURNED(pr.prNumber, comment);
      await createNotification(getIO(), {
        userId: requestor.id,
        role: requestor.role,
        type: 'PR_RETURNED',
        title: template.title,
        message: template.message,
        relatedId: id,
        relatedType: 'PR',
        metadata: { prNumber: pr.prNumber, reason: comment },
        companyId: pr.companyId,
      });

      // Mark old notification as resolved
      await markNotificationAsResolved(id, 'PR', 'PR_PENDING_APPROVAL');
    }

    // Audit log
    await auditUpdate(
      'purchase_requests',
      id,
      { status: pr.status },
      { status: 'MANAGER_REJECTED' },
      { userId, companyId: pr.companyId || undefined }
    );

    reply.send({
      message: 'PR rejected successfully',
      pr: {
        id: updatedPR.id,
        prNumber: updatedPR.prNumber,
        status: updatedPR.status,
      },
    });
  } catch (error: any) {
    console.error('Reject PR error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Return PR for more info
export const returnPR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    const { id } = request.params as { id: string };
    const { comment } = (request.body as { comment?: string }) || {};

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (!comment) {
      return reply.code(400).send({ error: 'Comment is required for return' });
    }

    // Check if PR exists and is pending
    const pr = await prisma.purchaseRequest.findFirst({
      where: {
        id,
        status: 'MANAGER_PENDING',
        deletedAt: null,
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found or not pending approval' });
    }

    // CẤP 1: bắt buộc đúng người quản lý trực tiếp (direct_manager_code)
    const approver = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, role: true },
    });
    const requestorForAuth = await prisma.user.findUnique({
      where: { id: pr.requestorId },
      select: { directManagerCode: true },
    });
    if (!approver?.username || !requestorForAuth) {
      return reply.code(400).send({ error: 'Thiếu dữ liệu để xác thực quyền duyệt' });
    }
    if (approver.role !== 'DEPARTMENT_HEAD') {
      return reply.code(403).send({ error: 'Forbidden - chỉ quản lý trực tiếp mới được trả PR cấp 1' });
    }
    if ((requestorForAuth.directManagerCode || '').trim() !== approver.username.trim()) {
      return reply.code(403).send({
        error: 'Forbidden - chỉ quản lý trực tiếp mới được trả PR cấp 1',
      });
    }

    // Update PR status
    const updatedPR = await prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: 'MANAGER_RETURNED',
        notes: comment,
      },
    });

    // Create approval record
    await prisma.pRApproval.create({
      data: {
        purchaseRequestId: id,
        approverId: userId,
        action: 'RETURN',
        comment: comment,
      },
    });

    // Get requestor info for notification
    const requestor = await prisma.user.findUnique({
      where: { id: pr.requestorId },
      select: { id: true, role: true },
    });

    // Send notification to REQUESTOR: PR bị trả
    if (requestor) {
      const template = NotificationTemplates.PR_RETURNED(pr.prNumber, comment);
      await createNotification(getIO(), {
        userId: requestor.id,
        role: requestor.role,
        type: 'PR_RETURNED',
        title: template.title,
        message: template.message,
        relatedId: id,
        relatedType: 'PR',
        metadata: { prNumber: pr.prNumber, reason: comment },
        companyId: pr.companyId,
      });

      // Mark old notification as resolved
      await markNotificationAsResolved(id, 'PR', 'PR_PENDING_APPROVAL');
    }

    // Audit log
    await auditUpdate(
      'purchase_requests',
      id,
      { status: pr.status },
      { status: 'MANAGER_RETURNED' },
      { userId, companyId: pr.companyId || undefined }
    );

    reply.send({
      message: 'PR returned successfully',
      pr: {
        id: updatedPR.id,
        prNumber: updatedPR.prNumber,
        status: updatedPR.status,
      },
    });
  } catch (error: any) {
    console.error('Return PR error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Department Overview - Thống kê PR phòng ban
export const getDepartmentOverview = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { department: true },
    });

    const userDepartment = user?.department || null;
    
    // Removed check for userDepartment - department_head can see all PRs regardless of department
    // Get all PRs (removed department filter to show all PRs)
    const allPRs = await prisma.purchaseRequest.findMany({
      where: {
        // Removed department filter to allow department_head to see all PRs
        // OR: [
        //   { department: userDepartment },
        //   {
        //     requestor: {
        //       department: userDepartment,
        //     },
        //   },
        // ],
        deletedAt: null,
      },
      include: {
        requestor: {
          select: {
            id: true,
            username: true,
          },
        },
        items: {
          where: { deletedAt: null },
          select: {
            qty: true,
            unitPrice: true,
            amount: true,
          },
        },
      },
    });

    // Calculate total amount for each PR
    const prsWithAmounts = allPRs.map((pr) => {
      let calculatedTotal = 0;
      if (pr.items.length > 0) {
        calculatedTotal = pr.items.reduce((sum, item) => {
          const qty = Number(item.qty) || 0;
          const unitPrice = Number(item.unitPrice) || 0;
          const amount = Number(item.amount) || 0;
          return sum + (amount > 0 ? amount : qty * unitPrice);
        }, 0);
      }
      const finalTotal = (pr.totalAmount && Number(pr.totalAmount) > calculatedTotal)
        ? Number(pr.totalAmount)
        : calculatedTotal;

      return {
        ...pr,
        calculatedTotal: finalTotal,
      };
    });

    // PR theo nhân viên
    const prsByEmployeeMap = new Map<string, { username: string; count: number; totalAmount: number }>();
    prsWithAmounts.forEach((pr) => {
      const requestorId = pr.requestorId;
      const username = pr.requestor?.username || 'N/A';
      const existing = prsByEmployeeMap.get(requestorId);
      if (existing) {
        existing.count += 1;
        existing.totalAmount += pr.calculatedTotal;
      } else {
        prsByEmployeeMap.set(requestorId, {
          username,
          count: 1,
          totalAmount: pr.calculatedTotal,
        });
      }
    });
    const prsByEmployee = Array.from(prsByEmployeeMap.values()).sort((a, b) => b.count - a.count);

    const typeLabelMap: { [key: string]: string } = {
      MATERIAL: 'Vật tư',
      SERVICE: 'Dịch vụ',
      COMMERCIAL: 'Thương mại',
      PRODUCTION: 'Sản xuất',
      PROJECT: 'Dự án',
      OFFICE: 'Văn phòng',
    };

    // PR theo loại
    const prsByTypeMap = new Map<string, { type: string; count: number; totalAmount: number }>();
    prsWithAmounts.forEach((pr) => {
      const typeKey = String(pr.type || 'PRODUCTION');
      const typeLabel = typeLabelMap[typeKey] || typeKey;
      const existing = prsByTypeMap.get(typeKey);
      if (existing) {
        existing.count += 1;
        existing.totalAmount += pr.calculatedTotal;
      } else {
        prsByTypeMap.set(typeKey, {
          type: typeLabel,
          count: 1,
          totalAmount: pr.calculatedTotal,
        });
      }
    });
    const prsByType = Array.from(prsByTypeMap.values());

    // PR theo trạng thái
    const prsByStatusMap = new Map<string, { status: string; count: number; totalAmount: number }>();
    const statusLabels: { [key: string]: string } = {
      'DRAFT': 'Nháp',
      'MANAGER_PENDING': 'Chờ quản lý trực tiếp',
      'MANAGER_APPROVED': 'Quản lý trực tiếp đã duyệt',
      'BRANCH_MANAGER_PENDING': 'Chờ GĐ Chi nhánh',
      'BUYER_LEADER_PENDING': 'Chờ Buyer Leader phân công',
      'ASSIGNED_TO_BUYER': 'Đã phân công Buyer',
      'RFQ_IN_PROGRESS': 'Đang hỏi giá',
      'QUOTATION_RECEIVED': 'Đã nhận báo giá',
      'SUPPLIER_SELECTED': 'Đã chọn NCC',
      'MANAGER_RETURNED': 'Trả về',
      'BRANCH_MANAGER_RETURNED': 'GĐ CN trả về',
      'NEED_MORE_INFO': 'Cần bổ sung',
    };

    prsWithAmounts.forEach((pr) => {
      const status = pr.status;
      const statusLabel = statusLabels[status] || status;
      const existing = prsByStatusMap.get(status);
      if (existing) {
        existing.count += 1;
        existing.totalAmount += pr.calculatedTotal;
      } else {
        prsByStatusMap.set(status, {
          status: statusLabel,
          count: 1,
          totalAmount: pr.calculatedTotal,
        });
      }
    });
    const prsByStatus = Array.from(prsByStatusMap.entries())
      .map(([statusCode, v]) => ({
        statusCode,
        status: v.status,
        count: v.count,
        totalAmount: v.totalAmount,
      }))
      .sort((a, b) => b.count - a.count);

    reply.send({
      prsByEmployee,
      prsByType,
      prsByStatus,
      totalPRs: allPRs.length,
    });
  } catch (error: any) {
    console.error('Get department overview error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

