import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getDepartmentHeadDashboard,
  getPendingPRs,
  approvePR,
  rejectPR,
  returnPR,
  getDepartmentOverview,
} from '../controllers/departmentHeadController';

export default async function departmentHeadRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', authenticate);

  // Dashboard - Disable compression to avoid premature close issues
  fastify.get('/dashboard', {
    compress: false,
  }, getDepartmentHeadDashboard);

  // Department Overview
  fastify.get('/department-overview', getDepartmentOverview);

  // PR Approval
  fastify.get('/pending-prs', {
    // Disable compression for this endpoint to avoid premature close issues
    compress: false,
  }, getPendingPRs);
  fastify.post('/prs/:id/approve', approvePR);
  fastify.post('/prs/:id/reject', rejectPR);
  fastify.post('/prs/:id/return', returnPR);
}


