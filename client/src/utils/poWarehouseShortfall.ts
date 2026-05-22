/** SL cần nhận kho (ưu tiên SL confirm NCC, không thì SL đặt). */
export function poLineOrderedQty(item: {
  qty: number;
  confirmedQty?: number | null;
}): number {
  return item.confirmedQty != null ? Number(item.confirmedQty) : Number(item.qty);
}

/** Dòng PO còn thiếu so với đã nhận kho. */
export function isPoLineWarehouseShort(item: {
  qty: number;
  confirmedQty?: number | null;
  qtyReceived?: number;
  lineStatus?: string;
}): boolean {
  if (item.lineStatus === 'CANCELLED') return false;
  return poLineOrderedQty(item) > (Number(item.qtyReceived) ?? 0) + 1e-9;
}

const WAREHOUSE_SHORTFALL_PO_STATUSES = new Set([
  'ISSUED',
  'SENT',
  'CONFIRMED',
  'PARTIAL_RECEIVED',
  'RECEIVED',
  'FULLY_RECEIVED',
]);

export function poShowsWarehouseShortfallUi(
  poStatus: string | undefined,
  shortfallLineIds: string[]
): boolean {
  return (
    shortfallLineIds.length > 0 &&
    !!poStatus &&
    WAREHOUSE_SHORTFALL_PO_STATUSES.has(poStatus)
  );
}
