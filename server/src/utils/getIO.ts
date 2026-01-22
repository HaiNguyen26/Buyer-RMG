import { Server as SocketIOServer } from 'socket.io';

/**
 * Get Socket.IO instance from global
 */
export function getIO(): SocketIOServer | null {
    return (global as any).io || null;
}

