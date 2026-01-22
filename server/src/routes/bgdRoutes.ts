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

export default async function bgdRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // Dashboard
  fastify.get('/dashboard', getExecutiveDashboard);

  // Business Overview
  fastify.get('/business-overview', getBusinessOverview);

  // Exception Approval
  fastify.get('/exception-approval', getExceptionApprovals);
  fastify.post('/exception-approval/:id/approve', approveException);
  fastify.post('/exception-approval/:id/reject', rejectException);

  // Strategic Supplier View
  fastify.get('/strategic-suppliers', getStrategicSupplierView);

  // Executive Reports
  fastify.get('/executive-reports', getExecutiveReports);

  // Critical Alerts
  fastify.get('/critical-alerts', getCriticalAlerts);

  // Governance & Policy
  fastify.get('/governance', getGovernancePolicy);
}


