import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

/**
 * Initialize Socket.IO connection
 */
export function initSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('Socket.IO connected:', socket?.id);
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.IO connection error:', error);
  });

  return socket;
}

/**
 * Get current socket instance
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Disconnect socket
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Join PR room
 */
export function joinPRRoom(prId: string): void {
  if (socket) {
    socket.emit('join:pr', prId);
  }
}

/**
 * Leave PR room
 */
export function leavePRRoom(prId: string): void {
  if (socket) {
    socket.emit('leave:pr', prId);
  }
}

/**
 * Join PO room
 */
export function joinPORoom(poId: string): void {
  if (socket) {
    socket.emit('join:po', poId);
  }
}

/**
 * Leave PO room
 */
export function leavePORoom(poId: string): void {
  if (socket) {
    socket.emit('leave:po', poId);
  }
}

/**
 * Send chat message
 */
export function sendChatMessage(room: string, message: string, type: 'pr' | 'po'): void {
  if (socket) {
    socket.emit('chat:message', { room, message, type });
  }
}

/**
 * Listen for notifications
 */
export function onNotification(callback: (notification: {
  type: string;
  title: string;
  message: string;
  data?: any;
  timestamp: string;
}) => void): void {
  if (socket) {
    socket.on('notification', callback);
  }
}

/**
 * Listen for badge updates
 */
export function onBadgeUpdate(callback: (badges: {
  pr?: number;
  po?: number;
  delivery?: number;
  payment?: number;
}) => void): void {
  if (socket) {
    socket.on('badge:update', callback);
  }
}

/**
 * Listen for chat messages
 */
export function onChatMessage(callback: (data: {
  userId: string;
  username: string;
  message: string;
  timestamp: string;
}) => void): void {
  if (socket) {
    socket.on('chat:message', callback);
  }
}

/**
 * Remove all listeners
 */
export function removeAllListeners(): void {
  if (socket) {
    socket.removeAllListeners();
  }
}


