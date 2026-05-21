/**
 * Các lựa chọn chuẩn cho đánh giá NCC (điều kiện thanh toán, bảo hành, lead time).
 * Hệ thống dùng các giá trị này để so sánh và đánh giá nhà cung cấp.
 */

/** Điều kiện thanh toán: % làm tròn (tỷ lệ thanh toán / tiến độ) */
export const PAYMENT_TERMS_PERCENT_OPTIONS = [
  { value: '', label: '-- Chọn điều kiện thanh toán --' },
  { value: '0', label: '0%' },
  { value: '10', label: '10%' },
  { value: '20', label: '20%' },
  { value: '30', label: '30%' },
  { value: '50', label: '50%' },
  { value: '70', label: '70%' },
  { value: '100', label: '100%' },
] as const;

/** Bảo hành: theo tháng */
export const WARRANTY_MONTHS_OPTIONS = [
  { value: '', label: '-- Chọn bảo hành --' },
  { value: '0', label: '0 tháng' },
  { value: '3', label: '3 tháng' },
  { value: '6', label: '6 tháng' },
  { value: '12', label: '12 tháng' },
  { value: '18', label: '18 tháng' },
  { value: '24', label: '24 tháng' },
  { value: '36', label: '36 tháng' },
] as const;

/** VAT trên báo giá NCC (theo dòng hoặc áp dụng tất cả) */
export const VAT_PERCENT_OPTIONS = [
  { value: '3', label: '3%' },
  { value: '5', label: '5%' },
  { value: '8', label: '8%' },
  { value: '10', label: '10%' },
] as const;

export const DEFAULT_VAT_PERCENT = '10';

/** Lead time: theo ngày */
export const LEAD_TIME_DAYS_OPTIONS = [
  { value: '', label: '-- Chọn lead time --' },
  { value: '1', label: '1 ngày' },
  { value: '3', label: '3 ngày' },
  { value: '5', label: '5 ngày' },
  { value: '7', label: '7 ngày' },
  { value: '14', label: '14 ngày' },
  { value: '21', label: '21 ngày' },
  { value: '30', label: '30 ngày' },
  { value: '45', label: '45 ngày' },
  { value: '60', label: '60 ngày' },
  { value: '90', label: '90 ngày' },
] as const;

/** So sánh giá PR vs RFQ: ngưỡng % chênh lệch */
export const PRICE_COMPARISON_THRESHOLD_OK = 0;       // <= 0%: OK (xanh)
export const PRICE_COMPARISON_THRESHOLD_WARN = 10;   // 0–10%: Sát ngưỡng (vàng), >10%: Vượt (đỏ)
