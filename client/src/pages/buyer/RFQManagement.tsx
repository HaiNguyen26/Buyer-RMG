import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  Eye,
  Download,
  Filter,
  Search,
  FileText,
  ArrowRight,
  CheckCircle2,
  FileQuestion,
  Hash,
  Package,
  CalendarDays,
  Send,
  Inbox,
  ClipboardCheck,
  Scale,
  Archive,
  TimerOff,
  FileEdit,
  Sparkles,
} from 'lucide-react';
import { buyerService } from '../../services/buyerService';
import { useToast } from '../../contexts/ToastContext';
import CustomSelect from '../../components/CustomSelect';
import { RfqExportPdfModal } from '../../components/RfqExportPdfModal';
import { BuyerPageHero } from '../../components/BuyerPageHero';
import {
  buyerInteractiveTableClass,
  buyerInteractiveTableBodyClass,
  buyerOutletPageShellClass,
  buyerOutletCenterMinHeightClass,
  buyerTableAccentRailClass,
  buyerTableCellWrapClass,
  buyerTableCellWrapFlexClass,
  buyerTableDataRowVisual,
  buyerTableFirstCellInnerClass,
  buyerWorkspaceDataCardClass,
  buyerWorkspaceFiltersCardClass,
  buyerWorkspacePageStackClass,
  buyerWorkspaceTableTitleBarClass,
} from '../../constants/buyerLayout';
import {
  DashboardV3ShimmerBlock,
  dashboardV3ErrorCardClass,
  dashboardV3CtaLinkClass,
} from '../../components/dashboard/DashboardV3Chrome';

const RFQ_STATUS_UI: Record<string, { label: string; Icon: LucideIcon; className: string }> = {
  DRAFT: {
    label: 'Nháp',
    Icon: FileEdit,
    className: 'bg-slate-100 text-slate-800 ring-slate-200/90 border-slate-200/80',
  },
  SENT: {
    label: 'Đã gửi',
    Icon: Send,
    className: 'bg-sky-50 text-sky-900 ring-sky-200/80 border-sky-200/70',
  },
  QUOTATION_RECEIVED: {
    label: 'Đã nhận báo giá',
    Icon: Inbox,
    className: 'bg-violet-50 text-violet-900 ring-violet-200/75 border-violet-200/65',
  },
  READY_FOR_COMPARISON: {
    label: 'Chờ duyệt',
    Icon: Scale,
    className: 'bg-emerald-50 text-emerald-900 ring-emerald-200/75 border-emerald-200/65',
  },
  CLOSED: {
    label: 'Đã đóng',
    Icon: Archive,
    className: 'bg-zinc-100 text-zinc-800 ring-zinc-200/80 border-zinc-200/70',
  },
  EXPIRED: {
    label: 'Hết hạn',
    Icon: TimerOff,
    className: 'bg-rose-50 text-rose-900 ring-rose-200/75 border-rose-200/65',
  },
};

const rfqStatusFallback = {
  Icon: ClipboardCheck,
  className: 'bg-slate-50 text-slate-700 ring-slate-200/80 border-slate-200/70',
} satisfies { Icon: LucideIcon; className: string };

const PR_STATUS_AFTER_AWARD = new Set([
  'SUPPLIER_SELECTED',
  'RFQ_COMPLETED',
  'PO_PENDING',
  'PO_IN_PROGRESS',
  'PO_ISSUED',
  'CLOSED',
  'BUDGET_EXCEPTION',
  'BUDGET_APPROVED',
]);

const AWARDED_STATUS_UI = {
  label: 'Đã chọn NCC',
  Icon: CheckCircle2,
  className: 'bg-emerald-100 text-emerald-900 ring-emerald-200/85 border-emerald-200/75',
} as const;

const RFQManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [exportPdfRfqId, setExportPdfRfqId] = useState<string | null>(null);

  const { data: rfqsData, isLoading, error: rfqsError } = useQuery({
    queryKey: ['buyer-rfqs', statusFilter],
    queryFn: () => buyerService.getRFQs({ status: statusFilter === 'all' ? undefined : statusFilter }),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const rfqsSource = rfqsData?.rfqs || [];

  const createRFQMutation = useMutation({
    mutationFn: async (data: any) => {
      // TODO: Replace with actual API call
      // return buyerService.createRFQ(data);
      throw new Error('API not implemented yet');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-rfqs'] });
      navigate('/dashboard/buyer/rfq/create');
    },
  });

  // Gửi duyệt RFQ mutation
  const completeRFQMutation = useMutation({
    mutationFn: (rfqId: string) => buyerService.completeRFQ(rfqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-rfqs'] });
                        showSuccess('RFQ đã được nộp thành công. Buyer Leader có thể so sánh báo giá.');
    },
    onError: (error: any) => {
      showError(error.response?.data?.error || 'Lỗi khi submit RFQ');
    },
  });

  if (isLoading) {
    return (
      <div className={buyerOutletPageShellClass}>
        <div className={buyerWorkspacePageStackClass}>
          <DashboardV3ShimmerBlock className="h-24 w-full shrink-0" />
          <DashboardV3ShimmerBlock className="h-16 w-full max-w-xl shrink-0" />
          <DashboardV3ShimmerBlock className="min-h-[280px] shrink-0" />
        </div>
      </div>
    );
  }

  if (rfqsError) {
    return (
      <div className={`${buyerOutletPageShellClass} ${buyerOutletCenterMinHeightClass} items-center justify-center p-6`}>
        <div className={`max-w-lg ${dashboardV3ErrorCardClass}`}>
          <p className="text-lg font-bold text-rose-900">Lỗi khi tải danh sách RFQ</p>
          <p className="mt-2 text-sm font-medium text-rose-800/90">
            {rfqsError instanceof Error ? rfqsError.message : 'Vui lòng thử lại'}
          </p>
        </div>
      </div>
    );
  }

  const filteredRFQs = (rfqsSource || []).filter((rfq: any) =>
    rfq.rfqNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rfq.prNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`${buyerOutletPageShellClass} animate-fade-in-right fade-in-right-delay-0`}>
      <RfqExportPdfModal
        open={!!exportPdfRfqId}
        rfqId={exportPdfRfqId}
        onClose={() => setExportPdfRfqId(null)}
      />
      <div className={buyerWorkspacePageStackClass}>
        <BuyerPageHero
          kicker="Buyer · RFQ"
          title="Quản lý RFQ"
          description='RFQ chỉ được tạo từ trang "PR được phân công". Trang này để xem và theo dõi.'
          Icon={FileQuestion}
          tint="cyan"
          regionLabel="Quản lý RFQ"
        />

        <article className={buyerWorkspaceFiltersCardClass}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-600" />
            <input
              type="text"
              placeholder="Tìm kiếm RFQ theo mã, PR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25"
            />
          </div>
          <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:max-w-xs">
            <Filter className="h-5 w-5 shrink-0 text-cyan-600" />
            <CustomSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 md:flex-none md:px-4"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="DRAFT">Nháp</option>
              <option value="SENT">Đã gửi</option>
              <option value="QUOTATION_RECEIVED">Đã nhận báo giá</option>
              <option value="READY_FOR_COMPARISON">Chờ duyệt</option>
              <option value="CLOSED">Đã đóng</option>
            </CustomSelect>
          </div>
        </div>
        </article>

        <article
          className={`${buyerWorkspaceDataCardClass} border-cyan-100/40 shadow-[0_12px_40px_-14px_rgba(15,23,42,0.18),0_4px_22px_-6px_rgba(6,182,212,0.14)] ring-1 ring-cyan-100/55`}
        >
          <div
            className={`${buyerWorkspaceTableTitleBarClass} border-cyan-100/50 bg-gradient-to-r from-cyan-50/90 via-white to-sky-50/70`}
          >
            <h2 className="flex items-center gap-2.5 text-lg font-bold text-slate-900 sm:text-xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-md shadow-cyan-500/25 ring-2 ring-white/80">
                <FileQuestion className="h-4 w-4" strokeWidth={2} />
              </span>
              Danh sách RFQ
              <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-sm font-bold tabular-nums text-cyan-900 shadow-sm ring-1 ring-cyan-100/80">
                {filteredRFQs.length}
              </span>
            </h2>
          </div>
          <div className="relative w-full min-w-0 overflow-x-auto [scrollbar-width:thin]">
          <table className={`${buyerInteractiveTableClass} w-full min-w-[1160px] bg-white whitespace-nowrap`}>
            <thead className="sticky top-0 z-20 border-b border-cyan-100/80 bg-gradient-to-r from-[#ECFEFF] via-[#F0F9FF] to-[#FAFBFF] shadow-[0_1px_0_0_rgba(6,182,212,0.15)] backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-cyan-950/90 sm:px-6 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <Hash className="h-4 w-4 shrink-0 text-cyan-600" strokeWidth={2} />
                    Mã RFQ
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-cyan-950/90 sm:px-6 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-sky-600" strokeWidth={2} />
                    Mã PR
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-cyan-950/90 sm:px-6 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <Package className="h-4 w-4 shrink-0 text-indigo-500" strokeWidth={2} />
                    Số items
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-cyan-950/90 sm:px-6 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 shrink-0 text-violet-600" strokeWidth={2} />
                    Trạng thái
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-cyan-950/90 sm:px-6 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
                    Ngày tạo
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-cyan-950/90 sm:px-6 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 text-fuchsia-600" strokeWidth={2} />
                    Số báo giá
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wide text-cyan-950/90 sm:px-6 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2">
                    <Eye className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={2} />
                    Thao tác
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className={buyerInteractiveTableBodyClass}>
              {filteredRFQs.length > 0 ? (
                filteredRFQs.map((rfq: any, index: number) => (
                  <tr
                    key={rfq.id}
                    className={`group ${buyerTableDataRowVisual(index)}`}
                    style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
                  >
                    <td className="relative whitespace-nowrap px-6 py-4">
                      <div aria-hidden className={buyerTableAccentRailClass} />
                      <div className={`${buyerTableFirstCellInnerClass} ${buyerTableCellWrapClass}`}>
                        <span className="inline-flex items-center gap-2 font-mono text-sm font-bold text-indigo-800">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/90">
                            <Hash className="h-3.5 w-3.5" strokeWidth={2} />
                          </span>
                          {rfq.rfqNumber}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className={buyerTableCellWrapClass}>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-slate-50/80 px-2.5 py-1 text-sm font-semibold text-slate-800 ring-1 ring-white/80">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={2} />
                          {rfq.prNumber}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className={buyerTableCellWrapClass}>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100/90 bg-gradient-to-br from-indigo-50 to-sky-50/50 px-2.5 py-1 text-sm font-bold tabular-nums text-indigo-950 shadow-sm ring-1 ring-white/70">
                          <Package className="h-3.5 w-3.5 shrink-0 text-indigo-500" strokeWidth={2} />
                          {rfq.itemCount || 0} item
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className={buyerTableCellWrapClass}>
                        {(() => {
                          const awardedDone = PR_STATUS_AFTER_AWARD.has(rfq.prStatus);
                          const preset = awardedDone ? AWARDED_STATUS_UI : RFQ_STATUS_UI[rfq.status];
                          const Icon = preset?.Icon ?? rfqStatusFallback.Icon;
                          const label = preset?.label ?? (awardedDone ? 'Đã chọn NCC' : rfq.status);
                          const cls = preset?.className ?? rfqStatusFallback.className;
                          return (
                            <span
                              className={`inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm ring-1 ${cls}`}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} />
                              {label}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className={buyerTableCellWrapClass}>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-amber-500/90" strokeWidth={2} />
                          {new Date(rfq.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className={buyerTableCellWrapClass}>
                        {(() => {
                          const q = rfq.quotationsCount || 0;
                          const tone =
                            q >= 3
                              ? 'border-emerald-200/90 bg-emerald-50 text-emerald-900 ring-emerald-100/80'
                              : q > 0
                                ? 'border-amber-200/90 bg-amber-50 text-amber-950 ring-amber-100/80'
                                : 'border-slate-200/90 bg-slate-50 text-slate-600 ring-slate-100/80';
                          return (
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold tabular-nums shadow-sm ring-1 ${tone}`}
                            >
                              <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} />
                              {q} báo giá
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className={`${buyerTableCellWrapFlexClass} gap-2`}>
                        {/* Submit RFQ Button */}
                        {(() => {
                          const quotationsCount = rfq.quotationsCount || 0;
                          const awardedDone = PR_STATUS_AFTER_AWARD.has(rfq.prStatus);
                          const canSubmit = (rfq.status === 'SENT' || rfq.status === 'QUOTATION_RECEIVED') && quotationsCount >= 2;
                          const isSubmitted = rfq.status === 'READY_FOR_COMPARISON' || awardedDone;
                          
                          if (canSubmit) {
                            return (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Gửi RFQ ${rfq.rfqNumber} để Buyer Leader duyệt (so sánh báo giá)? Sau khi gửi, Buyer không chỉnh sửa được nữa.`)) {
                                    completeRFQMutation.mutate(rfq.id);
                                  }
                                }}
                                disabled={completeRFQMutation.isPending}
                                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/90 bg-gradient-to-b from-emerald-600 to-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-500/30 transition hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-50"
                                title="Gửi duyệt RFQ"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
                                Gửi duyệt RFQ
                              </button>
                            );
                          }
                          if (isSubmitted) {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-emerald-100/70">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2} />
                                Đã gửi duyệt
                              </span>
                            );
                          }
                          return null;
                        })()}
                        
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/buyer/rfq/${rfq.id}`)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-200/90 bg-gradient-to-b from-white to-indigo-50/90 text-indigo-700 shadow-md shadow-indigo-200/35 ring-1 ring-white/90 transition hover:border-indigo-300 hover:shadow-lg motion-safe:hover:-translate-y-0.5"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportPdfRfqId(rfq.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200/90 bg-gradient-to-b from-emerald-50 to-white text-emerald-700 shadow-md shadow-emerald-200/30 ring-1 ring-white/90 transition hover:border-emerald-300 hover:shadow-lg motion-safe:hover:-translate-y-0.5"
                          title="Xuất PDF RFQ"
                        >
                          <Download className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <FileText className="w-14 h-14 text-slate-300" strokeWidth={1.5} />
                      <div>
                        <p className="text-slate-600 font-medium">Chưa có RFQ nào</p>
                        <p className="text-sm text-slate-500 mt-1 max-w-md">
                          RFQ chỉ được tạo từ trang <strong>PR được phân công</strong>. Vào PR đã được giao cho bạn, mở chi tiết PR và bấm <strong>Tạo RFQ mới</strong>, chọn items rồi xác nhận.
                        </p>
                      </div>
                      <Link to="/dashboard/buyer/assigned-prs" className={dashboardV3CtaLinkClass}>
                        Đến trang PR được phân công
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
      </div>
    </div>
  );
};

export default RFQManagement;

