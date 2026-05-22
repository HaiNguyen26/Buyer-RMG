import ExcelJS from 'exceljs';
import type { PurchaseRequestItem } from '@prisma/client';
import {
  desiredDeliveryDateToYmd,
  formatYmdToDdMmYyyy,
  parseDeliveryDateInput,
} from './quotationLeadTime';
import {
  RFQ_GUIDE_SHEET,
  RFQ_QUOTE_COLUMN_KEYS,
  RFQ_QUOTE_COLUMN_NOTES,
  RFQ_QUOTE_COMMERCIAL_FIELDS,
  RFQ_QUOTE_DISPLAY_HEADERS,
  RFQ_QUOTE_HEADER_HINTS,
  RFQ_QUOTE_HIDDEN_COL_KEY,
  RFQ_QUOTE_SHEET,
  RFQ_QUOTE_SUPPLIER_ID_COL,
  VND_INTEGER_EXCEL_NUMFMT,
  rfqQuoteColumnAWidth,
  rfqQuoteExcelLayout,
  type RfqNccQuoteLineRow,
} from './rfqQuotationExcelShared';

export type { RfqNccQuoteLineRow } from './rfqQuotationExcelShared';

export function sanitizeExcelFilenamePart(raw: string, maxLen = 60): string {
  const s = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return (s || 'NCC').slice(0, maxLen);
}

export function buildRfqQuotationExcelFilename(rfqNumber: string, supplierName: string): string {
  const ncc = sanitizeExcelFilenamePart(supplierName);
  const rfq = sanitizeExcelFilenamePart(rfqNumber.replace(/\s+/g, '-'));
  return `RFQ_${rfq}_${ncc}_bao_gia.xlsx`;
}

function formatItemLabel(item: PurchaseRequestItem): string {
  const desc = item.description?.trim() || '';
  const extra = [item.spec?.trim(), item.partNo?.trim()].filter(Boolean).join(' · ');
  if (desc && extra) return `${desc} (${extra})`;
  return desc || extra || '—';
}

export function buildRfqNccQuoteLines(items: PurchaseRequestItem[]): RfqNccQuoteLineRow[] {
  return items.map((item) => {
    const buyerYmd = desiredDeliveryDateToYmd(item.desiredDeliveryDate);
    return {
      purchase_request_item_id: item.id,
      no: item.lineNo,
      item: formatItemLabel(item),
      qty: Number(item.qty) || 0,
      unit: item.unit?.trim() || '',
      unit_price: '',
      vat_percent: '',
      brand: '',
      origin: '',
      lead_time: buyerYmd ? formatYmdToDdMmYyyy(buyerYmd) : '',
      moq: '',
      warranty: '',
      note: '',
    };
  });
}

function styleHeaderRow(row: ExcelJS.Row, bg = 'FF1E40AF') {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: bg },
  };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
}

function setCellComment(cell: ExcelJS.Cell, text: string) {
  cell.note = {
    texts: [{ text }],
    margins: { insetmode: 'auto', inset: [0.1, 0.1, 0.2, 0.2] },
  };
}

const GUIDE_COL_START = 2;
const GUIDE_COL_END = 6;
const GUIDE_RMG_RED = 'FFC82030';
const GUIDE_HEADER_BLUE = 'FF1E40AF';
const GUIDE_BORDER = {
  top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
};

