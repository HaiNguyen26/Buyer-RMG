/**
 * Dữ liệu demo cho luồng Trưởng phòng (DEV).
 * Hiện tại đã tắt mock để luôn dùng API thật.
 */
import type { PRSalesOrderInfo } from '../types/prSalesOrder';
import type { DashboardData, PRData, PRTrackingData } from '../services/requestorService';
import { isDeptHeadMockOutletActive } from './deptHeadMockScope';
import type { StockIssueDto } from '../services/stockIssueService';

export function isDeptHeadMockEnvEnabled(): boolean {
  return false;
}

export function shouldServeDeptHeadMock(): boolean {
  return isDeptHeadMockEnvEnabled() && isDeptHeadMockOutletActive();
}

/** Requestor khác DH — luôn khác UUID thật nên không bị filter trên Dashboard */
const MOCK_PEERS: { id: string; username: string }[] = [
  { id: 'aaaaaaaa-aaaa-4aaa-a100-000000000001', username: 'le.thi.hoa' },
  { id: 'aaaaaaaa-aaaa-4aaa-a100-000000000002', username: 'pham.minh.an' },
  { id: 'aaaaaaaa-aaaa-4aaa-a100-000000000003', username: 'tran.van.dung' },
  { id: 'aaaaaaaa-aaaa-4aaa-a100-000000000004', username: 'nguyen.thi.mai' },
  { id: 'aaaaaaaa-aaaa-4aaa-a100-000000000005', username: 'hoang.quoc.bao' },
  { id: 'aaaaaaaa-aaaa-4aaa-a100-000000000006', username: 'vo.thi.cam' },
  { id: 'aaaaaaaa-aaaa-4aaa-a100-000000000007', username: 'dang.huu.phuc' },
  { id: 'aaaaaaaa-aaaa-4aaa-a100-000000000008', username: 'ly.thi.khanh' },
];

const DEPTS = ['Sản xuất', 'Kỹ thuật', 'QA', 'Kho', 'Mua hàng', 'Dự án'];
const PR_TYPES = ['MATERIAL', 'SERVICE', 'PROJECT', 'COMMERCIAL', 'PRODUCTION', 'OFFICE'] as const;

type MockPrType = (typeof PR_TYPES)[number];

type MockPrCore = {
  seq: number;
  prNumber: string;
  status: string;
  prType: MockPrType;
  department: string;
  isMine: boolean;
  requestorId: string;
  requestorUsername: string;
  itemName: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  requiredDate?: string;
  purpose?: string;
  notes?: string;
  salesOrder: PRSalesOrderInfo | null;
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function soFor(seq: number, linked: boolean): PRSalesOrderInfo | null {
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
    salesPOId: `mock-spo-${seq}`,
    salesPONumber: `SO-2026-${String(4000 + seq).slice(-4)}`,
    customerPONumber: `CPO-DEMO-${seq}`,
    projectName: `Dự án RMG Alpha ${seq % 4}`,
    projectCode: `PRJ-26-${String(seq).padStart(3, '0')}`,
    customerName: 'Samsung Demo',
    label: `SO-2026-${4000 + seq}`,
  };
}

