import { FastifyReply } from 'fastify';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  buildProcurementMonitoringSnapshot,
  buildProcurementMonitorPrDetail,
  resolveProcurementMonitorScope,
  type MonitorExportLifecycle,
} from '../utils/procurementMonitoring';
import {
  buildProcurementMonitorExcelBuffer,
  excelContentDisposition,
} from '../utils/procurementMonitorExcelExport';

const ALLOWED_ROLES = new Set([
  'BUYER_MANAGER',
  'SYSTEM_ADMIN',
  'BRANCH_MANAGER',
  'DEPARTMENT_HEAD',
  'MANAGER',
]);

function assertMonitorAccess(request: AuthenticatedRequest, reply: FastifyReply): boolean {
  const role = request.user?.role;
  if (!role || !ALLOWED_ROLES.has(role)) {
    reply.code(403).send({
      error: 'Forbidden',
      message: 'Không có quyền xem giám sát procurement',
    });
    return false;
  }
  return true;
}

/** GET /procurement-monitor — Operational monitoring snapshot */
export const getProcurementMonitoring = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    if (!assertMonitorAccess(request, reply)) return;

    const userId = request.user?.userId;
    const role = request.user?.role ?? '';
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const scope = await resolveProcurementMonitorScope(userId, role);
    const snapshot = await buildProcurementMonitoringSnapshot(scope);
    return reply.send(snapshot);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('getProcurementMonitoring error:', err.message, err.stack);
    return reply.code(500).send({ error: 'Internal server error', message: err.message });
  }
};

const EXPORT_LIFECYCLES = new Set<MonitorExportLifecycle>(['all', 'pending', 'completed']);

/** GET /procurement-monitor/export?lifecycle=all|pending|completed */
export const getProcurementMonitoringExport = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    if (!assertMonitorAccess(request, reply)) return;

    const userId = request.user?.userId;
    const role = request.user?.role ?? '';
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const raw = String((request.query as { lifecycle?: string })?.lifecycle ?? 'all').trim();
    const lifecycle: MonitorExportLifecycle = EXPORT_LIFECYCLES.has(raw as MonitorExportLifecycle)
      ? (raw as MonitorExportLifecycle)
      : 'all';

    const scope = await resolveProcurementMonitorScope(userId, role);
    const { buffer, filename } = await buildProcurementMonitorExcelBuffer(scope, lifecycle);

    return reply
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      .header('Content-Disposition', excelContentDisposition(filename))
      .send(buffer);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('getProcurementMonitoringExport error:', err.message, err.stack);
    return reply.code(500).send({ error: 'Internal server error', message: err.message });
  }
};

/** GET /procurement-monitor/:prId — Drill-down lifecycle */
export const getProcurementMonitoringPrDetail = async (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => {
  try {
    if (!assertMonitorAccess(request, reply)) return;

    const userId = request.user?.userId;
    const role = request.user?.role ?? '';
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const { prId } = request.params as { prId: string };
    if (!prId?.trim()) return reply.code(400).send({ error: 'Thiếu prId' });

    const scope = await resolveProcurementMonitorScope(userId, role);
    const detail = await buildProcurementMonitorPrDetail(prId.trim(), scope);
    if (!detail) return reply.code(404).send({ error: 'PR not found' });
    return reply.send(detail);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('getProcurementMonitoringPrDetail error:', err.message, err.stack);
    return reply.code(500).send({ error: 'Internal server error', message: err.message });
  }
};
