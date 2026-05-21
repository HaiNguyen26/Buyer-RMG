import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Clock,
  History,
  Inbox,
  Package,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import { roleDashboardPanelCardClass } from '../../constants/roleDashboardLayout';
import {
  warehouseWorkspacePageContentScrollClass,
  warehouseWorkspacePageShellScrollClass,
} from '../../constants/warehouseLayout';
import {
  departmentHeadInteractiveTableClass,
  departmentHeadTableAccentRailClass,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableDataRowClasses,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableTbodyElevatedClass,
} from '../../constants/departmentHeadLayout';
import { saasTableCodeCellClass, saasTableHeadCellClass, saasTableRootClass } from '../../constants/saasDataTable';
import {
  warehouseService,
  type GrnHistoryDetail,
  type GrnHistoryListRow,
  type GrnHistoryStatus,
} from '../../services/warehouseService';

const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'FULL', label: 'FULL' },
  { id: 'PARTIAL', label: 'PARTIAL' },
  { id: 'PENDING_QC', label: 'PENDING QC' },
  { id: 'CANCELLED', label: 'CANCELLED' },
];

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
    n
  );
}

function GrnStatusBadge({ status }: { status: GrnHistoryStatus }) {
  const map: Record<GrnHistoryStatus, string> = {
    FULL: 'inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700',
    PARTIAL:
      'inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-700',
    PENDING_QC:
      'inline-flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700',
    CANCELLED:
      'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600',
  };
  const label: Record<GrnHistoryStatus, string> = {
    FULL: 'FULL — Nhận đủ',
    PARTIAL: 'PARTIAL — Một phần',
    PENDING_QC: 'PENDING QC',
    CANCELLED: 'CANCELLED — Hủy',
  };
  const dot: Record<GrnHistoryStatus, string> = {
    FULL: 'bg-emerald-500',
    PARTIAL: 'bg-amber-500',
    PENDING_QC: 'bg-indigo-500 animate-pulse',
    CANCELLED: 'bg-slate-400',
  };
  return (
    <span className={map[status]}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status]}`} aria-hidden />
      {label[status]}
    </span>
  );
}

function MetricTile({
  label,
  value,
  Icon,
  iconClass,
  iconWrap,
}: {
  label: string;
  value: string;
  Icon: typeof Inbox;
  iconClass: string;
  iconWrap: string;
}) {
  return (
    <div
      className={`flex items-center justify-between ${roleDashboardPanelCardClass} !p-4 !shadow-sm`}
    >
      <div>
        <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className="mt-1 block text-lg font-black text-slate-900">{value}</span>
      </div>
      <div className={`rounded-xl border p-2.5 ${iconWrap}`}>
        <Icon className={`h-5 w-5 ${iconClass}`} strokeWidth={2} aria-hidden />
      </div>
    </div>
  );
}

function GrnDetailPanel({ detail, isLoading }: { detail: GrnHistoryDetail | undefined; isLoading: boolean }) {
  if (isLoading || !detail) {
    return (
      <div className="flex items-center justify-center px-8 py-16 text-sm text-slate-500">
        {isLoading ? 'Đang tải chi tiết…' : 'Chọn một phiếu GRN để xem chi tiết'}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
        <div>
          <span className="mb-0.5 block text-[9px] font-extrabold uppercase tracking-widest text-slate-400">
            Chi tiết nhận kho
          </span>
          <h3 className="text-sm font-black text-slate-900">{detail.grnNumber}</h3>
        </div>
        <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
          {detail.receiver}
        </span>
      </div>

      <div className="space-y-5 p-5 pb-6">
        <div className={`space-y-3 ${roleDashboardPanelCardClass}`}>
          <div className="flex items-start gap-2.5">
            <div className="rounded-xl border border-indigo-100/50 bg-indigo-500/5 p-2.5 text-indigo-600">
              <Building2 className="h-4 w-4" strokeWidth={2} aria-hidden />
            </div>
            <div>
              <span className="block text-[9px] font-bold uppercase text-slate-400">Đơn vị giao hàng</span>
              <h4 className="text-xs font-black leading-snug text-slate-900">{detail.vendorFull}</h4>
            </div>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="grid grid-cols-2 gap-4 text-[11px]">
            <div>
              <span className="block font-bold text-slate-400">MÃ PO</span>
              <span className="font-bold text-slate-700">{detail.poNumber}</span>
            </div>
            <div>
              <span className="block font-bold text-slate-400">GIÁ TRỊ LẦN NHẬN</span>
              <span className="font-extrabold text-indigo-600">{formatVnd(detail.estimatedValueVnd)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GrnStatusBadge status={detail.status} />
            <span className="text-[10px] text-slate-500">
              {detail.receivedDate}
              {detail.receivedTime && detail.receivedTime !== '—' ? ` · ${detail.receivedTime}` : null}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            <Package className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
            Hạng mục thực tế nhận
          </h4>
          <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50 text-[9px] font-bold uppercase text-slate-400">
                  <th className="px-4 py-2.5">Vật tư</th>
                  <th className="w-12 px-2 py-2.5 text-center">Đặt</th>
                  <th className="w-12 px-2 py-2.5 text-center">XN</th>
                  <th className="w-12 px-2 py-2.5 text-center">Nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {detail.items.map((item) => (
                  <tr key={item.poItemId} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <span className="block font-extrabold text-slate-900">{item.name}</span>
                      {item.partNo ? (
                        <span className="mt-0.5 block text-[9px] font-semibold text-slate-400">
                          Part: {item.partNo}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 text-center text-slate-400">{item.ordered}</td>
                    <td className="px-2 py-3 text-center text-slate-500">{item.confirmed}</td>
                    <td
                      className={`px-2 py-3 text-center font-extrabold ${
                        item.receivedThis >= item.confirmed ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {item.receivedThis}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-200/60 pt-4">
          <h4 className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            <Clock className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
            Luồng giao nhận
          </h4>
          <div className="relative space-y-4 pl-4 before:absolute before:bottom-1 before:left-[3px] before:top-1.5 before:w-[1.5px] before:bg-slate-200">
            {detail.timeline.map((event, idx) => (
              <div key={`${event.title}-${idx}`} className="relative">
                <div
                  className={`absolute -left-[16.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white ${
                    event.done ? 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.35)]' : 'bg-slate-300'
                  }`}
                  aria-hidden
                />
                <div className="text-[11px]">
                  <div className="flex items-center justify-between font-bold">
                    <span className={event.done ? 'text-slate-800' : 'text-slate-400'}>{event.title}</span>
                    <span className="text-[9px] font-bold text-slate-400">{event.date}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">{event.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Link
          to={`/dashboard/warehouse/incoming/${detail.poId}/grn`}
          className="inline-flex text-xs font-semibold text-teal-700 hover:underline"
        >
          Mở PO / nhập thêm trên phiếu này →
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden />
        Dữ liệu GRN · đồng bộ tồn kho
      </div>
    </div>
  );
}

const GrnHistory = () => {
  const [searchParams] = useSearchParams();
  const grnFromUrl = searchParams.get('grn')?.trim() || null;
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(grnFromUrl);

  useEffect(() => {
    if (grnFromUrl) setSelectedId(grnFromUrl);
  }, [grnFromUrl]);

  const listParams = useMemo(
    () => ({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(from.trim() ? { from: from.trim() } : {}),
      ...(to.trim() ? { to: to.trim() } : {}),
      ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
    }),
    [search, from, to, statusFilter]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['warehouse-grn-history', listParams],
    queryFn: () => warehouseService.listGrnHistory(listParams),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const grns = data?.grns ?? [];
  const summary = data?.summary;

  useEffect(() => {
    if (!grns.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !grns.some((g) => g.id === selectedId)) {
      setSelectedId(grns[0]!.id);
    }
  }, [grns, selectedId]);

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['warehouse-grn-history-detail', selectedId],
    queryFn: () => warehouseService.getGrnHistoryDetail(selectedId!),
    enabled: Boolean(selectedId),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  /** lg: chiều cao khối trái = cột chi tiết (bảng kéo dài theo, cuộn trong vùng bảng khi nhiều dòng). */
  const detailColumnRef = useRef<HTMLDivElement>(null);
  const [pairedDetailHeightPx, setPairedDetailHeightPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = detailColumnRef.current;
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      if (!mq.matches || !el) {
        setPairedDetailHeightPx(null);
        return;
      }
      setPairedDetailHeightPx(Math.round(el.getBoundingClientRect().height));
    };

    const ro = el ? new ResizeObserver(sync) : null;
    if (el && ro) ro.observe(el);
    mq.addEventListener('change', sync);
    sync();
    const raf = window.requestAnimationFrame(() => sync());
    const t = window.setTimeout(sync, 0);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
      ro?.disconnect();
      mq.removeEventListener('change', sync);
    };
  }, [detail, detailLoading, selectedId, grns.length, isLoading, error]);

  const leftColumnPairStyle =
    pairedDetailHeightPx != null
      ? { minHeight: pairedDetailHeightPx, height: pairedDetailHeightPx, maxHeight: pairedDetailHeightPx }
      : undefined;

  return (
    <div className={warehouseWorkspacePageShellScrollClass}>
      <div className={warehouseWorkspacePageContentScrollClass}>
        <RequestorPageHero
          kicker="Kho · GRN History"
          title="Lịch sử nhập kho"
          description="Phiếu đã nhận — tra PO, NCC, partial/full, người nhận và thời điểm. Khác màn PO chờ nhận (incoming)."
          Icon={History}
          tint="cyan"
          regionLabel="Lịch sử GRN"
        />

        {summary ? (
          <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-4">
            <MetricTile
              label="Hôm nay nhận"
              value={`${summary.receivedTodayPoCount} PO`}
              Icon={Inbox}
              iconClass="text-indigo-600"
              iconWrap="border-indigo-100/50 bg-indigo-50"
            />
            <MetricTile
              label="SL đã nhận (lọc)"
              value={`${summary.itemsReceivedQty.toLocaleString('vi-VN')} item`}
              Icon={CheckCircle2}
              iconClass="text-emerald-600"
              iconWrap="border-emerald-100/50 bg-emerald-50"
            />
            <MetricTile
              label="Nhận một phần"
              value={`${summary.partialGrnCount} phiếu`}
              Icon={Clock}
              iconClass="text-amber-600"
              iconWrap="border-amber-100/50 bg-amber-50"
            />
            <MetricTile
              label="Thực nhận tháng này"
              value={formatVnd(summary.totalValueMonthVnd)}
              Icon={TrendingUp}
              iconClass="text-violet-600"
              iconWrap="border-violet-100/50 bg-violet-50"
            />
          </div>
        ) : null}

        {summary && summary.overdueIncomingLines > 0 ? (
          <p className="shrink-0 text-xs text-amber-800">
            <span className="font-semibold">{summary.overdueIncomingLines} dòng PO</span> quá ETA trên màn{' '}
            <Link to="/dashboard/warehouse/incoming" className="font-bold text-teal-700 underline">
              PO chờ nhận
            </Link>
            .
          </p>
        ) : null}

        <div
          className={`flex flex-col lg:flex-row lg:items-start ${roleDashboardPanelCardClass} !overflow-visible !p-0`}
        >
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden p-4 sm:p-5"
            style={leftColumnPairStyle}
          >
            <div className="flex shrink-0 flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/65 p-3">
              <label className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Mã GRN, PO, NCC…"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-semibold text-slate-800 outline-none ring-indigo-500/20 focus:border-indigo-500 focus:ring-4"
                />
              </label>
              <label className="flex min-w-[120px] flex-col gap-1 text-[10px] font-bold uppercase text-slate-500">
                Từ ngày
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                />
              </label>
              <label className="flex min-w-[120px] flex-col gap-1 text-[10px] font-bold uppercase text-slate-500">
                Đến ngày
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                />
              </label>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
                  {STATUS_FILTERS.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStatusFilter(st.id)}
                      className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase transition ${
                        statusFilter === st.id
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
              {isLoading ? (
                <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-slate-500">
                  Đang tải lịch sử GRN…
                </div>
              ) : error ? (
                <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-red-600">
                  Không tải được lịch sử nhập kho.
                </div>
              ) : grns.length === 0 ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
                  <div className="shrink-0 overflow-x-auto border-b border-slate-200">
                    <table
                      className={`${departmentHeadInteractiveTableClass} ${saasTableRootClass} min-w-[640px] w-full text-left`}
                    >
                      <thead className="bg-[#F8FAFC]">
                        <tr>
                          <th className={`${saasTableHeadCellClass} border-b border-slate-200 bg-[#F8FAFC] px-4 py-3`}>
                            Mã GRN
                          </th>
                          <th className={`${saasTableHeadCellClass} border-b border-slate-200 bg-[#F8FAFC] px-4 py-3`}>
                            PO
                          </th>
                          <th className={`${saasTableHeadCellClass} border-b border-slate-200 bg-[#F8FAFC] px-4 py-3`}>
                            NCC
                          </th>
                          <th className={`${saasTableHeadCellClass} border-b border-slate-200 bg-[#F8FAFC] px-4 py-3`}>
                            Ngày nhận
                          </th>
                          <th
                            className={`${saasTableHeadCellClass} border-b border-slate-200 bg-[#F8FAFC] px-4 py-3 text-right`}
                          >
                            Trạng thái
                          </th>
                        </tr>
                      </thead>
                    </table>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-slate-500">
                    Chưa có phiếu GRN phù hợp bộ lọc.
                  </div>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-auto [scrollbar-width:thin]">
                  <table
                    className={`${departmentHeadInteractiveTableClass} ${saasTableRootClass} min-w-[640px] bg-white text-left`}
                  >
                    <thead className="sticky top-0 z-10 bg-[#F8FAFC] shadow-[inset_0_-1px_0_0_rgb(226,232,240)]">
                      <tr>
                        <th
                          className={`${saasTableHeadCellClass} border-b border-slate-200 bg-[#F8FAFC] px-4 py-3`}
                        >
                          Mã GRN
                        </th>
                        <th
                          className={`${saasTableHeadCellClass} border-b border-slate-200 bg-[#F8FAFC] px-4 py-3`}
                        >
                          PO
                        </th>
                        <th
                          className={`${saasTableHeadCellClass} border-b border-slate-200 bg-[#F8FAFC] px-4 py-3`}
                        >
                          NCC
                        </th>
                        <th
                          className={`${saasTableHeadCellClass} border-b border-slate-200 bg-[#F8FAFC] px-4 py-3`}
                        >
                          Ngày nhận
                        </th>
                        <th
                          className={`${saasTableHeadCellClass} border-b border-slate-200 bg-[#F8FAFC] px-4 py-3 text-right`}
                        >
                          Trạng thái
                        </th>
                      </tr>
                    </thead>
                    <tbody className={departmentHeadTableTbodyElevatedClass}>
                      {grns.map((row: GrnHistoryListRow, index) => (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedId(row.id)}
                          className={`cursor-pointer ${departmentHeadTableDataRowClasses(index, { h72: true })} ${
                            selectedId === row.id ? 'bg-indigo-50/40' : ''
                          }`}
                        >
                          <td className={`relative px-4 py-3 ${saasTableCodeCellClass}`}>
                            <div aria-hidden className={departmentHeadTableAccentRailClass} />
                            <div
                              className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass} font-semibold text-slate-900`}
                            >
                              {row.grnNumber}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.poNumber}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{row.vendor}</td>
                          <td className="px-4 py-3">
                            <span className="block font-medium tabular-nums text-slate-700">
                              {row.receivedDate}
                            </span>
                            {row.receivedTime && row.receivedTime !== '—' ? (
                              <span className="text-[10px] text-slate-400">{row.receivedTime}</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <GrnStatusBadge status={row.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div
            ref={detailColumnRef}
            className="flex w-full shrink-0 flex-col border-t border-slate-200 bg-[#fafbfe] lg:w-[400px] lg:border-l lg:border-t-0"
          >
            <GrnDetailPanel detail={detail} isLoading={detailLoading && Boolean(selectedId)} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrnHistory;