function buildMockCores(): MockPrCore[] {
  const cores: MockPrCore[] = [];
  for (let i = 1; i <= 12; i++) {
    const peer = MOCK_PEERS[(i - 1) % MOCK_PEERS.length];
    const t = PR_TYPES[(i - 1) % PR_TYPES.length];
    cores.push({
      seq: i,
      prNumber: `PR-DH-DEMO-2026-${String(i).padStart(2, '0')}`,
      status: 'MANAGER_PENDING',
      prType: t,
      department: DEPTS[(i - 1) % DEPTS.length],
      isMine: false,
      requestorId: peer.id,
      requestorUsername: peer.username,
      itemName: [
        'Linh kiện điện tử — IC nguồn, tụ lọc',
        'Dịch vụ hiệu chuẩn thiết bị đo',
        'Vật tư phụ tùng máy dệt',
        'License phần mềm CAD (1 năm)',
        'Xi măng + thép xây dựng kho phụ',
        'Ống dẫn khí nén SS316',
        'Bảo trì định kỳ dây chuyền 3',
        'Thiết bị đo lường cầm tay',
        'Vật tư tiêu hao phòng lab',
        'Gia công chi tiết mock-up',
        'Packaging giấy tái chế',
        'Dịch vụ vận chuyển nội bộ',
      ][i - 1] ?? `Hạng mục mua hàng demo ${i}`,
      totalAmount: 8_500_000 + i * 1_250_000,
      currency: 'VND',
      createdAt: isoDaysAgo(20 - i),
      requiredDate: isoDaysAgo(-7 - i),
      purpose: `Phục vụ vận hành Q2 — gói demo #${i}`,
      notes: i % 3 === 0 ? 'Ưu tiên giao trước ngày cần.' : undefined,
      salesOrder: soFor(i, i % 2 === 0),
    });
  }

  const mineStatuses = [
    'DRAFT',
    'MANAGER_PENDING',
    'MANAGER_RETURNED',
    'NEED_MORE_INFO',
    'MANAGER_APPROVED',
    'BRANCH_MANAGER_PENDING',
    'BUYER_LEADER_PENDING',
    'ASSIGNED_TO_BUYER',
  ];
  for (let j = 0; j < 8; j++) {
    const seq = 13 + j;
    const t = PR_TYPES[j % PR_TYPES.length];
    cores.push({
      seq,
      prNumber: `PR-DH-MINE-2026-${String(j + 1).padStart(2, '0')}`,
      status: mineStatuses[j] ?? 'DRAFT',
      prType: t,
      department: DEPTS[j % DEPTS.length],
      isMine: true,
      requestorId: 'local-user-placeholder',
      requestorUsername: 'me',
      itemName: [
        'Máy bơm chân không dự phòng',
        'Camera kiểm tra AOI',
        'Thùng container lạnh (thuê)',
        'Hạt nhựa ABS — lô thử',
        'Dịch vụ đào tạo an toàn',
        'Kệ selective pallet',
        'UPS 10kVA',
        'Dụng cụ đo độ rung',
      ][j],
      totalAmount: 12_000_000 + j * 2_100_000,
      currency: 'VND',
      createdAt: isoDaysAgo(5 + j),
      requiredDate: isoDaysAgo(-14 - j),
      purpose: 'PR do Trưởng phòng tạo (demo).',
      notes: j === 2 ? 'Bổ sung chứng từ VAT trước khi chốt.' : undefined,
      salesOrder: soFor(seq, j % 2 === 1),
    });
  }
  return cores;
}

const MOCK_CORES = buildMockCores();

export function getDeptHeadMockPrCoreById(id: string): MockPrCore | undefined {
  return MOCK_CORES.find((c) => prIdForSeq(c.seq) === id);
}

function prIdForSeq(seq: number): string {
  return `dh-mock-pr-${String(seq).padStart(3, '0')}`;
}

function mockItemsFor(seq: number) {
  const base = 150_000 + seq * 10_000;
  return [
    {
      id: `dh-mock-li-${seq}-1`,
      lineNo: 1,
      description: `Chi tiết A — lô demo ${seq}`,
      qty: 4 + (seq % 5),
      unit: 'cái',
      unitPrice: base,
      amount: (4 + (seq % 5)) * base,
    },
    {
      id: `dh-mock-li-${seq}-2`,
      lineNo: 2,
      description: `Chi tiết B — phụ kiện ${seq}`,
      qty: 2,
      unit: 'bộ',
      unitPrice: Math.round(base * 1.2),
      amount: Math.round(2 * base * 1.2),
    },
  ];
}

