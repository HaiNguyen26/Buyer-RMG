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
import {
  getProcurementMonitoring,
  getProcurementMonitoringExport,
  getProcurementMonitoringPrDetail,
} from '../controllers/procurementMonitoringController';

export default async function branchManagerRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/dashboard', { compress: false }, getBranchManagerDashboard);

  fastify.get('/pending-prs', { compress: false }, getPendingPRs);
  fastify.post('/prs/:prId/approve', approvePR);
  fastify.post('/prs/:prId/reject', rejectPR);
  fastify.post('/prs/:prId/return', returnPR);

  fastify.get('/budget-exceptions', { compress: false }, getBudgetExceptions);
  fastify.get('/budget-exceptions/:id', { compress: false }, getBudgetExceptionById);
  fastify.post('/budget-exceptions/:id/approve', approveBudgetException);
  fastify.post('/budget-exceptions/:id/reject', rejectBudgetException);
  fastify.post('/budget-exceptions/:id/request-negotiation', requestNegotiation);

  fastify.get('/pr-history', { compress: false }, getPRHistory);
  fastify.get('/branch-overview', { compress: false }, getBranchOverview);
  fastify.get('/notifications', { compress: false }, getBranchManagerNotifications);
  fastify.get('/procurement-monitor', { compress: false }, getProcurementMonitoring);
  fastify.get('/procurement-monitor/export', { compress: false }, getProcurementMonitoringExport);
  fastify.get('/procurement-monitor/:prId', { compress: false }, getProcurementMonitoringPrDetail);
}
