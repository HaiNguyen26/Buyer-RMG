import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  bulkImportSuppliers,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplierController';

export default async function supplierRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', authenticate);

  // Supplier CRUD - tắt nén để tránh premature close khi trả danh sách NCC
  fastify.get('/suppliers', { compress: false }, getSuppliers);
  fastify.post('/suppliers', createSupplier);
  fastify.post('/suppliers/bulk-import', bulkImportSuppliers);
  fastify.get('/suppliers/:id', getSupplierById);
  fastify.put('/suppliers/:id', updateSupplier);
  fastify.delete('/suppliers/:id', deleteSupplier);
}


