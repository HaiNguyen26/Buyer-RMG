/** Giá trị `queue` gửi API pending-prs — Trưởng phòng & GĐ chi nhánh. */

export type ApprovalQueueFilter =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'partial'
  | 'all';

export const APPROVAL_QUEUE_DEFAULT: ApprovalQueueFilter = 'all';

export const DEPARTMENT_HEAD_QUEUE_OPTIONS: { value: ApprovalQueueFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'partial', label: 'Duyệt một phần' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'returned', label: 'Trả PR' },
];

export const BRANCH_MANAGER_QUEUE_OPTIONS: { value: ApprovalQueueFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'returned', label: 'Trả PR' },
];

/** @deprecated Dùng `canDepartmentHeadActOnPr` / `canBranchManagerActOnPr` theo PR đang xem. */
export function canActOnApprovalQueue(queue: ApprovalQueueFilter): boolean {
  return queue === 'pending';
}

type DeptHeadPrForAction = {
  status?: string;
  items?: Array<{
    status?: string;
    departmentItemOutcome?: string | null;
    departmentRevisionSubmittedAt?: string | Date | null;
  }>;
};

/** Trưởng phòng có thể duyệt/trả/từ chối khi PR đang chờ hoặc có dòng chờnh sửa đã gửi lại. */
export function canDepartmentHeadActOnPr(pr: DeptHeadPrForAction | null | undefined): boolean {
  if (!pr) return false;
  const st = String(pr.status || '');
  if (st === 'MANAGER_PENDING' || st === 'DEPARTMENT_HEAD_PENDING') return true;
  return (pr.items ?? []).some(
    (it) =>
      String(it.status || '').toUpperCase() === 'NEED_PURCHASE' &&
      it.departmentItemOutcome === 'REVISION_REQUIRED' &&
      !!it.departmentRevisionSubmittedAt,
  );
}

export function canBranchManagerActOnPr(pr: { status?: string } | null | undefined): boolean {
  if (!pr) return false;
  return String(pr.status || '') === 'BRANCH_MANAGER_PENDING';
}

const QUEUE_EMPTY_HINT: Record<ApprovalQueueFilter, string> = {
  pending: 'Không còn PR chờ bạn duyệt.',
  approved: 'Chưa có PR nào bạn đã duyệt trong 12 tháng gần đây.',
  partial: 'Chưa có PR duyệt một phần trong 12 tháng gần đây.',
  rejected: 'Chưa có PR bạn đã từ chối trong 12 tháng gần đây.',
  returned: 'Chưa có PR bạn đã trả trong 12 tháng gần đây.',
  all: 'Chưa có PR trong 12 tháng gần đây.',
};

export function approvalQueueEmptyHint(queue: ApprovalQueueFilter): string {
  return QUEUE_EMPTY_HINT[queue];
}
