import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from '../controllers/notificationController';

export default async function notificationRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', authenticate);

  // Disable compression for notification routes to avoid premature close issues
  // Hook must run early to prevent compression middleware from processing
  fastify.addHook('onRequest', async (request, reply) => {
    // Disable compression by removing Accept-Encoding header
    delete request.headers['accept-encoding'];
    // Set header to prevent compression
    reply.header('Content-Encoding', 'identity');
  });

  fastify.addHook('onSend', async (request, reply, payload) => {
    // Ensure compression is disabled
    reply.header('Content-Encoding', 'identity');
    reply.removeHeader('content-encoding');
    const url = request.url || request.routerPath || '';
    if (url.includes('/notifications')) {
      console.log('📬 Disabled compression for notification endpoint:', url);
    }
    return payload;
  });

  // Get notifications - register with compress disabled
  fastify.get('/', {
    compress: false, // Disable compression for this route
  }, getNotifications);

  // Get unread count
  fastify.get('/unread-count', getUnreadCount);

  // Mark notification as read
  fastify.post('/:id/read', markAsRead);

  // Mark all as read
  fastify.post('/mark-all-read', markAllAsRead);
}


