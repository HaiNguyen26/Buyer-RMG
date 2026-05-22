import { BUYER_VISIBLE_PR_STATUSES } from './buyerAssignedPrStatuses';

/**
 * PR đang trong luồng mua — dùng cho dashboard Buyer Manager (giá trị pipeline, số PR đang chạy).
 * Đồng bộ với danh sách buyer thấy trên "PR được phân công" + các phase chờ PO / vượt NS.
 */
export const BUYER_MANAGER_PIPELINE_PR_STATUSES = [
  ...BUYER_VISIBLE_PR_STATUSES,
] as const;

/** Chờ duyệt nhánh / Buyer Leader (chưa vào tay buyer xử lý). */
export const PIPELINE_BRANCH_GATE_STATUSES = new Set<string>([
  'BUYER_LEADER_PENDING',
  'BRANCH_MANAGER_APPROVED',
  'BRANCH_MANAGER_PENDING',
  'BUDGET_EXCEPTION',
]);

/** Buyer đang sourcing / chờ tạo PO / PO đang chạy. */
export const PIPELINE_BUYER_PROCESSING_STATUSES = new Set<string>([
  'ASSIGNED_TO_BUYER',
  'RFQ_IN_PROGRESS',
  'QUOTATION_RECEIVED',
  'SUPPLIER_SELECTED',
  'RFQ_COMPLETED',
  'PO_PENDING',
  'PO_IN_PROGRESS',
  'PO_ISSUED',
  'BUDGET_APPROVED',
]);

export const PIPELINE_FUNNEL_APPROVAL_STATUSES = new Set<string>([
  'BUYER_LEADER_PENDING',
  'BRANCH_MANAGER_PENDING',
  'BRANCH_MANAGER_APPROVED',
  'BUDGET_EXCEPTION',
]);

export const PIPELINE_FUNNEL_SOURCING_STATUSES = new Set<string>([
  'ASSIGNED_TO_BUYER',
  'RFQ_IN_PROGRESS',
  'QUOTATION_RECEIVED',
  'BUDGET_APPROVED',
]);

export const PIPELINE_FUNNEL_PO_STATUSES = new Set<string>([
  'SUPPLIER_SELECTED',
  'RFQ_COMPLETED',
  'PO_PENDING',
  'PO_IN_PROGRESS',
  'PO_ISSUED',
  'BUDGET_EXCEPTION',
  'BUDGET_APPROVED',
]);
