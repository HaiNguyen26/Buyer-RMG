import type { RfqQuotationExcelImportResult } from '../types/rfqQuotationExcelImport';
import { coerceToValidCalendarYmd } from './quotationLeadTime';

export type QuotationImportFormState = {
  quotationNumber: string;
  paymentTerms: string;
  itemPrices: Record<string, number | undefined>;
  itemVatPercents: Record<string, string>;
  itemDeliveryDates: Record<string, string>;
  itemWarrantyMonths: Record<string, string>;
  itemNotes: Record<string, string>;
  quotationDateYmd: string;
};

export function applyRfqQuotationExcelImport(
  data: RfqQuotationExcelImportResult
): QuotationImportFormState {
  const itemPrices: Record<string, number | undefined> = {};
  const itemVatPercents: Record<string, string> = {};
  const itemDeliveryDates: Record<string, string> = {};
  const itemWarrantyMonths: Record<string, string> = {};
  const itemNotes: Record<string, string> = {};

  for (const row of data.items) {
    itemPrices[row.purchaseRequestItemId] = row.unitPrice;
    itemVatPercents[row.purchaseRequestItemId] = String(row.vatPercent);
    const deliveryYmd = coerceToValidCalendarYmd(row.deliveryDateYmd);
    if (deliveryYmd) {
      itemDeliveryDates[row.purchaseRequestItemId] = deliveryYmd;
    }
    itemWarrantyMonths[row.purchaseRequestItemId] = String(row.warrantyMonths);
    if (row.notes) itemNotes[row.purchaseRequestItemId] = row.notes;
  }

  return {
    quotationNumber: data.quotationNumber ?? '',
    paymentTerms: data.paymentTermsSelect,
    itemPrices,
    itemVatPercents,
    itemDeliveryDates,
    itemWarrantyMonths,
    itemNotes,
    quotationDateYmd: data.quotationDateYmd,
  };
}
