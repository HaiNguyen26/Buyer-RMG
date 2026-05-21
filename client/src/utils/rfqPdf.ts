import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../assets/LogoRMG.png';
import { ensurePoPdfVietnameseFonts, PO_PDF_FONT } from './poPdf';

const RMG_RED: [number, number, number] = [200, 32, 48];
const MARGIN = 12;

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('read'));
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const SECTION_BAR_H_MM = 6;
/** Khoảng cách giữa thanh tiêu đề đỏ và nội dung phía dưới (tránh chữ dính sát) */
const SECTION_BAR_GAP_MM = 5.5;

function sectionBar(doc: jsPDF, font: string, y: number, title: string): number {
  const pageW = doc.internal.pageSize.getWidth();
  const w = pageW - MARGIN * 2;
  doc.setFillColor(RMG_RED[0], RMG_RED[1], RMG_RED[2]);
  doc.rect(MARGIN, y, w, SECTION_BAR_H_MM, 'F');
  doc.setFont(font, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(title, MARGIN + 2, y + 4.2);
  doc.setTextColor(0, 0, 0);
  return y + SECTION_BAR_H_MM + SECTION_BAR_GAP_MM;
}

function kvBlock(doc: jsPDF, font: string, y: number, lines: [string, string][]): number {
  doc.setFont(font, 'normal');
  doc.setFontSize(8.5);
  let cy = y + 0.8;
  for (const [k, v] of lines) {
    const text = `${k}: ${v || '—'}`;
    const parts = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - MARGIN * 2);
    doc.text(parts, MARGIN, cy);
    cy += parts.length * 3.8;
  }
  return cy + 2;
}

export type RfqPdfItemRow = {
  lineNo: number;
  itemName: string;
  internalCode: string;
  specification: string;
  unit: string;
  qty: string;
  expectedDelivery: string;
  note: string;
};

export type RfqPdfInput = {
  rfqNumber: string;
  documentDate: string;
  companyName: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  salesOrderCode: string;
  department: string;
  requestedBy: string;
  deliveryDeadline: string;
  deliveryLocation: string;
  /** Buyer chọn (date) — client gửi đã format dd/mm/yyyy */
  expectedReceiptFromVendor: string;
  items: RfqPdfItemRow[];
  currency: string;
  paymentTerms: string;
  deliveryTerms: string;
  responseDeadline: string;
  responseEmail: string;
  /** Ghi chú thương mại do Buyer nhập */
  noteForSupplier: string;
  /** NCC nhận RFQ — hiển thị trên PDF và tiêu đề email */
  supplierName: string;
  supplierCode?: string;
};

/**
 * PDF mẫu RFQ (tiếng Việt + tiêu đề EN), logo RMG, font Noto như PO PDF.
 */
