/**
 * Dữ liệu demo cho Giám đốc chi nhánh (DEV).
 * Hiện tại đã tắt mock để luôn dùng API thật.
 */
import type { PRSalesOrderInfo } from '../types/prSalesOrder';
import type {
  BranchManagerDashboardData,
  BranchOverviewData,
  PendingPRsData,
} from '../services/branchManagerService';
import { isBranchManagerMockOutletActive } from './branchManagerMockScope';

const MOCK_COUNT = 20;

export function isBranchManagerMockEnvEnabled(): boolean {
  return false;
}

export function shouldServeBranchManagerMock(): boolean {
  return isBranchManagerMockEnvEnabled() && isBranchManagerMockOutletActive();
}

const DEPTS = ['Sản xuất', 'Kỹ thuật', 'QA', 'Kho', 'Dự án', 'Mua hàng', 'Điện'];

const MOCK_REQUESTORS = [
  { username: 'le.thi.hoa', email: 'lea@demo.local', location: 'HANOI' },
  { username: 'pham.minh.an', email: 'pmd@demo.local', location: 'HANOI' },
  { username: 'tran.van.dung', email: 'tvd@demo.local', location: 'HCMC' },
  { username: 'nguyen.thi.mai', email: 'ntm@demo.local', location: 'HCMC' },
  { username: 'hoang.quoc.bao', email: 'hqb@demo.local', location: 'DANANG' },
  { username: 'vo.thi.cam', email: 'vtc@demo.local', location: 'HANOI' },
  { username: 'dang.huu.phuc', email: 'dhp@demo.local', location: 'HANOI' },
  { username: 'ly.thi.khanh', email: 'ltk@demo.local', location: 'HCMC' },
] as const;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function salesOrderLinked(seq: number, linked: boolean): PRSalesOrderInfo {
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
  const n = 2100 + (seq % 997);
  return {
    linkedToSO: true,
    salesPOId: `mock-spo-cn-${seq}`,
    salesPONumber: `SO-2026-CN-${n}`,
    customerPONumber: `CPO-CN-${n}`,
    projectName: `Chi nhánh — dự án ${seq % 7}`,
    projectCode: `PRJ-CN-${String(n).padStart(4, '0')}`,
    customerName: 'RMG Pilot',
    label: `SO-2026-CN-${n}`,
  };
}

/** 20 PR chờ duyệt — dùng chung dashboard + trang duyệt */
function buildTwentyPendingRaw() {
  const rows: Array<{
    id: string;
    prNumber: string;
    department: string;
    totalAmount: number;
    currency: string;
    requestor: { username: string; email: string; location: string };
    itemName: string;
    createdAt: string;
    purpose: string;
    notes?: string;
    requiredDate?: string;
    salesOrder: PRSalesOrderInfo;
    typeDb: 'PRODUCTION' | 'COMMERCIAL';
  }> = [];

  const itemLabels = [
    'Vật tư CNC spindle',
    'Dịch vụ bảo trì PLC',
    'Linh kiện SMT feeders',
    'Thép tấm CT3',
    'Pallet gỗ xuất kho',
    'Biến tần Siemens',
    'Camera QC inline',
    'Dầu thủy lực ISO VG',
    'PC công nghiệp Fanless',
    'Cáp bus Profibus',
  ];

  for (let i = 1; i <= MOCK_COUNT; i++) {
    const peer = MOCK_REQUESTORS[(i - 1) % MOCK_REQUESTORS.length];
    const dept = DEPTS[(i - 1) % DEPTS.length];
    const amt = 12_500_000 + i * 3_770_000 + (i % 5) * 1_250_000;
    const prod = i % 3 !== 0;
    rows.push({
      id: `bm-mock-pending-${String(i).padStart(3, '0')}`,
      prNumber: `PR-CN-DEMO-2026-${String(i).padStart(2, '0')}`,
      department: dept,
      totalAmount: amt,
      currency: 'VND',
      requestor: { username: peer.username, email: peer.email, location: peer.location },
      itemName: itemLabels[(i - 1) % itemLabels.length],
      createdAt: isoDaysAgo(i % 17),
      purpose: `Nhu cầu ${dept.toLowerCase()} — lô RMG-CN/${String(i).padStart(3, '0')}`,
      notes: i % 4 === 0 ? `Ghi chú demo: kiểm tra chất lượng trước khi duyệt (#${i}).` : undefined,
      requiredDate: i % 5 === 0 ? isoDaysAgo(-10 - (i % 8)) : undefined,
      salesOrder: salesOrderLinked(i, i % 2 === 0),
      typeDb: prod ? 'PRODUCTION' : 'COMMERCIAL',
    });
  }
  return rows;
}

const MOCK_PENDING_ROWS = buildTwentyPendingRaw();

function pendingToRecentPending(pr: (typeof MOCK_PENDING_ROWS)[number]): BranchManagerDashboardData['recentPendingPRs'][number] {
  return {
    id: pr.id,
    prNumber: pr.prNumber,
    department: pr.department,
    totalAmount: pr.totalAmount,
    currency: pr.currency,
    requestor: {
      username: pr.requestor.username,
      location: pr.requestor.location,
    },
    itemName: pr.itemName,
    createdAt: pr.createdAt,
    purpose: pr.purpose,
    salesOrder: pr.salesOrder,
  };
}

