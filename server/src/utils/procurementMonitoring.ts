import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { computePrProposedBudgetAmount, comparePoTotalToPrProposedBudget } from './prProposedBudget';
import {
  buildBusinessTimeline,
  buildCurrentStepBadge,
  buildDeliverySummary,
  buildSelectedQuotationDeliveryByPrItem,
  computeProcurementCostInsight,
  computeTrackingSla,
  deriveItemProcurementRow,
  enrichProcurementCostInsight,
  mapRequestorTrackingPoLines,
  type ProcurementCostInsight,
  type RequestorProcurementItemRow,
} from './requestorProcurementTracking';

const toNum = (v: unknown) => {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const TERMINAL_PR = new Set(['CANCELLED', 'PAYMENT_DONE', 'CLOSED']);

const PO_COMPLETED = new Set(['FULLY_RECEIVED', 'CLOSED']);
const PO_EXCLUDED_EXPORT = new Set(['DRAFT']);

export type MonitorExportLifecycle = 'all' | 'pending' | 'completed';

export type MonitorExportPrRow = {
  prNumber: string;
  department: string | null;
  branch: string | null;
  buyerName: string | null;
  prStatusLabel: string;
  reportGroup: 'Đang xử lý' | 'Hoàn thành';
  currentStep: string;
  currentStepDetail: string | null;
  eta: string | null;
  slaLabel: string;
  riskLabel: string | null;
  progressPercent: number;
  itemCount: number;
  rfqCount: number;
  poCount: number;
  hasReopen: boolean;
  proposedBudget: number;
};

export type MonitorExportPoRow = {
  poNumber: string;
  prNumber: string;
  branch: string | null;
  vendorName: string;
  poStatusLabel: string;
  reportGroup: 'Đang xử lý' | 'Hoàn thành';
  eta: string | null;
  receivedLabel: string;
  isOverdue: boolean;
};

const PR_STATUS_VI: Record<string, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã gửi',
  MANAGER_PENDING: 'Chờ quản lý trực tiếp',
  MANAGER_APPROVED: 'QL trực tiếp đã duyệt',
  MANAGER_REJECTED: 'QL trực tiếp từ chối',
  BRANCH_MANAGER_PENDING: 'Chờ GĐ chi nhánh',
  BRANCH_MANAGER_APPROVED: 'GĐCN đã duyệt',
  BRANCH_MANAGER_REJECTED: 'GĐCN từ chối',
  BUYER_LEADER_PENDING: 'Chờ Buyer Leader',
  ASSIGNED_TO_BUYER: 'Đã phân công Buyer',
  RFQ_IN_PROGRESS: 'Đang RFQ',
  QUOTATION_RECEIVED: 'Đã có báo giá',
  SUPPLIER_SELECTED: 'Đã chọn NCC',
  PO_PENDING: 'Chờ tạo PO',
  BUDGET_EXCEPTION: 'Ngoại lệ ngân sách',
  INCOMING: 'Chờ nhận kho',
  PARTIAL_RECEIVED: 'Nhận một phần',
  RECEIVED: 'Đã nhận',
  PAYMENT_DONE: 'Hoàn tất thanh toán',
  CLOSED: 'Đóng',
  CANCELLED: 'Đã hủy',
};

const PO_STATUS_VI: Record<string, string> = {
  CREATED: 'Đã tạo',
  SENT: 'Đã gửi NCC',
  ISSUED: 'Đã phát hành',
  CONFIRMED: 'NCC xác nhận',
  PARTIAL_RECEIVED: 'Nhận một phần',
  FULLY_RECEIVED: 'Nhận đủ',
  CLOSED: 'Đóng',
  CANCELLED: 'Đã hủy',
  CANCEL_REQUESTED: 'Yêu cầu hủy',
};

function prStatusLabelVi(status: string): string {
  return PR_STATUS_VI[status] ?? status;
}

function poStatusLabelVi(status: string): string {
  return PO_STATUS_VI[status] ?? status;
}

function isPrCompletedForExport(prStatus: string, sla: MonitorSlaLevel): boolean {
  return TERMINAL_PR.has(prStatus) || sla === 'completed';
}

function isPoCompletedForExport(poStatus: string): boolean {
  return PO_COMPLETED.has(poStatus);
}

function prMatchesLifecycle(
  prStatus: string,
  sla: MonitorSlaLevel,
  lifecycle: MonitorExportLifecycle
): boolean {
  const completed = isPrCompletedForExport(prStatus, sla);
  if (lifecycle === 'completed') return completed;
  if (lifecycle === 'pending') return !completed;
  return true;
}

function poMatchesLifecycle(poStatus: string, lifecycle: MonitorExportLifecycle): boolean {
  if (PO_EXCLUDED_EXPORT.has(poStatus)) return false;
  const completed = isPoCompletedForExport(poStatus);
  if (lifecycle === 'completed') return completed;
  if (lifecycle === 'pending') return !completed;
  return true;
}

