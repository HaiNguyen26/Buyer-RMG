/** VAT % hợp lệ khi buyer nhập báo giá NCC */
export const ALLOWED_VAT_PERCENTS = [3, 5, 8, 10] as const;
export type AllowedVatPercent = (typeof ALLOWED_VAT_PERCENTS)[number];

export function normalizeVatPercent(value: unknown, fallback: AllowedVatPercent = 10): AllowedVatPercent {
  const n = Math.round(Number(value));
  if (ALLOWED_VAT_PERCENTS.includes(n as AllowedVatPercent)) {
    return n as AllowedVatPercent;
  }
  return fallback;
}

/** Làm tròn SL tối đa 2 chữ số thập phân (khớp validation API). */
export function roundQuotationQty(qty: number): number {
  return Math.round(Number(qty) * 100) / 100;
}

/** Tiền VND nguyên: SL × đơn giá (chưa VAT) + VAT% — khớp UI buyer. */
export function quotationLineAmounts(qty: number, unitPrice: number, vatPercent: number) {
  const q = roundQuotationQty(qty);
  const u = Math.round(Number(unitPrice));
  const subtotal = Math.round(q * u);
  const vatAmount = Math.round((subtotal * vatPercent) / 100);
  const totalPrice = subtotal + vatAmount;
  return { subtotal, vatAmount, totalPrice };
}

export function mapQuotationItemAmounts(item: {
  qty: number;
  unitPrice: number;
  vatPercent?: number | null;
}) {
  const vat = normalizeVatPercent(item.vatPercent ?? 10);
  const amounts = quotationLineAmounts(item.qty, item.unitPrice, vat);
  return { vatPercent: vat, ...amounts };
}

/** Suy % VAT từ SL × đơn giá (chưa VAT) và thành tiền (có VAT) — dùng khi DB chưa lưu vat_percent. */
export function inferVatPercentFromLine(
  qty: number,
  unitPrice: number,
  amountWithVat: number
): AllowedVatPercent | null {
  const amount = Math.round(Number(amountWithVat));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  for (const vat of ALLOWED_VAT_PERCENTS) {
    if (quotationLineAmounts(qty, unitPrice, vat).totalPrice === amount) {
      return vat;
    }
  }
  return null;
}
