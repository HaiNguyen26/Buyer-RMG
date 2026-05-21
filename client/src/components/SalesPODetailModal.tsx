import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { salesService } from '../services/salesService';
import {
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  DollarSign,
  FileText,
  Hash,
  LayoutDashboard,
  ListOrdered,
  User,
  Wallet,
  X,
} from 'lucide-react';

export type SalesPODetailModalProps = {
  open: boolean;
  salesPOId: string | null;
  onClose: () => void;
  onOpenWorkspace: (id: string) => void;
};

function fmtMoney(n: number, currency: string) {
  return `${n.toLocaleString('vi-VN')} ${currency}`;
}

function soStatusLabel(status: string) {
  if (status === 'ACTIVE') return { label: 'Đang chạy', icon: Briefcase, color: 'emerald' };
  if (status === 'CLOSED') return { label: 'Đã đóng', icon: Hash, color: 'slate' };
  return { label: 'Nháp', icon: FileText, color: 'amber' };
}

/**
 * Popup chi tiết Sales Order / PO khách (SaaS) — dùng API Sales `getSalesPODetail`.
 */
export function SalesPODetailModal({
  open,
  salesPOId,
  onClose,
  onOpenWorkspace,
}: SalesPODetailModalProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-po-detail-modal', salesPOId],
    queryFn: () => salesService.getSalesPODetail(salesPOId!),
    enabled: open && !!salesPOId,
  });

  const sp = data?.salesPO;
  const summary = data?.financialSummary;
  const prs = data?.purchaseRequests ?? [];
  const currency = sp?.currency ?? 'VND';
  const badge = sp ? soStatusLabel(sp.status) : null;

  if (!open || !salesPOId) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(15,23,42,0.6)' }}
      onClick={onClose}
    >
      <div
        className="modal-popup-panel flex max-h-[min(96dvh,100dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl"
        style={{
          boxShadow:
            '0 32px 64px -12px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.06) inset',
          animation: 'modalZoomIn 0.22s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes modalZoomIn{from{opacity:0;transform:scale(0.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

        {/* Glassmorphism Header */}
        <div
          className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/60 px-5 py-4 sm:px-6"
          style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)' }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">
              Sales Order
            </p>
            <h2 className="mt-0.5 font-mono text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {sp?.salesPONumber ?? salesPOId}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {sp && badge ? (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    badge.color === 'emerald'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : badge.color === 'amber'
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  <badge.icon className="h-3 w-3" strokeWidth={2} />
                  {badge.label}
                </span>
              ) : null}
              {sp?.customer?.name ? (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Building2 className="h-3 w-3" />
                  {sp.customer.name}
                </span>
              ) : null}
              {sp?.projectName ? (
                <span className="text-xs text-slate-400">{sp.projectName}</span>
              ) : null}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-400 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 [scrollbar-width:thin]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                <p className="text-sm text-slate-500">Đang tải…</p>
              </div>
            </div>
          ) : error || !sp ? (
            <div className="flex items-center justify-center px-6 py-16">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <X className="mx-auto mb-3 h-8 w-8 text-red-500" strokeWidth={2} />
                <p className="font-semibold text-red-700">Không tải được dữ liệu</p>
                <p className="mt-1 text-sm text-red-500">
                  {error instanceof Error ? error.message : 'Vui lòng thử lại sau.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0 md:flex-row md:min-h-full">
              {/* Main column */}
              <div className="min-w-0 flex-[3] space-y-4 p-4 sm:p-5 md:border-r md:border-slate-200/60">
                {/* Insight cards */}
                {summary ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-md shadow-blue-500/20">
                      <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100">
                        Giá trị SO
                      </p>
                      <p className="mt-1 text-xl font-black tabular-nums leading-tight">
                        {fmtMoney(summary.salesPOAmount, currency)}
                      </p>
                      <DollarSign
                        className="absolute bottom-3 right-3 h-6 w-6 text-white/20"
                        strokeWidth={1.5}
                      />
                    </div>

                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white shadow-md shadow-violet-500/20">
                      <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-violet-100">
                        Đã chi
                      </p>
                      <p className="mt-1 text-xl font-black tabular-nums leading-tight">
                        {fmtMoney(summary.actualCost, currency)}
                      </p>
                      <Wallet
                        className="absolute bottom-3 right-3 h-6 w-6 text-white/20"
                        strokeWidth={1.5}
                      />
                    </div>

                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 p-4 text-white shadow-md shadow-emerald-500/20">
                      <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-100">
                        Còn lại
                      </p>
                      <p className="mt-1 text-xl font-black tabular-nums leading-tight">
                        {fmtMoney(summary.remainingBudget, currency)}
                      </p>
                      <p className="mt-1 text-[11px] text-emerald-100/80">
                        ~{summary.progressPercent}% đã dùng
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* PR list */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                    <ListOrdered className="h-4 w-4 text-slate-500" strokeWidth={2} />
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                      PR liên kết ({prs.length})
                    </h3>
                  </div>
                  {prs.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      Chưa có Purchase Request nào gắn SO này.
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-auto [scrollbar-width:thin]">
                      <table className="w-full min-w-[640px] border-collapse text-sm">
                        <thead className="sticky top-0 bg-slate-50">
                          <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            <th className="px-4 py-2.5 text-left">Mã PR</th>
                            <th className="px-4 py-2.5 text-right">Chi phí</th>
                            <th className="px-4 py-2.5 text-left">Trạng thái</th>
                            <th className="px-4 py-2.5 text-left">Người tạo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {prs.map((pr: any) => (
                            <tr key={pr.id} className="bg-white hover:bg-slate-50/80">
                              <td className="px-4 py-2.5 font-semibold text-slate-900">
                                {pr.prNumber}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-slate-800">
                                {fmtMoney(Number(pr.actualCost ?? 0), currency)}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex max-w-[200px] truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                  {String(pr.status ?? '—')}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-600">
                                {pr.requestor?.username ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className="flex flex-col gap-4 bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5 md:w-64 md:shrink-0 md:border-t-0">
                {/* Metadata block */}
                <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-800 text-white shadow-lg shadow-indigo-900/30">
                  <div className="border-b border-indigo-700/50 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-300">
                      Thông tin chứng từ
                    </p>
                  </div>
                  <dl className="divide-y divide-indigo-700/30 px-4 py-0 text-sm">
                    {sp.projectCode ? (
                      <div className="flex items-center justify-between gap-2 py-3">
                        <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                          <Hash className="h-3 w-3" strokeWidth={2} />
                          Mã dự án
                        </dt>
                        <dd className="font-semibold text-white">{sp.projectCode}</dd>
                      </div>
                    ) : null}
                    {sp.effectiveDate ? (
                      <div className="flex items-center justify-between gap-2 py-3">
                        <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                          <Calendar className="h-3 w-3" strokeWidth={2} />
                          Hiệu lực
                        </dt>
                        <dd className="font-semibold tabular-nums text-white">
                          {new Date(sp.effectiveDate).toLocaleDateString('vi-VN')}
                        </dd>
                      </div>
                    ) : null}
                    {sp.customerPONumber ? (
                      <div className="flex flex-col gap-1 py-3">
                        <dt className="text-xs text-indigo-300">Customer PO</dt>
                        <dd className="font-mono text-sm font-semibold text-white">
                          {sp.customerPONumber}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>

                {/* Actions */}
                <div className="mt-auto flex flex-col gap-2">
                  {salesPOId ? (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenWorkspace(salesPOId);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                    >
                      <LayoutDashboard className="h-4 w-4" strokeWidth={2} />
                      Mở workspace
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default SalesPODetailModal;
