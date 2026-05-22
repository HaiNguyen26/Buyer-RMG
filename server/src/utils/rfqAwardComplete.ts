/** PR đã qua phase chọn NCC / PO — RFQ không còn "chờ duyệt" trên UI. */
export const PR_STATUS_PAST_RFQ_APPROVAL = new Set([
  'SUPPLIER_SELECTED',
  'RFQ_COMPLETED',
  'PO_PENDING',
  'PO_IN_PROGRESS',
  'PO_ISSUED',
  'CLOSED',
  'PAYMENT_DONE',
  'BUDGET_EXCEPTION',
  'BUDGET_APPROVED',
]);

export function isPrPastRfqApprovalPhase(prStatus: string | null | undefined): boolean {
  return PR_STATUS_PAST_RFQ_APPROVAL.has(String(prStatus ?? ''));
}

const PO_PROCUREMENT_ACTIVE = new Set([
  'CREATED',
  'SENT',
  'ISSUED',
  'CONFIRMED',
  'PARTIAL_RECEIVED',
  'FULLY_RECEIVED',
  'CLOSED',
]);

/** PR đã có PO thực tế (không còn chỉ draft chờ duyệt nội bộ). */
export function prHasActivePurchaseOrder(
  pos: Array<{ status: string }> | undefined | null
): boolean {
  return (pos ?? []).some((po) => PO_PROCUREMENT_ACTIVE.has(String(po.status)));
}

export function isRfqAwardCompleteFromCounts(opts: {
  rfqStatus: string;
  prStatus: string;
  itemIds: string[];
  selectedCount: number;
  hasNonDraftPo?: boolean;
  /** Số dòng PR (trong RFQ) đã FULFILLED / không còn chờ mua trên RFQ này. */
  settledItemCount?: number;
}): boolean {
  if (opts.rfqStatus === 'CLOSED') return true;
  if (isPrPastRfqApprovalPhase(opts.prStatus)) return true;
  if (opts.itemIds.length > 0 && opts.selectedCount >= opts.itemIds.length) return true;

  /**
   * RFQ cũ: đã gửi duyệt, đã có PO/giao hàng, nhưng supplier_selections có thể đã bị xóa
   * khi hủy dòng PO — vẫn coi chu trình award/PO của RFQ đó đã xong.
   */
  if (
    opts.rfqStatus === 'READY_FOR_COMPARISON' &&
    opts.hasNonDraftPo &&
    (opts.settledItemCount ?? 0) > 0
  ) {
    return true;
  }

  return false;
}
