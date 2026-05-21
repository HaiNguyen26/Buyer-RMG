import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ensurePoPdfVietnameseFonts, poPdfSupportsItalic, PO_PDF_FONT } from './poPdf';
import { normalizeVatPercentString, quotationLineAmounts } from './quotationLine';

type ContractParty = {
  companyName: string;
  address?: string | null;
  phone?: string | null;
  taxCode?: string | null;
  representative?: string | null;
  representativeTitle?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  contactPerson?: string | null;
  email?: string | null;
};

export type PoContractPdfItem = {
  lineNo?: number;
  description?: string | null;
  model?: string | null;
  brand?: string | null;
  unit?: string | null;
  qty: number;
  unitPrice: number;
  amount: number;
  vatPercent?: number | null;
  deliveryEta?: string | null;
};

export type PoContractPdfData = {
  contractNumber: string;
  signedAt: string;
  poNumber: string;
  prRef?: string | null;
  rfqRef?: string | null;
  deliveryDate?: string | null;
  deliveryAddress?: string | null;
  incoterms?: string | null;
  paymentTerms?: string | null;
  partialDeliveryAllowed?: boolean;
  buyer: ContractParty;
  seller: ContractParty;
  items: PoContractPdfItem[];
  totalAmount: number;
  currency?: string | null;
};

const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n);

const safe = (v?: string | null) => (v && v.trim() ? v.trim() : '................................');

