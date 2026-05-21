/** Bộ lọc trang Duyệt PO — Trưởng phòng Mua hàng. */

export type POApprovalQueueFilter = 'pending' | 'approved' | 'rejected' | 'all';

export const PO_APPROVAL_QUEUE_DEFAULT: POApprovalQueueFilter = 'pending';

export const PO_APPROVAL_QUEUE_OPTIONS: { value: POApprovalQueueFilter; label: string }[] = [
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Đã từ chối' },
  { value: 'all', label: 'Tất cả' },
];

export function canActOnPOApprovalQueue(queue: POApprovalQueueFilter): boolean {
  return queue === 'pending';
}

export function canActOnPOApprovalStatus(status: string): boolean {
  return status === 'SUBMITTED' || status === 'CANCEL_REQUESTED';
}

const PO_QUEUE_EMPTY_HINT: Record<POApprovalQueueFilter, string> = {
  pending: 'Không có PO nào đang chờ duyệt.',
  approved: 'Chưa có PO bạn đã duyệt trong 12 tháng gần đây.',
  rejected: 'Chưa có PO bạn đã từ chối trong 12 tháng gần đây.',
  all: 'Chưa có PO trong 12 tháng gần đây.',
};

export function poApprovalQueueEmptyHint(
  queue: POApprovalQueueFilter,
  searchQuery: string,
): string {
  if (searchQuery.trim()) return 'Không có PO khớp từ khóa tìm kiếm.';
  return PO_QUEUE_EMPTY_HINT[queue];
}

export const PO_APPROVAL_QUEUE_TABLE_TITLE: Record<POApprovalQueueFilter, string> = {
  pending: 'Danh sách PO chờ duyệt',
  approved: 'PO đã duyệt',
  rejected: 'PO đã từ chối',
  all: 'Tất cả PO',
};

/** Short English PO status labels — Buyer list/detail & Buyer Manager approval. */
export const PO_STATUS_BADGE_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Pending',
  CANCEL_REQUESTED: 'Cancel pending',
  REJECTED: 'Rejected',
  APPROVED: 'Approved',
  ISSUED: 'Sent',
  CREATED: 'Approved',
  SENT: 'Sent',
  CONFIRMED: 'Confirmed',
  PARTIAL_RECEIVED: 'Partial',
  FULLY_RECEIVED: 'Received',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

export function poApprovalStatusLabel(status: string): string {
  return PO_STATUS_BADGE_LABEL[status] ?? status;
}

export function poApprovalStatusBadgeClass(status: string): string {
  if (status === 'DRAFT') {
    return 'border-slate-200/60 bg-slate-50 text-slate-700 ring-slate-100/80';
  }
  if (status === 'SUBMITTED' || status === 'CANCEL_REQUESTED') {
    return 'border-amber-200/60 bg-amber-50 text-amber-900 ring-amber-100/80';
  }
  if (status === 'REJECTED') {
    return 'border-rose-200/60 bg-rose-50 text-rose-800 ring-rose-100/80';
  }
  if (status === 'CREATED' || status === 'APPROVED') {
    return 'border-violet-200/60 bg-violet-50 text-violet-900 ring-violet-100/80';
  }
  if (status === 'SENT' || status === 'ISSUED') {
    return 'border-sky-200/60 bg-sky-50 text-sky-900 ring-sky-100/80';
  }
  return 'border-emerald-200/60 bg-emerald-50 text-emerald-900 ring-emerald-100/80';
}
