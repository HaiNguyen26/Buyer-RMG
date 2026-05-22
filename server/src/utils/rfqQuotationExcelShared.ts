/** Sheet — chỉ 2 tab: hướng dẫn + báo giá. */
export const RFQ_GUIDE_SHEET = 'huong_dan';
export const RFQ_QUOTE_SHEET = 'bao_gia';

/** Cột ẩn hàng tiêu đề sheet bao_gia — supplier_id để import tự nhận NCC. */
export const RFQ_QUOTE_SUPPLIER_ID_COL = 13;

export type RfqNccQuoteLineRow = {
  purchase_request_item_id: string;
  no: number;
  item: string;
  qty: number | '';
  unit: string;
  unit_price: '' | number;
  vat_percent: '' | number;
  brand: '' | string;
  origin: '' | string;
  lead_time: '' | string; // Ngày giao NCC dd/mm/yyyy
  moq: '' | string;
  warranty: '' | string; // Bảo hành tháng (vd 12 hoặc 12 tháng)
  note: '' | string;
};

export const RFQ_QUOTE_COLUMN_NOTES: Partial<Record<keyof RfqNccQuoteLineRow, string>> = {
  qty: 'Số lượng báo giá. Mặc định theo yêu cầu — sửa nếu khác.',
  unit: 'Đơn vị tính (cái, bộ, kg...).',
  unit_price: 'Đơn giá chưa VAT (VND). Bắt buộc. Ví dụ: 1500000.',
  vat_percent: '% VAT trên dòng: 3, 5, 8 hoặc 10. Để trống = 10%.',
  brand: 'Thương hiệu / hãng sản xuất (nếu có).',
  origin: 'Xuất xứ hàng hóa.',
  lead_time:
    'Ngày giao NCC (dd/mm/yyyy) — điền sẵn theo yêu cầu buyer; NCC sửa nếu khác. Lead time = từ ngày nhập BG.',
  moq: 'MOQ — số lượng đặt tối thiểu.',
  warranty: 'Bảo hành dòng (tháng): 0, 3, 6, 12...',
  note: 'Ghi chú thêm cho dòng hàng.',
};

export const RFQ_QUOTE_DISPLAY_HEADERS = [
  'No',
  'Item',
  'Qty',
  'Unit',
  'Unit Price (VND)',
  'VAT %',
  'Brand',
  'Origin',
  'Delivery Date',
  'MOQ',
  'Warranty',
  'Note',
] as const;

export const RFQ_QUOTE_HEADER_HINTS: readonly string[] = [
  'STT',
  'Mô tả — không sửa',
  'SL — sửa nếu khác YC',
  'ĐVT',
  '▼ Bắt buộc: VND chưa VAT',
  '▼ 3 / 5 / 8 / 10 (trống=10)',
  'Hãng SX',
  'Xuất xứ',
  'Ngày buyer → NCC sửa',
  'MOQ tối thiểu',
  '▼ BH (tháng)',
  'Ghi chú thêm',
];

export const RFQ_QUOTE_COLUMN_KEYS: Array<keyof RfqNccQuoteLineRow> = [
  'no',
  'item',
  'qty',
  'unit',
  'unit_price',
  'vat_percent',
  'brand',
  'origin',
  'lead_time',
  'moq',
  'warranty',
  'note',
  'purchase_request_item_id',
];

export const RFQ_QUOTE_HIDDEN_COL_KEY: keyof RfqNccQuoteLineRow = 'purchase_request_item_id';

/** Khối điều kiện thương mại trên sheet bao_gia (cột A = field_name, B = giá trị). */
export const RFQ_QUOTE_COMMERCIAL_FIELDS = [
  {
    key: 'quotation_number',
    label: 'Số báo giá NCC',
    hint: 'Số trên báo giá của NCC (nếu có).',
  },
  {
    key: 'payment_terms_percent',
    label: 'Thanh toán (%)',
    hint: '% thanh toán / tạm ứng (vd: 30, 50, 100).',
  },
  {
    key: 'delivery_terms',
    label: 'Điều kiện giao hàng',
    hint: 'Incoterm, địa điểm giao...',
  },
  {
    key: 'valid_until',
    label: 'Hạn hiệu lực BG',
    hint: 'dd/mm/yyyy',
  },
] as const;

export type RfqQuoteCommercialKey = (typeof RFQ_QUOTE_COMMERCIAL_FIELDS)[number]['key'];

export const LEAD_TIME_DAY_OPTIONS = [1, 3, 5, 7, 14, 21, 30, 45, 60, 90] as const;
export const PAYMENT_TERMS_PERCENT_VALUES = [0, 10, 20, 30, 50, 70, 100] as const;
export const WARRANTY_MONTH_VALUES = [0, 3, 6, 12, 18, 24, 36] as const;

export const VND_INTEGER_EXCEL_NUMFMT = '#.##0';

export function snapToNearestOption(value: number, options: readonly number[]): number {
  if (!Number.isFinite(value) || value < 0) return options[0];
  let best = options[0];
  let bestDist = Math.abs(value - best);
  for (const opt of options) {
    const d = Math.abs(value - opt);
    if (d < bestDist) {
      best = opt;
      bestDist = d;
    }
  }
  return best;
}

/** Độ rộng cột Excel (đơn vị ký tự) — căn theo nhãn tiếng Việt. */
export function excelColumnWidthForLabel(label: string, padding = 2, min = 8): number {
  const len = [...String(label).trim()].length;
  return Math.max(min, len + padding);
}

/** Cột A sheet bao_gia: nhãn điều kiện thương mại + STT. */
export function rfqQuoteColumnAWidth(): number {
  const labels = [
    ...RFQ_QUOTE_COMMERCIAL_FIELDS.map((f) => f.label),
    RFQ_QUOTE_DISPLAY_HEADERS[0],
  ];
  return labels.reduce((max, l) => Math.max(max, excelColumnWidthForLabel(l)), 8);
}

export function rfqQuoteExcelLayout() {
  const titleRow = 1;
  const firstCommercialRow = 2;
  const commercialCount = RFQ_QUOTE_COMMERCIAL_FIELDS.length;
  const snakeRow = firstCommercialRow + commercialCount;
  const headerRow = snakeRow + 1;
  const columnHintRow = headerRow + 1;
  const firstDataRow = columnHintRow + 1;
  return {
    titleRow,
    firstCommercialRow,
    commercialCount,
    snakeRow,
    headerRow,
    columnHintRow,
    firstDataRow,
  };
}
