import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

// GET /api/buyer-manager/dashboard
export const getBuyerManagerDashboard = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    // Total PR Value - Sum of all PRs in progress
    const prsInProgress = await prisma.purchaseRequest.findMany({
      where: {
        deletedAt: null,
        status: {
          in: ['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED', 'ASSIGNED_TO_BUYER', 'RFQ_IN_PROGRESS', 'QUOTATION_RECEIVED', 'SUPPLIER_SELECTED'],
        },
      },
      select: {
        totalAmount: true,
      },
      take: 1000,
    });

    const totalPRValue = prsInProgress.reduce((sum, pr) => {
      return sum + (pr.totalAmount ? Number(pr.totalAmount) : 0);
    }, 0);

    // Average Lead Time (from PR creation to supplier selection)
    const completedPRs = await prisma.purchaseRequest.findMany({
      where: {
        deletedAt: null,
        status: 'SUPPLIER_SELECTED',
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
      take: 100,
    });

    const avgLeadTime = completedPRs.length > 0
      ? Math.round(
          completedPRs.reduce((sum, pr) => {
            const days = Math.floor(
              (pr.updatedAt.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            return sum + days;
          }, 0) / completedPRs.length
        )
      : 0;

    // Over-Budget Rate - PRs with BUDGET_EXCEPTION status
    const totalPRs = await prisma.purchaseRequest.count({
      where: {
        deletedAt: null,
        status: {
          not: 'DRAFT',
        },
      },
    });

    const overBudgetPRs = await prisma.purchaseRequest.count({
      where: {
        deletedAt: null,
        status: 'BUDGET_EXCEPTION',
      },
    });

    const overBudgetRate = totalPRs > 0 
      ? Math.round((overBudgetPRs / totalPRs) * 100 * 10) / 10
      : 0;

    // PRs in progress count
    const totalPRsInProgress = prsInProgress.length;

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
      take: 10,
    });

    const buyerPerformance = buyers.map((buyer) => {
      const activeAssignments = buyer.prAssignmentsBuyer.filter(
        (assignment) => {
          const pr = assignment.purchaseRequest;
          return pr && ['ASSIGNED_TO_BUYER', 'RFQ_IN_PROGRESS', 'QUOTATION_RECEIVED', 'SUPPLIER_SELECTED'].includes(pr.status);
        }
      );
      
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

    // Price Trends (mock data - would need historical price data)
    const priceTrends = [
      { category: 'Vật tư xây dựng', period: 'Tháng này', change: -3.5 },
      { category: 'Thiết bị điện', period: 'Tháng này', change: 2.1 },
      { category: 'Vật liệu hoàn thiện', period: 'Tháng này', change: -1.2 },
    ];

    reply.send({
      metrics: {
        totalPRValue,
        totalPRsInProgress,
        avgLeadTime,
        overBudgetRate,
        avgPriceTrend: -0.9, // Mock
        buyerEfficiency: 85, // Mock
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
          return pr && ['ASSIGNED_TO_BUYER', 'RFQ_IN_PROGRESS', 'QUOTATION_RECEIVED'].includes(pr.status);
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
      const workload =
        activePRs > 15 ? 'Overload' : activePRs > 10 ? 'High' : 'Normal';

      return {
        name: buyer.username,
        email: buyer.email,
        role: buyer.role,
        activePRs,
        avgProcessingTime,
        efficiency,
        workload,
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
    // Mock data for cost analysis
    // In production, this would analyze actual quotation data
    reply.send({
      avgSaving: 12.5,
      avgLeadTime: 14,
      riskySuppliers: 3,
      priceTrendData: [
        { month: 'T1', marketPrice: 100, actualPrice: 92 },
        { month: 'T2', marketPrice: 102, actualPrice: 90 },
        { month: 'T3', marketPrice: 105, actualPrice: 93 },
        { month: 'T4', marketPrice: 103, actualPrice: 91 },
        { month: 'T5', marketPrice: 108, actualPrice: 95 },
        { month: 'T6', marketPrice: 110, actualPrice: 96 },
      ],
      leadTimeByCategory: [
        { category: 'Vật tư xây dựng', avgLeadTime: 12, targetLeadTime: 14 },
        { category: 'Thiết bị điện', avgLeadTime: 18, targetLeadTime: 15 },
        { category: 'Vật liệu hoàn thiện', avgLeadTime: 10, targetLeadTime: 12 },
        { category: 'Thiết bị PCCC', avgLeadTime: 25, targetLeadTime: 20 },
      ],
      riskySuppliersList: [
        {
          name: 'NCC A',
          reason: 'Giao hàng trễ 3 lần liên tiếp',
          riskScore: 75,
        },
        {
          name: 'NCC B',
          reason: 'Tăng giá đột ngột 15%',
          riskScore: 68,
        },
        {
          name: 'NCC C',
          reason: 'Chất lượng không ổn định',
          riskScore: 62,
        },
      ],
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
    // Mock data for supplier performance
    // In production, this would analyze actual supplier data
    reply.send({
      totalSuppliers: 45,
      onTimeDeliveryRate: 87,
      priceStability: 92,
      avgLeadTime: 14,
      suppliers: [
        {
          name: 'Công ty TNHH Vật tư A',
          category: 'Vật tư xây dựng',
          priceStability: 95,
          onTimeDelivery: 92,
          avgLeadTime: 12,
          qualityRating: 5,
          totalPRs: 45,
          ranking: 'A',
        },
        {
          name: 'Công ty CP Thiết bị B',
          category: 'Thiết bị điện',
          priceStability: 88,
          onTimeDelivery: 85,
          avgLeadTime: 15,
          qualityRating: 4,
          totalPRs: 32,
          ranking: 'B',
        },
        {
          name: 'NCC Vật liệu C',
          category: 'Vật liệu hoàn thiện',
          priceStability: 78,
          onTimeDelivery: 75,
          avgLeadTime: 18,
          qualityRating: 3,
          totalPRs: 28,
          ranking: 'C',
        },
      ],
      topPerformers: [
        { name: 'Công ty TNHH Vật tư A', category: 'Vật tư xây dựng', score: 95 },
        { name: 'Công ty CP Thiết bị D', category: 'Thiết bị điện', score: 92 },
        { name: 'NCC Vật liệu E', category: 'Vật liệu hoàn thiện', score: 90 },
      ],
      bottomPerformers: [
        { name: 'NCC F', issue: 'Giao hàng trễ thường xuyên', score: 45 },
        { name: 'NCC G', issue: 'Giá không ổn định', score: 52 },
      ],
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
      totalSaving: 15.2,
      savingAmount: 125000,
      supplyChainRisks: 5,
      procurementEfficiency: 87,
      costSavingDetails: [
        {
          category: 'Vật tư xây dựng',
          description: 'Đàm phán giá tốt với NCC mới',
          savedAmount: 45000,
          percentage: 12,
        },
        {
          category: 'Thiết bị điện',
          description: 'Mua số lượng lớn',
          savedAmount: 38000,
          percentage: 18,
        },
        {
          category: 'Vật liệu hoàn thiện',
          description: 'Chuyển đổi NCC',
          savedAmount: 42000,
          percentage: 15,
        },
      ],
      supplyChainRiskDetails: [
        {
          title: 'NCC độc quyền cho thiết bị PCCC',
          description: 'Chỉ có 1 NCC cung cấp, rủi ro cao nếu gián đoạn',
          severity: 'High',
        },
        {
          title: 'Tăng giá vật tư thép',
          description: 'Giá thép tăng 8% trong 2 tháng qua',
          severity: 'Medium',
        },
        {
          title: 'Lead time kéo dài',
          description: 'Thiết bị điện nhập khẩu bị chậm do logistics',
          severity: 'Medium',
        },
      ],
      strategicRecommendations: [
        {
          title: 'Đa dạng hóa NCC thiết bị PCCC',
          description:
            'Tìm thêm 2-3 NCC dự phòng để giảm rủi ro phụ thuộc vào 1 nguồn cung',
          impact: 'Giảm 60% rủi ro gián đoạn',
          priority: 'High',
        },
        {
          title: 'Ký hợp đồng dài hạn với NCC vật tư thép',
          description: 'Cố định giá trong 6-12 tháng để tránh biến động',
          impact: 'Tiết kiệm 5-8% chi phí',
          priority: 'High',
        },
        {
          title: 'Xây dựng kho dự trữ vật tư quan trọng',
          description: 'Dự trữ 2-3 tháng cho các vật tư có lead time dài',
          impact: 'Giảm 40% rủi ro chậm tiến độ',
          priority: 'Medium',
        },
      ],
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
      supplierSelectionRules: [
        {
          title: 'Tối thiểu 3 báo giá',
          description: 'Mỗi PR phải có ít nhất 3 báo giá từ các NCC khác nhau',
        },
        {
          title: 'Đánh giá NCC định kỳ',
          description: 'NCC được đánh giá mỗi quý dựa trên giá, chất lượng, giao hàng',
        },
        {
          title: 'Blacklist NCC vi phạm',
          description: 'NCC vi phạm hợp đồng 2 lần sẽ bị loại khỏi danh sách',
        },
      ],
      priceThresholds: [
        { category: 'Vật tư xây dựng', maxPrice: 50000, warningPrice: 45000 },
        { category: 'Thiết bị điện', maxPrice: 100000, warningPrice: 90000 },
        { category: 'Vật liệu hoàn thiện', maxPrice: 30000, warningPrice: 27000 },
      ],
      leadTimeThresholds: [
        { category: 'Vật tư xây dựng', targetDays: 14, maxDays: 21 },
        { category: 'Thiết bị điện', targetDays: 15, maxDays: 25 },
        { category: 'Vật liệu hoàn thiện', targetDays: 12, maxDays: 18 },
      ],
      priorityCategories: [
        {
          name: 'Thiết bị PCCC',
          priority: 'Critical',
          description: 'Liên quan đến an toàn, ưu tiên cao nhất',
          sla: 7,
        },
        {
          name: 'Vật tư trên đường găng',
          priority: 'High',
          description: 'Ảnh hưởng trực tiếp đến tiến độ dự án',
          sla: 10,
        },
        {
          name: 'Vật tư thông thường',
          priority: 'Normal',
          description: 'Vật tư không ảnh hưởng đến tiến độ',
          sla: 14,
        },
      ],
      approvalWorkflow: [
        {
          role: 'Requestor',
          action: 'Tạo PR',
          condition: 'Bắt buộc gắn Sales PO/Project',
        },
        {
          role: 'Branch Manager',
          action: 'Duyệt PR',
          condition: 'Kiểm tra tính hợp lý',
        },
        {
          role: 'Buyer',
          action: 'Xử lý RFQ',
          condition: 'Tối thiểu 3 báo giá',
        },
        {
          role: 'Buyer Leader',
          action: 'Chọn NCC',
          condition: 'So sánh và quyết định',
        },
      ],
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
      criticalAlerts: [
        {
          title: 'NCC chính thiết bị PCCC ngừng cung ứng',
          description: 'NCC A thông báo ngừng cung ứng từ tháng sau',
          category: 'supplier',
          detectedAt: '2 giờ trước',
          affectedItems: 12,
        },
      ],
      highAlerts: [
        {
          title: 'Giá thép tăng 15% trong 1 tháng',
          description: 'Xu hướng tăng giá tiếp tục, cần cố định giá sớm',
          category: 'price',
          detectedAt: '1 ngày trước',
          affectedItems: 25,
        },
        {
          title: 'Lead time thiết bị điện kéo dài',
          description: 'Trung bình tăng từ 15 lên 22 ngày',
          category: 'leadtime',
          detectedAt: '3 ngày trước',
          affectedItems: 18,
        },
      ],
      mediumAlerts: [
        {
          title: 'NCC B giao hàng trễ 2 lần liên tiếp',
          description: 'Cần đánh giá lại độ tin cậy của NCC này',
          category: 'supplier',
          detectedAt: '5 ngày trước',
          affectedItems: 8,
        },
      ],
      resolvedAlerts: 15,
      riskTrends: [
        { category: 'Giá cả', trend: 'increasing', change: 8, description: 'Xu hướng tăng' },
        { category: 'Lead time', trend: 'increasing', change: 12, description: 'Kéo dài hơn' },
        { category: 'Chất lượng NCC', trend: 'stable', change: 0, description: 'Ổn định' },
      ],
    });
  } catch (error) {
    console.error('Error fetching alerts and risks:', error);
    reply.status(500).send({ error: 'Failed to fetch alerts and risks' });
  }
};


