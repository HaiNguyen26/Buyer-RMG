import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getDashboard,
  getEmployees,
  updateEmployee,
  updateEmployeeRoles,
  toggleEmployeeStatus,
  getApprovalRules,
  createApprovalRule,
  updateApprovalRule,
  toggleApprovalRuleStatus,
  getBranches,
  createBranch,
  updateBranch,
  getBranchApprovalRules,
  updateBranchApprovalRule,
  getDepartments,
  createDepartment,
  updateDepartment,
  getImportHistory,
} from '../controllers/systemAdminController';
import {
  importUsersFromExcel,
  previewExcelImport,
  importMasterDataFromExcel,
  previewMasterDataExcel,
} from '../controllers/importController';

export default async function systemAdminRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', authenticate);

  // Dashboard
  fastify.get('/dashboard', getDashboard);

  // User Management (Employees)
  fastify.get('/employees', getEmployees);
  fastify.put('/employees/:id', updateEmployee);
  fastify.put('/employees/:id/roles', updateEmployeeRoles);
  fastify.put('/employees/:id/status', toggleEmployeeStatus);

  // Approval Configuration
  fastify.get('/approval-rules', getApprovalRules);
  fastify.post('/approval-rules', createApprovalRule);
  fastify.put('/approval-rules/:id', updateApprovalRule);
  fastify.put('/approval-rules/:id/status', toggleApprovalRuleStatus);

  // Approval Config (NEW) - Branch Approval Rules (YES/NO duyệt cấp 2 theo chi nhánh)
  fastify.get('/branch-approval-rules', getBranchApprovalRules);
  fastify.put('/branch-approval-rules/:branchCode', updateBranchApprovalRule);

  // Organization Management - Branches
  fastify.get('/branches', getBranches);
  fastify.post('/branches', createBranch);
  fastify.put('/branches/:id', updateBranch);

  // Organization Management - Departments
  fastify.get('/departments', getDepartments);
  fastify.post('/departments', createDepartment);
  fastify.put('/departments/:id', updateDepartment);

  // Import Center
  fastify.get('/import-history', getImportHistory);
  fastify.post('/import/users', importUsersFromExcel);
  fastify.post('/import/users/preview', previewExcelImport);
  fastify.post('/import/master-data', importMasterDataFromExcel);
  fastify.post('/import/master-data/preview', previewMasterDataExcel);
}




