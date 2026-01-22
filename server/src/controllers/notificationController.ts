import { FastifyReply } from 'fastify';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';
import { markNotificationAsRead, markNotificationAsResolved } from '../utils/notifications';

/**
 * Get notifications for current user
 */
export const getNotifications = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { status, limit = 50 } = request.query as { status?: string; limit?: string };

    console.log('📬 ========== GET NOTIFICATIONS ==========');
    console.log('📬 User ID:', userId);
    console.log('📬 Query params:', { status, limit });

    const where: any = {
      userId: userId,
      deletedAt: null,
    };

    // Don't filter by status by default - return all notifications
    // Only filter if explicitly requested
    if (status && status !== 'all' && status !== '') {
      where.status = status.toUpperCase();
      console.log('📬 Filtering by status:', status.toUpperCase());
    } else {
      console.log('📬 No status filter - returning all notifications');
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: parseInt(limit) || 50,
    });

    console.log('📬 Found notifications:', notifications.length);
    console.log('📬 Notifications:', notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      status: n.status,
      createdAt: n.createdAt,
    })));

    // Map notifications to response format
    const mappedNotifications = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      status: n.status,
      relatedId: n.relatedId,
      relatedType: n.relatedType,
      metadata: n.metadata,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString(),
    }));

    console.log('📬 Mapped notifications count:', mappedNotifications.length);
    console.log('📬 =======================================');

    // Send response with proper error handling
    try {
      const responseData = {
        notifications: mappedNotifications,
      };
      
      console.log('📬 Sending response with', mappedNotifications.length, 'notifications');
      console.log('📬 Response data structure:', {
        hasNotifications: !!responseData.notifications,
        notificationsType: Array.isArray(responseData.notifications) ? 'array' : typeof responseData.notifications,
        notificationsLength: responseData.notifications?.length,
      });
      
      // Serialize response data to JSON string to ensure proper encoding
      const jsonString = JSON.stringify(responseData);
      console.log('📬 JSON string length:', jsonString.length);
      console.log('📬 JSON string preview (first 200 chars):', jsonString.substring(0, 200));
      
      // Force disable compression for this response
      // Remove Accept-Encoding from request to prevent compression
      if (request.headers['accept-encoding']) {
        delete request.headers['accept-encoding'];
      }
      
      // Set headers to prevent compression
      reply.header('Content-Encoding', 'identity');
      reply.removeHeader('content-encoding');
      reply.header('Content-Type', 'application/json; charset=utf-8');
      reply.header('Content-Length', String(jsonString.length));
      
      // Use reply.send() which Fastify will handle properly
      // Send as serialized JSON string to ensure it's not compressed
      reply.code(200).type('application/json').send(responseData);
      
      console.log('✅ Response sent successfully with Content-Length:', jsonString.length);
    } catch (error: any) {
      console.error('❌ Error sending response:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      
      // Try to send error response
      try {
        reply.code(500).send({
          error: 'Failed to send notifications',
          message: error.message,
        });
      } catch (sendError) {
        console.error('❌ Failed to send error response:', sendError);
      }
      
      throw error;
    }
  } catch (error: any) {
    console.error('Get notifications error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const count = await prisma.notification.count({
      where: {
        userId: userId,
        status: 'UNREAD',
        deletedAt: null,
      },
    });

    reply.send({ count });
  } catch (error: any) {
    console.error('Get unread count error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const success = await markNotificationAsRead(id, userId);
    if (!success) {
      return reply.code(404).send({ error: 'Notification not found' });
    }

    reply.send({ message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('Mark as read error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    await prisma.notification.updateMany({
      where: {
        userId: userId,
        status: 'UNREAD',
        deletedAt: null,
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });

    reply.send({ message: 'All notifications marked as read' });
  } catch (error: any) {
    console.error('Mark all as read error:', error);
    reply.code(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
};