/** PR đầy đủ cho trang duyệt (khớp field mà UI đang đọc) */
function pendingToFullPr(pr: (typeof MOCK_PENDING_ROWS)[number]) {
  const seq = Number(pr.prNumber.slice(-2)) || 1;
  const qty = 5 + (seq % 40);
  return {
    id: pr.id,
    prNumber: pr.prNumber,
    department: pr.department,
    totalAmount: pr.totalAmount,
    currency: pr.currency,
    requestor: pr.requestor,
    itemName: pr.itemName,
    quantity: qty,
    unit: pr.typeDb === 'PRODUCTION' ? 'pcs' : 'set',
    specifications: `Spec demo — ${pr.itemName}`,
    requiredDate: pr.requiredDate,
    purpose: pr.purpose,
    notes: pr.notes,
    createdAt: pr.createdAt,
    salesOrder: pr.salesOrder.linkedToSO
      ? {
          salesPONumber: pr.salesOrder.salesPONumber!,
          projectName: pr.salesOrder.projectName!,
        }
      : undefined,
    items: [
      {
        id: `${pr.id}-line-1`,
        lineNo: 1,
        description: pr.itemName,
        partNo: `PT-CN-${String(pr.prNumber.slice(-2)).padStart(2, '0')}`,
        spec: 'Theo BOM RMG-CN',
        manufacturer: pr.typeDb === 'PRODUCTION' ? 'Plant mix' : 'Trading mix',
        qty,
        unit: pr.typeDb === 'PRODUCTION' ? 'pcs' : 'set',
        unitPrice: Math.round(pr.totalAmount / qty),
        amount: pr.totalAmount,
        estimatedUnitPriceVnd: Math.round(pr.totalAmount / qty),
        purpose: 'Sản xuất / kinh doanh chi nhánh',
        remark: null,
      },
    ],
    lastApproval: null as any,
  };
}

/** Gộp theo department (giống logic dashboard server với đám pending) */
function prsByDepartmentFrom(rows: typeof MOCK_PENDING_ROWS): BranchManagerDashboardData['prsByDepartment'] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.department, (map.get(r.department) || 0) + 1);
  }
  return Array.from(map.entries()).map(([department, count]) => ({ department, count }));
}

export function getBranchManagerMockDashboard(): BranchManagerDashboardData {
  const recentPendingPRs = MOCK_PENDING_ROWS.map(pendingToRecentPending);
  const prsByDept = prsByDepartmentFrom(MOCK_PENDING_ROWS);

  const prsByDate: BranchManagerDashboardData['prsByDate'] = [];
  for (let d = 0; d < 30; d += 3) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const key = date.toISOString().split('T')[0];
    const count = 1 + ((d / 3 + MOCK_COUNT) % 4);
    prsByDate.push({ date: key, count });
  }
  prsByDate.sort((a, b) => a.date.localeCompare(b.date));

  const productionApproved = MOCK_PENDING_ROWS.filter((r) => r.typeDb === 'PRODUCTION').length;
  const commercialApproved = MOCK_PENDING_ROWS.filter((r) => r.typeDb === 'COMMERCIAL').length;

  return {
    pendingPRs: MOCK_COUNT,
    approvedPRsThisPeriod: 18,
    rejectedPRsThisPeriod: 2,
    urgentPRs: 3,
    budgetExceptionsPending: 2,
    totalPRValueThisMonth: MOCK_PENDING_ROWS.reduce((s, r) => s + r.totalAmount, 0),
    approvalRateLast30d: 90,
    avgBranchApprovalLeadTimeHours: 6.8,
    budgetVarianceAvgOverPercent: 8.6,
    productionValueSharePercent:
      productionApproved + commercialApproved > 0
        ? Math.round((productionApproved / (productionApproved + commercialApproved)) * 100)
        : 62.5,
    prsByDepartment: prsByDept,
    recentPendingPRs,
    prsByType: {
      PRODUCTION: productionApproved + 12,
      COMMERCIAL: commercialApproved + 4,
    },
    prsByDate,
    urgentPRList: MOCK_PENDING_ROWS.slice(0, 3).map((r) => ({
      id: r.id,
      prNumber: r.prNumber,
      itemName: r.itemName,
      requiredDate: r.requiredDate || isoDaysAgo(-2),
    })),
  };
}

/** Overview: đủ phòng ban + loại + top giá trị (mock ≥ 50M để có bảng) */
export function getBranchManagerMockBranchOverview(): BranchOverviewData {
  const extraTotals = MOCK_PENDING_ROWS.map((r, i) => ({
    ...r,
    totalAmount: r.totalAmount + i * 2_250_000,
    id: `bm-mock-overview-${String(i).padStart(3, '0')}`,
  }));

  const prsByDepartmentMap = new Map<string, number>();
  const prsByTypeMap = new Map<string, number>();
  for (const r of extraTotals) {
    prsByDepartmentMap.set(r.department, (prsByDepartmentMap.get(r.department) || 0) + 1);
    prsByTypeMap.set(r.typeDb, (prsByTypeMap.get(r.typeDb) || 0) + 1);
  }

  const topPRsByValue = [...extraTotals]
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 20)
    .map((pr) => ({
      id: pr.id,
      prNumber: pr.prNumber,
      department: pr.department,
      totalAmount: Math.max(pr.totalAmount, 55_000_000),
      currency: pr.currency,
      requestor: pr.requestor.username,
      createdAt: pr.createdAt,
    }));

  return {
    prsByDepartment: Array.from(prsByDepartmentMap.entries()).map(([department, count]) => ({ department, count })),
    prsByType: Array.from(prsByTypeMap.entries()).map(([type, count]) => ({ type, count })),
    topPRsByValue,
  };
}

export function getBranchManagerMockPendingPRs(): PendingPRsData {
  return {
    prs: MOCK_PENDING_ROWS.map(pendingToFullPr),
  };
}
