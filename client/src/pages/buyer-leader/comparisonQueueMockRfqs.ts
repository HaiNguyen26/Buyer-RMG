/**
 * Dữ liệu demo cho bảng Chọn NCC — chỉ gộp khi dev (xem layout / filter).
 * ID bắt đầu bằng `mock-cq-` để UI tắt điều hướng workspace.
 */

export type ComparisonQueueRfqRow = {
  id: string;
  rfqNumber: string;
  status: string;
  buyer: { id: string; username: string; email?: string };
  prNumber: string;
  prDepartment: string | null;
  quotationsCount: number;
  minAmount: number | null;
  prCurrency: string;
  budgetStatus: 'OK' | 'OVER' | 'UNKNOWN';
};

const buyers = [
  { id: 'b1', username: 'buyer.ha', email: 'ha@example.com' },
  { id: 'b2', username: 'buyer.lan', email: 'lan@example.com' },
  { id: 'b3', username: 'buyer.minh', email: 'minh@example.com' },
  { id: 'b4', username: 'buyer.dung', email: 'dung@example.com' },
];

const depts = ['Kỹ thuật', 'Sản xuất', 'Kho vận', 'Mua hàng', 'Dự án A', 'QA'];

const statuses = ['READY_FOR_COMPARISON', 'QUOTATION_RECEIVED', 'SENT'] as const;

export const COMPARISON_QUEUE_MOCK_RFQS: ComparisonQueueRfqRow[] = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  const pad = String(n).padStart(2, '0');
  const buyer = buyers[i % buyers.length];
  const dept = depts[i % depts.length];
  const status = statuses[i % statuses.length];
  const budgetRoll = i % 5;
  const budgetStatus: ComparisonQueueRfqRow['budgetStatus'] =
    budgetRoll === 0 ? 'OVER' : budgetRoll === 1 ? 'UNKNOWN' : 'OK';

  const minAmount = budgetStatus === 'OVER' ? 185_000_000 + n * 1_250_000 : 52_800_000 + n * 875_000;

  return {
    id: `mock-cq-${pad}`,
    rfqNumber: `RFQ-DEMO-${pad}`,
    status,
    buyer,
    prNumber: `PR-2026-${4100 + n}`,
    prDepartment: dept,
    quotationsCount: 2 + (i % 4),
    minAmount,
    prCurrency: 'VND',
    budgetStatus,
  };
});
