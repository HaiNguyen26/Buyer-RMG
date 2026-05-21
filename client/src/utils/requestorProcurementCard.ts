import type { RequestorItemStatusKey } from '../services/requestorService';
import { formatEtaDisplay } from './requestorProcurementLabels';
import type { TrackingSlaShape } from './requestorSlaBar';

export type ProcurementCostSource = 'none' | 'award' | 'po';

export type PurchaseCostPhase = 'sourcing' | 'completed';

export type CostInsightShape = {
  proposedAmount: number | null;
  /** Giá trị award / PO (ưu tiên PO). */
  procurementCostAmount?: number | null;
  buyerTargetAmount: number | null;
  costSource?: ProcurementCostSource;
  isFinalized?: boolean;
  awaitingVendorConfirm?: boolean;
  deltaAmount: number;
  deltaPercent: number;
  status: 'unknown' | 'within' | 'equal' | 'over';
  purchasePhase?: PurchaseCostPhase;
  actualReceivedAmount?: number | null;
  finalPurchaseAmount?: number | null;
};

export function isPurchaseCostCompleted(
  insight?: CostInsightShape,
  snapshot?: ProcurementSnapshotShape | DeliveryReceiptSummaryShape
): boolean {
  if (insight?.purchasePhase === 'completed') return true;
  if (!snapshot || !('totalCount' in snapshot)) return false;
  return (
    snapshot.totalCount > 0 &&
    snapshot.receivedCount === snapshot.totalCount &&
    snapshot.partialCount === 0
  );
}

export function procurementCostAmountOf(insight?: CostInsightShape): number | null {
  const amount = insight?.procurementCostAmount ?? insight?.buyerTargetAmount;
  return amount != null && amount > 0 ? amount : null;
}

/** Giá nhập kho thực tế (GRN × đơn giá chưa VAT) — không lấy tổng PO. */
export function actualPurchaseAmountOf(insight?: CostInsightShape): number | null {
  if (!insight) return null;
  if (insight.purchasePhase === 'completed') {
    const grnOnly = insight.actualReceivedAmount ?? insight.finalPurchaseAmount;
    return grnOnly != null && grnOnly > 0 ? grnOnly : null;
  }
  const partial = insight.actualReceivedAmount;
  if (partial != null && partial > 0) return partial;
  return null;
}

/** SLA chi phí khi đã nhận đủ: % tiết kiệm hoặc % vượt so với đề xuất. */
export function costVsProposedMeta(insight?: CostInsightShape): {
  percent: number;
  tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'slate' | 'indigo';
  sublabel: string;
  pulseWhenLow: boolean;
} {
  const proposed = insight?.proposedAmount;
  const actual = actualPurchaseAmountOf(insight);
  if (!proposed || proposed <= 0 || !actual) {
    return {
      percent: 0,
      tone: 'slate',
      sublabel: 'Chưa đủ dữ liệu so sánh',
      pulseWhenLow: false,
    };
  }
  const ratioPct = Math.min(100, Math.round((actual / proposed) * 100));
  const deltaPct = ((actual - proposed) / proposed) * 100;

  if (deltaPct > 0.5) {
    return {
      percent: ratioPct,
      tone: 'rose',
      sublabel: `Vượt ${Math.abs(deltaPct).toFixed(0)}% so với đề xuất`,
      pulseWhenLow: false,
    };
  }
  if (deltaPct < -0.5) {
    return {
      percent: ratioPct,
      tone: 'emerald',
      sublabel: `Tiết kiệm ${Math.abs(deltaPct).toFixed(0)}% so với đề xuất`,
      pulseWhenLow: false,
    };
  }
  return {
    percent: ratioPct,
    tone: 'blue',
    sublabel: 'Khớp ngân sách đề xuất',
    pulseWhenLow: false,
  };
}

export type DeliveryReceiptSummaryShape = {
  receivedCount: number;
  totalCount: number;
  partialCount: number;
};

export type ProcurementSnapshotShape = {
  nextEta: string | null;
  receivedCount: number;
  totalCount: number;
  partialCount: number;
  hasDelay: boolean;
  delayHint: string | null;
  itemPreview: Array<{
    label: string;
    statusLabel: string;
    statusKey: RequestorItemStatusKey;
    eta: string | null;
    qtyReceived: number;
    qtyCap: number;
  }>;
};

