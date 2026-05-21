/** Múi giờ nghiệp vụ cho ngày nhận kho (GRN). */
export const GRN_RECEIVE_TZ = 'Asia/Ho_Chi_Minh';

const ISO_DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parse ngày từ form (`type="date"` → YYYY-MM-DD) thành 00:00 giờ VN.
 * Tránh `Date.UTC` / `new Date()` gây lệch ngày khi hiển thị.
 */
export function parseReceiveDateInput(raw: string | null | undefined): Date | null {
  const s = raw?.trim();
  if (!s) return null;

  const day = ISO_DAY_RE.exec(s);
  if (day) {
    const y = day[1];
    const m = day[2];
    const d = day[3];
    const dt = new Date(`${y}-${m}-${d}T00:00:00+07:00`);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function vnTimeParts(d: Date): { hour: string; minute: string; second: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: GRN_RECEIVE_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { hour: pick('hour'), minute: pick('minute'), second: pick('second') };
}

/** Phiếu chỉ chọn ngày (00:00 VN) — không hiển thị giờ ghi sổ hệ thống. */
export function isDateOnlyReceiveAt(d: Date): boolean {
  const { hour, minute, second } = vnTimeParts(d);
  return hour === '00' && minute === '00' && (second === '00' || second === '0');
}

export function formatGrnHistoryDateTime(d: Date): { date: string; time: string } {
  const date = d.toLocaleDateString('vi-VN', { timeZone: GRN_RECEIVE_TZ });
  if (isDateOnlyReceiveAt(d)) {
    return { date, time: '—' };
  }
  const time = d.toLocaleTimeString('vi-VN', {
    timeZone: GRN_RECEIVE_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return { date, time };
}

export function formatTimelineStamp(d: Date): string {
  const { date, time } = formatGrnHistoryDateTime(d);
  return time === '—' ? date : `${date} ${time}`;
}
