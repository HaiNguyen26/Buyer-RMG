import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ClipboardList,
  DollarSign,
  FileSpreadsheet,
  Package,
  RefreshCw,
  ShoppingCart,
  Timer,
  Truck,
} from 'lucide-react';
import CustomSelect from '../../components/CustomSelect';
import { ProcurementMonitorPrDetailModal } from '../../components/procurement-monitoring/ProcurementMonitorPrDetailModal';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import { StatCard } from '../../components/buyer-manager/StatCard';
import { SectionHeader } from '../../components/buyer-manager/SectionHeader';
import {
  DashboardV3ShimmerBlock,
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
} from '../../components/dashboard/DashboardV3Chrome';
import {
  procurementMonitorKpiGridClass,
  procurementMonitorKpiIslandPaddingClass,
  procurementMonitorPageContentClass,
  procurementMonitorPageRootClass,
  procurementMonitorTableFrameClass,
  procurementMonitorTableHeadStickyClass,
  procurementMonitorTableIslandClass,
  procurementMonitorTableScrollClass,
} from '../../constants/procurementMonitoringLayout';
import { useToast } from '../../contexts/ToastContext';
import {
  downloadProcurementMonitorExcel,
  fetchProcurementMonitoring,
  type MonitorApiBase,
  type MonitorExportLifecycle,
  type MonitorSlaLevel,
} from '../../services/procurementMonitoringService';
import { downloadBlob } from '../../utils/downloadBlob';
import { PROCUREMENT_MONITOR_HERO } from './procurementMonitoringHeroConfig';

const EXPORT_LIFECYCLE_OPTIONS: { value: MonitorExportLifecycle; label: string }[] = [
  { value: 'all', label: 'Tất cả (trừ nháp)' },
  { value: 'pending', label: 'Đang xử lý' },
  { value: 'completed', label: 'Hoàn thành' },
];

