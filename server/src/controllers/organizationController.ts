import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../config/database';

/**
 * Get organization hierarchy (manager-employee relationships)
 * Based on direct_manager_code field
 * Structure: Branch → BRANCH_MANAGER → DEPT_MANAGER/TEAM_LEAD → STAFF
 */
export const getOrganizationHierarchy = async (
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

    // Get all active users with their direct manager info
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        location: true,
        department: true,
        jobTitle: true,
        directManagerCode: true,
      },
      orderBy: [
        { location: 'asc' },
        { department: 'asc' },
        { fullName: 'asc' },
      ],
    });

    // Get all branches
    const branches = await prisma.branch.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        branchCode: true,
        branchName: true,
      },
      orderBy: { branchCode: 'asc' },
    });

    // Build hierarchy by branch
    const hierarchyByBranch = branches.map((branch) => {
      // Get BRANCH_MANAGER for this branch
      const branchManager = users.find(
        (u) => u.location === branch.branchCode && u.role === 'BRANCH_MANAGER'
      );

      // Get all users in this branch
      const branchUsers = users.filter((u) => u.location === branch.branchCode);

      // Build manager-employee map
      const managerMap: { [managerCode: string]: any[] } = {};
      const rootEmployees: any[] = [];

      branchUsers.forEach((user) => {
        const employeeData = {
          id: user.id,
          employeeCode: user.username,
          fullName: user.fullName || user.username,
          email: user.email,
          role: user.role,
          branchCode: user.location || null,
          departmentCode: user.department || null,
          jobTitle: user.jobTitle || null,
          directManagerCode: user.directManagerCode || null,
          subordinates: [] as any[],
        };

        if (user.directManagerCode) {
          if (!managerMap[user.directManagerCode]) {
            managerMap[user.directManagerCode] = [];
          }
          managerMap[user.directManagerCode].push(employeeData);
        } else {
          // If no direct manager, check if they are BRANCH_MANAGER
          if (user.role !== 'BRANCH_MANAGER') {
            rootEmployees.push(employeeData);
          }
        }
      });

      // Build tree structure recursively
      const buildTree = (employee: any): any => {
        const subordinates = managerMap[employee.employeeCode] || [];
        return {
          ...employee,
          subordinates: subordinates.map(buildTree),
          subordinateCount: subordinates.length,
        };
      };

      // Start from BRANCH_MANAGER if exists
      let hierarchy: any[] = [];
      if (branchManager) {
        const branchManagerData = {
          id: branchManager.id,
          employeeCode: branchManager.username,
          fullName: branchManager.fullName || branchManager.username,
          email: branchManager.email,
          role: branchManager.role,
          branchCode: branchManager.location || null,
          departmentCode: branchManager.department || null,
          jobTitle: branchManager.jobTitle || null,
          directManagerCode: branchManager.directManagerCode || null,
          subordinates: [] as any[],
        };

        // Get direct reports of BRANCH_MANAGER (usually DEPT_MANAGER or TEAM_LEAD)
        const branchManagerSubordinates = managerMap[branchManager.username] || [];
        
        // Build tree structure for BRANCH_MANAGER's subordinates
        if (branchManagerSubordinates.length > 0) {
          branchManagerData.subordinates = branchManagerSubordinates.map(buildTree);
        } else {
          // If no direct subordinates via direct_manager_code, 
          // show all other users in branch grouped by their managers
          const otherUsers = branchUsers.filter(u => u.id !== branchManager.id);
          
          // Group by direct_manager_code if exists, otherwise show as root
          const usersByManager: { [managerCode: string]: any[] } = {};
          const rootUsers: any[] = [];
          
          otherUsers.forEach((user) => {
            const employeeData = {
              id: user.id,
              employeeCode: user.username,
              fullName: user.fullName || user.username,
              email: user.email,
              role: user.role,
              branchCode: user.location || null,
              departmentCode: user.department || null,
              jobTitle: user.jobTitle || null,
              directManagerCode: user.directManagerCode || null,
              subordinates: [] as any[],
            };
            
            if (user.directManagerCode && user.directManagerCode !== branchManager.username) {
              // This user reports to someone else (not BRANCH_MANAGER)
              // We'll add them to their manager's subordinates later
              if (!usersByManager[user.directManagerCode]) {
                usersByManager[user.directManagerCode] = [];
              }
              usersByManager[user.directManagerCode].push(employeeData);
            } else {
              // User reports directly to BRANCH_MANAGER or has no manager
              rootUsers.push(employeeData);
            }
          });
          
          // Build tree for root users (those reporting directly to BRANCH_MANAGER)
          branchManagerData.subordinates = rootUsers.map(buildTree);
        }
        
        branchManagerData.subordinateCount = branchManagerData.subordinates.length;
        hierarchy = [branchManagerData];
      } else {
        // No BRANCH_MANAGER, show all users grouped by role
        const deptHeads = rootEmployees.filter(e => e.role === 'DEPARTMENT_HEAD');
        const otherUsers = rootEmployees.filter(e => e.role !== 'DEPARTMENT_HEAD');
        hierarchy = [...deptHeads.map(buildTree), ...otherUsers.map(buildTree)];
      }

      return {
        branchId: branch.id,
        branchCode: branch.branchCode,
        branchName: branch.branchName,
        branchManager: branchManager
          ? {
              id: branchManager.id,
              employeeCode: branchManager.username,
              fullName: branchManager.fullName || branchManager.username,
              email: branchManager.email,
              role: branchManager.role,
            }
          : null,
        hierarchy,
        totalEmployees: branchUsers.length,
      };
    });

    // Also return flat list for easier frontend consumption
    const flatList = users.map((user) => {
      const manager = user.directManagerCode
        ? users.find((u) => u.username === user.directManagerCode)
        : null;

      return {
        id: user.id,
        employeeCode: user.username,
        fullName: user.fullName || user.username,
        email: user.email,
        role: user.role,
        branchCode: user.location || null,
        departmentCode: user.department || null,
        jobTitle: user.jobTitle || null,
        directManagerCode: user.directManagerCode || null,
        directManagerName: manager ? (manager.fullName || manager.username) : null,
        subordinateCount: users.filter((u) => u.directManagerCode === user.username).length,
      };
    });

    const response = {
      hierarchyByBranch,
      flatList,
      totalEmployees: users.length,
      totalBranches: branches.length,
      totalManagers: users.filter((u) => u.role === 'BRANCH_MANAGER' || u.role === 'DEPARTMENT_HEAD').length,
    };

    // Set headers to prevent compression issues
    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Encoding', 'identity');
    
    reply.send(response);
  } catch (error: any) {
    console.error('Get Organization Hierarchy error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get branch managers (Giám đốc / Quản lý chi nhánh)
 * Rule: In each branch_code, user with system_roles = BRANCH_MANAGER is the branch manager
 */
export const getBranchDirectors = async (
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

    // Get all users with BRANCH_MANAGER role
    const branchManagers = await prisma.user.findMany({
      where: {
        role: 'BRANCH_MANAGER',
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        location: true, // branch_code
        department: true,
        jobTitle: true,
      },
      orderBy: { location: 'asc' },
    });

    // Get all branches to check which ones have managers
    const branches = await prisma.branch.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        branchCode: true,
        branchName: true,
      },
      orderBy: { branchCode: 'asc' },
    });

    // Map branches with their managers
    const branchesWithManagers = branches.map((branch) => {
      const manager = branchManagers.find(
        (m) => m.location === branch.branchCode
      );

      return {
        branchId: branch.id,
        branchCode: branch.branchCode,
        branchName: branch.branchName,
        manager: manager
          ? {
              id: manager.id,
              employeeCode: manager.username,
              fullName: manager.fullName || manager.username,
              email: manager.email,
              departmentCode: manager.department || null,
              jobTitle: manager.jobTitle || null,
            }
          : null,
      };
    });

    const response = {
      branchManagers: branchManagers.map((m) => ({
        id: m.id,
        employeeCode: m.username,
        fullName: m.fullName || m.username,
        email: m.email,
        branchCode: m.location || null,
        departmentCode: m.department || null,
        jobTitle: m.jobTitle || null,
      })),
      branchesWithManagers,
      totalBranches: branches.length,
      branchesWithManager: branchesWithManagers.filter((b) => b.manager !== null).length,
      branchesWithoutManager: branchesWithManagers.filter((b) => b.manager === null).length,
    };

    // Set headers to prevent compression issues
    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Encoding', 'identity');
    
    reply.send(response);
  } catch (error: any) {
    console.error('Get Branch Managers error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get employee's direct manager
 */
export const getEmployeeManager = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { employeeCode } = request.params as { employeeCode: string };

    const employee = await prisma.user.findFirst({
      where: {
        username: employeeCode,
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        directManagerCode: true,
      },
    });

    if (!employee) {
      return reply.code(404).send({ error: 'Employee not found' });
    }

    if (!employee.directManagerCode) {
      return reply.send({
        employeeCode: employee.username,
        employeeName: employee.fullName || employee.username,
        hasManager: false,
        manager: null,
      });
    }

    const manager = await prisma.user.findFirst({
      where: {
        username: employee.directManagerCode,
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        location: true,
        department: true,
        jobTitle: true,
      },
    });

    if (!manager) {
      return reply.send({
        employeeCode: employee.username,
        employeeName: employee.fullName || employee.username,
        hasManager: true,
        managerCode: employee.directManagerCode,
        manager: null, // Manager code exists but user not found
        error: 'Manager not found',
      });
    }

    reply.send({
      employeeCode: employee.username,
      employeeName: employee.fullName || employee.username,
      hasManager: true,
      manager: {
        id: manager.id,
        employeeCode: manager.username,
        fullName: manager.fullName || manager.username,
        email: manager.email,
        role: manager.role,
        branchCode: manager.location || null,
        departmentCode: manager.department || null,
        jobTitle: manager.jobTitle || null,
      },
    });
  } catch (error: any) {
    console.error('Get Employee Manager error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get employee's subordinates (direct reports)
 */
export const getEmployeeSubordinates = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { employeeCode } = request.params as { employeeCode: string };

    const subordinates = await prisma.user.findMany({
      where: {
        directManagerCode: employeeCode,
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        location: true,
        department: true,
        jobTitle: true,
        directManagerCode: true,
      },
      orderBy: [
        { department: 'asc' },
        { fullName: 'asc' },
      ],
    });

    reply.send({
      managerCode: employeeCode,
      subordinates: subordinates.map((sub) => ({
        id: sub.id,
        employeeCode: sub.username,
        fullName: sub.fullName || sub.username,
        email: sub.email,
        role: sub.role,
        branchCode: sub.location || null,
        departmentCode: sub.department || null,
        jobTitle: sub.jobTitle || null,
      })),
      count: subordinates.length,
    });
  } catch (error: any) {
    console.error('Get Employee Subordinates error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};
