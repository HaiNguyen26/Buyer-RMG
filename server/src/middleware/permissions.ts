import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from './auth';
import { hasPermission, PermissionResource, PermissionAction } from '../utils/permissions';

/**
 * Middleware to check permission
 */
export function requirePermission(resource: PermissionResource, action: PermissionAction) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const hasAccess = await hasPermission(
      request.user.role as any,
      resource,
      action
    );

    if (!hasAccess) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: `You don't have permission to ${action} ${resource}`,
      });
    }
  };
}

/**
 * Middleware to check multiple permissions (all must be true)
 */
export function requireAllPermissions(
  permissions: Array<{ resource: PermissionResource; action: PermissionAction }>
) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { hasAllPermissions } = await import('../utils/permissions');
    const hasAccess = await hasAllPermissions(request.user.role as any, permissions);

    if (!hasAccess) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'You don\'t have required permissions',
      });
    }
  };
}

/**
 * Middleware to check multiple permissions (at least one must be true)
 */
export function requireAnyPermission(
  permissions: Array<{ resource: PermissionResource; action: PermissionAction }>
) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { hasAnyPermission } = await import('../utils/permissions');
    const hasAccess = await hasAnyPermission(request.user.role as any, permissions);

    if (!hasAccess) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'You don\'t have required permissions',
      });
    }
  };
}


