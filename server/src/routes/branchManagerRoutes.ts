import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getBranchManagerDashboard,
  getPendingPRs,
  approvePR,
  rejectPR,
  returnPR,
  getBudgetExceptions,
  getBudgetExceptionById,
  approveBudgetException,
  rejectBudgetException,
  requestNegotiation,
  getPRHistory,
  getBranchOverview,
  getBranchManagerNotifications,
} from '../controllers/branchManagerController';

export default async function branchManagerRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', authenticate);

  // Dashboard
  fastify.get('/dashboard', getBranchManagerDashboard);

  // PR Approval
  fastify.get('/pending-prs', {
    // Disable compression for this endpoint to avoid premature close issues
    compress: false,
  }, getPendingPRs);
  fastify.post('/prs/:prId/approve', approvePR);
  fastify.post('/prs/:prId/reject', rejectPR);
  fastify.post('/prs/:prId/return', returnPR);

  // Budget Exception Approval
  fastify.get('/budget-exceptions', getBudgetExceptions);
  fastify.get('/budget-exceptions/:id', getBudgetExceptionById);
  fastify.post('/budget-exceptions/:id/approve', approveBudgetException);
  fastify.post('/budget-exceptions/:id/reject', rejectBudgetException);
  fastify.post('/budget-exceptions/:id/request-negotiation', requestNegotiation);

  // PR History
  fastify.get('/pr-history', getPRHistory);

  // Branch Overview
  fastify.get('/branch-overview', getBranchOverview);

  // Notifications
  fastify.get('/notifications', getBranchManagerNotifications);
}

