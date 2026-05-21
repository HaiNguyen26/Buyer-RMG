/** Nhập/hiển thị số nguyên VND: phân cách nghìn bằng dấu `.` (theo `vi-VN`). */

export function formatVndInteger(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const rounded = Math.round(amount);
  return rounded.toLocaleString('vi-VN');
}

/**
 * Parse chuỗi nhập: bỏ khoảng trắng, bỏ dấu `.` (nghìn), phần thập phân tuỳ chọn sau `,`.
 * Chỉ dùng cho giá VND nguyên (làm tròn).
 */
export function parseVndIntegerInput(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const intPart = t.split(',')[0] ?? t;
  const digits = intPart.replace(/\s/g, '').replace(/\./g, '');
  if (!digits) return undefined;
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

/** Chuẩn hoá giá trị từ API / form (number | string) → số, bỏ qua chuỗi có dấu phân cách. */
export function coerceVndNumber(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return undefined;
    return Math.round(value);
  }
  return parseVndIntegerInput(String(value));
}
