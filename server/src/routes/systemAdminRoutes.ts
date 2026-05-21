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
  fastify.addHook('onRequest', authenticate);

  fastify.get('/dashboard', { compress: false }, getDashboard);

  // User Management
  fastify.get('/employees', { compress: false }, getEmployees);
  fastify.put('/employees/:id', updateEmployee);
  fastify.put('/employees/:id/roles', updateEmployeeRoles);
  fastify.put('/employees/:id/status', toggleEmployeeStatus);

  // Approval Configuration
  fastify.get('/approval-rules', { compress: false }, getApprovalRules);
  fastify.post('/approval-rules', createApprovalRule);
  fastify.put('/approval-rules/:id', updateApprovalRule);
  fastify.put('/approval-rules/:id/status', toggleApprovalRuleStatus);

  // Branch Approval Rules
  fastify.get('/branch-approval-rules', { compress: false }, getBranchApprovalRules);
  fastify.put('/branch-approval-rules/:branchCode', updateBranchApprovalRule);

  // Branches
  fastify.get('/branches', { compress: false }, getBranches);
  fastify.post('/branches', createBranch);
  fastify.put('/branches/:id', updateBranch);

  // Departments
  fastify.get('/departments', { compress: false }, getDepartments);
  fastify.post('/departments', createDepartment);
  fastify.put('/departments/:id', updateDepartment);

  // Import Center
  fastify.get('/import-history', { compress: false }, getImportHistory);
  fastify.post('/import/users', importUsersFromExcel);
  fastify.post('/import/users/preview', previewExcelImport);
  fastify.post('/import/master-data', importMasterDataFromExcel);
  fastify.post('/import/master-data/preview', previewMasterDataExcel);
}
