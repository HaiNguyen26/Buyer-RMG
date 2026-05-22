/** Tổng thành tiền (có VAT) từ các dòng báo giá. */
export function sumQuotationItemsTotal(
  items: Array<{ totalPrice?: unknown }>
): number {
  return items.reduce((sum, it) => sum + Number(it.totalPrice ?? 0), 0);
}

/**
 * Ưu tiên tổng từ dòng item (đúng sau VAT); fallback header khi chưa có dòng.
 */
export function resolveQuotationTotalAmount(
  headerTotal: unknown,
  items: Array<{ totalPrice?: unknown }>
): number {
  const itemsSum = sumQuotationItemsTotal(items);
  if (itemsSum > 0) return itemsSum;
  const header = Number(headerTotal);
  return Number.isFinite(header) ? header : 0;
}