function lifecycleWhere(
  lifecycle: MonitorExportLifecycle
): Prisma.PurchaseRequestWhereInput['status'] {
  if (lifecycle === 'completed') return { in: Array.from(TERMINAL_PR) };
  if (lifecycle === 'pending') return { notIn: [...TERMINAL_PR, 'DRAFT'] };
  return { notIn: ['DRAFT'] };
}

const PO_IN_TRANSIT = new Set([
  'SENT',
  'ISSUED',
  'CONFIRMED',
  'PARTIAL_RECEIVED',
]);

const PO_PRE_SENT = new Set(['CREATED', 'DRAFT']);

const APPROVAL_PENDING_STATUSES = new Set([
  'SUBMITTED',
  'MANAGER_PENDING',
  'MANAGER_APPROVED',
  'DEPARTMENT_HEAD_PENDING',
  'DEPARTMENT_HEAD_APPROVED',
  'BRANCH_MANAGER_PENDING',
  'BUDGET_EXCEPTION',
]);

export type MonitorScope =
  | { kind: 'all' }
  | { kind: 'branch'; location: string }
  | { kind: 'manager_team'; directManagerCode: string };

export type MonitorSlaLevel = 'healthy' | 'warning' | 'critical' | 'completed';
export type MonitorRiskTag = 'delay' | 'reopen' | 'over_budget' | 'vendor' | 'missing_quote' | null;

export type ProcurementMonitorRow = {
  prId: string;
  prNumber: string;
  department: string | null;
  branch: string | null;
  buyerName: string | null;
  currentStep: string;
  currentStepDetail: string | null;
  eta: string | null;
  sla: MonitorSlaLevel;
  slaLabel: string;
  risk: MonitorRiskTag;
  riskLabel: string | null;
  prStatus: string;
  progressPercent: number;
  hasReopen: boolean;
  itemCount: number;
  rfqCount: number;
  poCount: number;
};

export type ProcurementMonitorAlert = {
  id: string;
  severity: 'critical' | 'high' | 'medium';
  category: string;
  title: string;
  description: string;
  prNumber?: string;
  poNumber?: string;
  detectedAt: string;
};

export type ProcurementMonitoringSnapshot = {
  generatedAt: string;
  scopeLabel: string;
  kpis: {
    prInProgress: number;
    poInTransit: number;
    itemsAwaitingPurchase: number;
    poOverEta: number;
    reopenProcurement: number;
    totalSourcingValue: number;
  };
  pipeline: Array<{ key: string; label: string; count: number }>;
  rows: ProcurementMonitorRow[];
  reopenRows: Array<{
    prId: string;
    prNumber: string;
    itemLabel: string;
    buyerName: string | null;
    reason: string | null;
    qtyWaiting: number;
  }>;
  costRows: Array<{
    prId: string;
    prNumber: string;
    budget: number;
    currentCost: number;
    variance: number;
    direction: 'over' | 'savings' | 'on_budget';
  }>;
  deliveryRows: Array<{
    poId: string;
    poNumber: string;
    prNumber: string;
    vendorName: string;
    eta: string | null;
    receivedLabel: string;
    isOverdue: boolean;
  }>;
  alerts: ProcurementMonitorAlert[];
};

function slaToMonitorLevel(
  status: 'on_time' | 'warning' | 'overdue' | 'completed'
): MonitorSlaLevel {
  if (status === 'overdue') return 'critical';
  if (status === 'warning') return 'warning';
  if (status === 'completed') return 'completed';
  return 'healthy';
}

function slaLabelVi(level: MonitorSlaLevel): string {
  switch (level) {
    case 'healthy':
      return 'Đúng tiến độ';
    case 'warning':
      return 'Cảnh báo';
    case 'critical':
      return 'Quá SLA';
    case 'completed':
      return 'Hoàn tất';
    default:
      return '—';
  }
}

/** Chỉ khi PR đang chờ GĐCN duyệt ngoại lệ ngân sách (PENDING). */
function isBudgetExceptionAwaitingApproval(
  prStatus: string,
  budgetExceptions: { status: string }[]
): boolean {
  return (
    prStatus === 'BUDGET_EXCEPTION' &&
    budgetExceptions.some((e) => String(e.status) === 'PENDING')
  );
}

