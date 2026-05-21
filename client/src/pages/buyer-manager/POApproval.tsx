/**
 * PO Approval — Trưởng phòng Mua hàng duyệt hoặc từ chối PO đã submit
 */
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Eye,
  Search,
  Hash,
  Building2,
  User,
  Calendar,
  ClipboardCheck,
  Filter,
} from 'lucide-react';
import { buyerManagerService } from '../../services/buyerManagerService';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import {
  PO_APPROVAL_QUEUE_DEFAULT,
  PO_APPROVAL_QUEUE_OPTIONS,
  PO_APPROVAL_QUEUE_TABLE_TITLE,
  poApprovalQueueEmptyHint,
  poApprovalStatusBadgeClass,
  poApprovalStatusLabel,
  canActOnPOApprovalStatus,
  type POApprovalQueueFilter,
} from '../../constants/poApprovalQueueFilter';
import {
  buyerOutletPageShellClass,
  buyerPageContentClass,
  buyerWorkspaceDataCardClass,
  buyerWorkspaceFiltersCardClass,
  buyerWorkspaceTableTitleBarClass,
  buyerWorkspaceTableViewportClass,
  buyerInteractiveTableClass,
  buyerInteractiveTableBodyClass,
  buyerTableDataRowVisual,
  buyerTableAccentRailClass,
  buyerTableFirstCellInnerClass,
  buyerTableCellWrapClass,
  buyerTableCellWrapFlexClass,
} from '../../constants/buyerLayout';
import { departmentHeadTableCellContentWrapFlexClass } from '../../constants/departmentHeadLayout';
import { saasTableRootClass, saasTableHeadCellClass } from '../../constants/saasDataTable';
import { useToast } from '../../contexts/ToastContext';
import { POApprovalReviewModal } from './POApprovalReviewModal';

const pageRootClass = [buyerOutletPageShellClass, buyerPageContentClass, 'animate-fade-in-right fade-in-right-delay-0'].join(
  ' ',
);

/** Hai lớp bóng — layout-shell §4 + table-filter-toolbar §2 (data card). */
const poApprovalDataCardOuterClass =
  'overflow-visible rounded-2xl shadow-[0_16px_30px_-20px_rgba(15,23,42,0.28)]';

