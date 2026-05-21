/** Bộ lọc hàng chờ duyệt PO — Trưởng phòng Mua hàng. */

export type POApprovalQueueFilter = 'pending' | 'approved' | 'rejected' | 'all';

export function normalizePOApprovalQueueFilter(raw: unknown): POApprovalQueueFilter {
  const q = String(raw || 'pending').toLowerCase();
  if (q === 'approved' || q === 'rejected' || q === 'all') return q;
  return 'pending';
}

export const PO_PENDING_STATUSES = ['SUBMITTED', 'CANCEL_REQUESTED'] as const;

/** Sau khi Trưởng phòng duyệt PO (kể cả duyệt hủy → CLOSED/CANCELLED). */
export const PO_MANAGER_APPROVED_STATUSES = [
  'CREATED',
  'SENT',
  'CONFIRMED',
  'PARTIAL_RECEIVED',
  'FULLY_RECEIVED',
  'CLOSED',
  'CANCELLED',
  'APPROVED',
  'ISSUED',
] as const;

export function periodStartDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export function poManagerApprovedByUserWhere(userId: string, periodStart: Date) {
  return {
    approvedById: userId,
    approvedAt: { gte: periodStart },
    status: { in: [...PO_MANAGER_APPROVED_STATUSES] },
  };
}

export function poManagerRejectedByUserWhere(userId: string, periodStart: Date) {
  return {
    rejectedById: userId,
    rejectedAt: { gte: periodStart },
  };
}
