import ExcelJS from 'exceljs';
import type { PurchaseRequestItem } from '@prisma/client';
import { normalizeVatPercent, roundQuotationQty } from './quotationLine';
import {
  desiredDeliveryDateToYmd,
  formatYmdToDdMmYyyy,
  parseWarrantyMonthsInput,
  resolveLineDeliveryFromExcelImport,
  todayYmdLocal,
} from './quotationLeadTime';
import {
  RFQ_GUIDE_SHEET,
  RFQ_QUOTE_COLUMN_KEYS,
  RFQ_QUOTE_SUPPLIER_ID_COL,
  RFQ_QUOTE_COMMERCIAL_FIELDS,
  RFQ_QUOTE_SHEET,
  LEAD_TIME_DAY_OPTIONS,
  PAYMENT_TERMS_PERCENT_VALUES,
  WARRANTY_MONTH_VALUES,
  rfqQuoteExcelLayout,
  snapToNearestOption,
  type RfqNccQuoteLineRow,
  type RfqQuoteCommercialKey,
} from './rfqQuotationExcelShared';
import { isUuidLike } from './rfqQuotationSupplierResolve';

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

export type RfqQuotationExcelImportSupplierMeta = {
  supplierId: string | null;
  supplierName: string | null;
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
  deliveryTerms: string | null;
  validUntil: string | null;
  items: RfqQuotationExcelImportItem[];
  warnings: string[];
};

function cellPlainValue(cell: ExcelJS.Cell | undefined): string | number | null {
  if (!cell || cell.value == null || cell.value === '') return null;
  const v = cell.value;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
    return typeof v === 'boolean' ? (v ? 1 : 0) : v;
  }
  if (v instanceof Date) {
    const dd = String(v.getDate()).padStart(2, '0');
    const mm = String(v.getMonth() + 1).padStart(2, '0');
    const yyyy = v.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  if (typeof v === 'object') {
    if ('result' in v && v.result != null) return cellPlainValue({ value: v.result } as ExcelJS.Cell);
    if ('richText' in v && Array.isArray(v.richText)) {
      return v.richText.map((r) => r.text).join('');
    }
    if ('text' in v && typeof v.text === 'string') return v.text;
  }
  return String(v);
}

function parseNumber(v: string | number | null): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/%/g, '').replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  // VND Excel (#.##0): 1.234.567 hoặc 1.234.567,5
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  } else if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})+$/.test(s)) {
    s = s.replace(/,/g, '');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseCommercialBlock(
  ws: ExcelJS.Worksheet,
  layout: ReturnType<typeof rfqQuoteExcelLayout>
): Partial<Record<RfqQuoteCommercialKey, string>> {
  const meta: Partial<Record<RfqQuoteCommercialKey, string>> = {};
  for (let r = layout.firstCommercialRow; r < layout.snakeRow; r++) {
    const row = ws.getRow(r);
    const keyFromHidden = String(cellPlainValue(row.getCell(13)) ?? '').trim();
    const label = String(cellPlainValue(row.getCell(1)) ?? '').trim();
    const val = String(cellPlainValue(row.getCell(2)) ?? '').trim();
    let field = RFQ_QUOTE_COMMERCIAL_FIELDS.find((f) => f.key === keyFromHidden);
    if (!field && label) {
      field = RFQ_QUOTE_COMMERCIAL_FIELDS.find(
        (f) => label === f.label || label.startsWith(f.label)
      );
    }
    if (field) meta[field.key] = val;
  }
  return meta;
}

/** File cũ (sheet thong_tin_bao_gia) — vẫn đọc được khi import. */
function parseLegacyMetaSheet(ws: ExcelJS.Worksheet): Partial<Record<RfqQuoteCommercialKey, string>> {
  const meta: Partial<Record<RfqQuoteCommercialKey, string>> = {};
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const keyRaw = String(cellPlainValue(row.getCell(1)) ?? '').trim();
    if (!keyRaw) continue;
    const key = keyRaw.toLowerCase().replace(/\s+/g, '_') as RfqQuoteCommercialKey;
    const valCol = String(cellPlainValue(row.getCell(3)) ?? '').trim()
      ? 3
      : 2;
    const val = String(cellPlainValue(row.getCell(valCol)) ?? '').trim();
    if (RFQ_QUOTE_COMMERCIAL_FIELDS.some((f) => f.key === key)) {
      meta[key] = val;
    }
  }
  return meta;
}

function findColumnMap(ws: ExcelJS.Worksheet): Map<keyof RfqNccQuoteLineRow, number> | null {
  const maxScan = Math.min(25, ws.rowCount);
  for (let r = 1; r <= maxScan; r++) {
    const row = ws.getRow(r);
    const keysFound: Partial<Record<keyof RfqNccQuoteLineRow, number>> = {};
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const raw = String(cellPlainValue(cell) ?? '').trim().toLowerCase();
      if (!raw) return;
      for (const key of RFQ_QUOTE_COLUMN_KEYS) {
        if (raw === key) keysFound[key] = col;
      }
    });
    if (keysFound.purchase_request_item_id || keysFound.unit_price) {
      return new Map(
        Object.entries(keysFound) as Array<[keyof RfqNccQuoteLineRow, number]>
      );
    }
  }
  return null;
}

