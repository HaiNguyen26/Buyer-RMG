/**
 * Mock requestor khi API trả về rỗng (dev / demo).
 * 20 dòng list + dashboard đủ trường cho biểu đồ / KPI.
 */
import type { DashboardData, NotificationData, PRData } from '../services/requestorService';
import type { PRSalesOrderInfo } from '../types/prSalesOrder';
import type { StockIssueDto } from '../services/stockIssueService';

export const REQUESTOR_DEV_MOCK_ROW_COUNT = 20;

/**
 * Tắt fallback mock để luôn dùng dữ liệu thật từ API.
 */
export function shouldUseRequestorDashboardMock(api: DashboardData | undefined): boolean {
  void api;
  return false;
}

const DEPTS = ['Sản xuất', 'Kỹ thuật', 'Dự án', 'Bảo trì', 'QA'] as const;
const STATUSES_MYPRS = [
  'DRAFT',
  'SUBMITTED',
  'MANAGER_PENDING',
  'ASSIGNED_TO_BUYER',
  'RFQ_IN_PROGRESS',
  'QUOTATION_RECEIVED',
  'NEED_MORE_INFO',
] as const;
const ITEMS = [
  'Linh kiện điện tử SMT',
  'Vít & bulong thép không gỉ',
  'Dây cáp tín hiệu shielded',
  'Bộ nguồn switching 24V',
  'Quạt tủ điện công nghiệp',
  'Sensor tiệm cận M12',
  'Bánh xe tải conveyor',
  'Keo dán line production',
] as const;

const TRACK_STATUSES = [
  'SUBMITTED',
  'MANAGER_PENDING',
  'ASSIGNED_TO_BUYER',
  'RFQ_IN_PROGRESS',
  'QUOTATION_RECEIVED',
] as const;

const SLA_STATUSES: Array<'on_time' | 'warning' | 'overdue' | 'completed'> = [
  'on_time',
  'on_time',
  'warning',
  'overdue',
  'completed',
];

function soInfo(seq: number, linked: boolean): PRSalesOrderInfo {
  if (!linked) {
    return {
      linkedToSO: false,
      salesPOId: null,
      salesPONumber: null,
      customerPONumber: null,
      projectName: null,
      projectCode: null,
      customerName: null,
      label: null,
    };
  }
  return {
    linkedToSO: true,
    salesPOId: `so-mock-${seq}`,
    salesPONumber: `SO-DEMO-${String(seq).padStart(4, '0')}`,
    customerPONumber: `CPO-${String(seq).padStart(4, '0')}`,
    projectName: `Dự án OEM ${seq}`,
    projectCode: `PJ-26-${String(seq).padStart(3, '0')}`,
    customerName: 'Customer Demo',
    label: `SO-DEMO-${String(seq).padStart(4, '0')} · OEM ${seq}`,
  };
}

function isoMonthOffset(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return d.toISOString();
}

