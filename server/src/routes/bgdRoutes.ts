import { FastifyInstance } from 'fastify';
import {
  getExecutiveDashboard,
  getBusinessOverview,
  getExceptionApprovals,
  approveException,
  rejectException,
  getStrategicSupplierView,
  getExecutiveReports,
  getCriticalAlerts,
  getGovernancePolicy,
} from '../controllers/bgdController';
import { authenticate } from '../middleware/auth';

export default async function bgdRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/dashboard', { compress: false }, getExecutiveDashboard);
  fastify.get('/business-overview', { compress: false }, getBusinessOverview);

  fastify.get('/exception-approval', { compress: false }, getExceptionApprovals);
  fastify.post('/exception-approval/:id/approve', approveException);
  fastify.post('/exception-approval/:id/reject', rejectException);

  fastify.get('/strategic-suppliers', { compress: false }, getStrategicSupplierView);
  fastify.get('/executive-reports', { compress: false }, getExecutiveReports);
  fastify.get('/critical-alerts', { compress: false }, getCriticalAlerts);
  fastify.get('/governance', { compress: false }, getGovernancePolicy);
}