function readRowByMap(
  row: ExcelJS.Row,
  colMap: Map<keyof RfqNccQuoteLineRow, number>
): Partial<RfqNccQuoteLineRow> {
  const out: Partial<RfqNccQuoteLineRow> = {};
  for (const [key, col] of colMap) {
    const v = cellPlainValue(row.getCell(col));
    if (v == null || v === '') continue;
    if (key === 'no' || key === 'qty' || key === 'unit_price' || key === 'vat_percent') {
      const n = parseNumber(v);
      if (n != null) (out as Record<string, unknown>)[key] = n;
    } else if (key === 'lead_time') {
      // Excel thường lưu ngày dạng serial number — giữ number để parseDeliveryDateInput xử lý.
      if (typeof v === 'number') {
        (out as Record<string, unknown>)[key] = v;
      } else {
        (out as Record<string, unknown>)[key] = String(v).trim();
      }
    } else {
      (out as Record<string, unknown>)[key] = String(v).trim();
    }
  }
  return out;
}

function composeLineNotes(partial: Partial<RfqNccQuoteLineRow>): string | null {
  const parts: string[] = [];
  if (partial.brand) parts.push(`Brand: ${partial.brand}`);
  if (partial.origin) parts.push(`Origin: ${partial.origin}`);
  if (partial.moq) parts.push(`MOQ: ${partial.moq}`);
  if (partial.note) parts.push(partial.note);
  return parts.length ? parts.join(' | ') : null;
}

function parseValidUntil(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    return dt.toISOString().slice(0, 10);
  }
  return null;
}

function parseNccNameFromQuoteTitle(title: string): string | null {
  const t = title.trim();
  const m = /\|\s*NCC:\s*(.+)$/i.exec(t);
  return m?.[1]?.trim() || null;
}

function parseSupplierNameFromGuideSheet(ws: ExcelJS.Worksheet): string | null {
  for (let r = 1; r <= 40; r++) {
    const label = String(cellPlainValue(ws.getCell(r, 2)) ?? '').trim();
    if (label === 'Nhà cung cấp' || label.includes('Nhà cung cấp')) {
      const val = String(cellPlainValue(ws.getCell(r, 3)) ?? '').trim();
      if (val) return val;
    }
  }
  return null;
}

export function parseSupplierMetaFromExcelWorkbook(
  wb: ExcelJS.Workbook,
  quoteWs: ExcelJS.Worksheet
): RfqQuotationExcelImportSupplierMeta {
  const layout = rfqQuoteExcelLayout();
  const hidden = String(
    cellPlainValue(quoteWs.getCell(layout.titleRow, RFQ_QUOTE_SUPPLIER_ID_COL)) ?? ''
  ).trim();
  if (hidden && isUuidLike(hidden)) {
    return { supplierId: hidden, supplierName: null };
  }

  const title = String(cellPlainValue(quoteWs.getCell(layout.titleRow, 1)) ?? '');
  const fromTitle = parseNccNameFromQuoteTitle(title);
  if (fromTitle) return { supplierId: null, supplierName: fromTitle };

  const guideWs = wb.getWorksheet(RFQ_GUIDE_SHEET);
  if (guideWs) {
    const fromGuide = parseSupplierNameFromGuideSheet(guideWs);
    if (fromGuide) return { supplierId: null, supplierName: fromGuide };
  }

  return { supplierId: null, supplierName: null };
}