/** Dashboard đầy đủ cho biểu đồ tròn / cột / KPI. */
export function createMockRequestorDashboard(): DashboardData {
  const now = new Date();
  const recentPRs = Array.from({ length: REQUESTOR_DEV_MOCK_ROW_COUNT }, (_, i) => {
    const n = i + 1;
    const created = new Date(now);
    created.setDate(created.getDate() - (i % 14));
    const st = STATUSES_MYPRS[i % STATUSES_MYPRS.length];
    return {
      id: `mock-req-dash-pr-${n}`,
      prNumber: `PR-REQ-${String(n).padStart(4, '0')}`,
      itemName: ITEMS[i % ITEMS.length],
      status: st,
      salesPO:
        i % 3 === 0
          ? { salesPONumber: `SO-DEMO-${String(n).padStart(4, '0')}`, projectName: `Dự án ${n}` }
          : undefined,
      createdAt: created.toISOString(),
    };
  });

  const prsByStatus = [
    { status: 'DRAFT', count: 2 },
    { status: 'SUBMITTED', count: 3 },
    { status: 'MANAGER_PENDING', count: 4 },
    { status: 'BRANCH_MANAGER_PENDING', count: 2 },
    { status: 'MANAGER_RETURNED', count: 1 },
    { status: 'NEED_MORE_INFO', count: 2 },
    { status: 'ASSIGNED_TO_BUYER', count: 3 },
    { status: 'RFQ_IN_PROGRESS', count: 2 },
    { status: 'QUOTATION_RECEIVED', count: 1 },
  ];

  const prsByType = [
    { type: 'Vật tư / nguyên liệu', typeKey: 'MATERIAL', count: 8 },
    { type: 'Dự án', typeKey: 'PROJECT', count: 5 },
    { type: 'Thương mại', typeKey: 'COMMERCIAL', count: 4 },
    { type: 'Sản xuất', typeKey: 'PRODUCTION', count: 3 },
  ];

  const prsByMonth = [5, 4, 3, 6, 7, 8].map((count, idx) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - idx));
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' });
    return { monthKey, label, count };
  });

  const prsNeedMoreInfo = [1, 2, 3].map((k) => ({
    id: `mock-req-nmi-${k}`,
    prNumber: `PR-REQ-${String(k).padStart(4, '0')}`,
    itemName: ITEMS[k % ITEMS.length],
    salesPO: { salesPONumber: `SO-DEMO-${String(k).padStart(4, '0')}`, projectName: `Dự án ${k}` },
    notes: 'Vui lòng bổ sung spec chi tiết và đơn vị đo.',
  }));

  return {
    totalPRs: REQUESTOR_DEV_MOCK_ROW_COUNT,
    prsByStatus,
    prsByType,
    prsByMonth,
    prsNeedMoreInfo,
    recentPRs,
  };
}

/** Danh sách PR của tôi — đủ field cho bảng MyPurchaseRequests. */
export function createMockMyPRs(): PRData[] {
  return Array.from({ length: REQUESTOR_DEV_MOCK_ROW_COUNT }, (_, i) => {
    const n = i + 1;
    const st = STATUSES_MYPRS[i % STATUSES_MYPRS.length];
    const created = isoMonthOffset(i % 10);
    const updated = created;
    return {
      id: `mock-req-pr-${n}`,
      prNumber: `PR-REQ-${String(n).padStart(4, '0')}`,
      department: DEPTS[i % DEPTS.length],
      itemName: ITEMS[i % ITEMS.length],
      specifications: 'Spec demo',
      quantity: 10 + i,
      unit: 'pcs',
      requiredDate: undefined,
      purpose: 'Phục vụ line sản xuất',
      location: 'Xưởng A',
      status: st,
      totalAmount: 5_000_000 + n * 125_000,
      currency: 'VND',
      salesOrder: soInfo(n, i % 4 !== 0),
      notes: undefined,
      items: [
        {
          lineNo: 1,
          description: ITEMS[i % ITEMS.length],
          qty: 10 + i,
          unit: 'pcs',
          estimatedUnitPriceVnd: 120_000 + n * 1000,
        },
      ],
      createdAt: created,
      updatedAt: updated,
    };
  });
}

function mockProgress(pct: number) {
  const stages = [
    { key: 'submit', label: 'Đã gửi', completed: pct >= 20, current: pct >= 10 && pct < 40 },
    { key: 'approve', label: 'Phê duyệt', completed: pct >= 50, current: pct >= 40 && pct < 70 },
    { key: 'buy', label: 'Mua hàng', completed: pct >= 80, current: pct >= 70 && pct < 95 },
    { key: 'done', label: 'Hoàn tất', completed: pct >= 100, current: pct >= 95 },
  ];
  const currentStage = stages.find((s) => s.current) ?? stages[stages.length - 1];
  return {
    percentage: pct,
    stages,
    currentStage: pct >= 100 ? stages[3] : currentStage,
  };
}

