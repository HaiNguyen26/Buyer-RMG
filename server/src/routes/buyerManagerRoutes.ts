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
import { authenticate } from '../middleware/auth';

export default async function buyerManagerRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('onRequest', authenticate);

  // Dashboard
  fastify.get('/dashboard', getBuyerManagerDashboard);

  // Team Management
  fastify.get('/team-management', getTeamManagement);

  // Cost & Lead-time Analysis
  fastify.get('/cost-analysis', getCostAnalysis);

  // Supplier Performance
  fastify.get('/supplier-performance', getSupplierPerformance);

  // Strategic Reports
  fastify.get('/strategic-reports', getStrategicReports);

  // Policy & Guidelines
  fastify.get('/policy-guidelines', getPolicyGuidelines);

  // Alerts & Risks
  fastify.get('/alerts-risks', getAlertsRisks);
}


