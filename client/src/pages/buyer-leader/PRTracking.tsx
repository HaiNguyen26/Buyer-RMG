import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  RefreshCw,
  Eye,
  Package,
  User,
  Users,
  FileQuestion,
  ClipboardCheck,
  ClipboardList,
  BadgeCheck,
  Sparkles,
  DollarSign,
  Activity,
  Hash,
  Send,
  XCircle,
  CircleDot,
} from 'lucide-react';
import { buyerLeaderService } from '../../services/buyerLeaderService';
import { PRSalesOrderLine } from '../../components/PRSalesOrderLine';
import { AppModal } from '../../components/AppModal';
import { BuyerLeaderPageHero } from '../../components/BuyerLeaderPageHero';
import { buyerLeaderPageStackClass } from '../../constants/buyerLeaderLayout';

// ─── Item status labels ─────────────────────────────────────────────────────
const ITEM_STATUS: Record<string, string> = {
  NEW: 'Mới',
  ASSIGNED: 'Đã phân công',
  RFQ_CREATED: 'Đã tạo RFQ',
  RFQ_SUBMITTED: 'Đã gửi RFQ',
  READY_FOR_REVIEW: 'Sẵn sàng so sánh',
  SUPPLIER_SELECTED: 'Đã chọn NCC',
};

const PR_STATUS_LABEL: Record<string, string> = {
  BUYER_LEADER_PENDING: 'Chờ phân công',
  BRANCH_MANAGER_APPROVED: 'Đã duyệt',
  ASSIGNED_TO_BUYER: 'Đã phân công',
  RFQ_IN_PROGRESS: 'Đang hỏi giá',
  QUOTATION_RECEIVED: 'Đã nhận báo giá',
  SUPPLIER_SELECTED: 'Đã chọn NCC',
  BUDGET_EXCEPTION: 'Vượt ngân sách',
  BUDGET_APPROVED: 'Đã duyệt vượt NS',
  BUDGET_REJECTED: 'Từ chối vượt NS',
};

const PR_STATUS_BADGE: Record<string, { Icon: LucideIcon; className: string }> = {
  BUYER_LEADER_PENDING: {
    Icon: ClipboardList,
    className:
      'bg-slate-100 text-slate-800 ring-slate-200/90 border-slate-200/80',
  },
  BRANCH_MANAGER_APPROVED: {
    Icon: CheckCircle2,
    className: 'bg-teal-50 text-teal-800 ring-teal-200/70 border-teal-200/60',
  },
  ASSIGNED_TO_BUYER: {
    Icon: User,
    className: 'bg-cyan-50 text-cyan-900 ring-cyan-200/70 border-cyan-200/60',
  },
  RFQ_IN_PROGRESS: {
    Icon: FileQuestion,
    className: 'bg-indigo-50 text-indigo-800 ring-indigo-200/80 border-indigo-200/70',
  },
  QUOTATION_RECEIVED: {
    Icon: Sparkles,
    className: 'bg-violet-50 text-violet-800 ring-violet-200/75 border-violet-200/65',
  },
  SUPPLIER_SELECTED: {
    Icon: BadgeCheck,
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70 border-emerald-200/60',
  },
  BUDGET_EXCEPTION: {
    Icon: AlertTriangle,
    className: 'bg-rose-50 text-rose-800 ring-rose-200/75 border-rose-200/65',
  },
  BUDGET_APPROVED: {
    Icon: CheckCircle2,
    className: 'bg-amber-50 text-amber-900 ring-amber-200/80 border-amber-200/65',
  },
  BUDGET_REJECTED: {
    Icon: XCircle,
    className: 'bg-red-50 text-red-800 ring-red-200/75 border-red-200/65',
  },
};

const prStatusBadgeFallback: { Icon: LucideIcon; className: string } = {
  Icon: CircleDot,
  className: 'bg-slate-50 text-slate-700 ring-slate-200/80 border-slate-200/70',
};

const fmtAmount = (amount: number | null, currency = 'VND') => {
  if (amount == null || !Number.isFinite(Number(amount))) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(Number(amount));
};

