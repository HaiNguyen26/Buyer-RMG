import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

// Executive Dashboard - Tổng quan tổng thể
export const getExecutiveDashboard = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Get all active Sales POs
    const activeSalesPOs = await prisma.salesPO.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    // Get all payments with status DONE
    const donePayments = await prisma.payment.findMany({
      where: {
        status: 'DONE',
        deletedAt: null,
      },
      include: {
        purchaseRequest: true,
      },
    });

    // Calculate total actual cost (Payment DONE)
    let totalActualCost = 0;
    donePayments.forEach((payment) => {
      totalActualCost += Number(payment.amount);
    });

    // Find projects near/over budget (using 80% threshold)
    // Note: Since PRs are no longer directly linked to SalesPO in Phase 1,
    // we'll calculate based on SalesPO amount vs total payments
    const projectsNearBudget: any[] = [];
    const projectsOverBudget: any[] = [];

    activeSalesPOs.forEach((po) => {
      // For now, we'll use a simplified calculation
      // In a real system, you'd need to link PRs to SalesPOs somehow
      const usagePercent = 0; // Placeholder - needs proper implementation

      if (usagePercent >= 100) {
        projectsOverBudget.push({
          salesPONumber: po.salesPONumber,
          projectName: po.projectName,
          salesPOAmount: Number(po.amount),
          actualCost: 0,
          remainingBudget: Number(po.amount),
          progress: usagePercent,
        });
      } else if (usagePercent >= 80) {
        projectsNearBudget.push({
          salesPONumber: po.salesPONumber,
          projectName: po.projectName,
          salesPOAmount: Number(po.amount),
          actualCost: 0,
          remainingBudget: Number(po.amount),
          progress: usagePercent,
        });
      }
    });

    // Get PR by status - Count all PRs (all statuses count as submitted for now)
    const allPRs = await prisma.purchaseRequest.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        status: true,
      },
    });

    const prByStatus = {
      submitted: allPRs.filter((pr) => pr.status === 'SUBMITTED').length,
      readyForRFQ: allPRs.filter((pr) => pr.status === 'ASSIGNED_TO_BUYER').length,
      collectingQuotation: allPRs.filter((pr) => pr.status === 'RFQ_IN_PROGRESS').length,
      supplierSelected: allPRs.filter((pr) => pr.status === 'SUPPLIER_SELECTED').length,
    };

    reply.send({
      activeSalesPOs: activeSalesPOs.length,
      totalActualCost,
      projectsNearBudget,
      projectsOverBudget,
      prByStatus,
    });
  } catch (error: any) {
    console.error('Get executive dashboard error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// PR Overview - Giám sát toàn bộ PR
export const getPROverview = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { branch, department, salesPO, buyer, status } = request.query as any;

    const where: any = {
      deletedAt: null,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    if (salesPO && salesPO !== 'all') {
      where.salesPOId = salesPO;
    }

    const prs = await prisma.purchaseRequest.findMany({
      where,
      include: {
        requestor: {
          select: {
            id: true,
            username: true,
            email: true,
            location: true,
          },
        },
        supplier: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit results
    });

    // Map PR data
    const mappedPRs = prs.map((pr) => ({
      id: pr.id,
      prNumber: pr.prNumber,
      itemName: pr.itemName,
      salesPO: null, // SalesPO relation removed in Phase 1
      branch: pr.requestor.location || 'N/A',
      department: pr.department || 'N/A',
      buyer: null, // TODO: Add buyer assignment to PR
      status: pr.status,
      createdAt: pr.createdAt,
    }));

    reply.send({ prs: mappedPRs });
  } catch (error: any) {
    console.error('Get PR overview error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Supplier Overview - Theo dõi tình hình NCC
export const getSupplierOverview = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const suppliers = await prisma.supplier.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        purchaseRequests: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
            prNumber: true,
            status: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 5, // Recent PRs
        },
      },
    });

    // Calculate statistics for each supplier
    const suppliersWithStats = suppliers.map((supplier) => {
      const totalParticipations = supplier.purchaseRequests.length;
      const totalWins = supplier.purchaseRequests.filter(
        (pr) => pr.status === 'SUPPLIER_SELECTED'
      ).length;
      const totalLosses = totalParticipations - totalWins;
      const winRate = totalParticipations > 0 ? (totalWins / totalParticipations) * 100 : 0;

      return {
        id: supplier.id,
        name: supplier.name,
        email: supplier.email,
        totalParticipations,
        totalWins,
        totalLosses,
        winRate: Number(winRate.toFixed(1)),
        recentPRs: supplier.purchaseRequests.map((pr) => ({
          prNumber: pr.prNumber,
          status: pr.status,
          createdAt: pr.createdAt,
        })),
      };
    });

    reply.send({ suppliers: suppliersWithStats });
  } catch (error: any) {
    console.error('Get supplier overview error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Buyer Performance - Đánh giá hiệu quả Buyer
export const getBuyerPerformance = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Get all buyers
    const buyers = await prisma.user.findMany({
      where: {
        role: 'BUYER',
        deletedAt: null,
      },
      include: {
        purchaseRequests: {
          where: {
            deletedAt: null,
          },
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

    // Calculate performance metrics
    const buyerPerformance = buyers.map((buyer) => {
      const prs = buyer.purchaseRequests || [];
      const totalPRs = prs.length;

      // Calculate average processing time (from PR creation to supplier selection)
      let totalProcessingTime = 0;
      let completedCount = 0;

      prs.forEach((pr) => {
        if (pr.status === 'SUPPLIER_SELECTED' && pr.updatedAt) {
          const processingTime = pr.updatedAt.getTime() - pr.createdAt.getTime();
          totalProcessingTime += processingTime;
          completedCount++;
        }
      });

      const avgProcessingTimeMinutes =
        completedCount > 0 ? totalProcessingTime / completedCount / (1000 * 60) : 0;

      // Count returned/delayed PRs (simplified - using status)
      const returnedPRs = prs.filter((pr) => pr.status === 'CANCELLED').length;
      const delayedPRs = prs.filter((pr) => {
        const daysDiff = (Date.now() - pr.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff > 30 && pr.status !== 'SUPPLIER_SELECTED';
      }).length;

      return {
        id: buyer.id,
        name: buyer.username,
        email: buyer.email,
        totalPRs,
        avgProcessingTimeMinutes: Number(avgProcessingTimeMinutes.toFixed(0)),
        returnedPRs,
        delayedPRs,
      };
    });

    reply.send({ buyers: buyerPerformance });
  } catch (error: any) {
    console.error('Get buyer performance error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Notifications - Cảnh báo quan trọng
export const getNotifications = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const notifications: any[] = [];

    // Check for projects over budget
    const activeSalesPOs = await prisma.salesPO.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    // Get all done payments
    const donePayments = await prisma.payment.findMany({
      where: {
        status: 'DONE',
        deletedAt: null,
      },
    });

    activeSalesPOs.forEach((po) => {
      // Simplified calculation - in Phase 1, PRs are not linked to SalesPO
      // This would need proper implementation based on business logic
      let poActualCost = 0;
      const usagePercent = poActualCost > 0 ? (poActualCost / Number(po.amount)) * 100 : 0;

      if (usagePercent >= 100) {
        notifications.push({
          id: `budget-exceeded-${po.id}`,
          type: 'BUDGET_EXCEEDED',
          message: `Dự án ${po.salesPONumber} - ${po.projectName} đã vượt ngân sách`,
          details: {
            project: {
              salesPONumber: po.salesPONumber,
              projectName: po.projectName,
            },
          },
          createdAt: new Date().toISOString(),
          read: false,
        });
      } else if (usagePercent >= 80) {
        notifications.push({
          id: `budget-near-${po.id}`,
          type: 'PROJECT_NEAR_BUDGET',
          message: `Dự án ${po.salesPONumber} - ${po.projectName} đã sử dụng ${usagePercent.toFixed(1)}% ngân sách`,
          details: {
            project: {
              salesPONumber: po.salesPONumber,
              projectName: po.projectName,
            },
          },
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    });

    // Check for stuck PRs (pending > 30 days)
    const stuckPRs = await prisma.purchaseRequest.findMany({
      where: {
        status: 'SUBMITTED',
        deletedAt: null,
        createdAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        },
      },
      take: 10,
    });

    stuckPRs.forEach((pr) => {
      notifications.push({
        id: `pr-stuck-${pr.id}`,
        type: 'PR_STUCK',
        message: `PR ${pr.prNumber} đã bị tắc nghẽn hơn 30 ngày`,
        details: {
          pr: {
            prNumber: pr.prNumber,
            itemName: pr.itemName,
          },
        },
        createdAt: pr.createdAt.toISOString(),
        read: false,
      });
    });

    // Check for overloaded buyers (simplified - count PRs per buyer)
    const buyers = await prisma.user.findMany({
      where: {
        role: 'BUYER',
        deletedAt: null,
      },
      include: {
        purchaseRequests: {
          where: {
            status: {
              in: ['SUBMITTED', 'SUPPLIER_SELECTED'],
            },
            deletedAt: null,
          },
        },
      },
    });

    buyers.forEach((buyer) => {
      const totalPRs = buyer.purchaseRequests.length;
      if (totalPRs > 20) {
        notifications.push({
          id: `buyer-overloaded-${buyer.id}`,
          type: 'BUYER_OVERLOADED',
          message: `Buyer ${buyer.username} đang xử lý ${totalPRs} PR - có thể quá tải`,
          details: {
            buyer: {
              name: buyer.username,
              totalPRs,
            },
          },
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    });

    // Sort by createdAt desc
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    reply.send({ notifications });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

