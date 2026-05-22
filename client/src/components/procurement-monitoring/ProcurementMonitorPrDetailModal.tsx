import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  ClipboardList,
  Clock,
  Copy,
  FileText,
  Loader2,
  Package,
  ShoppingBag,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  fetchProcurementMonitorPrDetail,
  type MonitorApiBase,
} from '../../services/procurementMonitoringService';
import {
  costBarMetaForCard,
  formatProcurementDelta,
  procurementCostAmountOf,
  type CostInsightShape,
} from '../../utils/requestorProcurementCard';
import { formatEtaDisplay } from '../../utils/requestorProcurementLabels';
import type { RequestorItemStatusKey } from '../../services/requestorService';
import { ITEM_STATUS_BADGE_CLASS } from '../../utils/requestorProcurementLabels';

const Z_OVERLAY = 'z-[220]';

type Props = {
  apiBase: MonitorApiBase;
  prId: string;
  onClose: () => void;
};

type MonitorItemRow = {
  itemId?: string;
  label: string;
  statusLabel: string;
  statusKey?: string;
  eta: string | null;
  poNumber: string | null;
};

function timelineProgressPercent(stages: Array<{ completed: boolean }>): number {
  if (!stages.length) return 0;
  const completedCount = stages.filter((s) => s.completed).length;
  if (stages.length <= 1) return completedCount > 0 ? 100 : 0;
  return Math.min(100, Math.round((completedCount / (stages.length - 1)) * 1000) / 10);
}

function itemStatusBadgeClass(statusKey?: string): string {
  if (statusKey && statusKey in ITEM_STATUS_BADGE_CLASS) {
    return ITEM_STATUS_BADGE_CLASS[statusKey as RequestorItemStatusKey];
  }
  return 'bg-slate-100 text-slate-700 ring-slate-200';
}

