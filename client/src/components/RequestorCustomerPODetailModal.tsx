import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import type { CustomerPODetail } from '../services/requestorService';
import {
  Briefcase,
  Building2,
  DollarSign,
  ExternalLink,
  FileText,
  Hash,
  Info,
  Layers,
  ListOrdered,
  Package,
  Receipt,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';

export type RequestorCustomerPODetailModalProps = {
  open: boolean;
  onClose: () => void;
  data: CustomerPODetail | null | undefined;
  resolvePrPath?: (prId: string) => string;
};

function fmtMoney(n: number, currency: string) {
  return `${n.toLocaleString('vi-VN')} ${currency}`;
}

function salesOwnerName(owner: CustomerPODetail['salesOwner']): string {
  if (!owner) return '—';
  if (typeof owner === 'object' && owner && 'name' in owner) return owner.name;
  return String(owner);
}

function prStatusChipClass(status: string) {
  const s = status.toUpperCase();
  if (s.includes('CLOSED') || s.includes('DONE') || s.includes('PAYMENT'))
    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (s.includes('REJECT')) return 'bg-rose-50 text-rose-800 border-rose-200';
  if (s.includes('RETURN') || s.includes('NEED_MORE'))
    return 'bg-amber-50 text-amber-900 border-amber-200';
  if (s.includes('PENDING') || s.includes('DRAFT'))
    return 'bg-slate-100 text-slate-700 border-slate-200';
  if (s.includes('APPROVED') || s.includes('ASSIGNED') || s.includes('BUYER'))
    return 'bg-sky-50 text-sky-900 border-sky-200';
  return 'bg-violet-50 text-violet-900 border-violet-200';
}

/**
 * Popup chi tiết PO khách hàng / SO khi chọn trong form tạo PR (Requestor).
 */
export function RequestorCustomerPODetailModal({
  open,
  onClose,
  data,
  resolvePrPath = (prId) => `/dashboard/requestor/pr/${prId}`,
}: RequestorCustomerPODetailModalProps) {
  const navigate = useNavigate();

  if (!open || !data) return null;

  const contractValue = Number(data.contractValue);
  const totalProcurementCost = Number(data.totalProcurementCost ?? 0);
  const remainingBudget = Number(
    data.remainingBudget ?? Math.max(0, contractValue - totalProcurementCost)
  );
  const totalPRs = data.totalPRs ?? data.purchaseRequests?.length ?? 0;
  const purchaseRequests = data.purchaseRequests ?? [];
  const currency = data.currency || 'VND';
  const usagePct =
    contractValue > 0
      ? Math.min(100, Math.round((totalProcurementCost / contractValue) * 100))
      : 0;

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
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600">
              Customer PO
            </p>
            <h2 className="mt-0.5 font-mono text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {data.poNumber}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {data.customer?.name ? (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Building2 className="h-3 w-3" />
                  {data.customer.name}
                </span>
              ) : null}
              {data.projectName ? (
                <span className="text-xs text-slate-400">{data.projectName}</span>
              ) : null}
              {contractValue > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  <DollarSign className="h-3 w-3" strokeWidth={2} />
                  Đã dùng {usagePct}%
                </span>
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
          <div className="flex flex-col gap-0 md:flex-row md:min-h-full">
            {/* Main column */}
            <div className="min-w-0 flex-[3] space-y-4 p-4 sm:p-5 md:border-r md:border-slate-200/60">
              {/* Insight cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-md shadow-blue-500/20">
                  <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100">
                    Giá trị PO
                  </p>
                  <p className="mt-1 text-xl font-black tabular-nums leading-tight">
                    {fmtMoney(contractValue, currency)}
                  </p>
                  <DollarSign
                    className="absolute bottom-3 right-3 h-6 w-6 text-white/20"
                    strokeWidth={1.5}
                  />
                </div>

                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white shadow-md shadow-violet-500/20">
                  <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-100">
                    Tổng PR
                  </p>
                  <p className="mt-1 text-xl font-black tabular-nums leading-tight">
                    {fmtMoney(totalProcurementCost, currency)}
                  </p>
                  <Receipt
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
                    {fmtMoney(remainingBudget, currency)}
                  </p>
                  <Wallet
                    className="absolute bottom-3 right-3 h-6 w-6 text-white/20"
                    strokeWidth={1.5}
                  />
                </div>
              </div>

              {/* PR list */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                  <ListOrdered className="h-4 w-4 text-slate-500" strokeWidth={2} />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    PR liên kết ({purchaseRequests.length})
                  </h3>
                </div>
                {purchaseRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-slate-200/80">
                      <ListOrdered className="h-7 w-7" strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-medium text-slate-700">Chưa có PR nào gắn PO này</p>
                    <p className="mt-1 max-w-xs text-xs text-slate-500">
                      Khi có PR được liên kết, danh sách sẽ hiển thị tại đây.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-auto [scrollbar-width:thin]">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-2.5 text-left">Mã PR</th>
                          <th className="px-4 py-2.5 text-right">Tổng tiền</th>
                          <th className="px-4 py-2.5 text-left">Trạng thái</th>
                          <th className="px-4 py-2.5 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {purchaseRequests.map((pr, idx) => (
                          <tr
                            key={pr.id}
                            className={`transition-colors hover:bg-amber-50/40 ${idx % 2 === 1 ? 'bg-slate-50/40' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <span className="font-mono text-sm font-bold text-slate-900">
                                {pr.prNumber}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="tabular-nums font-semibold text-slate-800">
                                {(pr.totalAmount ?? 0).toLocaleString('vi-VN')}
                              </span>
                              <span className="ml-1 text-xs text-slate-400">{currency}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex max-w-[240px] truncate rounded-lg border px-2.5 py-1 text-xs font-semibold ${prStatusChipClass(pr.status)}`}
                              >
                                {pr.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  navigate(resolvePrPath(pr.id));
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200/80 bg-violet-50/50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-all hover:border-violet-300 hover:bg-violet-100/80"
                              >
                                Xem PR
                                <ExternalLink className="h-3.5 w-3.5 opacity-80" strokeWidth={2} />
                              </button>
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
                  <div className="flex items-center justify-between gap-2 py-3">
                    <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                      <Hash className="h-3 w-3" strokeWidth={2} />
                      Mã SO
                    </dt>
                    <dd className="font-mono text-sm font-semibold text-white">
                      {data.salesPONumber}
                    </dd>
                  </div>
                  {data.projectCode ? (
                    <div className="flex items-center justify-between gap-2 py-3">
                      <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                        <FileText className="h-3 w-3" strokeWidth={2} />
                        Mã dự án
                      </dt>
                      <dd className="font-semibold text-white">{data.projectCode}</dd>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 py-3">
                    <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                      <UserRound className="h-3 w-3" strokeWidth={2} />
                      Sales
                    </dt>
                    <dd className="font-semibold text-white">{salesOwnerName(data.salesOwner)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 py-3">
                    <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                      <Package className="h-3 w-3" strokeWidth={2} />
                      Số PR
                    </dt>
                    <dd className="font-bold tabular-nums text-white">{totalPRs}</dd>
                  </div>
                </dl>
              </div>

              {/* Actions */}
              <div className="mt-auto flex flex-col gap-2">
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
        </div>
      </div>
    </div>,
    document.body
  );
}

export default RequestorCustomerPODetailModal;
