import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getSalesDashboard,
  getSalesPOs,
  getSalesPOById,
  getNextSalesPONumber,
  createSalesPO,
  updateSalesPO,
  closeSalesPO,
  reopenSalesPO,
  getSalesPODetail,
  getCostOverview,
  exportReports,
} from '../controllers/salesController';

export default async function salesRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // Dashboard
  fastify.get('/dashboard', getSalesDashboard);

  // Sales PO Management
  fastify.get('/sales-pos', getSalesPOs);
  fastify.get('/sales-pos/next-number', getNextSalesPONumber);
  fastify.get('/sales-pos/:id', getSalesPOById);
  fastify.post('/sales-pos', createSalesPO);
  fastify.put('/sales-pos/:id', updateSalesPO);
  fastify.post('/sales-pos/:id/close', closeSalesPO);
  fastify.post('/sales-pos/:id/reopen', reopenSalesPO);

  // Project/Sales PO Detail
  fastify.get('/sales-pos/:id/detail', getSalesPODetail);

  // Cost Overview
  fastify.get('/cost-overview', getCostOverview);

  // Reports
  fastify.get('/reports/export', exportReports);
}



