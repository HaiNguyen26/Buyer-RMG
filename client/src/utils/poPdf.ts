import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../assets/LogoRMG.png';
import type { PoDisplayLang } from './poDisplayLang';

/** Font nhúng cho tiếng Việt (TTF trong `public/fonts/`, OFL — Google Noto Sans). */
export const PO_PDF_FONT = 'NotoSans';

let cachedNotoFontB64: { regular: string; bold: string; italic?: string } | null = null;
let poPdfHasItalicFont = false;

export function poPdfSupportsItalic(): boolean {
  return poPdfHasItalicFont;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Đăng ký Noto Sans lên từng instance jsPDF (VFS theo document).
 * Base64 được cache sau lần fetch đầu tiên.
 */
export async function ensurePoPdfVietnameseFonts(doc: jsPDF): Promise<boolean> {
  try {
    if (!cachedNotoFontB64) {
      const base = import.meta.env.BASE_URL || '/';
      const prefix = base.endsWith('/') ? base : `${base}/`;
      const [regRes, boldRes, italicRes] = await Promise.allSettled([
        fetch(`${prefix}fonts/NotoSans-Regular.ttf`),
        fetch(`${prefix}fonts/NotoSans-Bold.ttf`),
        fetch(`${prefix}fonts/NotoSans-Italic.ttf`),
      ]);
      const regOk = regRes.status === 'fulfilled' && regRes.value.ok;
      const boldOk = boldRes.status === 'fulfilled' && boldRes.value.ok;
      const italicOk = italicRes.status === 'fulfilled' && italicRes.value.ok;
      if (!regOk || !boldOk) return false;
      cachedNotoFontB64 = {
        regular: uint8ToBase64(
          new Uint8Array(await (regRes as PromiseFulfilledResult<Response>).value.arrayBuffer())
        ),
        bold: uint8ToBase64(
          new Uint8Array(await (boldRes as PromiseFulfilledResult<Response>).value.arrayBuffer())
        ),
        ...(italicOk
          ? {
              italic: uint8ToBase64(
                new Uint8Array(await (italicRes as PromiseFulfilledResult<Response>).value.arrayBuffer())
              ),
            }
          : {}),
      };
      poPdfHasItalicFont = italicOk;
    }
    doc.addFileToVFS('NotoSans-Regular.ttf', cachedNotoFontB64.regular);
    doc.addFont('NotoSans-Regular.ttf', PO_PDF_FONT, 'normal');
    doc.addFileToVFS('NotoSans-Bold.ttf', cachedNotoFontB64.bold);
    doc.addFont('NotoSans-Bold.ttf', PO_PDF_FONT, 'bold');
    if (cachedNotoFontB64.italic) {
      doc.addFileToVFS('NotoSans-Italic.ttf', cachedNotoFontB64.italic);
      doc.addFont('NotoSans-Italic.ttf', PO_PDF_FONT, 'italic');
    }
    doc.setFont(PO_PDF_FONT, 'normal');
    return true;
  } catch {
    return false;
  }
}

/** Thông tin bên mua cố định trên PO PDF (đồng bộ màn PODetail — layout mẫu Buyer) */
export const PO_PDF_BUYER_COMPANY = {
  company: 'RMG Vietnam Co., Ltd',
  address: '159/59 Tran Van Dang Str., Nhieu Loc Ward, HCM City, VN',
  tel: '+84 28 3931 762',
  taxCode: '0305797333',
  bankName: 'Vietnam International Commercial JS Bank (VIB)',
  bankAddress: '285 CMT8 Str., Hoa Hung Ward, HCM City, VN',
  bankAccount: '601 704 060 175 184 (VND)/ 601 840 060 005 133 (USD)',
};

export type POPdfItem = {
  lineNo: number;
  prItemCode?: string | null;
  description?: string | null;
  qty: number;
  unit?: string | null;
  unitPrice: number;
  amount: number;
};

export type POPdfSupplier = {
  name?: string | null;
  address?: string | null;
  taxCode?: string | null;
  phone?: string | null;
  bankName?: string | null;
  bankAddress?: string | null;
  bankAccount?: string | null;
};

export type POPdfData = {
  poNumber: string;
  prCode?: string | null;
  currency?: string | null;
  totalAmount: number;
  paymentTerms?: string | null;
  deliveryAddress?: string | null;
  incoterms?: string | null;
  projectCode?: string | null;
  deliveryDate?: string | null;
  note?: string | null;
  approvedAt?: string | null;
  supplier?: POPdfSupplier | null;
  items?: POPdfItem[];
  /** Nhãn PDF: `vi` (mặc định) hoặc `en`. */
  locale?: PoDisplayLang;
};

function formatPoPdfDate(d: string | null | undefined, loc: PoDisplayLang): string {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  if (loc === 'vi') {
    return x.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtNumPdf(n: number, loc: PoDisplayLang): string {
  return new Intl.NumberFormat(loc === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 0 }).format(n);
}

type PdfStrings = {
  docTitle: string;
  dateLbl: string;
  orderNoLbl: string;
  versionLbl: string;
  buyerTitle: string;
  supplierTitle: string;
  supCompany: string;
  supAddress: string;
  supPhone: string;
  supTax: string;
  supBank: string;
  supBankAddr: string;
  supBankAcc: string;
  companyColon: string;
  addressColon: string;
  bankNameColon: string;
  bankAddColon: string;
  bankAccColon: string;
  projectRefPrefix: string;
  tableHead: string[];
  termsTitle: string;
  subtotal: string;
  vat8: string;
  total: string;
  warranty: string;
  deliveryAgreed: string;
  deliveryExpectedPrefix: string;
  deliveryAddrPrefix: string;
  notesPrefix: string;
  incotermsPrefix: string;
  paymentPrefix: string;
};

const PDF_STR: Record<PoDisplayLang, PdfStrings> = {
  en: {
    docTitle: 'Purchase Order (PO)',
    dateLbl: 'Date:',
    orderNoLbl: 'Order no.:',
    versionLbl: 'Version:',
    buyerTitle: 'Buyer',
    supplierTitle: 'Supplier',
    supCompany: 'Company',
    supAddress: 'Address',
    supPhone: 'Phone',
    supTax: 'Tax code',
    supBank: 'Bank name',
    supBankAddr: 'Bank address',
    supBankAcc: 'Bank account',
    companyColon: 'Company:',
    addressColon: 'Address:',
    bankNameColon: 'Bank name:',
    bankAddColon: 'Bank add.:',
    bankAccColon: 'Bank acc.:',
    projectRefPrefix: 'Project / reference:',
    tableHead: ['No.', 'PR code', 'Description', 'Notes', 'Qty', 'UoM', 'Unit price', 'Amount'],
    termsTitle: 'Terms & conditions',
    subtotal: 'Subtotal',
    vat8: 'VAT 8%',
    total: 'Total',
    warranty: 'Warranty: Per supplier policy / as agreed in the quotation.',
    deliveryAgreed: 'Delivery: As agreed in this purchase order.',
    deliveryExpectedPrefix: 'Expected delivery:',
    deliveryAddrPrefix: 'Delivery address:',
    notesPrefix: 'Notes:',
    incotermsPrefix: 'Incoterms:',
    paymentPrefix: 'Payment terms:',
  },
  vi: {
    docTitle: 'Đơn đặt hàng (PO)',
    dateLbl: 'Ngày:',
    orderNoLbl: 'Số đơn:',
    versionLbl: 'Phiên bản:',
    buyerTitle: 'Bên mua',
    supplierTitle: 'Nhà cung cấp',
    supCompany: 'Tên',
    supAddress: 'Địa chỉ',
    supPhone: 'Điện thoại',
    supTax: 'MST',
    supBank: 'Ngân hàng',
    supBankAddr: 'Địa chỉ NH',
    supBankAcc: 'Số TK',
    companyColon: 'Công ty:',
    addressColon: 'Địa chỉ:',
    bankNameColon: 'Ngân hàng:',
    bankAddColon: 'Địa chỉ NH:',
    bankAccColon: 'Số tài khoản:',
    projectRefPrefix: 'Dự án / tham chiếu:',
    tableHead: ['STT', 'Mã PR', 'Mô tả', 'Ghi chú', 'SL', 'ĐVT', 'Đơn giá', 'Thành tiền'],
    termsTitle: 'Điều khoản & điều kiện',
    subtotal: 'Tạm tính',
    vat8: 'VAT 8%',
    total: 'Tổng cộng',
    warranty: 'Bảo hành: Theo chính sách NCC / theo báo giá đã thống nhất.',
    deliveryAgreed: 'Giao hàng: Theo thỏa thuận trong đơn đặt hàng.',
    deliveryExpectedPrefix: 'Ngày giao dự kiến:',
    deliveryAddrPrefix: 'Địa chỉ giao hàng:',
    notesPrefix: 'Ghi chú:',
    incotermsPrefix: 'Incoterms:',
    paymentPrefix: 'Điều khoản thanh toán:',
  },
};

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

/** Khoảng cách dòng body (mm) — hơi rộng hơn mặc định để dễ đọc. */
const PDF_LINE_H = 4.1;

function drawBoxSection(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  title: string,
  lines: { label: string; value: string }[],
  fontFamily: string
): number {
  const pad = 3.5;
  const titleH = 8;
  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.setFillColor(230, 230, 230);
  doc.rect(x, y, w, titleH, 'FD');
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(title, x + w / 2, y + titleH / 2 + 1.8, { align: 'center' });

  const cy = y + titleH;
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);
  let textH = pad;
  for (const { label, value } of lines) {
    const block = `${label}: ${value || '—'}`;
    const parts = doc.splitTextToSize(block, w - pad * 2);
    textH += parts.length * PDF_LINE_H;
  }
  const innerH = Math.max(44, textH + pad + 1);
  doc.rect(x, cy, w, innerH);
  let ty = cy + pad + 3.2;
  for (const { label, value } of lines) {
    const block = `${label}: ${value || '—'}`;
    const parts = doc.splitTextToSize(block, w - pad * 2);
    doc.text(parts, x + pad, ty);
    ty += parts.length * PDF_LINE_H;
  }
  return cy + innerH;
}

/** Khối Buyer — nhãn theo locale; công ty RMG màu đỏ. */
function drawBuyerSection(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  fontFamily: string,
  loc: PoDisplayLang
): number {
  const c = PO_PDF_BUYER_COMPANY;
  const S = PDF_STR[loc];
  const pad = 3.5;
  const titleH = 8;
  const lh = PDF_LINE_H;
  const lx = x + pad;
  const maxW = w - pad * 2;

  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.setFillColor(230, 230, 230);
  doc.rect(x, y, w, titleH, 'FD');
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(S.buyerTitle, x + w / 2, y + titleH / 2 + 1.8, { align: 'center' });

  const bodyY = y + titleH;
  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(9);

  const addrParts = doc.splitTextToSize(`${S.addressColon} ${c.address}`, maxW);
  const telTaxLine =
    loc === 'vi'
      ? `Điện thoại: ${c.tel}     MST: ${c.taxCode}`
      : `Tel.: ${c.tel}     Tax code: ${c.taxCode}`;
  const telParts = doc.splitTextToSize(telTaxLine, maxW);
  const bnParts = doc.splitTextToSize(`${S.bankNameColon} ${c.bankName}`, maxW);
  const baParts = doc.splitTextToSize(`${S.bankAddColon} ${c.bankAddress}`, maxW);
  const bacParts = doc.splitTextToSize(`${S.bankAccColon} ${c.bankAccount}`, maxW);

  const contentLines = 1 + addrParts.length + telParts.length + bnParts.length + baParts.length + bacParts.length;
  const innerH = Math.max(40, pad * 2 + 3.5 + contentLines * lh + 2);

  doc.rect(x, bodyY, w, innerH);

  let ty = bodyY + pad + 3.2;

  doc.setFont(fontFamily, 'bold');
  doc.text(S.companyColon, lx, ty);
  const comLabelW = doc.getTextWidth(S.companyColon + ' ');
  doc.setFont(fontFamily, 'normal');
  doc.setTextColor(220, 38, 38);
  doc.text('RMG', lx + comLabelW, ty);
  doc.setTextColor(0, 0, 0);
  doc.text(' Vietnam Co., Ltd', lx + comLabelW + doc.getTextWidth('RMG'), ty);
  ty += lh;

  doc.text(addrParts, lx, ty);
  ty += addrParts.length * lh;
  doc.text(telParts, lx, ty);
  ty += telParts.length * lh;
  doc.text(bnParts, lx, ty);
  ty += bnParts.length * lh;
  doc.text(baParts, lx, ty);
  ty += baParts.length * lh;
  doc.text(bacParts, lx, ty);

  return bodyY + innerH;
}

/**
 * Tải PDF đơn đặt hàng (A4), có logo RMG — nhãn theo `po.locale` (`vi` | `en`).
 * Nhúng Noto Sans từ `/fonts/*.ttf` cho Unicode.
 */
export async function downloadPurchaseOrderPdf(po: POPdfData): Promise<void> {
  const loc: PoDisplayLang = po.locale === 'en' ? 'en' : 'vi';
  const S = PDF_STR[loc];

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  const contentW = pageW - margin * 2;
  let y = margin;

  const [hasNoto, logoData] = await Promise.all([
    ensurePoPdfVietnameseFonts(doc),
    loadImageDataUrl(logoUrl),
  ]);
  const font = hasNoto ? PO_PDF_FONT : 'helvetica';
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', margin, y, 32, 11);
    } catch {
      /* bỏ qua nếu định dạng ảnh không hợp lệ */
    }
  }

  doc.setFont(font, 'bold');
  doc.setFontSize(17);
  doc.setTextColor(35, 55, 85);
  doc.text(S.docTitle, margin + 38, y + 7.2);

  const metaX = pageW - margin - 64;
  const poDateSrc =
    formatPoPdfDate(po.approvedAt, loc) !== '—'
      ? formatPoPdfDate(po.approvedAt, loc)
      : formatPoPdfDate(new Date().toISOString(), loc);
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  let my = y + 2.2;
  doc.text(S.dateLbl, metaX, my);
  doc.text(poDateSrc, metaX + 26, my);
  my += 4.6;
  doc.text(S.orderNoLbl, metaX, my);
  doc.text(String(po.poNumber || '—'), metaX + 26, my);
  my += 4.6;
  doc.text(S.versionLbl, metaX, my);
  doc.text('1', metaX + 26, my);

  y += 17;

  const half = (contentW - 4) / 2;
  const sup = po.supplier || {};
  const supplierLines = [
    { label: S.supCompany, value: sup.name || '—' },
    { label: S.supAddress, value: sup.address || '—' },
    { label: S.supPhone, value: sup.phone || '—' },
    { label: S.supTax, value: sup.taxCode || '—' },
    { label: S.supBank, value: sup.bankName || '—' },
    { label: S.supBankAddr, value: sup.bankAddress?.trim() || '—' },
    { label: S.supBankAcc, value: sup.bankAccount || '—' },
  ];

  const h1 = drawBuyerSection(doc, margin, y, half, font, loc);
  const h2 = drawBoxSection(doc, margin + half + 4, y, half, S.supplierTitle, supplierLines, font);
  y = Math.max(h1, h2) + 4;

  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.rect(margin, y, contentW, 9);
  doc.setFont(font, 'bold');
  doc.setFontSize(10);
  const proj = po.projectCode?.trim() || po.prCode || '—';
  doc.text(`${S.projectRefPrefix} ${proj}`, margin + 3.5, y + 6.2);
  y += 11;

  const items = po.items ?? [];
  const currency = po.currency || 'VND';
  const body = items.map((it) => [
    String(it.lineNo),
    String(it.prItemCode ?? '—'),
    String(it.description ?? '—'),
    '',
    String(it.qty),
    String(it.unit ?? '—'),
    fmtNumPdf(Number(it.unitPrice), loc),
    fmtNumPdf(Number(it.amount), loc),
  ]);

  autoTable(doc, {
    startY: y,
    head: [S.tableHead],
    body: body.length ? body : [['—', '—', '—', '', '—', '—', '—', '—']],
    theme: 'grid',
    styles: {
      font: font,
      fontSize: 9,
      cellPadding: { top: 2, bottom: 2, left: 1.8, right: 1.8 },
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      font: font,
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 38 },
      3: { cellWidth: 22 },
      4: { cellWidth: 12, halign: 'right' },
      5: { cellWidth: 14 },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 26, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  y = finalY + 7;

  const subtotal = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const vat8 = Math.round(subtotal * 0.08);
  const total = Number(po.totalAmount ?? subtotal + vat8);

  const termsW = contentW * 0.62;
  const termsX = margin;
  const totX = margin + termsW + 6;
  const totW = contentW - termsW - 6;

  const deliveryLine = po.deliveryDate
    ? `${S.deliveryExpectedPrefix} ${formatPoPdfDate(po.deliveryDate, loc)}`
    : S.deliveryAgreed;

  const bullets = [
    `${S.incotermsPrefix} ${po.incoterms?.trim() || '—'}`,
    `${S.paymentPrefix} ${po.paymentTerms?.trim() || '—'}`,
    deliveryLine,
    S.warranty,
  ];
  if (po.deliveryAddress?.trim()) {
    bullets.push(`${S.deliveryAddrPrefix} ${po.deliveryAddress.trim()}`);
  }
  if (po.note?.trim()) {
    bullets.push(`${S.notesPrefix} ${po.note.trim()}`);
  }

  const TERMS_LINE = 4;
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  let termsTextH = 9;
  for (const b of bullets) {
    const wrapped = doc.splitTextToSize(`• ${b}`, termsW - 5);
    termsTextH += wrapped.length * TERMS_LINE;
  }
  const termsH = Math.max(36, termsTextH + 5);

  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.rect(termsX, y, termsW, termsH);
  doc.setFont(font, 'bold');
  doc.setFontSize(10);
  doc.text(S.termsTitle, termsX + 2.5, y + 5.8);
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  let ly = y + 10.5;
  for (const b of bullets) {
    const wrapped = doc.splitTextToSize(`• ${b}`, termsW - 5);
    doc.text(wrapped, termsX + 2.5, ly);
    ly += wrapped.length * TERMS_LINE;
  }

  doc.rect(totX, y, totW, termsH);
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  let ty = y + 7;
  const row = (label: string, val: string, bold = false) => {
    doc.setFont(font, bold ? 'bold' : 'normal');
    doc.text(label, totX + 2.5, ty);
    doc.text(val, totX + totW - 2.5, ty, { align: 'right' });
    ty += 5.6;
  };
  row(S.subtotal, fmtNumPdf(subtotal, loc));
  row(S.vat8, fmtNumPdf(vat8, loc));
  row(S.total, `${fmtNumPdf(total, loc)} ${currency}`, true);

  const safeName = String(po.poNumber || 'PO').replace(/[^\w.-]+/g, '_');
  doc.save(`PO_${safeName}_${loc.toUpperCase()}.pdf`);
}
