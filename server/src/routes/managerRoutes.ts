import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getExecutiveDashboard,
  getPROverview,
  getSupplierOverview,
  getBuyerPerformance,
  getNotifications,
} from '../controllers/managerController';
import {
  getProcurementMonitoring,
  getProcurementMonitoringExport,
  getProcurementMonitoringPrDetail,
} from '../controllers/procurementMonitoringController';

export default async function managerRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/dashboard', { compress: false }, getExecutiveDashboard);
  fastify.get('/pr-overview', { compress: false }, getPROverview);
  fastify.get('/supplier-overview', { compress: false }, getSupplierOverview);
  fastify.get('/buyer-performance', { compress: false }, getBuyerPerformance);
  fastify.get('/notifications', { compress: false }, getNotifications);
  fastify.get('/procurement-monitor', { compress: false }, getProcurementMonitoring);
  fastify.get('/procurement-monitor/export', { compress: false }, getProcurementMonitoringExport);
  fastify.get('/procurement-monitor/:prId', { compress: false }, getProcurementMonitoringPrDetail);
}