function classifyPipelineBucket(
  prStatus: string,
  itemRows: RequestorProcurementItemRow[],
  hasSentPo: boolean,
  hasOpenRfq: boolean,
  budgetExceptions: { status: string }[]
): string {
  if (itemRows.some((i) => ['AWAITING_REORDER', 'LINE_CANCEL_PENDING'].includes(i.statusKey))) {
    return 'reopen';
  }
  if (isBudgetExceptionAwaitingApproval(prStatus, budgetExceptions)) {
    return 'approval';
  }
  if (APPROVAL_PENDING_STATUSES.has(prStatus)) {
    if (prStatus === 'BUDGET_EXCEPTION') return 'rfq';
    return 'approval';
  }
  if (
    ['INCOMING', 'PARTIAL_RECEIVED', 'DELAYED', 'RECEIVED'].includes(
      itemRows.find((i) => !['FULFILLED', 'FROM_STOCK', 'CANCELLED', 'REJECTED'].includes(i.statusKey))
        ?.statusKey ?? ''
    )
  ) {
    return 'incoming';
  }
  if (hasSentPo) return 'po_sent';
  if (['SUPPLIER_SELECTED', 'RFQ_COMPLETED', 'PO_PENDING'].includes(prStatus)) {
    return 'award';
  }
  if (
    hasOpenRfq ||
    ['RFQ_IN_PROGRESS', 'QUOTATION_RECEIVED', 'ASSIGNED_TO_BUYER'].includes(prStatus)
  ) {
    return 'rfq';
  }
  if (['BUYER_LEADER_PENDING', 'BRANCH_MANAGER_APPROVED', 'BUDGET_APPROVED'].includes(prStatus)) {
    return 'approval';
  }
  return 'rfq';
}

function buildMonitorCostInsight(
  proposedBudget: number,
  pr: {
    supplierSelections: unknown;
    purchaseOrders: Array<{
      status: string | null;
      totalAmount: unknown;
      items: Array<{
        qty: unknown;
        unitPrice: unknown;
        amount?: unknown;
        confirmedQty: unknown;
      }>;
    }>;
  }
): ProcurementCostInsight {
  return computeProcurementCostInsight(
    proposedBudget,
    (pr.supplierSelections || []) as Parameters<typeof computeProcurementCostInsight>[1],
    pr.purchaseOrders.map((po) => ({
      status: String(po.status ?? ''),
      totalAmount: po.totalAmount,
      items: po.items.map((it) => ({
        qty: it.qty,
        unitPrice: it.unitPrice,
        amount: it.amount,
        confirmedQty: it.confirmedQty,
      })),
    }))
  );
}

function costOverRiskLabel(costInsight: ProcurementCostInsight): string {
  const pct = Math.abs(costInsight.deltaPercent);
  if (pct >= 0.05) return `Vượt giá đề xuất (+${pct.toFixed(1)}%)`;
  return 'Vượt giá đề xuất';
}

function deriveRisk(
  itemRows: RequestorProcurementItemRow[],
  prStatus: string,
  budgetExceptions: { status: string }[],
  costInsight: ProcurementCostInsight
): { risk: MonitorRiskTag; riskLabel: string | null } {
  if (itemRows.some((i) => i.statusKey === 'DELAYED')) {
    return { risk: 'delay', riskLabel: 'Trễ giao' };
  }
  if (itemRows.some((i) => i.statusKey === 'AWAITING_REORDER')) {
    return { risk: 'reopen', riskLabel: 'Mua lại / NCC' };
  }
  if (isBudgetExceptionAwaitingApproval(prStatus, budgetExceptions)) {
    return { risk: 'over_budget', riskLabel: 'Chờ duyệt NS' };
  }
  if (
    costInsight.status === 'over' &&
    (costInsight.proposedAmount ?? 0) > 0 &&
    (costInsight.procurementCostAmount ?? 0) > 0
  ) {
    return { risk: 'over_budget', riskLabel: costOverRiskLabel(costInsight) };
  }
  if (
    ['RFQ_IN_PROGRESS', 'ASSIGNED_TO_BUYER'].includes(prStatus) &&
    !itemRows.some((i) => ['RFQ', 'SUPPLIER_SELECTED'].includes(i.statusKey))
  ) {
    return { risk: 'missing_quote', riskLabel: 'Thiếu BG' };
  }
  return { risk: null, riskLabel: null };
}

function formatDateIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function buildScopeWhere(scope: MonitorScope): Prisma.PurchaseRequestWhereInput {
  const base: Prisma.PurchaseRequestWhereInput = {
    deletedAt: null,
    status: { notIn: ['DRAFT'] },
  };

  if (scope.kind === 'branch') {
    base.requestor = { location: scope.location };
  } else if (scope.kind === 'manager_team') {
    base.requestor = { directManagerCode: scope.directManagerCode };
  }

  return base;
}

function scopeLabel(scope: MonitorScope): string {
  if (scope.kind === 'all') return 'Toàn công ty';
  if (scope.kind === 'branch') return `Chi nhánh ${scope.location}`;
  return 'Phòng ban (đội trực tiếp)';
}

