import { FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditUpdate } from '../utils/audit';
import { createNotification, NotificationTemplates, markNotificationAsResolved } from '../utils/notifications';
import { getIO } from '../utils/getIO';
import { z } from 'zod';
import { prSalesPOSelect, serializePRSalesOrder } from '../utils/prSalesOrder';
import {
  BRANCH_APPROVED_STATUSES,
  BRANCH_REJECTED_STATUSES,
  BRANCH_RETURNED_STATUSES,
  branchManagerApprovedByUserWhere,
  branchManagerRejectedByUserWhere,
  branchManagerReturnedByUserWhere,
  normalizeApprovalQueueFilter,
  periodStartDaysAgo,
} from '../utils/prApprovalQueue';
import { sumAllLinesSnapshot } from '../utils/departmentPrItemReview';
import {
  hasActivePurchasingAfterBranchDecisions,
  itemEligibleForBranchLevelDecision,
  itemEligibleForDepartmentOutcome,
  sumPurchaseTotalAfterBranchDecisions,
  type DepartmentItemOutcomeValue,
} from '../utils/branchPrItemReview';

// Get Branch Manager Dashboard
export const getBranchManagerDashboard = async (
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
      select: { location: true },
    });

    const branchLocation = user?.location || null;

    // Build where clause - if location is set, filter by it, otherwise show all
    // Only show PRs that have been approved by Department Head
    const whereClause: any = {
      status: 'BRANCH_MANAGER_PENDING',
      deletedAt: null,
    };

    // Only filter by location if branch manager has a specific location
    if (branchLocation && branchLocation !== 'ALL') {
      whereClause.requestor = {
        location: branchLocation,
      };
    }

    // Get pending PRs (waiting for approval)
    const pendingPRs = await prisma.purchaseRequest.findMany({
      where: whereClause,
      include: {
        requestor: {
          select: {
            username: true,
            location: true,
          },
        },
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
          take: 1,
        },
        salesPO: { select: prSalesPOSelect },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // No need to filter again since we already filtered in the query
    const branchPRs = pendingPRs;

    // Get period (last 30 days)
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30);

    // Get current month start
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    // Get approved PRs this period
    const approvedPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: { in: ['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'] as any },
        deletedAt: null,
        updatedAt: {
          gte: periodStart,
        },
        requestor: branchLocation !== 'ALL' ? {
          location: branchLocation,
        } : undefined,
      },
      select: {
        id: true,
        totalAmount: true,
        currency: true,
        updatedAt: true,
        createdAt: true,
        type: true,
      },
    });

    // Get approved PRs this month (for total amount)
    const approvedPRsThisMonth = await prisma.purchaseRequest.findMany({
      where: {
        status: { in: ['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'] as any },
        deletedAt: null,
        updatedAt: {
          gte: currentMonthStart,
        },
        requestor: branchLocation !== 'ALL' ? {
          location: branchLocation,
        } : undefined,
      },
      select: {
        totalAmount: true,
        currency: true,
        type: true,
      },
    });

    // Calculate total amount this month
    const totalPRValueThisMonth = approvedPRsThisMonth.reduce((sum, pr) => {
      return sum + (pr.totalAmount ? Number(pr.totalAmount) : 0);
    }, 0);

    const productionValueThisMonth = approvedPRsThisMonth
      .filter((pr) => pr.type === 'PRODUCTION')
      .reduce((sum, pr) => sum + (pr.totalAmount ? Number(pr.totalAmount) : 0), 0);
    const productionValueSharePercent =
      totalPRValueThisMonth > 0
        ? Math.round((productionValueThisMonth / totalPRValueThisMonth) * 1000) / 10
        : 0;

    // Get rejected/returned PRs this period
    const rejectedPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: { in: ['BRANCH_MANAGER_REJECTED', 'BRANCH_MANAGER_RETURNED'] },
        deletedAt: null,
        updatedAt: {
          gte: periodStart,
        },
        requestor: branchLocation !== 'ALL' ? {
          location: branchLocation,
        } : undefined,
      },
    });

    // Get urgent PRs (requiredDate is within 3 days)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const urgentPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: 'SUBMITTED',
        deletedAt: null,
        requiredDate: {
          lte: threeDaysFromNow,
          gte: new Date(),
        },
        requestor: branchLocation !== 'ALL' ? {
          location: branchLocation,
        } : undefined,
      },
      include: {
        requestor: {
          select: {
            username: true,
            location: true,
          },
        },
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
          take: 1,
        },
        salesPO: { select: prSalesPOSelect },
      },
      take: 10,
    });

    // PRs by department
    const prsByDepartment = branchPRs.reduce((acc: any[], pr) => {
      const dept = pr.department || pr.requestor.location || 'N/A';
      const existing = acc.find((item) => item.department === dept);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ department: dept, count: 1 });
      }
      return acc;
    }, []);

    // Get budget exceptions pending approval
    const budgetExceptions = await prisma.budgetException.findMany({
      where: {
        status: 'PENDING',
        purchaseRequest: {
          deletedAt: null,
          requestor: branchLocation !== 'ALL' ? {
            location: branchLocation,
          } : undefined,
        },
      },
      include: {
        purchaseRequest: {
          select: {
            prNumber: true,
            department: true,
          },
        },
      },
    });

    const budgetVarianceAvgOverPercent =
      budgetExceptions.length > 0
        ? Math.round(
            (budgetExceptions.reduce((s, b) => s + Number(b.overPercent), 0) / budgetExceptions.length) * 10,
          ) / 10
        : 0;

    const prNestedWhere: { deletedAt: null; requestor?: { location: string } } = {
      deletedAt: null,
    };
    if (branchLocation && branchLocation !== 'ALL') {
      prNestedWhere.requestor = { location: branchLocation };
    }

    const branchManagerApprovals = await prisma.pRApproval.findMany({
      where: {
        approverId: userId,
        action: 'APPROVE',
        createdAt: { gte: periodStart },
        purchaseRequest: { is: prNestedWhere },
      },
      select: {
        createdAt: true,
        purchaseRequest: { select: { createdAt: true } },
      },
    });

    let avgBranchApprovalLeadTimeHours = 0;
    if (branchManagerApprovals.length > 0) {
      const sumHours = branchManagerApprovals.reduce((acc, row) => {
        const ms = row.createdAt.getTime() - row.purchaseRequest.createdAt.getTime();
        return acc + ms / (1000 * 60 * 60);
      }, 0);
      avgBranchApprovalLeadTimeHours = Math.round((sumHours / branchManagerApprovals.length) * 10) / 10;
    }

    const decidedLast30d = approvedPRs.length + rejectedPRs.length;
    const approvalRateLast30d =
      decidedLast30d > 0
        ? Math.round((approvedPRs.length / decidedLast30d) * 1000) / 10
        : 0;

    // Get recent pending PRs (5-7 PRs) for dashboard list
    const recentPendingPRs = branchPRs.slice(0, 7).map((pr) => {
      const firstItem = pr.items?.[0];
      return {
        id: pr.id,
        prNumber: pr.prNumber,
        department: pr.department || (pr as any).requestor?.location || 'N/A',
        totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
        currency: pr.currency || 'VND',
        requestor: {
          username: (pr as any).requestor?.username || 'N/A',
          location: (pr as any).requestor?.location || null,
        },
        itemName: firstItem?.description || 'N/A',
        createdAt: pr.createdAt.toISOString(),
        purpose: pr.purpose || null,
        salesOrder: serializePRSalesOrder(pr as any),
      };
    });

    // PRs by type (Production vs Commercial)
    const prsByType = {
      PRODUCTION: approvedPRsThisMonth.filter(pr => pr.type === 'PRODUCTION').length,
      COMMERCIAL: approvedPRsThisMonth.filter(pr => pr.type === 'COMMERCIAL').length,
    };

    // PRs by date (last 30 days) for chart
    const prsByDate: { [key: string]: number } = {};
    approvedPRs.forEach((pr) => {
      const dateKey = pr.updatedAt.toISOString().split('T')[0];
      prsByDate[dateKey] = (prsByDate[dateKey] || 0) + 1;
    });

    // Convert to array format for chart
    const prsByDateArray = Object.entries(prsByDate)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    reply.send({
      pendingPRs: branchPRs.length,
      approvedPRsThisPeriod: approvedPRs.length,
      rejectedPRsThisPeriod: rejectedPRs.length,
      urgentPRs: urgentPRs.length,
      budgetExceptionsPending: budgetExceptions.length,
      totalPRValueThisMonth,
      approvalRateLast30d,
      avgBranchApprovalLeadTimeHours,
      budgetVarianceAvgOverPercent,
      productionValueSharePercent,
      prsByDepartment,
      recentPendingPRs,
      prsByType,
      prsByDate: prsByDateArray,
      urgentPRList: urgentPRs.map((pr) => {
        const firstItem = (pr as any).items?.[0];
        return {
          id: pr.id,
          prNumber: pr.prNumber,
          itemName: firstItem?.description || pr.itemName || 'N/A',
          requiredDate: pr.requiredDate,
          requestor: pr.requestor,
          salesOrder: serializePRSalesOrder(pr as any),
        };
      }),
    });
  } catch (error: any) {
    console.error('Get branch manager dashboard error:', error);
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
      select: { location: true },
    });

    const branchLocation = user?.location || null;
    const queue = normalizeApprovalQueueFilter((request.query as { queue?: string })?.queue);

    const periodStart = periodStartDaysAgo(365);
    const whereClause: any = {
      deletedAt: null,
    };

    if (queue === 'pending') {
      whereClause.status = 'BRANCH_MANAGER_PENDING';
    } else if (queue === 'approved') {
      Object.assign(whereClause, branchManagerApprovedByUserWhere(userId, periodStart));
    } else if (queue === 'rejected') {
      Object.assign(whereClause, branchManagerRejectedByUserWhere(userId, periodStart));
    } else if (queue === 'returned') {
      Object.assign(whereClause, branchManagerReturnedByUserWhere(userId, periodStart));
    } else {
      whereClause.status = {
        in: [
          'BRANCH_MANAGER_PENDING',
          ...BRANCH_APPROVED_STATUSES,
          ...BRANCH_REJECTED_STATUSES,
          ...BRANCH_RETURNED_STATUSES,
        ],
      };
      whereClause.updatedAt = { gte: periodStart };
    }

    if (branchLocation && branchLocation !== 'ALL') {
      whereClause.requestor = {
        location: branchLocation,
      };
    }

    const pendingPRs = await prisma.purchaseRequest.findMany({
      where: whereClause,
      include: {
        requestor: {
          select: {
            username: true,
            email: true,
            location: true,
          },
        },
        items: {
          where: { deletedAt: null },
          orderBy: { lineNo: 'asc' },
        },
        approvals: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        salesPO: { select: prSalesPOSelect },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // No need to filter again since we already filtered in the query
    const branchPRs = pendingPRs;

    // Debug log
    console.log('Get Pending PRs:', {
      userId,
      branchLocation,
      totalPendingPRs: pendingPRs.length,
      branchPRsCount: branchPRs.length,
      pendingPRsDetails: pendingPRs.map(pr => ({
        prNumber: pr.prNumber,
        status: pr.status,
        requestorLocation: pr.requestor?.location,
        requestorId: pr.requestorId,
      })),
    });

    const mappedPRs = branchPRs.map((pr) => {
      const firstItem = pr.items[0];
      const calculatedTotal = (pr.items || []).reduce((sum, item: any) => {
        const qty = Number(item.qty) || 0;
        const estimatedUnitPrice = Number(item.estimatedUnitPriceVnd) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const effectiveUnitPrice = estimatedUnitPrice > 0 ? estimatedUnitPrice : unitPrice;
        return sum + qty * effectiveUnitPrice;
      }, 0);
      const resolvedPrTotal = (() => {
        const direct = Number(pr.totalAmount || 0);
        if (direct > 0) return direct;
        return calculatedTotal > 0 ? calculatedTotal : null;
      })();
      return {
        id: pr.id,
        prNumber: pr.prNumber,
        status: pr.status,
        department: pr.department,
        totalAmount: resolvedPrTotal,
        currency: pr.currency,
        requestor: pr.requestor,
        // Summary fields for list display
        itemName: firstItem?.description || 'N/A',
        itemCount: pr.items.length,
        quantity: firstItem ? Number(firstItem.qty) : 0,
        unit: firstItem?.unit || '',
        specifications: firstItem?.spec || null,
        // Full items array
        items: pr.items.map((item: any) => ({
          id: item.id,
          lineNo: item.lineNo,
          status: item.status,
          description: item.description,
          partNo: item.partNo,
          spec: item.spec,
          manufacturer: item.manufacturer,
          qty: Number(item.qty),
          unit: item.unit,
          departmentItemOutcome: item.departmentItemOutcome ?? null,
          departmentDecisionNote: item.departmentDecisionNote ?? null,
          branchItemOutcome: item.branchItemOutcome ?? null,
          branchDecisionNote: item.branchDecisionNote ?? null,
          departmentRevisionSubmittedAt: item.departmentRevisionSubmittedAt
            ? item.departmentRevisionSubmittedAt.toISOString()
            : null,
          unitPrice:
            Number(item.estimatedUnitPriceVnd) > 0
              ? Number(item.estimatedUnitPriceVnd)
              : item.unitPrice
                ? Number(item.unitPrice)
                : null,
          amount:
            item.amount && Number(item.amount) > 0
              ? Number(item.amount)
              : (() => {
                  const qty = Number(item.qty) || 0;
                  const estimated = Number(item.estimatedUnitPriceVnd) || 0;
                  const unit = Number(item.unitPrice) || 0;
                  const effectiveUnitPrice = estimated > 0 ? estimated : unit;
                  return effectiveUnitPrice > 0 ? qty * effectiveUnitPrice : null;
                })(),
          estimatedUnitPriceVnd:
            Number(item.estimatedUnitPriceVnd) > 0 ? Number(item.estimatedUnitPriceVnd) : null,
          purpose: item.purpose,
          remark: item.remark,
        })),
        requiredDate: pr.requiredDate?.toISOString(),
        purpose: pr.purpose,
        notes: pr.notes,
        createdAt: pr.createdAt.toISOString(),
        salesOrder: serializePRSalesOrder(pr),
        lastApproval: pr.approvals[0] ? {
          action: pr.approvals[0].action,
          comment: pr.approvals[0].comment,
          createdAt: pr.approvals[0].createdAt.toISOString(),
        } : null,
      };
    });

    const responseData = { prs: mappedPRs, queue };
    const responseString = JSON.stringify(responseData);

    console.log('Sending response:', {
      prsCount: mappedPRs.length,
      prsNumbers: mappedPRs.map(pr => pr.prNumber),
      responseSize: responseString.length,
      responsePreview: responseString.substring(0, 200),
    });

    // Ensure proper content-type and send response
    // Use reply.send() which Fastify will serialize automatically
    return reply
      .type('application/json')
      .code(200)
      .send(responseData);
  } catch (error: any) {
    console.error('Get pending PRs error:', error);
    console.error('Error stack:', error.stack);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Approve PR (optional partial: itemDecisions per NEED_PURCHASE line đã duyệt cấp phòng)
export const approvePR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { prId } = request.params as { prId: string };
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

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: prId, deletedAt: null },
      include: {
        items: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    if (pr.status !== 'BRANCH_MANAGER_PENDING') {
      return reply.code(400).send({ error: 'PR is not pending approval' });
    }

    const decisionInput = new Map<string, { outcome: DepartmentItemOutcomeValue; note?: string }>();
    for (const row of itemDecisions || []) {
      if (!row?.itemId || !row?.outcome) continue;
      if (!['APPROVED', 'REJECTED', 'ON_HOLD', 'REVISION_REQUIRED'].includes(row.outcome)) {
        return reply.code(400).send({ error: `Outcome không hợp lệ: ${row.outcome}` });
      }
      decisionInput.set(row.itemId, { outcome: row.outcome, note: row.note });
    }

    const decidedAt = new Date();
    const rowsWithOutcome: Array<{
      id: string;
      status: string;
      branchItemOutcome: DepartmentItemOutcomeValue;
      branchDecisionNote: string | null;
      departmentItemOutcome: DepartmentItemOutcomeValue | null;
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
      } else if (!itemEligibleForBranchLevelDecision(item)) {
        outcome = 'APPROVED';
      } else {
        const d = decisionInput.get(item.id);
        outcome = d?.outcome ?? 'APPROVED';
        note = d?.note?.trim() ? d.note.trim() : null;
        if (outcome === 'REJECTED' || outcome === 'REVISION_REQUIRED') {
          if (!note) {
            return reply.code(400).send({
              error: `Dòng "${(item as { description?: string }).description ?? item.id}" cần lý do khi từ chối hoặc yêu cầu chỉnh sửa.`,
            });
          }
        }
      }

      rowsWithOutcome.push({
        id: item.id,
        status: st,
        branchItemOutcome: outcome,
        branchDecisionNote: note,
        departmentItemOutcome: (item as { departmentItemOutcome?: DepartmentItemOutcomeValue | null })
          .departmentItemOutcome ?? null,
        amount: item.amount,
        qty: item.qty,
        unitPrice: item.unitPrice,
        estimatedUnitPriceVnd: (item as { estimatedUnitPriceVnd?: unknown }).estimatedUnitPriceVnd,
      });
    }

    const hasActive = hasActivePurchasingAfterBranchDecisions(rowsWithOutcome);
    const newTotal = sumPurchaseTotalAfterBranchDecisions(rowsWithOutcome);
    const nextStatus = hasActive ? ('BUYER_LEADER_PENDING' as const) : ('BRANCH_MANAGER_REJECTED' as const);

    const snapshotExisting =
      pr.totalAmountSnapshot != null ? Number(pr.totalAmountSnapshot) : null;
    const snapshotValue =
      snapshotExisting != null && Number.isFinite(snapshotExisting)
        ? snapshotExisting
        : sumAllLinesSnapshot(pr.items as Parameters<typeof sumAllLinesSnapshot>[0]);

    await prisma.$transaction(async (tx) => {
      for (const row of rowsWithOutcome) {
        if (!itemEligibleForDepartmentOutcome(row.status)) continue;
        if (!itemEligibleForBranchLevelDecision({
          status: row.status,
          departmentItemOutcome: row.departmentItemOutcome,
        })) {
          continue;
        }
        await tx.purchaseRequestItem.update({
          where: { id: row.id },
          data: {
            branchItemOutcome: row.branchItemOutcome as any,
            branchDecisionNote: row.branchDecisionNote,
            branchDecidedById: userId,
            branchDecidedAt: decidedAt,
          },
        });
      }
      await tx.purchaseRequest.update({
        where: { id: prId },
        data: {
          status: nextStatus as any,
          totalAmount: newTotal,
          totalAmountSnapshot: snapshotValue,
        },
      });
    });

    await prisma.pRApproval.create({
      data: {
        purchaseRequestId: prId,
        approverId: userId,
        action: hasActive ? 'APPROVE' : 'REJECT',
        comment: comment || null,
        companyId: pr.companyId || null,
      },
    });

    // Get requestor and department head for notifications
    const requestor = await prisma.user.findUnique({
      where: { id: pr.requestorId },
      select: { id: true, role: true },
    });

    const departmentHead = await prisma.user.findFirst({
      where: {
        role: 'DEPARTMENT_HEAD',
        department: pr.department,
        deletedAt: null,
      },
      select: { id: true, role: true },
    });

    if (requestor) {
      if (hasActive) {
        const template = NotificationTemplates.PR_BRANCH_MANAGER_APPROVED(pr.prNumber);
        await createNotification(getIO(), {
          userId: requestor.id,
          role: requestor.role,
          type: 'PR_BRANCH_MANAGER_APPROVED',
          title: template.title,
          message: template.message,
          relatedId: prId,
          relatedType: 'PR',
          metadata: { prNumber: pr.prNumber },
          companyId: pr.companyId,
        });
        await markNotificationAsResolved(prId, 'PR', 'PR_DEPARTMENT_HEAD_APPROVED');
      } else {
        const template = NotificationTemplates.PR_RETURNED(pr.prNumber, comment || 'Từ chối tại cấp chi nhánh');
        await createNotification(getIO(), {
          userId: requestor.id,
          role: requestor.role,
          type: 'PR_RETURNED',
          title: 'PR bị từ chối',
          message: `PR ${pr.prNumber} không còn dòng được duyệt tại cấp chi nhánh.`,
          relatedId: prId,
          relatedType: 'PR',
          metadata: { prNumber: pr.prNumber, reason: comment || '' },
          companyId: pr.companyId,
        });
      }
    }

    if (hasActive) {
      const buyerLeaders = await prisma.user.findMany({
        where: { role: 'BUYER_LEADER', deletedAt: null },
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
          relatedId: prId,
          relatedType: 'PR',
          metadata: { prNumber: pr.prNumber },
          companyId: pr.companyId,
        });
      }
    }

    await markNotificationAsResolved(prId, 'PR', 'PR_PENDING_APPROVAL_BRANCH');

    await auditUpdate(
      'purchase_requests',
      prId,
      { status: pr.status, totalAmount: pr.totalAmount },
      { status: nextStatus as any, totalAmount: newTotal, approvedBy: userId },
      { userId, companyId: pr.companyId || undefined }
    );

    reply.send({
      message: hasActive ? 'PR approved successfully' : 'PR rejected — no purchasing lines approved',
      status: nextStatus,
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
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { prId } = request.params as { prId: string };
    const { comment } = request.body as { comment: string };

    if (!comment || comment.trim().length === 0) {
      return reply.code(400).send({ error: 'Comment is required for rejection' });
    }

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: prId },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    if (pr.status !== 'BRANCH_MANAGER_PENDING') {
      return reply.code(400).send({ error: 'PR is not pending approval' });
    }

    // Update PR status
    await prisma.purchaseRequest.update({
      where: { id: prId },
      data: {
        status: 'BRANCH_MANAGER_REJECTED',
      },
    });

    // Create PR Approval record
    await prisma.pRApproval.create({
      data: {
        purchaseRequestId: prId,
        approverId: userId,
        action: 'REJECT',
        comment: comment,
        companyId: pr.companyId || null,
      },
    });

    // Get requestor and department head for notifications
    const requestor = await prisma.user.findUnique({
      where: { id: pr.requestorId },
      select: { id: true, role: true },
    });

    const departmentHead = await prisma.user.findFirst({
      where: {
        role: 'DEPARTMENT_HEAD',
        department: pr.department,
        deletedAt: null,
      },
      select: { id: true, role: true },
    });

    // Send notification to REQUESTOR: PR bị từ chối
    if (requestor) {
      const template = NotificationTemplates.PR_RETURNED(pr.prNumber, comment);
      await createNotification(getIO(), {
        userId: requestor.id,
        role: requestor.role,
        type: 'PR_RETURNED',
        title: 'PR bị từ chối',
        message: `PR ${pr.prNumber} bị từ chối bởi GĐ CN – ${comment}`,
        relatedId: prId,
        relatedType: 'PR',
        metadata: { prNumber: pr.prNumber, reason: comment },
        companyId: pr.companyId,
      });

      // Mark old notifications as resolved
      await markNotificationAsResolved(prId, 'PR', 'PR_DEPARTMENT_HEAD_APPROVED');
      await markNotificationAsResolved(prId, 'PR', 'PR_BRANCH_MANAGER_APPROVED');
    }

    // Send notification to DEPARTMENT_HEAD: PR được trả về từ GĐ CN
    if (departmentHead && departmentHead.id !== requestor?.id) {
      const template = NotificationTemplates.PR_RETURNED_FROM_BRANCH(pr.prNumber);
      await createNotification(getIO(), {
        userId: departmentHead.id,
        role: departmentHead.role,
        type: 'PR_RETURNED_FROM_BRANCH',
        title: template.title,
        message: template.message,
        relatedId: prId,
        relatedType: 'PR',
        metadata: { prNumber: pr.prNumber },
        companyId: pr.companyId,
      });
    }

    // Mark old notifications as resolved
    await markNotificationAsResolved(prId, 'PR', 'PR_PENDING_APPROVAL_BRANCH');

    await auditUpdate(
      'purchase_requests',
      prId,
      { status: pr.status },
      { status: 'BRANCH_MANAGER_REJECTED', rejectedBy: userId, comment },
      { userId, companyId: pr.companyId || undefined }
    );

    reply.send({ message: 'PR rejected successfully' });
  } catch (error: any) {
    console.error('Reject PR error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Return PR (request more info)
export const returnPR = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { prId } = request.params as { prId: string };
    const { comment } = request.body as { comment: string };

    if (!comment || comment.trim().length === 0) {
      return reply.code(400).send({ error: 'Comment is required for return' });
    }

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: prId },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found' });
    }

    if (pr.status !== 'BRANCH_MANAGER_PENDING') {
      return reply.code(400).send({ error: 'PR is not pending approval' });
    }

    // Update PR status
    await prisma.purchaseRequest.update({
      where: { id: prId },
      data: {
        status: 'BRANCH_MANAGER_RETURNED',
      },
    });

    // Create PR Approval record
    await prisma.pRApproval.create({
      data: {
        purchaseRequestId: prId,
        approverId: userId,
        action: 'RETURN',
        comment: comment,
        companyId: pr.companyId || null,
      },
    });

    // Get requestor and department head for notifications
    const requestor = await prisma.user.findUnique({
      where: { id: pr.requestorId },
      select: { id: true, role: true },
    });

    const departmentHead = await prisma.user.findFirst({
      where: {
        role: 'DEPARTMENT_HEAD',
        department: pr.department,
        deletedAt: null,
      },
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
        relatedId: prId,
        relatedType: 'PR',
        metadata: { prNumber: pr.prNumber, reason: comment },
        companyId: pr.companyId,
      });

      // Mark old notifications as resolved
      await markNotificationAsResolved(prId, 'PR', 'PR_DEPARTMENT_HEAD_APPROVED');
      await markNotificationAsResolved(prId, 'PR', 'PR_BRANCH_MANAGER_APPROVED');
    }

    // Send notification to DEPARTMENT_HEAD: PR được trả về từ GĐ CN
    if (departmentHead && departmentHead.id !== requestor?.id) {
      const template = NotificationTemplates.PR_RETURNED_FROM_BRANCH(pr.prNumber);
      await createNotification(getIO(), {
        userId: departmentHead.id,
        role: departmentHead.role,
        type: 'PR_RETURNED_FROM_BRANCH',
        title: template.title,
        message: template.message,
        relatedId: prId,
        relatedType: 'PR',
        metadata: { prNumber: pr.prNumber },
        companyId: pr.companyId,
      });
    }

    // Mark old notifications as resolved
    await markNotificationAsResolved(prId, 'PR', 'PR_PENDING_APPROVAL_BRANCH');

    await auditUpdate(
      'purchase_requests',
      prId,
      { status: pr.status },
      { status: 'BRANCH_MANAGER_RETURNED', returnedBy: userId, comment },
      { userId, companyId: pr.companyId || undefined }
    );

    reply.send({ message: 'PR returned successfully' });
  } catch (error: any) {
    console.error('Return PR error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Budget Exceptions
export const getBudgetExceptions = async (
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
      select: { location: true },
    });

    const branchLocation = user?.location || 'ALL';

    const exceptions = await prisma.budgetException.findMany({
      where: {
        status: 'PENDING',
        purchaseRequest: {
          deletedAt: null,
          requestor: branchLocation !== 'ALL' ? {
            location: branchLocation,
          } : undefined,
        },
      },
      include: {
        purchaseRequest: {
          select: {
            id: true,
            prNumber: true,
            department: true,
            totalAmount: true,
            currency: true,
            requestor: {
              select: {
                username: true,
                email: true,
              },
            },
          },
        },
        branchManager: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const mappedExceptions = exceptions.map((ex) => ({
      id: ex.id,
      prNumber: ex.purchaseRequest.prNumber,
      prId: ex.purchaseRequest.id,
      department: ex.purchaseRequest.department,
      prAmount: Number(ex.prAmount),
      purchaseAmount: Number(ex.purchaseAmount),
      overPercent: Number(ex.overPercent),
      status: ex.status,
      action: ex.action,
      comment: ex.comment,
      currency: ex.purchaseRequest.currency,
      requestor: ex.purchaseRequest.requestor,
      createdAt: ex.createdAt.toISOString(),
      updatedAt: ex.updatedAt.toISOString(),
    }));

    reply.send({ exceptions: mappedExceptions });
  } catch (error: any) {
    console.error('Get budget exceptions error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Budget Exception by ID
export const getBudgetExceptionById = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const exception = await prisma.budgetException.findUnique({
      where: { id },
      include: {
        purchaseRequest: {
          include: {
            items: {
              where: { deletedAt: null },
              orderBy: { lineNo: 'asc' },
            },
            supplierSelections: {
              include: {
                quotation: {
                  include: {
                    supplier: {
                      select: {
                        name: true,
                        code: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        branchManager: {
          select: {
            username: true,
            email: true,
          },
        },
      },
    });

    if (!exception) {
      return reply.code(404).send({ error: 'Budget exception not found' });
    }

    reply.send({
      id: exception.id,
      prNumber: exception.purchaseRequest.prNumber,
      prId: exception.purchaseRequest.id,
      prAmount: Number(exception.prAmount),
      purchaseAmount: Number(exception.purchaseAmount),
      overPercent: Number(exception.overPercent),
      status: exception.status,
      action: exception.action,
      comment: exception.comment,
      currency: exception.purchaseRequest.currency,
      purchaseRequest: {
        ...exception.purchaseRequest,
        items: exception.purchaseRequest.items.map((item: any) => ({
          ...item,
          qty: Number(item.qty),
          unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
          amount: item.amount ? Number(item.amount) : null,
        })),
      },
      selectedSupplier: exception.purchaseRequest.supplierSelections[0]?.quotation.supplier || null,
      createdAt: exception.createdAt.toISOString(),
      updatedAt: exception.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Get budget exception by ID error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Approve Budget Exception
export const approveBudgetException = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const { comment } = request.body as { comment?: string };

    const exception = await prisma.budgetException.findUnique({
      where: { id },
      include: {
        purchaseRequest: true,
      },
    });

    if (!exception) {
      return reply.code(404).send({ error: 'Budget exception not found' });
    }

    if (exception.status !== 'PENDING') {
      return reply.code(400).send({ error: 'Budget exception is not pending' });
    }

    // Update exception
    await prisma.budgetException.update({
      where: { id },
      data: {
        status: 'APPROVED',
        action: 'APPROVE',
        branchManagerId: userId,
        comment: comment || null,
      },
    });

    // Update PR status
    await prisma.purchaseRequest.update({
      where: { id: exception.purchaseRequestId },
      data: {
        status: 'BUDGET_APPROVED',
      },
    });

    // Get PR info for notifications
    const prInclude = {
      requestor: {
        select: { id: true, role: true },
      },
      supplierSelections: {
        take: 1,
        include: {
          buyerLeader: {
            select: { id: true, role: true },
          },
        },
      },
    } satisfies Prisma.PurchaseRequestInclude;

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: exception.purchaseRequestId },
      include: prInclude,
    }) as Prisma.PurchaseRequestGetPayload<{ include: typeof prInclude }> | null;

    // Mark old notifications as resolved
    if (pr) {
      await markNotificationAsResolved(exception.purchaseRequestId, 'PR', 'PR_OVER_BUDGET_DECISION_REQUIRED');
      await markNotificationAsResolved(exception.purchaseRequestId, 'PR', 'PR_OVER_BUDGET_ACTION_REQUIRED');
      if (pr.supplierSelections[0]?.buyerLeader) {
        await markNotificationAsResolved(exception.purchaseRequestId, 'PR', 'PR_OVER_BUDGET');
      }
    }

    reply.send({ message: 'Budget exception approved successfully' });
  } catch (error: any) {
    console.error('Approve budget exception error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Reject Budget Exception
export const rejectBudgetException = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const { comment } = request.body as { comment: string };

    if (!comment || comment.trim().length === 0) {
      return reply.code(400).send({ error: 'Comment is required for rejection' });
    }

    const exception = await prisma.budgetException.findUnique({
      where: { id },
      include: {
        purchaseRequest: true,
      },
    });

    if (!exception) {
      return reply.code(404).send({ error: 'Budget exception not found' });
    }

    if (exception.status !== 'PENDING') {
      return reply.code(400).send({ error: 'Budget exception is not pending' });
    }

    // Update exception
    await prisma.budgetException.update({
      where: { id },
      data: {
        status: 'REJECTED',
        action: 'REJECT',
        branchManagerId: userId,
        comment: comment,
      },
    });

    // Update PR status to BUDGET_REJECTED
    await prisma.purchaseRequest.update({
      where: { id: exception.purchaseRequestId },
      data: {
        status: 'BUDGET_REJECTED',
      },
    });

    // Get PR info for notifications
    const prNotifyInclude = {
      requestor: {
        select: { id: true, role: true },
      },
      supplierSelections: {
        take: 1,
        orderBy: { createdAt: 'desc' as const },
        include: {
          buyerLeader: {
            select: { id: true, role: true },
          },
        },
      },
    } satisfies Prisma.PurchaseRequestInclude;

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: exception.purchaseRequestId },
      include: prNotifyInclude,
    }) as Prisma.PurchaseRequestGetPayload<{ include: typeof prNotifyInclude }> | null;

    // Send notification to REQUESTOR: PR vượt ngân sách bị từ chối
    if (pr?.requestor) {
      const template = NotificationTemplates.PR_RETURNED(pr.prNumber, comment);
      await createNotification(getIO(), {
        userId: pr.requestor.id,
        role: pr.requestor.role,
        type: 'PR_RETURNED',
        title: 'PR vượt ngân sách bị từ chối',
        message: `PR ${pr.prNumber} vượt ngân sách bị từ chối – ${comment}`,
        relatedId: exception.purchaseRequestId,
        relatedType: 'PR',
        metadata: { prNumber: pr.prNumber, reason: comment },
        companyId: pr.companyId,
      });
    }

    // Send notification to BUYER_LEADER: PR bị trả
    if (pr?.supplierSelections[0]?.buyerLeader) {
      const leader = pr.supplierSelections[0].buyerLeader;
      const template = NotificationTemplates.PR_RETURNED_FROM_BRANCH_MANAGER(pr.prNumber);
      await createNotification(getIO(), {
        userId: leader.id,
        role: leader.role,
        type: 'PR_RETURNED_FROM_BRANCH_MANAGER',
        title: template.title,
        message: template.message,
        relatedId: exception.purchaseRequestId,
        relatedType: 'PR',
        metadata: { prNumber: pr.prNumber },
        companyId: pr.companyId,
      });
    }

    // Mark old notifications as resolved
    await markNotificationAsResolved(exception.purchaseRequestId, 'PR', 'PR_OVER_BUDGET_DECISION_REQUIRED');
    await markNotificationAsResolved(exception.purchaseRequestId, 'PR', 'PR_OVER_BUDGET_ACTION_REQUIRED');

    reply.send({ message: 'Budget exception rejected successfully' });
  } catch (error: any) {
    console.error('Reject budget exception error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Request Negotiation for Budget Exception
export const requestNegotiation = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };
    const { comment } = request.body as { comment: string };

    if (!comment || comment.trim().length === 0) {
      return reply.code(400).send({ error: 'Comment is required for negotiation request' });
    }

    const exception = await prisma.budgetException.findUnique({
      where: { id },
      include: {
        purchaseRequest: true,
      },
    });

    if (!exception) {
      return reply.code(404).send({ error: 'Budget exception not found' });
    }

    if (exception.status !== 'PENDING') {
      return reply.code(400).send({ error: 'Budget exception is not pending' });
    }

    // Update exception
    await prisma.budgetException.update({
      where: { id },
      data: {
        status: 'NEGOTIATION_REQUESTED',
        action: 'REQUEST_NEGOTIATION',
        branchManagerId: userId,
        comment: comment,
      },
    });

    // Update PR status back to QUOTATION_RECEIVED (to allow re-selection)
    await prisma.purchaseRequest.update({
      where: { id: exception.purchaseRequestId },
      data: {
        status: 'QUOTATION_RECEIVED',
      },
    });

    reply.send({ message: 'Negotiation requested successfully' });
  } catch (error: any) {
    console.error('Request negotiation error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get PR History
export const getPRHistory = async (
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
      select: { location: true },
    });

    const branchLocation = user?.location || 'ALL';
    const { status, department, days = 30 } = request.query as any;

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - Number(days));

    const where: any = {
      deletedAt: null,
      updatedAt: {
        gte: periodStart,
      },
    };

    if (status && status !== 'all') {
      if (status === 'APPROVED') {
        where.status = { in: ['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED'] as any };
      } else if (status === 'REJECTED') {
        where.status = 'BRANCH_MANAGER_REJECTED';
      } else if (status === 'RETURNED') {
        where.status = 'BRANCH_MANAGER_RETURNED';
      } else {
        where.status = status;
      }
    }

    const prs = await prisma.purchaseRequest.findMany({
      where,
      include: {
        requestor: {
          select: {
            username: true,
            location: true,
          },
        },
        approvals: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        salesPO: { select: prSalesPOSelect },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 100,
    });

    // Filter by branch
    const branchPRs = branchLocation !== 'ALL'
      ? prs.filter((pr) => pr.requestor.location === branchLocation)
      : prs;

    const mappedPRs = branchPRs.map((pr) => ({
      id: pr.id,
      prNumber: pr.prNumber,
      itemName: pr.itemName,
      status: pr.status,
      requestor: pr.requestor,
      department: pr.department || pr.requestor.location || 'N/A',
      processedAt: pr.updatedAt.toISOString(),
      salesOrder: serializePRSalesOrder(pr),
      lastApproval: pr.approvals[0] ? {
        action: pr.approvals[0].action,
        comment: pr.approvals[0].comment,
        createdAt: pr.approvals[0].createdAt.toISOString(),
      } : null,
    }));

    reply.send({ prs: mappedPRs });
  } catch (error: any) {
    console.error('Get PR history error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Branch Overview
export const getBranchOverview = async (
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
      select: { location: true },
    });

    const branchLocation = user?.location || 'ALL';

    // Get all PRs from this branch (last 180 days - extended for more data)
    // If no data, try last 365 days
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 365);

    // Build where clause - be more flexible with location filter
    const whereClause: any = {
      deletedAt: null,
      createdAt: {
        gte: periodStart,
      },
    };

    // Only filter by location if branch manager has a specific location
    if (branchLocation && branchLocation !== 'ALL') {
      whereClause.requestor = {
        location: branchLocation,
      };
    }

    const allPRs = await prisma.purchaseRequest.findMany({
      where: whereClause,
      select: {
        id: true,
        prNumber: true,
        department: true,
        status: true,
        totalAmount: true,
        currency: true,
        type: true,
        createdAt: true,
        requestor: {
          select: {
            username: true,
            location: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000, // Limit to prevent too much data
    });

    console.log('Branch Overview - Query result:', {
      userId,
      branchLocation,
      periodStart: periodStart.toISOString(),
      totalPRs: allPRs.length,
      samplePRs: allPRs.slice(0, 3).map(pr => ({
        prNumber: pr.prNumber,
        department: pr.department,
        type: pr.type,
        totalAmount: pr.totalAmount,
      })),
    });

    // PRs by Department
    const prsByDepartment = allPRs.reduce((acc: any[], pr) => {
      const dept = pr.department || pr.requestor.location || 'N/A';
      const existing = acc.find((item) => item.department === dept);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ department: dept, count: 1 });
      }
      return acc;
    }, []);

    // PRs by Status
    const prsByStatus = allPRs.reduce((acc: any[], pr) => {
      const existing = acc.find((item) => item.status === pr.status);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ status: pr.status, count: 1 });
      }
      return acc;
    }, []);

    // PRs by Type (PRODUCTION vs COMMERCIAL)
    const prsByType = allPRs.reduce((acc: any[], pr) => {
      const type = pr.type || 'PRODUCTION';
      const existing = acc.find((item) => item.type === type);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ type, count: 1 });
      }
      return acc;
    }, []);

    // Top PR giá trị cao (top 5, từ 50 triệu trở lên)
    const MIN_TOP_PR_VALUE = 50000000; // 50 triệu VND
    const filteredPRs = allPRs.filter(pr => pr.totalAmount && Number(pr.totalAmount) >= MIN_TOP_PR_VALUE);

    console.log('Top PRs filter:', {
      totalPRs: allPRs.length,
      filteredPRsCount: filteredPRs.length,
      minValue: MIN_TOP_PR_VALUE,
      sampleAmounts: filteredPRs.slice(0, 5).map(pr => ({
        prNumber: pr.prNumber,
        totalAmount: Number(pr.totalAmount),
      })),
    });

    const topPRsByValue = filteredPRs
      .map(pr => ({
        id: pr.id,
        prNumber: pr.prNumber,
        department: pr.department || pr.requestor?.location || 'N/A',
        totalAmount: Number(pr.totalAmount),
        currency: pr.currency || 'VND',
        requestor: pr.requestor?.username || 'N/A',
        createdAt: pr.createdAt.toISOString(),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 30);

    // Ensure arrays are always returned, even if empty
    const response = {
      prsByDepartment: prsByDepartment || [],
      prsByType: prsByType || [],
      topPRsByValue: topPRsByValue || [],
    };

    console.log('Branch Overview - Response:', {
      prsByDepartmentCount: response.prsByDepartment.length,
      prsByTypeCount: response.prsByType.length,
      topPRsByValueCount: response.topPRsByValue.length,
      prsByDepartment: response.prsByDepartment,
      prsByType: response.prsByType,
      topPRsByValue: response.topPRsByValue.slice(0, 3),
    });

    // Ensure proper JSON serialization
    return reply
      .type('application/json')
      .code(200)
      .send(response);
  } catch (error: any) {
    console.error('Get branch overview error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Get Notifications
export const getBranchManagerNotifications = async (
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
      select: { location: true },
    });

    const branchLocation = user?.location || 'ALL';

    const notifications: any[] = [];

    // New PRs (last 7 days)
    const newPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: 'SUBMITTED',
        deletedAt: null,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
        requestor: branchLocation !== 'ALL' ? {
          location: branchLocation,
        } : undefined,
      },
      take: 10,
    });

    newPRs.forEach((pr) => {
      notifications.push({
        id: `new-pr-${pr.id}`,
        type: 'NEW_PR',
        title: 'Có PR mới chờ duyệt',
        message: `PR ${pr.prNumber} - ${pr.itemName} cần được duyệt`,
        prNumber: pr.prNumber,
        createdAt: pr.createdAt.toISOString(),
        read: false,
      });
    });

    // Budget exceptions
    const budgetExceptions = await prisma.budgetException.findMany({
      where: {
        status: 'PENDING',
        purchaseRequest: {
          deletedAt: null,
          requestor: branchLocation !== 'ALL' ? {
            location: branchLocation,
          } : undefined,
        },
      },
      include: {
        purchaseRequest: {
          select: {
            prNumber: true,
          },
        },
      },
      take: 10,
    });

    budgetExceptions.forEach((ex) => {
      notifications.push({
        id: `budget-exception-${ex.id}`,
        type: 'BUDGET_EXCEPTION',
        title: 'PR vượt ngân sách cần duyệt',
        message: `PR ${ex.purchaseRequest.prNumber} vượt ngân sách ${ex.overPercent}% cần được duyệt`,
        prNumber: ex.purchaseRequest.prNumber,
        createdAt: ex.createdAt.toISOString(),
        read: false,
      });
    });

    // Urgent PRs (requiredDate within 3 days)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const urgentPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: 'SUBMITTED',
        deletedAt: null,
        requiredDate: {
          lte: threeDaysFromNow,
          gte: new Date(),
        },
        requestor: branchLocation !== 'ALL' ? {
          location: branchLocation,
        } : undefined,
      },
      take: 10,
    });

    urgentPRs.forEach((pr) => {
      notifications.push({
        id: `urgent-${pr.id}`,
        type: 'PR_URGENT',
        title: 'PR sắp trễ hạn xử lý',
        message: `PR ${pr.prNumber} cần hàng vào ${pr.requiredDate?.toLocaleDateString('vi-VN')} - cần duyệt sớm`,
        prNumber: pr.prNumber,
        createdAt: new Date().toISOString(),
        read: false,
      });
    });

    // Sort by createdAt desc
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    reply.send({ notifications: notifications.slice(0, 50) });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};
