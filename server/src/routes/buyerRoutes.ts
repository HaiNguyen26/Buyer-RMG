import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getBuyerDashboard,
  getAssignedPRs,
  getPRDetails,
  getProjectCostReference,
  getBuyerNotifications,
} from '../controllers/buyerController';
import {
  createRFQ,
  getRFQs,
  getRFQById,
  updateRFQ,
  sendRFQ,
} from '../controllers/rfqController';
import {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  validateQuotation,
} from '../controllers/quotationController';

export default async function buyerRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', authenticate);

  // Buyer Dashboard
  fastify.get('/dashboard', getBuyerDashboard);

  // Assigned PRs
  fastify.get('/assigned-prs', getAssignedPRs);
  
  // Get PR Details (only assigned items)
  fastify.get('/prs/:prId', getPRDetails);

  // RFQ Management
  fastify.post('/rfqs', createRFQ);
  fastify.get('/rfqs', getRFQs);
  fastify.get('/rfqs/:id', getRFQById);
  fastify.put('/rfqs/:id', updateRFQ);
  fastify.post('/rfqs/:id/send', sendRFQ);

  // Quotation Management
  fastify.post('/quotations', createQuotation);
  fastify.get('/quotations', getQuotations);
  fastify.get('/quotations/:id', getQuotationById);
  fastify.put('/quotations/:id', updateQuotation);
  fastify.post('/quotations/:id/validate', validateQuotation);

  // Project Cost Reference (View Only)
  fastify.get('/project-cost-reference', getProjectCostReference);

  // Notifications
  fastify.get('/notifications', getBuyerNotifications);
}

