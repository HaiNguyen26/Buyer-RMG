/**
 * Bộ lọc hàng chờ duyệt PR — Trưởng phòng & GĐ chi nhánh.
 */

export type ApprovalQueueFilter =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'partial'
  | 'all';

export function normalizeApprovalQueueFilter(raw: unknown): ApprovalQueueFilter {
  const q = String(raw || 'pending').toLowerCase();
  if (
    q === 'approved' ||
    q === 'rejected' ||
    q === 'returned' ||
    q === 'partial' ||
    q === 'all'
  ) {
    return q;
  }
  return 'pending';
}

/** PR vẫn đang chờ Trưởng phòng (chưa chốt duyệt). */
export const DEPT_HEAD_PENDING_STATUSES = ['MANAGER_PENDING', 'DEPARTMENT_HEAD_PENDING'] as const;

/**
 * Sau khi Trưởng phòng duyệt — mọi trạng thái tiến procurement (dùng kèm bản ghi APPROVE).
 * Bổ sung đủ enum PRStatus để không sót PR đã duyệt lâu ngày.
 */
export const DEPT_HEAD_APPROVED_STATUSES = [
  'MANAGER_APPROVED',
  'DEPARTMENT_HEAD_APPROVED',
  'APPROVED_BY_BRANCH',
  'BRANCH_MANAGER_PENDING',
  'BRANCH_MANAGER_APPROVED',
  'BRANCH_MANAGER_RETURNED',
  'BUYER_LEADER_PENDING',
  'NEED_MORE_INFO',
  'ASSIGNED_TO_BUYER',
  'RFQ_IN_PROGRESS',
  'QUOTATION_RECEIVED',
  'SUPPLIER_SELECTED',
  'RFQ_COMPLETED',
  'PO_PENDING',
  'PO_IN_PROGRESS',
  'PO_ISSUED',
  'CLOSED',
  'BUDGET_EXCEPTION',
  'BUDGET_APPROVED',
  'BUDGET_REJECTED',
  'PAYMENT_DONE',
] as const;

export const DEPT_HEAD_REJECTED_STATUSES = ['MANAGER_REJECTED', 'DEPARTMENT_HEAD_REJECTED'] as const;

export const DEPT_HEAD_RETURNED_STATUSES = ['MANAGER_RETURNED', 'DEPARTMENT_HEAD_RETURNED'] as const;

/** PR đã qua duyệt chi nhánh — đủ enum sau BRANCH_MANAGER_PENDING. */
export const BRANCH_APPROVED_STATUSES = [
  'BRANCH_MANAGER_APPROVED',
  'BUYER_LEADER_PENDING',
  'NEED_MORE_INFO',
  'ASSIGNED_TO_BUYER',
  'RFQ_IN_PROGRESS',
  'QUOTATION_RECEIVED',
  'SUPPLIER_SELECTED',
  'RFQ_COMPLETED',
  'PO_PENDING',
  'PO_IN_PROGRESS',
  'PO_ISSUED',
  'CLOSED',
  'BUDGET_EXCEPTION',
  'BUDGET_APPROVED',
  'BUDGET_REJECTED',
  'PAYMENT_DONE',
  'APPROVED_BY_BRANCH',
] as const;

export const BRANCH_REJECTED_STATUSES = ['BRANCH_MANAGER_REJECTED'] as const;

export const BRANCH_RETURNED_STATUSES = ['BRANCH_MANAGER_RETURNED'] as const;

const EXCLUDED_OUTCOMES = new Set(['REJECTED', 'REVISION_REQUIRED', 'ON_HOLD']);

/** Duyệt một phần dòng mua ngoài (có dòng APPROVED và dòng bị loại / trả sửa). */
export function isDepartmentHeadPartialApproval(pr: {
  status: string;
  items: ReadonlyArray<{
    status?: string | null;
    departmentItemOutcome?: string | null;
  }>;
}): boolean {
  if (DEPT_HEAD_REJECTED_STATUSES.includes(pr.status as (typeof DEPT_HEAD_REJECTED_STATUSES)[number])) {
    return false;
  }
  const need = (pr.items || []).filter((i) => String(i.status || '').toUpperCase() === 'NEED_PURCHASE');
  if (need.length === 0) return false;
  const hasApproved = need.some((i) => i.departmentItemOutcome === 'APPROVED');
  const hasExcluded = need.some((i) =>
    EXCLUDED_OUTCOMES.has(String(i.departmentItemOutcome || '')),
  );
  return hasApproved && hasExcluded;
}

export function periodStartDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/** PR Trưởng phòng đã duyệt: ưu tiên bản ghi APPROVE; fallback trạng thái đã đi tiếp (dữ liệu cũ). */
export function departmentHeadApprovedByUserWhere(userId: string, periodStart: Date) {
  return {
    status: { notIn: ['DRAFT', ...DEPT_HEAD_PENDING_STATUSES, 'CANCELLED'] },
    OR: [
      {
        approvals: {
          some: {
            approverId: userId,
            action: 'APPROVE' as const,
            createdAt: { gte: periodStart },
          },
        },
      },
      {
        status: { in: [...DEPT_HEAD_APPROVED_STATUSES] },
        updatedAt: { gte: periodStart },
      },
    ],
  };
}

export function departmentHeadRejectedByUserWhere(userId: string, periodStart: Date) {
  return {
    OR: [
      {
        approvals: {
          some: {
            approverId: userId,
            action: 'REJECT' as const,
            createdAt: { gte: periodStart },
          },
        },
      },
      { status: { in: [...DEPT_HEAD_REJECTED_STATUSES] } },
    ],
  };
}

export function departmentHeadReturnedByUserWhere(userId: string, periodStart: Date) {
  return {
    OR: [
      {
        approvals: {
          some: {
            approverId: userId,
            action: 'RETURN' as const,
            createdAt: { gte: periodStart },
          },
        },
      },
      { status: { in: [...DEPT_HEAD_RETURNED_STATUSES] } },
    ],
  };
}

export function branchManagerApprovedByUserWhere(userId: string, periodStart: Date) {
  return {
    status: { notIn: ['DRAFT', 'BRANCH_MANAGER_PENDING', 'CANCELLED'] },
    OR: [
      {
        approvals: {
          some: {
            approverId: userId,
            action: 'APPROVE' as const,
            createdAt: { gte: periodStart },
          },
        },
      },
      {
        status: { in: [...BRANCH_APPROVED_STATUSES] },
        updatedAt: { gte: periodStart },
      },
    ],
  };
}

export function branchManagerRejectedByUserWhere(userId: string, periodStart: Date) {
  return {
    OR: [
      {
        approvals: {
          some: {
            approverId: userId,
            action: 'REJECT' as const,
            createdAt: { gte: periodStart },
          },
        },
      },
      { status: { in: [...BRANCH_REJECTED_STATUSES] } },
    ],
  };
}

export function branchManagerReturnedByUserWhere(userId: string, periodStart: Date) {
  return {
    OR: [
      {
        approvals: {
          some: {
            approverId: userId,
            action: 'RETURN' as const,
            createdAt: { gte: periodStart },
          },
        },
      },
      { status: { in: [...BRANCH_RETURNED_STATUSES] } },
    ],
  };
}