export function categorySubtitle(
  itemName: string | null,
  department: string | null
): string {
  const parts = [itemName?.trim(), department?.trim()].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

export function slaTimeSublabel(sla: TrackingSlaShape): string {
  if (sla.status === 'completed') return 'Đã hoàn thành';
  if (sla.status === 'overdue') return sla.timeOverdue ? `Quá ${sla.timeOverdue}` : 'Quá hạn';
  if (sla.timeRemaining) return `Còn ${sla.timeRemaining}`;
  return 'Đang theo dõi';
}

export function costBarMetaForCard(
  insight?: CostInsightShape,
  snapshot?: ProcurementSnapshotShape
): {
  percent: number;
  tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'slate' | 'indigo';
  sublabel: string;
  pulseWhenLow: boolean;
} {
  if (isPurchaseCostCompleted(insight, snapshot)) {
    return costVsProposedMeta(insight);
  }
  if (!insight?.proposedAmount) {
    return { percent: 0, tone: 'slate', sublabel: 'Chưa có ngân sách đề xuất', pulseWhenLow: false };
  }
  const procurementCost = procurementCostAmountOf(insight);
  if (!procurementCost) {
    return {
      percent: 38,
      tone: 'amber',
      sublabel: 'Chưa award / chưa có PO',
      pulseWhenLow: true,
    };
  }
  const rawPct = Math.round((procurementCost / insight.proposedAmount) * 100);
  const pct = Math.min(100, rawPct);

  if (insight.status === 'over') {
    return {
      percent: Math.max(pct, 85),
      tone: 'rose',
      sublabel: formatProcurementDelta(insight) ?? 'Vượt ngân sách đề xuất',
      pulseWhenLow: false,
    };
  }
  if (insight.status === 'equal') {
    return { percent: pct, tone: 'blue', sublabel: 'Khớp ngân sách đề xuất', pulseWhenLow: false };
  }
  if (insight.deltaPercent < 0) {
    return {
      percent: pct,
      tone: 'emerald',
      sublabel: `${Math.abs(insight.deltaPercent).toFixed(0)}% dưới đề xuất`,
      pulseWhenLow: false,
    };
  }
  if (insight.awaitingVendorConfirm) {
    return {
      percent: pct,
      tone: 'amber',
      sublabel: 'Chờ NCC xác nhận SL/ETA',
      pulseWhenLow: true,
    };
  }
  if (insight.isFinalized === false) {
    return {
      percent: pct,
      tone: 'amber',
      sublabel: 'Trong ngân sách đề xuất',
      pulseWhenLow: true,
    };
  }
  return {
    percent: pct,
    tone: 'emerald',
    sublabel: 'Trong ngân sách đề xuất',
    pulseWhenLow: false,
  };
}

/** Hai dòng giao hàng trên card list — không liệt kê từng item. */
export function deliveryCardTwoLines(snapshot?: ProcurementSnapshotShape): {
  receivedLine: string | null;
  etaLine: string | null;
} {
  if (!snapshot || snapshot.totalCount === 0) {
    return { receivedLine: null, etaLine: null };
  }
  const receivedLine = `Đã nhận ${snapshot.receivedCount}/${snapshot.totalCount} item`;
  const etaLine = snapshot.nextEta
    ? `ETA item: ${formatEtaDisplay(snapshot.nextEta)}`
    : 'Chưa có ETA item';
  return { receivedLine, etaLine };
}

export function formatProcurementDelta(insight?: CostInsightShape): string | null {
  const procurementCost = procurementCostAmountOf(insight);
  if (!insight?.proposedAmount || !procurementCost) return null;
  if (insight.deltaAmount <= 0) return null;
  const fmt = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(
    insight.deltaAmount
  );
  return `+${fmt}đ vượt estimate`;
}

export function formatCardCurrency(amount: number | null, currency: string): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency === 'VND' ? 'VND' : 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

const RECEIVED_ITEM_KEYS = new Set<RequestorItemStatusKey>(['FULFILLED', 'RECEIVED']);
const WAITING_DELIVERY_KEYS = new Set<RequestorItemStatusKey>([
  'INCOMING',
  'PARTIAL_RECEIVED',
  'DELAYED',
  'AWAITING_VENDOR_CONFIRM',
  'VENDOR_CONFIRMED',
  'PO_SENT',
]);

/**
 * Chi phí sourcing = giá trị procurement đã award hoặc PO (không gắn tiến độ nhận hàng).
 */
export function sourcingCostDisplay(
  costInsight: CostInsightShape | undefined,
  currency: string
): { main: string; sub: string | null; isLocked: boolean } {
  const amount = procurementCostAmountOf(costInsight);
  if (amount == null) {
    return {
      main: 'Chưa chốt',
      sub: 'Chưa có award Buyer Leader hoặc PO với NCC',
      isLocked: false,
    };
  }

  const source = costInsight?.costSource ?? 'po';
  const finalized = costInsight?.isFinalized !== false;
  const awaiting = costInsight?.awaitingVendorConfirm === true;

  if (finalized && !awaiting) {
    return {
      main: formatCardCurrency(amount, currency),
      sub:
        source === 'award'
          ? 'Từ báo giá đã award (đã lock)'
          : 'Từ PO đã chốt với NCC (đã lock)',
      isLocked: true,
    };
  }

  if (awaiting) {
    return {
      main: formatCardCurrency(amount, currency),
      sub: 'PO đã lập giá — chờ NCC xác nhận SL/ETA',
      isLocked: false,
    };
  }

  return {
    main: formatCardCurrency(amount, currency),
    sub:
      source === 'award'
        ? 'Từ báo giá đã award'
        : 'Từ PO — chưa gửi / chưa xác nhận đủ với NCC',
    isLocked: false,
  };
}

export function proposedBudgetDisplay(
  costInsight: CostInsightShape | undefined,
  totalAmount: number | null | undefined,
  currency: string
): string {
  const amount = costInsight?.proposedAmount ?? totalAmount;
  return formatCardCurrency(amount, currency);
}

export type PurchaseCostSectionDisplay = {
  phase: PurchaseCostPhase;
  sectionTitle: string;
  settledBadge: string | null;
  primaryLabel: string;
  primaryValue: string;
  primarySub: string | null;
  secondaryLabel: string;
  secondaryValue: string;
  secondarySub: string | null;
  primaryTone: 'slate' | 'amber' | 'emerald';
  showEstimateDelta: boolean;
  costProgressPercent: number;
};

export function purchaseCostSectionDisplay(
  costInsight: CostInsightShape | undefined,
  currency: string,
  snapshot?: ProcurementSnapshotShape | DeliveryReceiptSummaryShape,
  totalAmount?: number | null
): PurchaseCostSectionDisplay {
  const completed = isPurchaseCostCompleted(costInsight, snapshot);
  if (completed) {
    const actual = actualPurchaseAmountOf(costInsight);
    const costMeta = costVsProposedMeta(costInsight);
    return {
      phase: 'completed',
      sectionTitle: 'Giá trị mua thực tế',
      settledBadge: null,
      primaryLabel: 'Giá trị mua thực tế',
      primaryValue: formatCardCurrency(actual, currency),
      primarySub: 'Theo số lượng nhập kho (chưa gồm VAT)',
      secondaryLabel: 'Ngân sách đề xuất',
      secondaryValue: proposedBudgetDisplay(costInsight, totalAmount, currency),
      secondarySub: null,
      primaryTone: 'emerald',
      showEstimateDelta: false,
      costProgressPercent: costMeta.percent,
    };
  }

  const sourcing = sourcingCostDisplay(costInsight, currency);
  const costMeta = costBarMetaForCard(costInsight, snapshot);
  return {
    phase: 'sourcing',
    sectionTitle: 'Chi phí sourcing',
    settledBadge: null,
    primaryLabel: 'Chi phí sourcing hiện tại',
    primaryValue: sourcing.main,
    primarySub: sourcing.sub,
    secondaryLabel: 'Ngân sách đề xuất',
    secondaryValue: proposedBudgetDisplay(costInsight, totalAmount, currency),
    secondarySub: 'Giá buyer đang chốt với NCC',
    primaryTone: sourcing.isLocked ? 'slate' : 'amber',
    showEstimateDelta: true,
    costProgressPercent: costMeta.percent,
  };
}

/** Khi API chưa trả snapshot đầy đủ nhưng PR đã vào giai đoạn giao hàng. */
export function deliveryTrackingFallback(
  progress?: { currentStage?: { label: string } | null },
  prStatus?: string
): string[] {
  const stage = progress?.currentStage?.label ?? '';
  const deliveryStages = new Set([
    'Đã gửi PO',
    'NCC xác nhận',
    'Chờ nhận kho',
    'Hoàn tất',
  ]);
  if (deliveryStages.has(stage)) {
    return ['Mở chi tiết để xem trạng thái từng item'];
  }
  const status = (prStatus ?? '').toUpperCase();
  if (['PO_ISSUED', 'PO_IN_PROGRESS', 'CLOSED', 'PAYMENT_DONE'].includes(status)) {
    return ['Mở chi tiết để xem trạng thái từng item'];
  }
  return [];
}

/** Tóm tắt giao hàng — delivery lifecycle, độc lập chi phí. */
export function deliveryTrackingBullets(snapshot?: ProcurementSnapshotShape): string[] {
  if (!snapshot || snapshot.totalCount === 0) return [];

  const bullets: string[] = [];
  if (snapshot.receivedCount > 0) {
    bullets.push(
      snapshot.receivedCount === 1
        ? '1 item đã nhận đủ'
        : `${snapshot.receivedCount} item đã nhận đủ`
    );
  }
  if (snapshot.partialCount > 0) {
    bullets.push(
      snapshot.partialCount === 1
        ? '1 item nhận một phần'
        : `${snapshot.partialCount} item nhận một phần`
    );
  }
  const awaitingDelivery = Math.max(
    0,
    snapshot.totalCount - snapshot.receivedCount - snapshot.partialCount
  );
  if (awaitingDelivery > 0) {
    const etaPart = snapshot.nextEta
      ? ` · ETA gần nhất ${formatEtaDisplay(snapshot.nextEta)}`
      : '';
    bullets.push(
      awaitingDelivery === 1
        ? `1 item đang chờ giao${etaPart}`
        : `${awaitingDelivery} item đang chờ giao${etaPart}`
    );
  }
  return bullets;
}

/** Một dòng tóm tắt khi không có danh sách item trên card. */
export function deliveryTrackingSummaryLine(snapshot?: ProcurementSnapshotShape): string | null {
  const bullets = deliveryTrackingBullets(snapshot);
  return bullets.length > 0 ? bullets.join(' · ') : null;
}

/** Nhãn ngắn cho từng item trên card (delivery-focused). */
export function itemDeliveryHint(statusKey: RequestorItemStatusKey): string {
  if (RECEIVED_ITEM_KEYS.has(statusKey)) return 'Đã nhận';
  if (statusKey === 'PARTIAL_RECEIVED') return 'Nhận một phần';
  if (WAITING_DELIVERY_KEYS.has(statusKey)) return 'Chờ giao';
  if (statusKey === 'RFQ' || statusKey === 'SUPPLIER_SELECTED' || statusKey === 'PROCUREMENT') {
    return 'Đang sourcing';
  }
  return 'Theo dõi';
}

export function headerProcurementChips(
  snapshot?: ProcurementSnapshotShape
): Array<{ label: string; tone: 'amber' | 'rose' }> {
  if (!snapshot?.itemPreview?.length) return [];
  const chips: Array<{ label: string; tone: 'amber' | 'rose' }> = [];
  if (snapshot.itemPreview.some((i) => i.statusKey === 'AWAITING_VENDOR_CONFIRM')) {
    chips.push({ label: 'Chờ NCC', tone: 'amber' });
  }
  if (snapshot.hasDelay) {
    chips.push({ label: 'Trễ hạn', tone: 'rose' });
  }
  return chips;
}

export function formatSnapshotEta(iso: string | null): string {
  return iso ? formatEtaDisplay(iso) : '—';
}

/** Toàn bộ item trackable đã nhận đủ kho — requestor có thể xuống kho và tạo phiếu xuất. */
export function isFullyReceivedForPickup(snapshot?: ProcurementSnapshotShape): boolean {
  if (!snapshot || snapshot.totalCount <= 0) return false;
  return (
    snapshot.receivedCount === snapshot.totalCount && snapshot.partialCount === 0
  );
}

export type StockIssuePickupLink = {
  id: string;
  issueNumber: string;
  status: string;
};

export function stockIssuePickupPath(
  issue: StockIssuePickupLink,
  base = '/dashboard/requestor/stock-issues'
): string {
  if (issue.status === 'DRAFT') return `${base}/${issue.id}/edit`;
  return `${base}?detail=${encodeURIComponent(issue.id)}`;
}

export function stockIssueCreatePath(
  prId: string,
  salesPoId?: string | null,
  base = '/dashboard/requestor/stock-issues'
): string {
  const params = new URLSearchParams({ prId });
  if (salesPoId?.trim()) params.set('salesPoId', salesPoId.trim());
  return `${base}/create?${params.toString()}`;
}