export async function parseRfqQuotationExcelBuffer(
  buffer: Buffer,
  scopeItems: PurchaseRequestItem[],
  opts?: { quotationDateYmd?: string }
): Promise<RfqQuotationExcelImportResult> {
  const warnings: string[] = [];
  const itemById = new Map(scopeItems.map((i) => [i.id, i]));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const lineWs =
    wb.getWorksheet(RFQ_QUOTE_SHEET) ?? wb.worksheets[0];
  if (!lineWs) {
    throw new Error('File Excel không có sheet báo giá');
  }

  const supplierMeta = parseSupplierMetaFromExcelWorkbook(wb, lineWs);

  const colMap = findColumnMap(lineWs);
  if (!colMap || !colMap.has('purchase_request_item_id')) {
    throw new Error(
      'Không đọc được cấu trúc file (thiếu hàng field_name hoặc cột purchase_request_item_id). Hãy dùng file mẫu tải từ hệ thống.'
    );
  }

  const headerRowIdx = (() => {
    for (let r = 1; r <= 20; r++) {
      const row = lineWs.getRow(r);
      let hit = false;
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (String(cellPlainValue(cell) ?? '').trim().toLowerCase() === 'purchase_request_item_id') {
          hit = true;
        }
      });
      if (hit) return r;
    }
    return 3;
  })();

  const quotationDateYmd =
    opts?.quotationDateYmd && /^\d{4}-\d{2}-\d{2}$/.test(opts.quotationDateYmd.slice(0, 10))
      ? opts.quotationDateYmd.slice(0, 10)
      : todayYmdLocal();
  const items: RfqQuotationExcelImportItem[] = [];
  for (let r = headerRowIdx + 1; r <= lineWs.rowCount; r++) {
    const row = lineWs.getRow(r);
    const partial = readRowByMap(row, colMap);
    const prItemId = String(partial.purchase_request_item_id ?? '').trim();
    if (!prItemId) {
      const no = partial.no;
      if (no == null && !partial.item) continue;
      if (!partial.unit_price && !partial.item) continue;
    }
    if (!prItemId) continue;

    const prItem = itemById.get(prItemId);
    if (!prItem) {
      warnings.push(`Dòng ${r}: mã item không thuộc RFQ (${prItemId.slice(0, 8)}…)`);
      continue;
    }

    const unitPrice = parseNumber(
      (partial.unit_price as number | string | null | undefined) ?? null
    );
    if (unitPrice == null || unitPrice <= 0) {
      warnings.push(`Dòng ${r} (STT ${prItem.lineNo}): chưa có đơn giá — bỏ qua`);
      continue;
    }

    const qtyRaw = parseNumber(partial.qty as number | string | null | undefined ?? null);
    const qty = roundQuotationQty(qtyRaw != null && qtyRaw > 0 ? qtyRaw : Number(prItem.qty));

    const vatPercent = normalizeVatPercent(partial.vat_percent ?? 10);

    const leadParsed = resolveLineDeliveryFromExcelImport(
      partial.lead_time,
      quotationDateYmd
    );
    if (!leadParsed) {
      warnings.push(
        `Dòng ${r} (STT ${prItem.lineNo}): cột Delivery Date không hợp lệ (dd/mm/yyyy hoặc số ngày)`
      );
      continue;
    }
    if (leadParsed.beforeQuotationDate) {
      warnings.push(
        `Dòng ${r} (STT ${prItem.lineNo}): ngày giao ${formatYmdToDdMmYyyy(leadParsed.deliveryDateYmd)} — đã import từ file (trước ngày báo giá ${formatYmdToDdMmYyyy(quotationDateYmd)})`
      );
    }

    const warrantyMonths = parseWarrantyMonthsInput(partial.warranty);
    if (warrantyMonths == null) {
      warnings.push(`Dòng ${r} (STT ${prItem.lineNo}): chưa có bảo hành (tháng) — bỏ qua`);
      continue;
    }

    const requestedDeliveryDateYmd = desiredDeliveryDateToYmd(prItem.desiredDeliveryDate) || null;

    items.push({
      purchaseRequestItemId: prItemId,
      lineNo: prItem.lineNo,
      description: prItem.description?.trim() || String(partial.item ?? ''),
      qty,
      unit: (partial.unit && String(partial.unit).trim()) || prItem.unit || null,
      unitPrice: Math.round(unitPrice),
      vatPercent,
      leadTimeDays: leadParsed.leadTimeDays,
      warrantyMonths,
      deliveryDateYmd: leadParsed.deliveryDateYmd,
      requestedDeliveryDateYmd,
      notes: composeLineNotes(partial),
    });
  }

  if (items.length === 0) {
    throw new Error('Không có dòng báo giá hợp lệ (cần đơn giá > 0 và đúng mã item)');
  }

  const layout = rfqQuoteExcelLayout();
  const metaFromQuote = parseCommercialBlock(lineWs, layout);
  const legacyMetaWs = wb.getWorksheet('thong_tin_bao_gia');
  const meta = {
    ...(legacyMetaWs ? parseLegacyMetaSheet(legacyMetaWs) : {}),
    ...metaFromQuote,
  };

  const lineLeadMax = Math.max(...items.map((i) => i.leadTimeDays));
  const lineWarrantyMax = Math.max(...items.map((i) => i.warrantyMonths));
  const leadTimeDays = snapToNearestOption(lineLeadMax, LEAD_TIME_DAY_OPTIONS);
  const warrantyMonths = snapToNearestOption(lineWarrantyMax, WARRANTY_MONTH_VALUES);

  const payRaw = parseNumber(meta.payment_terms_percent ?? null);
  const paymentTermsPercent =
    payRaw != null ? snapToNearestOption(Math.round(payRaw), PAYMENT_TERMS_PERCENT_VALUES) : 100;
  if (payRaw == null) {
    warnings.push('Chưa có Điều kiện thanh toán (%) — mặc định 100%');
  }

  return {
    supplierId: supplierMeta.supplierId,
    supplierName: supplierMeta.supplierName,
    quotationNumber: meta.quotation_number?.trim() || null,
    leadTimeDays,
    leadTimeSelect: String(leadTimeDays),
    paymentTermsPercent,
    paymentTermsSelect: String(paymentTermsPercent),
    warrantyMonths,
    warrantySelect: String(warrantyMonths),
    quotationDateYmd,
    deliveryTerms: meta.delivery_terms?.trim() || null,
    validUntil: parseValidUntil(meta.valid_until),
    items,
    warnings,
  };
}
