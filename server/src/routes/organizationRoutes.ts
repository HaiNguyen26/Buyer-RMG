import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getOrganizationHierarchy,
  getBranchDirectors,
  getEmployeeManager,
  getEmployeeSubordinates,
} from '../controllers/organizationController';

export default async function organizationRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', authenticate);

  // Organization Management
  // Disable compression to prevent "premature close" errors
  fastify.get('/hierarchy', { compress: false }, getOrganizationHierarchy);
  fastify.get('/branch-directors', { compress: false }, getBranchDirectors);
  fastify.get('/employee/:employeeCode/manager', { compress: false }, getEmployeeManager);
  fastify.get('/employee/:employeeCode/subordinates', { compress: false }, getEmployeeSubordinates);
}

