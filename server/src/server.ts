import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import compress from '@fastify/compress';
import dotenv from 'dotenv';
import { Server as HTTPServer } from 'http';
import authRoutes from './routes/authRoutes';
import { initializeSocket } from './config/socket';
import { initSentry } from './config/sentry';

dotenv.config();

// Initialize Sentry
initSentry();

const fastify = Fastify({
    logger: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    disableRequestLogging: process.env.NODE_ENV === 'production',
    bodyLimit: 10 * 1024 * 1024, // 10MB for request body
    requestTimeout: 30000, // 30 seconds
});

// Initialize Socket.IO after server is ready
let io: ReturnType<typeof initializeSocket> | null = null;

// Make io available globally (will be updated when Socket.IO is initialized)
(global as any).io = null;

// Register CORS
fastify.register(cors, {
    origin: true,
    credentials: true
});

// Register compression with threshold to avoid premature close on small responses
fastify.register(compress, {
    global: true,
    encodings: ['gzip', 'deflate'],
    threshold: 1024, // Only compress responses larger than 1KB
    zlibOptions: {
        level: 6, // Moderate compression level
    },
});

// Register multipart for file uploads
fastify.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});

// Health check route
fastify.get('/health', async (request, reply) => {
    return { status: 'ok', message: 'Server is running', socket: 'enabled' };
});

// Register routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(import('./routes/salesRoutes'), { prefix: '/api/sales' });
fastify.register(import('./routes/customerRoutes'), { prefix: '/api' });
fastify.register(import('./routes/requestorRoutes'), { prefix: '/api/requestor' });
fastify.register(import('./routes/managerRoutes'), { prefix: '/api/manager' });
fastify.register(import('./routes/buyerRoutes'), { prefix: '/api/buyer' });
fastify.register(import('./routes/buyerLeaderRoutes'), { prefix: '/api/buyer-leader' });
fastify.register(import('./routes/branchManagerRoutes'), { prefix: '/api/branch-manager' });
fastify.register(import('./routes/departmentHeadRoutes'), { prefix: '/api/department-head' });
fastify.register(import('./routes/buyerManagerRoutes'), { prefix: '/api/buyer-manager' });
fastify.register(import('./routes/bgdRoutes'), { prefix: '/api/bgd' });
fastify.register(import('./routes/supplierRoutes'), { prefix: '/api' });
fastify.register(import('./routes/notificationRoutes'), { prefix: '/api/notifications' });
fastify.register(import('./routes/systemAdminRoutes'), { prefix: '/api/system-admin' });
fastify.register(import('./routes/organizationRoutes'), { prefix: '/api/organization' });

// Start server
const start = async () => {
    try {
        const port = process.env.PORT || 5000;
        await fastify.listen({ port: Number(port), host: '0.0.0.0' });
        
        // Initialize Socket.IO after Fastify server is ready
        const httpServer = fastify.server as HTTPServer;
        io = initializeSocket(httpServer);
        (global as any).io = io;
        
        console.log(`✅ Server is running on port ${port}`);
        console.log(`✅ Socket.IO is enabled on /socket.io`);
        console.log(`✅ Socket.IO instance stored in global:`, io ? 'Available' : 'NULL');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();

