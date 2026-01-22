import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getExecutiveDashboard,
  getPROverview,
  getSupplierOverview,
  getBuyerPerformance,
  getNotifications,
} from '../controllers/managerController';

export default async function managerRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', authenticate);

  // Executive Dashboard
  fastify.get('/dashboard', getExecutiveDashboard);

  // PR Overview
  fastify.get('/pr-overview', getPROverview);

  // Supplier Overview
  fastify.get('/supplier-overview', getSupplierOverview);

  // Buyer Performance
  fastify.get('/buyer-performance', getBuyerPerformance);

  // Notifications
  fastify.get('/notifications', getNotifications);
}


