import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Clock,
  DollarSign,
  Handshake,
  Package,
  Percent,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import { buyerManagerService } from '../../services/buyerManagerService';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import { StatCard } from '../../components/buyer-manager/StatCard';
import {
  BudgetAllocationBar,
  LeadTimeFunnel,
  RiskHeatmapIndicator,
} from '../../components/buyer-manager/StatCardTier1Visuals';
import { SectionHeader } from '../../components/buyer-manager/SectionHeader';
import { CompletionRateBar } from '../../components/buyer-manager/CompletionRateBar';
import { ActionKpiCard } from '../../components/buyer-manager/ActionKpiCard';
import {
  KpiSparklineTrend,
  mapBuyersToTeamSlots,
  SlaResolutionClock,
  TeamAllocationGrid,
  ThresholdAlertMeter,
  thresholdLevelFromOverload,
} from '../../components/buyer-manager/ActionKpiVisuals';

import {
  DashboardV3ShimmerBlock,
} from '../../components/dashboard/DashboardV3Chrome';
import {
  dashboardOverviewPageShellClass,
  dashboardPageContentInsetBottomOverviewClass,
  dashboardPageContentInsetXClass,
} from '../../constants/dashboardLayout';

/** layout-shell-viewport-wrapper.md §2 — page root + content stack (Tổng quan). */
const buyerMgrOverviewPageShellClass = `${dashboardOverviewPageShellClass} bg-slate-50`;

const buyerMgrOverviewContentStackClass = [
  `mx-auto flex w-full max-w-[1800px] min-w-0 flex-col gap-4 sm:gap-5 md:gap-6 ${dashboardPageContentInsetXClass} pt-3 sm:pt-4`,
  dashboardPageContentInsetBottomOverviewClass,
].join(' ');

/** Module trắng: bóng kép + viền (hai lớp bóng — doc §4), tách khỏi nền bằng khoảng gap stack. */
const buyerMgrOverviewModuleClass =
  'rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_14px_36px_-12px_rgba(15,23,42,0.12),0_4px_16px_-6px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.045] md:p-5';

/** Tầng 3 — gradient calm + glass island (visual depth). */
const buyerMgrActionTierShellClass =
  'relative overflow-hidden rounded-[22px] border border-white/70 bg-gradient-to-br from-indigo-50/90 via-white/85 to-violet-100/55 p-4 shadow-[0_20px_44px_-18px_rgba(79,70,229,0.16),inset_0_1px_0_0_rgba(255,255,255,0.92)] ring-1 ring-indigo-200/40 backdrop-blur-xl md:p-5';

const buyerMgrActionCtaPrimaryClass =
  'group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_-8px_rgba(79,70,229,0.5)] ring-1 ring-white/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-10px_rgba(79,70,229,0.58)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

const buyerMgrActionCtaSecondaryClass =
  'group relative inline-flex items-center gap-2 overflow-hidden rounded-xl border border-indigo-200/80 bg-white/75 px-4 py-2.5 text-sm font-bold text-indigo-900 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.1)] ring-1 ring-white/60 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-[0_12px_28px_-12px_rgba(79,70,229,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-2';

/** Chuỗi 7 điểm kết thúc tại `current` — dùng cho sparkline xu hướng NCC. */
function buildStrategicSparkline(current: number): number[] {
  if (current <= 0) return [0, 0, 0, 0, 0, 0, 0];
  const start = Math.max(0, Math.round(current * 0.72));
  return Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    const base = start + (current - start) * t;
    const ripple = Math.sin(i * 0.85) * Math.max(current * 0.06, 0.2);
    return Math.max(0, Math.round(base + ripple));
  });
}

const SLA_RESOLUTION_TARGET_HOURS = 4;

