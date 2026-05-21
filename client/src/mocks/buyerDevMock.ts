/**
 * Mock dữ liệu buyer khi API trả về rỗng (dev / demo).
 * PR được phân công: 70 = 50 + 20 bổ sung; các bảng khác: 20 dòng mỗi loại.
 */
export const BUYER_DEV_MOCK_ASSIGNED_PR_COUNT = 70;

/** Số dòng list cho PO / RFQ / thông báo / cảnh báo / dự án / báo giá / PR chờ PO. */
export const BUYER_DEV_MOCK_PAGE_ROW_COUNT = 20;

const MOCK_STATUSES = [
  'ASSIGNED_TO_BUYER',
  'READY_FOR_RFQ',
  'RFQ_IN_PROGRESS',
  'QUOTATION_RECEIVED',
  'SUPPLIER_SELECTED',
  'RETURNED',
  'NEED_MORE_INFO',
] as const;

const MOCK_SCOPES = [
  'Vật tư SMT Line A',
  'Linh kiện cho dự án customer',
  'Bảo trì conveyor Line B',
  'Vật tư phụ CNC',
  'Packaging OEM batch Q2',
  'Thiết bị đo QC Line 3',
  'Phụ tùng HVAC tòa nhà',
  'Vật tư an toàn PPE',
  'Tooling fixture dự án X7',
  'Consumables phòng sạch',
] as const;

const RFQ_STATUSES = ['DRAFT', 'SENT', 'QUOTATION_RECEIVED', 'READY_FOR_COMPARISON', 'CLOSED'] as const;

const PO_STATUSES = [
  'DRAFT',
  'CREATED',
  'SENT',
  'SUBMITTED',
  'CONFIRMED',
  'PARTIAL_RECEIVED',
] as const;

const NOTIF_TYPES = ['PR_ASSIGNED', 'PR_RETURNED', 'LEADER_REQUEST', 'QUOTATION_RECEIVED'] as const;

const SUPPLIER_NAMES = [
  'Công ty ABC VN',
  'Nhà cung ứng Delta',
  'Sino Parts Co.',
  'TechSupply Asia',
  'Mekong Industrial',
  'Hà Nội Auto Parts',
] as const;

const DEPTS = ['Sản xuất', 'Kỹ thuật', 'Mua hàng', 'Dự án', 'Bảo trì'] as const;

const REQUESTORS = ['Nguyễn A', 'Trần B', 'Lê C', 'Phạm D', 'Hoàng E'] as const;

export type BuyerMockAssignedPR = {
  id: string;
  prNumber: string;
  scope: string;
  status: string;
  assignedDate: string;
  salesOrder: { label: string };
  deadline?: string;
  __isMock: true;
};

export function createMockAssignedPRs(count: number = BUYER_DEV_MOCK_ASSIGNED_PR_COUNT): BuyerMockAssignedPR[] {
  return Array.from({ length: count }, (_, index) => {
    const status = MOCK_STATUSES[index % MOCK_STATUSES.length];
    const day = String((index % 28) + 1).padStart(2, '0');
    const n = index + 1;
    const deadlineDay = String((index % 25) + 1).padStart(2, '0');
    return {
      id: `mock-assigned-pr-${n}`,
      prNumber: `PR-TEST-${String(n).padStart(3, '0')}`,
      scope: MOCK_SCOPES[index % MOCK_SCOPES.length],
      status,
      assignedDate: `2026-04-${day}T08:00:00.000Z`,
      salesOrder: { label: `SO-TEST-${String(n).padStart(3, '0')}` },
      deadline: index % 5 === 2 ? `2026-05-${deadlineDay}T12:00:00.000Z` : undefined,
      __isMock: true,
    };
  });
}

export function createMockPOList(count: number = BUYER_DEV_MOCK_PAGE_ROW_COUNT) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const prN = ((n - 1) % BUYER_DEV_MOCK_ASSIGNED_PR_COUNT) + 1;
    return {
      id: `mock-po-${n}`,
      poNumber: `PO-DEV-${String(n).padStart(4, '0')}`,
      prCode: `PR-TEST-${String(prN).padStart(3, '0')}`,
      supplier: { name: SUPPLIER_NAMES[i % SUPPLIER_NAMES.length] },
      totalAmount: 5_000_000 + n * 125_000,
      currency: 'VND',
      buyer: 'Buyer Demo',
      status: PO_STATUSES[i % PO_STATUSES.length],
      createdAt: `2026-04-${String((i % 27) + 1).padStart(2, '0')}T10:00:00.000Z`,
      __isMock: true as const,
    };
  });
}

export function createMockPRsWaitingPO(count: number = BUYER_DEV_MOCK_PAGE_ROW_COUNT) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const prN = ((n - 1) % BUYER_DEV_MOCK_ASSIGNED_PR_COUNT) + 1;
    const total = 12_000_000 + n * 200_000;
    const selected = Math.round(total * (0.55 + (i % 5) * 0.07));
    return {
      prId: `mock-wait-po-pr-${n}`,
      prCode: `PR-TEST-${String(prN).padStart(3, '0')}`,
      requestor: REQUESTORS[i % REQUESTORS.length],
      department: DEPTS[i % DEPTS.length],
      totalBudget: total,
      selectedAmount: selected,
      currency: 'VND',
      supplierCount: 1 + (i % 3),
      hasPO: i % 7 === 0,
      __isMock: true as const,
    };
  });
}

