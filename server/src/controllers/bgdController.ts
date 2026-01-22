import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/bgd/dashboard
export const getExecutiveDashboard = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    // Total Sales PO Budget
    const salesPOs = await prisma.salesPO.findMany({
      where: { deletedAt: null },
      select: { salesPONumber: true, projectName: true, amount: true },
    });
    const totalSalesPOBudget = salesPOs.reduce((sum, po) => sum + Number(po.amount), 0);

    // Total Approved PR Value (approx = total Payment DONE for approved+)
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

    // Projects at Risk (usage > 90%): usage = Payment DONE / SalesPO budget
    const salesPOWithPayments = await prisma.salesPO.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        salesPONumber: true,
        projectName: true,
        amount: true,
        purchaseRequests: {
          where: { deletedAt: null },
          select: {
            payments: { where: { status: 'DONE', deletedAt: null }, select: { amount: true } },
          },
        },
      },
    });

    const projectsAtRiskList = salesPOWithPayments
      .map((po) => {
        const budget = Number(po.amount);
        const actualCost = po.purchaseRequests.reduce((sum, pr) => {
          return sum + pr.payments.reduce((s2, p) => s2 + Number(p.amount), 0);
        }, 0);
        const usagePercent = budget > 0 ? (actualCost / budget) * 100 : 0;
        return {
          name: po.projectName || '',
          salesPOCode: po.salesPONumber,
          budget,
          actualCost,
          remaining: budget - actualCost,
          usagePercent: Math.round(usagePercent * 10) / 10,
        };
      })
      .filter((p) => p.usagePercent >= 90)
      .sort((a, b) => b.usagePercent - a.usagePercent);

    // Critical PRs Pending: PRs waiting exception decision (basic heuristic)
    const criticalPRs = await prisma.purchaseRequest.findMany({
      where: {
        deletedAt: null,
        status: { in: ['SUBMITTED'] },
      },
      include: {
        salesPO: { select: { projectName: true } },
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
        projectName: pr.salesPO?.projectName || 'N/A',
        value: qtySum,
        reason: 'Chờ quyết định quan trọng',
      };
    });

    reply.send({
      metrics: {
        totalSalesPOBudget,
        totalApprovedPRValue,
        projectsAtRisk: projectsAtRiskList.length,
        criticalPRsPending: criticalPRsList.length,
      },
      projectsAtRiskList,
      criticalPRsList,
      budgetUsage: {
        total: totalSalesPOBudget,
        used: totalApprovedPRValue,
        usedPercent: totalSalesPOBudget > 0
          ? Math.round((totalApprovedPRValue / totalSalesPOBudget) * 100 * 10) / 10
          : 0,
      },
      costTrends: [
        { period: 'Tháng này', change: -2.5, description: 'Giảm so với tháng trước' },
        { period: 'Quý này', change: 5.2, description: 'Tăng so với quý trước' },
      ],
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
    const salesPOs = await prisma.salesPO.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        salesPONumber: true,
        projectName: true,
        amount: true,
        purchaseRequests: {
          where: { deletedAt: null },
          select: {
            payments: { where: { status: 'DONE', deletedAt: null }, select: { amount: true } },
          },
        },
      },
    });

    const totalCost = salesPOs.reduce((sum, po) => {
      const actual = po.purchaseRequests.reduce((prSum, pr) => {
        return prSum + pr.payments.reduce((pSum, p) => pSum + Number(p.amount), 0);
      }, 0);
      return sum + actual;
    }, 0);

    const costDistribution = salesPOs
      .map((po) => {
        const amount = po.purchaseRequests.reduce((prSum, pr) => {
          return prSum + pr.payments.reduce((pSum, p) => pSum + Number(p.amount), 0);
        }, 0);
        return {
          projectName: po.projectName || '',
          salesPOCode: po.salesPONumber,
          amount,
        };
      })
      .filter((it) => it.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
      .map((it) => ({ ...it, percentage: totalCost > 0 ? Math.round((it.amount / totalCost) * 100) : 0 }));

    const allPRs = await prisma.purchaseRequest.findMany({
      where: { deletedAt: null },
      select: { createdAt: true, status: true },
    });

    const completedPRs = allPRs.filter((pr) => pr.status === 'SUPPLIER_SELECTED').length;
    const prToPurchaseRatio =
      allPRs.length > 0 ? Math.round((completedPRs / allPRs.length) * 100) : 0;

    reply.send({
      totalCost,
      activeProjects: salesPOs.length,
      prToPurchaseRatio,
      costDistribution,
      demandTrends: [
        { period: 'T1', prCount: 45, totalValue: 1200000000 },
        { period: 'T2', prCount: 52, totalValue: 1350000000 },
        { period: 'T3', prCount: 48, totalValue: 1280000000 },
        { period: 'T4', prCount: 55, totalValue: 1420000000 },
      ],
      maxPRCount: 60,
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
    // Mock data for exception approvals
    // In production, this would query a separate ExceptionApproval table
    reply.send({
      pending: [
        {
          id: '1',
          code: 'EX-001',
          type: 'Giá trị vượt ngưỡng',
          title: 'Mua thiết bị PCCC giá trị 500M',
          description: 'Yêu cầu mua thiết bị PCCC với giá trị 500M VNĐ, vượt ngưỡng cho phép 300M',
          value: 500000000,
          projectName: 'Dự án A',
          createdAt: '2024-01-15',
        },
        {
          id: '2',
          code: 'EX-002',
          type: 'NCC chiến lược mới',
          title: 'Hợp tác với NCC quốc tế',
          description: 'Đề xuất hợp tác với NCC quốc tế cho vật tư đặc biệt',
          value: 200000000,
          projectName: 'Dự án B',
          createdAt: '2024-01-16',
        },
      ],
      approved: [
        {
          id: '3',
          title: 'Mua vật tư đặc biệt',
          description: 'Đã được duyệt',
          approvedBy: 'BGD',
          approvedAt: '2024-01-10',
        },
      ],
      rejected: [
        {
          id: '4',
          title: 'Mua thiết bị không cần thiết',
          description: 'Không phù hợp với nhu cầu',
          rejectionReason: 'Không đáp ứng yêu cầu dự án',
          rejectedBy: 'BGD',
          rejectedAt: '2024-01-08',
        },
      ],
    });
  } catch (error) {
    console.error('Error fetching exception approvals:', error);
    reply.status(500).send({ error: 'Failed to fetch exception approvals' });
  }
};

// POST /api/bgd/exception-approval/:id/approve
export const approveException = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  try {
    // TODO: Implement approval logic
    reply.send({ success: true, message: 'Exception approved' });
  } catch (error) {
    console.error('Error approving exception:', error);
    reply.status(500).send({ error: 'Failed to approve exception' });
  }
};