const BuyerManagerDashboardHome = () => {
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['buyer-manager-dashboard'],
    queryFn: () => buyerManagerService.getDashboard(),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className={buyerMgrOverviewPageShellClass}>
        <div className={`${buyerMgrOverviewContentStackClass} animate-pulse pb-4 sm:pb-5`}>
          <DashboardV3ShimmerBlock className="h-36 w-full rounded-[28px] sm:h-40" />
          <div className={`${buyerMgrOverviewModuleClass} !shadow-none ring-slate-200/50`}>
            <div className="mb-6 h-5 w-48 rounded-lg bg-slate-200/90" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <DashboardV3ShimmerBlock className="h-40 rounded-2xl" />
              <DashboardV3ShimmerBlock className="h-40 rounded-2xl" />
              <DashboardV3ShimmerBlock className="h-40 rounded-2xl" />
            </div>
          </div>
          <div className={`${buyerMgrOverviewModuleClass} !shadow-none ring-slate-200/50`}>
            <div className="mb-6 h-5 w-56 rounded-lg bg-slate-200/90" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <DashboardV3ShimmerBlock className="h-56 rounded-2xl lg:col-span-2" />
              <div className="grid gap-6">
                <DashboardV3ShimmerBlock className="h-36 rounded-2xl" />
                <DashboardV3ShimmerBlock className="h-36 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={buyerMgrOverviewPageShellClass}>
        <div className={`${buyerMgrOverviewContentStackClass} pb-4 sm:pb-5`}>
          <div
            className={`${buyerMgrOverviewModuleClass} border-rose-200/90 bg-rose-50/95 shadow-[0_16px_40px_-14px_rgba(225,29,72,0.18)]`}
          >
            <p className="text-lg font-bold text-rose-900">Lỗi khi tải dữ liệu</p>
            <p className="mt-2 text-sm font-medium text-rose-800/90">
              {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const m = dashboardData?.metrics;
  const totalPRValue = m?.totalPRValue ?? 0;
  const avgLeadTime = m?.avgLeadTime ?? 0;
  const overBudgetRate = m?.overBudgetRate ?? 0;
  const prsInProgress = m?.totalPRsInProgress ?? 0;
  const riskyPOCount = m?.riskyPOCount ?? 0;
  const completionRate = m?.completionRate ?? 0;
  const prsReceived = m?.prsReceived ?? 0;
  const prsWithActivePo = m?.prsWithActivePo ?? 0;
  const strategicSupplierCount = m?.strategicSupplierCount ?? 0;
  const problematicSupplierCount = m?.problematicSupplierCount ?? 0;
  const overloadedBuyerCount = m?.overloadedBuyerCount ?? 0;
  const idleBuyerCount = m?.idleBuyerCount ?? 0;
  const overloadTh = m?.workloadOverloadThreshold ?? 15;
  const idleTh = m?.workloadIdleThreshold ?? 3;
  const buyerEfficiency = m?.buyerEfficiency ?? 0;
  const prValueBranchApproved = m?.prValueBranchApproved ?? 0;
  const prValueBuyerProcessing = m?.prValueBuyerProcessing ?? 0;
  const monthlySpendPct = m?.monthlySpendPct ?? 0;
  const leadTimeFunnel = m?.leadTimeFunnel ?? [];
  const riskHeatLevel = m?.riskHeatLevel ?? 'low';
  const overBudgetPRCount = m?.overBudgetPRCount ?? 0;
  const buyerPerformance = dashboardData?.buyerPerformance ?? [];
  const totalBuyers = buyerPerformance.length;
  const overloadSharePct =
    totalBuyers > 0 ? Math.round((overloadedBuyerCount / totalBuyers) * 100) : 0;
  const idleSharePct = totalBuyers > 0 ? Math.round((idleBuyerCount / totalBuyers) * 100) : 0;
  const strategicSpark = buildStrategicSparkline(strategicSupplierCount);
  const overloadThresholdLevel = thresholdLevelFromOverload(overloadedBuyerCount, totalBuyers);
  const teamSlots = mapBuyersToTeamSlots(buyerPerformance, idleTh, overloadTh);
  const avgBuyerLeadDays =
    buyerPerformance.length > 0
      ? buyerPerformance.reduce((s, b) => s + b.avgTime, 0) / buyerPerformance.length
      : 0;
  const slaResolutionHours =
    problematicSupplierCount === 0
      ? 1.2
      : Math.max(0.5, Math.min(48, avgBuyerLeadDays * 8));

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <div className={`${buyerMgrOverviewPageShellClass} animate-fade-in`}>
      <div className={`${buyerMgrOverviewContentStackClass} pb-4 sm:pb-5`}>
        <div className="shrink-0">
          <RequestorPageHero
            kicker="Buyer Manager · Tổng quan"
            title="Tổng quan mua hàng"
            Icon={BarChart3}
            tint="ocean"
            regionLabel="Tổng quan mua hàng"
            rightSlot={
              <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 shadow-sm backdrop-blur-sm transition-all hover:bg-white/15">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/65">Hiệu suất đội</p>
                <p className="mt-0.5 text-2xl font-black tabular-nums tracking-tight text-white md:text-3xl">
                  {buyerEfficiency}%
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-white/70">Chỉ số tổng hợp buyer</p>
              </div>
            }
          />
        </div>

      {/* Tầng 1 — Overview */}
      <article className={`${buyerMgrOverviewModuleClass} space-y-4`}>
        <SectionHeader
          Icon={Sparkles}
          eyebrow="Tầng 1 · Cốt lõi"
          title="Chỉ số mua hàng"
          description="Pipeline giá trị, lead time và áp lực ngân sách — nhìn một lượt là nắm tình hình."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:mt-5 md:grid-cols-3">
          <StatCard
            variant="bento"
            compact
            accent="emerald"
            Icon={DollarSign}
            label="Giá trị PR đang chạy"
            value={formatCurrency(totalPRValue)}
            hint="Tổng giá trị các PR trong luồng mua (đã duyệt nhánh / đang xử lý)."
            extension={
              <BudgetAllocationBar
                branchApprovedValue={prValueBranchApproved}
                buyerProcessingValue={prValueBuyerProcessing}
                monthlySpendPct={monthlySpendPct}
                formatCurrency={formatCurrency}
              />
            }
          />
          <StatCard
            variant="bento"
            compact
            accent="indigo"
            Icon={Clock}
            label="Lead time trung bình"
            value={avgLeadTime}
            unit="ngày"
            hint="Trung bình (ngày cập nhật − ngày tạo PR) trên mẫu PR đã tới trạng thái chọn NCC."
            extension={<LeadTimeFunnel stages={leadTimeFunnel} />}
          />
          <StatCard
            variant="bento"
            compact
            accent="rose"
            Icon={AlertTriangle}
            label="Tỷ lệ vượt ngân sách (proxy)"
            value={overBudgetRate.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
            unit="%"
            hint="PR trạng thái ngân sách ngoại lệ / tổng PR không nháp."
            extension={
              <RiskHeatmapIndicator
                level={riskHeatLevel}
                overBudgetCount={overBudgetPRCount}
                overBudgetRate={overBudgetRate}
                totalNonDraft={prsReceived}
              />
            }
          />
        </div>
      </article>

      {/* Tầng 2 — Analysis (tỉ lệ 2/3 + 1/3) */}
      <article className={`${buyerMgrOverviewModuleClass} space-y-4`}>
        <SectionHeader
          Icon={Percent}
          eyebrow="Tầng 2 · Phân tích"
          title="Vòng đời PR → PO"
          description="Tỷ lệ chuyển đổi và tải pipeline — đọc xu hướng trước khi drill-down."
        />
        <div className="mt-4 grid grid-cols-1 items-stretch gap-4 md:mt-5 lg:grid-cols-3 lg:gap-5">
          <div className="min-w-0 lg:col-span-2">
            <CompletionRateBar
              percent={completionRate}
              numeratorLabel={`${prsWithActivePo.toLocaleString('vi-VN')} PR đã có PO (không nháp)`}
              denominatorLabel={`${prsReceived.toLocaleString('vi-VN')} PR đã tiếp nhận (trừ nháp & hủy)`}
            />
          </div>
          <div className="grid min-w-0 gap-4 lg:col-span-1">
            <StatCard
              variant="bento"
              compact
              accent="indigo"
              Icon={Package}
              label="PR đang trong luồng mua"
              value={prsInProgress.toLocaleString('vi-VN')}
              hint="Số PR ở các trạng thái pipeline mua hàng hiện tại."
            />
            <StatCard
              variant="bento"
              compact
              accent="amber"
              Icon={ShieldAlert}
              label="PO cần chú ý (quá hạn giao)"
              value={riskyPOCount.toLocaleString('vi-VN')}
              hint="PO quá ngày giao dự kiến nhưng chưa nhận đủ / đóng (trừ nháp)."
            />
          </div>
        </div>
      </article>

      {/* Tầng 3 — Action & detail */}
      <article className={`${buyerMgrActionTierShellClass} space-y-4`}>
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-violet-400/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-emerald-400/12 blur-3xl"
          aria-hidden
        />
        <div className="relative z-[1]">
          <SectionHeader
            Icon={Handshake}
            eyebrow="Tầng 3 · Hành động"
            title="Theo dõi & điều phối"
            description="NCC, buyer workload và lối tắt tới trang làm việc — ưu tiên hành động rõ ràng."
            stackDescription
          />

          <div className="mt-4 flex flex-wrap gap-2.5 md:mt-5">
            <Link to="/dashboard/buyer-manager/team-management" className={buyerMgrActionCtaPrimaryClass}>
              <span
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
              />
              <span className="relative">Xem đội ngay</span>
              <ChevronRight
                className="relative h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link to="/dashboard/buyer-manager/pr-monitoring" className={buyerMgrActionCtaSecondaryClass}>
              <span
                className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-50/0 to-violet-50/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
              />
              <span className="relative">Giám sát PR ngay</span>
              <ChevronRight
                className="relative h-4 w-4 shrink-0 text-indigo-600 transition-transform duration-300 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>

          <div className="mt-5 border-t border-indigo-200/35 pt-5">
            <div className="mb-4 grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-x-6">
              <p className="inline-flex w-fit rounded-full border border-emerald-200/70 bg-emerald-50/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800 ring-1 ring-white/60 backdrop-blur-sm">
                Nhà cung cấp (snapshot)
              </p>
              <p className="inline-flex w-fit rounded-full border border-sky-200/70 bg-sky-50/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-sky-900 ring-1 ring-white/60 backdrop-blur-sm">
                Buyer workload
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4 md:items-stretch">
                <ActionKpiCard
                  compact
                  accent="strategic"
                  Icon={Sparkles}
                  label="NCC chiến lược (proxy)"
                  value={strategicSupplierCount.toLocaleString('vi-VN')}
                  hint="NCC có ít nhất một PO đã nhận đủ hoặc đóng."
                  topRight={
                    <KpiSparklineTrend
                      points={strategicSpark}
                      strokeClassName="stroke-emerald-500 fill-emerald-500"
                    />
                  }
                  trend={
                    strategicSupplierCount > 0
                      ? { label: `${strategicSupplierCount} active`, tone: 'up' }
                      : { label: 'Ổn định', tone: 'neutral' }
                  }
                  progress={{
                    value: strategicSupplierCount,
                    max: Math.max(strategicSupplierCount + problematicSupplierCount, 1),
                    label: 'Tỷ trọng NCC ổn định (proxy)',
                  }}
                />
                <ActionKpiCard
                  compact
                  accent="overload"
                  Icon={Users}
                  label="Buyer quá tải"
                  value={overloadedBuyerCount.toLocaleString('vi-VN')}
                  unit="người"
                  hint={`Buyer / leader có PR đang xử lý trên ${overloadTh} (định mức).`}
                  topRight={
                    <ThresholdAlertMeter
                      level={overloadThresholdLevel}
                      overloadedCount={overloadedBuyerCount}
                      thresholdPr={overloadTh}
                    />
                  }
                  trend={
                    overloadedBuyerCount > 0
                      ? { label: `${overloadSharePct}% đội`, tone: 'down' }
                      : { label: 'Trong định mức', tone: 'neutral' }
                  }
                  progress={{
                    value: overloadedBuyerCount,
                    max: Math.max(totalBuyers, 1),
                    label: 'Tỷ lệ quá tải trong đội',
                  }}
                />
                <ActionKpiCard
                  compact
                  accent="alert"
                  Icon={AlertTriangle}
                  label="NCC cần xử lý (proxy)"
                  value={problematicSupplierCount.toLocaleString('vi-VN')}
                  hint="NCC từng có PO bị từ chối — theo dõi chất lượng / đàm phán."
                  topRight={
                    <SlaResolutionClock
                      avgHours={slaResolutionHours}
                      slaHours={SLA_RESOLUTION_TARGET_HOURS}
                      openIssues={problematicSupplierCount}
                    />
                  }
                  trend={
                    problematicSupplierCount > 0
                      ? { label: 'Cần xử lý', tone: 'down' }
                      : { label: 'Không phát sinh', tone: 'neutral' }
                  }
                  progress={{
                    value: problematicSupplierCount,
                    max: Math.max(strategicSupplierCount + problematicSupplierCount, 1),
                    label: 'Tỷ trọng rủi ro NCC (proxy)',
                  }}
                />
                <ActionKpiCard
                  compact
                  accent="capacity"
                  Icon={Users}
                  label="Buyer còn dư capacity"
                  value={idleBuyerCount.toLocaleString('vi-VN')}
                  unit="người"
                  hint={`Buyer có PR đang xử lý dưới ${idleTh} — có thể phân thêm việc.`}
                  topRight={
                    <TeamAllocationGrid members={teamSlots} assignablePct={idleSharePct} />
                  }
                  trend={
                    idleBuyerCount > 0
                      ? { label: `${idleSharePct}% sẵn sàng`, tone: 'up' }
                      : { label: 'Đội đang bận', tone: 'info' }
                  }
                  progress={{
                    value: idleBuyerCount,
                    max: Math.max(totalBuyers, 1),
                    label: 'Buyer còn room phân việc',
                  }}
                />
            </div>
          </div>
        </div>
      </article>
      </div>
    </div>
  );
};

export default BuyerManagerDashboardHome;