export async function downloadRfqPdf(input: RfqPdfInput): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - MARGIN * 2;

  const [hasNoto, logoData] = await Promise.all([
    ensurePoPdfVietnameseFonts(doc),
    loadImageDataUrl(logoUrl),
  ]);
  const font = hasNoto ? PO_PDF_FONT : 'helvetica';

  let y = MARGIN;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', MARGIN, y, 36, 12);
    } catch {
      /* ignore */
    }
  }

  doc.setFont(font, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(RMG_RED[0], RMG_RED[1], RMG_RED[2]);
  doc.text('REQUEST FOR QUOTATION (RFQ)', MARGIN + 42, y + 6);
  doc.setTextColor(0, 0, 0);

  y += 14;
  doc.setFont(font, 'normal');
  doc.setFontSize(8.5);
  doc.text(`RFQ No: ${input.rfqNumber}`, MARGIN, y);
  y += 4;
  doc.text(`Date: ${input.documentDate}`, MARGIN, y);
  y += 4;
  doc.text(`Company: ${input.companyName}`, MARGIN, y);
  y += 4;
  if (input.supplierName?.trim()) {
    const toLine = input.supplierCode?.trim()
      ? `To: ${input.supplierName.trim()} (${input.supplierCode.trim()})`
      : `To: ${input.supplierName.trim()}`;
    const toParts = doc.splitTextToSize(toLine, contentW);
    doc.text(toParts, MARGIN, y);
    y += toParts.length * 3.8;
  }
  const contactLine = `Contact: ${input.buyerName} – ${input.buyerEmail}${input.buyerPhone ? ` – ${input.buyerPhone}` : ''}`;
  const contactParts = doc.splitTextToSize(contactLine, contentW);
  doc.text(contactParts, MARGIN, y);
  y += contactParts.length * 3.8 + 4;

  y = sectionBar(doc, font, y, '1. Thông tin chung');
  y = kvBlock(doc, font, y, [
    ['Nhà cung cấp (NCC)', input.supplierName?.trim() || '—'],
    ['Sales Order (SO)', input.salesOrderCode],
    ['Department', input.department],
    ['Requested by', input.requestedBy],
    ['Delivery Deadline', input.deliveryDeadline],
    ['Delivery Location', input.deliveryLocation],
    ['Ngày dự kiến nhận hàng từ NCC', input.expectedReceiptFromVendor],
    ['Hạn nhận báo giá', input.responseDeadline],
  ]);

  y = sectionBar(doc, font, y, '2. Danh sách yêu cầu báo giá');
  const items = input.items.length
    ? input.items
    : [
        {
          lineNo: 1,
          itemName: '',
          internalCode: '',
          specification: '',
          unit: '',
          qty: '',
          expectedDelivery: '',
          note: '',
        },
      ];

  autoTable(doc, {
    startY: y,
    head: [
      [
        'No',
        'Item Name',
        'Internal Code',
        'Specification',
        'Unit',
        'Qty',
        'Expected Delivery',
        'Note',
      ],
    ],
    body: items.map((it) => [
      String(it.lineNo),
      it.itemName || '',
      it.internalCode || '',
      it.specification || '',
      it.unit || '',
      it.qty || '',
      it.expectedDelivery || '',
      it.note || '',
    ]),
    theme: 'grid',
    styles: {
      font,
      fontSize: 7,
      cellPadding: 1.2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      font,
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 22 },
      3: { cellWidth: 32 },
      4: { cellWidth: 12 },
      5: { cellWidth: 12, halign: 'right' },
      6: { cellWidth: 22 },
      7: { cellWidth: 22 },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  let tableY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
  y = tableY + 6;

  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 50) {
    doc.addPage();
    y = MARGIN;
  }

  y = sectionBar(doc, font, y, '3. Yêu cầu NCC báo giá');
  doc.setFont(font, 'normal');
  doc.setFontSize(8);
  const intro = doc.splitTextToSize('Vui lòng cung cấp đầy đủ các thông tin sau:', contentW);
  doc.text(intro, MARGIN, y);
  y += intro.length * 3.8 + 2;

  autoTable(doc, {
    startY: y,
    head: [
      [
        'No',
        'Item',
        'Unit Price',
        'Total Price',
        'Brand',
        'Origin',
        'Lead Time',
        'MOQ',
        'Warranty',
        'Note',
      ],
    ],
    body: items.map((it) => [
      String(it.lineNo),
      it.itemName || '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]),
    theme: 'grid',
    styles: {
      font,
      fontSize: 6.5,
      cellPadding: 1,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      font,
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 18 },
      3: { cellWidth: 18 },
      4: { cellWidth: 14 },
      5: { cellWidth: 14 },
      6: { cellWidth: 16 },
      7: { cellWidth: 12 },
      8: { cellWidth: 16 },
      9: { cellWidth: 18 },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  tableY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
  y = tableY + 6;

  if (y > pageH - 55) {
    doc.addPage();
    y = MARGIN;
  }

  y = sectionBar(doc, font, y, '4. Điều kiện thương mại');
  const commercialLines: [string, string][] = [
    ['Currency', input.currency],
    ['Payment Terms', input.paymentTerms],
    ['Delivery Terms', input.deliveryTerms],
  ];
  if (input.noteForSupplier?.trim()) {
    commercialLines.push(['Ghi chú cho NCC', input.noteForSupplier.trim()]);
  }
  y = kvBlock(doc, font, y, commercialLines);

  y = sectionBar(doc, font, y, '5. Hướng dẫn phản hồi');
  y = kvBlock(doc, font, y, [
    ['Email về', input.responseEmail],
    [
      'Tiêu đề email',
      `${input.rfqNumber} – Quotation – ${input.supplierName?.trim() || '[Tên NCC]'}`,
    ],
  ]);

  if (y > pageH - 45) {
    doc.addPage();
    y = MARGIN;
  }

  y = sectionBar(doc, font, y, '6. Ghi chú');
  doc.setFont(font, 'normal');
  doc.setFontSize(8);
  const bullets = [
    '• Báo giá phải bao gồm đầy đủ chi phí (thuế, vận chuyển nếu có)',
    '• NCC ghi rõ thời gian giao hàng thực tế',
    '• Công ty có quyền lựa chọn NCC phù hợp nhất, không nhất thiết là giá thấp nhất',
  ];
  for (const b of bullets) {
    const parts = doc.splitTextToSize(b, contentW);
    doc.text(parts, MARGIN, y);
    y += parts.length * 3.8;
  }
  y += 4;

  doc.setFont(font, 'bold');
  doc.text('Người phụ trách:', MARGIN, y);
  y += 5;
  doc.setFont(font, 'normal');
  doc.text(input.buyerName || '—', MARGIN, y);

  const safeName = input.rfqNumber.replace(/[/\\?%*:|"<>]/g, '-');
  doc.save(`RFQ_${safeName}.pdf`);
}

export function formatDdMmYyyy(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Ngày trễ nhất (max) trong các `desiredDeliveryDate` yyyy-mm-dd của từng dòng. */
export function maxDesiredDeliveryDateIso(
  lines: Array<{ desiredDeliveryDate?: string | null | undefined }>
): string {
  let maxMs = -Infinity;
  for (const line of lines) {
    const raw = line?.desiredDeliveryDate;
    if (raw == null || !String(raw).trim()) continue;
    const t = String(raw).trim().slice(0, 10);
    const parts = t.split('-').map((x) => Number(x));
    if (parts.length !== 3) continue;
    const [y, mo, d] = parts;
    if (!y || !mo || !d || mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    const ms = new Date(y, mo - 1, d).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms > maxMs) maxMs = ms;
  }
  if (!Number.isFinite(maxMs) || maxMs === -Infinity) return '';
  const dt = new Date(maxMs);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Mục 1 PDF — ngày trễ nhất trong danh sách dòng (+ buffer). */
export function formatExpectedReceiptFromVendorDdMmYyyy(
  lines: Array<{ desiredDeliveryDate?: string | null | undefined }>,
  prRequiredDate?: string | null,
  bufferDays = 2
): string {
  const latest =
    maxDesiredDeliveryDateIso(lines) ||
    (prRequiredDate ? String(prRequiredDate).trim().slice(0, 10) : '');
  return formatExpectedDeliveryDdMmYyyy(latest, bufferDays);
}

/** Expected delivery trên RFQ PDF: ngày requestor nhập + buffer (mặc định 2 ngày trừ hao). */
export function formatExpectedDeliveryDdMmYyyy(
  iso: string | null | undefined,
  bufferDays = 2
): string {
  if (!iso) return '';
  const raw = String(iso).trim();
  let y: number;
  let m: number;
  let d: number;
  const ymd = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    [y, m, d] = ymd.split('-').map(Number);
  } else {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    y = parsed.getUTCFullYear();
    m = parsed.getUTCMonth() + 1;
    d = parsed.getUTCDate();
  }
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + bufferDays);
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = utc.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