function ProcurementTimeline({
  stages,
}: {
  stages: Array<{ key: string; label: string; completed: boolean; current: boolean }>;
}) {
  const progressPct = timelineProgressPercent(stages);

  return (
    <div className="border-b border-slate-200/60 bg-slate-50 px-5 py-5 sm:px-6">
      <span className="mb-4 block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
        Luồng mua hàng
      </span>

      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-2">
        <div className="absolute bottom-2.5 left-3.5 top-2.5 z-0 w-0.5 bg-slate-200 md:hidden" />
        <div
          className="absolute left-0 top-3.5 z-0 hidden h-0.5 bg-slate-200 md:block md:w-full"
          aria-hidden
        />
        <div
          className="absolute left-0 top-3.5 z-0 hidden h-0.5 bg-indigo-500 transition-all duration-300 md:block"
          style={{ width: `${progressPct}%` }}
          aria-hidden
        />

        {stages.map((stage) => {
          const done = stage.completed && !stage.current;
          const current = stage.current;
          const upcoming = !done && !current;
          return (
            <div
              key={stage.key}
              className="relative z-10 flex flex-1 items-center gap-3 md:flex-col md:items-center md:gap-1.5"
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm ${
                  done
                    ? 'bg-indigo-500 text-white'
                    : current
                      ? 'bg-indigo-500 text-white ring-4 ring-indigo-500/20'
                      : 'bg-slate-200 text-slate-400'
                }`}
              >
                {done ? (
                  <Check className="h-3 w-3 stroke-[3]" />
                ) : current ? (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                )}
              </div>
              <p
                className={`text-xs leading-tight md:text-center ${
                  current
                    ? 'font-bold text-indigo-600'
                    : done
                      ? 'font-semibold text-slate-800'
                      : 'font-medium text-slate-400'
                }`}
              >
                {stage.label}
              </p>
              {upcoming ? <span className="sr-only">Chưa đến</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function statusLabelVi(raw: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Nháp',
    OPEN: 'Mở',
    CLOSED: 'Đóng',
    CANCELLED: 'Đã hủy',
    SENT: 'Đã gửi',
    ISSUED: 'Đã phát hành',
    CONFIRMED: 'NCC xác nhận',
    PARTIAL_RECEIVED: 'Nhận một phần',
    FULLY_RECEIVED: 'Nhận đủ',
    CREATED: 'Đã tạo',
    SELECTED: 'Đã chọn',
    VALID: 'Hợp lệ',
    PENDING: 'Chờ xử lý',
    READY_FOR_COMPARISON: 'Sẵn sàng so sánh',
  };
  return map[raw] ?? raw.replace(/_/g, ' ');
}

function rfqStatusClass(status: string): string {
  const s = status.toUpperCase();
  if (s === 'DRAFT') return 'bg-blue-50 text-blue-600 ring-blue-100';
  if (s === 'CLOSED' || s === 'CANCELLED') {
    return 'bg-slate-100 text-slate-500 ring-slate-200';
  }
  return 'bg-indigo-50 text-indigo-700 ring-indigo-100';
}

async function copyPrNumber(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function formatVndShort(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`;
  return new Intl.NumberFormat('vi-VN').format(n);
}

export function ProcurementMonitorPrDetailModal({ apiBase, prId, onClose }: Props) {
  const { showSuccess } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ['procurement-monitor-detail', apiBase, prId],
    queryFn: () => fetchProcurementMonitorPrDetail(apiBase, prId),
  });

  useEffect(() => {
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const mains = document.querySelectorAll('main');
    const mainPrev: { el: HTMLElement; overflow: string; overscroll: string }[] = [];
    mains.forEach((node) => {
      const el = node as HTMLElement;
      mainPrev.push({ el, overflow: el.style.overflow, overscroll: el.style.overscrollBehavior });
      el.style.overflow = 'hidden';
      el.style.overscrollBehavior = 'none';
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      mainPrev.forEach(({ el, overflow, overscroll }) => {
        el.style.overflow = overflow;
        el.style.overscrollBehavior = overscroll;
      });
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const deliveryPct = useMemo(() => {
    if (!detail?.deliverySummary?.totalCount) return 0;
    return Math.round(
      (detail.deliverySummary.receivedCount / detail.deliverySummary.totalCount) * 100
    );
  }, [detail]);

  const costInsight = detail?.costInsight as CostInsightShape | undefined;
  const costMeta = costBarMetaForCard(costInsight, detail?.deliverySummary);
  const costDelta = formatProcurementDelta(costInsight);
  const procurementCost = procurementCostAmountOf(costInsight);
  const costHeadline = procurementCost ? `${formatVndShort(procurementCost)} đ` : '—';

  const statusBadgeText = detail
    ? [detail.currentStep?.label, detail.currentStep?.detail].filter(Boolean).join(' · ')
    : '';

  const primaryStepLabel = detail?.currentStep?.label ?? 'Đang xử lý';

  const modalTree = (
    <div
      className={`fixed inset-0 ${Z_OVERLAY} flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden`}
      role="presentation"
    >
      <style>{`@keyframes procModalIn{from{opacity:0;transform:scale(0.97) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

      <button
        type="button"
        className="fixed inset-0 h-full w-full cursor-pointer border-0 bg-slate-900/40 backdrop-blur-sm"
        aria-label="Đóng"
        onClick={onClose}
      />

      <div className="pointer-events-none relative z-[1] flex min-h-0 flex-1 items-center justify-center p-2 sm:p-4 md:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="proc-monitor-modal-title"
          className="pointer-events-auto flex max-h-[min(94dvh,calc(100dvh-1rem))] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-50 shadow-2xl"
          style={{ animation: 'procModalIn 0.28s cubic-bezier(0.16,1,0.3,1)' }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header gradient */}
          <div className="relative shrink-0 overflow-hidden border-b border-white/10 bg-gradient-to-br from-indigo-800 via-violet-700 to-indigo-600 px-5 py-5 sm:px-6">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_120%_at_100%_0%,rgba(255,255,255,0.22),transparent_50%)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full bg-violet-400/25 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute bottom-0 right-1/4 h-24 w-48 rounded-full bg-indigo-300/15 blur-2xl"
              aria-hidden
            />
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white shadow-lg shadow-indigo-950/30 backdrop-blur-sm">
                  <ShoppingBag className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-100/90">
                    Giám sát mua hàng
                  </span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <h2
                      id="proc-monitor-modal-title"
                      className="text-lg font-extrabold tracking-tight text-white md:text-xl"
                    >
                      {detail?.pr?.prNumber ?? 'Chi tiết PR'}
                    </h2>
                    {detail?.pr?.prNumber ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (await copyPrNumber(detail.pr.prNumber)) {
                            setCopied(true);
                            showSuccess('Đã sao chép mã PR thành công!');
                            setTimeout(() => setCopied(false), 2000);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/20 hover:text-white"
                        title="Sao chép mã PR"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-emerald-300" strokeWidth={2.5} />
                        ) : (
                          <Copy className="h-3.5 w-3.5" strokeWidth={2.5} />
                        )}
                        <span>Sao chép mã PR</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                {detail?.currentStep ? (
                  <span className="hidden max-w-[220px] truncate rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm sm:inline-flex">
                    {primaryStepLabel}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-transparent p-2 text-white/75 transition hover:border-white/20 hover:bg-white/15 hover:text-white"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>

          {detail?.currentStep ? (
            <div className="border-b border-indigo-100/80 bg-gradient-to-r from-indigo-50/90 via-violet-50/70 to-indigo-50/90 px-5 py-2 sm:hidden">
              <span className="inline-flex w-full items-center justify-center rounded-full border border-indigo-200/80 bg-white/80 px-3 py-1 text-xs font-bold text-indigo-800 backdrop-blur-sm">
                {statusBadgeText}
              </span>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-auto [-webkit-overflow-scrolling:touch] scrollbar-hide touch-pan-y">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                <p className="text-sm font-medium text-slate-600">Đang tải vòng đời mua hàng…</p>
              </div>
            ) : error || !detail ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-semibold text-rose-700">Không tải được chi tiết PR</p>
                <p className="mt-1 text-xs text-slate-500">Vui lòng thử lại sau.</p>
              </div>
            ) : (
              <>
                {detail.timeline?.stages?.length ? (
                  <ProcurementTimeline stages={detail.timeline.stages} />
                ) : null}

                <div className="grid grid-cols-1 gap-4 bg-gradient-to-b from-white via-slate-50/50 to-white p-5 sm:grid-cols-3 sm:p-6">
                  {/* Tiến độ nhận hàng */}
                  <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-500 p-5 text-white shadow-lg shadow-indigo-600/25 ring-1 ring-white/10">
                    <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/15 blur-xl" />
                    <div className="absolute -left-4 top-0 h-16 w-16 rounded-full bg-violet-300/20 blur-2xl" />
                    <div className="relative z-10 flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-100">
                          Tiến độ nhận hàng
                        </span>
                        <div className="mt-1.5 flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold tracking-tight tabular-nums">
                            {detail.deliverySummary.receivedCount}/{detail.deliverySummary.totalCount}
                          </span>
                          <span className="text-xs text-indigo-100/90">sản phẩm</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/20 bg-white/15 p-2.5 backdrop-blur-sm">
                        <Truck className="h-4 w-4" strokeWidth={2.5} />
                      </div>
                    </div>
                    <div className="relative z-10 mt-4 h-1.5 overflow-hidden rounded-full bg-white/25">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-white to-indigo-100 shadow-sm transition-all"
                        style={{ width: `${deliveryPct}%` }}
                      />
                    </div>
                  </div>

                  {/* ETA */}
                  <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 p-5 text-white shadow-lg shadow-emerald-600/20 ring-1 ring-white/10">
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15 blur-xl" />
                    <div className="relative z-10 flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-50">
                          ETA gần nhất
                        </span>
                        <p className="mt-1.5 text-2xl font-black tracking-tight tabular-nums">
                          {detail.deliverySummary.nextEta
                            ? formatEtaDisplay(detail.deliverySummary.nextEta)
                            : '—'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/20 bg-white/15 p-2.5 backdrop-blur-sm">
                        <Clock className="h-4 w-4" strokeWidth={2.5} />
                      </div>
                    </div>
                    {detail.deliverySummary.nextEta ? (
                      <p className="relative z-10 mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-50">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                        Dự kiến giao theo lịch
                      </p>
                    ) : (
                      <p className="relative z-10 mt-4 text-[11px] text-emerald-100/80">Chưa có ETA</p>
                    )}
                  </div>

                  {/* Chi phí */}
                  <div
                    className={`relative flex flex-col justify-between overflow-hidden rounded-2xl p-5 text-white shadow-lg ring-1 ring-white/10 ${
                      costMeta.tone === 'over'
                        ? 'bg-gradient-to-br from-rose-500 via-rose-600 to-orange-600 shadow-rose-600/25'
                        : costMeta.tone === 'emerald'
                          ? 'bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-600 shadow-indigo-600/20'
                          : 'bg-gradient-to-br from-slate-600 via-slate-700 to-indigo-800 shadow-slate-700/25'
                    }`}
                  >
                    <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
                    <div className="relative z-10 flex items-start justify-between">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                          Chi phí
                        </span>
                        <p className="mt-1.5 truncate text-2xl font-black tracking-tight tabular-nums">
                          {costHeadline}
                        </p>
                      </div>
                      <div className="shrink-0 rounded-xl border border-white/20 bg-white/15 p-2.5 backdrop-blur-sm">
                        <Wallet className="h-4 w-4" strokeWidth={2.5} />
                      </div>
                    </div>
                    <p className="relative z-10 mt-4 text-[11px] font-medium text-white/85">
                      {costDelta ?? costMeta.sublabel ?? 'Chưa cập nhật báo giá'}
                    </p>
                  </div>
                </div>

                <div className="space-y-6 p-5 sm:p-6">
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-indigo-500/10 p-1.5 text-indigo-600">
                        <ClipboardList className="h-4 w-4" strokeWidth={2.5} />
                      </div>
                      <h3 className="text-sm font-extrabold uppercase tracking-tight text-slate-800">
                        Vòng đời dòng hàng
                      </h3>
                    </div>
                    <ul className="space-y-2.5">
                      {(detail.items ?? []).map((it: MonitorItemRow) => {
                        const [sku, ...rest] = it.label.split(' — ');
                        const subtitle = rest.join(' — ') || undefined;
                        return (
                          <li key={it.itemId ?? it.label}>
                            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_12px_rgb(0_0_0/0.02)] sm:flex-row sm:items-center">
                              <div>
                                <span className="text-xs font-bold text-slate-800">
                                  {sku || it.label}
                                </span>
                                {subtitle ? (
                                  <span className="mt-0.5 block text-[11px] text-slate-400">
                                    {subtitle}
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-3.5">
                                <span
                                  className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold ring-1 ${itemStatusBadgeClass(it.statusKey)}`}
                                >
                                  {it.statusLabel}
                                </span>
                                {it.poNumber ? (
                                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-600">
                                    {it.poNumber}
                                  </span>
                                ) : null}
                                {it.eta ? (
                                  <span className="text-[11px] font-medium text-slate-400">
                                    ETA {formatEtaDisplay(it.eta)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>

                  {(detail.rfqs?.length ?? 0) > 0 ? (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-blue-500/10 p-1.5 text-blue-600">
                          <FileText className="h-4 w-4" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-sm font-extrabold uppercase tracking-tight text-slate-800">
                          Yêu cầu báo giá (RFQ)
                        </h3>
                      </div>
                      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {detail.rfqs.map((r: { id?: string; rfqNumber: string; status: string }) => {
                          const closed = ['CLOSED', 'CANCELLED'].includes(
                            String(r.status).toUpperCase()
                          );
                          return (
                            <li
                              key={r.id ?? r.rfqNumber}
                              className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_2px_12px_rgb(0_0_0/0.02)]"
                            >
                              <span
                                className={`text-xs font-bold ${closed ? 'text-slate-400 line-through' : 'text-slate-800'}`}
                              >
                                {r.rfqNumber}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ring-1 ${rfqStatusClass(r.status)}`}
                              >
                                {statusLabelVi(r.status)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ) : null}

                  {(detail.purchaseOrders?.length ?? 0) > 0 ? (
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600">
                          <Package className="h-4 w-4" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-sm font-extrabold uppercase tracking-tight text-slate-800">
                          PO & phiếu nhận kho
                        </h3>
                      </div>
                      <ul className="space-y-3">
                        {detail.purchaseOrders.map(
                          (po: {
                            id?: string;
                            poNumber: string;
                            status: string;
                            supplierName: string | null;
                            itemCount?: number;
                          }) => (
                            <li
                              key={po.id ?? po.poNumber}
                              className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgb(0_0_0/0.02)] transition-all hover:border-emerald-500/50 sm:flex-row sm:items-center"
                            >
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-extrabold text-indigo-600">
                                    {po.poNumber}
                                  </span>
                                  <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                                    {statusLabelVi(String(po.status))}
                                  </span>
                                </div>
                                {po.supplierName ? (
                                  <p className="text-[11px] text-slate-400">
                                    Nhà cung cấp:{' '}
                                    <span className="font-semibold uppercase text-slate-700">
                                      {po.supplierName}
                                    </span>
                                  </p>
                                ) : null}
                              </div>
                              {po.itemCount != null && po.itemCount > 0 ? (
                                <span className="self-start rounded-xl border border-slate-200/80 px-4 py-2 text-xs font-bold text-slate-700 sm:self-center">
                                  {po.itemCount} dòng hàng
                                </span>
                              ) : null}
                            </li>
                          )
                        )}
                      </ul>
                    </section>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-slate-200/60 bg-white px-5 py-5 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-9 py-3 text-xs font-extrabold text-white shadow-md transition hover:bg-slate-800 active:scale-95"
            >
              Đóng
            </button>
            <span className="hidden text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:inline">
              Hệ thống quản lý mua hàng
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalTree, document.body);
}