export async function resolveProcurementMonitorScope(
  userId: string,
  role: string
): Promise<MonitorScope> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, location: true },
  });
  if (!user?.username) {
    return { kind: 'all' };
  }

  if (role === 'BRANCH_MANAGER') {
    const loc = user.location?.trim();
    if (!loc || loc === 'ALL') return { kind: 'all' };
    return { kind: 'branch', location: loc };
  }

  if (role === 'DEPARTMENT_HEAD') {
    return { kind: 'manager_team', directManagerCode: user.username };
  }

  return { kind: 'all' };
}

export async function buildProcurementMonitoringSnapshot(
  scope: MonitorScope
): Promise<ProcurementMonitoringSnapshot> {
  const prs = await prisma.purchaseRequest.findMany({
    where: buildScopeWhere(scope),
    include: {
      requestor: { select: { username: true, fullName: true, location: true } },
      items: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } },
      purchaseOrders: {
        where: { deletedAt: null },
        include: {
          items: true,
          supplier: { select: { name: true } },
        },
      },
      supplierSelections: {
        select: {
          purchaseRequestItemId: true,
          quotation: {
            select: {
              items: {
                where: { deletedAt: null },
                select: {
                  purchaseRequestItemId: true,
                  deliveryDate: true,
                  leadTimeDays: true,
                },
              },
            },
          },
        },
      },
      assignments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          buyer: { select: { fullName: true, username: true } },
        },
      },
      rfqs: { where: { deletedAt: null }, select: { id: true, status: true } },
      budgetExceptions: {
        where: { status: 'PENDING' },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });

  const activePrs = prs.filter((p) => !TERMINAL_PR.has(String(p.status ?? '')));

  const allPoItemIds = activePrs.flatMap((pr) =>
    pr.purchaseOrders.flatMap((po) => po.items.map((it) => it.id))
  );
  const receivedRows =
    allPoItemIds.length > 0
      ? await prisma.goodsReceiptLine.groupBy({
          by: ['poItemId'],
          where: { poItemId: { in: allPoItemIds } },
          _sum: { qtyReceived: true },
        })
      : [];
  const receivedByPoItemId = new Map(
    receivedRows.map((r) => [r.poItemId, toNum(r._sum.qtyReceived)])
  );

  const pipelineCounts: Record<string, number> = {
    approval: 0,
    rfq: 0,
    award: 0,
    po_sent: 0,
    incoming: 0,
    reopen: 0,
  };

  let poInTransit = 0;
  let poOverEta = 0;
  let itemsAwaitingPurchase = 0;
  let reopenProcurement = 0;
  let totalSourcingValue = 0;

  const rows: ProcurementMonitorRow[] = [];
  const reopenRows: ProcurementMonitoringSnapshot['reopenRows'] = [];
  const costRows: ProcurementMonitoringSnapshot['costRows'] = [];
  const deliveryRows: ProcurementMonitoringSnapshot['deliveryRows'] = [];
  const alerts: ProcurementMonitorAlert[] = [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  for (const pr of activePrs) {
    const prStatus = String(pr.status ?? '');
    const poLines = mapRequestorTrackingPoLines(
      pr.purchaseOrders.map((po) => ({
        poNumber: po.poNumber,
        status: po.status,
        rejectReason: po.rejectReason,
        cancelRequestedPoItemIds: (po as { cancelRequestedPoItemIds?: string | null })
          .cancelRequestedPoItemIds,
        items: po.items,
      }))
    );

    const quotationDeliveryByPrItem = buildSelectedQuotationDeliveryByPrItem(
      (pr.supplierSelections || []) as Parameters<typeof buildSelectedQuotationDeliveryByPrItem>[0]
    );

    const itemRows = pr.items.map((item) =>
      deriveItemProcurementRow(
        {
          id: item.id,
          lineNo: item.lineNo,
          description: item.description,
          partNo: item.partNo,
          qty: item.qty,
          purchaseQty: item.purchaseQty,
          status: String(item.status ?? 'NEW'),
          departmentItemOutcome: item.departmentItemOutcome,
          branchItemOutcome: item.branchItemOutcome,
          desiredDeliveryDate: item.desiredDeliveryDate,
        },
        poLines,
        receivedByPoItemId,
        prStatus,
        quotationDeliveryByPrItem
      )
    );

    const deliverySummary = buildDeliverySummary(itemRows);
    const currentStep = buildCurrentStepBadge(prStatus, itemRows, deliverySummary, poLines);
    const timeline = buildBusinessTimeline(prStatus, itemRows, poLines);
    const slaRaw = computeTrackingSla(prStatus, timeline.percentage, pr.createdAt);
    const sla = slaToMonitorLevel(slaRaw.status);

    const proposedBudget = computePrProposedBudgetAmount(pr.items);
    const costInsight = buildMonitorCostInsight(proposedBudget, pr);
    const poTotal = pr.purchaseOrders
      .filter((po) => !PO_PRE_SENT.has(String(po.status ?? '')))
      .reduce((s, po) => s + toNum(po.totalAmount), 0);
    const budgetCompare = comparePoTotalToPrProposedBudget(poTotal, proposedBudget);
    const { risk, riskLabel } = deriveRisk(
      itemRows,
      prStatus,
      pr.budgetExceptions,
      costInsight
    );

    const buyer = pr.assignments[0]?.buyer;
    const buyerName = buyer?.fullName || buyer?.username || null;

    const hasSentPo = pr.purchaseOrders.some((po) =>
      PO_IN_TRANSIT.has(String(po.status ?? ''))
    );
    const hasOpenRfq = pr.rfqs.some((r) => !['CLOSED', 'CANCELLED'].includes(String(r.status ?? '')));
    const bucket = classifyPipelineBucket(
      prStatus,
      itemRows,
      hasSentPo,
      hasOpenRfq,
      pr.budgetExceptions
    );
    pipelineCounts[bucket] = (pipelineCounts[bucket] ?? 0) + 1;

    const hasReopen = itemRows.some((i) =>
      ['AWAITING_REORDER', 'LINE_CANCEL_PENDING'].includes(i.statusKey)
    );
    if (hasReopen) reopenProcurement += 1;

    for (const it of itemRows) {
      if (it.statusKey === 'AWAITING_REORDER') {
        itemsAwaitingPurchase += Math.max(1, Math.round(it.qtyWaiting));
        reopenRows.push({
          prId: pr.id,
          prNumber: pr.prNumber,
          itemLabel: it.label,
          buyerName,
          reason: it.lineCancelReason,
          qtyWaiting: it.qtyWaiting,
        });
      }
    }

    if (proposedBudget > 0) totalSourcingValue += proposedBudget;
    else totalSourcingValue += toNum(pr.totalAmount);

    rows.push({
      prId: pr.id,
      prNumber: pr.prNumber,
      department: pr.department,
      branch: pr.requestor?.location ?? null,
      buyerName,
      currentStep: currentStep.label,
      currentStepDetail: currentStep.detail,
      eta: deliverySummary.nextEta,
      sla,
      slaLabel: slaLabelVi(sla),
      risk,
      riskLabel,
      prStatus,
      progressPercent: timeline.percentage,
      hasReopen,
      itemCount: pr.items.length,
      rfqCount: pr.rfqs.length,
      poCount: pr.purchaseOrders.length,
    });

    if (
      isBudgetExceptionAwaitingApproval(prStatus, pr.budgetExceptions) &&
      budgetCompare &&
      budgetCompare.direction !== 'on_budget' &&
      proposedBudget > 0
    ) {
      costRows.push({
        prId: pr.id,
        prNumber: pr.prNumber,
        budget: budgetCompare.prProposedAmount,
        currentCost: budgetCompare.poTotalAmount,
        variance:
          budgetCompare.direction === 'over'
            ? budgetCompare.deltaAmount
            : -budgetCompare.deltaAmount,
        direction: budgetCompare.direction,
      });
    }

    for (const po of pr.purchaseOrders) {
      const poStatus = String(po.status ?? '');
      if (PO_PRE_SENT.has(poStatus) || poStatus === 'CLOSED') continue;

      if (PO_IN_TRANSIT.has(poStatus)) poInTransit += 1;

      let poEta: string | null = null;
      let totalOrdered = 0;
      let totalReceived = 0;
      let overdue = false;

      for (const line of po.items) {
        const ordered = toNum(line.qty);
        const received = receivedByPoItemId.get(line.id) ?? 0;
        totalOrdered += ordered;
        totalReceived += received;
        const eta = formatDateIso(line.expectedDeliveryDate);
        if (eta && (!poEta || eta < poEta)) poEta = eta;
        if (eta && eta < todayStr && received < ordered - 1e-9) {
          overdue = true;
        }
      }

      if (overdue) {
        poOverEta += 1;
        alerts.push({
          id: `po-overdue-${po.id}`,
          severity: 'critical',
          category: 'PO_OVERDUE',
          title: `PO ${po.poNumber} quá ETA`,
          description: `NCC ${po.supplier?.name ?? '—'} · PR ${pr.prNumber}`,
          prNumber: pr.prNumber,
          poNumber: po.poNumber,
          detectedAt: now.toISOString(),
        });
      }

      if (['SENT', 'ISSUED', 'CONFIRMED', 'PARTIAL_RECEIVED', 'FULLY_RECEIVED'].includes(poStatus)) {
        deliveryRows.push({
          poId: po.id,
          poNumber: po.poNumber,
          prNumber: pr.prNumber,
          vendorName: po.supplier?.name ?? '—',
          eta: poEta,
          receivedLabel: `${Math.round(totalReceived)}/${Math.round(totalOrdered)}`,
          isOverdue: overdue,
        });
      }
    }

    if (risk === 'reopen') {
      alerts.push({
        id: `reopen-${pr.id}`,
        severity: 'high',
        category: 'REOPEN',
        title: `${pr.prNumber} cần mua lại`,
        description: currentStep.detail ?? 'Có dòng chờ mua lại sau hủy PO',
        prNumber: pr.prNumber,
        detectedAt: pr.updatedAt.toISOString(),
      });
    }

    if (isBudgetExceptionAwaitingApproval(prStatus, pr.budgetExceptions)) {
      alerts.push({
        id: `budget-${pr.id}`,
        severity: 'high',
        category: 'OVER_BUDGET',
        title: `${pr.prNumber} chờ duyệt ngoại lệ NS`,
        description: 'Vượt ngân sách — cần GĐ chi nhánh quyết định',
        prNumber: pr.prNumber,
        detectedAt: pr.updatedAt.toISOString(),
      });
    }
  }

  rows.sort((a, b) => {
    const order: Record<MonitorSlaLevel, number> = {
      critical: 0,
      warning: 1,
      healthy: 2,
      completed: 3,
    };
    const d = order[a.sla] - order[b.sla];
    if (d !== 0) return d;
    return b.progressPercent - a.progressPercent;
  });

  const pipeline = [
    { key: 'approval', label: 'Chờ duyệt', count: pipelineCounts.approval ?? 0 },
    { key: 'rfq', label: 'RFQ', count: pipelineCounts.rfq ?? 0 },
    { key: 'award', label: 'Chờ award', count: pipelineCounts.award ?? 0 },
    { key: 'po_sent', label: 'Đã gửi PO', count: pipelineCounts.po_sent ?? 0 },
    { key: 'incoming', label: 'Chờ nhận kho', count: pipelineCounts.incoming ?? 0 },
    { key: 'reopen', label: 'Mua lại', count: pipelineCounts.reopen ?? 0 },
  ];

  return {
    generatedAt: now.toISOString(),
    scopeLabel: scopeLabel(scope),
    kpis: {
      prInProgress: activePrs.length,
      poInTransit,
      itemsAwaitingPurchase,
      poOverEta,
      reopenProcurement,
      totalSourcingValue: Math.round(totalSourcingValue),
    },
    pipeline,
    rows,
    reopenRows: reopenRows.slice(0, 50),
    costRows: costRows
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 30),
    deliveryRows: deliveryRows
      .sort((a, b) => (a.isOverdue === b.isOverdue ? 0 : a.isOverdue ? -1 : 1))
      .slice(0, 40),
    alerts: alerts.slice(0, 40),
  };
}

