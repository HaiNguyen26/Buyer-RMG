import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Scale,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  User,
  TrendingUp,
  Sigma,
  Search,
  Filter,
} from 'lucide-react';
import { buyerService } from '../../services/buyerService';
import { BuyerPageHero } from '../../components/BuyerPageHero';
import { dashboardV3ErrorCardClass } from '../../components/dashboard/DashboardV3Chrome';
import {
  buyerInteractiveTableClass,
  buyerInteractiveTableBodyClass,
  buyerOutletPageShellClass,
  buyerTableAccentRailClass,
  buyerTableCellWrapClass,
  buyerTableDataRowVisual,
  buyerTableFirstCellInnerClass,
  buyerWorkspaceDataCardClass,
  buyerWorkspaceFiltersCardClass,
  buyerWorkspacePageStackClass,
  buyerWorkspaceTableTitleBarClass,
  buyerWorkspaceTableViewportClass,
} from '../../constants/buyerLayout';
import CustomSelect from '../../components/CustomSelect';
import {
  PRICE_COMPARISON_THRESHOLD_OK,
  PRICE_COMPARISON_THRESHOLD_WARN,
} from '../../constants/quotationEvaluation';

const formatCurrency = (amount: number | null, currency: string = 'VND') => {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('vi-VN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' ' + currency;
};

type RowStatus = 'ok' | 'warn' | 'over';

function getStatus(
  diffPercent: number
): { status: RowStatus; label: string } {
  if (diffPercent <= PRICE_COMPARISON_THRESHOLD_OK)
    return { status: 'ok', label: 'OK' };
  if (diffPercent <= PRICE_COMPARISON_THRESHOLD_WARN)
    return { status: 'warn', label: 'Sát ngưỡng' };
  return { status: 'over', label: 'Vượt' };
}

const PriceComparison = () => {
  const [selectedPrId, setSelectedPrId] = useState<string>('');
  const [selectedRfqId, setSelectedRfqId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RowStatus>('all');
  const [isTableVisible, setIsTableVisible] = useState(false);

  const { data: prsData } = useQuery({
    queryKey: ['buyer-assigned-prs'],
    queryFn: () => buyerService.getAssignedPRs(),
  });

  const { data: rfqsData } = useQuery({
    queryKey: ['buyer-rfqs'],
    queryFn: () => buyerService.getRFQs({ status: 'all' }),
  });

  const rfqsList = rfqsData?.rfqs || [];

  const rfqsForPr = useMemo(() => {
    if (!selectedPrId) return [];
    return rfqsList.filter((r: any) => r.prId === selectedPrId);
  }, [rfqsList, selectedPrId]);

  const { data: rfqDetail, isLoading: loadingRfq } = useQuery({
    queryKey: ['buyer-rfq-detail', selectedRfqId],
    queryFn: () => buyerService.getRFQById(selectedRfqId),
    enabled: !!selectedRfqId,
  });

  const prs = prsData?.prs || [];
  const prOptions = prs.map((p: any) => ({ value: p.id, label: p.prNumber }));
  const rfqOptions = rfqsForPr.map((r: any) => ({
    value: r.id,
    label: r.rfqNumber,
  }));

  const buyerPricingHidden = Boolean(
    rfqDetail && (rfqDetail as { buyerPriceFieldsHidden?: boolean }).buyerPriceFieldsHidden
  );

  const statusBadge = useMemo(() => {
    const s = rfqDetail?.status;
    if (!s) return null;
    if (s === 'DRAFT') return { label: 'Nháp', className: 'bg-slate-200 text-slate-700' };
    if (s === 'READY_FOR_COMPARISON') return { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-800' };
    if (s === 'SENT') return { label: 'Đã gửi', className: 'bg-blue-100 text-blue-800' };
    if (s === 'QUOTATION_RECEIVED') return { label: 'Đã nhận báo giá', className: 'bg-emerald-100 text-emerald-800' };
    if (s === 'CLOSED') return { label: 'Đã đóng', className: 'bg-slate-200 text-slate-600' };
    if (s === 'EXPIRED') return { label: 'Hết hạn', className: 'bg-red-100 text-red-800' };
    return { label: s, className: 'bg-slate-100 text-slate-600' };
  }, [rfqDetail?.status]);

  const { rows, minQuoteTotal, quotationTotals, hasAnyOver } = useMemo(() => {
    if (!rfqDetail?.purchaseRequest?.items || !rfqDetail?.quotations?.length) {
      return { rows: [], minQuoteTotal: 0, quotationTotals: [], hasAnyOver: false };
    }
    const prItems = rfqDetail.purchaseRequest.items as any[];
    const prItemsMap = new Map(prItems.map((i: any) => [i.id, i]));

    /** Đơn giá thấp nhất trên từng dòng PR (min giữa các báo giá NCC) — Buyer không thấy giá PR gốc. */
    const minUnitByPrItemId = new Map<string, number>();
    for (const q of rfqDetail.quotations as any[]) {
      for (const qi of q.items || []) {
        const pid = qi.purchaseRequestItemId as string | undefined;
        if (!pid) continue;
        const u = Number(qi.unitPrice);
        if (!Number.isFinite(u)) continue;
        const prev = minUnitByPrItemId.get(pid);
        if (prev === undefined || u < prev) minUnitByPrItemId.set(pid, u);
      }
    }

    const quotationTotalsList: { quotationId: string; supplierName: string; total: number }[] = [];
    const rowsList: Array<{
      id: string;
      itemDesc: string;
      lineNo: number;
      qty: number;
      minPeerUnit: number | null;
      supplierName: string;
      quotationId: string;
      rfqUnitPrice: number;
      rfqTotalPrice: number;
      diff: number;
      diffPercent: number;
      status: RowStatus;
      statusLabel: string;
    }> = [];
    let hasOver = false;

    for (const q of rfqDetail.quotations as any[]) {
      const supplierName = q.supplier?.name || q.supplier?.code || 'NCC';
      let quotTotal = 0;
      for (const qi of q.items || []) {
        const prItem = qi.purchaseRequestItemId
          ? prItemsMap.get(qi.purchaseRequestItemId)
          : null;
        const peerMin =
          qi.purchaseRequestItemId != null
            ? minUnitByPrItemId.get(qi.purchaseRequestItemId) ?? null
            : null;
        const rfqUnit = Number(qi.unitPrice) || 0;
        const rfqTotal = Number(qi.totalPrice) || 0;
        quotTotal += rfqTotal;
        const diff = peerMin != null ? rfqUnit - peerMin : 0;
        const diffPercent =
          peerMin != null && peerMin !== 0 ? (diff / peerMin) * 100 : 0;
        const { status, label } = getStatus(diffPercent);
        if (status === 'over') hasOver = true;
        rowsList.push({
          id: `${q.id}-${qi.id}`,
          itemDesc: prItem?.description || qi.description || '-',
          lineNo: prItem?.lineNo ?? qi.lineNo ?? 0,
          qty: Number(prItem?.qty ?? qi.qty) || 0,
          minPeerUnit: peerMin,
          supplierName,
          quotationId: q.id,
          rfqUnitPrice: rfqUnit,
          rfqTotalPrice: rfqTotal,
          diff,
          diffPercent,
          status,
          statusLabel: label,
        });
      }
      quotationTotalsList.push({
        quotationId: q.id,
        supplierName,
        total: quotTotal,
      });
    }
    const minT =
      quotationTotalsList.length > 0
        ? Math.min(...quotationTotalsList.map((x) => x.total))
        : 0;
    return {
      rows: rowsList,
      minQuoteTotal: minT,
      quotationTotals: quotationTotalsList,
      hasAnyOver: hasOver,
    };
  }, [rfqDetail]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const keyword = searchQuery.trim().toLowerCase();
      const hitKeyword =
        keyword.length === 0 ||
        row.itemDesc.toLowerCase().includes(keyword) ||
        row.supplierName.toLowerCase().includes(keyword);
      const hitStatus = statusFilter === 'all' || row.status === statusFilter;
      return hitKeyword && hitStatus;
    });
  }, [rows, searchQuery, statusFilter]);

  useEffect(() => {
    if (loadingRfq) {
      setIsTableVisible(false);
      return;
    }
    const rafId = window.requestAnimationFrame(() => setIsTableVisible(true));
    return () => window.cancelAnimationFrame(rafId);
  }, [loadingRfq, rows.length, selectedRfqId]);

  /** Tổng hợp cho footer: best/max, độ lệch TB, ghi chú buyer */
  const footerSummary = useMemo(() => {
    if (!quotationTotals.length || minQuoteTotal <= 0) {
      return {
        bestPrice: 0,
        bestSupplier: '',
        maxQuote: 0,
        maxSupplier: '',
        avgVariancePct: 0,
        overItems: [] as { supplierName: string; itemDesc: string }[],
      };
    }
    const totals = quotationTotals;
    const best = totals.reduce((a, b) => (a.total <= b.total ? a : b));
    const max = totals.reduce((a, b) => (a.total >= b.total ? a : b));
    const variances = totals.map((qt) => ((qt.total - minQuoteTotal) / minQuoteTotal) * 100);
    const avgVariancePct = variances.reduce((s, v) => s + v, 0) / variances.length;
    const overItems = rows
      .filter((r) => r.status === 'over')
      .map((r) => ({ supplierName: r.supplierName, itemDesc: r.itemDesc }));
    return {
      bestPrice: best.total,
      bestSupplier: best.supplierName,
      maxQuote: max.total,
      maxSupplier: max.supplierName,
      avgVariancePct,
      overItems,
    };
  }, [quotationTotals, minQuoteTotal, rows]);

  const onPrChange = (prId: string) => {
    setSelectedPrId(prId);
    setSelectedRfqId('');
    setSearchQuery('');
    setStatusFilter('all');
  };
  const onRfqChange = (rfqId: string) => setSelectedRfqId(rfqId);
  const showTableSkeleton = !!selectedRfqId && (loadingRfq || !isTableVisible);

  return (
    <div className={`${buyerOutletPageShellClass} animate-fade-in-right fade-in-right-delay-0`}>
      <div className={buyerWorkspacePageStackClass}>
      <BuyerPageHero
        kicker="Buyer · So sánh"
        title="So sánh báo giá NCC"
        description="Phân tích tài chính RFQ — đối chiếu báo giá nhà cung cấp"
        Icon={Scale}
        tint="azure"
        regionLabel="So sánh báo giá NCC"
      />

        <article className={buyerWorkspaceFiltersCardClass}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[180px] flex-1 items-center gap-2">
              <CustomSelect
                value={selectedPrId}
                onChange={(e) => onPrChange(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              >
                <option value="">Chọn PR</option>
                {prOptions.map((o: { value: string; label: string }) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </CustomSelect>
            </div>
            <div className="flex min-w-[180px] flex-1 items-center gap-2">
              <CustomSelect
                value={selectedRfqId}
                onChange={(e) => onRfqChange(e.target.value)}
                disabled={!selectedPrId || rfqOptions.length === 0}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 disabled:opacity-50"
              >
                <option value="">Chọn RFQ</option>
                {rfqOptions.map((o: { value: string; label: string }) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </CustomSelect>
            </div>
            <div className="relative min-w-0 flex-[2]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Tìm NCC hoặc tên item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
            <div className="flex min-w-[220px] flex-1 items-center gap-2">
              <Filter className="h-5 w-5 shrink-0 text-slate-500" strokeWidth={1.5} />
              <CustomSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | RowStatus)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              >
                <option value="all">Tất cả trạng thái dòng</option>
                <option value="ok">OK</option>
                <option value="warn">Sát ngưỡng</option>
                <option value="over">Vượt</option>
              </CustomSelect>
            </div>
          </div>
        </article>

        <article className={buyerWorkspaceDataCardClass}>
          <div className={buyerWorkspaceTableTitleBarClass}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-900">Danh sách so sánh ({filteredRows.length} dòng)</h2>
              {statusBadge && <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusBadge.className}`}>{statusBadge.label}</span>}
            </div>
          </div>
          <div className={`relative w-full ${buyerWorkspaceTableViewportClass}`}>
            {showTableSkeleton && (
              <div className="absolute inset-0 z-20 bg-white">
                <table className={`${buyerInteractiveTableClass} w-full min-w-[980px] text-sm`}>
                  <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Nhà cung cấp</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Sản phẩm / Item</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">SL</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Đơn giá thấp nhất</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Đơn giá NCC</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Chênh lệch</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">%</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className={buyerInteractiveTableBodyClass}>
                    {Array.from({ length: 6 }).map((_, idx) => (
                        <tr
                        key={`skeleton-${idx}`}
                        className={`h-[72px] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FBFCFE]'}`}
                      >
                        <td colSpan={8} className="px-6 py-4">
                          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {selectedRfqId ? (
              buyerPricingHidden && !loadingRfq ? (
                <div className="flex h-full min-h-[12rem] items-center justify-center px-6 py-12 text-center">
                  <div className="max-w-md space-y-2">
                    <AlertCircle className="mx-auto h-10 w-10 text-amber-500" strokeWidth={1.5} />
                    <p className="font-semibold text-slate-800">Không hiển thị bảng so giá cho Buyer</p>
                    <p className="text-sm text-slate-600">
                      Thông tin đơn giá và tổng báo giá được giới hạn với Buyer Leader. Bạn vẫn nhập báo giá NCC ở mục Quản lý báo giá như quy trình.
                    </p>
                  </div>
                </div>
              ) : filteredRows.length > 0 ? (
                <table
                  className={`${buyerInteractiveTableClass} w-full min-w-[980px] text-sm`}
                  style={{ visibility: showTableSkeleton ? 'hidden' : 'visible' }}
                >
                  <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 backdrop-blur-[12px]">
                    <tr>
                      <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Nhà cung cấp</th>
                      <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Sản phẩm / Item</th>
                      <th className="w-20 bg-slate-50/95 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">SL</th>
                      <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Đơn giá thấp nhất</th>
                      <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Đơn giá NCC</th>
                      <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Chênh lệch</th>
                      <th className="w-16 bg-slate-50/95 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">%</th>
                      <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className={buyerInteractiveTableBodyClass}>
                    {filteredRows.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={`group ${buyerTableDataRowVisual(idx)}`}
                        style={{ animationDelay: `${Math.min(idx * 45, 360)}ms` }}
                      >
                        <td className="relative px-6 py-4">
                          <div aria-hidden className={buyerTableAccentRailClass} />
                          <div className={`${buyerTableFirstCellInnerClass} ${buyerTableCellWrapClass}`}>
                            <span className="font-semibold text-slate-800">{row.supplierName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={buyerTableCellWrapClass}>
                            <span className="font-medium text-slate-900">{row.itemDesc}</span>
                            <span className="mt-0.5 block text-xs text-slate-500">ID: #ITEM-{row.lineNo || idx + 1}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          <div className={buyerTableCellWrapClass}>{row.qty}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">
                          <div className={buyerTableCellWrapClass}>
                            {row.minPeerUnit != null ? formatCurrency(row.minPeerUnit, '') : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={buyerTableCellWrapClass}>
                            <span className="font-bold text-blue-600">{formatCurrency(row.rfqUnitPrice, '')}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={buyerTableCellWrapClass}>
                            <span className={`inline-flex items-center gap-1 font-medium ${row.diff > 0 ? 'text-red-600' : row.diff < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                              {row.diff > 0 && <TrendingUp className="h-4 w-4" />}
                              {row.diff >= 0 ? '+' : ''}
                              {formatCurrency(row.diff, '')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={buyerTableCellWrapClass}>
                            <span className={row.diffPercent > 0 ? 'font-medium text-red-600' : row.diffPercent < 0 ? 'font-medium text-emerald-600' : 'text-slate-600'}>
                              {row.diffPercent >= 0 ? '+' : ''}
                              {row.diffPercent.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className={buyerTableCellWrapClass}>
                          {row.status === 'over' && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-semibold uppercase text-red-700">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Vượt
                            </span>
                          )}
                          {row.status === 'warn' && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Sát ngưỡng</span>}
                          {row.status === 'ok' && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              OK
                            </span>
                          )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex h-full min-h-[12rem] items-center justify-center px-6 py-12 text-center text-slate-500" style={{ visibility: showTableSkeleton ? 'hidden' : 'visible' }}>
                  <div className="flex flex-col items-center gap-2">
                    <User className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
                    <p className="font-medium text-slate-600">Không có dòng phù hợp bộ lọc</p>
                    <p className="text-xs text-slate-500">Đổi trạng thái hoặc từ khóa để xem lại dữ liệu</p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex h-full min-h-[12rem] items-center justify-center px-6 py-12 text-center text-slate-500">
                <div className="flex flex-col items-center gap-2">
                  <Scale className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
                  <p className="font-medium text-slate-600">Chọn PR và RFQ để hiển thị danh sách so sánh</p>
                  <p className="text-xs text-slate-500">Bảng sẽ hiển thị theo đúng công thức list của dashboard V3</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex-none border-t border-slate-200 bg-white px-3 py-3 sm:px-4">
            <div className="text-sm text-slate-600">
              <p>
                Hiển thị <span className="font-semibold text-slate-900">{filteredRows.length}</span> /{' '}
                <span className="font-semibold text-slate-900">{rows.length}</span> dòng
              </p>
            </div>
          </div>
        </article>

      {selectedRfqId && !loadingRfq && rfqDetail && !buyerPricingHidden && (
        <>
          {/* Tổng quan: tổng báo giá so với NCC thấp nhất trong RFQ */}
          {quotationTotals.length > 0 && minQuoteTotal > 0 && (
            <div className="rounded-xl shadow-lg bg-slate-800 text-white p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Tổng quan so sánh nhà cung cấp</h3>
                  <p className="text-sm text-slate-300 mt-0.5">
                    So sánh tổng báo giá với NCC có tổng thấp nhất trong RFQ (100%)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Tổng thấp nhất
                  </p>
                  <p className="text-xl font-bold text-white">
                    {formatCurrency(minQuoteTotal, rfqDetail.purchaseRequest?.currency || 'VND')}
                  </p>
                </div>
              </div>
              {quotationTotals.map((qt) => {
                const rfqPct = minQuoteTotal > 0 ? (qt.total / minQuoteTotal) * 100 : 0;
                const overPct = Math.max(0, rfqPct - 100);
                const maxPct = Math.max(100, Math.min(500, rfqPct));
                const baseBarWidth = (100 / maxPct) * 100;
                const overBarWidth = rfqPct > 100 ? ((rfqPct - 100) / maxPct) * 100 : 0;
                return (
                  <div key={qt.quotationId} className="space-y-1.5">
                    <p className="text-sm font-medium text-white">{qt.supplierName}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-7 bg-slate-700 rounded-lg overflow-hidden flex min-w-0">
                        <div
                          className="bg-blue-500 h-full flex-shrink-0"
                          style={{ width: `${baseBarWidth}%` }}
                          title="So với tổng thấp nhất (100%)"
                        />
                        {overBarWidth > 0 && (
                          <div
                            className="bg-red-500 h-full flex-shrink-0"
                            style={{ width: `${overBarWidth}%` }}
                            title="Cao hơn tổng thấp nhất"
                          />
                        )}
                      </div>
                      <span className="text-xs text-slate-300 whitespace-nowrap w-36 text-right">
                        {rfqPct > 100 ? (
                          <span className="text-red-400 font-semibold">
                            +{overPct.toFixed(0)}% so với thấp nhất
                          </span>
                        ) : (
                          <span className="text-emerald-400">
                            Ngang hoặc thấp hơn tổng thấp nhất
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Tổng báo giá: {formatCurrency(qt.total, rfqDetail.purchaseRequest?.currency || 'VND')}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer: 3 thẻ — Kết luận đánh giá, Tổng giá trị RFQ, Ghi chú cho Buyer */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Thẻ 1: KẾT LUẬN ĐÁNH GIÁ */}
            <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                    hasAnyOver ? 'bg-red-100' : 'bg-emerald-100'
                  }`}
                >
                  {hasAnyOver ? (
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Kết luận đánh giá
                  </p>
                  <p
                    className={`mt-1 text-lg font-bold ${
                      hasAnyOver ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    {hasAnyOver ? 'Có dòng chênh lệch lớn' : 'Các dòng tương đối đồng đều'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {hasAnyOver
                      ? 'Có ít nhất một dòng đơn giá cao hơn đáng kể so với mức thấp nhất giữa các NCC (cùng dòng). Có thể đàm phán thêm.'
                      : 'Các đơn giá gần với mức thấp nhất giữa các báo giá trong RFQ.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Thẻ 2: TỔNG GIÁ TRỊ RFQ HIỆN TẠI */}
            <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
                  <Sigma className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="text-sm font-bold text-slate-900">Tổng giá trị RFQ hiện tại</p>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Thấp nhất (Best Price)</p>
                  <p className="font-semibold text-emerald-600">
                    {formatCurrency(footerSummary.bestPrice, rfqDetail.purchaseRequest?.currency || 'VND')}
                    {footerSummary.bestSupplier && (
                      <span className="text-slate-500 font-normal text-xs ml-1">
                        — {footerSummary.bestSupplier}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Cao nhất (Max Quote)</p>
                  <p className="font-semibold text-slate-900">
                    {footerSummary.maxQuote >= 1e12
                      ? (footerSummary.maxQuote / 1e12).toFixed(2) + 'T VND'
                      : formatCurrency(footerSummary.maxQuote, '')}
                    {footerSummary.maxSupplier && (
                      <span className="text-slate-500 font-normal text-xs ml-1">
                        — {footerSummary.maxSupplier}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 underline decoration-slate-300">
                    Độ lệch TB so với tổng thấp nhất
                  </p>
                  <p
                    className={`font-semibold ${
                      footerSummary.avgVariancePct > 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    {footerSummary.avgVariancePct >= 0 ? '+' : ''}
                    {footerSummary.avgVariancePct.toFixed(1)}% Avg
                  </p>
                </div>
              </div>
            </div>

            {/* Thẻ 3: GHI CHÚ CHO BUYER */}
            <div className="bg-white rounded-xl shadow border border-slate-200 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                Ghi chú cho Buyer
              </p>
              <ul className="space-y-2 text-sm">
                {footerSummary.bestSupplier && (
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span className="text-slate-700">
                      <strong>{footerSummary.bestSupplier}</strong> có tổng báo giá thấp nhất trong RFQ đang xem.
                    </span>
                  </li>
                )}
                {footerSummary.overItems.length > 0 && (
                  footerSummary.overItems.slice(0, 2).map((o, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      <span className="text-slate-700">
                        <strong>{o.supplierName}</strong>: dòng &quot;{o.itemDesc}&quot; cao hơn đáng kể so với mức
                        thấp nhất cùng dòng giữa các NCC.
                      </span>
                    </li>
                  ))
                )}
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span className="text-slate-500">
                    Vui lòng kiểm tra lại đơn vị tính nếu có sự sai khác lớn.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </>
      )}

      {selectedRfqId && !loadingRfq && !rfqDetail && (
        <div className="max-w-lg min-w-0">
          <div className={dashboardV3ErrorCardClass}>
            <p className="text-lg font-bold text-rose-900">Không tải được chi tiết RFQ</p>
            <p className="mt-2 text-sm font-medium text-rose-800/90">
              Kiểm tra quyền truy cập hoặc thử lại.
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default PriceComparison;
