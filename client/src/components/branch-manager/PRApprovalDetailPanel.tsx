import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  CheckCircle,
  XCircle,
  ArrowLeftRight,
  FileText,
  Building2,
  User,
  Package,
  Clock,
  Paperclip,
} from 'lucide-react';
import { PendingPRBranchSlaBar } from './PendingPRBranchSlaBar';

const motionEase =
  'transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none';

const shellClass =
  'overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_48px_-28px_rgba(15,23,42,0.18)] ring-1 ring-indigo-500/[0.06]';

function InfoTile({
  icon: Icon,
  label,
  children,
  accentClass,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  accentClass: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-100/95 bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/[0.03] transition-shadow duration-300 hover:shadow-[0_14px_28px_-14px_rgba(79,70,229,0.12)] hover:ring-indigo-200/60">
      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-indigo-400/10 to-transparent blur-2xl" aria-hidden />
      <div className="relative flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-inner ring-1 ring-white/80 ${accentClass}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
          <div className="mt-1.5 text-sm font-semibold leading-snug text-slate-900">{children}</div>
        </div>
      </div>
    </div>
  );
}

export type PRApprovalDetailPanelProps = {
  pr: Record<string, unknown> & {
    id: string;
    prNumber?: string;
    totalAmount?: number | null;
    currency?: string;
    department?: string;
    purpose?: string;
    notes?: string;
    requiredDate?: string;
    createdAt?: string;
    lastApproval?: { createdAt?: string } | null;
    requestor?: { username?: string };
    items?: Array<Record<string, unknown>>;
  };
  detailStep: number;
  formatCurrency: (amount: number | null, currency?: string) => string;
  onApprove: () => void;
  onReturnClick: () => void;
  onRejectClick: () => void;
  approvePending: boolean;
  returnPending: boolean;
  rejectPending: boolean;
};

