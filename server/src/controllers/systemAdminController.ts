import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import { auditCreate, auditUpdate, auditDelete } from '../utils/audit';

// ============================================
// DASHBOARD
// ============================================

export const getDashboard = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    // Check if user is SYSTEM_ADMIN
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    console.log('System Admin Dashboard - User check:', {
      userId,
      userRole: user?.role,
      userRoleType: typeof user?.role,
      isSystemAdmin: user?.role === 'SYSTEM_ADMIN',
    });

    // Check role (handle both string and enum comparison)
    const userRole = user?.role as string;
    if (userRole !== 'SYSTEM_ADMIN') {
      console.log('System Admin Dashboard - Access denied:', {
        userRole,
        expected: 'SYSTEM_ADMIN',
      });
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    // Get total employees (active only)
    const totalEmployees = await prisma.user.count({
      where: { deletedAt: null },
    });

    // Get total departments (active only) - handle if table doesn't exist
    let totalDepartments = 0;
    try {
      totalDepartments = await prisma.department.count({
        where: { deletedAt: null, status: true },
      });
    } catch (error: any) {
      console.warn('Department table may not exist:', error.message);
    }

    // Get total branches (active only) - handle if table doesn't exist
    let totalBranches = 0;
    try {
      totalBranches = await prisma.branch.count({
        where: { deletedAt: null, status: true },
      });
    } catch (error: any) {
      console.warn('Branch table may not exist:', error.message);
    }

    // Auto-seed Branch Approval Rules (mặc định YES) cho tất cả chi nhánh
    // để tránh cảnh báo "chưa cấu hình" khi đã có logic rút gọn theo branch_code.
    try {
      const branches = await prisma.branch.findMany({
        where: { deletedAt: null, status: true },
        select: { id: true, branchCode: true },
      });
      const existingRules = await prisma.branchApprovalRule.findMany({
        where: { deletedAt: null },
        select: { branchId: true },
      });
      const existing = new Set(existingRules.map((r) => r.branchId));
      const missing = branches.filter((b) => !existing.has(b.id));
      if (missing.length > 0) {
        await prisma.branchApprovalRule.createMany({
          data: missing.map((b) => ({
            branchId: b.id,
            branchCode: b.branchCode,
            needBranchManagerApproval: true,
            note: null,
            updatedBy: userId,
            companyId: null,
          })),
          skipDuplicates: true,
        });
      }
    } catch (error: any) {
      console.warn('Auto-seed BranchApprovalRule failed:', error.message);
    }

    // Get active PRs (PRs that are not in final states)
    const activePRs = await prisma.purchaseRequest.count({
      where: {
        deletedAt: null,
        status: {
          notIn: ['CANCELLED', 'PAYMENT_DONE', 'BUDGET_REJECTED'],
        },
      },
    });

    // Get active approval rules - handle if table doesn't exist
    let activeApprovalRules = 0;
    try {
      // Branch Approval Rule (mới): cấu hình duyệt cấp 2 theo chi nhánh
      activeApprovalRules = await prisma.branchApprovalRule.count({
        where: { deletedAt: null },
      });
    } catch (error: any) {
      console.warn('BranchApprovalRule table may not exist:', error.message);
    }

    // Get warnings
    const warnings = [];

    // Warning 1: Departments without Team Leader - handle if table doesn't exist
    let departmentsWithoutTeamLead: Array<{ departmentCode: string }> = [];
    try {
      departmentsWithoutTeamLead = await prisma.department.findMany({
        where: {
          deletedAt: null,
          status: true,
        },
        select: { departmentCode: true },
      });
    } catch (error: any) {
      console.warn('Department table may not exist:', error.message);
    }
    // Check if any department has users with DEPARTMENT_HEAD role (TEAM_LEAD đã được gộp vào DEPARTMENT_HEAD)
    const departmentsWithTeamLead = new Set();
    const teamLeads = await prisma.user.findMany({
      where: {
        role: 'DEPARTMENT_HEAD', // TEAM_LEAD đã được gộp vào DEPARTMENT_HEAD
        deletedAt: null,
      },
      select: { department: true },
    });
    teamLeads.forEach((tl) => {
      if (tl.department) departmentsWithTeamLead.add(tl.department);
    });
    const deptWithoutTeamLead = departmentsWithoutTeamLead.filter(
      (dept) => !departmentsWithTeamLead.has(dept.departmentCode)
    );
    if (deptWithoutTeamLead.length > 0) {
      warnings.push({
        title: 'Phòng ban chưa có Trưởng phòng/Trưởng nhóm',
        message: `${deptWithoutTeamLead.length} phòng ban chưa có Trưởng phòng/Trưởng nhóm được gán`,
        count: deptWithoutTeamLead.length,
      });
    }

    // Warning 2 (UPDATED): Branches without BRANCH_MANAGER (giám đốc / quản lý chi nhánh)
    // Rule: trong mỗi branch_code, phải có ít nhất 1 user role = BRANCH_MANAGER và location = branch_code
    try {
      const branches = await prisma.branch.findMany({
        where: { deletedAt: null, status: true },
        select: { branchCode: true, branchName: true },
      });

      const branchManagers = await prisma.user.findMany({
        where: { deletedAt: null, role: 'BRANCH_MANAGER' },
        select: { location: true },
      });

      const branchesWithManager = new Set(
        branchManagers
          .map((u) => (u.location || '').trim())
          .filter((x) => !!x)
      );

      const branchesWithoutManager = branches.filter(
        (b) => !branchesWithManager.has((b.branchCode || '').trim())
      );

      if (branchesWithoutManager.length > 0) {
        warnings.push({
          title: 'Chi nhánh chưa có Giám đốc/Quản lý chi nhánh (BRANCH_MANAGER)',
          message: `${branchesWithoutManager.length} chi nhánh chưa có user role BRANCH_MANAGER (theo branch_code + system_roles)`,
          count: branchesWithoutManager.length,
        });
      }
    } catch (error: any) {
      console.warn('Branch/User table may not exist:', error.message);
    }

    // Note: Warning "Chi nhánh chưa cấu hình duyệt cấp 2" đã được loại bỏ
    // vì hệ thống auto-seed cấu hình mặc định (YES) cho tất cả chi nhánh.

    return reply.send({
      totalEmployees,
      totalDepartments,
      totalBranches,
      activePRs,
      activeApprovalRules,
      warnings,
    });
  } catch (error: any) {
    console.error('Get System Admin Dashboard error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// ============================================
// USER MANAGEMENT (EMPLOYEES)
// ============================================

const employeeUpdateSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email().optional(),
  branchCode: z.string().optional(),
  departmentCode: z.string().optional(),
  jobTitle: z.string().optional().nullable(),
});

