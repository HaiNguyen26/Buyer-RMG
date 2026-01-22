import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getRequestorDashboard,
  getMyPRs,
  getNextPRNumber,
  getPRById,
  createPR,
  updatePR,
  submitPR,
  getPRTracking,
  getPRTrackingList,
  getNotifications,
} from '../controllers/requestorController';

export default async function requestorRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // Dashboard
  fastify.get('/dashboard', getRequestorDashboard);

  // PR Management
  fastify.get('/prs', getMyPRs);
  fastify.get('/prs/next-number', getNextPRNumber);
  fastify.get('/prs/:id', getPRById);
  fastify.post('/prs', createPR);
  fastify.put('/prs/:id', updatePR);
  fastify.post('/prs/:id/submit', submitPR);

  // PR Tracking
  fastify.get('/prs/tracking', getPRTrackingList);
  fastify.get('/prs/:id/tracking', getPRTracking);

  // Notifications
  fastify.get('/notifications', getNotifications);
}


