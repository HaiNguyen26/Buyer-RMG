import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customerController';

export default async function customerRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  fastify.get('/customers', getCustomers);
  fastify.get('/customers/:id', getCustomerById);
  fastify.post('/customers', createCustomer);
  fastify.put('/customers/:id', updateCustomer);
  fastify.delete('/customers/:id', deleteCustomer);
}