/** Danh sách theo dõi PR — khớp `getPRTrackingList`. */
export function createMockPRTrackingRows(): Array<{
  id: string;
  prNumber: string;
  itemName: string | null;
  purpose: string | null;
  department: string | null;
  status: string;
  totalAmount: number | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  progress: ReturnType<typeof mockProgress>;
  currentHandler: string | null;
  sla: {
    status: 'on_time' | 'warning' | 'overdue' | 'completed';
    timeRemaining: string | null;
    timeOverdue: string | null;
    daysSinceCreated: number;
  };
  costInsight?: {
    proposedAmount: number | null;
    buyerTargetAmount: number | null;
    deltaAmount: number;
    deltaPercent: number;
    status: 'unknown' | 'within' | 'equal' | 'over';
  };
  procurementSnapshot?: {
    nextEta: string | null;
    receivedCount: number;
    totalCount: number;
    partialCount: number;
    hasDelay: boolean;
    delayHint: string | null;
    itemPreview: Array<{
      label: string;
      statusLabel: string;
      statusKey: string;
      eta: string | null;
      qtyReceived: number;
      qtyCap: number;
    }>;
  };
  stockIssuePickup?: {
    ready: boolean;
    linkedStockIssue: { id: string; issueNumber: string; status: string } | null;
  };
  salesOrder?: PRSalesOrderInfo | null;
}> {
  return Array.from({ length: REQUESTOR_DEV_MOCK_ROW_COUNT }, (_, i) => {
    const n = i + 1;
    const pct = Math.min(100, 25 + (i % 8) * 10);
    const slaSt = SLA_STATUSES[i % SLA_STATUSES.length];
    const days = 3 + (i % 12);
    return {
      id: `mock-req-track-${n}`,
      prNumber: `PR-REQ-${String(n).padStart(4, '0')}`,
      itemName: ITEMS[i % ITEMS.length],
      purpose: 'Nhu cầu vật tư demo',
      department: DEPTS[i % DEPTS.length],
      status: TRACK_STATUSES[i % TRACK_STATUSES.length],
      totalAmount: 12_000_000 + n * 200_000,
      currency: 'VND',
      createdAt: isoMonthOffset(i % 8),
      updatedAt: new Date().toISOString(),
      progress: mockProgress(pct),
      currentHandler: i % 5 === 0 ? null : 'Buyer Demo',
      sla: {
        status: slaSt,
        timeRemaining: slaSt === 'overdue' ? null : '5 ngày',
        timeOverdue: slaSt === 'overdue' ? '2 ngày' : null,
        daysSinceCreated: days,
      },
      costInsight: {
        proposedAmount: 14_000_000,
        procurementCostAmount: i % 4 === 0 ? null : 13_500_000 + (i % 3) * 100_000,
        buyerTargetAmount: i % 4 === 0 ? null : 13_500_000 + (i % 3) * 100_000,
        costSource: i % 4 === 0 ? 'none' : i % 2 === 0 ? 'award' : 'po',
        isFinalized: i % 4 !== 0 && i % 5 !== 0,
        awaitingVendorConfirm: i % 5 === 0 && i % 4 !== 0,
        deltaAmount: 500_000,
        deltaPercent: 3.7,
        status: i % 6 === 0 ? 'over' : 'within',
      },
      procurementSnapshot:
        i === 0 || i === 1
          ? {
              nextEta: null,
              receivedCount: 2,
              totalCount: 2,
              partialCount: 0,
              hasDelay: false,
              delayHint: null,
              itemPreview: [
                {
                  label: ITEMS[i % ITEMS.length],
                  statusLabel: 'Đã nhận đủ',
                  statusKey: 'RECEIVED',
                  eta: null,
                  qtyReceived: 1,
                  qtyCap: 1,
                },
                {
                  label: 'Phụ kiện demo',
                  statusLabel: 'Đã nhận đủ',
                  statusKey: 'FULFILLED',
                  eta: null,
                  qtyReceived: 1,
                  qtyCap: 1,
                },
              ],
            }
          : i % 3 === 0
            ? {
                nextEta: '2026-05-25',
                receivedCount: i % 2,
                totalCount: 3,
                partialCount: i % 2,
                hasDelay: i % 5 === 0,
                delayHint: i % 5 === 0 ? '1 item trễ hạn giao' : null,
                itemPreview: [
                  {
                    label: 'ASUS Laptop',
                    statusLabel: 'Chờ nhận kho',
                    statusKey: 'INCOMING',
                    eta: '2026-05-25',
                    qtyReceived: 8,
                    qtyCap: 10,
                  },
                  {
                    label: 'Dell Monitor',
                    statusLabel: 'Đang hỏi giá',
                    statusKey: 'RFQ',
                    eta: null,
                    qtyReceived: 0,
                    qtyCap: 5,
                  },
                  {
                    label: 'HP Printer',
                    statusLabel: 'Cần chỉnh sửa',
                    statusKey: 'REVISION_REQUIRED',
                    eta: null,
                    qtyReceived: 0,
                    qtyCap: 2,
                  },
                ],
              }
            : {
              nextEta: i % 2 === 0 ? '2026-05-20' : null,
              receivedCount: 1,
              totalCount: 2,
              partialCount: 0,
              hasDelay: false,
              delayHint: null,
              itemPreview: [
                {
                  label: ITEMS[i % ITEMS.length],
                  statusLabel: 'Đã gửi PO',
                  statusKey: 'PO_SENT',
                  eta: '2026-05-20',
                  qtyReceived: 0,
                  qtyCap: 1,
                },
              ],
            },
      stockIssuePickup:
        i === 0
          ? {
              ready: true,
              linkedStockIssue: null,
            }
          : i === 1
            ? {
                ready: true,
                linkedStockIssue: {
                  id: 'mock-si-1',
                  issueNumber: 'SI-DEMO-0001',
                  status: 'DRAFT',
                },
              }
            : { ready: false, linkedStockIssue: null },
      salesOrder: soInfo(n, true),
    };
  });
}