/** PR đầy đủ cho modal / theo dõi / getPR */
export function getDeptHeadMockPRTracking(id: string): PRTrackingData | undefined {
  const pr = getDeptHeadMockPRData(id);
  if (!pr) return undefined;
  const t0 = pr.createdAt;
  return {
    pr,
    timeline: [
      { status: 'DRAFT', completed: true, date: t0, handler: 'Requestor' },
      { status: 'SUBMITTED', completed: true, date: t0, handler: pr.itemName?.slice(0, 40), comment: 'Đã gửi duyệt' },
      {
        status: pr.status,
        completed: ['MANAGER_APPROVED', 'BUYER_LEADER_PENDING', 'ASSIGNED_TO_BUYER'].includes(pr.status),
        date: pr.updatedAt,
        handler: 'QL trực tiếp (demo)',
      },
    ],
    currentHandler: 'Trưởng phòng / Buyer (demo)',
    currentHandlerInfo: {
      name: 'Hệ thống demo',
      role: 'DEPARTMENT_HEAD',
      title: 'Xử lý minh họa',
      branch: 'HCM',
      department: pr.department ?? '',
    },
    comments: [],
  } as PRTrackingData;
}

export function getDeptHeadMockPRData(id: string): PRData | undefined {
  const core = MOCK_CORES.find((c) => prIdForSeq(c.seq) === id);
  if (!core) return undefined;
  const items = mockItemsFor(core.seq);
  const qty = items.reduce((s, it) => s + it.qty, 0);
  return {
    id: prIdForSeq(core.seq),
    prNumber: core.prNumber,
    department: core.department,
    itemName: core.itemName,
    quantity: qty,
    unit: 'mixed',
    requiredDate: core.requiredDate,
    purpose: core.purpose,
    location: 'HCM',
    status: core.status,
    totalAmount: core.totalAmount,
    currency: core.currency,
    salesOrder: core.salesOrder ?? undefined,
    notes: core.notes,
    items,
    createdAt: core.createdAt,
    updatedAt: core.createdAt,
  };
}

/** Danh sách “PR của tôi” trong mock — 8 bản ghi cuối */
export function getDeptHeadMockMyPRsList(): { prs: PRData[] } {
  const mine = MOCK_CORES.filter((c) => c.isMine);
  return { prs: mine.map((c) => getDeptHeadMockPRData(prIdForSeq(c.seq))!).filter(Boolean) };
}

export function getDeptHeadMockDashboardData(): DashboardData {
  const mine = MOCK_CORES.filter((c) => c.isMine);
  const byStatus: Record<string, number> = {};
  mine.forEach((c) => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  });
  const prsNeedMoreInfo = mine
    .filter((c) => c.status === 'NEED_MORE_INFO' || c.status === 'MANAGER_RETURNED')
    .map((c) => ({
      id: prIdForSeq(c.seq),
      prNumber: c.prNumber,
      itemName: c.itemName,
      notes: c.notes,
      salesPO: c.salesOrder?.linkedToSO
        ? {
            salesPONumber: c.salesOrder.salesPONumber ?? '',
            projectName: c.salesOrder.projectName ?? '',
          }
        : undefined,
    }));
  const recentPRs = [...mine]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((c) => ({
      id: prIdForSeq(c.seq),
      prNumber: c.prNumber,
      itemName: c.itemName,
      status: c.status,
      createdAt: c.createdAt,
      totalAmount: c.totalAmount,
      currency: c.currency,
      salesPO: c.salesOrder?.linkedToSO
        ? {
            salesPONumber: c.salesOrder.salesPONumber ?? '',
            projectName: c.salesOrder.projectName ?? '',
          }
        : undefined,
    }));

  return {
    totalPRs: mine.length,
    prsByStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    prsNeedMoreInfo,
    recentPRs: recentPRs as DashboardData['recentPRs'],
  };
}