function applyGuideRangeStyle(
  ws: ExcelJS.Worksheet,
  row: number,
  colStart: number,
  colEnd: number,
  fillArgb: string,
  font?: Partial<ExcelJS.Font>
) {
  for (let c = colStart; c <= colEnd; c++) {
    const cell = ws.getCell(row, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
    cell.border = GUIDE_BORDER;
    if (font) cell.font = { ...cell.font, ...font };
    cell.alignment = { vertical: 'middle', wrapText: true };
  }
  ws.mergeCells(row, colStart, row, colEnd);
}

function addGuideSheet(
  wb: ExcelJS.Workbook,
  params: { rfqNumber: string; prNumber: string; supplierName: string }
) {
  const ws = wb.addWorksheet(RFQ_GUIDE_SHEET, {
    properties: { defaultRowHeight: 20 },
    views: [{ showGridLines: false }],
  });
  ws.getColumn(1).width = 2;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 38;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 38;
  ws.getColumn(6).width = 4;

  let row = 1;

  ws.mergeCells(row, GUIDE_COL_START, row, GUIDE_COL_END);
  const banner = ws.getCell(row, GUIDE_COL_START);
  banner.value = 'HƯỚNG DẪN ĐIỀN BÁO GIÁ';
  banner.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  banner.alignment = { horizontal: 'center', vertical: 'middle' };
  banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GUIDE_RMG_RED } };
  ws.getRow(row).height = 36;
  row++;

  ws.mergeCells(row, GUIDE_COL_START, row, GUIDE_COL_END);
  const sub = ws.getCell(row, GUIDE_COL_START);
  sub.value = 'REQUEST FOR QUOTATION — NHÀ CUNG CẤP (NCC)';
  sub.font = { size: 11, color: { argb: 'FFFFE4E6' } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };
  sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
  ws.getRow(row).height = 22;
  row += 2;

  // Thông tin RFQ
  applyGuideRangeStyle(ws, row, GUIDE_COL_START, GUIDE_COL_END, 'FF1E40AF', {
    bold: true,
    size: 11,
    color: { argb: 'FFFFFFFF' },
  });
  ws.getCell(row, GUIDE_COL_START).value = '  THÔNG TIN YÊU CẦU BÁO GIÁ';
  ws.getRow(row).height = 26;
  row++;

  const infoRows: [string, string][] = [
    ['Mã RFQ', params.rfqNumber],
    ['Mã PR', params.prNumber],
    ['Nhà cung cấp', params.supplierName],
  ];
  for (const [label, value] of infoRows) {
    ws.getRow(row).height = 24;
    const labelCell = ws.getCell(row, GUIDE_COL_START);
    labelCell.value = label;
    labelCell.font = { bold: true, size: 10, color: { argb: 'FF475569' } };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    labelCell.border = GUIDE_BORDER;
    labelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    ws.mergeCells(row, GUIDE_COL_START + 1, row, GUIDE_COL_END);
    const valCell = ws.getCell(row, GUIDE_COL_START + 1);
    valCell.value = value;
    valCell.font = { size: 10, color: { argb: 'FF0F172A' } };
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    valCell.border = GUIDE_BORDER;
    valCell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    row++;
  }
  row++;

  // Cấu trúc file
  applyGuideRangeStyle(ws, row, GUIDE_COL_START, GUIDE_COL_END, GUIDE_HEADER_BLUE, {
    bold: true,
    size: 11,
    color: { argb: 'FFFFFFFF' },
  });
  ws.getCell(row, GUIDE_COL_START).value = '  CẤU TRÚC FILE (2 SHEET)';
  ws.getRow(row).height = 26;
  row++;

  const sheets = [
    ['huong_dan', 'Sheet này — chỉ đọc hướng dẫn, không điền dữ liệu.'],
    ['bao_gia', 'Điền toàn bộ báo giá: điều kiện thương mại + bảng hàng.'],
  ];
  for (const [name, desc] of sheets) {
    ws.getRow(row).height = 28;
    ws.getCell(row, GUIDE_COL_START).value = name;
    ws.getCell(row, GUIDE_COL_START).font = {
      bold: true,
      size: 10,
      color: { argb: 'FF1D4ED8' },
    };
    ws.getCell(row, GUIDE_COL_START).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEFF6FF' },
    };
    ws.getCell(row, GUIDE_COL_START).border = GUIDE_BORDER;
    ws.getCell(row, GUIDE_COL_START).alignment = { vertical: 'middle', horizontal: 'center' };

    ws.mergeCells(row, GUIDE_COL_START + 1, row, GUIDE_COL_END);
    const d = ws.getCell(row, GUIDE_COL_START + 1);
    d.value = desc;
    d.font = { size: 10, color: { argb: 'FF334155' } };
    d.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    d.border = GUIDE_BORDER;
    d.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    row++;
  }
  row++;

  // Hướng dẫn sheet bao_gia
  applyGuideRangeStyle(ws, row, GUIDE_COL_START, GUIDE_COL_END, GUIDE_HEADER_BLUE, {
    bold: true,
    size: 11,
    color: { argb: 'FFFFFFFF' },
  });
  ws.getCell(row, GUIDE_COL_START).value = '  CÁCH ĐIỀN SHEET «bao_gia»';
  ws.getRow(row).height = 26;
  row++;

  const steps = [
    'Phần trên (ô vàng): Số báo giá, % thanh toán, Điều kiện giao hàng, Hạn hiệu lực.',
    'Bảng hàng — ô vàng: Đơn giá (VND, chưa VAT), VAT %, Delivery Date (ngày giao — điền sẵn theo yêu cầu buyer; NCC sửa nếu khác), MOQ, Bảo hành, Ghi chú.',
    'Cột No, Item, Qty, Unit: đã điền sẵn — chỉ sửa Qty nếu khác yêu cầu. Delivery Date: dd/mm/yyyy.',
    'Không có cột Total Price — bên mua tự tính thành tiền trên hệ thống.',
    'Đơn giá: số nguyên VND (vd 1500000 → Excel hiển thị 1.500.000).',
    'Không xóa / đổi thứ tự cột; không sửa cột ẩn. Gửi file .xlsx đã điền cho buyer.',
  ];
  steps.forEach((text, idx) => {
    ws.getRow(row).height = 32;
    const numCell = ws.getCell(row, GUIDE_COL_START);
    numCell.value = idx + 1;
    numCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    numCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GUIDE_RMG_RED } };
    numCell.alignment = { horizontal: 'center', vertical: 'middle' };
    numCell.border = GUIDE_BORDER;

    ws.mergeCells(row, GUIDE_COL_START + 1, row, GUIDE_COL_END);
    const textCell = ws.getCell(row, GUIDE_COL_START + 1);
    textCell.value = text;
    textCell.font = { size: 10, color: { argb: 'FF1E293B' } };
    textCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    textCell.border = GUIDE_BORDER;
    textCell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    row++;
  });
  row++;

  // Chú thích màu
  applyGuideRangeStyle(ws, row, GUIDE_COL_START, GUIDE_COL_END, 'FF166534', {
    bold: true,
    size: 11,
    color: { argb: 'FFFFFFFF' },
  });
  ws.getCell(row, GUIDE_COL_START).value = '  Ý NGHĨA MÀU Ô (sheet bao_gia)';
  ws.getRow(row).height = 26;
  row++;

  const legends: [string, string][] = [
    ['FFF8FAFC', 'Xám nhạt — No, Item: có sẵn, không sửa mô tả.'],
    ['FFFFFBEB', 'Vàng — NCC điền (đơn giá, VAT %, thông tin hãng...).'],
    ['FFDCFCE7', 'Xanh lá nhạt — Hàng gợi ý dưới tiêu đề cột (đọc trước khi điền).'],
    ['FFF1F5F9', 'Xám — Nhãn điều kiện thương mại (cột A phần trên).'],
  ];
  for (const [color, label] of legends) {
    ws.getRow(row).height = 22;
    const swatch = ws.getCell(row, GUIDE_COL_START);
    swatch.value = '■';
    swatch.font = { size: 14, color: { argb: 'FF475569' } };
    swatch.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    swatch.border = GUIDE_BORDER;
    swatch.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.mergeCells(row, GUIDE_COL_START + 1, row, GUIDE_COL_END);
    const lbl = ws.getCell(row, GUIDE_COL_START + 1);
    lbl.value = label;
    lbl.font = { size: 10, color: { argb: 'FF334155' } };
    lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    lbl.border = GUIDE_BORDER;
    lbl.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    row++;
  }

  // Footer
  row++;
  ws.mergeCells(row, GUIDE_COL_START, row, GUIDE_COL_END);
  const foot = ws.getCell(row, GUIDE_COL_START);
  foot.value = 'Cảm ơn Quý NCC — vui lòng phản hồi đúng mẫu file để buyer import nhanh.';
  foot.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
  foot.alignment = { horizontal: 'center', vertical: 'middle' };
  foot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  ws.getRow(row).height = 28;
}

