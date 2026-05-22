export function formatYmdToDdMmYyyy(ymd: string): string {
  const s = String(ymd).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function desiredDeliveryDateToYmd(
  value: Date | string | null | undefined
): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return todayYmdLocal(value);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = parseDeliveryDateInput(s);
  return parsed ?? '';
}

/** Ngày local YYYY-MM-DD (ngày buyer/NCC nhập báo giá). */
export function todayYmdLocal(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Parse dd/mm/yyyy, yyyy-mm-dd, hoặc Date Excel. */
export function parseDeliveryDateInput(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && raw > 30000 && raw < 60000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(excelEpoch.getTime() + raw * 86400000);
    return todayYmdLocal(d);
  }
  const s = String(raw).trim();
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return todayYmdLocal(dt);
  return null;
}

/** Số ngày từ ngày báo giá → ngày giao NCC (21/5 → 30/5 = 9). */
export function leadTimeDaysBetween(quotationDateYmd: string, deliveryDateYmd: string): number {
  const parse = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const diff = Math.round((parse(deliveryDateYmd) - parse(quotationDateYmd)) / 86400000);
  return diff;
}

export function isValidCalendarYmd(ymd: string): boolean {
  const head = String(ymd).trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

/** yyyy-mm-dd lỗi ngày (vd 2026-06-31) → ngày cuối tháng hợp lệ. */
export function coerceToValidCalendarYmd(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const parsed = parseDeliveryDateInput(s);
  if (parsed && isValidCalendarYmd(parsed)) return parsed;
  const head = s.slice(0, 10);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head);
  if (!iso) return parsed ?? '';
  if (isValidCalendarYmd(head)) return head;
  const y = Number(iso[1]);
  const mo = Number(iso[2]);
  const d = Number(iso[3]);
  if (mo < 1 || mo > 12 || d < 1) return '';
  const lastDay = new Date(y, mo, 0).getDate();
  return `${y}-${iso[2]}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

/**
 * Đọc ô Delivery Date từ Excel — luôn giữ ngày hợp lệ từ file.
 * Nếu ngày giao ≤ ngày nhập BG: vẫn import, lead time ghi nhận tối thiểu 1 ngày.
 */
export function resolveLineDeliveryFromExcelImport(
  leadRaw: string | number | null | undefined,
  quotationDateYmd: string
): { deliveryDateYmd: string; leadTimeDays: number; beforeQuotationDate: boolean } | null {
  let deliveryDateYmd = coerceToValidCalendarYmd(
    parseDeliveryDateInput(leadRaw) ?? String(leadRaw ?? '').trim()
  );

  if (!deliveryDateYmd) {
    const daysOnly =
      typeof leadRaw === 'number'
        ? leadRaw
        : Number(String(leadRaw ?? '').replace(/[^\d]/g, ''));
    if (
      Number.isFinite(daysOnly) &&
      daysOnly >= 1 &&
      daysOnly <= 365 &&
      !String(leadRaw ?? '').includes('/')
    ) {
      const [y, m, d] = quotationDateYmd.split('-').map(Number);
      const end = new Date(Date.UTC(y, m - 1, d + daysOnly));
      deliveryDateYmd = todayYmdLocal(end);
    }
  }

  if (!deliveryDateYmd) return null;

  const diff = leadTimeDaysBetween(quotationDateYmd, deliveryDateYmd);
  const beforeQuotationDate = diff < 1;
  return {
    deliveryDateYmd,
    leadTimeDays: beforeQuotationDate ? 1 : diff,
    beforeQuotationDate,
  };
}

export function computeLeadTimeDaysFromDelivery(
  deliveryRaw: string | number | null | undefined,
  quotationDateYmd = todayYmdLocal()
): { deliveryDateYmd: string | null; leadTimeDays: number | null; error?: string } {
  const deliveryDateYmd = coerceToValidCalendarYmd(
    parseDeliveryDateInput(deliveryRaw) ?? String(deliveryRaw ?? '')
  );
  if (!deliveryDateYmd) {
    return { deliveryDateYmd: null, leadTimeDays: null, error: 'Ngày giao không hợp lệ (dd/mm/yyyy)' };
  }
  const days = leadTimeDaysBetween(quotationDateYmd, deliveryDateYmd);
  if (days < 1) {
    return {
      deliveryDateYmd,
      leadTimeDays: null,
      error: 'Ngày giao phải sau ngày nhập báo giá',
    };
  }
  return { deliveryDateYmd, leadTimeDays: days };
}

/** "12 tháng", "12", 12 → số tháng. */
export function parseWarrantyMonthsInput(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : null;
  const s = String(raw).trim().toLowerCase();
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
