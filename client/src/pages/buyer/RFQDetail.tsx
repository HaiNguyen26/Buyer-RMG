import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileQuestion,
  Hash,
  Lock,
  ChevronRight,
  Package,
  RadioTower,
  Target,
} from 'lucide-react';
import { buyerService } from '../../services/buyerService';
import { useToast } from '../../contexts/ToastContext';
import { stripRfqItemsTag } from '../../utils/rfqNotes';
import { useState } from 'react';
import { BuyerPageHero } from '../../components/BuyerPageHero';
import { AppModal } from '../../components/AppModal';
import {
  DashboardV3ShimmerBlock,
  dashboardV3StackYClass,
  dashboardV3CtaLinkClass,
  dashboardV3TableHeaderStripClass,
  dashboardV3ErrorCardClass,
} from '../../components/dashboard/DashboardV3Chrome';
import {
  buyerOutletPageShellClass,
  buyerOutletCenterMinHeightClass,
  buyerRfqItemsTableViewportClass,
  buyerInteractiveTableClass,
  buyerInteractiveTableBodyClass,
  buyerTableDocumentRowClass,
  buyerTableAccentRailClass,
  buyerTableFirstCellInnerClass,
  buyerTableCellWrapClass,
} from '../../constants/buyerLayout';
import {
  rfqDetailCardClass,
  rfqDetailCardBodyClass,
  rfqDetailFieldBoxClass,
  RfqDetailSectionHeader,
  RfqDetailField,
  RfqDetailEmptyState,
  RfqDetailCountBadge,
  rfqDetailSecondaryButtonClass,
  rfqStatusPillClass,
} from '../../components/buyer/RfqDetailBlocks';

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

