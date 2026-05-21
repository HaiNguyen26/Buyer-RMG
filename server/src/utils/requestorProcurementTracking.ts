import { Prisma } from '@prisma/client';
import {
  computeIncomingLineDisplayStatus,
  lineReceiveCap,
  toPoNum,
} from './poLineConfirmation';
import { normalizeVatPercent } from './quotationLine';

/** PO đã lập giá (CREATED+) — dùng cho giá trị procurement. */
const PO_PROCUREMENT_COST_STATUSES = new Set([
  'CREATED',
  'SENT',
  'ISSUED',
  'CONFIRMED',
  'PARTIAL_RECEIVED',
  'FULLY_RECEIVED',
  'CLOSED',
]);

/** PO đã gửi / NCC đã confirm — coi chi phí đã lock. */
const PO_COST_FINALIZED_STATUSES = new Set([
  'SENT',
  'ISSUED',
  'CONFIRMED',
  'PARTIAL_RECEIVED',
  'FULLY_RECEIVED',
  'CLOSED',
]);

export type RequestorItemStatusKey =
  | 'REVISION_REQUIRED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'FROM_STOCK'
  | 'FULFILLED'
  | 'RECEIVED'
  | 'PARTIAL_RECEIVED'
  | 'DELAYED'
  | 'INCOMING'
  | 'AWAITING_VENDOR_CONFIRM'
  | 'PO_SENT'
  | 'VENDOR_CONFIRMED'
  | 'SUPPLIER_SELECTED'
  | 'RFQ'
  | 'PENDING_APPROVAL'
  | 'PROCUREMENT'
  | 'CANCELLED';

export type RequestorProcurementItemRow = {
  itemId: string;
  lineNo: number;
  label: string;
  qtyOrdered: number;
  qtyReceived: number;
  qtyCap: number;
  eta: string | null;
  statusKey: RequestorItemStatusKey;
  statusLabel: string;
  poNumber: string | null;
};

export type BusinessTimelineStage = {
  key: string;
  label: string;
  completed: boolean;
  current: boolean;
};

export type RequestorCurrentStep = {
  label: string;
  detail: string | null;
  iconKey: 'package' | 'clock' | 'check' | 'alert' | 'file';
  tone: 'indigo' | 'amber' | 'emerald' | 'rose' | 'slate';
};

export type RequestorDeliverySummary = {
  receivedCount: number;
  totalCount: number;
  nextEta: string | null;
  partialCount: number;
};

const APPROVAL_PENDING_STATUSES = new Set([
  'SUBMITTED',
  'MANAGER_PENDING',
  'MANAGER_APPROVED',
  'DEPARTMENT_HEAD_PENDING',
  'DEPARTMENT_HEAD_APPROVED',
  'BRANCH_MANAGER_PENDING',
  'BUDGET_EXCEPTION',
]);

const APPROVED_PR_STATUSES = new Set([
  'BUYER_LEADER_PENDING',
  'BRANCH_MANAGER_APPROVED',
  'BUDGET_APPROVED',
  'ASSIGNED_TO_BUYER',
  'RFQ_IN_PROGRESS',
  'QUOTATION_RECEIVED',
  'SUPPLIER_SELECTED',
  'RFQ_COMPLETED',
  'PO_PENDING',
  'PO_IN_PROGRESS',
  'PO_ISSUED',
  'CLOSED',
  'PAYMENT_DONE',
]);

const PROCUREMENT_PR_STATUSES = new Set([
  ...APPROVED_PR_STATUSES,
]);

const ITEM_STATUS_LABELS: Record<RequestorItemStatusKey, string> = {
  REVISION_REQUIRED: 'Cần chỉnh sửa',
  REJECTED: 'Từ chối',
  ON_HOLD: 'Tạm giữ',
  FROM_STOCK: 'Lấy từ kho',
  FULFILLED: 'Đã nhận đủ',
  RECEIVED: 'Đã nhận đủ',
  PARTIAL_RECEIVED: 'Nhận một phần',
  DELAYED: 'Trễ hạn giao',
  INCOMING: 'Chờ nhận kho',
  AWAITING_VENDOR_CONFIRM: 'Chờ NCC xác nhận',
  PO_SENT: 'Đã gửi PO',
  VENDOR_CONFIRMED: 'NCC đã xác nhận',
  SUPPLIER_SELECTED: 'Đã chọn NCC',
  RFQ: 'Đang hỏi giá',
  PENDING_APPROVAL: 'Chờ duyệt',
  PROCUREMENT: 'Đang mua hàng',
  CANCELLED: 'Đã hủy',
};

