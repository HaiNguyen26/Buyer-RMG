import { FastifyInstance } from 'fastify';
import { register, login, getCurrentUser } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

export default async function authRoutes(fastify: FastifyInstance) {
    // Register
    fastify.post('/register', register);

    // Login
    fastify.post('/login', login);

    // Get current user (protected)
    fastify.get('/me', {
        preHandler: authenticate,
    }, getCurrentUser);
}

