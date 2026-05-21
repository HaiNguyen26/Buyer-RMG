/**
 * Chuỗi ngày dạng `yyyy-mm-dd` (hoặc ISO bắt đầu bằng calendar date) → `dd/mm/yyyy`.
 * Không dùng `new Date('yyyy-mm-dd')` để tránh lệch ngày theo múi giờ.
 */
export function formatIsoDateToDdMmYyyy(raw: string | null | undefined): string {
  if (raw == null) return '';
  const t = String(raw).trim();
  const head = t.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return '';
}