export function getRequestorPrStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Nháp',
    SUBMITTED: 'Đã gửi duyệt',
    MANAGER_PENDING: 'Chờ quản lý duyệt',
    MANAGER_APPROVED: 'Quản lý đã duyệt',
    BRANCH_MANAGER_PENDING: 'Chờ GĐ chi nhánh',
    BRANCH_MANAGER_APPROVED: 'GĐ chi nhánh đã duyệt',
    BUYER_LEADER_PENDING: 'Chờ phân công mua hàng',
    ASSIGNED_TO_BUYER: 'Đang mua hàng',
    RFQ_IN_PROGRESS: 'Đang mua hàng',
    QUOTATION_RECEIVED: 'Đang mua hàng',
    SUPPLIER_SELECTED: 'Đang mua hàng',
    RFQ_COMPLETED: 'Chờ tạo PO',
    PO_PENDING: 'Chờ tạo PO',
    PO_IN_PROGRESS: 'Đang mua hàng',
    PO_ISSUED: 'Đã phát hành PO',
    CLOSED: 'Hoàn tất',
    PAYMENT_DONE: 'Hoàn tất',
    CANCELLED: 'Đã hủy',
    NEED_MORE_INFO: 'Cần bổ sung',
    BUDGET_EXCEPTION: 'Vượt ngân sách',
  };
  return map[status] ?? status;
}

type PrItemInput = {
  id: string;
  lineNo: number;
  description: string;
  partNo: string | null;
  qty: Prisma.Decimal | number;
  status: string;
  departmentItemOutcome: string | null;
  branchItemOutcome: string | null;
  desiredDeliveryDate: Date | null;
};

type PoLineInput = {
  id: string;
  purchaseRequestItemId: string;
  qty: Prisma.Decimal;
  confirmedQty: Prisma.Decimal | null;
  expectedDeliveryDate: Date | null;
  lineStatus: string;
  purchaseOrder: { poNumber: string; status: string };
};

function itemLabel(partNo: string | null, description: string): string {
  return (partNo?.trim() || description?.trim() || '—').trim();
}

