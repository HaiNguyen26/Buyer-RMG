import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Package,
  PackageOpen,
  Sparkles,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';
import type { PRSalesOrderInfo } from '../../types/prSalesOrder';
import { PRSalesOrderLine } from '../PRSalesOrderLine';
import { RequestorTrackingLiquidBar } from './RequestorTrackingLiquidBar';
import {
  categorySubtitle,
  costBarMetaForCard,
  deliveryCardTwoLines,
  deliveryTrackingFallback,
  formatProcurementDelta,
  headerProcurementChips,
  proposedBudgetDisplay,
  slaTimeSublabel,
  isFullyReceivedForPickup,
  isPurchaseCostCompleted,
  purchaseCostSectionDisplay,
  stockIssueCreatePath,
  stockIssuePickupPath,
  type CostInsightShape,
  type ProcurementSnapshotShape,
  type StockIssuePickupLink,
} from '../../utils/requestorProcurementCard';
import type { StockIssuePickupMeta } from '../../services/requestorService';
import { slaBarPercent, type TrackingSlaShape } from '../../utils/requestorSlaBar';

export type RequestorProcurementTrackingCardData = {
  id: string;
  prNumber: string;
  status?: string;
  itemName: string | null;
  department: string | null;
  totalAmount?: number | null;
  currency: string;
  progress: {
    percentage: number;
    currentStage: { label: string } | null;
  };
  currentHandler: string | null;
  sla: TrackingSlaShape;
  costInsight?: CostInsightShape;
  procurementSnapshot?: ProcurementSnapshotShape;
  stockIssuePickup?: StockIssuePickupMeta;
  salesOrder?: PRSalesOrderInfo | null;
};

type RequestorProcurementTrackingCardProps = {
  pr: RequestorProcurementTrackingCardData;
  animationDelayMs?: number;
  onClick: () => void;
};

function getSLAStatusConfig(status: TrackingSlaShape['status']) {
  switch (status) {
    case 'on_time':
      return {
        badgeColor: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80',
        icon: CheckCircle2,
        label: 'Đúng hạn',
        barTone: 'emerald' as const,
        pulse: false,
      };
    case 'warning':
      return {
        badgeColor: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/80',
        icon: Clock,
        label: 'Sắp trễ',
        barTone: 'amber' as const,
        pulse: true,
      };
    case 'overdue':
      return {
        badgeColor: 'bg-rose-50 text-rose-800 ring-1 ring-rose-200/80',
        icon: AlertCircle,
        label: 'Quá hạn',
        barTone: 'rose' as const,
        pulse: false,
      };
    case 'completed':
      return {
        badgeColor: 'bg-sky-50 text-sky-800 ring-1 ring-sky-200/80',
        icon: CheckCircle2,
        label: 'Hoàn thành',
        barTone: 'blue' as const,
        pulse: false,
      };
    default:
      return {
        badgeColor: 'bg-slate-50 text-slate-700 ring-1 ring-slate-200',
        icon: Clock,
        label: 'Đang xử lý',
        barTone: 'slate' as const,
        pulse: false,
      };
  }
}

