import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { createNotification, markNotificationAsResolved, NotificationTemplates } from '../utils/notifications';
import { getIO } from '../utils/getIO';

function assertBgdOrAdmin(role: string | undefined): boolean {
  return role === 'BGD' || role === 'SYSTEM_ADMIN';
}

// GET /api/bgd/dashboard
export const getExecutiveDashboard = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const approvedPayments = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        deletedAt: null,
        status: 'DONE',
        purchaseRequest: {
          deletedAt: null,
          status: {
            in: [
              'BUYER_LEADER_PENDING',
              'BRANCH_MANAGER_APPROVED',
              'APPROVED_BY_BRANCH',
              'ASSIGNED_TO_BUYER',
              'RFQ_IN_PROGRESS',
              'QUOTATION_RECEIVED',
              'SUPPLIER_SELECTED',
              'PAYMENT_DONE',
            ],
          },
        },
      },
    });
    const totalApprovedPRValue = Number(approvedPayments._sum.amount || 0);

    const projectsAtRiskList: unknown[] = [];

    const criticalPRs = await prisma.purchaseRequest.findMany({
      where: {
        deletedAt: null,
        status: { in: ['SUBMITTED'] },
      },
      include: {
        items: { where: { deletedAt: null }, select: { qty: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const criticalPRsList = criticalPRs.map((pr) => {
      const qtySum = pr.items.reduce((sum, it) => sum + Number(it.qty), 0);
      return {
        code: pr.prNumber,
        description: pr.itemName || 'Không có mô tả',
        projectName: 'N/A',
        value: qtySum,
        reason: 'Chờ quyết định quan trọng',
      };
    });

    reply.send({
      metrics: {
        totalApprovedPRValue,
        projectsAtRisk: projectsAtRiskList.length,
        criticalPRsPending: criticalPRsList.length,
      },
      projectsAtRiskList,
      criticalPRsList,
      budgetUsage: {
        total: 0,
        used: totalApprovedPRValue,
        usedPercent: 0,
      },
      costTrends: [] as { period: string; change: number; description: string }[],
    });
  } catch (error) {
    console.error('Error fetching executive dashboard:', error);
    reply.status(500).send({ error: 'Failed to fetch dashboard data' });
  }
};

// GET /api/bgd/business-overview
export const getBusinessOverview = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const donePayments = await prisma.payment.findMany({
      where: {
        status: 'DONE',
        deletedAt: null,
      },
      select: { amount: true },
    });

    const totalCost = donePayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const prsForDist = await prisma.purchaseRequest.findMany({
      where: { deletedAt: null, salesPOId: { not: null } },
      select: {
        salesPOId: true,
        totalAmount: true,
        salesPO: {
          select: {
            salesPONumber: true,
            projectName: true,
            projectCode: true,
          },
        },
      },
    });

    const distMap = new Map<string, { name: string; code: string; amount: number }>();
    for (const pr of prsForDist) {
      const so = pr.salesPO;
      const key = pr.salesPOId || 'unknown';
      const name = so?.projectName || so?.salesPONumber || 'Dự án';
      const code = so?.projectCode || so?.salesPONumber || '';
      const prev = distMap.get(key) || { name, code, amount: 0 };
      prev.amount += Number(pr.totalAmount || 0);
      distMap.set(key, prev);
    }

    const totalDist = [...distMap.values()].reduce((s, v) => s + v.amount, 0);
    const costDistribution =
      totalDist > 0
        ? [...distMap.values()].map((v) => ({
            projectName: v.name,
            salesPOCode: v.code,
            projectCode: v.code,
            amount: v.amount,
            percentage: Math.round((v.amount / totalDist) * 1000) / 10,
          }))
        : [];

    const allPRs = await prisma.purchaseRequest.findMany({
      where: { deletedAt: null },
      select: { createdAt: true, status: true, totalAmount: true },
    });

    const completedPRs = allPRs.filter((pr) => pr.status === 'SUPPLIER_SELECTED').length;
    const prToPurchaseRatio =
      allPRs.length > 0 ? Math.round((completedPRs / allPRs.length) * 100) : 0;

    const byMonth = new Map<string, { prCount: number; totalValue: number }>();
    for (const pr of allPRs) {
      const d = pr.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cur = byMonth.get(key) || { prCount: 0, totalValue: 0 };
      cur.prCount += 1;
      cur.totalValue += Number(pr.totalAmount || 0);
      byMonth.set(key, cur);
    }
    const sortedMonths = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
    const demandTrends = sortedMonths.map(([period, v]) => ({
      period,
      prCount: v.prCount,
      totalValue: v.totalValue,
    }));
    const maxPRCount = Math.max(1, ...demandTrends.map((t) => t.prCount));

    const activeProjects = await prisma.salesPO.count({
      where: { deletedAt: null, status: 'ACTIVE' },
    });

    reply.send({
      totalCost,
      activeProjects,
      prToPurchaseRatio,
      costDistribution,
      demandTrends,
      maxPRCount,
      prStats: {
        totalPRs: allPRs.length,
        completedPRs,
      },
    });
  } catch (error) {
    console.error('Error fetching business overview:', error);
    reply.status(500).send({ error: 'Failed to fetch business overview' });
  }
};

// GET /api/bgd/exception-approval
export const getExceptionApprovals = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const rows = await prisma.budgetException.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        purchaseRequest: {
          select: {
            prNumber: true,
            itemName: true,
            projectName: true,
            projectCode: true,
          },
        },
        branchManager: { select: { username: true } },
      },
    });

    const mapPending = (be: (typeof rows)[0]) => ({
      id: be.id,
      code: be.purchaseRequest.prNumber,
      type: 'Vượt ngân sách',
      title: be.purchaseRequest.itemName || `PR ${be.purchaseRequest.prNumber}`,
      description: `Chênh PR ${Number(be.prAmount).toLocaleString('vi-VN')} VNĐ vs mua ${Number(be.purchaseAmount).toLocaleString('vi-VN')} VNĐ (+${Number(be.overPercent)}%)`,
      value: Number(be.purchaseAmount),
      projectName: be.purchaseRequest.projectName || be.purchaseRequest.projectCode || '—',
      createdAt: be.createdAt.toLocaleDateString('vi-VN'),
    });

    const pending = rows.filter((r) => r.status === 'PENDING').map(mapPending);

    const approved = rows
      .filter((r) => r.status === 'APPROVED')
      .map((r) => ({
        id: r.id,
        title: r.purchaseRequest.itemName || `PR ${r.purchaseRequest.prNumber}`,
        description: r.comment || 'Đã chấp nhận vượt ngân sách',
        approvedBy: r.branchManager?.username || '—',
        approvedAt: r.updatedAt.toLocaleDateString('vi-VN'),
      }));

    const rejected = rows
      .filter((r) => r.status === 'REJECTED' || r.status === 'NEGOTIATION_REQUESTED')
      .map((r) => ({
        id: r.id,
        title: r.purchaseRequest.itemName || `PR ${r.purchaseRequest.prNumber}`,
        description: r.comment || 'Từ chối / đàm phán',
        rejectionReason: r.comment || '—',
        rejectedBy: r.branchManager?.username || '—',
        rejectedAt: r.updatedAt.toLocaleDateString('vi-VN'),
      }));

    reply.send({ pending, approved, rejected });
  } catch (error) {
    console.error('Error fetching exception approvals:', error);
    reply.status(500).send({ error: 'Failed to fetch exception approvals' });
  }
};