export async function buildProcurementMonitorPrDetail(prId: string, scope: MonitorScope) {
  const pr = await prisma.purchaseRequest.findFirst({
    where: { id: prId, ...buildScopeWhere(scope) },
    include: {
      items: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } },
      purchaseOrders: {
        where: { deletedAt: null },
        include: { items: true, supplier: { select: { name: true } } },
      },
      supplierSelections: {
        select: {
          purchaseRequestItemId: true,
          quotation: {
            select: {
              items: {
                where: { deletedAt: null },
                select: {
                  purchaseRequestItemId: true,
                  deliveryDate: true,
                  leadTimeDays: true,
                },
              },
            },
          },
        },
      },
      rfqs: {
        where: { deletedAt: null },
        select: { id: true, rfqNumber: true, status: true },
      },
    },
  });
  if (!pr) return null;

  const poLines = mapRequestorTrackingPoLines(
    pr.purchaseOrders.map((po) => ({
      poNumber: po.poNumber,
      status: po.status,
      rejectReason: po.rejectReason,
      cancelRequestedPoItemIds: (po as { cancelRequestedPoItemIds?: string | null })
        .cancelRequestedPoItemIds,
      items: po.items,
    }))
  );
  const poItemIds = poLines.map((l) => l.id);
  const receivedRows =
    poItemIds.length > 0
      ? await prisma.goodsReceiptLine.groupBy({
          by: ['poItemId'],
          where: { poItemId: { in: poItemIds } },
          _sum: { qtyReceived: true },
        })
      : [];
  const receivedByPoItemId = new Map(
    receivedRows.map((r) => [r.poItemId, toNum(r._sum.qtyReceived)])
  );

  const prStatus = String(pr.status ?? '');
  const quotationDeliveryByPrItem = buildSelectedQuotationDeliveryByPrItem(
    (pr.supplierSelections || []) as Parameters<typeof buildSelectedQuotationDeliveryByPrItem>[0]
  );
  const itemRows = pr.items.map((item) =>
    deriveItemProcurementRow(
      {
        id: item.id,
        lineNo: item.lineNo,
        description: item.description,
        partNo: item.partNo,
        qty: item.qty,
        purchaseQty: item.purchaseQty,
        status: String(item.status ?? 'NEW'),
        departmentItemOutcome: item.departmentItemOutcome,
        branchItemOutcome: item.branchItemOutcome,
        desiredDeliveryDate: item.desiredDeliveryDate,
      },
      poLines,
      receivedByPoItemId,
      prStatus,
      quotationDeliveryByPrItem
    )
  );

  const deliverySummary = buildDeliverySummary(itemRows);
  const currentStep = buildCurrentStepBadge(prStatus, itemRows, deliverySummary, poLines);
  const timeline = buildBusinessTimeline(prStatus, itemRows, poLines);

  const proposedBudget = computePrProposedBudgetAmount(pr.items);
  const costInsightBase = computeProcurementCostInsight(
    proposedBudget,
    (pr.supplierSelections || []) as unknown as Parameters<typeof computeProcurementCostInsight>[1],
    pr.purchaseOrders.map((po) => ({
      status: String(po.status ?? ''),
      totalAmount: po.totalAmount,
      items: po.items.map((it) => ({
        qty: it.qty,
        unitPrice: it.unitPrice,
        amount: it.amount,
        confirmedQty: it.confirmedQty,
      })),
    }))
  );
  const costInsight = enrichProcurementCostInsight(
    costInsightBase,
    deliverySummary,
    poLines.map((l) => {
      const src = pr.purchaseOrders.flatMap((po) => po.items).find((it) => it.id === l.id);
      return {
        id: l.id,
        unitPrice: src?.unitPrice ?? 0,
        qty: src?.qty ?? 0,
        amount: src?.amount ?? null,
        vatPercent: null,
      };
    }),
    receivedByPoItemId,
    pr.purchaseOrders.map((po) => ({
      status: String(po.status ?? ''),
      totalAmount: po.totalAmount,
      items: po.items.map((it) => ({
        qty: it.qty,
        unitPrice: it.unitPrice,
        amount: it.amount,
        confirmedQty: it.confirmedQty,
      })),
    })),
    { prStatus, trackingPoLines: poLines }
  );

  return {
    pr: { id: pr.id, prNumber: pr.prNumber, status: prStatus },
    currentStep,
    timeline,
    deliverySummary,
    items: itemRows,
    costInsight,
    rfqs: pr.rfqs,
    purchaseOrders: pr.purchaseOrders.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      supplierName: po.supplier?.name ?? null,
      itemCount: po.items.length,
    })),
  };
}