// POST /api/bgd/exception-approval/:id/reject
export const rejectException = async (
  request: FastifyRequest<{ Params: { id: string }; Body: { reason: string } }>,
  reply: FastifyReply
) => {
  try {
    // TODO: Implement rejection logic
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
    // Mock data for strategic supplier view
    reply.send({
      keySuppliersCount: 8,
      dependencyLevel: 45,
      supplyChainRisks: 3,
      totalPurchaseValue: 2500000000,
      keySuppliers: [
        {
          name: 'Công ty TNHH Vật tư A',
          category: 'Vật tư xây dựng',
          purchaseValue: 800000000,
          dependencyPercent: 55,
          totalPRs: 45,
        },
        {
          name: 'Công ty CP Thiết bị B',
          category: 'Thiết bị điện',
          purchaseValue: 600000000,
          dependencyPercent: 40,
          totalPRs: 32,
        },
      ],
      dependencyAnalysis: [
        { category: 'Vật tư xây dựng', dependencyPercent: 55, supplierCount: 3 },
        { category: 'Thiết bị điện', dependencyPercent: 40, supplierCount: 5 },
        { category: 'Vật liệu hoàn thiện', dependencyPercent: 25, supplierCount: 8 },
      ],
      supplyChainRiskList: [
        {
          title: 'Phụ thuộc cao vào 1 NCC vật tư xây dựng',
          description: '55% giá trị mua từ 1 NCC duy nhất',
          impact: 'Rủi ro gián đoạn cao',
          severity: 'High',
        },
        {
          title: 'Thiếu NCC dự phòng cho thiết bị PCCC',
          description: 'Chỉ có 1 NCC cung cấp thiết bị PCCC',
          impact: 'Rủi ro an toàn',
          severity: 'Critical',
        },
      ],
      recommendations: [
        {
          title: 'Đa dạng hóa NCC vật tư xây dựng',
          description: 'Tìm thêm 2-3 NCC để giảm phụ thuộc',
        },
        {
          title: 'Tìm NCC dự phòng cho thiết bị PCCC',
          description: 'Ưu tiên cao để đảm bảo an toàn',
        },
      ],
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
      totalSaving: 15.2,
      savingAmount: 125000000,
      procurementEfficiency: 87,
      completionRate: 78,
      savingDetails: [
        {
          category: 'Vật tư xây dựng',
          description: 'Đàm phán giá tốt',
          savedAmount: 45000000,
          percentage: 12,
        },
        {
          category: 'Thiết bị điện',
          description: 'Mua số lượng lớn',
          savedAmount: 38000000,
          percentage: 18,
        },
      ],
      procurementPerformance: [
        { name: 'Tỷ lệ hoàn thành PR', value: '78%', percentage: 78 },
        { name: 'Thời gian xử lý TB', value: '14 ngày', percentage: 70 },
        { name: 'Satisfaction rate', value: '92%', percentage: 92 },
      ],
      planVsActual: [
        { period: 'T1', planned: 100, actual: 95 },
        { period: 'T2', planned: 110, actual: 108 },
        { period: 'T3', planned: 120, actual: 115 },
        { period: 'T4', planned: 130, actual: 125 },
      ],
      summary: [
        {
          title: 'Tổng quan',
          content: 'Hoạt động mua hàng đạt hiệu quả tốt, tiết kiệm 15.2% so với kế hoạch',
        },
        {
          title: 'Đề xuất',
          content: 'Tiếp tục đa dạng hóa NCC và tối ưu quy trình mua hàng',
        },
      ],
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
    reply.send({
      critical: [
        {
          title: 'Dự án A vượt ngân sách 15%',
          description: 'Dự án A đã sử dụng 115% ngân sách, cần xem xét ngay',
          category: 'budget',
          detectedAt: '2 giờ trước',
          affectedProject: 'Dự án A',
          impact: 'Rủi ro tài chính cao',
        },
        {
          title: 'NCC chính thiết bị PCCC ngừng cung ứng',
          description: 'NCC duy nhất cung cấp thiết bị PCCC thông báo ngừng cung ứng',
          category: 'supplier',
          detectedAt: '1 ngày trước',
          impact: 'Rủi ro an toàn nghiêm trọng',
        },
      ],
      high: [
        {
          title: 'Giá thép tăng 15%',
          description: 'Xu hướng tăng giá tiếp tục',
          category: 'budget',
          detectedAt: '3 ngày trước',
          affectedProject: 'Nhiều dự án',
        },
      ],
      medium: [
        {
          title: 'Lead time kéo dài',
          description: 'Thiết bị điện nhập khẩu bị chậm',
          category: 'schedule',
          detectedAt: '5 ngày trước',
        },
      ],
      resolved: 12,
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
      approvalThresholds: [
        {
          category: 'Vật tư thông thường',
          description: 'Giá trị mua vượt 200M cần BGĐ duyệt',
          threshold: 200000000,
        },
        {
          category: 'Thiết bị đặc biệt',
          description: 'Giá trị mua vượt 100M cần BGĐ duyệt',
          threshold: 100000000,
        },
        {
          category: 'Dịch vụ',
          description: 'Giá trị mua vượt 150M cần BGĐ duyệt',
          threshold: 150000000,
        },
      ],
      strategicPolicies: [
        {
          title: 'Ưu tiên NCC trong nước',
          description: 'Ưu tiên lựa chọn NCC trong nước khi giá chênh lệch < 10%',
          effectiveDate: '2024-01-01',
          updatedAt: '2024-01-01',
        },
        {
          title: 'Đa dạng hóa nguồn cung',
          description: 'Không phụ thuộc quá 50% vào 1 NCC cho 1 danh mục',
          effectiveDate: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
      priorityGuidelines: [
        {
          category: 'Thiết bị PCCC',
          priority: 'Critical',
          description: 'Liên quan đến an toàn, ưu tiên cao nhất',
          sla: 7,
        },
        {
          category: 'Vật tư trên đường găng',
          priority: 'High',
          description: 'Ảnh hưởng trực tiếp đến tiến độ',
          sla: 10,
        },
        {
          category: 'Vật tư thông thường',
          priority: 'Normal',
          description: 'Vật tư không ảnh hưởng đến tiến độ',
          sla: 14,
        },
      ],
      riskPolicies: [
        {
          title: 'Quản lý rủi ro NCC',
          description: 'Đánh giá rủi ro NCC định kỳ và có kế hoạch dự phòng',
        },
        {
          title: 'Giám sát ngân sách',
          description: 'Cảnh báo khi dự án sử dụng > 90% ngân sách',
        },
      ],
    });
  } catch (error) {
    console.error('Error fetching governance policy:', error);
    reply.status(500).send({ error: 'Failed to fetch governance policy' });
  }
};

