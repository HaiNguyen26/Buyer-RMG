import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/** Định mức tối đa PR đang xử lý / buyer — vượt = quá tải (cấu hình doanh nghiệp). */
const WORKLOAD_OVERLOAD_THRESHOLD = 15;
/** Mức sàn PR đang xử lý — dưới = nhàn rỗi, có thể bổ sung việc. */
const WORKLOAD_IDLE_THRESHOLD = 3;

/** Ngưỡng capacity (PR đang xử lý) cho % tải team-management — đồng bộ UI heatmap (90% / 40%). */
const BUYER_WORKLOAD_CAPACITY = 10;

const TEAM_MANAGEMENT_ACTIVE_PR_STATUSES = new Set<string>([
  'ASSIGNED_TO_BUYER',
  'RFQ_IN_PROGRESS',
  'QUOTATION_RECEIVED',
  'SUPPLIER_SELECTED',
]);

// GET /api/buyer-manager/dashboard
export const getBuyerManagerDashboard = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const now = new Date();

    // Total PR Value — tổng giá trị PR đang trong pipeline mua hàng (đã vào luồng duyệt/chờ mua)
    const PIPELINE_STATUSES = [
      'BUYER_LEADER_PENDING',
      'BRANCH_MANAGER_APPROVED',
      'ASSIGNED_TO_BUYER',
      'RFQ_IN_PROGRESS',
      'QUOTATION_RECEIVED',
      'SUPPLIER_SELECTED',
      'RFQ_COMPLETED',
      'PO_PENDING',
      'PO_IN_PROGRESS',
    ] as const;

    const BRANCH_APPROVED_STATUSES = new Set<string>([
      'BUYER_LEADER_PENDING',
      'BRANCH_MANAGER_APPROVED',
      'BRANCH_MANAGER_PENDING',
    ]);

    const BUYER_PROCESSING_STATUSES = new Set<string>([
      'ASSIGNED_TO_BUYER',
      'RFQ_IN_PROGRESS',
      'QUOTATION_RECEIVED',
      'SUPPLIER_SELECTED',
      'RFQ_COMPLETED',
      'PO_PENDING',
      'PO_IN_PROGRESS',
    ]);

    const FUNNEL_APPROVAL_STATUSES = new Set<string>([
      'BUYER_LEADER_PENDING',
      'BRANCH_MANAGER_PENDING',
      'BRANCH_MANAGER_APPROVED',
    ]);
    const FUNNEL_SOURCING_STATUSES = new Set<string>([
      'ASSIGNED_TO_BUYER',
      'RFQ_IN_PROGRESS',
      'QUOTATION_RECEIVED',
    ]);
    const FUNNEL_PO_STATUSES = new Set<string>([
      'SUPPLIER_SELECTED',
      'RFQ_COMPLETED',
      'PO_PENDING',
      'PO_IN_PROGRESS',
    ]);

    const prsInProgress = await prisma.purchaseRequest.findMany({
      where: {
        deletedAt: null,
        status: { in: [...PIPELINE_STATUSES] },
      },
      select: {
        totalAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 5000,
    });

    const totalPRValue = prsInProgress.reduce((sum, pr) => {
      return sum + (pr.totalAmount ? Number(pr.totalAmount) : 0);
    }, 0);

    let prValueBranchApproved = 0;
    let prValueBuyerProcessing = 0;
    for (const pr of prsInProgress) {
      const amt = pr.totalAmount ? Number(pr.totalAmount) : 0;
      if (BRANCH_APPROVED_STATUSES.has(pr.status)) prValueBranchApproved += amt;
      else if (BUYER_PROCESSING_STATUSES.has(pr.status)) prValueBuyerProcessing += amt;
    }

    const avgAgeDays = (subset: typeof prsInProgress) => {
      if (subset.length === 0) return 0;
      return Math.round(
        subset.reduce((sum, pr) => {
          const days = Math.floor((now.getTime() - pr.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
          return sum + Math.max(0, days);
        }, 0) / subset.length
      );
    };

    const funnelApprovalDays = avgAgeDays(prsInProgress.filter((p) => FUNNEL_APPROVAL_STATUSES.has(p.status)));
    const funnelSourcingDays = avgAgeDays(prsInProgress.filter((p) => FUNNEL_SOURCING_STATUSES.has(p.status)));
    const funnelPoDays = avgAgeDays(prsInProgress.filter((p) => FUNNEL_PO_STATUSES.has(p.status)));

    const funnelStages = [
      { key: 'approval', label: 'Duyệt PR', days: funnelApprovalDays },
      { key: 'sourcing', label: 'Chọn NCC', days: funnelSourcingDays },
      { key: 'po', label: 'Phát hành PO', days: funnelPoDays },
    ];
    const maxFunnelDays = Math.max(...funnelStages.map((s) => s.days), 0);
    const leadTimeFunnel = funnelStages.map((s) => ({
      ...s,
      isBottleneck: maxFunnelDays > 0 && s.days === maxFunnelDays,
    }));

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyReceived = await prisma.purchaseRequest.aggregate({
      where: {
        deletedAt: null,
        createdAt: { gte: monthStart },
        status: { notIn: ['DRAFT', 'CANCELLED'] },
      },
      _sum: { totalAmount: true },
    });
    const monthlyReceivedValue = Number(monthlyReceived._sum.totalAmount ?? 0);
    const monthlyPipelineCap = Math.max(monthlyReceivedValue, totalPRValue * 1.1, 1);
    const monthlySpendPct = Math.min(100, Math.round((totalPRValue / monthlyPipelineCap) * 100));

    // Lead time TB (ngày): từ tạo PR → thời điểm cập nhật khi đã chọn NCC (proxy “hoàn tất sourcing”)
    const completedPRs = await prisma.purchaseRequest.findMany({
      where: {
        deletedAt: null,
        status: 'SUPPLIER_SELECTED',
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
      take: 500,
    });

    const avgLeadTime =
      completedPRs.length > 0
        ? Math.round(
            completedPRs.reduce((sum, pr) => {
              const days = Math.floor(
                (pr.updatedAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60 * 24)
              );
              return sum + days;
            }, 0) / completedPRs.length
          )
        : 0;

    // Tỷ lệ PR ngân sách ngoại lệ / tổng PR (không nháp) — proxy “vượt ngân sách” khi chưa có cột budget/actual
    const totalPRsNonDraft = await prisma.purchaseRequest.count({
      where: {
        deletedAt: null,
        status: { not: 'DRAFT' },
      },
    });

    const overBudgetPRs = await prisma.purchaseRequest.count({
      where: {
        deletedAt: null,
        status: 'BUDGET_EXCEPTION',
      },
    });

    const overBudgetRate =
      totalPRsNonDraft > 0
        ? Math.round((overBudgetPRs / totalPRsNonDraft) * 100 * 10) / 10
        : 0;

    const riskHeatLevel: 'low' | 'medium' | 'high' =
      overBudgetRate >= 10 || overBudgetPRs >= 5
        ? 'high'
        : overBudgetRate >= 3 || overBudgetPRs >= 1
          ? 'medium'
          : 'low';

    const totalPRsInProgress = prsInProgress.length;

    // PO “rủi ro”: đã quá ngày giao dự kiến nhưng chưa nhận đủ / đóng
    /** PO đã quá `deliveryDate` nhưng chưa nhận đủ / đóng (không tính nháp). */
    const riskyPOCount = await prisma.purchaseOrder.count({
      where: {
        deletedAt: null,
        deliveryDate: { lt: now },
        status: {
          in: [
            'SUBMITTED',
            'APPROVED',
            'ISSUED',
            'CREATED',
            'SENT',
            'CONFIRMED',
            'PARTIAL_RECEIVED',
          ],
        },
      },
    });

    // Completion rate: PR đã có PO (không nháp) / PR đã tiếp nhận (không nháp, không hủy)
    const prsReceived = await prisma.purchaseRequest.count({
      where: {
        deletedAt: null,
        status: { notIn: ['DRAFT', 'CANCELLED'] },
      },
    });

    const prsWithActivePo = await prisma.purchaseRequest.count({
      where: {
        deletedAt: null,
        status: { notIn: ['DRAFT', 'CANCELLED'] },
        purchaseOrders: {
          some: {
            deletedAt: null,
            status: { notIn: ['DRAFT', 'REJECTED'] },
          },
        },
      },
    });

    const completionRate =
      prsReceived > 0 ? Math.round((prsWithActivePo / prsReceived) * 1000) / 10 : 0;

    // NCC có PO đã nhận đủ / đóng (proxy “chiến lược” ổn định)
    const strategicSupplierGroups = await prisma.purchaseOrder.groupBy({
      by: ['supplierId'],
      where: {
        deletedAt: null,
        status: { in: ['FULLY_RECEIVED', 'CLOSED'] },
      },
    });
    const strategicSupplierCount = strategicSupplierGroups.length;

    // NCC từng có PO bị từ chối
    const problematicSupplierGroups = await prisma.purchaseOrder.groupBy({
      by: ['supplierId'],
      where: {
        deletedAt: null,
        status: 'REJECTED',
      },
    });
    const problematicSupplierCount = problematicSupplierGroups.length;

    // Buyer Performance - Query through PRAssignment
    const buyers = await prisma.user.findMany({
      where: {
        role: {
          in: ['BUYER', 'BUYER_LEADER'],
        },
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        role: true,
        prAssignmentsBuyer: {
          where: {
            deletedAt: null,
          },
          include: {
            purchaseRequest: {
              select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                status: true,
              },
            },
          },
        },
      },
      take: 200,
    });

    const buyerPerformance = buyers.map((buyer) => {
      const activeAssignments = buyer.prAssignmentsBuyer.filter((assignment) => {
        const pr = assignment.purchaseRequest;
        return (
          pr &&
          ['ASSIGNED_TO_BUYER', 'RFQ_IN_PROGRESS', 'QUOTATION_RECEIVED', 'SUPPLIER_SELECTED'].includes(
            pr.status
          )
        );
      });

      const prsHandled = activeAssignments.length;
      const avgTime =
        prsHandled > 0
          ? Math.round(
              activeAssignments.reduce((sum, assignment) => {
                const pr = assignment.purchaseRequest;
                const days = Math.floor(
                  (pr.updatedAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60 * 24)
                );
                return sum + days;
              }, 0) / prsHandled
            )
          : 0;

      return {
        name: buyer.username,
        role: buyer.role,
        prsHandled,
        avgTime,
      };
    });

    const overloadedBuyerCount = buyerPerformance.filter(
      (b) => b.prsHandled > WORKLOAD_OVERLOAD_THRESHOLD
    ).length;
    const idleBuyerCount = buyerPerformance.filter((b) => b.prsHandled < WORKLOAD_IDLE_THRESHOLD).length;

    const priceTrends: { category: string; period: string; change: number }[] = [];

    const efficiencyScores = buyerPerformance.map((b) =>
      Math.min(100, Math.max(0, 100 - (b.avgTime > 30 ? 30 : b.avgTime)))
    );
    const buyerEfficiency =
      efficiencyScores.length > 0
        ? Math.round(efficiencyScores.reduce((a, b) => a + b, 0) / efficiencyScores.length)
        : 0;

    reply.send({
      metrics: {
        totalPRValue,
        totalPRsInProgress,
        avgLeadTime,
        overBudgetRate,
        avgPriceTrend: 0,
        buyerEfficiency,
        riskyPOCount,
        completionRate,
        prsReceived,
        prsWithActivePo,
        strategicSupplierCount,
        problematicSupplierCount,
        overloadedBuyerCount,
        idleBuyerCount,
        workloadOverloadThreshold: WORKLOAD_OVERLOAD_THRESHOLD,
        workloadIdleThreshold: WORKLOAD_IDLE_THRESHOLD,
        prValueBranchApproved,
        prValueBuyerProcessing,
        monthlySpendPct,
        leadTimeFunnel,
        riskHeatLevel,
        overBudgetPRCount: overBudgetPRs,
      },
      buyerPerformance,
      priceTrends,
    });
  } catch (error: any) {
    console.error('Error fetching buyer manager dashboard:', error);
    reply.status(500).send({ 
      error: 'Failed to fetch dashboard data',
      message: error.message 
    });
  }
};

// GET /api/buyer-manager/team-management
export const getTeamManagement = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const buyers = await prisma.user.findMany({
      where: {
        role: {
          in: ['BUYER', 'BUYER_LEADER'],
        },
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        prAssignmentsBuyer: {
          where: {
            deletedAt: null,
          },
          include: {
            purchaseRequest: {
              select: {
                id: true,
                createdAt: true,
                updatedAt: true,
                status: true,
              },
            },
          },
        },
      },
    });

    const members = buyers.map((buyer) => {
      const activeAssignments = buyer.prAssignmentsBuyer.filter(
        (assignment) => {
          const pr = assignment.purchaseRequest;
          return pr && TEAM_MANAGEMENT_ACTIVE_PR_STATUSES.has(pr.status);
        }
      );

      const activePRs = activeAssignments.length;
      const avgProcessingTime =
        activePRs > 0
          ? Math.round(
              activeAssignments.reduce((sum, assignment) => {
                const pr = assignment.purchaseRequest;
                const days = Math.floor(
                  (new Date().getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60 * 24)
                );
                return sum + days;
              }, 0) / activePRs
            )
          : 0;

      const efficiency = Math.max(50, Math.min(100, 100 - avgProcessingTime * 2));

      const workloadPercent = Math.min(
        100,
        Math.round((activePRs / BUYER_WORKLOAD_CAPACITY) * 1000) / 10
      );

      let workloadBand: 'overload' | 'normal' | 'idle';
      if (workloadPercent > 90) workloadBand = 'overload';
      else if (workloadPercent < 40) workloadBand = 'idle';
      else workloadBand = 'normal';

      const highThreshold = Math.ceil(BUYER_WORKLOAD_CAPACITY * 0.7);
      let workload: 'OVERLOADED' | 'HIGH' | 'NORMAL' | 'LOW';
      if (workloadBand === 'overload') workload = 'OVERLOADED';
      else if (workloadBand === 'idle') workload = 'LOW';
      else if (activePRs >= highThreshold) workload = 'HIGH';
      else workload = 'NORMAL';

      const displayName =
        buyer.fullName && String(buyer.fullName).trim().length > 0
          ? String(buyer.fullName).trim()
          : buyer.username;

      return {
        id: buyer.id,
        username: buyer.username,
        name: displayName,
        email: buyer.email,
        role: buyer.role,
        /** Schema chưa có loại mua theo user — mặc định để UI không lọc “ảo”. */
        purchaseTypes: ['DOMESTIC'] as const,
        activePRs,
        /** Số ngày TB từ lúc tạo PR đến nay (PR đang xử lý) — proxy lead time đang chạy. */
        avgProcessingTime,
        avgLeadTimeDays: avgProcessingTime,
        efficiency,
        workload,
        workloadPercent,
        workloadBand,
      };
    });

    const buyerLeaders = members.filter((m) => m.role === 'BUYER_LEADER').length;
    const buyersCount = members.filter((m) => m.role === 'BUYER').length;
    const avgEfficiency =
      members.length > 0
        ? Math.round(members.reduce((sum, m) => sum + m.efficiency, 0) / members.length)
        : 0;
    const totalWorkload = members.reduce((sum, m) => sum + m.activePRs, 0);

    reply.send({
      totalMembers: members.length,
      buyerLeaders,
      buyers: buyersCount,
      avgEfficiency,
      totalWorkload,
      workloadCapacityPerBuyer: BUYER_WORKLOAD_CAPACITY,
      members,
    });
  } catch (error: any) {
    console.error('Error fetching team management:', error);
    reply.status(500).send({ 
      error: 'Failed to fetch team data',
      message: error.message 
    });
  }
};