export default function RFQDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [detailQuotation, setDetailQuotation] = useState<any>(null);

  const { data: rfqData, isLoading, error } = useQuery({
    queryKey: ['buyer-rfq-detail', id],
    queryFn: () => buyerService.getRFQById(id!),
    enabled: !!id,
    retry: 1,
  });

  const completeRFQMutation = useMutation({
    mutationFn: (rfqId: string) => buyerService.completeRFQ(rfqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-rfq-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['buyer-rfqs'] });
      showSuccess('RFQ đã được đánh dấu hoàn thành. Buyer Leader có thể so sánh báo giá.');
    },
    onError: (err: any) => {
      showError(err.response?.data?.error || 'Lỗi khi hoàn thành RFQ');
    },
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const estimateItemDeliveryDate = (quotation: any) => {
    const leadTimeDays = Number(quotation?.leadTime ?? 0);
    if (!Number.isFinite(leadTimeDays) || leadTimeDays <= 0) return null;
    const baseDateRaw = rfqData?.sentDate || rfqData?.createdAt;
    if (!baseDateRaw) return null;
    const baseDate = new Date(baseDateRaw);
    if (Number.isNaN(baseDate.getTime())) return null;
    const estimated = new Date(baseDate);
    estimated.setDate(estimated.getDate() + Math.round(leadTimeDays));
    return estimated.toISOString();
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'Nháp';
      case 'SENT':
        return 'Đã gửi';
      case 'QUOTATION_RECEIVED':
        return 'Đã nhận báo giá';
      case 'READY_FOR_COMPARISON':
        return 'Chờ duyệt';
      case 'CLOSED':
        return 'Đã đóng';
      case 'EXPIRED':
        return 'Hết hạn';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className={`${buyerOutletPageShellClass} w-full min-w-0`}>
        <div className={`px-2 pb-4 pt-3 sm:px-3 sm:pb-5 sm:pt-4 md:px-4 ${dashboardV3StackYClass}`}>
          <DashboardV3ShimmerBlock className="h-28 w-full shrink-0 rounded-2xl" />
          <DashboardV3ShimmerBlock className="h-40 w-full shrink-0 rounded-2xl" />
          <DashboardV3ShimmerBlock className="h-[260px] w-full shrink-0 rounded-2xl" />
          <DashboardV3ShimmerBlock className="min-h-[200px] shrink-0 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${buyerOutletPageShellClass} ${buyerOutletCenterMinHeightClass} items-center justify-center p-6`}>
        <div className={`max-w-lg ${dashboardV3ErrorCardClass}`}>
          <p className="text-lg font-bold text-rose-900">Lỗi khi tải chi tiết RFQ</p>
          <p className="mt-2 text-sm font-medium text-rose-800/90">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }

  if (!rfqData) {
    return (
      <div className={`${buyerOutletPageShellClass} ${buyerOutletCenterMinHeightClass} items-center justify-center p-6`}>
        <div className={`max-w-lg ${rfqDetailCardClass} ${rfqDetailCardBodyClass}`}>
          <p className="text-lg font-bold text-[#1E293B]">Không tìm thấy RFQ</p>
          <p className="mt-2 text-sm text-[#64748B]">RFQ có thể đã bị xóa hoặc bạn không có quyền truy cập.</p>
          <button type="button" onClick={() => navigate('/dashboard/buyer/rfq')} className={`mt-4 ${dashboardV3CtaLinkClass}`}>
            <ArrowLeft className="h-4 w-4" />
            Danh sách RFQ
          </button>
        </div>
      </div>
    );
  }

  const rfqItems = rfqData.purchaseRequest?.items ?? [];
  const itemCount = rfqItems.length > 0 ? rfqItems.length : (rfqData.itemCount ?? 0);
  const quoteCount = rfqData.quotations?.length ?? 0;
  const prStatus = String(rfqData?.purchaseRequest?.status || '');
  const awardedDone = PR_STATUS_AFTER_AWARD.has(prStatus);
  const statusLabel = awardedDone || rfqData.status === 'CLOSED' ? 'Đã chọn NCC' : getStatusLabel(rfqData.status);
  const statusPill = rfqStatusPillClass(rfqData.status, awardedDone);

  const quotationsCount = rfqData.quotations?.length || 0;
  const canSubmitForReview =
    !awardedDone &&
    (rfqData.status === 'SENT' || rfqData.status === 'QUOTATION_RECEIVED') &&
    quotationsCount >= 1;
  const alreadySubmitted = rfqData.status === 'READY_FOR_COMPARISON' || rfqData.status === 'CLOSED' || awardedDone;

  return (
    <div className={`${buyerOutletPageShellClass} w-full min-w-0 animate-fade-in`}>
      <div className={`relative z-10 px-2 pb-4 pt-3 sm:px-3 sm:pb-5 sm:pt-4 md:px-4 ${dashboardV3StackYClass}`}>
        <BuyerPageHero
          kicker="Buyer · RFQ"
          title={rfqData.rfqNumber}
          description="Theo dõi yêu cầu báo giá, hàng hóa và phản hồi NCC — giá chi tiết do Buyer Leader quản lý."
          Icon={FileQuestion}
          tint="cyan"
          regionLabel="Chi tiết RFQ"
        />

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => navigate('/dashboard/buyer/rfq')} className={dashboardV3CtaLinkClass}>
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Danh sách RFQ
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/buyer/quotation')}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-[#64748B] shadow-sm transition-colors hover:border-slate-300 hover:text-[#1E293B]"
          >
            Quản lý báo giá
          </button>
        </div>

        {/* Trạng thái & hành động */}
        <article className={rfqDetailCardClass}>
          <div className={`${rfqDetailCardBodyClass} border-b border-slate-100/90`}>
            <RfqDetailSectionHeader
              Icon={Target}
              tone="indigo"
              title="Trạng thái · luồng duyệt"
              description="Badge trạng thái RFQ, số dòng hàng và báo giá NCC đã ghi nhận."
              trailing={
                <>
                  <RfqDetailCountBadge count={itemCount} tone="sky" label={`${itemCount} dòng`} />
                  <RfqDetailCountBadge count={quoteCount} tone="violet" label={`${quoteCount} báo giá`} />
                  {canSubmitForReview ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Gửi RFQ ${rfqData.rfqNumber} để Buyer Leader duyệt? Sau khi gửi, Buyer không chỉnh sửa báo giá.`
                          )
                        ) {
                          completeRFQMutation.mutate(rfqData.id);
                        }
                      }}
                      disabled={completeRFQMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(79,70,229,0.4)] transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                      {completeRFQMutation.isPending ? 'Đang xử lý...' : 'Gửi duyệt Leader'}
                    </button>
                  ) : null}
                  {alreadySubmitted && !canSubmitForReview ? (
                    <span className="rounded-2xl border border-slate-200/80 bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-[#64748B] ring-1 ring-slate-200/60">
                      Đã gửi · Không chỉnh báo giá
                    </span>
                  ) : null}
                </>
              }
            />
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ring-1 ${statusPill}`}>
                {statusLabel}
              </span>
            </div>
          </div>
          <div className="flex gap-3.5 bg-indigo-500/[0.04] px-5 py-4 md:px-6 md:py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/15">
              <Lock className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#1E293B]">Đơn giá · thành tiền — chỉ Buyer Leader</p>
              <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
                Bạn vẫn xem hàng hóa, lead time và kết quả phân bổ item sau khi Leader đóng RFQ.
              </p>
            </div>
          </div>
        </article>

        {/* Liên kết PR */}
        <article className={rfqDetailCardClass}>
          <div className={rfqDetailCardBodyClass}>
            <RfqDetailSectionHeader
              Icon={RadioTower}
              tone="cyan"
              title="Chi tiết · liên kết đơn mua"
              description="Số RFQ, PR liên kết, phòng ban và các mốc thời gian chính."
            />
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <RfqDetailField label="Số RFQ" icon={Hash} iconClass="text-indigo-500">
                {rfqData.rfqNumber}
              </RfqDetailField>
              <RfqDetailField label="Liên kết PR" icon={ClipboardCheck} iconClass="text-cyan-600">
                {rfqData.purchaseRequest?.prNumber ?? '—'}
              </RfqDetailField>
              <RfqDetailField label="Phòng ban" icon={Building2} iconClass="text-violet-600">
                {rfqData.purchaseRequest?.department || '—'}
              </RfqDetailField>
              <RfqDetailField label="Ngày tạo" icon={CalendarDays} iconClass="text-amber-600">
                {formatDate(rfqData.createdAt)}
              </RfqDetailField>
              {rfqData.sentDate ? (
                <RfqDetailField label="Ngày gửi RFQ" icon={CalendarDays} iconClass="text-emerald-600" className="sm:col-span-2">
                  {formatDate(rfqData.sentDate)}
                </RfqDetailField>
              ) : null}
              {stripRfqItemsTag(rfqData.notes) ? (
                <div className={`${rfqDetailFieldBoxClass} sm:col-span-2`}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Ghi chú</dt>
                  <dd className="mt-1.5 whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#1E293B]">
                    {stripRfqItemsTag(rfqData.notes)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </article>

        {/* Hạng mục */}
        <article className={rfqDetailCardClass}>
          <div className={`border-b border-slate-100/90 ${rfqDetailCardBodyClass} pb-4`}>
            <RfqDetailSectionHeader
              Icon={Package}
              tone="sky"
              title="Danh mục hàng trong RFQ"
              description="Mô tả, mã linh kiện, số lượng và đơn vị — không hiển thị đơn giá."
              trailing={<RfqDetailCountBadge count={itemCount} tone="sky" />}
            />
          </div>
          {rfqItems.length === 0 ? (
            <div className={`${rfqDetailCardBodyClass} border-t border-slate-100/90 pt-0`}>
              <RfqDetailEmptyState
                Icon={Package}
                title="Chưa có dòng hàng"
                description="RFQ này chưa gắn item từ PR — kiểm tra lại phạm vi phân công hoặc tạo RFQ với item đã chọn."
              />
            </div>
          ) : (
            <div className={buyerRfqItemsTableViewportClass}>
              <table className={`w-full min-w-[720px] bg-white text-sm ${buyerInteractiveTableClass}`}>
                <thead className={`sticky top-0 z-10 ${dashboardV3TableHeaderStripClass}`}>
                  <tr>
                    <th className="w-16 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">STT</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Mô tả</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Part No</th>
                    <th className="w-24 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">SL</th>
                    <th className="w-24 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">ĐVT</th>
                  </tr>
                </thead>
                <tbody className={buyerInteractiveTableBodyClass}>
                  {rfqItems.map((item: any, index: number) => (
                    <tr key={item.id} className={buyerTableDocumentRowClass(index)}>
                      <td className="relative px-4 py-3">
                        <div aria-hidden className={buyerTableAccentRailClass} />
                        <div
                          className={`${buyerTableFirstCellInnerClass} ${buyerTableCellWrapClass} text-center text-sm font-medium tabular-nums text-[#1E293B]`}
                        >
                          {item.lineNo ?? index + 1}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm leading-snug text-[#1E293B]">
                        <div className={buyerTableCellWrapClass}>
                          <span className="line-clamp-2">{item.description}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#64748B]">
                        <div className={buyerTableCellWrapClass}>{item.partNo || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-[#1E293B]">
                        <div className={buyerTableCellWrapClass}>{item.qty}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#64748B]">
                        <div className={buyerTableCellWrapClass}>{item.unit || '—'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        {/* Báo giá NCC */}
        <article className={rfqDetailCardClass}>
          <div className={rfqDetailCardBodyClass}>
            <RfqDetailSectionHeader
              Icon={Building2}
              tone="violet"
              title="Trạng thái báo giá theo NCC"
              description="Lead time, điều khoản thanh toán và kết quả chọn sau khi Leader đóng RFQ."
              trailing={<RfqDetailCountBadge count={quoteCount} tone="violet" />}
            />

            {(rfqData.status === 'READY_FOR_COMPARISON' || rfqData.status === 'CLOSED') && (
              <div className="mb-5 rounded-xl border border-slate-200/70 bg-[#F8FAFC] px-4 py-3 text-sm">
                {rfqData.status === 'READY_FOR_COMPARISON' ? (
                  <p className="text-[#1E293B]">
                    <span className="font-semibold text-amber-800">Đang chờ Buyer Leader đối chiếu.</span>{' '}
                    <span className="text-[#64748B]">Buyer không chỉnh báo giá ở bước này.</span>
                  </p>
                ) : (
                  <p className="text-[#1E293B]">
                    <span className="font-semibold text-emerald-800">RFQ đã đóng</span>
                    <span className="text-[#64748B]"> — xem phân bổ item trong bảng bên dưới.</span>
                  </p>
                )}
              </div>
            )}

            {!rfqData.quotations || rfqData.quotations.length === 0 ? (
              <RfqDetailEmptyState
                Icon={Building2}
                title="Chưa có báo giá"
                description="Thêm báo giá trong mục Quản lý báo giá khi có phản hồi từ nhà cung cấp."
                action={
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard/buyer/quotation')}
                    className={rfqDetailSecondaryButtonClass}
                  >
                    Mở Quản lý báo giá
                    <ChevronRight className="h-4 w-4 opacity-70" strokeWidth={2} aria-hidden />
                  </button>
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white ring-1 ring-slate-900/[0.02]">
                  <table className="w-full text-sm">
                    <thead className={dashboardV3TableHeaderStripClass}>
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">NCC</th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Lead time</th>
                        <th className="max-w-[180px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Thanh toán</th>
                        <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Item thắng</th>
                        <th className="w-44 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Trạng thái</th>
                        <th className="w-14 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rfqData.quotations.map((quotation: any) => {
                        const isChờDuyệt = rfqData.status === 'READY_FOR_COMPARISON';
                        const selectedCount = quotation.selectedItemCount ?? 0;
                        const isSelected = selectedCount > 0 || quotation.status === 'SELECTED';
                        const statusText = isChờDuyệt
                          ? 'Chờ leader chọn'
                          : selectedCount > 0
                            ? `Được chọn (${selectedCount})`
                            : 'Không được chọn';
                        const rowStatusClass = isChờDuyệt
                          ? 'border-amber-200/70 bg-amber-50/90 text-amber-900'
                          : selectedCount > 0
                            ? 'border-emerald-200/70 bg-emerald-50/90 text-emerald-900'
                            : 'border-slate-200/80 bg-slate-50 text-[#64748B]';
                        return (
                          <tr
                            key={quotation.id}
                            className={`cursor-pointer transition-colors hover:bg-[#F8FAFC] ${isSelected ? 'bg-emerald-500/[0.03]' : 'bg-white'}`}
                            onClick={() => setDetailQuotation(quotation)}
                          >
                            <td className="px-4 py-3.5">
                              <span className="font-semibold text-[#1E293B]">{quotation.supplier?.name ?? '—'}</span>
                              {quotation.supplier?.code ? (
                                <span className="mt-0.5 block font-mono text-[11px] text-[#64748B]">{quotation.supplier.code}</span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3.5 text-center tabular-nums text-[#1E293B]">
                              {quotation.leadTime != null ? `${quotation.leadTime} ngày` : '—'}
                            </td>
                            <td className="max-w-[180px] px-4 py-3.5">
                              <p className="truncate text-[#64748B]" title={quotation.paymentTerms || '—'}>
                                {quotation.paymentTerms || '—'}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 text-center font-semibold tabular-nums text-[#1E293B]">
                              {rfqData.status === 'CLOSED' ? selectedCount : '—'}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${rowStatusClass}`}>
                                {statusText}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setDetailQuotation(quotation)}
                                className="inline-flex rounded-xl p-2 text-[#64748B] transition-colors hover:bg-indigo-500/10 hover:text-indigo-600"
                                title="Chi tiết phân bổ"
                              >
                                <Eye className="h-4 w-4" strokeWidth={2} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 flex items-center gap-2 text-xs text-[#64748B]">
                  <Eye className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  Chọn một dòng NCC để xem phân bổ từng item và ETA giao dự kiến.
                </p>
              </>
            )}
          </div>
        </article>

        <AppModal
          open={Boolean(detailQuotation)}
          onClose={() => setDetailQuotation(null)}
          size="3xl"
          title={detailQuotation?.supplier?.name ?? 'Nhà cung cấp'}
          subtitle={
            detailQuotation
              ? `${
                  detailQuotation.selectedItemCount > 0
                    ? `${detailQuotation.selectedItemCount} item được phân bổ. `
                    : 'Chưa có item được phân bổ. '
                }Đơn giá không hiển thị cho Buyer.`
              : undefined
          }
          headerIcon={<Building2 className="h-5 w-5 text-indigo-600" />}
          description="Phân bổ item theo báo giá NCC"
        >
          {detailQuotation && (
            <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-[#F8FAFC]/50">
              <table className="w-full min-w-[520px] text-sm">
                <thead className={dashboardV3TableHeaderStripClass}>
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase text-[#64748B]">Item</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase text-[#64748B]">ETA giao</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase text-[#64748B]">Kết quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(rfqData.purchaseRequest?.items ?? []).map((prItem: any) => {
                    const qItem = detailQuotation.items?.find((i: any) => i.purchaseRequestItemId === prItem.id);
                    const eta = qItem != null ? estimateItemDeliveryDate(detailQuotation) : null;
                    const selected = (detailQuotation.selectedItemIds ?? []).includes(prItem.id);
                    return (
                      <tr key={prItem.id} className={selected ? 'bg-emerald-500/[0.04]' : undefined}>
                        <td className="px-4 py-2.5 text-[#1E293B]">{prItem.description || `Item #${prItem.lineNo}`}</td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-[#64748B]">{eta ? formatDate(eta) : '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          {selected ? (
                            <span className="inline-flex rounded-full border border-emerald-200/70 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                              Được chọn
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-[#64748B]">
                              Không chọn
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AppModal>
      </div>
    </div>
  );
}
