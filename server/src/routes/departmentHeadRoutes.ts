import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getDepartmentHeadDashboard,
  getPendingPRs,
  approvePR,
  rejectPR,
  returnPR,
  getDepartmentOverview,
} from '../controllers/departmentHeadController';
import {
  getProcurementMonitoring,
  getProcurementMonitoringExport,
  getProcurementMonitoringPrDetail,
} from '../controllers/procurementMonitoringController';

export default async function departmentHeadRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/dashboard', { compress: false }, getDepartmentHeadDashboard);
  fastify.get('/department-overview', { compress: false }, getDepartmentOverview);

  fastify.get('/pending-prs', { compress: false }, getPendingPRs);
  fastify.post('/prs/:id/approve', approvePR);
  fastify.post('/prs/:id/reject', rejectPR);
  fastify.post('/prs/:id/return', returnPR);
  fastify.get('/procurement-monitor', { compress: false }, getProcurementMonitoring);
  fastify.get('/procurement-monitor/export', { compress: false }, getProcurementMonitoringExport);
  fastify.get('/procurement-monitor/:prId', { compress: false }, getProcurementMonitoringPrDetail);
}
