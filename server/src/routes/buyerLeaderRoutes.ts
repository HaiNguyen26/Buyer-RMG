import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getPendingAssignments,
  assignPR,
  getAssignments,
  compareQuotations,
  getRecommendations,
  getPRForSupplierSelection,
  selectSupplier,
  getOverBudgetPRs,
  getBuyers,
  getPRDetails,
} from '../controllers/buyerLeaderController';

export default async function buyerLeaderRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', authenticate);

  // PR Assignment
  fastify.get('/pending-assignments', getPendingAssignments);
  fastify.post('/prs/:prId/assign', assignPR);
  fastify.get('/assignments', getAssignments);
  fastify.get('/buyers', getBuyers);
  fastify.get('/prs/:prId', getPRDetails);
  
  // Over-Budget PRs
  fastify.get('/over-budget-prs', getOverBudgetPRs);

  // Quotation Comparison & Selection
  fastify.get('/rfqs/:rfqId/compare', compareQuotations);
  fastify.get('/rfqs/:rfqId/recommendations', getRecommendations);
  fastify.get('/prs/:prId/select-supplier', getPRForSupplierSelection);
  fastify.post('/supplier-selections', selectSupplier);
}


