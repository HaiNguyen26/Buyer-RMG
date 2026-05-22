import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Fingerprint,
  Loader2,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import { requestorService } from '../../services/requestorService';
import { PRSalesOrderLine } from '../PRSalesOrderLine';
import { RequestorTrackingLiquidBar } from './RequestorTrackingLiquidBar';
import {
  currentStepToneClass,
  formatEtaDisplay,
  ITEM_STATUS_BADGE_CLASS,
} from '../../utils/requestorProcurementLabels';
import { RequestorEtaDisplay } from './RequestorEtaDisplay';
import { PoLineCancelNote } from '../po/PoLineCancelNote';
import {
  isPurchaseCostCompleted,
  purchaseCostSectionDisplay,
  type CostInsightShape,
} from '../../utils/requestorProcurementCard';
import { slaBarPercent } from '../../utils/requestorSlaBar';

type RequestorPRProcurementModalProps = {
  prId: string;
  onClose: () => void;
};

function formatAmountSplit(amount: number | null) {
  if (amount == null) return { main: '—', suffix: '' };
  return {
    main: new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount),
    suffix: 'VND',
  };
}

function formatLineNo(lineNo: number): string {
  return String(lineNo).padStart(2, '0');
}

function copyText(text: string): boolean {
  try {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      return true;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return ok;
  } catch {
    return false;
  }
}

/** Width of gradient progress line from completed stages (7-step business timeline). */
function timelineProgressPercent(
  stages: Array<{ completed: boolean; current: boolean }>
): number {
  if (!stages.length) return 0;
  const completedCount = stages.filter((s) => s.completed).length;
  if (stages.length <= 1) return completedCount > 0 ? 100 : 0;
  return Math.min(100, Math.round((completedCount / (stages.length - 1)) * 1000) / 10);
}