/** Khung cuộn bảng item trong modal chi tiết — ~10 hàng dữ liệu (h-14) + header sticky */
const DETAIL_MODAL_ITEM_ROWS_VISIBLE = 10;
const detailModalItemsTableMaxHeight = `calc(2.75rem + ${DETAIL_MODAL_ITEM_ROWS_VISIBLE} * 3.5rem)`;

/** Bảng danh sách PR — ~10 hàng (h-[72px] = 4.5rem) + thead sticky một dòng */
const LIST_TABLE_ROWS_VISIBLE = 10;
const listTableMaxHeight = `calc(3.5rem + ${LIST_TABLE_ROWS_VISIBLE} * 4.5rem)`;

export default function PRTracking() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: listData, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['buyer-leader-pr-tracking'],
    queryFn: () => buyerLeaderService.getPRTrackingList(),
    staleTime: 30000,
  });

  const { data: detailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['buyer-leader-pr-tracking-detail', selectedPRId],
    queryFn: () => buyerLeaderService.getPRTrackingDetail(selectedPRId!),
    enabled: !!selectedPRId && detailOpen,
  });

  const prs: any[] = listData?.prs ?? [];
  const filtered = prs.filter(
    (p) =>
      !searchQuery ||
      (p.prNumber && p.prNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.salesOrder?.label && p.salesOrder.label.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const openDetail = (prId: string) => {
    setSelectedPRId(prId);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedPRId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">
        Lỗi tải danh sách. Vui lòng thử lại.
      </div>
    );
  }

  return (
    <div className={`w-full min-w-0 animate-fade-in-right fade-in-right-delay-0 ${buyerLeaderPageStackClass}`}>
      <div className="space-y-4 px-2 pt-3 sm:px-3 sm:pt-4 md:px-4">
      <BuyerLeaderPageHero
        kicker="Buyer Leader · Theo dõi"
        title="Theo dõi PR & tiến độ RFQ"
        description="Giám sát tiến độ theo từng item — ai đang xử lý, RFQ nào, trạng thái đến đâu"
        Icon={CheckCircle2}
        tint="graphite"
        regionLabel="Theo dõi PR và RFQ"
        rightSlot={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <input
                type="text"
                placeholder="Tìm mã PR..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 rounded-xl border border-white/25 bg-white/10 py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/45 focus:border-white/35 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-xl border border-white/25 bg-white/10 p-2 text-white transition-colors hover:bg-white/15 disabled:opacity-50"
              title="Làm mới"
            >
              <RefreshCw className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
      />

      {/* Table: Danh sách PR — card nổi + màu / icon theo SaaS */}
      <div className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_12px_40px_-14px_rgba(15,23,42,0.2),0_4px_20px_-4px_rgba(79,70,229,0.12)] ring-1 ring-indigo-100/50">
        <div
          className="min-h-0 overflow-auto [scrollbar-width:thin]"
          style={{ maxHeight: listTableMaxHeight }}
        >
          <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 border-b border-indigo-100/90 bg-gradient-to-r from-[#EEF2FF] via-[#F5F3FF]/90 to-[#FAFBFF] backdrop-blur-sm shadow-[0_1px_0_0_rgba(99,102,241,0.12)]">
              <tr>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-900/85">
                  <span className="inline-flex items-center gap-2">
                    <Hash className="h-4 w-4 shrink-0 text-indigo-500" strokeWidth={2} />
                    Mã PR
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-900/85">
                  <span className="inline-flex items-center gap-2">
                    <Package className="h-4 w-4 shrink-0 text-sky-600" strokeWidth={2} />
                    Tổng item
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-900/85">
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0 text-violet-600" strokeWidth={2} />
                    Số buyer
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-900/85">
                  <span className="inline-flex items-center gap-2">
                    <Activity className="h-4 w-4 shrink-0 text-fuchsia-600" strokeWidth={2} />
                    % Phase 2
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-900/85">
                  <span className="inline-flex items-center gap-2">
                    <FileQuestion className="h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
                    Chưa tạo RFQ
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-900/85">
                  <span className="inline-flex items-center gap-2">
                    <Send className="h-4 w-4 shrink-0 text-blue-600" strokeWidth={2} />
                    Đã submit
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-900/85">
                  <span className="inline-flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} />
                    Đã chọn NCC
                  </span>
                </th>
                <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-indigo-900/85">
                  <span className="inline-flex items-center justify-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
                    Vượt NS
                  </span>
                </th>
                <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-indigo-900/85">
                  <span className="inline-flex items-center justify-center gap-2">
                    <Clock className="h-4 w-4 shrink-0 text-rose-600" strokeWidth={2} />
                    Quá hạn
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-900/85">
                  <span className="inline-flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 shrink-0 text-indigo-600" strokeWidth={2} />
                    Trạng thái PR
                  </span>
                </th>
                <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-indigo-900/85">
                  <span className="inline-flex items-center justify-center gap-2">
                    <Eye className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={2} />
                    Thao tác
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                    Chưa có PR nào có phân công để theo dõi
                  </td>
                </tr>
              ) : (
                filtered.map((p, index) => (
                  <tr
                    key={p.prId}
                    className={`group h-[72px] border-b border-slate-100 transition-all duration-300 ease-out hover:[&>td]:bg-indigo-50/40 ${
                      index % 2 === 0 ? '[&>td]:bg-white' : '[&>td]:bg-[#FBFCFE]'
                    }`}
                  >
                    <td className="relative px-4 py-3 align-top max-w-[220px] rounded-l-2xl">
                      <div
                        aria-hidden
                        className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-indigo-500 opacity-0 transition-all duration-300 group-hover:opacity-100"
                      />
                      <div className="block min-w-0 transition-transform duration-300 ease-out group-hover:translate-x-1">
                        <div className="font-medium text-slate-900">{p.prNumber}</div>
                        <PRSalesOrderLine salesOrder={p.salesOrder} className="mt-1" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="block min-w-0 transition-transform duration-300 ease-out group-hover:translate-x-1">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100/90 bg-gradient-to-br from-indigo-50 to-sky-50/60 px-2.5 py-1 text-sm font-bold tabular-nums text-indigo-900 shadow-sm shadow-indigo-100/50 ring-1 ring-white/70">
                          <Package className="h-3.5 w-3.5 shrink-0 text-indigo-500" strokeWidth={2} />
                          {p.totalItems}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="block min-w-0 transition-transform duration-300 ease-out group-hover:translate-x-1">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-100/90 bg-gradient-to-br from-violet-50 to-fuchsia-50/50 px-2.5 py-1 text-sm font-bold tabular-nums text-violet-950 shadow-sm ring-1 ring-white/70">
                          <Users className="h-3.5 w-3.5 shrink-0 text-violet-600" strokeWidth={2} />
                          {p.buyerCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="block min-w-0 max-w-[7.5rem] transition-transform duration-300 ease-out group-hover:translate-x-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-sm font-black tabular-nums ${
                              p.phase2Percent >= 100 ? 'text-emerald-600' : 'text-indigo-600'
                            }`}
                          >
                            {p.phase2Percent}%
                          </span>
                          <Activity className="h-3.5 w-3.5 shrink-0 text-fuchsia-400/90" strokeWidth={2} />
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/60">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 shadow-sm shadow-indigo-300/40 transition-[width]"
                            style={{ width: `${Math.min(100, Math.max(0, Number(p.phase2Percent) || 0))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="block min-w-0 transition-transform duration-300 ease-out group-hover:translate-x-1">
                        {p.itemsNotInRFQ > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200/80 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-100/80">
                            <FileQuestion className="h-3.5 w-3.5 text-amber-600" strokeWidth={2} />
                            {p.itemsNotInRFQ}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
                            0
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="block min-w-0 transition-transform duration-300 ease-out group-hover:translate-x-1">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-blue-100/90 bg-blue-50/90 px-2 py-1 text-xs font-bold tabular-nums text-blue-900 ring-1 ring-white/80">
                          <Send className="h-3.5 w-3.5 text-blue-600" strokeWidth={2} />
                          {p.itemsSubmitted}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="block min-w-0 transition-transform duration-300 ease-out group-hover:translate-x-1">
                        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-100/90 bg-emerald-50/90 px-2 py-1 text-xs font-bold tabular-nums text-emerald-900 ring-1 ring-white/80">
                          <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />
                          {p.itemsSupplierSelected}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="block min-w-0 transition-transform duration-300 ease-out group-hover:translate-x-1">
                        {p.overBudget ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 shadow-sm ring-1 ring-amber-100/60">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" strokeWidth={2} /> Có
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/90" strokeWidth={2} />
                            Không
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="block min-w-0 transition-transform duration-300 ease-out group-hover:translate-x-1">
                        {p.overdue ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200/80 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-900 shadow-sm ring-1 ring-rose-100/60">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-rose-600" strokeWidth={2} /> Có
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/90" strokeWidth={2} />
                            Không
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="block min-w-0 transition-transform duration-300 ease-out group-hover:translate-x-1">
                        {(() => {
                          const preset = PR_STATUS_BADGE[p.prStatus] ?? prStatusBadgeFallback;
                          const Icon = preset.Icon;
                          return (
                            <span
                              className={`inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm ring-1 ${preset.className}`}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} />
                              {PR_STATUS_LABEL[p.prStatus] ?? p.prStatus}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center rounded-r-2xl">
                      <div className="flex items-center justify-center transition-transform duration-300 ease-out group-hover:translate-x-1">
                        <button
                          type="button"
                          onClick={() => openDetail(p.prId)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200/90 bg-gradient-to-b from-white to-indigo-50/90 px-3 py-2 text-xs font-bold text-indigo-800 shadow-md shadow-indigo-200/35 ring-1 ring-white/90 transition hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-200/45 motion-safe:hover:-translate-y-0.5"
                        >
                          <Eye className="h-4 w-4 shrink-0 text-indigo-600" strokeWidth={2} /> Chi tiết
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > LIST_TABLE_ROWS_VISIBLE ? (
          <p className="border-t border-indigo-100/80 bg-indigo-50/50 px-4 py-2 text-[11px] leading-relaxed text-slate-600">
            Hiển thị tối đa {LIST_TABLE_ROWS_VISIBLE} PR trên một khung — còn {filtered.length - LIST_TABLE_ROWS_VISIBLE} dòng · cuộn dọc
            trong bảng để xem tiếp.
          </p>
        ) : null}
      </div>
      </div>

      {/* Modal chi tiết — AppModal: portal body, căn giữa viewport, bo tròn, max-height an toàn */}
      <AppModal
        open={detailOpen && !!selectedPRId}
        onClose={closeDetail}
        size="3xl"
        zIndexClass="z-[200]"
        description="Chi tiết theo dõi PR và tiến độ RFQ theo từng item"
        headerIcon={<Eye className="h-5 w-5 text-indigo-600" strokeWidth={2} />}
        title="Chi tiết theo item – Tiến độ RFQ"
        subtitle={
          detailData
            ? `Mã PR: ${detailData.prNumber}`
            : isLoadingDetail
              ? 'Đang tải…'
              : undefined
        }
      >
        {detailData?.overBudget && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Vượt ngân sách
            </span>
          </div>
        )}
        {detailData && (
          <div className="mb-5 border-b border-slate-100 pb-4">
            <PRSalesOrderLine salesOrder={(detailData as any).salesOrder} showWhenEmpty />
          </div>
        )}

        {isLoadingDetail ? (
          <div className="flex justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          </div>
        ) : detailData ? (
          <div className="space-y-5">
            <div className="min-w-0 space-y-5">
              {(() => {
                const supplierSelectedPercent = Number(detailData.progress?.supplierSelected ?? 0);
                const readyForReviewPercent = Number(detailData.progress?.readyForReview ?? 0);
                const isDanger = Boolean(detailData.overBudget);
                const isWarning = !isDanger && supplierSelectedPercent < 100 && readyForReviewPercent < 100;
                const slaTone = isDanger ? 'rose' : isWarning ? 'amber' : 'indigo';
                const slaLabel = isDanger ? 'Nguy hiểm' : isWarning ? 'Cảnh báo' : 'Bình thường';
                const toneClass =
                  slaTone === 'rose'
                    ? 'from-rose-500 to-red-600 shadow-rose-500/20'
                    : slaTone === 'amber'
                      ? 'from-amber-500 to-orange-500 shadow-amber-500/20'
                      : 'from-indigo-500 to-indigo-600 shadow-indigo-500/20';

                const stages = [
                  { key: 'rfq', label: 'Đã tạo RFQ', done: Number(detailData.progress?.rfqCreated ?? 0) >= 100 },
                  { key: 'review', label: 'Sẵn sàng so sánh', done: Number(detailData.progress?.readyForReview ?? 0) >= 100 },
                  { key: 'supplier', label: 'Đã chọn NCC', done: Number(detailData.progress?.supplierSelected ?? 0) >= 100 },
                ];
                const currentIndex = stages.findIndex((s) => !s.done);

                return (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/90 bg-[linear-gradient(145deg,rgba(236,253,245,0.95)_0%,rgba(255,255,255,0.99)_42%,rgba(209,250,229,0.55)_100%)] p-4 pb-5 shadow-md shadow-emerald-600/10 ring-1 ring-emerald-100/80">
                        <div className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full bg-emerald-400/20" aria-hidden />
                        <div className="pointer-events-none absolute -right-8 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-2xl" aria-hidden />
                        <div className="relative z-[1] min-w-0 pr-14">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Giá trị PR requestor đề xuất</p>
                          <p className="mt-1 text-xl font-black tabular-nums tracking-tight text-emerald-950">
                            {fmtAmount(detailData.totalAmount, detailData.currency)}
                          </p>
                          <p className="mt-2 text-xs leading-snug text-emerald-900/75">
                            Baseline ngân sách để đối chiếu chọn NCC
                          </p>
                        </div>
                        <DollarSign
                          className="pointer-events-none absolute bottom-3 right-3 z-0 h-9 w-9 text-emerald-600/18"
                          strokeWidth={1.35}
                          aria-hidden
                        />
                      </div>
                      <div className="relative overflow-hidden rounded-2xl border border-violet-200/90 bg-[linear-gradient(145deg,rgba(245,243,255,0.95)_0%,rgba(255,255,255,0.99)_42%,rgba(237,233,254,0.55)_100%)] p-4 pb-5 shadow-md shadow-violet-600/10 ring-1 ring-violet-100/80">
                        <div className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full bg-violet-400/20" aria-hidden />
                        <div className="pointer-events-none absolute -right-8 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-violet-500/10 blur-2xl" aria-hidden />
                        <div className="relative z-[1] min-w-0 pr-14">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">Tổng item theo dõi</p>
                          <p className="mt-1 text-xl font-black tabular-nums tracking-tight text-violet-950">
                            {detailData.items?.length ?? 0} item
                          </p>
                          <p className="mt-2 text-xs leading-snug text-violet-900/75">
                            Theo dõi xuyên suốt từ tạo RFQ đến chọn NCC
                          </p>
                        </div>
                        <Package
                          className="pointer-events-none absolute bottom-3 right-3 z-0 h-9 w-9 text-violet-600/18"
                          strokeWidth={1.35}
                          aria-hidden
                        />
                      </div>
                    </div>

                    <div
                      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r p-5 text-white shadow-lg ring-1 ring-white/10 sm:bg-gradient-to-br ${toneClass}`}
                    >
                      <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/12 sm:h-44 sm:w-44" aria-hidden />
                      <div className="pointer-events-none absolute right-2 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full bg-white/8 blur-sm sm:right-8" aria-hidden />
                      <div className="relative z-[1] max-w-[min(100%,28rem)] pr-16 sm:pr-20">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/90">SLA Tracker</p>
                        <p className="mt-1 text-2xl font-black leading-tight tracking-tight">{slaLabel}</p>
                        <p className="mt-2 text-sm text-white/90">
                          {supplierSelectedPercent}% hoàn tất chọn NCC · {readyForReviewPercent}% sẵn sàng so sánh
                        </p>
                      </div>
                      <Clock
                        className="pointer-events-none absolute bottom-4 right-4 z-0 h-10 w-10 text-white/22 sm:h-12 sm:w-12"
                        strokeWidth={1.35}
                        aria-hidden
                      />
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="mb-3 text-sm font-semibold text-slate-700">Timeline xử lý</p>
                      <ol className="space-y-1">
                        {stages.map((stage, idx) => {
                          const isCurrent = idx === currentIndex && currentIndex >= 0;
                          const isLast = idx === stages.length - 1;
                          
                          return (
                            <li key={stage.key} className="group flex gap-2.5 cursor-pointer transition-all">
                              <div className="flex w-8 shrink-0 flex-col items-center">
                                {idx > 0 ? (
                                  <div 
                                    className={`relative h-2 w-1 overflow-hidden rounded-full transition-all duration-300 ${
                                      stage.done 
                                        ? 'bg-gradient-to-b from-indigo-500 to-cyan-400 shadow-sm shadow-cyan-300' 
                                        : 'bg-slate-200/80'
                                    }`}
                                  >
                                    {stage.done && (
                                      <>
                                        {/* Flowing Light */}
                                        <div 
                                          className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-transparent animate-linear-flow"
                                          style={{ backgroundSize: '100% 200%' }}
                                        />
                                        {/* Glow */}
                                        <div className="absolute inset-0 animate-path-glow" />
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <div className="h-2" />
                                )}
                                
                                <div
                                  className={`relative z-[1] flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white transition-all duration-200 group-hover:scale-110 ${
                                    stage.done
                                      ? 'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/40'
                                      : isCurrent
                                        ? 'border-indigo-500 text-indigo-600 shadow-md shadow-indigo-500/20 ring-4 ring-indigo-100 animate-halo-glow'
                                        : 'border-slate-200 text-slate-300'
                                  }`}
                                >
                                  {stage.done ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                                  ) : (
                                    <Clock 
                                      className={`${isCurrent ? 'animate-[spin_10s_linear_infinite]' : ''} h-3.5 w-3.5`} 
                                      strokeWidth={2} 
                                    />
                                  )}
                                </div>
                                
                                {!isLast && (
                                  <div 
                                    className={`relative mt-0.5 h-5 w-1 overflow-hidden rounded-full transition-all duration-300 ${
                                      stage.done 
                                        ? 'bg-gradient-to-b from-indigo-500 to-cyan-400 shadow-sm shadow-cyan-300' 
                                        : 'bg-slate-200/80'
                                    }`}
                                  >
                                    {stage.done && (
                                      <>
                                        {/* Flowing Light */}
                                        <div 
                                          className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-transparent animate-linear-flow"
                                          style={{ backgroundSize: '100% 200%' }}
                                        />
                                        {/* Glow */}
                                        <div className="absolute inset-0 animate-path-glow" />
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                                
                              <div className={`flex-1 py-1 group-hover:translate-x-1 transition-transform duration-200 ${!isLast ? 'pb-2.5' : ''}`}>
                                <div
                                  className={`rounded-3xl px-3 py-2 text-sm font-semibold backdrop-blur-sm transition-all duration-300 ${
                                    isCurrent
                                      ? 'border border-indigo-200/70 bg-gradient-to-br from-indigo-50/90 to-violet-50/50 shadow-md text-indigo-700'
                                      : stage.done  
                                        ? 'border border-transparent text-emerald-700'
                                        : 'border border-transparent text-slate-500 opacity-[0.72]'
                                  }`}
                                >
                                  {stage.label}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </div>

                    <div className="overflow-hidden rounded-[28px] border border-black/5 shadow-[0_8px_14px_-8px_rgba(0,0,0,0.15)]">
                      <div
                        className="min-h-0 overflow-auto [scrollbar-width:thin]"
                        style={{ maxHeight: detailModalItemsTableMaxHeight }}
                      >
                      <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
                        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-[#F8FAFC]">
                          <tr>
                            <th className="w-12 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">STT</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                              <span className="inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-indigo-600" />Item</span>
                            </th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                              <span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-cyan-600" />Buyer</span>
                            </th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                              <span className="inline-flex items-center gap-1.5"><FileQuestion className="h-3.5 w-3.5 text-violet-600" />RFQ</span>
                            </th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5 text-blue-600" />Trạng thái</span>
                            </th>
                            <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">Đã có báo giá</th>
                            <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                              <span className="inline-flex items-center justify-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />Đã chọn NCC</span>
                            </th>
                            <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                              <span className="inline-flex items-center justify-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-amber-600" />Vượt giá</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(detailData.items ?? []).map((row: any, index: number) => (
                            <tr
                              key={row.itemId}
                              className={`h-14 border-b border-slate-100 transition-all duration-200 ease-out hover:bg-blue-50/40 hover:shadow-[inset_4px_0_0_0_#4F46E5] ${
                                index % 2 === 0 ? 'bg-white' : 'bg-[#FBFCFE]'
                              }`}
                            >
                              <td className="px-3 py-2 text-xs text-slate-600">{row.lineNo ?? '-'}</td>
                              <td className="px-3 py-2">
                                <div className="max-w-[280px]">
                                  <span className="line-clamp-1 text-sm font-semibold text-slate-900">{row.description ?? '-'}</span>
                                  {row.partNo && <span className="block truncate text-[11px] text-slate-500">PN: {row.partNo}</span>}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-sm text-slate-700">{row.buyer ?? '-'}</td>
                              <td className="px-3 py-2 text-sm text-slate-700">{row.rfqNumber ?? '-'}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                                  {ITEM_STATUS[row.status] ?? row.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                {row.hasQuotation ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                    {row.quotationCount} NCC
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {row.supplierSelected ? (
                                  <CheckCircle2 className="mx-auto h-5 w-5 text-green-500" />
                                ) : (
                                  <span className="text-xs text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {row.overBudget ? (
                                  <AlertTriangle className="mx-auto h-5 w-5 text-amber-500" />
                                ) : (
                                  <span className="text-xs text-slate-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                      {(detailData.items?.length ?? 0) > DETAIL_MODAL_ITEM_ROWS_VISIBLE ? (
                        <p className="border-t border-slate-100 bg-slate-50/90 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
                          Khung hiển thị tối đa {DETAIL_MODAL_ITEM_ROWS_VISIBLE} dòng ·{' '}
                          {(detailData.items?.length ?? 0) - DETAIL_MODAL_ITEM_ROWS_VISIBLE} dòng còn lại — cuộn trong bảng để xem tiếp.
                        </p>
                      ) : null}
                    </div>
                  </>
                );
              })()}
            </div>

            <aside className="w-full">
              <div className="overflow-hidden rounded-2xl bg-slate-900 p-4 text-white shadow-xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-300">SLA Summary</p>
                <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300">Mã PR</span>
                    <span className="font-semibold text-white">{detailData.prNumber}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300">Tổng item</span>
                    <span className="font-semibold text-white">{detailData.items?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300">Đã chọn NCC</span>
                    <span className="font-semibold text-emerald-300">{detailData.progress?.supplierSelected ?? 0}%</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300">Vượt ngân sách</span>
                    <span className={`font-semibold ${detailData.overBudget ? 'text-rose-300' : 'text-slate-100'}`}>
                      {detailData.overBudget ? 'Có' : 'Không'}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <p className="py-8 text-center text-slate-500">Không tải được chi tiết</p>
        )}
      </AppModal>
    </div>
  );
}
