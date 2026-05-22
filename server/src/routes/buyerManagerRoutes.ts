import { FastifyInstance } from 'fastify';
import {
  getBuyerManagerDashboard,
  getTeamManagement,
  getCostAnalysis,
  getSupplierPerformance,
  getStrategicReports,
  getPolicyGuidelines,
  getAlertsRisks,
} from '../controllers/buyerManagerController';
import {
  getPOsPendingApproval,
  getPODetailForApproval,
  approvePO,
  rejectPO,
} from '../controllers/buyerLeaderController';
import { authenticate } from '../middleware/auth';
import { requireBuyerManagerPortal } from '../middleware/requireBuyerManagerPortal';
import {
  getProcurementMonitoring,
  getProcurementMonitoringExport,
  getProcurementMonitoringPrDetail,
} from '../controllers/procurementMonitoringController';

export default async function buyerManagerRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/dashboard', { compress: false }, getBuyerManagerDashboard);
  fastify.get('/team-management', { compress: false }, getTeamManagement);
  fastify.get('/cost-analysis', { compress: false }, getCostAnalysis);
  fastify.get('/supplier-performance', { compress: false }, getSupplierPerformance);
  fastify.get('/strategic-reports', { compress: false }, getStrategicReports);
  fastify.get('/policy-guidelines', { compress: false }, getPolicyGuidelines);
  fastify.get('/alerts-risks', { compress: false }, getAlertsRisks);
  fastify.get('/procurement-monitor', { compress: false }, getProcurementMonitoring);
  fastify.get('/procurement-monitor/export', { compress: false }, getProcurementMonitoringExport);
  fastify.get('/procurement-monitor/:prId', { compress: false }, getProcurementMonitoringPrDetail);

  // PO duyệt — Trưởng phòng Mua hàng (BUYER_MANAGER)
  fastify.get(
    '/po/pending-approval',
    { compress: false, preHandler: requireBuyerManagerPortal },
    getPOsPendingApproval
  );
  fastify.get(
    '/po/:poId/review',
    { compress: false, preHandler: requireBuyerManagerPortal },
    getPODetailForApproval
  );
  fastify.post('/po/:poId/approve', { preHandler: requireBuyerManagerPortal }, approvePO);
  fastify.post('/po/:poId/reject', { preHandler: requireBuyerManagerPortal }, rejectPO);
}