// POST /api/bgd/exception-approval/:id/approve
export const approveException = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!assertBgdOrAdmin(user?.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { id } = request.params as { id: string };
    const { comment } = (request.body as { comment?: string }) || {};

    const exception = await prisma.budgetException.findUnique({
      where: { id },
      include: { purchaseRequest: true },
    });

    if (!exception) {
      return reply.status(404).send({ error: 'Budget exception not found' });
    }

    if (exception.status !== 'PENDING') {
      return reply.status(400).send({ error: 'Budget exception is not pending' });
    }

    await prisma.budgetException.update({
      where: { id },
      data: {
        status: 'APPROVED',
        action: 'APPROVE',
        branchManagerId: userId,
        comment: comment ?? exception.comment,
      },
    });

    await prisma.purchaseRequest.update({
      where: { id: exception.purchaseRequestId },
      data: { status: 'BUDGET_APPROVED' },
    });

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: exception.purchaseRequestId },
      include: {
        requestor: { select: { id: true, role: true } },
        supplierSelections: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { buyerLeader: { select: { id: true, role: true } } },
        },
      },
    });

    if (pr) {
      await markNotificationAsResolved(exception.purchaseRequestId, 'PR', 'PR_OVER_BUDGET_DECISION_REQUIRED');
      await markNotificationAsResolved(exception.purchaseRequestId, 'PR', 'PR_OVER_BUDGET_ACTION_REQUIRED');
      if (pr.supplierSelections[0]?.buyerLeader) {
        await markNotificationAsResolved(exception.purchaseRequestId, 'PR', 'PR_OVER_BUDGET');
      }
    }

    reply.send({ success: true, message: 'Exception approved' });
  } catch (error) {
    console.error('Error approving exception:', error);
    reply.status(500).send({ error: 'Failed to approve exception' });
  }
};