// GET /api/buyer-manager/cost-analysis
export const getCostAnalysis = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    reply.send({
      avgSaving: 0,
      avgLeadTime: 0,
      riskySuppliers: 0,
      priceTrendData: [] as { month: string; marketPrice: number; actualPrice: number }[],
      leadTimeByCategory: [] as { category: string; avgLeadTime: number; targetLeadTime: number }[],
      riskySuppliersList: [] as { name: string; reason: string; riskScore: number }[],
    });
  } catch (error) {
    console.error('Error fetching cost analysis:', error);
    reply.status(500).send({ error: 'Failed to fetch cost analysis' });
  }
};

// GET /api/buyer-manager/supplier-performance
export const getSupplierPerformance = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const totalSuppliers = await prisma.supplier.count({ where: { deletedAt: null } });

    reply.send({
      totalSuppliers,
      onTimeDeliveryRate: 0,
      priceStability: 0,
      avgLeadTime: 0,
      suppliers: [] as {
        name: string;
        category: string;
        priceStability: number;
        onTimeDelivery: number;
        avgLeadTime: number;
        qualityRating: number;
        totalPRs: number;
        ranking: string;
      }[],
      topPerformers: [] as { name: string; category: string; score: number }[],
      bottomPerformers: [] as { name: string; issue: string; score: number }[],
    });
  } catch (error) {
    console.error('Error fetching supplier performance:', error);
    reply.status(500).send({ error: 'Failed to fetch supplier performance' });
  }
};

