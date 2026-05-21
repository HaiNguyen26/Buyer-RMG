/** Kiểm tra Lead time, bảo hành, điều kiện thanh toán trước khi gửi báo giá. */
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

export function isQuotationCommercialComplete(
  leadTime: string,
  paymentTerms: string,
  warranty: string
): boolean {
  return validateQuotationCommercialFields(leadTime, paymentTerms, warranty) === null;
}
