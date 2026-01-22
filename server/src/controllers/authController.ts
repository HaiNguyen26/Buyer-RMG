import { FastifyReply } from 'fastify';
import { prisma, findOneWithFilters, withTransaction } from '../config/database';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { RegisterInput, LoginInput, AuthResponse } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';
import { registerSchema, loginSchema } from '../utils/validation';
import { auditCreate } from '../utils/audit';

export const register = async (
    request: AuthenticatedRequest,
    reply: FastifyReply
) => {
    try {
        // Validate input
        const validation = registerSchema.safeParse(request.body);
        if (!validation.success) {
            return reply.code(400).send({
                error: 'Validation error',
                details: validation.error.errors,
            });
        }

        const body = validation.data;
        const { username, email, password, role = 'REQUESTOR', location } = body;

        // Check if user already exists (with soft delete filter)
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ username }, { email }],
                deletedAt: null, // Only check non-deleted users
            },
        });

        if (existingUser) {
            return reply.code(400).send({
                error: 'User already exists',
            });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Create user with transaction and audit log
        const user = await withTransaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    username,
                    email,
                    passwordHash,
                    role: role as any,
                    location,
                    companyId: null, // TODO: Get from request context when multi-tenant is implemented
                },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true,
                    location: true,
                    companyId: true,
                },
            });

            // Create audit log
            await auditCreate(
                'users',
                newUser.id,
                { username, email, role, location },
                {
                    userId: newUser.id, // Self-registration
                    companyId: newUser.companyId || undefined,
                }
            );

            return newUser;
        });

        // Generate token
        const token = await signToken({
            userId: user.id,
            username: user.username,
            role: user.role,
        });

        const response: AuthResponse = {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                location: user.location,
            },
            token,
        };

        reply.code(201).send(response);
    } catch (error: any) {
        console.error('Register error:', error);
        reply.code(500).send({
            error: 'Internal server error',
            message: error.message,
        });
    }
};

export const login = async (
    request: AuthenticatedRequest,
    reply: FastifyReply
) => {
    try {
        // Validate input
        const validation = loginSchema.safeParse(request.body);
        if (!validation.success) {
            return reply.code(400).send({
                error: 'Validation error',
                details: validation.error.errors,
            });
        }

        const body = validation.data;
        const { username, password } = body;

        console.log('🔐 ========== LOGIN ATTEMPT ==========');
        console.log('🔐 Username:', username);
        console.log('🔐 Password length:', password?.length || 0);

        // Find user (exclude soft-deleted users)
        const user = await prisma.user.findFirst({
            where: {
                username,
                deletedAt: null, // Exclude soft-deleted users
            },
        });

        if (!user) {
            console.log('❌ User not found or deleted');
            console.log('🔐 =================================');
            return reply.code(401).send({
                error: 'Invalid credentials',
            });
        }

        console.log('✅ User found:', {
            id: user.id,
            username: user.username,
            role: user.role,
            hasPasswordHash: !!user.passwordHash,
            passwordHashLength: user.passwordHash?.length || 0,
            deletedAt: user.deletedAt,
        });

        // Verify password
        const isValidPassword = await verifyPassword(user.passwordHash, password);

        if (!isValidPassword) {
            console.log('❌ Password verification failed');
            console.log('🔐 =================================');
            return reply.code(401).send({
                error: 'Invalid credentials',
            });
        }

        console.log('✅ Password verified successfully');
        console.log('🔐 =================================');

        // Generate token
        const token = await signToken({
            userId: user.id,
            username: user.username,
            role: user.role,
        });

        const response: AuthResponse = {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                location: user.location,
            },
            token,
        };

        reply.send(response);
    } catch (error: any) {
        console.error('Login error:', error);
        reply.code(500).send({
            error: 'Internal server error',
            message: error.message,
        });
    }
};

export const getCurrentUser = async (
    request: AuthenticatedRequest,
    reply: FastifyReply
) => {
    try {
        if (!request.user) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const user = await findOneWithFilters(prisma.user, {
            id: request.user.userId,
            includeDeleted: false,
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                location: true,
            },
        });

        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }

        reply.send({ user });
    } catch (error: any) {
        console.error('Get current user error:', error);
        reply.code(500).send({
            error: 'Internal server error',
            message: error.message,
        });
    }
};