function isoDateOnly(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function pickPrimaryPoLine(
  prItemId: string,
  poLines: PoLineInput[]
): PoLineInput | null {
  const matches = poLines.filter((l) => l.purchaseRequestItemId === prItemId);
  if (!matches.length) return null;
  const rank = (s: string) => {
    if (['CONFIRMED', 'PARTIAL_RECEIVED', 'SENT', 'ISSUED'].includes(s)) return 0;
    if (['CREATED', 'SUBMITTED', 'APPROVED'].includes(s)) return 1;
    return 2;
  };
  matches.sort(
    (a, b) =>
      rank(a.purchaseOrder.status) - rank(b.purchaseOrder.status) ||
      a.purchaseOrder.poNumber.localeCompare(b.purchaseOrder.poNumber)
  );
  return matches[0]!;
}

export function deriveItemProcurementRow(
  item: PrItemInput,
  poLines: PoLineInput[],
  receivedByPoItemId: Map<string, number>,
  prStatus: string
): RequestorProcurementItemRow {
  const qtyOrdered = toPoNum(item.qty as Prisma.Decimal);
  const poLine = pickPrimaryPoLine(item.id, poLines);
  const received = poLine ? receivedByPoItemId.get(poLine.id) ?? 0 : 0;
  const confirmed =
    poLine?.confirmedQty != null ? toPoNum(poLine.confirmedQty) : null;
  const qtyCap = poLine
    ? lineReceiveCap(poLine.confirmedQty, poLine.qty)
    : qtyOrdered;
  const eta =
    isoDateOnly(poLine?.expectedDeliveryDate) ??
    isoDateOnly(item.desiredDeliveryDate);

  let statusKey: RequestorItemStatusKey = 'PROCUREMENT';

  if (prStatus === 'CANCELLED') statusKey = 'CANCELLED';
  else if (
    item.departmentItemOutcome === 'REVISION_REQUIRED' ||
    item.branchItemOutcome === 'REVISION_REQUIRED'
  )
    statusKey = 'REVISION_REQUIRED';
  else if (
    item.departmentItemOutcome === 'REJECTED' ||
    item.branchItemOutcome === 'REJECTED'
  )
    statusKey = 'REJECTED';
  else if (item.departmentItemOutcome === 'ON_HOLD' || item.branchItemOutcome === 'ON_HOLD')
    statusKey = 'ON_HOLD';
  else if (item.status === 'FROM_STOCK') statusKey = 'FROM_STOCK';
  else if (item.status === 'FULFILLED' || (qtyCap > 0 && received + 1e-9 >= qtyCap))
    statusKey = 'FULFILLED';
  else if (poLine) {
    const display = computeIncomingLineDisplayStatus({
      poHeaderStatus: poLine.purchaseOrder.status,
      confirmedQty: confirmed,
      receivedQty: received,
      expectedDate: eta,
    });
    if (display === 'Received') statusKey = 'RECEIVED';
    else if (display === 'Partial') statusKey = 'PARTIAL_RECEIVED';
    else if (display === 'Delayed') statusKey = 'DELAYED';
    else if (display === 'Incoming') statusKey = 'INCOMING';
    else if (display === 'AwaitingConfirm') statusKey = 'AWAITING_VENDOR_CONFIRM';
    else if (
      poLine.purchaseOrder.status === 'SENT' ||
      poLine.purchaseOrder.status === 'ISSUED'
    )
      statusKey = 'PO_SENT';
    else if (confirmed != null && confirmed > 0) statusKey = 'VENDOR_CONFIRMED';
  } else if (item.status === 'SUPPLIER_SELECTED') statusKey = 'SUPPLIER_SELECTED';
  else if (
    ['RFQ_CREATED', 'RFQ_SUBMITTED', 'READY_FOR_REVIEW', 'ASSIGNED'].includes(item.status)
  )
    statusKey = 'RFQ';
  else if (APPROVAL_PENDING_STATUSES.has(prStatus)) statusKey = 'PENDING_APPROVAL';

  return {
    itemId: item.id,
    lineNo: item.lineNo,
    label: itemLabel(item.partNo, item.description),
    qtyOrdered,
    qtyReceived: received,
    qtyCap,
    eta,
    statusKey,
    statusLabel: ITEM_STATUS_LABELS[statusKey],
    poNumber: poLine?.purchaseOrder.poNumber ?? null,
  };
}

const BUSINESS_STAGES: { key: string; label: string }[] = [
  { key: 'SUBMITTED', label: 'Đã gửi duyệt' },
  { key: 'APPROVED', label: 'Đã duyệt' },
  { key: 'PROCUREMENT', label: 'Đang mua hàng' },
  { key: 'PO_SENT', label: 'Đã gửi PO' },
  { key: 'VENDOR_CONFIRMED', label: 'NCC xác nhận' },
  { key: 'INCOMING', label: 'Chờ nhận kho' },
  { key: 'COMPLETED', label: 'Hoàn tất' },
];

function timelineFlags(
  prStatus: string,
  items: RequestorProcurementItemRow[],
  poLines: PoLineInput[]
) {
  const submitted = prStatus !== 'DRAFT';
  const approved =
    submitted &&
    !APPROVAL_PENDING_STATUSES.has(prStatus) &&
    prStatus !== 'CANCELLED' &&
    (APPROVED_PR_STATUSES.has(prStatus) ||
      items.some((i) =>
        ['RFQ', 'SUPPLIER_SELECTED', 'PROCUREMENT', 'PO_SENT', 'VENDOR_CONFIRMED', 'AWAITING_VENDOR_CONFIRM', 'INCOMING', 'PARTIAL_RECEIVED', 'DELAYED', 'FULFILLED', 'RECEIVED'].includes(
          i.statusKey
        )
      ));
  const procurement =
    approved &&
    (PROCUREMENT_PR_STATUSES.has(prStatus) ||
      items.some((i) =>
        [
          'RFQ',
          'SUPPLIER_SELECTED',
          'PROCUREMENT',
          'PO_SENT',
          'VENDOR_CONFIRMED',
          'AWAITING_VENDOR_CONFIRM',
          'INCOMING',
          'PARTIAL_RECEIVED',
          'DELAYED',
          'FULFILLED',
          'RECEIVED',
        ].includes(i.statusKey)
      ));
  const poSent = poLines.some((l) =>
    ['SENT', 'ISSUED', 'CONFIRMED', 'PARTIAL_RECEIVED', 'FULLY_RECEIVED'].includes(
      l.purchaseOrder.status
    )
  );
  const vendorConfirmed = items.some((i) =>
    [
      'VENDOR_CONFIRMED',
      'INCOMING',
      'PARTIAL_RECEIVED',
      'DELAYED',
      'FULFILLED',
      'RECEIVED',
    ].includes(i.statusKey)
  );
  const incoming = items.some((i) =>
    ['INCOMING', 'PARTIAL_RECEIVED', 'DELAYED', 'AWAITING_VENDOR_CONFIRM'].includes(i.statusKey)
  );
  const purchaseItems = items.filter((i) => i.statusKey !== 'FROM_STOCK');
  const completed =
    prStatus === 'PAYMENT_DONE' ||
    prStatus === 'CLOSED' ||
    (purchaseItems.length > 0 &&
      purchaseItems.every((i) => ['FULFILLED', 'RECEIVED', 'FROM_STOCK', 'CANCELLED'].includes(i.statusKey)));

  return { submitted, approved, procurement, poSent, vendorConfirmed, incoming, completed };
}

/** Bước hiện tại = mốc đã đạt gần nhất (không hiển thị bước kế tiếp chưa hoàn thành). */
function resolveTimelineCurrentIndex(
  done: boolean[],
  prStatus: string
): number {
  if (prStatus === 'DRAFT') return 0;
  if (prStatus === 'CANCELLED') return -1;
  const lastCompleted = done.lastIndexOf(true);
  if (lastCompleted >= 0) return lastCompleted;
  const firstIncomplete = done.findIndex((d) => !d);
  return firstIncomplete < 0 ? BUSINESS_STAGES.length - 1 : firstIncomplete;
}

function mapTimelineStages(
  done: boolean[],
  currentIndex: number
): BusinessTimelineStage[] {
  return BUSINESS_STAGES.map((s, i) => ({
    ...s,
    completed: done[i] ?? false,
    current: currentIndex >= 0 && i === currentIndex,
  }));
}

export function buildBusinessTimeline(
  prStatus: string,
  items: RequestorProcurementItemRow[],
  poLines: PoLineInput[]
): { stages: BusinessTimelineStage[]; percentage: number } {
  const f = timelineFlags(prStatus, items, poLines);
  const done = [
    f.submitted,
    f.approved,
    f.procurement,
    f.poSent,
    f.vendorConfirmed,
    f.incoming,
    f.completed,
  ];
  const currentIndex = resolveTimelineCurrentIndex(done, prStatus);
  const stages = mapTimelineStages(done, currentIndex);

  const completedCount = done.filter(Boolean).length;
  const percentage = Math.round((completedCount / BUSINESS_STAGES.length) * 100);

  return { stages, percentage };
}

export type ProcurementListItemPreview = {
  label: string;
  statusLabel: string;
  statusKey: RequestorItemStatusKey;
  eta: string | null;
  qtyReceived: number;
  qtyCap: number;
};

export type ProcurementListSnapshot = {
  nextEta: string | null;
  receivedCount: number;
  totalCount: number;
  partialCount: number;
  hasDelay: boolean;
  delayHint: string | null;
  itemPreview: ProcurementListItemPreview[];
};

const ITEM_PREVIEW_SORT_RANK: Partial<Record<RequestorItemStatusKey, number>> = {
  DELAYED: 0,
  REVISION_REQUIRED: 1,
  ON_HOLD: 2,
  PARTIAL_RECEIVED: 3,
  INCOMING: 4,
  AWAITING_VENDOR_CONFIRM: 5,
  PO_SENT: 6,
  VENDOR_CONFIRMED: 7,
  RFQ: 8,
  SUPPLIER_SELECTED: 9,
  PENDING_APPROVAL: 10,
  PROCUREMENT: 20,
  FULFILLED: 30,
  RECEIVED: 31,
  FROM_STOCK: 32,
};

/** Lightweight procurement snapshot for PR tracking list cards. */
export function buildProcurementListSnapshot(
  prStatus: string,
  items: PrItemInput[],
  poLines: PoLineInput[],
  receivedByPoItemId: Map<string, number>
): ProcurementListSnapshot {
  const itemRows = items.map((item) =>
    deriveItemProcurementRow(item, poLines, receivedByPoItemId, prStatus)
  );
  const delivery = buildDeliverySummary(itemRows);
  const delayedCount = itemRows.filter((i) => i.statusKey === 'DELAYED').length;
  const hasDelay = delayedCount > 0;
  const delayHint = hasDelay
    ? delayedCount === 1
      ? '1 item trễ hạn giao'
      : `${delayedCount} item trễ hạn giao`
    : null;

  const sorted = [...itemRows].sort((a, b) => {
    const ra = ITEM_PREVIEW_SORT_RANK[a.statusKey] ?? 15;
    const rb = ITEM_PREVIEW_SORT_RANK[b.statusKey] ?? 15;
    return ra - rb || a.lineNo - b.lineNo;
  });

  const itemPreview: ProcurementListItemPreview[] = sorted.slice(0, 3).map((r) => ({
    label: r.label,
    statusLabel: r.statusLabel,
    statusKey: r.statusKey,
    eta: r.eta,
    qtyReceived: r.qtyReceived,
    qtyCap: r.qtyCap,
  }));

  return {
    nextEta: delivery.nextEta,
    receivedCount: delivery.receivedCount,
    totalCount: delivery.totalCount,
    partialCount: delivery.partialCount,
    hasDelay,
    delayHint,
    itemPreview,
  };
}

export function buildDeliverySummary(
  items: RequestorProcurementItemRow[]
): RequestorDeliverySummary {
  const trackable = items.filter(
    (i) =>
      !['FROM_STOCK', 'REJECTED', 'CANCELLED', 'REVISION_REQUIRED', 'ON_HOLD'].includes(
        i.statusKey
      )
  );
  const totalCount = trackable.length;
  const receivedCount = trackable.filter((i) =>
    ['FULFILLED', 'RECEIVED'].includes(i.statusKey)
  ).length;
  const partialCount = trackable.filter((i) => i.statusKey === 'PARTIAL_RECEIVED').length;
  const openEtas = trackable
    .filter((i) => i.eta && !['FULFILLED', 'RECEIVED'].includes(i.statusKey))
    .map((i) => i.eta!)
    .sort();
  const nextEta = openEtas[0] ?? null;

  return { receivedCount, totalCount, nextEta, partialCount };
}

/** PR đã nhập kho đủ — requestor tạo phiếu xuất để nhận hàng tại kho. */
export function isReadyForStockIssuePickup(delivery: RequestorDeliverySummary): boolean {
  return (
    delivery.totalCount > 0 &&
    delivery.receivedCount === delivery.totalCount &&
    delivery.partialCount === 0
  );
}

export function buildCurrentStepBadge(
  prStatus: string,
  items: RequestorProcurementItemRow[],
  delivery: RequestorDeliverySummary
): RequestorCurrentStep {
  if (prStatus === 'DRAFT') {
    return { label: 'Nháp', detail: 'Chưa gửi duyệt', iconKey: 'file', tone: 'slate' };
  }
  if (prStatus === 'CANCELLED') {
    return { label: 'Đã hủy', detail: null, iconKey: 'alert', tone: 'slate' };
  }
  if (delivery.receivedCount === delivery.totalCount && delivery.totalCount > 0) {
    return { label: 'Hoàn tất nhận hàng', detail: null, iconKey: 'check', tone: 'emerald' };
  }

  const delayed = items.find((i) => i.statusKey === 'DELAYED');
  if (delayed) {
    const etaFmt = delayed.eta
      ? new Date(delayed.eta).toLocaleDateString('vi-VN')
      : null;
    return {
      label: 'Trễ hạn giao',
      detail: etaFmt ? `ETA ${etaFmt}` : null,
      iconKey: 'alert',
      tone: 'rose',
    };
  }

  const incoming = items.filter((i) =>
    ['INCOMING', 'PARTIAL_RECEIVED'].includes(i.statusKey)
  );
  if (incoming.length > 0) {
    const etaFmt = delivery.nextEta
      ? new Date(delivery.nextEta).toLocaleDateString('vi-VN')
      : null;
    return {
      label: 'Chờ nhận kho',
      detail: etaFmt ? `ETA ${etaFmt}` : `${incoming.length} dòng đang về`,
      iconKey: 'package',
      tone: 'indigo',
    };
  }

  const awaitingConfirm = items.some((i) => i.statusKey === 'AWAITING_VENDOR_CONFIRM');
  if (awaitingConfirm) {
    return {
      label: 'Chờ NCC xác nhận',
      detail: 'PO đã gửi, chờ xác nhận giao hàng',
      iconKey: 'clock',
      tone: 'amber',
    };
  }

  if (items.some((i) => i.statusKey === 'VENDOR_CONFIRMED')) {
    const etaFmt = delivery.nextEta
      ? new Date(delivery.nextEta).toLocaleDateString('vi-VN')
      : null;
    return {
      label: 'NCC đã xác nhận',
      detail: etaFmt ? `ETA ${etaFmt}` : null,
      iconKey: 'package',
      tone: 'emerald',
    };
  }

  if (APPROVAL_PENDING_STATUSES.has(prStatus)) {
    return {
      label: 'Chờ duyệt',
      detail: getRequestorPrStatusLabel(prStatus),
      iconKey: 'clock',
      tone: 'amber',
    };
  }

  if (items.some((i) => i.statusKey === 'REVISION_REQUIRED')) {
    return {
      label: 'Cần chỉnh sửa',
      detail: 'Một hoặc nhiều dòng cần cập nhật',
      iconKey: 'alert',
      tone: 'amber',
    };
  }

  return {
    label: 'Đang mua hàng',
    detail: getRequestorPrStatusLabel(prStatus),
    iconKey: 'clock',
    tone: 'indigo',
  };
}

/** Timeline từ trạng thái PR header (dùng cho list cards khi chưa load items). */
export function buildBusinessTimelineFromPrStatus(prStatus: string): {
  stages: BusinessTimelineStage[];
  percentage: number;
} {
  if (prStatus === 'DRAFT') {
    const stages = BUSINESS_STAGES.map((s, i) => ({
      ...s,
      completed: false,
      current: i === 0,
    }));
    return { stages, percentage: 0 };
  }
  if (['PAYMENT_DONE', 'CLOSED'].includes(prStatus)) {
    const stages = BUSINESS_STAGES.map((s) => ({
      ...s,
      completed: true,
      current: false,
    }));
    return { stages, percentage: 100 };
  }

  const submitted = true;
  const approved = !APPROVAL_PENDING_STATUSES.has(prStatus) && prStatus !== 'CANCELLED';
  const procurement =
    approved &&
    (PROCUREMENT_PR_STATUSES.has(prStatus) ||
      ['ASSIGNED_TO_BUYER', 'RFQ_IN_PROGRESS', 'QUOTATION_RECEIVED', 'SUPPLIER_SELECTED', 'RFQ_COMPLETED', 'PO_PENDING', 'PO_IN_PROGRESS', 'PO_ISSUED'].includes(
        prStatus
      ));
  const poSent = ['PO_ISSUED', 'CLOSED', 'PAYMENT_DONE'].includes(prStatus);
  const vendorConfirmed = false;
  const incoming = false;
  const completed = ['PAYMENT_DONE', 'CLOSED'].includes(prStatus);

  const done = [submitted, approved, procurement, poSent, vendorConfirmed, incoming, completed];
  const currentIndex = resolveTimelineCurrentIndex(done, prStatus);
  const stages = mapTimelineStages(done, currentIndex);
  const percentage = Math.round((done.filter(Boolean).length / BUSINESS_STAGES.length) * 100);
  return { stages, percentage };
}

export function computeTrackingSla(
  prStatus: string,
  timelinePercentage: number,
  createdAt: Date
): {
  status: 'on_time' | 'warning' | 'overdue' | 'completed';
  timeRemaining: string | null;
  timeOverdue: string | null;
  daysSinceCreated: number;
  percentConsumed: number;
  estimatedDays: number;
} {
  const now = new Date();
  const daysSinceCreated = Math.floor(
    (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const estimatedDays = Math.max(7, Math.round(14 * (1 - timelinePercentage / 100) + 7));
  const daysLeft = Math.max(0, estimatedDays - daysSinceCreated);

  if (prStatus === 'PAYMENT_DONE' || prStatus === 'CLOSED') {
    return {
      status: 'completed',
      timeRemaining: null,
      timeOverdue: null,
      daysSinceCreated,
      percentConsumed: 100,
      estimatedDays,
    };
  }
  if (prStatus === 'CANCELLED') {
    return {
      status: 'completed',
      timeRemaining: null,
      timeOverdue: null,
      daysSinceCreated,
      percentConsumed: 0,
      estimatedDays,
    };
  }

  let percentConsumed = Math.min(
    100,
    Math.max(0, Math.round((daysSinceCreated / estimatedDays) * 100))
  );
  if (daysSinceCreated > estimatedDays + 2) {
    return {
      status: 'overdue',
      timeRemaining: null,
      timeOverdue: `${daysSinceCreated - estimatedDays} ngày`,
      daysSinceCreated,
      percentConsumed: 100,
      estimatedDays,
    };
  }
  if (daysLeft <= 1) {
    return {
      status: 'warning',
      timeRemaining: `${daysLeft} ngày`,
      timeOverdue: null,
      daysSinceCreated,
      percentConsumed: Math.max(percentConsumed, 85),
      estimatedDays,
    };
  }
  return {
    status: 'on_time',
    timeRemaining: `${daysLeft} ngày`,
    timeOverdue: null,
    daysSinceCreated,
    percentConsumed,
    estimatedDays,
  };
}

export type ProcurementCostSource = 'none' | 'award' | 'po';

export type PurchaseCostPhase = 'sourcing' | 'completed';

export type ProcurementCostInsight = {
  proposedAmount: number | null;
  /** Awarded quotation total hoặc PO value (ưu tiên PO). */
  procurementCostAmount: number | null;
  /** Alias tương thích client cũ. */
  buyerTargetAmount: number | null;
  costSource: ProcurementCostSource;
  isFinalized: boolean;
  awaitingVendorConfirm: boolean;
  deltaAmount: number;
  deltaPercent: number;
  status: 'unknown' | 'within' | 'equal' | 'over';
  /** sourcing = đang chốt NCC; completed = đã nhận đủ kho (GRN). */
  purchasePhase?: PurchaseCostPhase;
  /** Tổng tiền theo SL đã nhập kho (qty GRN × đơn giá PO). */
  actualReceivedAmount?: number | null;
  /** Giá trị cuối sau khi nhận đủ — ưu tiên GRN, fallback PO/award. */
  finalPurchaseAmount?: number | null;
};

export type PoLineReceivedCostInput = {
  id: string;
  unitPrice: Prisma.Decimal | number;
  qty: Prisma.Decimal | number;
  /** Thành tiền dòng PO (thường gồm VAT) — chỉ dùng khi suy ra đơn giá chưa VAT. */
  amount?: Prisma.Decimal | number | null;
  vatPercent?: Prisma.Decimal | number | null;
};

/** Thành tiền dòng PO chưa VAT (khớp cách nhập kho / báo giá buyer). */
export function poLineSubtotalExVat(
  qty: number,
  amountWithVat: number,
  vatPercent?: number | null
): number {
  if (qty <= 0 || amountWithVat <= 0) return 0;
  const vat = normalizeVatPercent(vatPercent ?? 10);
  return Math.round(amountWithVat / (1 + vat / 100));
}

export type DeliveryReceiptSummary = {
  receivedCount: number;
  totalCount: number;
  partialCount: number;
};

export function isDeliveryFullyReceived(delivery: DeliveryReceiptSummary): boolean {
  return (
    delivery.totalCount > 0 &&
    delivery.receivedCount === delivery.totalCount &&
    delivery.partialCount === 0
  );
}

/**
 * Giá trị đã nhập kho = Σ (SL GRN × đơn giá chưa VAT).
 * Không dùng tổng PO / thành tiền có VAT — khớp thao tác nhập GRN.
 */
export function sumActualReceivedPurchaseValue(
  poLines: PoLineReceivedCostInput[],
  receivedByPoItemId: Map<string, number>
): number {
  let sum = 0;
  for (const line of poLines) {
    const received = receivedByPoItemId.get(line.id) ?? 0;
    if (received <= 0) continue;
    const unitPriceExVat = toPoNum(line.unitPrice);
    if (unitPriceExVat > 0) {
      sum += received * unitPriceExVat;
      continue;
    }
    const qty = toPoNum(line.qty);
    const amountWithVat = toPoNum(line.amount);
    if (qty > 0 && amountWithVat > 0) {
      const lineSubtotal = poLineSubtotalExVat(qty, amountWithVat, line.vatPercent);
      sum += (received / qty) * lineSubtotal;
    }
  }
  return Math.round(sum);
}

export function enrichProcurementCostInsight(
  insight: ProcurementCostInsight,
  delivery: DeliveryReceiptSummary,
  poLines: PoLineReceivedCostInput[],
  receivedByPoItemId: Map<string, number>
): ProcurementCostInsight {
  const actualReceivedAmount = sumActualReceivedPurchaseValue(poLines, receivedByPoItemId);
  if (!isDeliveryFullyReceived(delivery)) {
    return {
      ...insight,
      purchasePhase: 'sourcing',
      actualReceivedAmount: actualReceivedAmount > 0 ? actualReceivedAmount : null,
      finalPurchaseAmount: null,
    };
  }

  return {
    ...insight,
    purchasePhase: 'completed',
    actualReceivedAmount: actualReceivedAmount > 0 ? actualReceivedAmount : null,
    finalPurchaseAmount: actualReceivedAmount > 0 ? actualReceivedAmount : null,
    isFinalized: true,
    awaitingVendorConfirm: false,
  };
}

export type SupplierSelectionCostInput = {
  purchaseRequestItemId: string | null;
  quotation: {
    totalAmount: Prisma.Decimal | number | null;
    items: Array<{
      purchaseRequestItemId: string | null;
      totalPrice: Prisma.Decimal | number | null;
    }>;
  } | null;
};

export type PurchaseOrderCostInput = {
  status: string;
  totalAmount: Prisma.Decimal | number | null;
  items: Array<{
    qty: Prisma.Decimal | number;
    unitPrice: Prisma.Decimal | number;
    amount?: Prisma.Decimal | number | null;
    confirmedQty: Prisma.Decimal | number | null;
  }>;
};

function sumAwardedQuotationTotal(selections: SupplierSelectionCostInput[]): number {
  return selections.reduce((sum, selection) => {
    const quotation = selection.quotation;
    if (!quotation) return sum;
    if (!selection.purchaseRequestItemId) {
      return sum + toPoNum(quotation.totalAmount);
    }
    const matchedItem = quotation.items.find(
      (item) => item.purchaseRequestItemId === selection.purchaseRequestItemId
    );
    return sum + toPoNum(matchedItem?.totalPrice);
  }, 0);
}

function sumPoProcurementValue(purchaseOrders: PurchaseOrderCostInput[]): number {
  return purchaseOrders.reduce((sum, po) => {
    const status = String(po.status ?? '').toUpperCase();
    if (!PO_PROCUREMENT_COST_STATUSES.has(status)) return sum;
    const headerTotal = toPoNum(po.totalAmount);
    if (headerTotal > 0) return sum + headerTotal;
    const lineTotal = po.items.reduce(
      (s, it) => s + toPoNum(it.amount ?? toPoNum(it.qty) * toPoNum(it.unitPrice)),
      0
    );
    return sum + lineTotal;
  }, 0);
}

/** Còn dòng PO chờ NCC xác nhận SL/ETA (SENT/CREATED, chưa có confirmedQty). */
export function poLinesAwaitingVendorConfirm(
  purchaseOrders: PurchaseOrderCostInput[]
): boolean {
  for (const po of purchaseOrders) {
    const headerStatus = String(po.status ?? '').toUpperCase();
    if (!['CREATED', 'SENT', 'ISSUED'].includes(headerStatus)) continue;
    for (const line of po.items) {
      if (toPoNum(line.qty) <= 0) continue;
      if (line.confirmedQty == null) return true;
    }
  }
  return false;
}

/**
 * Chi phí sourcing = giá trị procurement đã award (Buyer Leader) hoặc PO đã lập.
 * Không dùng ngân sách đề xuất / budget exception làm sourcing cost.
 */
export function computeProcurementCostInsight(
  proposedAmount: number,
  supplierSelections: SupplierSelectionCostInput[],
  purchaseOrders: PurchaseOrderCostInput[]
): ProcurementCostInsight {
  const awardTotal = sumAwardedQuotationTotal(supplierSelections);
  const poTotal = sumPoProcurementValue(purchaseOrders);
  const awaitingVendorConfirm = poLinesAwaitingVendorConfirm(purchaseOrders);

  let procurementCostAmount = 0;
  let costSource: ProcurementCostSource = 'none';

  if (poTotal > 0) {
    procurementCostAmount = poTotal;
    costSource = 'po';
  } else if (awardTotal > 0) {
    procurementCostAmount = awardTotal;
    costSource = 'award';
  }

  const hasCost = procurementCostAmount > 0;
  const poVendorConfirmed = purchaseOrders.some((po) =>
    ['CONFIRMED', 'PARTIAL_RECEIVED', 'FULLY_RECEIVED', 'CLOSED'].includes(
      String(po.status ?? '').toUpperCase()
    )
  );
  const poSentOrBeyond = purchaseOrders.some((po) =>
    PO_COST_FINALIZED_STATUSES.has(String(po.status ?? '').toUpperCase())
  );

  let isFinalized = false;
  if (hasCost && costSource === 'award') {
    isFinalized = true;
  } else if (hasCost && costSource === 'po') {
    if (poVendorConfirmed) {
      isFinalized = true;
    } else if (awaitingVendorConfirm) {
      isFinalized = false;
    } else if (poSentOrBeyond) {
      isFinalized = true;
    } else {
      // PO CREATED nội bộ: lock khi mọi dòng đã có confirmedQty
      isFinalized = purchaseOrders
        .filter((po) => PO_PROCUREMENT_COST_STATUSES.has(String(po.status ?? '').toUpperCase()))
        .some((po) => !poLinesAwaitingVendorConfirm([po]));
    }
  }

  const proposed = proposedAmount > 0 ? proposedAmount : null;
  const cost = hasCost ? procurementCostAmount : null;
  const deltaAmount = proposed && cost ? cost - proposed : 0;
  const deltaPercent = proposed && cost ? (deltaAmount / proposed) * 100 : 0;
  const status =
    !proposed || !cost
      ? 'unknown'
      : deltaAmount > 0
        ? 'over'
        : deltaAmount < 0
          ? 'within'
          : 'equal';

  return {
    proposedAmount: proposed,
    procurementCostAmount: cost,
    buyerTargetAmount: cost,
    costSource,
    isFinalized,
    awaitingVendorConfirm: hasCost && costSource === 'po' && awaitingVendorConfirm,
    deltaAmount,
    deltaPercent: Math.round(deltaPercent * 100) / 100,
    status,
  };
}