export const getEmployees = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const { branchCode, departmentCode, status } = request.query as {
      branchCode?: string;
      departmentCode?: string;
      status?: string;
    };

    const where: any = {
      deletedAt: null,
    };

    if (branchCode) {
      // Assuming location stores branch code
      where.location = branchCode;
    }

    if (departmentCode) {
      where.department = departmentCode;
    }

    if (status) {
      // Since User model doesn't have explicit status, we'll use deletedAt
      // For now, we'll filter by existence
      if (status === 'INACTIVE') {
        // This would need a status field in User model
        // For now, we'll return all non-deleted users
      }
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        location: true,
        department: true,
        jobTitle: true,
        createdAt: true,
        deletedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map users to employee format
    const employees = users.map((user) => ({
      id: user.id,
      employeeCode: user.username,
      fullName: user.fullName || user.username, // Use fullName if available, fallback to username
      email: user.email,
      branchCode: user.location || '',
      departmentCode: user.department || '',
      jobTitle: user.jobTitle || null,
      systemRoles: [user.role], // User has single role, but system expects array
      status: user.deletedAt ? 'INACTIVE' : 'ACTIVE',
    }));

    return reply.send({ employees });
  } catch (error: any) {
    console.error('Get Employees error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

export const updateEmployee = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const { id } = request.params as { id: string };
    const body = employeeUpdateSchema.parse(request.body);

    const updateData: any = {};
    if (body.fullName !== undefined) updateData.fullName = body.fullName;
    if (body.email) updateData.email = body.email;
    if (body.branchCode) updateData.location = body.branchCode;
    if (body.departmentCode) updateData.department = body.departmentCode;
    if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        location: true,
        department: true,
        jobTitle: true,
        deletedAt: true,
      },
    });

    await auditUpdate('users', id, {}, body, { userId });

    return reply.send({
      id: updatedUser.id,
      employeeCode: updatedUser.username,
      fullName: updatedUser.fullName || updatedUser.username,
      email: updatedUser.email,
      branchCode: updatedUser.location || '',
      departmentCode: updatedUser.department || '',
      jobTitle: updatedUser.jobTitle || null,
      systemRoles: [updatedUser.role],
      status: updatedUser.deletedAt ? 'INACTIVE' : 'ACTIVE',
    });
  } catch (error: any) {
    console.error('Update Employee error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const updateEmployeeRolesSchema = z.object({
  roles: z.array(z.string()),
});

