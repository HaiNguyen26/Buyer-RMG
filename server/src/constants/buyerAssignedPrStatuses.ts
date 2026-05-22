/**
 * PR statuses visible on Buyer "PR được phân công" — gồm cả sau khi tạo RFQ / chờ PO.
 */
export const BUYER_VISIBLE_PR_STATUSES = [
  'BUYER_LEADER_PENDING',
  'BRANCH_MANAGER_APPROVED',
  'ASSIGNED_TO_BUYER',
  'RFQ_IN_PROGRESS',
  'QUOTATION_RECEIVED',
  'SUPPLIER_SELECTED',
  'RFQ_COMPLETED',
  'PO_PENDING',
  'PO_IN_PROGRESS',
  'PO_ISSUED',
  /** Đã chọn NCC nhưng vượt ngân sách — buyer vẫn cần thấy PR trên danh sách phân công */
  'BUDGET_EXCEPTION',
  'BUDGET_APPROVED',
] as const;

export type BuyerVisiblePrStatus = (typeof BUYER_VISIBLE_PR_STATUSES)[number];