/** ISO hoặc yyyy-mm-dd → 「Ngày dd/mm/yyyy」 */
export function formatContractDeliveryDate(raw?: string | null): string {
  if (!raw || !String(raw).trim()) return '................................';
  const s = String(raw).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return `Ngày ${s}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `Ngày ${dd}/${mm}/${yyyy}`;
}

function computeContractTotals(items: PoContractPdfItem[]) {
  let subtotal = 0;
  let vatTotal = 0;
  let grandTotal = 0;
  for (const it of items) {
    const vat = Number(normalizeVatPercentString(it.vatPercent ?? 10));
    const { subtotal: st, vatAmount, total } = quotationLineAmounts(
      Number(it.qty || 0),
      Number(it.unitPrice || 0),
      vat
    );
    subtotal += st;
    vatTotal += vatAmount;
    grandTotal += total;
  }
  return { subtotal, vatTotal, grandTotal };
}

export async function downloadPoContractPdf(data: PoContractPdfData): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const hasVnFont = await ensurePoPdfVietnameseFonts(doc);
  const family = hasVnFont ? PO_PDF_FONT : 'times';
  const currency = data.currency?.trim() || 'VND';
  const totals = computeContractTotals(data.items);

  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = 12;
  const lineH = 4.7;
  const isVietnameseFont = family === PO_PDF_FONT;
  const canUseItalic = !isVietnameseFont || poPdfSupportsItalic();

  const resolveStyle = (opts?: { bold?: boolean; italic?: boolean }) => {
    if (opts?.bold) return 'bold';
    if (opts?.italic) return canUseItalic ? 'italic' : 'normal';
    return 'normal';
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLine = (text: string, opts?: { bold?: boolean; italic?: boolean; indent?: number; gapAfter?: number }) => {
    const indent = opts?.indent ?? 0;
    const gapAfter = opts?.gapAfter ?? 0;
    const style = resolveStyle(opts);
    doc.setFont(family, style);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(text, contentW - indent);
    const blockH = lines.length * lineH;
    ensureSpace(blockH + gapAfter);
    doc.text(lines, margin + indent, y);
    y += blockH + gapAfter;
  };

  const writeCenteredItalicBullet = (text: string, gapAfter = 0) => {
    const blockW = Math.min(156, contentW);
    const startX = (pageW - blockW) / 2;
    doc.setFont(family, resolveStyle({ italic: true }));
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(`- ${text}`, blockW);
    const blockH = lines.length * lineH;
    ensureSpace(blockH + gapAfter);
    doc.text(lines, startX, y);
    y += blockH + gapAfter;
  };

  const drawRefHeader = () => {
    doc.setFont(family, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const rows: [string, string][] = [
      ['Số HĐKT / Contract No.', data.contractNumber],
      ['PO Ref', data.poNumber],
      ['PR Ref', data.prRef?.trim() || '—'],
      ['RFQ Ref', data.rfqRef?.trim() || '—'],
      ['Ngày HĐ / Contract date', data.signedAt],
    ];
    let hy = y;
    for (const [label, value] of rows) {
      doc.text(label, margin, hy);
      doc.setFont(family, 'normal');
      doc.text(value, margin + 42, hy);
      doc.setFont(family, 'bold');
      hy += 4.2;
    }
    doc.setTextColor(0, 0, 0);
    y = hy + 2;
    doc.setFontSize(7.5);
    doc.setFont(family, 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text('PO được tạo từ Hệ thống Mua hàng (Procurement System)', margin, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
  };

  doc.setFont(family, 'bold');
  doc.setFontSize(10);
  doc.text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', pageW / 2, y, { align: 'center' });
  y += 5.2;
  doc.text('Độc lập - Tự do - Hạnh phúc', pageW / 2, y, { align: 'center' });
  y += 2.8;
  doc.setLineWidth(0.3);
  doc.line(pageW / 2 - 33, y, pageW / 2 + 33, y);

  y += 9;
  doc.setFontSize(15);
  doc.text('HỢP ĐỒNG KINH TẾ', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10.5);
  doc.setFont(family, resolveStyle({ italic: true }));
  doc.text(`Số: ${data.contractNumber}`, pageW / 2, y, { align: 'center' });

  y += 7;
  drawRefHeader();

  doc.setFontSize(10);
  writeCenteredItalicBullet(
    'Căn cứ bộ luật dân sự số 91/2015/QH13 được Quốc hội nước Cộng hòa xã hội chủ nghĩa Việt Nam thông qua, có hiệu lực ngày 01 tháng 01 năm 2017.'
  );
  writeCenteredItalicBullet(
    'Căn cứ luật thương mại được Quốc hội nước Cộng hòa xã hội chủ nghĩa Việt Nam khóa XI, kỳ họp thứ 7 thông qua ngày 14 tháng 6 năm 2005, có hiệu lực thi hành từ ngày 01 tháng 01 năm 2006.'
  );
  writeCenteredItalicBullet('Căn cứ vào khả năng và nhu cầu của hai bên.', 2);

  doc.setFontSize(10);
  doc.setFont(family, 'normal');
  ensureSpace(7);
  doc.text(`Hôm nay, ngày ${data.signedAt}, chúng tôi gồm có:`, margin, y);
  y += 7;

  doc.setFont(family, 'bold');
  doc.setFontSize(9.5);
  doc.text(`BÊN MUA (BÊN A): ${safe(data.buyer.companyName)}`, margin, y);
  y += 5;
  doc.setFont(family, 'normal');
  doc.setFontSize(9);
  doc.text(`Địa chỉ: ${safe(data.buyer.address)}`, margin, y);
  y += 4.6;
  doc.text(`Điện thoại: ${safe(data.buyer.phone)}`, margin, y);
  y += 4.6;
  doc.text(
    `Người đại diện: ${safe(data.buyer.representative)}    Chức vụ: ${safe(data.buyer.representativeTitle)}`,
    margin,
    y
  );
  y += 4.6;
  doc.text(`Mã số thuế: ${safe(data.buyer.taxCode)}`, margin, y);

  y += 7;
  doc.setFont(family, 'bold');
  doc.text(`BÊN BÁN (BÊN B): ${safe(data.seller.companyName)}`, margin, y);
  y += 5;
  doc.setFont(family, 'normal');
  doc.text(`Địa chỉ: ${safe(data.seller.address)}`, margin, y);
  y += 4.6;
  doc.text(`Điện thoại: ${safe(data.seller.phone)}`, margin, y);
  y += 4.6;
  const sellerContact = [data.seller.contactPerson, data.seller.email].filter((x) => x?.trim()).join(' · ');
  if (sellerContact) {
    doc.text(`Liên hệ: ${sellerContact}`, margin, y);
    y += 4.6;
  }
  doc.text(
    `Người đại diện: ${safe(data.seller.representative)}    Chức vụ: ${safe(data.seller.representativeTitle)}`,
    margin,
    y
  );
  y += 4.6;
  doc.text(`Mã số thuế: ${safe(data.seller.taxCode)}`, margin, y);
  y += 4.6;
  doc.text(`Số TK ngân hàng: ${safe(data.seller.bankAccount)} - ${safe(data.seller.bankName)}`, margin, y);

  y += 8;
  doc.setFont(family, 'bold');
  doc.setFontSize(10);
  doc.text('ĐIỀU 1. HÀNG HÓA VÀ GIÁ CẢ', margin, y);
  y += 4.5;

  const tableBody = data.items.map((item, index) => {
    const vat = normalizeVatPercentString(item.vatPercent ?? 10);
    const { total } = quotationLineAmounts(
      Number(item.qty || 0),
      Number(item.unitPrice || 0),
      Number(vat)
    );
    return [
      String(index + 1),
      item.description || '—',
      item.model?.trim() || '—',
      item.brand?.trim() || '—',
      item.unit || '—',
      fmt(Number(item.qty || 0)),
      fmt(Number(item.unitPrice || 0)),
      `${vat}%`,
      formatContractDeliveryDate(item.deliveryEta),
      fmt(total),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: contentW,
    styles: {
      font: family,
      fontSize: 7,
      lineColor: [40, 40, 40],
      lineWidth: 0.15,
      cellPadding: 1.4,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 6.5,
    },
    head: [
      [
        'STT',
        'Tên hàng hóa',
        'Model',
        'Hãng',
        'ĐVT',
        'SL',
        'Đơn giá',
        'VAT',
        'ETA giao',
        'Thành tiền',
      ],
    ],
    body: tableBody,
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 16 },
      3: { cellWidth: 16 },
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 10, halign: 'right' },
      6: { cellWidth: 18, halign: 'right' },
      7: { cellWidth: 10, halign: 'center' },
      8: { cellWidth: 22 },
      9: { cellWidth: 20, halign: 'right' },
    },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
  y += 4;

  const totX = pageW - margin - 72;
  const totW = 72;
  const totH = 22;
  ensureSpace(totH + 4);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.rect(totX, y, totW, totH);
  doc.setFont(family, 'normal');
  doc.setFontSize(9);
  let ty = y + 5.5;
  const totRow = (label: string, val: string, bold = false) => {
    doc.setFont(family, bold ? 'bold' : 'normal');
    doc.text(label, totX + 2.5, ty);
    doc.text(val, totX + totW - 2.5, ty, { align: 'right' });
    ty += 5.2;
  };
  totRow('Subtotal:', `${fmt(totals.subtotal)} ${currency}`);
  totRow('VAT:', `${fmt(totals.vatTotal)} ${currency}`);
  totRow('Grand Total:', `${fmt(totals.grandTotal)} ${currency}`, true);

  y += totH + 6;

  const paymentDisplay = data.paymentTerms?.trim()
    ? data.paymentTerms.trim()
    : 'Thanh toán theo điều khoản ghi trên PO (chuyển khoản ngân hàng).';

  writeLine('ĐIỀU 2. CHẤT LƯỢNG HÀNG HÓA VÀ QUY CÁCH ĐÓNG GÓI', { bold: true, gapAfter: 1 });
  writeLine('2.1. Chất lượng hàng hóa:', { bold: true });
  writeLine('- Hàng hóa bảo đảm mới 100%, đúng chủng loại theo PO.');
  writeLine('- Xuất xứ: theo thông tin thỏa thuận giữa hai bên.');
  writeLine('- Bảo hành: theo chính sách của nhà sản xuất.', { gapAfter: 1.5 });
  writeLine('2.2. Quy cách đóng gói hàng hóa:', { bold: true });
  writeLine('- Bao bì đóng gói nguyên đai, nguyên kiện theo tiêu chuẩn nhà sản xuất.', { gapAfter: 2.2 });

  writeLine('ĐIỀU 3. ĐIỀU KIỆN VÀ THỜI GIAN GIAO HÀNG', { bold: true, gapAfter: 1 });
  writeLine(`- Điều kiện giao hàng (Incoterms): ${safe(data.incoterms)}`);
  writeLine(`- Địa điểm giao hàng: ${safe(data.deliveryAddress || data.buyer.address)}`);
  writeLine(`- Thời gian giao hàng: ${formatContractDeliveryDate(data.deliveryDate)}`);
  writeLine(
    `- Giao hàng từng phần: ${data.partialDeliveryAllowed !== false ? 'Được phép (theo từng đợt)' : 'Không'}`,
    { gapAfter: 2.2 }
  );

  writeLine('ĐIỀU 4. PHƯƠNG THỨC GIAO NHẬN', { bold: true, gapAfter: 1 });
  writeLine('- Bên mua có trách nhiệm cử người nhận hàng tại địa điểm như hai bên đã thỏa thuận.');
  writeLine('- Khi nhận hàng, bên mua có trách nhiệm kiểm tra chất lượng, quy cách hàng hóa theo cam kết của bên bán.');
  writeLine('- Hàng khi giao nhận phải có biên bản giao nhận được đại diện bên mua và bên bán ký nhận.', { gapAfter: 2.2 });

  writeLine('ĐIỀU 5. HÌNH THỨC, PHƯƠNG THỨC THANH TOÁN', { bold: true, gapAfter: 1 });
  writeLine('5.1. Hình thức thanh toán:', { bold: true });
  writeLine('- Hình thức: Chuyển khoản ngân hàng.');
  writeLine('- Thanh toán bằng: Tiền đồng Việt Nam.');
  writeLine('5.2. Điều khoản thanh toán:', { bold: true });
  writeLine(`- ${paymentDisplay}`);
  writeLine(
    `- Tổng giá trị thanh toán tương ứng Grand Total: ${fmt(totals.grandTotal)} ${currency} (đã tách Subtotal và VAT ở Điều 1).`
  );
  writeLine('5.3. Bộ chứng từ thanh toán bao gồm:', { bold: true });
  writeLine('- Hóa đơn tài chính hợp lệ theo quy định của Bộ Tài chính.');
  writeLine('- Biên bản giao nhận và nghiệm thu hàng hóa.');
  writeLine('- Đề nghị thanh toán.', { gapAfter: 2.2 });

  writeLine('ĐIỀU 6. TRÁCH NHIỆM CỦA CÁC BÊN', { bold: true, gapAfter: 1 });
  writeLine('6.1. Bên Bán:', { bold: true });
  writeLine('- Đảm bảo cung cấp hàng hóa đúng chủng loại, chất lượng, tiêu chuẩn kỹ thuật và nguồn gốc xuất xứ theo yêu cầu bên mua.');
  writeLine('- Thực hiện đúng các cam kết được ghi trong Hợp đồng.');
  writeLine('6.2. Bên Mua:', { bold: true });
  writeLine('- Cung cấp đầy đủ thông tin về chủng loại hàng hóa, các yêu cầu kỹ thuật cần thiết cho Bên Bán.');
  writeLine('- Đảm bảo thanh toán đúng thời hạn đã thỏa thuận trong Hợp đồng này.');
  writeLine('- Thực hiện đúng các cam kết được ghi trong Hợp đồng.', { gapAfter: 2.2 });

  writeLine('ĐIỀU 7. ĐIỀU KIỆN CHUNG', { bold: true, gapAfter: 1 });
  writeLine(
    '- Hai Bên cam kết thực hiện đúng những điều ghi trên Hợp đồng. Nếu một trong hai Bên có ý vi phạm các điều khoản của Hợp đồng sẽ phải chịu trách nhiệm vật chất về các hành vi vi phạm đó.'
  );
  writeLine(
    '- Mọi trường hợp sửa đổi bổ sung hợp đồng đều phải được sự thống nhất của hai bên và phải được lập thành văn bản có chữ ký của người đại diện hợp pháp của hai bên.'
  );
  writeLine(
    '- Trong trường hợp xảy ra tranh chấp, hai Bên cố gắng cùng nhau bàn bạc các biện pháp giải quyết trên tinh thần thỏa thuận, có thiện chí và hợp tác.'
  );
  writeLine(
    '- Nếu vẫn không thống nhất cách giải quyết thì hai Bên sẽ đưa vụ việc ra Tòa án Kinh tế có thẩm quyền, toàn bộ chi phí xét xử do Bên thua kiện chịu.'
  );
  writeLine('- Các sửa đổi, bổ sung được coi như các phụ lục và là một phần không thể tách rời của Hợp đồng này.', {
    gapAfter: 2.2,
  });

  writeLine('ĐIỀU 8. HIỆU LỰC CỦA HỢP ĐỒNG', { bold: true, gapAfter: 1 });
  writeLine('- Hợp đồng có hiệu lực kể từ ngày hai bên ký.');
  writeLine(
    '- Trong trường hợp hợp đồng đã được thực hiện và hai bên đã hoàn tất đầy đủ các nghĩa vụ của mình theo thỏa thuận thì hợp đồng coi như được thanh lý.'
  );
  writeLine('- Hợp đồng này được lập thành 04 bản, mỗi bên giữ 02 bản có giá trị pháp lý như nhau.', { gapAfter: 7 });

  ensureSpace(26);
  doc.setFont(family, 'bold');
  doc.setFontSize(10);
  doc.text('BÊN MUA', margin + 25, y, { align: 'center' });
  doc.text('BÊN BÁN', pageW - margin - 25, y, { align: 'center' });

  const safeName = String(data.poNumber || 'PO').replace(/[^\w.-]+/g, '_');
  doc.save(`Hop-dong-${safeName}.pdf`);
}
