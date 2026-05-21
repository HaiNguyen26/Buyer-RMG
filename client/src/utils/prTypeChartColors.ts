/**
 * Donut / legend colors aligned with dashboard mock (PR theo loại).
 * Falls back to index in `extras` for unknown labels.
 */
const DEFAULT_EXTRAS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#64748b'] as const;

export function getPrTypeSliceColor(
  typeLabel: string,
  index: number,
  extras: readonly string[] = DEFAULT_EXTRAS,
): string {
  const s = (typeLabel || '').toLowerCase().trim();
  if (s.includes('sản xuất') || s.includes('san xuat') || s.includes('production')) return '#2563eb';
  if (s.includes('văn phòng') || s.includes('van phong') || s.includes('office')) return '#22c55e';
  if (s.includes('dịch vụ') || s.includes('dich vu') || s.includes('service')) return '#f97316';
  if (
    s.includes('kho vận') ||
    s.includes('kho van') ||
    s.includes('logistics') ||
    s.includes('warehouse') ||
    s.includes('kho hàng') ||
    s.includes('kho hang')
  ) {
    return '#cbd5e1';
  }
  return extras[index % extras.length] ?? DEFAULT_EXTRAS[index % DEFAULT_EXTRAS.length];
}