function addCommercialBlock(
  ws: ExcelJS.Worksheet,
  layout: ReturnType<typeof rfqQuoteExcelLayout>
) {
  let r = layout.firstCommercialRow;
  for (const field of RFQ_QUOTE_COMMERCIAL_FIELDS) {
    const row = ws.getRow(r++);
    const labelCell = row.getCell(1);
    labelCell.value = field.label;
    labelCell.font = { bold: true, size: 10, color: { argb: 'FF334155' } };
    labelCell.alignment = { vertical: 'middle', shrinkToFit: false, wrapText: false };
    labelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    const valueCell = row.getCell(2);
    valueCell.value = '';
    valueCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFBEB' },
    };
    valueCell.alignment = { vertical: 'middle', wrapText: true };
    if (field.hint) setCellComment(valueCell, field.hint);
    row.getCell(13).value = field.key;
    row.getCell(13).font = { size: 1, color: { argb: 'FFF1F5F9' } };
    row.height = 24;
  }
}

function addColumnHintRow(ws: ExcelJS.Worksheet, layout: ReturnType<typeof rfqQuoteExcelLayout>) {
  const row = ws.getRow(layout.columnHintRow);
  row.height = 34;
  RFQ_QUOTE_HEADER_HINTS.forEach((hint, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = hint;
    cell.font = { italic: true, size: 9, color: { argb: 'FF166534' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDCFCE7' },
    };
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  });
}

export async function buildRfqQuotationExcelBuffer(params: {
  rfqNumber: string;
  prNumber: string;
  supplierId: string;
  supplierName: string;
  lines: RfqNccQuoteLineRow[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Smart Buyer';
  wb.created = new Date();

  addGuideSheet(wb, params);

  const layout = rfqQuoteExcelLayout();
  const colSpan = RFQ_QUOTE_DISPLAY_HEADERS.length;

  const ws = wb.addWorksheet(RFQ_QUOTE_SHEET, {
    views: [{ state: 'frozen', ySplit: layout.columnHintRow }],
  });

  const hiddenIdx = RFQ_QUOTE_COLUMN_KEYS.indexOf(RFQ_QUOTE_HIDDEN_COL_KEY) + 1;
  const unitPriceCol = RFQ_QUOTE_COLUMN_KEYS.indexOf('unit_price') + 1;
  const colWidths = [rfqQuoteColumnAWidth(), 40, 10, 10, 16, 10, 14, 12, 14, 12, 12, 24, 36];

  RFQ_QUOTE_COLUMN_KEYS.forEach((key, i) => {
    const col = ws.getColumn(i + 1);
    col.width = colWidths[i] ?? 14;
    if (i + 1 === hiddenIdx) col.hidden = true;
    if (key === 'unit_price') {
      col.numFmt = VND_INTEGER_EXCEL_NUMFMT;
      col.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });

  ws.mergeCells(layout.titleRow, 1, layout.titleRow, colSpan);
  const titleCell = ws.getCell(layout.titleRow, 1);
  titleCell.value = `BÁO GIÁ  |  RFQ: ${params.rfqNumber}  |  PR: ${params.prNumber}  |  NCC: ${params.supplierName}`;
  titleCell.font = { bold: true, size: 12 };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };
  ws.getRow(layout.titleRow).height = 28;
  const supplierMetaCell = ws.getCell(layout.titleRow, RFQ_QUOTE_SUPPLIER_ID_COL);
  supplierMetaCell.value = params.supplierId;
  supplierMetaCell.font = { size: 1, color: { argb: 'FFE2E8F0' } };

  addCommercialBlock(ws, layout);

  const snakeRow = ws.getRow(layout.snakeRow);
  RFQ_QUOTE_COLUMN_KEYS.forEach((key, idx) => {
    snakeRow.getCell(idx + 1).value = key;
  });
  snakeRow.hidden = true;
  snakeRow.height = 0;

  const visibleColumnKeys = RFQ_QUOTE_COLUMN_KEYS.filter((k) => k !== RFQ_QUOTE_HIDDEN_COL_KEY);
  const headerRow = ws.getRow(layout.headerRow);
  RFQ_QUOTE_DISPLAY_HEADERS.forEach((label, idx) => {
    const colKey = visibleColumnKeys[idx];
    const cell = headerRow.getCell(idx + 1);
    cell.value = label;
    const note = colKey ? RFQ_QUOTE_COLUMN_NOTES[colKey] : undefined;
    if (note) setCellComment(cell, note);
  });
  styleHeaderRow(headerRow);
  headerRow.height = 28;

  addColumnHintRow(ws, layout);

  const leadTimeCol = RFQ_QUOTE_COLUMN_KEYS.indexOf('lead_time') + 1;

  for (const line of params.lines) {
    const row = ws.addRow(
      RFQ_QUOTE_COLUMN_KEYS.map((key) => {
        const v = line[key];
        return v === '' ? '' : v;
      })
    );
    const leadRaw = line.lead_time;
    if (leadRaw && leadTimeCol > 0) {
      const ymd = parseDeliveryDateInput(leadRaw);
      if (ymd) {
        const [y, m, d] = ymd.split('-').map(Number);
        const cell = row.getCell(leadTimeCol);
        cell.value = new Date(y, m - 1, d);
        cell.numFmt = 'dd/mm/yyyy';
      }
    }
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    row.getCell(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' },
    };
    row.getCell(2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' },
    };
    for (let c = 3; c <= RFQ_QUOTE_DISPLAY_HEADERS.length; c++) {
      const cell = row.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' },
      };
      if (c === unitPriceCol) {
        cell.numFmt = VND_INTEGER_EXCEL_NUMFMT;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function excelContentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encoded}`;
}