export const updateEmployeeRoles = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const { id } = request.params as { id: string };
    const body = updateEmployeeRolesSchema.parse(request.body);

    // Note: User model has single role, but system expects array
    // We'll take the first role from the array, or use the primary role
    // In a real system, you might want to add a roles array field
    const primaryRole = body.roles[0] || 'REQUESTOR';

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: primaryRole as any },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        location: true,
        department: true,
        jobTitle: true,
        deletedAt: true,
      },
    });

    await auditUpdate('users', id, {}, { roles: body.roles }, { userId });

    return reply.send({
      id: updatedUser.id,
      employeeCode: updatedUser.username,
      fullName: updatedUser.fullName || updatedUser.username,
      email: updatedUser.email,
      branchCode: updatedUser.location || '',
      departmentCode: updatedUser.department || '',
      jobTitle: updatedUser.jobTitle || null,
      systemRoles: body.roles,
      status: updatedUser.deletedAt ? 'INACTIVE' : 'ACTIVE',
    });
  } catch (error: any) {
    console.error('Update Employee Roles error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const toggleEmployeeStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export const toggleEmployeeStatus = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const { id } = request.params as { id: string };
    const body = toggleEmployeeStatusSchema.parse(request.body);

    // Soft delete for INACTIVE, restore for ACTIVE
    const updateData: any = {
      deletedAt: body.status === 'INACTIVE' ? new Date() : null,
    };

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    await auditUpdate('users', id, {}, { status: body.status }, { userId });

    return reply.send({
      id: updatedUser.id,
      employeeCode: updatedUser.username,
      fullName: updatedUser.username,
      email: updatedUser.email,
      branchCode: updatedUser.location || '',
      departmentCode: updatedUser.department || '',
      jobTitle: null,
      systemRoles: [updatedUser.role],
      status: updatedUser.deletedAt ? 'INACTIVE' : 'ACTIVE',
    });
  } catch (error: any) {
    console.error('Toggle Employee Status error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// ============================================
// APPROVAL CONFIGURATION
// ============================================

export const getApprovalRules = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const { departmentCode, prType, status } = request.query as {
      departmentCode?: string;
      prType?: string;
      status?: string;
    };

    const where: any = {
      deletedAt: null,
    };

    if (departmentCode) where.departmentCode = departmentCode;
    if (prType) where.prType = prType;
    if (status !== undefined) where.status = status === 'true';

    const rules = await prisma.approvalRule.findMany({
      where,
      orderBy: [{ departmentCode: 'asc' }, { prType: 'asc' }],
    });

    // Get updatedBy user info
    const updatedByUserIds = [...new Set(rules.map((r) => r.updatedBy).filter(Boolean))];
    const updatedByUsers = await prisma.user.findMany({
      where: { id: { in: updatedByUserIds as string[] } },
      select: { id: true, username: true },
    });
    const updatedByMap = new Map(updatedByUsers.map((u) => [u.id, u.username]));

    const mappedRules = rules.map((rule) => ({
      id: rule.id,
      departmentCode: rule.departmentCode,
      prType: rule.prType,
      needBranchManager: rule.needBranchManager,
      status: rule.status,
      updatedBy: rule.updatedBy ? updatedByMap.get(rule.updatedBy) || 'N/A' : 'N/A',
      updatedAt: rule.updatedAt.toISOString(),
    }));

    return reply.send({ rules: mappedRules });
  } catch (error: any) {
    console.error('Get Approval Rules error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const createApprovalRuleSchema = z.object({
  departmentCode: z.string(),
  branchId: z.string().optional(),
  prType: z.enum(['MATERIAL', 'SERVICE', 'COMMERCIAL']),
  needBranchManager: z.boolean().default(false), // YES/NO - Does this department need BRANCH_MANAGER approval?
  status: z.boolean().default(true),
});

export const createApprovalRule = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const body = createApprovalRuleSchema.parse(request.body);

    // Find department by code to get id
    const department = await prisma.department.findUnique({
      where: { departmentCode: body.departmentCode },
      select: { id: true },
    });

    if (!department) {
      return reply.code(404).send({
        error: 'Department not found',
      });
    }

    const rule = await prisma.approvalRule.create({
      data: {
        departmentCode: body.departmentCode,
        departmentId: department.id,
        branchId: body.branchId,
        prType: body.prType,
        needBranchManager: body.needBranchManager,
        status: body.status,
        updatedBy: userId,
      },
    });

    await auditCreate('approval_rules', rule.id, rule, { userId });

    return reply.send({
      id: rule.id,
      departmentCode: rule.departmentCode,
      prType: rule.prType,
      needBranchManager: rule.needBranchManager,
      status: rule.status,
      updatedBy: userId,
      updatedAt: rule.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Create Approval Rule error:', error);
    if (error.code === 'P2002') {
      return reply.code(400).send({
        error: 'Approval rule already exists for this department and PR type',
      });
    }
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const updateApprovalRuleSchema = z.object({
  needBranchManager: z.boolean().optional(), // YES/NO - Does this department need BRANCH_MANAGER approval?
  status: z.boolean().optional(),
});

export const updateApprovalRule = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const { id } = request.params as { id: string };
    const body = updateApprovalRuleSchema.parse(request.body);

    const oldRule = await prisma.approvalRule.findUnique({ where: { id } });
    if (!oldRule) {
      return reply.code(404).send({ error: 'Approval rule not found' });
    }

    const rule = await prisma.approvalRule.update({
      where: { id },
      data: {
        ...body,
        updatedBy: userId,
      },
    });

    await auditUpdate('approval_rules', id, oldRule, body, { userId });

    return reply.send({
      id: rule.id,
      departmentCode: rule.departmentCode,
      prType: rule.prType,
      needBranchManager: rule.needBranchManager,
      status: rule.status,
      updatedBy: userId,
      updatedAt: rule.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Update Approval Rule error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const toggleApprovalRuleStatusSchema = z.object({
  status: z.boolean(),
});

export const toggleApprovalRuleStatus = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const { id } = request.params as { id: string };
    const body = toggleApprovalRuleStatusSchema.parse(request.body);

    const rule = await prisma.approvalRule.update({
      where: { id },
      data: {
        status: body.status,
        updatedBy: userId,
      },
    });

    await auditUpdate('approval_rules', id, {}, { status: body.status }, { userId });

    return reply.send({
      id: rule.id,
      departmentCode: rule.departmentCode,
      prType: rule.prType,
      needBranchManager: rule.needBranchManager,
      status: rule.status,
      updatedBy: userId,
      updatedAt: rule.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Toggle Approval Rule Status error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// ============================================
// ORGANIZATION MANAGEMENT - BRANCHES
// ============================================

export const getBranches = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const branches = await prisma.branch.findMany({
      where: { deletedAt: null },
      include: {
        branchDirector: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { branchCode: 'asc' },
    });

    const mappedBranches = branches.map((branch) => ({
      id: branch.id,
      branchCode: branch.branchCode,
      branchName: branch.branchName,
      branchDirector: branch.branchDirector?.username || null,
      branchDirectorId: branch.branchDirectorId,
      status: branch.status,
    }));

    return reply.send({ branches: mappedBranches });
  } catch (error: any) {
    console.error('Get Branches error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const createBranchSchema = z.object({
  branchCode: z.string(),
  branchName: z.string(),
  branchDirectorId: z.string().optional(),
  status: z.boolean().default(true),
});

export const createBranch = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const body = createBranchSchema.parse(request.body);

    const branch = await prisma.branch.create({
      data: {
        branchCode: body.branchCode,
        branchName: body.branchName,
        branchDirectorId: body.branchDirectorId,
        status: body.status,
      },
      include: {
        branchDirector: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    await auditCreate('branches', branch.id, branch, { userId });

    return reply.send({
      id: branch.id,
      branchCode: branch.branchCode,
      branchName: branch.branchName,
      branchDirector: branch.branchDirector?.username || null,
      branchDirectorId: branch.branchDirectorId,
      status: branch.status,
    });
  } catch (error: any) {
    console.error('Create Branch error:', error);
    if (error.code === 'P2002') {
      return reply.code(400).send({
        error: 'Branch code already exists',
      });
    }
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const updateBranchSchema = z.object({
  branchName: z.string().optional(),
  branchDirectorId: z.string().optional().nullable(),
  status: z.boolean().optional(),
});

export const updateBranch = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const { id } = request.params as { id: string };
    const body = updateBranchSchema.parse(request.body);

    const oldBranch = await prisma.branch.findUnique({ where: { id } });
    if (!oldBranch) {
      return reply.code(404).send({ error: 'Branch not found' });
    }

    const updateData: any = {};
    if (body.branchName !== undefined) updateData.branchName = body.branchName;
    if (body.branchDirectorId !== undefined) updateData.branchDirectorId = body.branchDirectorId;
    if (body.status !== undefined) updateData.status = body.status;

    const branch = await prisma.branch.update({
      where: { id },
      data: updateData,
      include: {
        branchDirector: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    await auditUpdate('branches', id, oldBranch, body, { userId });

    return reply.send({
      id: branch.id,
      branchCode: branch.branchCode,
      branchName: branch.branchName,
      branchDirector: branch.branchDirector?.username || null,
      branchDirectorId: branch.branchDirectorId,
      status: branch.status,
    });
  } catch (error: any) {
    console.error('Update Branch error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// ============================================
// APPROVAL CONFIG (MỚI) - BRANCH APPROVAL RULES
// ============================================

export const getBranchApprovalRules = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const branches = await prisma.branch.findMany({
      where: { deletedAt: null },
      include: {
        branchApprovalRule: {
          where: { deletedAt: null },
          select: {
            id: true,
            needBranchManagerApproval: true,
            note: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { branchCode: 'asc' },
    });

    // Auto-seed cấu hình mặc định YES cho các chi nhánh chưa có rule
    const missingBranches = branches.filter((b) => !b.branchApprovalRule);
    if (missingBranches.length > 0) {
      await prisma.branchApprovalRule.createMany({
        data: missingBranches.map((b) => ({
          branchId: b.id,
          branchCode: b.branchCode,
          needBranchManagerApproval: true,
          note: null,
          updatedBy: userId,
          companyId: null,
        })),
        skipDuplicates: true,
      });
    }

    // Re-fetch để trả về ruleId/updatedAt đúng sau khi seed
    const branchesWithRules = await prisma.branch.findMany({
      where: { deletedAt: null },
      include: {
        branchApprovalRule: {
          where: { deletedAt: null },
          select: {
            id: true,
            needBranchManagerApproval: true,
            note: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { branchCode: 'asc' },
    });

    return reply.send({
      rules: branchesWithRules.map((b) => ({
        branchId: b.id,
        branchCode: b.branchCode,
        branchName: b.branchName,
        ruleId: b.branchApprovalRule?.id || null,
        needBranchManagerApproval: b.branchApprovalRule?.needBranchManagerApproval ?? true,
        note: b.branchApprovalRule?.note || '',
        updatedAt: b.branchApprovalRule?.updatedAt?.toISOString() || null,
      })),
    });
  } catch (error: any) {
    console.error('Get Branch Approval Rules error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const updateBranchApprovalRuleSchema = z.object({
  needBranchManagerApproval: z.boolean(),
  note: z.string().optional().nullable(),
});

export const updateBranchApprovalRule = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const { branchCode } = request.params as { branchCode: string };
    const body = updateBranchApprovalRuleSchema.parse(request.body);

    const branch = await prisma.branch.findFirst({
      where: { branchCode, deletedAt: null },
      select: { id: true, branchCode: true, branchName: true },
    });

    if (!branch) {
      return reply.code(404).send({ error: 'Branch not found' });
    }

    const oldRule = await prisma.branchApprovalRule.findFirst({
      where: { branchId: branch.id, deletedAt: null },
    });

    const saved = await prisma.branchApprovalRule.upsert({
      where: { branchId: branch.id },
      create: {
        branchId: branch.id,
        branchCode: branch.branchCode,
        needBranchManagerApproval: body.needBranchManagerApproval,
        note: body.note || null,
        updatedBy: userId,
        companyId: null,
      },
      update: {
        branchCode: branch.branchCode,
        needBranchManagerApproval: body.needBranchManagerApproval,
        note: body.note || null,
        updatedBy: userId,
        deletedAt: null,
      },
    });

    if (!oldRule) {
      await auditCreate('branch_approval_rules', saved.id, saved, { userId });
    } else {
      await auditUpdate('branch_approval_rules', saved.id, oldRule, saved, { userId });
    }

    return reply.send({
      branchId: branch.id,
      branchCode: branch.branchCode,
      branchName: branch.branchName,
      ruleId: saved.id,
      needBranchManagerApproval: saved.needBranchManagerApproval,
      note: saved.note || '',
      updatedAt: saved.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('Update Branch Approval Rule error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// ============================================
// ORGANIZATION MANAGEMENT - DEPARTMENTS
// ============================================

export const getDepartments = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const departments = await prisma.department.findMany({
      where: { deletedAt: null },
      include: {
        branch: {
          select: {
            id: true,
            branchCode: true,
            branchName: true,
          },
        },
        approvalRules: {
          where: { deletedAt: null, status: true },
          select: { id: true },
        },
      },
      orderBy: { departmentCode: 'asc' },
    });

    const mappedDepartments = departments.map((dept) => ({
      id: dept.id,
      departmentCode: dept.departmentCode,
      departmentName: dept.departmentName,
      branchId: dept.branchId,
      branchCode: dept.branch?.branchCode,
      status: dept.status,
      approvalRuleId: dept.approvalRules.length > 0 ? dept.approvalRules[0].id : undefined,
      note: dept.note || undefined,
    }));

    return reply.send({ departments: mappedDepartments });
  } catch (error: any) {
    console.error('Get Departments error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const createDepartmentSchema = z.object({
  departmentCode: z.string(),
  departmentName: z.string(),
  branchId: z.string().optional().nullable(),
  status: z.boolean().default(true),
  note: z.string().optional(),
});

export const createDepartment = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const body = createDepartmentSchema.parse(request.body);

    const department = await prisma.department.create({
      data: {
        departmentCode: body.departmentCode,
        departmentName: body.departmentName,
        branchId: body.branchId || null,
        status: body.status,
        note: body.note,
      },
      include: {
        branch: {
          select: {
            id: true,
            branchCode: true,
            branchName: true,
          },
        },
      },
    });

    await auditCreate('departments', department.id, department, { userId });

    return reply.send({
      id: department.id,
      departmentCode: department.departmentCode,
      departmentName: department.departmentName,
      branchId: department.branchId,
      status: department.status,
      approvalRuleId: undefined,
      note: department.note || undefined,
    });
  } catch (error: any) {
    console.error('Create Department error:', error);
    if (error.code === 'P2002') {
      return reply.code(400).send({
        error: 'Department code already exists',
      });
    }
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

const updateDepartmentSchema = z.object({
  departmentName: z.string().optional(),
  branchId: z.string().optional().nullable(),
  status: z.boolean().optional(),
  note: z.string().optional(),
});

export const updateDepartment = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const { id } = request.params as { id: string };
    const body = updateDepartmentSchema.parse(request.body);

    const oldDepartment = await prisma.department.findUnique({ where: { id } });
    if (!oldDepartment) {
      return reply.code(404).send({ error: 'Department not found' });
    }

    const updateData: any = {};
    if (body.departmentName !== undefined) updateData.departmentName = body.departmentName;
    if (body.branchId !== undefined) updateData.branchId = body.branchId;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.note !== undefined) updateData.note = body.note;

    const department = await prisma.department.update({
      where: { id },
      data: updateData,
      include: {
        approvalRules: {
          where: { deletedAt: null, status: true },
          select: { id: true },
        },
      },
    });

    await auditUpdate('departments', id, oldDepartment, body, { userId });

    return reply.send({
      id: department.id,
      departmentCode: department.departmentCode,
      departmentName: department.departmentName,
      branchId: department.branchId,
      status: department.status,
      approvalRuleId: department.approvalRules.length > 0 ? department.approvalRules[0].id : undefined,
      note: department.note || undefined,
    });
  } catch (error: any) {
    console.error('Update Department error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

// ============================================
// IMPORT CENTER
// ============================================

export const getImportHistory = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const { importType, limit = '50' } = request.query as {
      importType?: string;
      limit?: string;
    };

    const where: any = {};

    if (importType) {
      where.importType = importType;
    }

    const imports = await prisma.importHistory.findMany({
      where,
      include: {
        importer: {
          select: {
            username: true,
            deletedAt: true,
          },
        },
      },
      orderBy: { importedAt: 'desc' },
      take: parseInt(limit) || 50,
    });

    const mappedImports = imports.map((imp) => {
      // Handle case where importer might be deleted or not found
      let importedByUsername = 'Unknown';
      if (imp.importer && !imp.importer.deletedAt) {
        importedByUsername = imp.importer.username;
      } else if (imp.importer && imp.importer.deletedAt) {
        importedByUsername = `${imp.importer.username} (deleted)`;
      }

      return {
        id: imp.id,
        fileName: imp.fileName,
        importType: imp.importType,
        importedBy: importedByUsername,
        success: imp.success,
        failed: imp.failed,
        errorFileUrl: imp.errorFileUrl || undefined,
        importedAt: imp.importedAt.toISOString(),
      };
    });

    return reply.send({ imports: mappedImports });
  } catch (error: any) {
    console.error('Get Import History error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

export const uploadExcel = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const importType = data.fields.importType?.value as 'EMPLOYEE' | 'DEPT' | 'RULE';
    if (!importType || !['EMPLOYEE', 'DEPT', 'RULE'].includes(importType)) {
      return reply.code(400).send({ error: 'Invalid import type' });
    }

    // TODO: Implement Excel parsing logic
    // For now, return mock data
    const buffer = await data.toBuffer();
    const fileName = data.filename || 'import.xlsx';

    // Create import history record
    const importHistory = await prisma.importHistory.create({
      data: {
        fileName,
        importType,
        importedBy: userId,
        success: 0,
        failed: 0,
        errors: [],
      },
      include: {
        importer: {
          select: {
            username: true,
          },
        },
      },
    });

    // TODO: Process Excel file and import data
    // This would require Excel parsing library (e.g., exceljs)

    return reply.send({
      success: 0,
      failed: 0,
      message: 'Import functionality will be implemented with Excel parsing library',
      importId: importHistory.id,
    });
  } catch (error: any) {
    console.error('Upload Excel error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

export const previewExcel = async (
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
      select: { role: true },
    });

    if (user?.role !== 'SYSTEM_ADMIN') {
      return reply.code(403).send({ error: 'Forbidden - System Admin only' });
    }

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const importType = data.fields.importType?.value as 'EMPLOYEE' | 'DEPT' | 'RULE';
    if (!importType || !['EMPLOYEE', 'DEPT', 'RULE'].includes(importType)) {
      return reply.code(400).send({ error: 'Invalid import type' });
    }

    // TODO: Implement Excel preview parsing
    // For now, return mock data

    return reply.send({
      totalRows: 0,
      preview: [],
      errors: [],
      message: 'Preview functionality will be implemented with Excel parsing library',
    });
  } catch (error: any) {
    console.error('Preview Excel error:', error);
    return reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