/** MyPRDashboard đọc prsByStatus dạng record (theo response thực tế một số API). */
export function getDeptHeadMockMyPRDashboardShape(): DashboardData {
  const base = getDeptHeadMockDashboardData();
  const rec: Record<string, number> = {};
  MOCK_CORES.filter((c) => c.isMine).forEach((c) => {
    rec[c.status] = (rec[c.status] || 0) + 1;
  });
  return { ...base, prsByStatus: rec as unknown as DashboardData['prsByStatus'] };
}

/** Pending list cho Dashboard department head */
export function getDeptHeadMockDepartmentDashboard() {
  const pending = MOCK_CORES.filter((c) => c.status === 'MANAGER_PENDING' && !c.isMine);
  return {
    pendingCount: pending.length,
    approvedCount: 7,
    rejectedCount: 1,
    pendingPRs: pending.map((c) => {
      const items = mockItemsFor(c.seq);
      return {
        id: prIdForSeq(c.seq),
        prNumber: c.prNumber,
        type: c.prType,
        typeLabel: TYPE_LABEL[c.prType] || c.prType,
        department: c.department,
        itemName: c.itemName,
        itemCount: items.length,
        totalAmount: c.totalAmount,
        currency: c.currency,
        requestor: { id: c.requestorId, username: c.requestorUsername, email: `${c.requestorUsername}@demo.local` },
        requiredDate: c.requiredDate,
        createdAt: c.createdAt,
        salesOrder: c.salesOrder,
      };
    }),
  };
}

/** API pending-prs (chi tiết cho Duyệt PR) */
export function getDeptHeadMockPendingPRsDetailed() {
  const pending = MOCK_CORES.filter((c) => c.status === 'MANAGER_PENDING' && !c.isMine);
  const prs = pending.map((c) => {
    const items = mockItemsFor(c.seq);
    return {
      id: prIdForSeq(c.seq),
      prNumber: c.prNumber,
      type: c.prType,
      typeLabel: TYPE_LABEL[c.prType] || c.prType,
      department: c.department,
      itemName: c.itemName,
      itemCount: items.length,
      totalAmount: c.totalAmount,
      currency: c.currency,
      requestor: { id: c.requestorId, username: c.requestorUsername, email: `${c.requestorUsername}@demo.local` },
      requiredDate: c.requiredDate,
      purpose: c.purpose,
      notes: c.notes,
      createdAt: c.createdAt,
      salesOrder: c.salesOrder,
      items: items.map((it, idx) => ({
        ...it,
        partNo: `PNO-DEMO-${c.seq}-${idx + 1}`,
        spec: 'Demo spec',
        manufacturer: null as string | null,
        estimatedUnitPriceVnd: it.unitPrice,
        status: 'NEW',
        sourceStatus: 'NEED_PURCHASE',
        fromStockQty: 0,
        purchaseQty: it.qty,
      })),
      hasPreviousApproval: false,
    };
  });
  return { prs };
}

const TYPE_LABEL: Record<string, string> = {
  MATERIAL: 'Vật tư',
  SERVICE: 'Dịch vụ',
  COMMERCIAL: 'Thương mại',
  PRODUCTION: 'Sản xuất',
  PROJECT: 'Dự án',
  OFFICE: 'Văn phòng',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  MANAGER_PENDING: 'Chờ quản lý trực tiếp',
  MANAGER_APPROVED: 'Quản lý trực tiếp đã duyệt',
  BRANCH_MANAGER_PENDING: 'Chờ GĐ Chi nhánh',
  BUYER_LEADER_PENDING: 'Chờ Buyer Leader phân công',
  ASSIGNED_TO_BUYER: 'Đã phân công Buyer',
  MANAGER_RETURNED: 'Trả về',
  NEED_MORE_INFO: 'Cần bổ sung',
};

