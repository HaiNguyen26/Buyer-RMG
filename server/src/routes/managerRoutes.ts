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
  fastify.addHook('onRequest', authenticate);

  fastify.get('/dashboard', { compress: false }, getExecutiveDashboard);
  fastify.get('/pr-overview', { compress: false }, getPROverview);
  fastify.get('/supplier-overview', { compress: false }, getSupplierOverview);
  fastify.get('/buyer-performance', { compress: false }, getBuyerPerformance);
  fastify.get('/notifications', { compress: false }, getNotifications);
}
