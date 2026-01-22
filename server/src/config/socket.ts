import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyToken } from '../utils/jwt';

export interface SocketUser {
  userId: string;
  username: string;
  role: string;
}

/**
 * Initialize Socket.IO server
 */
export function initializeSocket(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io',
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const payload = await verifyToken(token);
      socket.data.user = {
        userId: payload.userId,
        username: payload.username,
        role: payload.role,
      } as SocketUser;

      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const user = socket.data.user as SocketUser;
    console.log(`✅ User connected: ${user.username} (${user.userId})`);
    console.log(`✅ Socket ID: ${socket.id}`);

    // Join user to their personal room
    socket.join(`user:${user.userId}`);
    console.log(`✅ User ${user.username} joined room: user:${user.userId}`);

    // Join user to role-based room
    socket.join(`role:${user.role}`);
    console.log(`✅ User ${user.username} joined room: role:${user.role}`);

    // Handle PR/PO chat rooms
    socket.on('join:pr', (prId: string) => {
      socket.join(`pr:${prId}`);
      console.log(`User ${user.username} joined PR room: ${prId}`);
    });

    socket.on('leave:pr', (prId: string) => {
      socket.leave(`pr:${prId}`);
      console.log(`User ${user.username} left PR room: ${prId}`);
    });

    socket.on('join:po', (poId: string) => {
      socket.join(`po:${poId}`);
      console.log(`User ${user.username} joined PO room: ${poId}`);
    });

    socket.on('leave:po', (poId: string) => {
      socket.leave(`po:${poId}`);
      console.log(`User ${user.username} left PO room: ${poId}`);
    });

    // Handle chat messages
    socket.on('chat:message', (data: { room: string; message: string; type: 'pr' | 'po' }) => {
      const room = `${data.type}:${data.room}`;
      socket.to(room).emit('chat:message', {
        userId: user.userId,
        username: user.username,
        message: data.message,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${user.username} (${user.userId})`);
    });
  });

  return io;
}

/**
 * Emit notification to specific user
 */
export async function emitNotification(io: SocketIOServer, userId: string, notification: {
  type: string;
  title: string;
  message: string;
  data?: any;
}) {
  const room = `user:${userId}`;
  console.log('📡 ========== EMIT NOTIFICATION ==========');
  console.log('📡 Room:', room);
  console.log('📡 User ID:', userId);
  console.log('📡 Notification data:', JSON.stringify(notification, null, 2));
  
  // Check if user is connected BEFORE emitting
  try {
    const sockets = await io.in(room).fetchSockets();
    console.log('📡 Connected sockets in room:', sockets.length);
    if (sockets.length === 0) {
      console.warn('⚠️ WARNING: No connected sockets found for user:', userId);
      console.warn('⚠️ User may not be connected or not joined the room');
    } else {
      sockets.forEach((s, idx) => {
        console.log(`📡 Socket ${idx + 1}:`, s.id, 'User:', (s.data.user as SocketUser)?.username);
      });
    }
  } catch (error) {
    console.error('❌ Error checking sockets:', error);
  }
  
  // Emit notification
  io.to(room).emit('notification', {
    ...notification,
    timestamp: new Date().toISOString(),
  });
  
  console.log('✅ Notification emitted to room:', room);
  console.log('📡 ========================================');
}

/**
 * Emit notification to role-based room
 */
export function emitNotificationToRole(io: SocketIOServer, role: string, notification: {
  type: string;
  title: string;
  message: string;
  data?: any;
}) {
  io.to(`role:${role}`).emit('notification', {
    ...notification,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit badge update to user
 */
export function emitBadgeUpdate(io: SocketIOServer, userId: string, badges: {
  pr?: number;
  po?: number;
  delivery?: number;
  payment?: number;
}) {
  io.to(`user:${userId}`).emit('badge:update', badges);
}