export function getDeptHeadMockDepartmentOverview() {
  const prsByEmployeeMap = new Map<string, { username: string; count: number; totalAmount: number }>();
  MOCK_CORES.forEach((c) => {
    const key = c.requestorId;
    const cur = prsByEmployeeMap.get(key);
    if (cur) {
      cur.count += 1;
      cur.totalAmount += c.totalAmount;
    } else {
      prsByEmployeeMap.set(key, { username: c.requestorUsername, count: 1, totalAmount: c.totalAmount });
    }
  });
  const prsByEmployee = Array.from(prsByEmployeeMap.values()).sort((a, b) => b.count - a.count);

  const prsByTypeMap = new Map<string, { type: string; count: number; totalAmount: number }>();
  MOCK_CORES.forEach((c) => {
    const k = c.prType;
    const cur = prsByTypeMap.get(k);
    if (cur) {
      cur.count += 1;
      cur.totalAmount += c.totalAmount;
    } else {
      prsByTypeMap.set(k, { type: TYPE_LABEL[k] || k, count: 1, totalAmount: c.totalAmount });
    }
  });
  const prsByType = Array.from(prsByTypeMap.values());

  const prsByStatusMap = new Map<string, { status: string; count: number; totalAmount: number }>();
  MOCK_CORES.forEach((c) => {
    const cur = prsByStatusMap.get(c.status);
    if (cur) {
      cur.count += 1;
      cur.totalAmount += c.totalAmount;
    } else {
      prsByStatusMap.set(c.status, {
        status: STATUS_LABEL[c.status] || c.status,
        count: 1,
        totalAmount: c.totalAmount,
      });
    }
  });
  const prsByStatus = Array.from(prsByStatusMap.entries())
    .map(([statusCode, v]) => ({
      statusCode,
      status: v.status,
      count: v.count,
      totalAmount: v.totalAmount,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    prsByEmployee,
    prsByType,
    prsByStatus,
    totalPRs: MOCK_CORES.length,
  };
}

export function getDeptHeadMockStockIssues(): StockIssueDto[] {
  const statuses: StockIssueDto['status'][] = ['DRAFT', 'RESERVED', 'APPROVED', 'ISSUED', 'APPROVED'];
  return [1, 2, 3, 4, 5].map((i) => ({
    id: `dh-mock-si-${String(i).padStart(2, '0')}`,
    issueNumber: `XK-DEMO-2026-${String(100 + i)}`,
    status: statuses[i - 1],
    purpose: `Xuất kho bổ sung chuyền ${i}`,
    notes: i === 2 ? 'Chờ kho xác nhận tồn.' : null,
    createdAt: isoDaysAgo(10 + i),
    updatedAt: isoDaysAgo(i),
    requestor: { id: 'local-user', username: 'dept.head.demo', fullName: 'Trưởng phòng Demo' },
    salesPO:
      i % 2 === 0
        ? { id: `spo-si-${i}`, salesPONumber: `SO-SI-${200 + i}`, customerPONumber: `CPO-SI-${i}` }
        : null,
    purchaseRequest: i % 3 === 0 ? { id: prIdForSeq(i), prNumber: 'PR-DH-DEMO-2026-01', projectCode: 'PRJ-X', projectName: 'Line X' } : null,
    items: [
      {
        id: `dh-mock-si-${i}-li1`,
        lineNo: 1,
        partInternalCode: `PART-DEMO-${i}A`,
        partName: `Vật tư demo ${i}A`,
        unit: 'cái',
        qty: 10 + i,
        description: 'Hàng demo xuất kho',
      },
      {
        id: `dh-mock-si-${i}-li2`,
        lineNo: 2,
        partInternalCode: `PART-DEMO-${i}B`,
        partName: `Vật tư demo ${i}B`,
        unit: 'kg',
        qty: 5,
        description: null,
      },
    ],
  }));
}

export function getDeptHeadMockStockIssueById(id: string): StockIssueDto | undefined {
  return getDeptHeadMockStockIssues().find((x) => x.id === id);
}
