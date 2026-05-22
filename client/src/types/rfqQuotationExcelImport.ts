export type RfqQuotationExcelImportItem = {
  purchaseRequestItemId: string;
  lineNo: number;
  description: string;
  qty: number;
  unit: string | null;
  unitPrice: number;
  vatPercent: number;
  leadTimeDays: number;
  warrantyMonths: number;
  deliveryDateYmd: string;
  requestedDeliveryDateYmd: string | null;
  notes: string | null;
};

export type RfqQuotationExcelImportResult = {
  supplierId: string | null;
  supplierName: string | null;
  quotationNumber: string | null;
  leadTimeDays: number;
  leadTimeSelect: string;
  paymentTermsPercent: number;
  paymentTermsSelect: string;
  warrantyMonths: number;
  warrantySelect: string;
  quotationDateYmd: string;
  deliveryTerms: string | null;
  validUntil: string | null;
  items: RfqQuotationExcelImportItem[];
  warnings: string[];
};
