import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client Singleton
 * Ensures only one instance of PrismaClient exists
 */
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: ['query', 'error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

/**
 * Transaction Helper
 * Wraps operations in a database transaction
 */
export async function withTransaction<T>(
    callback: (tx: PrismaClient) => Promise<T>
): Promise<T> {
    return prisma.$transaction(async (tx) => {
        return callback(tx as PrismaClient);
    });
}

/**
 * Soft Delete Helper
 * Sets deletedAt timestamp instead of actually deleting
 */
export async function softDelete<T extends { deletedAt: Date | null }>(
    model: any,
    where: { id: string; companyId?: string }
): Promise<T> {
    return model.update({
        where: {
            id: where.id,
            deletedAt: null, // Only update if not already deleted
            ...(where.companyId && { companyId: where.companyId }),
        },
        data: {
            deletedAt: new Date(),
        },
    });
}

/**
 * Restore Soft Deleted Record
 */
export async function restoreSoftDelete<T extends { deletedAt: Date | null }>(
    model: any,
    where: { id: string; companyId?: string }
): Promise<T> {
    return model.update({
        where: {
            id: where.id,
            deletedAt: { not: null }, // Only restore if deleted
            ...(where.companyId && { companyId: where.companyId }),
        },
        data: {
            deletedAt: null,
        },
    });
}

/**
 * Find Many with Company Filter and Soft Delete Filter
 */
export function findManyWithFilters<T>(
    model: any,
    options: {
        companyId?: string;
        includeDeleted?: boolean;
        where?: any;
        include?: any;
        select?: any;
        orderBy?: any;
        take?: number;
        skip?: number;
    }
) {
    const where: any = {
        ...options.where,
        ...(options.companyId && { companyId: options.companyId }),
        ...(options.includeDeleted ? {} : { deletedAt: null }),
    };

    return model.findMany({
        where,
        include: options.include,
        select: options.select,
        orderBy: options.orderBy,
        take: options.take,
        skip: options.skip,
    });
}

/**
 * Find One with Company Filter and Soft Delete Filter
 */
export function findOneWithFilters<T>(
    model: any,
    options: {
        id: string;
        companyId?: string;
        includeDeleted?: boolean;
        include?: any;
        select?: any;
    }
) {
    const where: any = {
        id: options.id,
        ...(options.companyId && { companyId: options.companyId }),
        ...(options.includeDeleted ? {} : { deletedAt: null }),
    };

    return model.findUnique({
        where,
        include: options.include,
        select: options.select,
    });
}

