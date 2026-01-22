import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

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

    const where: any = {
      deletedAt: null,
    };

    // Map frontend status to database status
    if (!status || status === 'all' || status === 'READY_FOR_RFQ') {
      where.status = 'ASSIGNED_TO_BUYER';
    } else if (status === 'COLLECTING_QUOTATION') {
      where.status = 'RFQ_IN_PROGRESS';
    } else if (status === 'QUOTATION_COMPLETED') {
      where.status = { in: ['QUOTATION_RECEIVED', 'SUPPLIER_SELECTED'] };
    } else {
      where.status = status;
    }

    // Filter by assignments to current buyer
    where.assignments = {
      some: {
        buyerId: userId,
      },
    };

    const prs = await prisma.purchaseRequest.findMany({
      where,
      include: {
        salesPO: {
          select: {
            salesPONumber: true,
            projectName: true,
          },
        },
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
      take: 100,
    });

    // Map to frontend format
    const mappedPRs = prs.map((pr) => {
      let statusLabel = 'READY_FOR_RFQ';
      if (pr.status === 'SUPPLIER_SELECTED' || pr.status === 'QUOTATION_RECEIVED') {
        statusLabel = 'QUOTATION_COMPLETED';
      } else if (pr.status === 'RFQ_IN_PROGRESS') {
        statusLabel = 'COLLECTING_QUOTATION';
      }

      return {
        id: pr.id,
        prNumber: pr.prNumber,
        salesPO: {
          number: pr.salesPO?.salesPONumber || 'N/A',
          project: pr.salesPO?.projectName || 'N/A',
        },
        scope: pr.itemName, // Using itemName as scope
        status: statusLabel,
        assignedDate: pr.createdAt.toISOString(),
      };
    });

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
export const getProjectCostReference = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Get all active Sales POs with their costs
    const activeSalesPOs = await prisma.salesPO.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        purchaseRequests: {
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

    const projects = activeSalesPOs.map((po) => {
      let actualCost = 0;
      po.purchaseRequests.forEach((pr) => {
        pr.payments.forEach((payment) => {
          actualCost += Number(payment.amount);
        });
      });

      const remainingBudget = Number(po.amount) - actualCost;
      const progress = (actualCost / Number(po.amount)) * 100;

      return {
        id: po.id,
        salesPONumber: po.salesPONumber,
        projectName: po.projectName || 'N/A',
        projectCode: po.projectCode || 'N/A',
        salesPOAmount: Number(po.amount),
        actualCost,
        remainingBudget,
        progress: Number(progress.toFixed(1)),
      };
    });

    reply.send({ projects });
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
        items: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            lineNo: 'asc',
          },
        },
      },
    });

    if (!pr) {
      return reply.code(404).send({ error: 'PR not found or not assigned to you' });
    }

    // Get assignment for this buyer
    const assignment = await prisma.pRAssignment.findFirst({
      where: {
        purchaseRequestId: prId,
        buyerId: userId,
        deletedAt: null,
      },
    });

    if (!assignment) {
      return reply.code(404).send({ error: 'Assignment not found' });
    }

    // Filter items based on assignment scope
    let assignedItemIds: string[] = [];
    if (assignment.scope === 'FULL') {
      // All items are assigned
      assignedItemIds = pr.items.map(item => item.id);
    } else if (assignment.scope === 'PARTIAL' && assignment.assignedItemIds) {
      // Only specific items
      assignedItemIds = JSON.parse(assignment.assignedItemIds) as string[];
    }

    // Filter items to only show assigned ones
    const assignedItems = pr.items.filter(item => assignedItemIds.includes(item.id));

    reply.send({
      id: pr.id,
      prNumber: pr.prNumber,
      department: pr.department,
      purpose: pr.purpose,
      requiredDate: pr.requiredDate?.toISOString(),
      totalAmount: pr.totalAmount ? Number(pr.totalAmount) : null,
      currency: pr.currency,
      status: pr.status,
      requestor: pr.requestor,
      items: assignedItems.map(item => ({
        id: item.id,
        lineNo: item.lineNo,
        description: item.description,
        partNo: item.partNo,
        spec: item.spec,
        manufacturer: item.manufacturer,
        qty: Number(item.qty),
        unit: item.unit,
        unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
        amount: item.amount ? Number(item.amount) : null,
        purpose: item.purpose,
        remark: item.remark,
      })),
      notes: pr.notes,
      assignment: {
        scope: assignment.scope,
        note: assignment.note,
        assignedItemIds: assignedItemIds,
      },
    });
  } catch (error: any) {
    console.error('Get PR details error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
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
        message: `Bạn đã được phân công PR ${pr.prNumber} từ ${pr.salesPO ? 'dự án' : 'hệ thống'}`,
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