// POST /api/bgd/exception-approval/:id/reject
export const rejectException = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!assertBgdOrAdmin(user?.role)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const { id } = request.params as { id: string };
    const reason = (request.body as { reason?: string })?.reason?.trim() || '';
    if (!reason) {
      return reply.status(400).send({ error: 'reason is required' });
    }

    const exception = await prisma.budgetException.findUnique({
      where: { id },
      include: { purchaseRequest: true },
    });

    if (!exception) {
      return reply.status(404).send({ error: 'Budget exception not found' });
    }

    if (exception.status !== 'PENDING') {
      return reply.status(400).send({ error: 'Budget exception is not pending' });
    }

    await prisma.budgetException.update({
      where: { id },
      data: {
        status: 'REJECTED',
        action: 'REJECT',
        branchManagerId: userId,
        comment: reason,
      },
    });

    await prisma.purchaseRequest.update({
      where: { id: exception.purchaseRequestId },
      data: { status: 'BUDGET_REJECTED' },
    });

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: exception.purchaseRequestId },
      include: {
        requestor: { select: { id: true, role: true } },
        supplierSelections: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { buyerLeader: { select: { id: true, role: true } } },
        },
      },
    });

    if (pr?.requestor) {
      await createNotification(getIO(), {
        userId: pr.requestor.id,
        role: pr.requestor.role,
        type: 'PR_RETURNED',
        title: 'PR vượt ngân sách bị từ chối',
        message: `PR ${pr.prNumber} vượt ngân sách bị từ chối – ${reason}`,
        relatedId: exception.purchaseRequestId,
        relatedType: 'PR',
        metadata: { prNumber: pr.prNumber, reason },
        companyId: pr.companyId,
      });
    }

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

    reply.send({ success: true, message: 'Exception rejected' });
  } catch (error) {
    console.error('Error rejecting exception:', error);
    reply.status(500).send({ error: 'Failed to reject exception' });
  }
};