export function createMockRFQs(count: number = BUYER_DEV_MOCK_PAGE_ROW_COUNT) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const prIdx = ((n - 1) % BUYER_DEV_MOCK_ASSIGNED_PR_COUNT) + 1;
    return {
      id: `mock-rfq-${n}`,
      rfqNumber: `RFQ-DEV-${String(n).padStart(4, '0')}`,
      prNumber: `PR-TEST-${String(prIdx).padStart(3, '0')}`,
      prId: `mock-assigned-pr-${prIdx}`,
      itemCount: 2 + (i % 6),
      status: RFQ_STATUSES[i % RFQ_STATUSES.length],
      createdAt: `2026-04-${String((i % 26) + 1).padStart(2, '0')}T09:30:00.000Z`,
      quotationsCount: i % 5,
      __isMock: true as const,
    };
  });
}

export function createMockNotifications(count: number = BUYER_DEV_MOCK_PAGE_ROW_COUNT) {
  const titles: Record<(typeof NOTIF_TYPES)[number], string> = {
    PR_ASSIGNED: 'PR được phân công',
    PR_RETURNED: 'PR trả về / cần bổ sung',
    LEADER_REQUEST: 'Yêu cầu từ Buyer Leader',
    QUOTATION_RECEIVED: 'Đã có báo giá mới',
  };
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const type = NOTIF_TYPES[i % NOTIF_TYPES.length];
    const prNum = `PR-TEST-${String((n % 50) + 1).padStart(3, '0')}`;
    return {
      id: `mock-buyer-notif-${n}`,
      type,
      title: titles[type],
      message: `Nội dung demo #${n} — kiểm tra giao diện danh sách thông báo Buyer.`,
      prNumber: prNum,
      rfqNumber: `RFQ-DEV-${String(n).padStart(4, '0')}`,
      createdAt: `2026-05-${String((i % 28) + 1).padStart(2, '0')}T${String(8 + (i % 8)).padStart(2, '0')}:00:00.000Z`,
      read: i % 3 === 0,
      __isMock: true as const,
    };
  });
}

export function createMockOverBudgetAlerts(count: number = BUYER_DEV_MOCK_PAGE_ROW_COUNT) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const prIdx = ((n - 1) % 40) + 1;
    const base = 120_000 + i * 5_000;
    const rfqPrice = base + 15_000 + i * 2_000;
    const over = rfqPrice - base;
    const overPct = (over / base) * 100;
    return {
      id: `mock-oba-${n}`,
      prId: `mock-assigned-pr-${prIdx}`,
      prNumber: `PR-TEST-${String(prIdx).padStart(3, '0')}`,
      rfqId: `mock-rfq-${(n % 20) + 1}`,
      rfqNumber: `RFQ-DEV-${String(n).padStart(4, '0')}`,
      itemId: `mock-item-${n}`,
      itemDesc: `Item demo ${n} — ${MOCK_SCOPES[i % MOCK_SCOPES.length]}`,
      supplierName: SUPPLIER_NAMES[i % SUPPLIER_NAMES.length],
      baselineUnitPrice: base,
      rfqUnitPrice: rfqPrice,
      overAmount: over,
      overPercent: Math.round(overPct * 10) / 10,
      severity: overPct >= 25 ? ('serious' as const) : ('light' as const),
      __isMock: true as const,
    };
  });
}

export function createMockProjectCosts(count: number = BUYER_DEV_MOCK_PAGE_ROW_COUNT) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const budget = 800_000_000 + n * 12_000_000;
    const actual = budget * (0.45 + (i % 8) * 0.06);
    const remaining = Math.max(0, budget - actual);
    const progress = Math.min(100, Math.round((actual / budget) * 100));
    return {
      id: `mock-proj-cost-${n}`,
      salesPONumber: `SO-DEMO-${String(n).padStart(4, '0')}`,
      projectName: `Dự án OEM Batch ${n}`,
      projectCode: `PJ-2026-${String(n).padStart(3, '0')}`,
      salesPOAmount: budget,
      budget,
      actualCost: actual,
      remainingBudget: remaining,
      progress,
      __isMock: true as const,
    };
  });
}

export function createMockQuotations(count: number = BUYER_DEV_MOCK_PAGE_ROW_COUNT) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const rfqIdx = (i % 12) + 1;
    const prIdx = ((n - 1) % BUYER_DEV_MOCK_ASSIGNED_PR_COUNT) + 1;
    const statuses = ['VALID', 'VALID', 'INVALID', 'PENDING'] as const;
    const st = statuses[i % statuses.length];
    return {
      id: `mock-quot-${n}`,
      quotationNumber: `BG-DEV-${String(n).padStart(4, '0')}`,
      prNumber: `PR-TEST-${String(prIdx).padStart(3, '0')}`,
      rfqId: `mock-rfq-${rfqIdx}`,
      rfqNumber: `RFQ-DEV-${String(rfqIdx).padStart(4, '0')}`,
      rfqStatus: RFQ_STATUSES[i % RFQ_STATUSES.length],
      status: st,
      totalAmount: 8_000_000 + n * 150_000,
      leadTime: 7 + (i % 14),
      paymentTerms: 'TT 30 ngày sau giao hàng',
      supplier: {
        name: SUPPLIER_NAMES[i % SUPPLIER_NAMES.length],
        code: `NCC-${String(n).padStart(3, '0')}`,
      },
      selectedItemCount: i % 4 === 0 ? 2 : 0,
      selectedItemsTotalAmount: i % 4 === 0 ? 3_200_000 : 0,
      __isMock: true as const,
    };
  });
}
