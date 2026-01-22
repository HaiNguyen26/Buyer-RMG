import { Role } from '@prisma/client';
import { prisma } from '../utils/prisma';

/**
 * Permission Resources
 */
export enum PermissionResource {
  PURCHASE_REQUEST = 'purchase_request',
  PURCHASE_ORDER = 'purchase_order',
  SUPPLIER = 'supplier',
  QUOTATION = 'quotation',
  DELIVERY = 'delivery',
  PAYMENT = 'payment',
  USER = 'user',
  REPORT = 'report',
}

/**
 * Permission Actions
 */
export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  REJECT = 'reject',
  EXPORT = 'export',
}

/**
 * Check if user has permission
 */
export async function hasPermission(
  role: Role,
  resource: PermissionResource,
  action: PermissionAction
): Promise<boolean> {
  const permission = await prisma.rolePermission.findFirst({
    where: {
      role,
      permission: {
        resource,
        action,
      },
    },
  });

  return !!permission;
}

/**
 * Get all permissions for a role
 */
export async function getRolePermissions(role: Role): Promise<Array<{
  resource: string;
  action: string;
}>> {
  const rolePermissions = await prisma.rolePermission.findMany({
    where: { role },
    include: { permission: true },
  });

  return rolePermissions.map((rp) => ({
    resource: rp.permission.resource,
    action: rp.permission.action,
  }));
}

/**
 * Check multiple permissions (all must be true)
 */
export async function hasAllPermissions(
  role: Role,
  permissions: Array<{ resource: PermissionResource; action: PermissionAction }>
): Promise<boolean> {
  const checks = await Promise.all(
    permissions.map((p) => hasPermission(role, p.resource, p.action))
  );

  return checks.every((result) => result === true);
}

/**
 * Check multiple permissions (at least one must be true)
 */
export async function hasAnyPermission(
  role: Role,
  permissions: Array<{ resource: PermissionResource; action: PermissionAction }>
): Promise<boolean> {
  const checks = await Promise.all(
    permissions.map((p) => hasPermission(role, p.resource, p.action))
  );

  return checks.some((result) => result === true);
}

/**
 * Initialize default permissions (seed data)
 */
export async function initializePermissions(): Promise<void> {
  // Define default permissions for each role
  const rolePermissions: Record<Role, Array<{ resource: PermissionResource; action: PermissionAction }>> = {
    [Role.REQUESTOR]: [
      { resource: PermissionResource.PURCHASE_REQUEST, action: PermissionAction.CREATE },
      { resource: PermissionResource.PURCHASE_REQUEST, action: PermissionAction.READ },
      { resource: PermissionResource.PURCHASE_REQUEST, action: PermissionAction.UPDATE },
    ],
    [Role.BUYER]: [
      { resource: PermissionResource.PURCHASE_REQUEST, action: PermissionAction.READ },
      { resource: PermissionResource.PURCHASE_REQUEST, action: PermissionAction.UPDATE },
      { resource: PermissionResource.PURCHASE_ORDER, action: PermissionAction.CREATE },
      { resource: PermissionResource.PURCHASE_ORDER, action: PermissionAction.READ },
      { resource: PermissionResource.PURCHASE_ORDER, action: PermissionAction.UPDATE },
      { resource: PermissionResource.SUPPLIER, action: PermissionAction.CREATE },
      { resource: PermissionResource.SUPPLIER, action: PermissionAction.READ },
      { resource: PermissionResource.SUPPLIER, action: PermissionAction.UPDATE },
      { resource: PermissionResource.QUOTATION, action: PermissionAction.READ },
      { resource: PermissionResource.DELIVERY, action: PermissionAction.READ },
      { resource: PermissionResource.DELIVERY, action: PermissionAction.UPDATE },
    ],
    [Role.APPROVER]: [
      { resource: PermissionResource.PURCHASE_REQUEST, action: PermissionAction.READ },
      { resource: PermissionResource.PURCHASE_REQUEST, action: PermissionAction.APPROVE },
      { resource: PermissionResource.PURCHASE_REQUEST, action: PermissionAction.REJECT },
      { resource: PermissionResource.PURCHASE_ORDER, action: PermissionAction.READ },
      { resource: PermissionResource.PURCHASE_ORDER, action: PermissionAction.APPROVE },
      { resource: PermissionResource.PURCHASE_ORDER, action: PermissionAction.REJECT },
    ],
    [Role.ACCOUNTANT]: [
      { resource: PermissionResource.PURCHASE_ORDER, action: PermissionAction.READ },
      { resource: PermissionResource.DELIVERY, action: PermissionAction.READ },
      { resource: PermissionResource.PAYMENT, action: PermissionAction.CREATE },
      { resource: PermissionResource.PAYMENT, action: PermissionAction.READ },
      { resource: PermissionResource.PAYMENT, action: PermissionAction.UPDATE },
      { resource: PermissionResource.REPORT, action: PermissionAction.READ },
      { resource: PermissionResource.REPORT, action: PermissionAction.EXPORT },
    ],
    // SALES role removed - không còn sử dụng
    [Role.BUYER_LEADER]: [
      { resource: PermissionResource.PURCHASE_REQUEST, action: PermissionAction.READ },
      { resource: PermissionResource.PURCHASE_REQUEST, action: PermissionAction.UPDATE },
      { resource: PermissionResource.PURCHASE_REQUEST, action: PermissionAction.APPROVE },
      { resource: PermissionResource.PURCHASE_REQUEST, action: PermissionAction.REJECT },
      { resource: PermissionResource.PURCHASE_ORDER, action: PermissionAction.CREATE },
      { resource: PermissionResource.PURCHASE_ORDER, action: PermissionAction.READ },
      { resource: PermissionResource.PURCHASE_ORDER, action: PermissionAction.UPDATE },
      { resource: PermissionResource.PURCHASE_ORDER, action: PermissionAction.APPROVE },
      { resource: PermissionResource.PURCHASE_ORDER, action: PermissionAction.REJECT },
      { resource: PermissionResource.SUPPLIER, action: PermissionAction.CREATE },
      { resource: PermissionResource.SUPPLIER, action: PermissionAction.READ },
      { resource: PermissionResource.SUPPLIER, action: PermissionAction.UPDATE },
      { resource: PermissionResource.QUOTATION, action: PermissionAction.READ },
      { resource: PermissionResource.DELIVERY, action: PermissionAction.READ },
      { resource: PermissionResource.DELIVERY, action: PermissionAction.UPDATE },
      { resource: PermissionResource.REPORT, action: PermissionAction.READ },
      { resource: PermissionResource.REPORT, action: PermissionAction.EXPORT },
    ],
  };

  // Create permissions and role permissions
  for (const [role, permissions] of Object.entries(rolePermissions)) {
    for (const { resource, action } of permissions) {
      // Create or get permission
      let permission = await prisma.permission.findFirst({
        where: { resource, action },
      });

      if (!permission) {
        permission = await prisma.permission.create({
          data: { resource, action },
        });
      }

      // Create role permission if not exists
      const existing = await prisma.rolePermission.findFirst({
        where: {
          role: role as Role,
          permissionId: permission.id,
        },
      });

      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            role: role as Role,
            permissionId: permission.id,
          },
        });
      }
    }
  }
}