// GET /api/bgd/strategic-suppliers
export const getStrategicSupplierView = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const poAgg = await prisma.purchaseOrder.groupBy({
      by: ['supplierId'],
      where: {
        deletedAt: null,
        status: {
          in: [
            'SUBMITTED',
            'APPROVED',
            'ISSUED',
            'CREATED',
            'SENT',
            'CONFIRMED',
            'PARTIAL_RECEIVED',
            'FULLY_RECEIVED',
            'CLOSED',
          ],
        },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const totalPurchaseValue = poAgg.reduce((s, g) => s + Number(g._sum.totalAmount || 0), 0);

    const supplierIds = poAgg.map((g) => g.supplierId);
    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds }, deletedAt: null },
      select: { id: true, name: true, code: true },
    });
    const nameById = new Map(suppliers.map((s) => [s.id, s.name]));

    const withShare = poAgg
      .map((g) => ({
        supplierId: g.supplierId,
        purchaseValue: Number(g._sum.totalAmount || 0),
        totalPRs: g._count.id,
        dependencyPercent:
          totalPurchaseValue > 0
            ? Math.round((Number(g._sum.totalAmount || 0) / totalPurchaseValue) * 1000) / 10
            : 0,
        name: nameById.get(g.supplierId) || 'NCC',
      }))
      .sort((a, b) => b.purchaseValue - a.purchaseValue);

    const keySuppliers = withShare.slice(0, 10).map((r) => ({
      name: r.name,
      category: '—',
      purchaseValue: r.purchaseValue,
      dependencyPercent: r.dependencyPercent,
      totalPRs: r.totalPRs,
    }));

    const maxDep = withShare.length ? Math.max(...withShare.map((w) => w.dependencyPercent)) : 0;
    const supplyChainRisks = withShare.filter((w) => w.dependencyPercent >= 40).length;

    reply.send({
      keySuppliersCount: keySuppliers.length,
      dependencyLevel: maxDep,
      supplyChainRisks,
      totalPurchaseValue,
      keySuppliers,
      dependencyAnalysis: withShare.slice(0, 8).map((w) => ({
        category: w.name,
        dependencyPercent: Math.min(100, Math.round(w.dependencyPercent)),
        supplierCount: 1,
      })),
      supplyChainRiskList: [] as { title: string; description: string; impact: string; severity: string }[],
      recommendations: [] as { title: string; description: string }[],
    });
  } catch (error) {
    console.error('Error fetching strategic supplier view:', error);
    reply.status(500).send({ error: 'Failed to fetch strategic supplier view' });
  }
};

// GET /api/bgd/executive-reports
export const getExecutiveReports = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    reply.send({
      totalSaving: 0,
      savingAmount: 0,
      procurementEfficiency: 0,
      completionRate: 0,
      savingDetails: [] as { category: string; description: string; savedAmount: number; percentage: number }[],
      procurementPerformance: [] as { name: string; value: string; percentage: number }[],
      planVsActual: [] as { period: string; planned: number; actual: number }[],
      summary: [] as { title: string; content: string }[],
    });
  } catch (error) {
    console.error('Error fetching executive reports:', error);
    reply.status(500).send({ error: 'Failed to fetch executive reports' });
  }
};

// GET /api/bgd/critical-alerts
export const getCriticalAlerts = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const pendingBe = await prisma.budgetException.findMany({
      where: { status: 'PENDING' },
      include: {
        purchaseRequest: {
          select: { prNumber: true, projectName: true, itemName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const critical = pendingBe.map((be) => ({
      title: `PR ${be.purchaseRequest.prNumber} — vượt ngân sách`,
      description:
        be.purchaseRequest.itemName ||
        `Vượt ${Number(be.overPercent)}% — chờ quyết định (PR vs giá mua NCC)`,
      category: 'budget',
      detectedAt: be.createdAt.toLocaleString('vi-VN'),
      affectedProject: be.purchaseRequest.projectName || undefined,
      impact: 'Cần xử lý ngoại lệ ngân sách',
    }));

    reply.send({
      critical,
      high: [] as typeof critical,
      medium: [] as typeof critical,
      resolved: 0,
    });
  } catch (error) {
    console.error('Error fetching critical alerts:', error);
    reply.status(500).send({ error: 'Failed to fetch critical alerts' });
  }
};

// GET /api/bgd/governance
export const getGovernancePolicy = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    reply.send({
      approvalThresholds: [] as { category: string; description: string; threshold: number }[],
      strategicPolicies: [] as { title: string; description: string; effectiveDate: string; updatedAt: string }[],
      priorityGuidelines: [] as {
        category: string;
        priority: string;
        description: string;
        sla: number;
      }[],
      riskPolicies: [] as { title: string; description: string }[],
    });
  } catch (error) {
    console.error('Error fetching governance policy:', error);
    reply.status(500).send({ error: 'Failed to fetch governance policy' });
  }
};
