import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { auditUpdate } from '../utils/audit';
import { createNotification, NotificationTemplates, markNotificationAsResolved } from '../utils/notifications';
import { getIO } from '../utils/getIO';

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
      status: 'MANAGER_PENDING',
      deletedAt: null,
      // Exclude PRs created by the department head themselves
      requestorId: { not: userId },
      requestor: {
        directManagerCode: managerCode,
      },
    };

    // Get pending PRs (waiting for approval)
    const pendingPRs = await prisma.purchaseRequest.findMany({
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
        },
      },
      orderBy: { createdAt: 'asc' },
    });

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
          department: pr.department,
          itemName: itemName,
          itemCount: pr.items.length,
          totalAmount: finalTotal > 0 ? finalTotal : null,
          currency: pr.currency || 'VND',
          requestor: pr.requestor,
          requiredDate: pr.requiredDate?.toISOString(),
          createdAt: pr.createdAt.toISOString(),
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

    // CẤP 1: chỉ hiển thị PR mà Requestor có direct_manager_code = username của người đang đăng nhập
    const whereClause: any = {
      status: 'MANAGER_PENDING',
      deletedAt: null,
      // Exclude PRs created by the department head themselves
      requestorId: { not: userId },
      requestor: {
        directManagerCode: managerCode,
      },
    };

    const prs = await prisma.purchaseRequest.findMany({
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
        },
        approvals: {
          where: {
            approverId: userId,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const mappedPRs = prs.map((pr) => {
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
        department: pr.department,
        itemName: itemName,
        itemCount: pr.items.length,
        totalAmount: finalTotal > 0 ? finalTotal : null,
        currency: pr.currency || 'VND',
        requestor: pr.requestor,
        requiredDate: pr.requiredDate?.toISOString(),
        purpose: pr.purpose,
        notes: pr.notes,
        createdAt: pr.createdAt.toISOString(),
        items: pr.items.map((item) => ({
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
        hasPreviousApproval: pr.approvals.length > 0,
      };
    });

    reply.send({ prs: mappedPRs });
  } catch (error: any) {
    console.error('Get pending PRs error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// Approve PR
export const approvePR = async (
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
    if (!approver?.username) {
      return reply.code(400).send({ error: 'Không xác định được mã người duyệt' });
    }
    if (approver.role !== 'DEPARTMENT_HEAD') {
      return reply.code(403).send({ error: 'Forbidden - chỉ quản lý trực tiếp mới được duyệt cấp 1' });
    }

    // Xác định branch_code để kiểm tra cấu hình duyệt cấp 2 theo chi nhánh
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

    // Mặc định: cần duyệt cấp 2 (an toàn)
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

    // Update PR status (sau duyệt cấp 1)
    const updatedPR = await prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: nextStatus as any,
        location: branchCode, // ensure stored
      },
    });

    // Create approval record
    await prisma.pRApproval.create({
      data: {
        purchaseRequestId: id,
        approverId: userId,
        action: 'APPROVE',
        comment: comment || null,
      },
    });

    // Get requestor info for notification
    // Send notification to REQUESTOR: PR được Trưởng phòng duyệt
    if (requestor) {
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

      // Mark old notification as resolved if exists
      await markNotificationAsResolved(id, 'PR', 'PR_PENDING_APPROVAL');
    }

    if (needBranchManagerApproval) {
      // Send notification to BRANCH_MANAGER: PR chờ duyệt
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
    } else {
      // Bỏ qua duyệt cấp 2 => chuyển thẳng sang Buyer Leader (sẵn sàng phân công)
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

    // Audit log
    await auditUpdate(
      'purchase_requests',
      id,
      { status: pr.status },
      { status: nextStatus },
      { userId, companyId: pr.companyId || undefined }
    );

    reply.send({
      message: 'PR approved successfully',
      pr: {
        id: updatedPR.id,
        prNumber: updatedPR.prNumber,
        status: updatedPR.status,
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

    // Update PR status
    const updatedPR = await prisma.purchaseRequest.update({
      where: { id },
      data: {
        status: 'MANAGER_REJECTED',
        notes: comment,
      },
    });

    // Create approval record
    await prisma.pRApproval.create({
      data: {
        purchaseRequestId: id,
        approverId: userId,
        action: 'REJECT',
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

    // PR theo loại (COMMERCIAL / PRODUCTION)
    const prsByTypeMap = new Map<string, { type: string; count: number; totalAmount: number }>();
    prsWithAmounts.forEach((pr) => {
      const type = (pr as any).type || 'PRODUCTION';
      const typeLabel = type === 'COMMERCIAL' ? 'Thương mại' : 'Sản xuất';
      const existing = prsByTypeMap.get(type);
      if (existing) {
        existing.count += 1;
        existing.totalAmount += pr.calculatedTotal;
      } else {
        prsByTypeMap.set(type, {
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
    const prsByStatus = Array.from(prsByStatusMap.values()).sort((a, b) => b.count - a.count);

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

