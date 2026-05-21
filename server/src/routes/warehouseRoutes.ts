import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getWarehouseDashboard,
  listInventory,
  listInventoryReservationDetails,
  lookupPart,
  validateInventory,
  saveInventory,
  downloadTemplate,
  importPreview,
} from '../controllers/warehouseController';
import {
  listWarehouseStockIssues,
  getStockIssueById,
  approveStockIssue,
  rejectStockIssue,
  shipStockIssue,
  getPartStockAvailability,
} from '../controllers/stockIssueController';
import {
  listIncomingPurchaseOrders,
  getPurchaseOrderForGrn,
  getIncomingPoView,
  submitGoodsReceipt,
  listGrnHistory,
  getGrnHistoryDetail,
} from '../controllers/grnController';

export default async function warehouseRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/dashboard', getWarehouseDashboard);
  fastify.get('/inventory', listInventory);
  fastify.get('/inventory/reservations', listInventoryReservationDetails);
  fastify.get('/parts/lookup', lookupPart);
  fastify.post('/inventory/validate', validateInventory);
  fastify.post('/inventory/save', saveInventory);
  fastify.get('/inventory/template', downloadTemplate);
  fastify.post('/import/preview', importPreview);

  fastify.get('/stock-issues/inbox', listWarehouseStockIssues);
  fastify.get('/stock-issues/part-stock', getPartStockAvailability);
  fastify.get('/stock-issues/:id', getStockIssueById);
  fastify.post('/stock-issues/:id/approve', approveStockIssue);
  fastify.post('/stock-issues/:id/reject', rejectStockIssue);
  fastify.post('/stock-issues/:id/ship', shipStockIssue);

  fastify.get('/incoming/pos', listIncomingPurchaseOrders);
  fastify.get('/incoming/pos/:poId/view', getIncomingPoView);
  fastify.get('/incoming/pos/:poId', getPurchaseOrderForGrn);
  fastify.post('/incoming/pos/:poId/grn', submitGoodsReceipt);

  fastify.get('/grn-history', listGrnHistory);
  fastify.get('/grn-history/:id', getGrnHistoryDetail);
}
