import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getPendingAssignments,
  assignPR,
  getAssignments,
  getPRTrackingList,
  getPRTrackingDetail,
  compareQuotations,
  getRecommendations,
  getPRForSupplierSelection,
  selectSupplier,
  getOverBudgetPRs,
  getBuyers,
  getPRDetails,
  getRFQMonitoring,
  getRFQsForComparison,
  getPRRFQs,
  remindBuyerRFQ,
  escalateRFQ,
  optimizeAwardStrategy,
  approveAwardDecision,
} from '../controllers/buyerLeaderController';

export default async function buyerLeaderRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', authenticate);

  // PR Assignment - Disable compression to avoid premature close issues
  fastify.get('/pending-assignments', { compress: false }, getPendingAssignments);
  fastify.post('/prs/:prId/assign', assignPR);
  fastify.get('/assignments', { compress: false }, getAssignments);
  fastify.get('/pr-tracking', { compress: false }, getPRTrackingList);
  fastify.get('/pr-tracking/:prId', { compress: false }, getPRTrackingDetail);
  fastify.get('/buyers', { compress: false }, getBuyers);
  fastify.get('/prs/:prId', { compress: false }, getPRDetails);
  fastify.get('/prs/:prId/rfqs', { compress: false }, getPRRFQs);
  
  // Over-Budget PRs
  fastify.get('/over-budget-prs', { compress: false }, getOverBudgetPRs);

  // RFQ Monitoring - Disable compression to avoid premature close issues
  fastify.get('/rfq-monitoring', { compress: false }, getRFQMonitoring);
  fastify.post('/rfqs/:rfqId/remind', remindBuyerRFQ);
  fastify.post('/rfqs/:rfqId/escalate', escalateRFQ);

  // RFQs for comparison dropdown (rich data) — must be registered before /:rfqId routes
  fastify.get('/rfqs/for-comparison', { compress: false }, getRFQsForComparison);

  // Quotation Comparison & Selection
  // Disable compression to avoid premature close issues with large responses
  fastify.get('/rfqs/:rfqId/compare', { compress: false }, compareQuotations);
  fastify.post('/rfqs/:rfqId/award/optimize', optimizeAwardStrategy);
  fastify.post('/rfqs/:rfqId/award/approve', approveAwardDecision);
  fastify.get('/rfqs/:rfqId/recommendations', getRecommendations);
  fastify.get('/prs/:prId/select-supplier', getPRForSupplierSelection);
  fastify.post('/supplier-selections', selectSupplier);
}


