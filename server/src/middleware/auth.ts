import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../utils/jwt';

export interface AuthenticatedRequest extends FastifyRequest {
    user?: {
        userId: string;
        username: string;
        role: string;
    };
}

export const authenticate = async (
    request: AuthenticatedRequest,
    reply: FastifyReply
) => {
    try {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Unauthorized: No token provided' });
        }

        const token = authHeader.substring(7);
        const payload = await verifyToken(token);

        request.user = payload;
    } catch (error) {
        return reply.code(401).send({ error: 'Unauthorized: Invalid token' });
    }
};