export function createMockRequestorNotifications(): NotificationData[] {
  const types = ['PR_SUBMITTED', 'PR_RETURNED', 'PR_APPROVED', 'PR_READY_FOR_RFQ'] as const;
  return Array.from({ length: REQUESTOR_DEV_MOCK_ROW_COUNT }, (_, i) => {
    const n = i + 1;
    const t = types[i % types.length];
    return {
      id: `mock-req-notif-${n}`,
      type: t,
      message: `Thông báo demo #${n} — kiểm tra giao diện Requestor.`,
      prNumber: `PR-REQ-${String((n % 15) + 1).padStart(4, '0')}`,
      comment: i % 4 === 0 ? 'Xem chi tiết PR.' : undefined,
      createdAt: `2026-05-${String((i % 27) + 1).padStart(2, '0')}T10:00:00.000Z`,
    };
  });
}

export function createMockStockIssues(): StockIssueDto[] {
  const statuses = ['DRAFT', 'RESERVED', 'APPROVED', 'ISSUED'] as const;
  return Array.from({ length: REQUESTOR_DEV_MOCK_ROW_COUNT }, (_, i) => {
    const n = i + 1;
    const st = statuses[i % statuses.length];
    const created = isoMonthOffset(i % 6);
    return {
      id: `mock-req-si-${n}`,
      issueNumber: `XK-DEMO-${String(n).padStart(4, '0')}`,
      status: st,
      purpose: 'Xuất line sản xuất',
      notes: null,
      createdAt: created,
      updatedAt: created,
      requestor: { id: 'mock-user', username: 'requestor.demo', fullName: 'Requestor Demo' },
      salesPO: {
        id: `so-${n}`,
        salesPONumber: `SO-DEMO-${String(n).padStart(4, '0')}`,
        customerPONumber: `CPO-${n}`,
      },
      purchaseRequest:
        i % 2 === 0
          ? {
              id: `mock-req-pr-${n}`,
              prNumber: `PR-REQ-${String(n).padStart(4, '0')}`,
              projectCode: `PJ-${n}`,
              projectName: `Dự án ${n}`,
            }
          : null,
      items: [
        {
          id: `mock-si-item-${n}-1`,
          lineNo: 1,
          partInternalCode: `PT-${String(n).padStart(4, '0')}`,
          partName: ITEMS[i % ITEMS.length],
          unit: 'pcs',
          qty: 5 + (i % 10),
          qtyShipped: st === 'ISSUED' ? 5 + (i % 10) : undefined,
          description: 'Dòng demo',
        },
      ],
    };
  });
}