// GET /api/buyer-manager/strategic-reports
export const getStrategicReports = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    reply.send({
      totalSaving: 0,
      savingAmount: 0,
      supplyChainRisks: 0,
      procurementEfficiency: 0,
      costSavingDetails: [] as {
        category: string;
        description: string;
        savedAmount: number;
        percentage: number;
      }[],
      supplyChainRiskDetails: [] as { title: string; description: string; severity: string }[],
      strategicRecommendations: [] as {
        title: string;
        description: string;
        impact: string;
        priority: string;
      }[],
    });
  } catch (error) {
    console.error('Error fetching strategic reports:', error);
    reply.status(500).send({ error: 'Failed to fetch strategic reports' });
  }
};

// GET /api/buyer-manager/policy-guidelines
export const getPolicyGuidelines = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    reply.send({
      supplierSelectionRules: [] as { title: string; description: string }[],
      priceThresholds: [] as { category: string; maxPrice: number; warningPrice: number }[],
      leadTimeThresholds: [] as { category: string; targetDays: number; maxDays: number }[],
      priorityCategories: [] as {
        name: string;
        priority: string;
        description: string;
        sla: number;
      }[],
      approvalWorkflow: [] as { role: string; action: string; condition: string }[],
    });
  } catch (error) {
    console.error('Error fetching policy guidelines:', error);
    reply.status(500).send({ error: 'Failed to fetch policy guidelines' });
  }
};

// GET /api/buyer-manager/alerts-risks
export const getAlertsRisks = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    reply.send({
      criticalAlerts: [] as {
        title: string;
        description: string;
        category: string;
        detectedAt: string;
        affectedItems: number;
      }[],
      highAlerts: [] as {
        title: string;
        description: string;
        category: string;
        detectedAt: string;
        affectedItems: number;
      }[],
      mediumAlerts: [] as {
        title: string;
        description: string;
        category: string;
        detectedAt: string;
        affectedItems: number;
      }[],
      resolvedAlerts: 0,
      riskTrends: [] as {
        category: string;
        trend: string;
        change: number;
        description: string;
      }[],
    });
  } catch (error) {
    console.error('Error fetching alerts and risks:', error);
    reply.status(500).send({ error: 'Failed to fetch alerts and risks' });
  }
};


