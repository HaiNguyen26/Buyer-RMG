import { useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  Calendar,
  CircleDollarSign,
  ClipboardList,
  Eye,
  FileSpreadsheet,
  FileText,
  Inbox,
  Loader2,
  Search,
  UserRound,
} from 'lucide-react';
import { buyerService } from '../../services/buyerService';
import { downloadBlob } from '../../utils/downloadBlob';
import { downloadPurchaseOrderPdf } from '../../utils/poPdf';
import { getStoredPoDisplayLang } from '../../utils/poDisplayLang';
import { poDetailUi } from '../../utils/poDetailUiStrings';
import { useToast } from '../../contexts/ToastContext';
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
  buyerWorkspaceTableViewportClass,
} from '../../constants/buyerLayout';
import {
  DashboardV3ShimmerBlock,
  dashboardV3ErrorCardClass,
} from '../../components/dashboard/DashboardV3Chrome';
import { poApprovalStatusLabel } from '../../constants/poApprovalQueueFilter';

const PO_LIST_STATUS_FILTER = [
  'DRAFT',
  'SUBMITTED',
  'CANCEL_REQUESTED',
  'CREATED',
  'SENT',
  'CONFIRMED',
  'PARTIAL_RECEIVED',
  'FULLY_RECEIVED',
  'REJECTED',
  'CANCELLED',
  'CLOSED',
] as const;

function CellWithIcon({
  icon: Icon,
  iconClassName = 'text-slate-400',
  align = 'left',
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  align?: 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <span
      className={[
        'inline-flex items-center gap-2',
        align === 'right' ? 'ml-auto justify-end' : '',
      ].join(' ')}
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} aria-hidden />
      {children}
    </span>
  );
}

