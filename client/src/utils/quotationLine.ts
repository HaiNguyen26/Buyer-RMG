import { DEFAULT_VAT_PERCENT, VAT_PERCENT_OPTIONS } from '../constants/quotationEvaluation';

export const VAT_PERCENT_VALUES = VAT_PERCENT_OPTIONS.map((o) => Number(o.value));

export function normalizeVatPercentString(value: unknown, fallback = DEFAULT_VAT_PERCENT): string {
  const n = Math.round(Number(value));
  const s = String(n);
  return VAT_PERCENT_VALUES.includes(n) ? s : fallback;
}

export function roundQuotationQty(qty: number): number {
  return Math.round(Number(qty) * 100) / 100;
}

/** Tiền VND nguyên — khớp server `quotationLine.ts`. */
export function quotationLineAmounts(qty: number, unitPrice: number, vatPercent: number) {
  const q = roundQuotationQty(qty);
  const u = Math.round(Number(unitPrice));
  const subtotal = Math.round(q * u);
  const vatAmount = Math.round((subtotal * vatPercent) / 100);
  const total = subtotal + vatAmount;
  return { subtotal, vatAmount, total };
}

export function parseUnitPriceInput(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  return digits ? parseFloat(digits) : 0;
}

/** Suy % VAT từ tiền dòng PO khi API chưa trả vatPercent. */
export function inferVatPercentFromLine(
  qty: number,
  unitPrice: number,
  amountWithVat: number
): number | null {
  const amount = Math.round(Number(amountWithVat));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  for (const vat of VAT_PERCENT_VALUES) {
    if (quotationLineAmounts(qty, unitPrice, vat).total === amount) return vat;
  }
  return null;
}