/** Dữ liệu phẳng PR/PO cho báo cáo Excel — lọc pending / hoàn thành / tất cả */
export async function buildProcurementMonitorExportData(
  scope: MonitorScope,
  lifecycle: MonitorExportLifecycle
): Promise<{
  generatedAt: string;
  scopeLabel: string;
  prRows: MonitorExportPrRow[];
  poRows: MonitorExportPoRow[];
}> {
  const prs = await prisma.purchaseRequest.findMany({
    where: {
      ...buildScopeWhere(scope),
      status: lifecycleWhere(lifecycle),
    },
    include: {
      requestor: { select: { username: true, fullName: true, location: true } },
      items: { where: { deletedAt: null }, orderBy: { lineNo: 'asc' } },
      purchaseOrders: {
        where: { deletedAt: null },
        include: {
          items: true,
          supplier: { select: { name: true } },
        },
      },
      supplierSelections: {
        select: {
          purchaseRequestItemId: true,
          quotation: {
            select: {
              items: {
                where: { deletedAt: null },
                select: {
                  purchaseRequestItemId: true,
                  deliveryDate: true,
                  leadTimeDays: true,
                },
              },
            },
          },
        },
      },
      assignments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          buyer: { select: { fullName: true, username: true } },
        },
      },
      rfqs: { where: { deletedAt: null }, select: { id: true, status: true } },
      budgetExceptions: {
        where: { status: 'PENDING' },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 800,
  });

  const allPoItemIds = prs.flatMap((pr) =>
    pr.purchaseOrders.flatMap((po) => po.items.map((it) => it.id))
  );
  const receivedRows =
    allPoItemIds.length > 0
      ? await prisma.goodsReceiptLine.groupBy({
          by: ['poItemId'],
          where: { poItemId: { in: allPoItemIds } },
          _sum: { qtyReceived: true },
        })
      : [];
  const receivedByPoItemId = new Map(
    receivedRows.map((r) => [r.poItemId, toNum(r._sum.qtyReceived)])
  );

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const prRows: MonitorExportPrRow[] = [];
  const poRows: MonitorExportPoRow[] = [];

  for (const pr of prs) {
    const prStatus = String(pr.status ?? '');
    const poLines = mapRequestorTrackingPoLines(
      pr.purchaseOrders.map((po) => ({
        poNumber: po.poNumber,
        status: po.status,
        rejectReason: po.rejectReason,
        cancelRequestedPoItemIds: (po as { cancelRequestedPoItemIds?: string | null })
          .cancelRequestedPoItemIds,
        items: po.items,
      }))
    );

    const quotationDeliveryByPrItem = buildSelectedQuotationDeliveryByPrItem(
      (pr.supplierSelections || []) as Parameters<typeof buildSelectedQuotationDeliveryByPrItem>[0]
    );

    const itemRows = pr.items.map((item) =>
      deriveItemProcurementRow(
        {
          id: item.id,
          lineNo: item.lineNo,
          description: item.description,
          partNo: item.partNo,
          qty: item.qty,
          purchaseQty: item.purchaseQty,
          status: String(item.status ?? 'NEW'),
          departmentItemOutcome: item.departmentItemOutcome,
          branchItemOutcome: item.branchItemOutcome,
          desiredDeliveryDate: item.desiredDeliveryDate,
        },
        poLines,
        receivedByPoItemId,
        prStatus,
        quotationDeliveryByPrItem
      )
    );

    const deliverySummary = buildDeliverySummary(itemRows);
    const currentStep = buildCurrentStepBadge(prStatus, itemRows, deliverySummary, poLines);
    const timeline = buildBusinessTimeline(prStatus, itemRows, poLines);
    const slaRaw = computeTrackingSla(prStatus, timeline.percentage, pr.createdAt);
    const sla = slaToMonitorLevel(slaRaw.status);
    const proposedBudget = computePrProposedBudgetAmount(pr.items);
    const costInsight = buildMonitorCostInsight(proposedBudget, pr);
    const { riskLabel } = deriveRisk(itemRows, prStatus, pr.budgetExceptions, costInsight);

    if (!prMatchesLifecycle(prStatus, sla, lifecycle)) continue;

    const buyer = pr.assignments[0]?.buyer;
    const buyerName = buyer?.fullName || buyer?.username || null;
    const hasReopen = itemRows.some((i) =>
      ['AWAITING_REORDER', 'LINE_CANCEL_PENDING'].includes(i.statusKey)
    );
    const branch = pr.requestor?.location ?? null;

    prRows.push({
      prNumber: pr.prNumber,
      department: pr.department,
      branch,
      buyerName,
      prStatusLabel: prStatusLabelVi(prStatus),
      reportGroup: isPrCompletedForExport(prStatus, sla) ? 'Hoàn thành' : 'Đang xử lý',
      currentStep: currentStep.label,
      currentStepDetail: currentStep.detail,
      eta: deliverySummary.nextEta,
      slaLabel: slaLabelVi(sla),
      riskLabel,
      progressPercent: timeline.percentage,
      itemCount: pr.items.length,
      rfqCount: pr.rfqs.length,
      poCount: pr.purchaseOrders.length,
      hasReopen,
      proposedBudget: Math.round(proposedBudget > 0 ? proposedBudget : toNum(pr.totalAmount)),
    });

    for (const po of pr.purchaseOrders) {
      const poStatus = String(po.status ?? '');
      if (!poMatchesLifecycle(poStatus, lifecycle)) continue;

      let poEta: string | null = null;
      let totalOrdered = 0;
      let totalReceived = 0;
      let overdue = false;

      for (const line of po.items) {
        const ordered = toNum(line.qty);
        const received = receivedByPoItemId.get(line.id) ?? 0;
        totalOrdered += ordered;
        totalReceived += received;
        const eta = formatDateIso(line.expectedDeliveryDate);
        if (eta && (!poEta || eta < poEta)) poEta = eta;
        if (eta && eta < todayStr && received < ordered - 1e-9) overdue = true;
      }

      poRows.push({
        poNumber: po.poNumber,
        prNumber: pr.prNumber,
        branch,
        vendorName: po.supplier?.name ?? '—',
        poStatusLabel: poStatusLabelVi(poStatus),
        reportGroup: isPoCompletedForExport(poStatus) ? 'Hoàn thành' : 'Đang xử lý',
        eta: poEta,
        receivedLabel:
          totalOrdered > 0
            ? `${Math.round(totalReceived)}/${Math.round(totalOrdered)}`
            : '—',
        isOverdue: overdue,
      });
    }
  }

  prRows.sort((a, b) => {
    if (a.reportGroup !== b.reportGroup) {
      return a.reportGroup === 'Đang xử lý' ? -1 : 1;
    }
    return a.prNumber.localeCompare(b.prNumber);
  });

  poRows.sort((a, b) => {
    if (a.reportGroup !== b.reportGroup) {
      return a.reportGroup === 'Đang xử lý' ? -1 : 1;
    }
    return a.poNumber.localeCompare(b.poNumber);
  });

  return {
    generatedAt: now.toISOString(),
    scopeLabel: scopeLabel(scope),
    prRows,
    poRows,
  };
}
