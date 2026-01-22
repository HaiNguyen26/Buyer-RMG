import { z } from 'zod';

export const registerSchema = z.object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['REQUESTOR', 'BUYER', 'APPROVER', 'ACCOUNTANT']).optional(),
    location: z.string().optional(),
});

export const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});

