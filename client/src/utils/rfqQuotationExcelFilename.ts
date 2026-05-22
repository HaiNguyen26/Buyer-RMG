/** Khớp server `buildRfqQuotationExcelFilename` — tên file khi tải mẫu Excel RFQ. */
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

export function parseFilenameFromContentDisposition(cd: string): string | null {
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (utf8?.[1]) return decodeURIComponent(utf8[1]);
  const plain = /filename="([^"]+)"/.exec(cd);
  if (plain?.[1]) return plain[1];
  const unquoted = /filename=([^;\s]+)/i.exec(cd);
  if (unquoted?.[1]) return unquoted[1].replace(/^"|"$/g, '');
  return null;
}
