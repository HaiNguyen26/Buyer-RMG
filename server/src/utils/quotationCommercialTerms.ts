/** Lead time, bảo hành, điều kiện thanh toán — bắt buộc khi Buyer nhập báo giá. */
export function validateQuotationCommercialTermsInput(input: {
  leadTime?: number | string | null;
  paymentTerms?: string | null;
  warranty?: string | null;
}): { ok: true } | { ok: false; error: string } {
  const leadRaw = input.leadTime;
  const leadNum =
    leadRaw === null || leadRaw === undefined || leadRaw === ''
      ? NaN
      : typeof leadRaw === 'number'
        ? leadRaw
        : Number(leadRaw);
  if (!Number.isFinite(leadNum) || leadNum < 1) {
    return { ok: false, error: 'Lead time (ngày) là bắt buộc — chọn từ danh sách.' };
  }

  const payment = input.paymentTerms?.trim() ?? '';
  if (!payment) {
    return { ok: false, error: 'Điều kiện thanh toán (%) là bắt buộc.' };
  }

  const warranty = input.warranty?.trim() ?? '';
  if (!warranty) {
    return { ok: false, error: 'Bảo hành (tháng) là bắt buộc.' };
  }

  return { ok: true };
}
