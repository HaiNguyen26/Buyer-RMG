export function todayYmdLocal(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function leadTimeDaysBetween(quotationDateYmd: string, deliveryDateYmd: string): number {
  const parse = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(deliveryDateYmd) - parse(quotationDateYmd)) / 86400000);
}

/** yyyy-mm-dd hoặc dd/mm/yyyy → yyyy-mm-dd hợp lệ (vd 2026-06-31 → 2026-06-30). */
export function coerceToValidCalendarYmd(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';

  const fromDmy = parseDdMmYyyyToYmd(s);
  if (fromDmy) return fromDmy;

  const head = s.slice(0, 10);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head);
  if (!iso) return '';

  if (isValidCalendarYmd(head)) return head;

  const y = Number(iso[1]);
  const mo = Number(iso[2]);
  const d = Number(iso[3]);
  if (mo < 1 || mo > 12 || d < 1) return '';
  const lastDay = new Date(y, mo, 0).getDate();
  const clampedDay = Math.min(d, lastDay);
  return `${y}-${iso[2]}-${String(clampedDay).padStart(2, '0')}`;
}

export function computeLeadTimeDaysFromDelivery(
  deliveryDateYmd: string,
  quotationDateYmd = todayYmdLocal()
): number | null {
  const ymd = coerceToValidCalendarYmd(deliveryDateYmd);
  if (!ymd) return null;
  const days = leadTimeDaysBetween(quotationDateYmd, ymd);
  return days >= 1 ? days : null;
}

export function formatDdMmYyyyFromYmd(ymd: string): string {
  const head = String(ymd).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head);
  if (!m) return head;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

/** Kiểm tra yyyy-mm-dd là ngày lịch hợp lệ (vd 2026-06-31 → false). */
export function isValidCalendarYmd(ymd: string): boolean {
  const head = String(ymd).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** Parse dd/mm/yyyy hoặc yyyy-mm-dd → yyyy-mm-dd; null nếu không hợp lệ. */
export function parseDdMmYyyyToYmd(raw: string): string | null {
  const s = String(raw).trim();
  if (!s) return null;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (dmy) {
    const [, d, mo, y] = dmy;
    const ymd = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return isValidCalendarYmd(ymd) ? ymd : null;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const ymd = s.slice(0, 10);
    return isValidCalendarYmd(ymd) ? ymd : null;
  }
  return null;
}

/** Chuẩn hóa ngày giao từ API/Excel/PR — luôn trả yyyy-mm-dd hợp lệ để tính lead time. */
export function normalizeDeliveryYmdInput(raw: string | null | undefined): string {
  return coerceToValidCalendarYmd(raw);
}

/** Số ngày từ lead time API (số hoặc chuỗi); null nếu không parse được. */
export function parseLeadTimeDays(leadTime: string | number | null | undefined): number | null {
  if (leadTime == null || leadTime === '') return null;
  if (typeof leadTime === 'number' && Number.isFinite(leadTime) && leadTime > 0) {
    return Math.round(leadTime);
  }
  const s = String(leadTime).trim();
  if (!s) return null;
  if (/tháng|month/i.test(s)) {
    const months = parseInt(s.replace(/\D/g, ''), 10);
    return Number.isFinite(months) && months > 0 ? months * 30 : null;
  }
  const n = parseInt(s.replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatDaysOrMonthsLabel(days: number): string {
  const d = Math.round(days);
  if (d >= 30 && d % 30 === 0) {
    const months = d / 30;
    return `${months} tháng`;
  }
  return `${d} ngày`;
}

/** Lead time (ngày) của một dòng báo giá; fallback header khi dòng chưa có. */
export function resolveQuotationLineLeadDays(
  line: { leadTimeDays?: number | null } | null | undefined,
  quotationLeadTime?: string | number | null
): number | null {
  if (line?.leadTimeDays != null && Number.isFinite(line.leadTimeDays) && line.leadTimeDays >= 1) {
    return Math.round(line.leadTimeDays);
  }
  return parseLeadTimeDays(quotationLeadTime);
}

/**
 * Hiển thị thời gian giao — luôn kèm đơn vị (ngày / tháng).
 * Ưu tiên leadTimeDays theo dòng nếu có.
 */
export function formatQuotationLeadTimeDisplay(
  leadTime: string | number | null | undefined,
  lineLeadTimeDays?: number | null
): string {
  if (lineLeadTimeDays != null && Number.isFinite(lineLeadTimeDays) && lineLeadTimeDays >= 1) {
    return formatDaysOrMonthsLabel(lineLeadTimeDays);
  }
  if (leadTime == null || leadTime === '') return '—';
  if (typeof leadTime === 'number' && Number.isFinite(leadTime) && leadTime >= 1) {
    return formatDaysOrMonthsLabel(leadTime);
  }
  const s = String(leadTime).trim();
  if (/ngày|day|tháng|month/i.test(s)) return s;
  if (/^\d+$/.test(s)) return formatDaysOrMonthsLabel(parseInt(s, 10));
  if (/\d/.test(s)) return /ngày|tháng/i.test(s) ? s : `${s} ngày`;
  return s;
}

/** Bảo hành — số nguyên từ API thường là tháng. */
export function formatWarrantyDisplay(warranty: string | number | null | undefined): string {
  if (warranty == null || warranty === '') return '—';
  if (typeof warranty === 'number' && Number.isFinite(warranty) && warranty >= 1) {
    return `${Math.round(warranty)} tháng`;
  }
  const s = String(warranty).trim();
  if (/tháng|month/i.test(s)) return s;
  if (/^\d+$/.test(s)) return `${parseInt(s, 10)} tháng`;
  return s;
}
