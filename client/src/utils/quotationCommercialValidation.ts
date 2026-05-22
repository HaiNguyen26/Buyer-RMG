import { coerceToValidCalendarYmd } from './quotationLeadTime';

/** Kiểm tra điều kiện thanh toán (header). */
export function validateQuotationPaymentTerms(paymentTerms: string): string | null {
  if (!paymentTerms.trim()) return 'Vui lòng chọn Điều kiện thanh toán (%).';
  return null;
}

/** Kiểm tra Lead time, bảo hành, điều kiện thanh toán (legacy header). */
export function validateQuotationCommercialFields(
  leadTime: string,
  paymentTerms: string,
  warranty: string
): string | null {
  if (!leadTime.trim()) return 'Vui lòng chọn Lead time (ngày).';
  const lt = Number(leadTime);
  if (!Number.isFinite(lt) || lt < 1) return 'Lead time phải từ 1 ngày trở lên.';
  if (!paymentTerms.trim()) return 'Vui lòng chọn Điều kiện thanh toán (%).';
  if (!warranty.trim()) return 'Vui lòng chọn Bảo hành (tháng).';
  return null;
}

export function validateQuotationLineCommercialFields(
  itemIds: string[],
  deliveryDates: Record<string, string>,
  warrantyMonths: Record<string, string>,
  quotationDateYmd: string
): string | null {
  for (const id of itemIds) {
    const ymd = coerceToValidCalendarYmd(deliveryDates[id]);
    if (!ymd) {
      return 'Vui lòng nhập ngày giao NCC cho từng dòng (dd/mm/yyyy).';
    }
    const [y, m, d] = ymd.split('-').map(Number);
    const [qy, qm, qd] = quotationDateYmd.split('-').map(Number);
    const diff = Math.round(
      (Date.UTC(y, m - 1, d) - Date.UTC(qy, qm - 1, qd)) / 86400000
    );
    if (diff < 1) {
      return 'Ngày giao NCC phải sau ngày nhập báo giá.';
    }
    const w = warrantyMonths[id];
    if (!w?.trim() || !Number.isFinite(Number(w))) {
      return 'Vui lòng chọn bảo hành (tháng) cho từng dòng.';
    }
  }
  return null;
}

export function isQuotationFormReady(
  paymentTerms: string,
  itemIds: string[],
  deliveryDates: Record<string, string>,
  warrantyMonths: Record<string, string>,
  quotationDateYmd: string,
  itemPrices: Record<string, number | undefined>
): boolean {
  if (!paymentTerms.trim()) return false;
  if (itemIds.some((id) => !itemPrices[id] || (itemPrices[id] ?? 0) <= 0)) return false;
  return (
    validateQuotationLineCommercialFields(
      itemIds,
      deliveryDates,
      warrantyMonths,
      quotationDateYmd
    ) === null
  );
}

export function isQuotationCommercialComplete(
  leadTime: string,
  paymentTerms: string,
  warranty: string
): boolean {
  return validateQuotationCommercialFields(leadTime, paymentTerms, warranty) === null;
}