export function RequestorProcurementTrackingCard({
  pr,
  animationDelayMs = 0,
  onClick,
}: RequestorProcurementTrackingCardProps) {
  const navigate = useNavigate();
  const statusConfig = getSLAStatusConfig(pr.sla.status);
  const StatusIcon = statusConfig.icon;
  const slaPct = slaBarPercent(pr.sla);
  const snapshot = pr.procurementSnapshot;
  const pickupReadyServer = pr.stockIssuePickup?.ready === true;
  const purchaseCompleted = isPurchaseCostCompleted(pr.costInsight, snapshot, {
    stockIssuePickupReady: pickupReadyServer,
  });
  const costMeta = costBarMetaForCard(pr.costInsight, snapshot, {
    stockIssuePickupReady: pickupReadyServer,
  });
  const costSection = purchaseCostSectionDisplay(
    pr.costInsight,
    pr.currency,
    snapshot,
    pr.totalAmount,
    { stockIssuePickupReady: pickupReadyServer }
  );
  const progressPct = Math.round(pr.progress.percentage);
  const progressWidth = progressPct > 0 ? Math.max(2, Math.min(100, progressPct)) : 0;
  const extraChips = headerProcurementChips(snapshot);
  const costDeltaLine = costSection.showEstimateDelta
    ? formatProcurementDelta(pr.costInsight)
    : null;
  const deliveryLines = deliveryCardTwoLines(snapshot);
  const deliveryFallback = deliveryTrackingFallback(pr.progress, pr.status);
  const hasDeliveryTracking =
    deliveryLines.receivedLine != null ||
    (snapshot?.totalCount ?? 0) > 0 ||
    deliveryFallback.length > 0;

  const pickupReady = pickupReadyServer;
  const linkedIssue: StockIssuePickupLink | null = pr.stockIssuePickup?.linkedStockIssue ?? null;
  const showPickupCta = pickupReady && !linkedIssue;
  const showPickupLinked = pickupReady && linkedIssue != null;

  const handleCreateStockIssue = (e: MouseEvent) => {
    e.stopPropagation();
    navigate(
      stockIssueCreatePath(pr.id, pr.salesOrder?.id ?? null)
    );
  };

  const handleOpenStockIssue = (e: MouseEvent) => {
    e.stopPropagation();
    if (!linkedIssue) return;
    navigate(stockIssuePickupPath(linkedIssue));
  };

  return (
    <article
      className={`group/pickup relative flex w-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-[0_14px_28px_-18px_rgba(15,23,42,0.38)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_44px_-14px_rgba(15,23,42,0.45)] ${
        showPickupCta
          ? 'border-emerald-300/90 ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-[#f1f5f9] animate-pickup-glow'
          : showPickupLinked
            ? 'border-emerald-200/80 ring-1 ring-emerald-300/60'
            : pr.sla.status === 'overdue'
              ? 'border-rose-200/90 ring-1 ring-slate-900/[0.06]'
              : pr.sla.status === 'warning'
                ? 'border-amber-200/80 ring-1 ring-slate-900/[0.06]'
                : 'border-slate-200/80 ring-1 ring-slate-900/[0.06]'
      }`}
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      {showPickupCta ? (
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl"
          aria-hidden
        />
      ) : null}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${
          showPickupCta || showPickupLinked
            ? 'from-emerald-400 via-teal-500 to-cyan-500'
            : pr.sla.status === 'overdue'
              ? 'from-rose-400 via-red-500 to-rose-600'
              : pr.sla.status === 'warning'
                ? 'from-amber-400 via-orange-400 to-amber-500'
                : pr.sla.status === 'completed'
                  ? 'from-sky-400 via-blue-500 to-indigo-500'
                  : 'from-emerald-400 via-teal-400 to-cyan-500'
        } opacity-90`}
        aria-hidden
      />

      {showPickupCta ? (
        <div className="relative flex items-center gap-2 border-b border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-teal-50/90 to-emerald-50 px-4 py-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-600/30">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" strokeWidth={2.5} />
          </span>
          <p className="min-w-0 flex-1 text-xs font-bold leading-snug text-emerald-950">
            Hàng đã về kho đủ — xuống kho nhận và tạo phiếu xuất
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500/50"
      >

      {/* Header */}
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-black tracking-tight text-slate-900">
              {pr.prNumber}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs font-medium text-slate-600">
              {categorySubtitle(pr.itemName, pr.department)}
            </p>
            {pr.salesOrder ? (
              <div className="mt-1.5">
                <PRSalesOrderLine salesOrder={pr.salesOrder} className="text-[11px]" />
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusConfig.badgeColor} ${
                statusConfig.pulse ? 'animate-pulse' : ''
              }`}
            >
              <StatusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
              {statusConfig.label}
            </span>
            {extraChips.map((chip) => (
              <span
                key={chip.label}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                  chip.tone === 'rose'
                    ? 'bg-rose-50 text-rose-700 ring-rose-200'
                    : 'bg-amber-50 text-amber-800 ring-amber-200'
                }`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-wide text-slate-600">
            Tiến độ mua hàng
          </span>
          <span
            className={`font-black tabular-nums ${
              purchaseCompleted ? 'text-emerald-700' : 'text-indigo-700'
            }`}
          >
            {progressPct}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              purchaseCompleted
                ? 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600'
                : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600'
            }`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
        {pr.progress.currentStage ? (
          <p className="text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Bước hiện tại: </span>
            {pr.progress.currentStage.label}
          </p>
        ) : null}
        {pr.currentHandler ? (
          <p className="flex items-center gap-1.5 text-xs text-slate-600">
            <User className="h-3.5 w-3.5 shrink-0 text-indigo-500/80" strokeWidth={2} />
            <span>
              <span className="font-semibold text-slate-700">Buyer phụ trách: </span>
              {pr.currentHandler}
            </span>
          </p>
        ) : null}
      </div>

      {/* SLA */}
      <div className="space-y-2.5 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-4 py-3">
        <RequestorTrackingLiquidBar
          label="SLA thời gian"
          sublabel={slaTimeSublabel(pr.sla)}
          percent={slaPct}
          tone={statusConfig.barTone}
          fastFlow={pr.sla.status === 'warning' || pr.sla.status === 'overdue'}
        />
        <p className="text-[10px] font-medium text-slate-400">SLA procurement lead time</p>
        <RequestorTrackingLiquidBar
          label="SLA chi phí"
          sublabel={costMeta.sublabel}
          percent={costMeta.percent}
          tone={costMeta.tone}
          pulseWhenLow={costMeta.pulseWhenLow}
        />
      </div>

      {/* Cost — sourcing vs actual purchase (evolves when nhận đủ kho) */}
      <div className="space-y-2 border-b border-slate-100 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {costSection.sectionTitle}
        </p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              purchaseCompleted && costMeta.tone === 'rose'
                ? 'bg-gradient-to-r from-rose-400 to-rose-600'
                : purchaseCompleted && costMeta.tone === 'emerald'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  : purchaseCompleted
                    ? 'bg-gradient-to-r from-sky-400 to-indigo-500'
                    : 'bg-gradient-to-r from-indigo-400 to-violet-500'
            }`}
            style={{ width: `${Math.max(4, costSection.costProgressPercent)}%` }}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
          <div
            className={`flex items-start gap-1.5 font-semibold ${
              costSection.primaryTone === 'emerald'
                ? 'text-emerald-950'
                : costSection.primaryTone === 'slate'
                  ? 'text-slate-900'
                  : 'text-amber-900'
            }`}
          >
            <Wallet
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                purchaseCompleted ? 'text-emerald-600' : 'text-indigo-600/90'
              }`}
              strokeWidth={2}
            />
            <span>
              <span className="block text-[10px] font-medium text-slate-400">
                {costSection.primaryLabel}
              </span>
              <span className="text-sm font-black tabular-nums">{costSection.primaryValue}</span>
              {costSection.primarySub ? (
                <span
                  className={`mt-0.5 block text-[10px] font-medium ${
                    purchaseCompleted ? 'text-emerald-700/90' : 'text-slate-500'
                  }`}
                >
                  {costSection.primarySub}
                </span>
              ) : null}
            </span>
          </div>
          <div className="flex items-start gap-1.5 text-slate-800">
            <TrendingUp
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                purchaseCompleted ? 'text-emerald-600/90' : 'text-emerald-600/80'
              }`}
              strokeWidth={2}
            />
            <span>
              <span className="block text-[10px] font-medium text-slate-400">
                {costSection.secondaryLabel}
              </span>
              <span className="text-sm font-bold tabular-nums">{costSection.secondaryValue}</span>
              {costSection.secondarySub ? (
                <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
                  {costSection.secondarySub}
                </span>
              ) : null}
            </span>
          </div>
        </div>
        {costDeltaLine ? (
          <p className="flex items-center gap-1 text-[11px] font-bold text-rose-600">
            <AlertCircle className="h-3.5 w-3.5" strokeWidth={2} />
            {costDeltaLine}
          </p>
        ) : null}
      </div>

      {/* Delivery tracking — independent from sourcing cost */}
      {hasDeliveryTracking ? (
        <div className="px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
              Giao hàng
            </span>
          </div>
          {deliveryLines.receivedLine ? (
            <div className="space-y-1 text-[11px] font-semibold text-slate-700">
              <p>{deliveryLines.receivedLine}</p>
              <p className="text-slate-500">{deliveryLines.etaLine}</p>
            </div>
          ) : deliveryFallback.length > 0 ? (
            <p className="text-[11px] font-semibold text-slate-600">{deliveryFallback[0]}</p>
          ) : null}
          {snapshot?.hasDelay && snapshot.delayHint ? (
            <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-rose-600">
              <AlertCircle className="h-3 w-3" strokeWidth={2} />
              {snapshot.delayHint}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-slate-50 px-4 py-3 text-[11px] text-slate-400">
          <Package className="h-3.5 w-3.5" strokeWidth={2} />
          Chưa có item theo dõi giao nhận
        </div>
      )}
      </button>

      {showPickupCta ? (
        <div className="relative border-t border-emerald-200/70 bg-gradient-to-b from-emerald-50/90 to-white px-4 py-3">
          <button
            type="button"
            onClick={handleCreateStockIssue}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:from-emerald-700 hover:to-teal-700 hover:shadow-emerald-600/35 active:scale-[0.99]"
          >
            <PackageOpen className="h-4 w-4 shrink-0" strokeWidth={2.5} />
            Tạo phiếu xuất kho
            <ArrowRight className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2.5} />
          </button>
          <p className="mt-2 text-center text-[10px] font-medium text-emerald-800/80">
            Gắn với PR này — kho duyệt và giao hàng cho bạn
          </p>
        </div>
      ) : showPickupLinked ? (
        <div className="border-t border-emerald-100 bg-emerald-50/50 px-4 py-3">
          <button
            type="button"
            onClick={handleOpenStockIssue}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            <PackageOpen className="h-4 w-4 shrink-0" strokeWidth={2} />
            Phiếu xuất: {linkedIssue.issueNumber}
            <ArrowRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
          </button>
        </div>
      ) : null}
    </article>
  );
}