const POList = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [poCode, setPoCode] = useState('');
  const [prCode, setPrCode] = useState('');
  const [supplier, setSupplier] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['buyer-po-list', poCode, prCode, supplier, status],
    queryFn: () =>
      buyerService.getPOList({
        poCode: poCode || undefined,
        prCode: prCode || undefined,
        supplier: supplier || undefined,
        status: status || undefined,
      }),
    staleTime: 0,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
  });

  const pos = data?.pos || [];
  const isInitialLoading = isLoading && data === undefined;

  const handleExportExcel = async () => {
    setExcelLoading(true);
    try {
      const blob = await buyerService.exportPOListExcel({
        poCode: poCode || undefined,
        prCode: prCode || undefined,
        supplier: supplier || undefined,
        status: status || undefined,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `PO_Buyer_${stamp}.xlsx`);
      showSuccess('Đã xuất Excel danh sách PO (mỗi dòng hàng một row).');
    } catch (e) {
      console.error(e);
      showError('Không xuất được Excel. Vui lòng thử lại.');
    } finally {
      setExcelLoading(false);
    }
  };

  const getStatusBadge = (s: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700',
      SUBMITTED: 'bg-amber-100 text-amber-800',
      CANCEL_REQUESTED: 'bg-orange-100 text-orange-900',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      ISSUED: 'bg-blue-100 text-blue-800',
      CREATED: 'bg-violet-100 text-violet-900',
      SENT: 'bg-sky-100 text-sky-900',
      CONFIRMED: 'bg-emerald-100 text-emerald-900',
      PARTIAL_RECEIVED: 'bg-cyan-100 text-cyan-900',
      FULLY_RECEIVED: 'bg-slate-200 text-slate-800',
      CANCELLED: 'bg-rose-100 text-rose-900',
      CLOSED: 'bg-slate-100 text-slate-600',
    };
    return (
      <span
        className={`inline-flex whitespace-nowrap px-2 py-0.5 rounded text-xs font-medium ${colors[s] ?? 'bg-slate-100 text-slate-600'}`}
      >
        {poApprovalStatusLabel(s)}
      </span>
    );
  };

  if (isInitialLoading) {
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
  if (error && data === undefined) {
    return (
      <div className={`${buyerOutletPageShellClass} ${buyerOutletCenterMinHeightClass} items-center justify-center p-6`}>
        <div className={`max-w-lg ${dashboardV3ErrorCardClass}`}>
          <p className="text-lg font-bold text-rose-900">Lỗi khi tải danh sách PO</p>
          <p className="mt-2 text-sm font-medium text-rose-800/90">
            {error instanceof Error ? error.message : 'Vui lòng thử lại'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${buyerOutletPageShellClass} animate-fade-in-right fade-in-right-delay-0`}>
      <div className={buyerWorkspacePageStackClass}>
        <BuyerPageHero
          kicker="Buyer · Đơn hàng"
          title="Danh sách PO"
          description="Tra cứu, lọc và mở chi tiết PO — tải PDF khi cần"
          Icon={ClipboardList}
          tint="graphite"
          regionLabel="Danh sách PO"
        />

        <article className={buyerWorkspaceFiltersCardClass}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Mã PO"
              value={poCode}
              onChange={(e) => setPoCode(e.target.value)}
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-28 sm:w-32"
            />
            <input
              type="text"
              placeholder="Mã PR"
              value={prCode}
              onChange={(e) => setPrCode(e.target.value)}
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-28 sm:w-32"
            />
            <input
              type="text"
              placeholder="NCC"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="min-w-0 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-32 sm:w-36"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-36"
            >
              <option value="">Tất cả trạng thái</option>
              {PO_LIST_STATUS_FILTER.map((k) => (
                <option key={k} value={k}>
                  {poApprovalStatusLabel(k)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
              title="Làm mới"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={excelLoading || isInitialLoading}
              onClick={() => void handleExportExcel()}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Xuất Excel — đủ trường PO và từng dòng hàng"
            >
              {excelLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FileSpreadsheet className="h-4 w-4" aria-hidden />
              )}
              Xuất Excel
            </button>
          </div>
        </div>
        </article>

        <article
          className={`${buyerWorkspaceDataCardClass} transition-opacity ${isFetching ? 'opacity-60' : ''}`}
          aria-busy={isFetching}
        >
          <div className={buyerWorkspaceTableTitleBarClass}>
            <h2 className="text-xl font-bold text-slate-900">
              Danh sách PO ({pos.length})
              {isFetching ? (
                <span className="ml-2 text-sm font-normal text-slate-500">Đang lọc…</span>
              ) : null}
            </h2>
          </div>
        <div className={`relative w-full ${buyerWorkspaceTableViewportClass}`}>
            <table className={`${buyerInteractiveTableClass} w-full min-w-[920px] bg-white text-sm`}>
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95">
              <tr>
                <th className="bg-slate-50/95 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Mã PO</th>
                <th className="bg-slate-50/95 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">PR</th>
                <th className="bg-slate-50/95 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">NCC</th>
                <th className="bg-slate-50/95 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Tổng tiền</th>
                <th className="bg-slate-50/95 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Buyer</th>
                <th className="bg-slate-50/95 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">Trạng thái</th>
                <th className="bg-slate-50/95 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Ngày tạo</th>
                <th className="bg-slate-50/95 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">Thao tác</th>
              </tr>
            </thead>
            <tbody className={buyerInteractiveTableBodyClass}>
              {pos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-center text-slate-500">
                      <Inbox className="h-8 w-8 text-slate-300" aria-hidden />
                      <p className="text-sm font-medium text-slate-600">Chưa có PO nào.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pos.map((po: any, index: number) => (
                  <tr key={po.id} className={`group ${buyerTableDataRowVisual(index)}`}>
                    <td className="relative px-6 py-4">
                      <div aria-hidden className={buyerTableAccentRailClass} />
                      <div className={`${buyerTableFirstCellInnerClass} ${buyerTableCellWrapClass}`}>
                        <CellWithIcon icon={FileText} iconClassName="text-indigo-500/80">
                          <span className="font-medium text-slate-800">{po.poNumber}</span>
                        </CellWithIcon>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className={buyerTableCellWrapClass}>
                        <CellWithIcon icon={ClipboardList} iconClassName="text-slate-500/80">
                          {po.prCode}
                        </CellWithIcon>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className={buyerTableCellWrapClass}>
                        <CellWithIcon icon={Building2} iconClassName="text-violet-500/70">
                          {po.supplier?.name ?? '-'}
                        </CellWithIcon>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={buyerTableCellWrapClass}>
                        <CellWithIcon icon={CircleDollarSign} iconClassName="text-emerald-600/70" align="right">
                          <span className="font-semibold tabular-nums">
                            {po.totalAmount != null
                              ? `${Number(po.totalAmount).toLocaleString('vi-VN')} ${po.currency ?? 'VND'}`
                              : '-'}
                          </span>
                        </CellWithIcon>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className={buyerTableCellWrapClass}>
                        <CellWithIcon icon={UserRound}>{po.buyer}</CellWithIcon>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={buyerTableCellWrapClass}>{getStatusBadge(po.status)}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className={buyerTableCellWrapClass}>
                        <CellWithIcon icon={Calendar} iconClassName="text-slate-500/80">
                          {po.createdAt ? new Date(po.createdAt).toLocaleDateString('vi-VN') : '-'}
                        </CellWithIcon>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`${buyerTableCellWrapFlexClass} justify-center gap-2`}>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/buyer/po/${po.id}`)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                          Xem chi tiết
                        </button>
                        {['CREATED', 'SENT', 'CONFIRMED', 'PARTIAL_RECEIVED', 'FULLY_RECEIVED', 'APPROVED', 'ISSUED'].includes(
                          po.status
                        ) && (
                          <button
                            type="button"
                            disabled={pdfLoadingId === po.id}
                            onClick={async () => {
                              setPdfLoadingId(po.id);
                              try {
                                const detail = await buyerService.getPODetail(po.id);
                                const loc = getStoredPoDisplayLang();
                                await downloadPurchaseOrderPdf({
                                  poNumber: detail.poNumber,
                                  prCode: detail.prCode,
                                  currency: detail.currency,
                                  totalAmount: Number(detail.totalAmount),
                                  paymentTerms: detail.paymentTerms,
                                  deliveryAddress: detail.deliveryAddress,
                                  incoterms: detail.incoterms,
                                  projectCode: detail.projectCode,
                                  deliveryDate: detail.deliveryDate,
                                  note: detail.note,
                                  approvedAt: detail.approvedAt,
                                  supplier: detail.supplier,
                                  items: detail.items,
                                  locale: loc,
                                });
                                showSuccess(poDetailUi(loc).toastPdfOk);
                              } catch (e: any) {
                                showError(e?.response?.data?.message || e?.message || 'Không tạo được PDF');
                              } finally {
                                setPdfLoadingId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            title="Tải PDF PO về máy"
                          >
                            {pdfLoadingId === po.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                            Tải PDF
                          </button>
                        )}
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
  );
};

export default POList;
