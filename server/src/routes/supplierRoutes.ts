import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplierController';

export default async function supplierRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', authenticate);

  // Supplier CRUD
  fastify.get('/suppliers', getSuppliers);
  fastify.post('/suppliers', createSupplier);
  fastify.get('/suppliers/:id', getSupplierById);
  fastify.put('/suppliers/:id', updateSupplier);
  fastify.delete('/suppliers/:id', deleteSupplier);
}