function formatVnd(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`;
  return new Intl.NumberFormat('vi-VN').format(n);
}

function formatEta(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function slaBadgeClass(sla: MonitorSlaLevel) {
  if (sla === 'critical') return 'bg-rose-100 text-rose-800 ring-rose-200';
  if (sla === 'warning') return 'bg-amber-100 text-amber-800 ring-amber-200';
  if (sla === 'completed') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
}

type Props = {
  apiBase: MonitorApiBase;
};

export default function ProcurementMonitoringDashboard({ apiBase }: Props) {
  const hero = PROCUREMENT_MONITOR_HERO[apiBase];
  const { showSuccess, showError } = useToast();
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [exportLifecycle, setExportLifecycle] = useState<MonitorExportLifecycle>('all');
  const [exportLoading, setExportLoading] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['procurement-monitor', apiBase],
    queryFn: () => fetchProcurementMonitoring(apiBase),
    staleTime: 20_000,
  });

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.rows;
    return data.rows.filter(
      (r) =>
        r.prNumber.toLowerCase().includes(q) ||
        (r.buyerName?.toLowerCase().includes(q) ?? false) ||
        r.currentStep.toLowerCase().includes(q)
    );
  }, [data?.rows, search]);

  const mainTableViewportClass =
    filteredRows.length >= 7
      ? procurementMonitorTableScrollClass
      : procurementMonitorTableFrameClass;

  const criticalAlertCount = useMemo(
    () => data?.alerts.filter((a) => a.severity === 'critical').length ?? 0,
    [data?.alerts]
  );

  const handleExportExcel = async () => {
    setExportLoading(true);
    try {
      const blob = await downloadProcurementMonitorExcel(apiBase, exportLifecycle);
      const stamp = new Date().toISOString().slice(0, 10);
      const lifecycleSlug =
        exportLifecycle === 'all'
          ? 'tat-ca'
          : exportLifecycle === 'pending'
            ? 'dang-xu-ly'
            : 'hoan-thanh';
      const filename =
        (blob as Blob & { filename?: string }).filename ??
        `Giam_sat_mua_hang_${lifecycleSlug}_${stamp}.xlsx`;
      downloadBlob(blob, filename);
      const filterLabel =
        EXPORT_LIFECYCLE_OPTIONS.find((o) => o.value === exportLifecycle)?.label ?? '';
      showSuccess(`Đã xuất Excel (${filterLabel}) — sheet PR và PO cho báo cáo cấp trên.`);
    } catch (e) {
      console.error(e);
      showError(e instanceof Error ? e.message : 'Không xuất được Excel. Vui lòng thử lại.');
    } finally {
      setExportLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={procurementMonitorPageRootClass}>
        <div className={`${procurementMonitorPageContentClass} animate-pulse`}>
          <DashboardV3ShimmerBlock className="h-28 w-full rounded-[28px] sm:h-32" />
          <DashboardV3ShimmerBlock className="h-36 w-full rounded-[24px]" />
          <DashboardV3ShimmerBlock className="min-h-[20rem] w-full rounded-[28px]" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={procurementMonitorPageRootClass}>
        <div className={procurementMonitorPageContentClass}>
          <div className="rounded-[28px] border border-rose-200/90 bg-rose-50/95 p-6 md:p-8">
            <p className="text-lg font-bold text-rose-900">Không tải được dữ liệu giám sát</p>
            <p className="mt-2 text-sm text-rose-800/90">Vui lòng thử lại sau.</p>
          </div>
        </div>
      </div>
    );
  }

  const k = data.kpis;

  return (
    <div className={procurementMonitorPageRootClass}>
      <div className={procurementMonitorPageContentClass}>
        <div className="shrink-0 pb-1">
          <RequestorPageHero
            kicker={hero.kicker}
            title={hero.title}
            description={hero.description}
            Icon={hero.Icon}
            tint={hero.tint}
            regionLabel={hero.regionLabel}
            rightSlot={
              <>
                <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 shadow-sm backdrop-blur-sm">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-white/65">
                    Phạm vi
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-white">{data.scopeLabel}</p>
                </div>
                {criticalAlertCount > 0 ? (
                  <div className="rounded-xl border border-rose-300/40 bg-rose-500/20 px-3 py-2.5">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-white/80">
                      Cảnh báo nghiêm trọng
                    </p>
                    <p className="mt-0.5 text-2xl font-black tabular-nums text-white">
                      {criticalAlertCount}
                    </p>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-3 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </>
            }
          />
        </div>

        <article
          className={`${dashboardV3IslandClass} ${dashboardV3IslandOpaqueClass} ${procurementMonitorKpiIslandPaddingClass}`}
        >
          <SectionHeader
            Icon={Activity}
            eyebrow="Chỉ số · Vận hành"
            title="Chỉ số giám sát mua hàng"
            description="PR đang chạy, PO đang giao, dòng chưa mua xong, trễ ETA và tổng giá trị sourcing."
          />
          <div className={`mt-4 ${procurementMonitorKpiGridClass} md:mt-5`}>
            <StatCard
              variant="bento"
              embedded
              compact
              accent="indigo"
              Icon={ClipboardList}
              label="PR đang xử lý"
              value={k.prInProgress}
              hint="PR đang xử lý trong phạm vi"
              activity={k.prInProgress > 0 ? 'active' : 'zero'}
            />
            <StatCard
              variant="bento"
              embedded
              compact
              accent="emerald"
              Icon={Truck}
              label="PO đang giao"
              value={k.poInTransit}
              hint="Đã gửi / NCC xác nhận / đang nhận"
              activity={k.poInTransit > 0 ? 'active' : 'zero'}
            />
            <StatCard
              variant="bento"
              embedded
              compact
              accent="amber"
              Icon={ShoppingCart}
              label="Dòng chưa mua xong"
              value={k.itemsAwaitingPurchase}
              hint="Số lượng chờ mua lại"
              activity={k.itemsAwaitingPurchase > 0 ? 'active' : 'zero'}
            />
            <StatCard
              variant="bento"
              embedded
              compact
              accent="rose"
              Icon={Timer}
              label="PO quá ETA"
              value={k.poOverEta}
              hint="Quá hạn giao, chưa nhận đủ"
              activity={k.poOverEta > 0 ? 'active' : 'zero'}
            />
            <StatCard
              variant="bento"
              embedded
              compact
              accent="slate"
              Icon={DollarSign}
              label="Tổng sourcing"
              value={formatVnd(k.totalSourcingValue)}
              unit="đ"
              hint="Tổng ngân sách PR đang theo dõi"
              activity={k.totalSourcingValue > 0 ? 'active' : 'zero'}
            />
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Cập nhật {new Date(data.generatedAt).toLocaleString('vi-VN')}
          </p>
        </article>

        <article
          className={`${dashboardV3IslandClass} ${dashboardV3IslandOpaqueClass} min-w-0 !rounded-[24px]`}
        >
          <SectionHeader
            Icon={ClipboardList}
            eyebrow="Bảng chính"
            title="Bảng giám sát PR / PO"
            description="Nhấn một dòng để xem vòng đời dòng hàng, RFQ, PO và phiếu nhận kho."
          />
          <div className="mt-4 md:mt-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
              <input
                type="search"
                placeholder="Tìm PR, buyer, bước hiện tại…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-900/[0.04] focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[11rem]">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Lọc báo cáo Excel
                  </label>
                  <CustomSelect
                    value={exportLifecycle}
                    onValueChange={(v) => setExportLifecycle(v as MonitorExportLifecycle)}
                    options={EXPORT_LIFECYCLE_OPTIONS}
                    className="w-full min-w-[11rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleExportExcel()}
                  disabled={exportLoading}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:opacity-60"
                >
                  <FileSpreadsheet
                    className={`h-4 w-4 ${exportLoading ? 'animate-pulse' : ''}`}
                  />
                  {exportLoading ? 'Đang xuất…' : 'Xuất Excel'}
                </button>
              </div>
            </div>
            <div className={mainTableViewportClass}>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className={`${procurementMonitorTableHeadStickyClass} text-xs uppercase text-slate-600`}>
                      <th className="px-3 py-3 font-semibold">PR</th>
                      <th className="px-3 py-3 font-semibold">Buyer</th>
                      <th className="px-3 py-3 font-semibold">Bước hiện tại</th>
                      <th className="px-3 py-3 font-semibold">ETA</th>
                      <th className="px-3 py-3 font-semibold">SLA</th>
                      <th className="px-3 py-3 font-semibold">Rủi ro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                          Không có PR đang theo dõi trong phạm vi
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr
                          key={row.prId}
                          className="cursor-pointer transition-colors hover:bg-indigo-50/60"
                          onClick={() => setSelectedPrId(row.prId)}
                        >
                          <td className="px-3 py-2.5 font-bold text-indigo-700">{row.prNumber}</td>
                          <td className="px-3 py-2.5 text-slate-700">{row.buyerName ?? '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-slate-900">{row.currentStep}</span>
                            {row.currentStepDetail ? (
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {row.currentStepDetail}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-slate-700">
                            {formatEta(row.eta)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${slaBadgeClass(row.sla)}`}
                            >
                              {row.slaLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {row.riskLabel ? (
                              <span className="text-xs font-semibold text-rose-700">
                                {row.riskLabel}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
              </table>
            </div>
          </div>
        </article>

        {data.reopenRows.length > 0 ? (
          <article className={`${dashboardV3IslandClass} ${dashboardV3IslandOpaqueClass}`}>
            <SectionHeader
              Icon={RefreshCw}
              eyebrow="Mua lại"
              title="Mua lại (reopen)"
              description="Mua hàng lỗi — buyer chưa xử lý lại; lý do hủy dòng PO / NCC."
            />
            <div className="mt-4 overflow-x-auto rounded-xl border border-amber-100 md:mt-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs uppercase text-slate-600">
                    <th className="px-3 py-2.5 text-left">PR</th>
                    <th className="px-3 py-2.5 text-left">Dòng hàng</th>
                    <th className="px-3 py-2.5 text-left">Buyer</th>
                    <th className="px-3 py-2.5 text-left">Lý do</th>
                    <th className="px-3 py-2.5 text-right">SL chờ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {data.reopenRows.map((r, i) => (
                    <tr
                      key={`${r.prId}-${i}`}
                      className="cursor-pointer hover:bg-amber-50/60"
                      onClick={() => setSelectedPrId(r.prId)}
                    >
                      <td className="px-3 py-2 font-bold text-indigo-700">{r.prNumber}</td>
                      <td className="px-3 py-2">{r.itemLabel}</td>
                      <td className="px-3 py-2">{r.buyerName ?? '—'}</td>
                      <td className="max-w-xs truncate px-3 py-2 text-slate-600">
                        {r.reason ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{r.qtyWaiting}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          {data.costRows.length > 0 ? (
            <article className={`${dashboardV3IslandClass} ${dashboardV3IslandOpaqueClass}`}>
              <SectionHeader
                Icon={DollarSign}
                eyebrow="Chi phí"
                title="Giám sát chi phí"
                description="Ngân sách PR so với chi phí hiện tại — chênh lệch (chỉ PR chờ duyệt NS)."
              />
              <div className={`mt-4 md:mt-5 ${procurementMonitorTableScrollClass}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`${procurementMonitorTableHeadStickyClass} text-xs uppercase text-slate-600`}>
                      <th className="px-3 py-2 text-left">PR</th>
                      <th className="px-3 py-2 text-right">Ngân sách</th>
                      <th className="px-3 py-2 text-right">Chi phí hiện tại</th>
                      <th className="px-3 py-2 text-right">Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {data.costRows.map((c) => (
                      <tr key={c.prId}>
                        <td className="px-3 py-2 font-medium">{c.prNumber}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatVnd(c.budget)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatVnd(c.currentCost)}</td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums font-semibold ${
                            c.direction === 'over' ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {c.direction === 'over' ? '+' : '−'}
                          {formatVnd(Math.abs(c.variance))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ) : null}

          {data.deliveryRows.length > 0 ? (
            <article className={`${dashboardV3IslandClass} ${dashboardV3IslandOpaqueClass}`}>
              <SectionHeader
                Icon={Package}
                eyebrow="Giao hàng"
                title="Giám sát giao hàng"
                description="PO · NCC · ETA · Đã nhận."
              />
              <div className={`mt-4 md:mt-5 ${procurementMonitorTableScrollClass}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`${procurementMonitorTableHeadStickyClass} text-xs uppercase text-slate-600`}>
                      <th className="px-3 py-2 text-left">PO</th>
                      <th className="px-3 py-2 text-left">NCC</th>
                      <th className="px-3 py-2 text-left">ETA</th>
                      <th className="px-3 py-2 text-right">Đã nhận</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {data.deliveryRows.map((d) => (
                      <tr
                        key={d.poId}
                        className={d.isOverdue ? 'bg-rose-50/50' : undefined}
                      >
                        <td className="px-3 py-2">
                          <span className="font-medium">{d.poNumber}</span>
                          <span className="block text-xs text-slate-500">{d.prNumber}</span>
                        </td>
                        <td className="px-3 py-2">{d.vendorName}</td>
                        <td className="px-3 py-2 tabular-nums">{formatEta(d.eta)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{d.receivedLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ) : null}
        </div>
      </div>

      {selectedPrId ? (
        <ProcurementMonitorPrDetailModal
          apiBase={apiBase}
          prId={selectedPrId}
          onClose={() => setSelectedPrId(null)}
        />
      ) : null}
    </div>
  );
}