const POApproval = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState<POApprovalQueueFilter>(PO_APPROVAL_QUEUE_DEFAULT);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['buyer-manager-po-pending-approval', queueFilter],
    queryFn: () => buyerManagerService.getPOsPendingApproval({ queue: queueFilter }),
    staleTime: 15000,
  });

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['buyer-manager-po-review', selectedPOId],
    queryFn: () => buyerManagerService.getPODetailForApproval(selectedPOId!),
    enabled: !!selectedPOId,
  });

  const approveMutation = useMutation({
    mutationFn: (poId: string) => buyerManagerService.approvePO(poId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-manager-po-pending-approval'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-po-list'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setSelectedPOId(null);
      showSuccess('PO đã được phê duyệt');
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error || err?.response?.data?.message || 'Duyệt thất bại');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ poId, reason }: { poId: string; reason: string }) =>
      buyerManagerService.rejectPO(poId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-manager-po-pending-approval'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-po-list'] });
      setSelectedPOId(null);
      setRejectReason('');
      showSuccess('PO đã bị từ chối');
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error || err?.response?.data?.message || 'Từ chối thất bại');
    },
  });

  const handleReject = () => {
    if (!selectedPOId || !rejectReason.trim()) {
      showError('Vui lòng nhập lý do từ chối');
      return;
    }
    rejectMutation.mutate({ poId: selectedPOId, reason: rejectReason.trim() });
  };

  const pos = data?.pos ?? [];

  const filteredPos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pos;
    return pos.filter((po: any) => {
      const haystack = [
        po.poNumber,
        po.prCode,
        po.buyer,
        po.supplier?.name,
        po.status === 'CANCEL_REQUESTED' ? 'hủy' : 'mới',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [pos, searchQuery]);

  if (isLoading) {
    return (
      <div className={pageRootClass}>
        <div className="animate-pulse space-y-5">
          <div className="h-[100px] rounded-3xl bg-slate-200/80" />
          <div className="h-14 rounded-2xl border border-slate-200 bg-white shadow-sm" />
          <div className={poApprovalDataCardOuterClass}>
            <div className={`${buyerWorkspaceDataCardClass} mb-0 overflow-hidden`}>
              <div className="h-14 border-b border-slate-100 bg-slate-50" />
              <div className="h-64 bg-slate-100/80" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className={pageRootClass}>
        <div className="w-full min-w-0 py-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-medium text-red-800">Lỗi khi tải danh sách PO chờ duyệt</p>
            <p className="mt-1 text-sm text-red-600">
              {error instanceof Error ? error.message : 'Vui lòng thử lại'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-900 shadow-sm hover:bg-red-50"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageRootClass}>
      <div>
        <RequestorPageHero
          kicker="Trưởng phòng Mua hàng · PO"
          title="Duyệt PO"
          description="Xem và duyệt PO mới hoặc duyệt yêu cầu hủy PO của Buyer"
          Icon={FileText}
          tint="emerald"
          regionLabel="Duyệt PO"
          rightSlot={
            <div className="rounded-xl border border-white/35 bg-white/15 px-4 py-2 text-center backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">PO hiển thị</p>
              <p className="text-2xl font-bold tabular-nums text-white">{filteredPos.length}</p>
              <p className="text-[11px] text-white/80">theo bộ lọc hiện tại</p>
            </div>
          }
        />
      </div>

      <div className="space-y-5 pb-3 pt-3 sm:pb-4 sm:pt-4">
        <article className={buyerWorkspaceFiltersCardClass}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative min-w-0 sm:col-span-2 lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600/80" aria-hidden />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo mã PO, PR, NCC, buyer…"
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100/80 pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Filter className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              <select
                value={queueFilter}
                onChange={(e) => {
                  setQueueFilter(e.target.value as POApprovalQueueFilter);
                  setSelectedPOId(null);
                  setRejectReason('');
                }}
                className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500/20"
                aria-label="Lọc trạng thái PO"
              >
                {PO_APPROVAL_QUEUE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </article>

        <div className={poApprovalDataCardOuterClass}>
          <article className={`${buyerWorkspaceDataCardClass} mb-0 border-emerald-100/45 ring-1 ring-emerald-100/50`}>
            <div
              className={`${buyerWorkspaceTableTitleBarClass} border-emerald-100/50 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/55`}
            >
              <h2 className="flex items-center gap-2.5 text-lg font-bold text-slate-900 sm:text-xl">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25 ring-2 ring-white/80">
                  <ClipboardCheck className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                {PO_APPROVAL_QUEUE_TABLE_TITLE[queueFilter]}
                <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-sm font-bold tabular-nums text-emerald-900 shadow-sm ring-1 ring-emerald-100/80">
                  {filteredPos.length}
                </span>
              </h2>
            </div>
            <div className={buyerWorkspaceTableViewportClass}>
              <table className={`${buyerInteractiveTableClass} ${saasTableRootClass} min-w-[1040px] w-full bg-white`}>
                <thead className="sticky top-0 z-20 border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/95 via-white to-teal-50/70 shadow-[0_1px_0_0_rgba(16,185,129,0.12)] backdrop-blur-sm">
                  <tr>
                    <th className={`px-4 py-3.5 text-left sm:px-6 ${saasTableHeadCellClass} text-emerald-950/90`}>
                      <span className="inline-flex items-center gap-2">
                        <Hash className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden />
                        Mã PO
                      </span>
                    </th>
                    <th className={`px-4 py-3.5 text-left sm:px-6 ${saasTableHeadCellClass} text-emerald-950/90`}>PR</th>
                    <th className={`px-4 py-3.5 text-left sm:px-6 ${saasTableHeadCellClass} text-emerald-950/90`}>
                      <span className="inline-flex items-center gap-2">
                        <Building2 className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden />
                        NCC
                      </span>
                    </th>
                    <th className={`px-4 py-3.5 text-right sm:px-6 ${saasTableHeadCellClass} text-emerald-950/90`}>
                      Tổng tiền
                    </th>
                    <th className={`px-4 py-3.5 text-left sm:px-6 ${saasTableHeadCellClass} text-emerald-950/90`}>
                      <span className="inline-flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden />
                        Buyer
                      </span>
                    </th>
                    <th className={`px-4 py-3.5 text-left sm:px-6 ${saasTableHeadCellClass} text-emerald-950/90`}>
                      {queueFilter === 'pending' ? 'Loại duyệt' : 'Trạng thái'}
                    </th>
                    <th className={`px-4 py-3.5 text-left sm:px-6 ${saasTableHeadCellClass} text-emerald-950/90`}>
                      <span className="inline-flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} aria-hidden />
                        {queueFilter === 'approved'
                          ? 'Ngày duyệt'
                          : queueFilter === 'rejected'
                            ? 'Ngày từ chối'
                            : 'Ngày gửi'}
                      </span>
                    </th>
                    <th className={`px-4 py-3.5 text-center sm:px-6 ${saasTableHeadCellClass} text-emerald-950/90`}>
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className={buyerInteractiveTableBodyClass}>
                  {filteredPos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-14 text-center text-sm font-medium text-slate-500">
                        {poApprovalQueueEmptyHint(queueFilter, searchQuery)}
                      </td>
                    </tr>
                  ) : (
                    filteredPos.map((po: any, index: number) => (
                      <tr
                        key={po.id}
                        className={`group cursor-pointer ${buyerTableDataRowVisual(index)}`}
                        onClick={() => setSelectedPOId(po.id)}
                      >
                        <td className="relative whitespace-nowrap px-4 py-3 sm:px-6">
                          <div aria-hidden className={buyerTableAccentRailClass} />
                          <div className={`${buyerTableFirstCellInnerClass} ${buyerTableCellWrapClass}`}>
                            <span className="font-mono text-sm font-bold text-emerald-800">{po.poNumber}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 sm:px-6">
                          <div className={buyerTableCellWrapClass}>{po.prCode ?? '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 sm:px-6">
                          <div className={buyerTableCellWrapClass}>{po.supplier?.name ?? '—'}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-800 sm:px-6">
                          <div className={`${buyerTableCellWrapClass} tabular-nums font-semibold`}>
                            {po.totalAmount != null
                              ? `${Number(po.totalAmount).toLocaleString('vi-VN')} ${po.currency ?? 'VND'}`
                              : '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700 sm:px-6">
                          <div className={buyerTableCellWrapClass}>{po.buyer ?? '—'}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 sm:px-6">
                          <div className={buyerTableCellWrapClass}>
                            {queueFilter === 'pending' ? (
                              po.status === 'CANCEL_REQUESTED' ? (
                                <span className="inline-flex rounded-full border border-rose-200/60 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 ring-1 ring-rose-100/80">
                                  Hủy PO
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full border border-amber-200/60 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-100/80">
                                  Duyệt PO mới
                                </span>
                              )
                            ) : (
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ring-1 ${poApprovalStatusBadgeClass(po.status)}`}
                              >
                                {poApprovalStatusLabel(po.status)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 sm:px-6">
                          <div className={buyerTableCellWrapClass}>
                            {(() => {
                              const dateStr =
                                queueFilter === 'approved'
                                  ? po.approvedAt
                                  : queueFilter === 'rejected'
                                    ? po.rejectedAt
                                    : po.submittedAt;
                              return dateStr ? new Date(dateStr).toLocaleDateString('vi-VN') : '—';
                            })()}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center sm:px-6">
                          <div
                            className={`${buyerTableCellWrapClass} ${departmentHeadTableCellContentWrapFlexClass} ${buyerTableCellWrapFlexClass} justify-center`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPOId(po.id);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100"
                            >
                              <Eye className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                              {canActOnPOApprovalStatus(po.status) ? 'Review' : 'Xem'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </div>

      {selectedPOId &&
        createPortal(
          <div
            className="modal-popup-overlay fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm sm:p-6"
            onClick={() => {
              setSelectedPOId(null);
              setRejectReason('');
            }}
          >
            <POApprovalReviewModal
              detail={detail as any}
              loading={loadingDetail}
              canAct={detail?.canAct ?? canActOnPOApprovalStatus(detail?.status ?? '')}
              rejectReason={rejectReason}
              onRejectReasonChange={setRejectReason}
              onClose={() => {
                setSelectedPOId(null);
                setRejectReason('');
              }}
              onReject={handleReject}
              onApprove={() => approveMutation.mutate(selectedPOId)}
              rejectPending={rejectMutation.isPending}
              approvePending={approveMutation.isPending}
            />
          </div>,
          document.body
        )}
    </div>
  );
};

export default POApproval;
