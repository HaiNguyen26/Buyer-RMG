import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getBuyerDashboard,
  getAssignedPRs,
  getPRDetails,
  downloadBuyerPRAttachment,
  getProjectCostReference,
  getBuyerNotifications,
  getOverBudgetAlerts,
} from '../controllers/buyerController';
import {
  createRFQ,
  getRFQs,
  getRFQById,
  updateRFQ,
  sendRFQ,
  exportRFQ,
  exportRFQExcel,
  importRFQQuotationExcel,
  completeRFQ,
} from '../controllers/rfqController';
import {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  validateQuotation,
  createQuotationForPR,
  uploadQuotationAttachments,
  uploadQuotationAttachmentsByRFQ,
  deleteQuotationAttachment,
} from '../controllers/quotationController';
import {
  getPRsWaitingPO,
  getPRDetailForPO,
  createDraftPOs,
  getPOList,
  getPODetail,
  updatePODraft,
  submitPO,
  getPODashboard,
  markPOSent,
  markPOConfirmed,
  updateSupplierConfirmation,
  requestCancelPO,
  exportBuyerPOExcel,
} from '../controllers/poController';

export default async function buyerRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', authenticate);

  // Buyer Dashboard
  fastify.get('/dashboard', getBuyerDashboard);

  // Assigned PRs
  fastify.get('/assigned-prs', getAssignedPRs);

  // PR attachment download (assigned buyer) — must be before GET /prs/:prId
  fastify.get('/prs/:prId/attachments/:attachmentId', { compress: false }, downloadBuyerPRAttachment);

  // Get PR Details (only assigned items) - Disable compression to avoid premature close issues
  fastify.get('/prs/:prId', {
    compress: false, // Disable compression for this route
  }, getPRDetails);

  // RFQ Management - Disable compression to avoid premature close issues
  fastify.post('/rfqs', createRFQ);
  fastify.get('/rfqs', { compress: false }, getRFQs);
  // More specific routes should be registered before generic ones
  fastify.get('/rfqs/:id/export/excel', exportRFQExcel);
  fastify.post('/rfqs/:id/import/quotation-excel', importRFQQuotationExcel);
  fastify.get('/rfqs/:id/export', exportRFQ);
  fastify.post('/rfqs/:id/send', sendRFQ);
  fastify.post('/rfqs/:id/complete', completeRFQ);
  fastify.get('/rfqs/:id', { compress: false }, getRFQById);
  fastify.put('/rfqs/:id', updateRFQ);

  // Quotation Management
  fastify.post('/quotations', createQuotation);
  fastify.post('/prs/:prId/quotations', createQuotationForPR); // Phase 2: Create quotation for PR (auto-create RFQ)
  // Get Quotations - Disable compression to avoid premature close issues
  fastify.get('/quotations', { compress: false }, getQuotations);
  // Get Quotation by ID - Disable compression to avoid premature close issues
  fastify.get('/quotations/:id', { compress: false }, getQuotationById);
  fastify.put('/quotations/:id', updateQuotation);
  fastify.post('/quotations/:id/validate', validateQuotation);
  
  // Quotation Attachments
  fastify.post('/quotations/:quotationId/attachments', uploadQuotationAttachments);
  fastify.post('/rfqs/:rfqId/quotations/attachments', uploadQuotationAttachmentsByRFQ); // Phase 2: Upload via RFQ ID
  fastify.delete('/quotations/attachments/:attachmentId', deleteQuotationAttachment);

  // Project Cost Reference (View Only)
  fastify.get('/project-cost-reference', getProjectCostReference);

  // Notifications
  fastify.get('/notifications', getBuyerNotifications);

  // Cảnh báo vượt ngân sách (danh sách item vượt baseline) — tắt nén tránh premature close
  fastify.get('/over-budget-alerts', { compress: false }, getOverBudgetAlerts);

  // PO Management (Phase 3) – Buyer tạo PO, submit
  fastify.get('/po/dashboard', getPODashboard);
  fastify.get('/po/prs-waiting', { compress: false }, getPRsWaitingPO);
  fastify.get('/po/prs/:prId/detail', { compress: false }, getPRDetailForPO);
  fastify.post('/po/create-from-pr/:prId', createDraftPOs);
  fastify.get('/po/list', { compress: false }, getPOList);
  fastify.get('/po/export/excel', { compress: false }, exportBuyerPOExcel);
  fastify.post('/po/:poId/mark-sent', markPOSent);
  fastify.post('/po/:poId/mark-confirmed', markPOConfirmed);
  fastify.patch('/po/:poId/supplier-confirmation', updateSupplierConfirmation);
  fastify.post('/po/:poId/request-cancel', requestCancelPO);
  fastify.get('/po/:poId', { compress: false }, getPODetail);
  fastify.patch('/po/:poId', updatePODraft);
  fastify.post('/po/:poId/submit', submitPO);
}

