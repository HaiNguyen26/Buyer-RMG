import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getRequestorDashboard,
  getMyPRs,
  getNextPRNumber,
  getPRById,
  getPRAttachmentDownload,
  createPR,
  uploadPRAttachments,
  updatePR,
  resubmitPRItemDepartmentRevision,
  submitPR,
  deletePR,
  getPRTracking,
  getPRProcurementTracking,
  getPRTrackingList,
  getNotifications,
  listCustomerPOs,
  getCustomerPOById,
  listPartCatalog,
  resolvePartCatalogByCodes,
  createPartCatalogEntry,
} from '../controllers/requestorController';
import {
  getNextStockIssueNumber,
  getPartStockAvailability,
  listMyStockIssues,
  getStockIssueById,
  createStockIssue,
  updateDraftStockIssue,
  submitStockIssue,
  cancelStockIssue,
  patchStockIssueItemQty,
} from '../controllers/stockIssueController';

export default async function requestorRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // Dashboard
  fastify.get('/dashboard', { compress: false }, getRequestorDashboard);

  fastify.get('/part-catalog', { compress: false }, listPartCatalog);
  fastify.post('/part-catalog/resolve', resolvePartCatalogByCodes);
  fastify.post('/part-catalog', createPartCatalogEntry);

  // PR Management
  fastify.get('/prs', { compress: false }, getMyPRs);
  fastify.get('/prs/next-number', { compress: false }, getNextPRNumber);
  fastify.get('/prs/tracking', { compress: false }, getPRTrackingList);
  fastify.get('/prs/:id/procurement-tracking', { compress: false }, getPRProcurementTracking);
  fastify.get('/prs/:id/tracking', { compress: false }, getPRTracking);
  fastify.get('/prs/:id', { compress: false }, getPRById);
  fastify.get('/prs/:id/attachments/:attachmentId', { compress: false }, getPRAttachmentDownload);
  fastify.post('/prs', createPR);
  fastify.post('/prs/:id/attachments', uploadPRAttachments);
  fastify.put('/prs/:id', updatePR);
  fastify.post('/prs/:id/items/:itemId/resubmit-revision', resubmitPRItemDepartmentRevision);
  fastify.post('/prs/:id/submit', submitPR);
  fastify.delete('/prs/:id', deletePR);

  // Phiếu xuất kho (tách khỏi PR)
  fastify.get('/stock-issues/next-number', getNextStockIssueNumber);
  fastify.get('/stock-issues/part-stock', getPartStockAvailability);
  fastify.get('/stock-issues', listMyStockIssues);
  fastify.post('/stock-issues', createStockIssue);
  fastify.get('/stock-issues/:id', getStockIssueById);
  fastify.put('/stock-issues/:id', updateDraftStockIssue);
  fastify.post('/stock-issues/:id/submit', submitStockIssue);
  fastify.post('/stock-issues/:id/cancel', cancelStockIssue);
  fastify.patch('/stock-issues/:id/items/:itemId', patchStockIssueItemQty);

  // Customer PO (chỉ xem / chọn có sẵn — không cho requestor tạo mới)
  fastify.get('/customer-pos', listCustomerPOs);
  fastify.get('/customer-pos/:id', getCustomerPOById);

  // Notifications
  fastify.get('/notifications', { compress: false }, getNotifications);
}
