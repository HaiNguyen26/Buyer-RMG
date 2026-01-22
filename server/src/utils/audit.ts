import { prisma } from '../utils/prisma';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditLogData {
  companyId?: string;
  tableName: string;
  recordId: string;
  action: AuditAction;
  userId?: string;
  oldData?: any;
  newData?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(data: AuditLogData) {
  try {
    return await prisma.auditLog.create({
      data: {
        companyId: data.companyId,
        tableName: data.tableName,
        recordId: data.recordId,
        action: data.action,
        userId: data.userId,
        oldData: data.oldData ? JSON.parse(JSON.stringify(data.oldData)) : null,
        newData: data.newData ? JSON.parse(JSON.stringify(data.newData)) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    // Don't throw error if audit log fails - log it instead
    console.error('Failed to create audit log:', error);
    return null;
  }
}

/**
 * Create audit log for CREATE action
 */
export async function auditCreate(
  tableName: string,
  recordId: string,
  newData: any,
  options?: {
    companyId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
) {
  return createAuditLog({
    companyId: options?.companyId,
    tableName,
    recordId,
    action: 'CREATE',
    userId: options?.userId,
    newData,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
  });
}

/**
 * Create audit log for UPDATE action
 */
export async function auditUpdate(
  tableName: string,
  recordId: string,
  oldData: any,
  newData: any,
  options?: {
    companyId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
) {
  return createAuditLog({
    companyId: options?.companyId,
    tableName,
    recordId,
    action: 'UPDATE',
    userId: options?.userId,
    oldData,
    newData,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
  });
}

/**
 * Create audit log for DELETE action (soft delete)
 */
export async function auditDelete(
  tableName: string,
  recordId: string,
  oldData: any,
  options?: {
    companyId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
) {
  return createAuditLog({
    companyId: options?.companyId,
    tableName,
    recordId,
    action: 'DELETE',
    userId: options?.userId,
    oldData,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
  });
}