function HorizontalProcurementStepper({
  stages,
}: {
  stages: Array<{ key: string; label: string; completed: boolean; current: boolean }>;
}) {
  const progressPct = timelineProgressPercent(stages);

  return (
    <div className="border-b border-slate-100 bg-slate-50/40 px-4 py-5 sm:px-5">
      <div className="relative flex w-full items-center justify-between">
        <div className="absolute left-0 right-0 top-1/2 z-0 h-0.5 -translate-y-1/2 rounded-full bg-slate-200" />
        <div
          className="absolute left-0 top-1/2 z-0 h-0.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />

        {stages.map((stage) => {
          const done = stage.completed && !stage.current;
          const current = stage.current;
          const upcoming = !done && !current;
          return (
            <div
              key={stage.key}
              className="relative z-10 flex min-w-0 flex-1 flex-col items-center px-0.5"
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[3px] transition-all duration-300 ${
                    done
                      ? 'border-white bg-gradient-to-tr from-indigo-500 to-violet-600 text-white shadow-[0_2px_10px_rgba(99,102,241,0.35)]'
                      : current
                        ? 'animate-pulse border-indigo-500 bg-white text-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.45)]'
                        : 'border-slate-200 bg-slate-100 text-slate-400'
                  }`}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5 stroke-[3.5]" />
                  ) : (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${upcoming ? 'bg-slate-300' : 'bg-indigo-500'}`}
                    />
                  )}
                </div>
              <div className="pointer-events-none absolute top-7 w-full max-w-[4.5rem] text-center sm:max-w-[5.5rem]">
                <span
                  className={`block truncate text-[9px] font-bold leading-tight ${
                    done ? 'text-slate-800' : current ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                  title={stage.label}
                >
                  {stage.label}
                </span>
                <span className="mt-0.5 block text-[8px] font-medium text-slate-400">
                  {current ? 'Đang xử lý' : done ? 'Xong' : 'Chờ'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="h-7" aria-hidden />
    </div>
  );
}

export function RequestorPRProcurementModal({ prId, onClose }: RequestorPRProcurementModalProps) {
  const [copiedPr, setCopiedPr] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['requestor-pr-procurement', prId],
    queryFn: () => requestorService.getPRProcurementTracking(prId),
    enabled: !!prId,
  });

  useEffect(() => {
    const root = document.getElementById('root');
    const html = document.documentElement;
    const prevRootPe = root?.style.pointerEvents ?? '';
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    if (root) root.style.pointerEvents = 'none';
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      if (root) root.style.pointerEvents = prevRootPe;
      html.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  const detail = data;
  const slaPercent = detail ? slaBarPercent(detail.sla) : 0;
  const amountParts = detail ? formatAmountSplit(detail.pr.totalAmount) : { main: '—', suffix: '' };
  const costInsight = detail?.costInsight as CostInsightShape | undefined;
  const deliverySummary = detail?.deliverySummary;
  const purchaseCompleted = isPurchaseCostCompleted(costInsight, deliverySummary);
  const costSection = purchaseCostSectionDisplay(
    costInsight,
    detail?.pr.currency ?? 'VND',
    deliverySummary,
    detail?.pr.totalAmount ?? null
  );
  const deliveryBarPct = useMemo(() => {
    if (!detail?.deliverySummary.totalCount) return 0;
    return Math.round(
      (detail.deliverySummary.receivedCount / detail.deliverySummary.totalCount) * 100
    );
  }, [detail]);

  const slaBarTone = useMemo(() => {
    if (!detail) return 'indigo' as const;
    if (detail.sla.status === 'overdue') return 'rose' as const;
    if (detail.sla.status === 'warning') return 'amber' as const;
    if (detail.sla.status === 'completed') return 'blue' as const;
    return 'emerald' as const;
  }, [detail]);

  const handleCopyPr = () => {
    if (!detail?.pr.prNumber) return;
    if (copyText(detail.pr.prNumber)) {
      setCopiedPr(true);
      setTimeout(() => setCopiedPr(false), 2000);
    }
  };

  const statusBadgeText = detail
    ? [detail.currentStep.label, detail.currentStep.detail].filter(Boolean).join(' · ')
    : '';

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(15,23,42,0.6)' }}
      onClick={onClose}
    >
      <div
        className="modal-popup-panel flex max-h-[min(96dvh,100dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-slate-200/60 bg-white shadow-[0_30px_70px_-15px_rgba(15,23,42,0.12)] sm:rounded-2xl"
        style={{ animation: 'modalZoomIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="requestor-pr-procurement-modal-title"
      >
        <style>{`@keyframes modalZoomIn{from{opacity:0;transform:scale(0.96) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

        {/* Nav bar */}
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 p-2 text-white shadow-md shadow-indigo-500/15">
                <Fingerprint className="h-4 w-4" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <div className="mb-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">
                    Hệ thống Mua sắm ERP
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden />
                  <span className="text-[10px] font-bold text-slate-400">THEO DÕI PR</span>
                </div>
                <h2
                  id="requestor-pr-procurement-modal-title"
                  className="text-base font-black tracking-tight text-slate-900"
                >
                  Chi tiết Purchase Request (PR)
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {detail ? (
                <span
                  className={`inline-flex max-w-[min(100%,320px)] items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-extrabold shadow-sm ${currentStepToneClass(detail.currentStep.tone)}`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-current opacity-70" />
                  <span className="truncate">{statusBadgeText}</span>
                </span>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        {/* Title bar */}
        {detail ? (
          <div className="shrink-0 border-b border-slate-100 bg-slate-50/30 px-4 py-3.5 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-xl font-black tracking-tight text-slate-900">
                    {detail.pr.prNumber}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPr}
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600"
                    aria-label="Sao chép số PR"
                  >
                    {copiedPr ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  {detail.pr.department ? (
                    <span className="rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 font-bold text-indigo-600">
                      {detail.pr.department}
                    </span>
                  ) : null}
                  <span>•</span>
                  <span>
                    Tạo ngày{' '}
                    {new Date(detail.pr.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Đang tải tiến độ mua hàng…</p>
            </div>
          ) : error || !detail ? (
            <div className="px-8 py-16 text-center text-sm text-rose-600">
              Không tải được chi tiết theo dõi mua hàng.
            </div>
          ) : (
            <>
              <HorizontalProcurementStepper stages={detail.timeline.stages} />

              <div className="flex flex-col divide-y divide-slate-200/80 lg:flex-row lg:divide-x lg:divide-y-0">
                <div className="min-w-0 flex-1 space-y-5 bg-white p-4 sm:p-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 p-4 text-white shadow-md">
                      <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-white/5" />
                      <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-indigo-200">
                        Giá trị PR liên kết
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black tracking-tight">{amountParts.main}</span>
                        {amountParts.suffix ? (
                          <span className="text-xs font-bold text-indigo-200">{amountParts.suffix}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-indigo-100/90">
                        <Wallet className="h-3.5 w-3.5 text-indigo-200" />
                        Ngân sách / giá trị yêu cầu PR
                      </p>
                    </div>

                    <div className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-slate-100/50 p-4 shadow-sm">
                      <div>
                        <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          Mục đích sử dụng
                        </span>
                        <p className="mt-1 text-sm font-extrabold leading-snug text-slate-800">
                          {detail.pr.purpose || 'Không có mô tả'}
                        </p>
                      </div>
                      <span className="mt-2.5 block text-[10px] font-bold text-slate-500">
                        {detail.pr.purpose ? 'Theo nội dung PR' : '—'}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`rounded-xl border p-3 shadow-sm ${
                      purchaseCompleted
                        ? 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white'
                        : 'border-slate-200/80 bg-white'
                    }`}
                  >
                      <span className="mb-2 block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                        {costSection.sectionTitle}
                      </span>
                      <div className="mb-2 h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            purchaseCompleted
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                              : 'bg-gradient-to-r from-indigo-400 to-violet-500'
                          }`}
                          style={{ width: `${Math.max(8, costSection.costProgressPercent)}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-medium text-slate-400">
                            {costSection.primaryLabel}
                          </p>
                          <p
                            className={`text-lg font-black tabular-nums ${
                              purchaseCompleted ? 'text-emerald-900' : 'text-slate-900'
                            }`}
                          >
                            {costSection.primaryValue}
                          </p>
                          {costSection.primarySub ? (
                            <p className="mt-0.5 text-[10px] text-slate-500">{costSection.primarySub}</p>
                          ) : null}
                        </div>
                        <div>
                          <p className="text-[10px] font-medium text-slate-400">
                            {costSection.secondaryLabel}
                          </p>
                          <p className="text-lg font-bold tabular-nums text-slate-800">
                            {costSection.secondaryValue}
                          </p>
                          {costSection.secondarySub ? (
                            <p className="mt-0.5 text-[10px] text-slate-500">{costSection.secondarySub}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                  <div className="space-y-4">
                    <div className="border-b border-slate-200/60 pb-1">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Danh sách hạng mục chi tiết
                      </h3>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Trạng thái giao hàng theo từng item
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
                      <table className="w-full table-fixed border-collapse text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200/60 bg-slate-50 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                            <th className="w-[7%] px-2 py-2 text-center">STT</th>
                            <th className="w-[28%] px-2 py-2">Hàng hóa</th>
                            <th className="w-[7%] px-2 py-2 text-center">SL</th>
                            <th className="w-[18%] px-2 py-2 text-center">Trạng thái</th>
                            <th className="w-[12%] px-2 py-2 text-right">ETA</th>
                            <th className="w-[12%] px-2 py-2 text-right">Nhận</th>
                            <th className="w-[10%] px-2 py-2 text-right">Chờ</th>
                            <th className="w-[16%] px-2 py-2">Lý do hủy / chờ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {detail.items.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-2 py-6 text-center text-slate-500">
                                Không có item.
                              </td>
                            </tr>
                          ) : (
                            detail.items.map((row) => (
                              <tr
                                key={row.itemId}
                                className="transition-colors hover:bg-slate-50/50"
                              >
                                <td className="px-2 py-2.5 text-center font-bold text-slate-400">
                                  {formatLineNo(row.lineNo)}
                                </td>
                                <td className="px-2 py-2.5">
                                  <span className="block truncate font-bold text-slate-900" title={row.label}>
                                    {row.label}
                                  </span>
                                  {row.poNumber ? (
                                    <span className="mt-0.5 block truncate font-mono text-[9px] text-slate-400">
                                      PO {row.poNumber}
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-2 py-2.5 text-center font-bold tabular-nums text-slate-800">
                                  {row.qtyOrdered}
                                </td>
                                <td className="px-2 py-2.5 text-center">
                                  <span
                                    className={`inline-flex max-w-full items-center truncate rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                                      ITEM_STATUS_BADGE_CLASS[row.statusKey] ??
                                      'bg-slate-100 text-slate-800'
                                    }`}
                                  >
                                    {row.statusLabel}
                                  </span>
                                </td>
                                <td className="px-2 py-2.5 text-right text-slate-800">
                                  <RequestorEtaDisplay
                                    eta={row.eta}
                                    etaOriginal={row.etaOriginal}
                                    etaRevised={row.etaRevised}
                                    className="text-xs"
                                  />
                                </td>
                                <td className="px-2 py-2.5 text-right font-bold tabular-nums text-slate-800">
                                  {row.qtyReceived}/{row.qtyCap}
                                </td>
                                <td
                                  className={`px-2 py-2.5 text-right font-bold tabular-nums ${
                                    row.qtyWaiting > 0 ? 'text-rose-700' : 'text-slate-400'
                                  }`}
                                >
                                  {row.qtyWaiting > 0 ? row.qtyWaiting : '—'}
                                </td>
                                <td className="px-2 py-2.5 align-top text-[10px] leading-snug text-slate-600">
                                  {row.lineCancelReason ||
                                  row.cancelledRemainingQty != null ||
                                  row.statusKey === 'LINE_CANCEL_PENDING' ? (
                                    <PoLineCancelNote
                                      orderedQty={row.qtyCap}
                                      receivedQty={row.qtyReceived}
                                      cancelledQty={
                                        row.cancelledRemainingQty ?? row.qtyWaiting
                                      }
                                      reason={row.lineCancelReason}
                                      pending={row.statusKey === 'LINE_CANCEL_PENDING'}
                                    />
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50 px-4 py-3.5 text-xs shadow-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <Activity className="h-4 w-4 shrink-0 animate-pulse text-indigo-500" />
                      {detail.pr.salesOrder ? (
                        <PRSalesOrderLine salesOrder={detail.pr.salesOrder} className="text-xs" />
                      ) : (
                        <span className="font-bold text-slate-600">
                          Sales Order (SO): Không liên kết chứng từ ngoài
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {detail.pr.salesOrder ? 'Liên kết dự án' : 'Nội bộ'}
                    </span>
                  </div>
                </div>

                <div className="flex w-full shrink-0 flex-col justify-between gap-4 bg-slate-50/40 p-4 sm:p-5 lg:w-[260px]">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Tóm tắt giao hàng
                      </span>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-2xl font-black tabular-nums text-slate-900">
                          {detail.deliverySummary.receivedCount}
                          <span className="text-base font-bold text-slate-500">
                            /{detail.deliverySummary.totalCount}
                          </span>
                        </span>
                        <span className="rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          Item đã nhận
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full border border-slate-200/30 bg-slate-100 p-0.5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 shadow-[0_1px_6px_rgba(99,102,241,0.3)] transition-all duration-500"
                          style={{ width: `${deliveryBarPct}%` }}
                        />
                      </div>
                      <p className="mt-2.5 text-[10px] font-bold text-slate-400">
                        {detail.deliverySummary.nextEta
                          ? `ETA tiếp theo dự kiến: ${formatEtaDisplay(detail.deliverySummary.nextEta)}`
                          : 'Chưa có ETA dự kiến'}
                        {detail.deliverySummary.partialCount > 0
                          ? ` · ${detail.deliverySummary.partialCount} item nhận một phần`
                          : ''}
                        {detail.deliverySummary.waitingReorderCount > 0
                          ? ` · chờ ${detail.deliverySummary.waitingReorderQty} SL (${detail.deliverySummary.waitingReorderCount} item)`
                          : ''}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                      <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Trạng thái SLA xử lý
                      </span>
                      {detail.sla.status === 'completed' ? (
                        <div className="flex items-center gap-3">
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-600 shadow-sm">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="block text-xl font-black text-slate-900">Hoàn tất</span>
                            <span className="block text-[10px] font-bold text-slate-400">
                              PR đã kết thúc SLA
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-indigo-600 shadow-sm">
                              <Clock className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="block text-xl font-black text-slate-900">
                                {detail.sla.status === 'overdue'
                                  ? detail.sla.timeOverdue ?? 'Quá hạn'
                                  : detail.sla.timeRemaining ?? '—'}
                              </span>
                              <span className="block text-[10px] font-bold text-slate-400">
                                {detail.sla.estimatedDays
                                  ? `Cam kết tối đa: ~${detail.sla.estimatedDays} ngày`
                                  : 'Theo tiến độ xử lý'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3">
                            <RequestorTrackingLiquidBar
                              label="Tiêu thụ SLA"
                              percent={slaPercent}
                              tone={slaBarTone}
                              fastFlow={
                                detail.sla.status === 'warning' || detail.sla.status === 'overdue'
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-2.5 rounded-xl border border-indigo-500/15 bg-indigo-500/5 p-3.5 shadow-sm">
                      <span className="block border-b border-indigo-500/10 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                        Thông tin chứng từ
                      </span>
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-400">Ngày tạo:</span>
                        <span className="text-slate-800">
                          {new Date(detail.pr.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-400">Trạng thái PR:</span>
                        <span className="font-bold text-indigo-600">{detail.pr.statusLabel}</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-400">Tiến độ:</span>
                        <span className="font-bold tabular-nums text-slate-800">
                          {Math.round(detail.timeline.percentage)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span>ERP SECURE PROTOCOL</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end border-t border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-transparent px-5 py-2.5 text-sm font-black text-slate-600 transition hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900"
          >
            Đóng lại
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