export const PRApprovalDetailPanel = forwardRef<HTMLElement, PRApprovalDetailPanelProps>(
  function PRApprovalDetailPanel(
    {
      pr,
      detailStep,
      formatCurrency,
      onApprove,
      onReturnClick,
      onRejectClick,
      approvePending,
      returnPending,
      rejectPending,
    },
    ref,
  ) {
    const items = Array.isArray(pr.items) ? pr.items : [];
    const step1 = detailStep >= 1;
    const step2 = detailStep >= 2;
    const step3 = detailStep >= 3;
    const step4 = detailStep >= 4;

    return (
      <article
        ref={ref}
        id="pr-approval-detail"
        className={`${shellClass} ${motionEase} ${
          step1 ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
        }`}
      >
        {/* Header — gradient strip */}
        <div
          className={`relative overflow-hidden border-b border-indigo-100/80 bg-gradient-to-r from-[#EEF2FF] via-white to-slate-50/95 px-5 py-5 sm:px-6 sm:py-6 ${motionEase} ${
            step2 ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
          }`}
        >
          <div
            className="pointer-events-none absolute -right-4 top-0 h-40 w-40 rounded-full bg-indigo-400/15 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/35 ring-2 ring-white">
                <FileText className="h-6 w-6" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-600/90">Chi tiết PR</p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{pr.prNumber}</h2>
                <p className="mt-1 text-sm text-slate-600">Purchase Request · chờ quyết định chi nhánh</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3 sm:flex-col sm:items-end sm:gap-2">
              <div className="rounded-2xl border border-amber-200/90 bg-amber-50/95 px-3 py-1.5 shadow-sm ring-1 ring-amber-400/15">
                <span className="text-xs font-bold uppercase tracking-wide text-amber-900">Chờ duyệt</span>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tổng giá đề xuất</p>
                <p className="text-xl font-black tabular-nums tracking-tight text-emerald-700 sm:text-2xl">
                  {formatCurrency(pr.totalAmount ?? null, pr.currency)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`border-b border-slate-100/90 bg-white px-5 pb-4 pt-1 sm:px-6 ${motionEase} ${
            step2 ? 'translate-y-0 opacity-100' : 'pointer-events-none max-h-0 overflow-hidden opacity-0'
          }`}
        >
          <PendingPRBranchSlaBar
            createdAt={typeof pr.createdAt === 'string' ? pr.createdAt : new Date().toISOString()}
            requiredDate={pr.requiredDate ?? null}
            lastApproval={pr.lastApproval ?? null}
            visible={step2}
          />
        </div>

        <div
          className={`space-y-6 bg-[linear-gradient(180deg,#fafbfd_0%,#ffffff_48%)] px-5 py-6 scrollbar-hide sm:px-6 ${motionEase} ${
            step3 ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
          }`}
        >
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
            <InfoTile icon={Building2} label="Phòng ban" accentClass="bg-indigo-100 text-indigo-600">
              {pr.department || 'N/A'}
            </InfoTile>
            <InfoTile icon={User} label="Người yêu cầu" accentClass="bg-sky-100 text-sky-600">
              {pr.requestor?.username || 'N/A'}
            </InfoTile>
            {pr.requiredDate && (
              <InfoTile icon={Clock} label="Ngày cần" accentClass="bg-violet-100 text-violet-600">
                {new Date(pr.requiredDate).toLocaleDateString('vi-VN')}
              </InfoTile>
            )}
            {pr.purpose && (
              <InfoTile icon={FileText} label="Mục đích" accentClass="bg-emerald-100 text-emerald-600">
                <span className="font-medium">{String(pr.purpose)}</span>
              </InfoTile>
            )}
          </div>

          {items.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/[0.06] text-slate-700 ring-1 ring-slate-200/80">
                  <Package className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Danh sách vật tư / dịch vụ</h3>
                  <p className="text-xs font-medium text-slate-500">{items.length} dòng</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-[0_10px_36px_-20px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/[0.04]">
                <div className="h-[444px] overflow-auto [scrollbar-width:thin]">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-slate-200/90 bg-gradient-to-b from-slate-50 to-slate-100/90">
                        <th className="whitespace-nowrap px-4 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                          STT
                        </th>
                        <th className="min-w-[8rem] px-4 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                          Mô tả
                        </th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                          SL
                        </th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                          Đơn vị
                        </th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                          Đơn giá
                        </th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                          Thành tiền
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {items.map((item, index: number) => {
                        const lineNo = item.lineNo;
                        const qty = item.qty;
                        const unitPrice = item.unitPrice as number | undefined;
                        const amount = item.amount as number | undefined;
                        return (
                          <tr
                            key={String(item.id ?? index)}
                            className="bg-white transition-colors hover:bg-indigo-50/[0.35]"
                          >
                            <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-slate-800">
                              {lineNo != null ? String(lineNo) : String(index + 1)}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{item.description != null ? String(item.description) : '—'}</td>
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-900">{qty != null ? String(qty) : '—'}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">{item.unit != null ? String(item.unit) : '—'}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-900">
                              {unitPrice != null ? unitPrice.toLocaleString('vi-VN') : '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                              {amount != null ? amount.toLocaleString('vi-VN') : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {pr.notes && (
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03] sm:p-5">
              <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="h-4 w-4 text-indigo-500" strokeWidth={2} aria-hidden />
                <p className="text-sm font-bold text-slate-900">Ghi chú</p>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{String(pr.notes)}</p>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-dashed border-slate-200/95 bg-slate-50/80 p-4 sm:p-5">
            <div className="mb-2 flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-slate-400" strokeWidth={2} aria-hidden />
              <p className="text-sm font-bold text-slate-700">File đính kèm</p>
            </div>
            <p className="text-sm text-slate-500">Chưa có file đính kèm</p>
          </div>
        </div>

        <div
          className={`flex-shrink-0 border-t border-slate-200/90 bg-gradient-to-b from-slate-50/98 to-white px-5 py-5 sm:px-6 ${motionEase} ${
            step4 ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
            <button
              type="button"
              onClick={onApprove}
              disabled={approvePending}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-300/70 bg-gradient-to-b from-emerald-500 to-emerald-600 px-5 py-3.5 font-semibold text-white shadow-[0_10px_24px_-12px_rgba(16,185,129,0.45)] ring-1 ring-emerald-200/60 transition-all duration-200 hover:-translate-y-0.5 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-[0_16px_30px_-12px_rgba(16,185,129,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 disabled:translate-y-0 disabled:opacity-50"
            >
              <CheckCircle className="h-5 w-5" strokeWidth={2} />
              <span>Duyệt</span>
            </button>
            <button
              type="button"
              onClick={onReturnClick}
              disabled={returnPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-amber-300/80 bg-gradient-to-b from-amber-500 to-orange-500 px-5 py-3.5 font-semibold text-white shadow-[0_10px_24px_-12px_rgba(249,115,22,0.45)] ring-1 ring-amber-200/60 transition-all duration-200 hover:-translate-y-0.5 hover:from-amber-600 hover:to-orange-600 hover:shadow-[0_16px_30px_-12px_rgba(249,115,22,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 disabled:translate-y-0 disabled:opacity-50"
            >
              <ArrowLeftRight className="h-5 w-5" strokeWidth={2} />
              <span>Trả PR</span>
            </button>
            <button
              type="button"
              onClick={onRejectClick}
              disabled={rejectPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-rose-300/80 bg-gradient-to-b from-rose-500 to-red-600 px-5 py-3.5 font-semibold text-white shadow-[0_10px_24px_-12px_rgba(244,63,94,0.45)] ring-1 ring-rose-200/60 transition-all duration-200 hover:-translate-y-0.5 hover:from-rose-600 hover:to-red-700 hover:shadow-[0_16px_30px_-12px_rgba(244,63,94,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 disabled:translate-y-0 disabled:opacity-50"
            >
              <XCircle className="h-5 w-5" strokeWidth={2} />
              <span>Từ chối hẳn</span>
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500 sm:px-1">
            Hai nút phản hồi mở cùng một hộp thoại: có thể đổi giữa{' '}
            <strong className="font-medium text-slate-700">trả về chỉnh sửa</strong> (requestor sửa PR, trạng thái{' '}
            <span className="font-mono text-[10px] text-slate-600">BRANCH_MANAGER_RETURNED</span>) và{' '}
            <strong className="font-medium text-slate-700">từ chối hoàn toàn</strong> (dừng tại GĐ chi nhánh,{' '}
            <span className="font-mono text-[10px] text-slate-600">BRANCH_MANAGER_REJECTED</span>).
          </p>
        </div>
      </article>
    );
  },
);
