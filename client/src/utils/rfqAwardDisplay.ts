/** PR đã qua bước chọn NCC / PO — không hiển thị RFQ là "Chờ duyệt". */
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

export function isRfqAwardComplete(opts: {
  rfqStatus: string;
  prStatus?: string | null;
  itemIds?: string[];
  selectedItemIds?: Set<string> | string[];
  awardComplete?: boolean;
  hasNonDraftPo?: boolean;
  settledItemCount?: number;
}): boolean {
  if (opts.awardComplete === true) return true;
  if (opts.rfqStatus === 'CLOSED') return true;
  if (isPrPastRfqApprovalPhase(opts.prStatus)) return true;
  const ids = opts.itemIds ?? [];
  const selected =
    opts.selectedItemIds instanceof Set
      ? opts.selectedItemIds
      : new Set(opts.selectedItemIds ?? []);
  if (ids.length > 0 && ids.every((id) => selected.has(id))) return true;
  if (
    opts.rfqStatus === 'READY_FOR_COMPARISON' &&
    opts.hasNonDraftPo &&
    (opts.settledItemCount ?? 0) > 0
  ) {
    return true;
  }
  return false;
}
