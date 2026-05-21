import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ChevronRight,
  FileCheck,
  Inbox,
  LayoutDashboard,
  ShoppingCart,
  Target,
  TrendingUp,
} from 'lucide-react';
import { BuyerLeaderPageHero } from '../../BuyerLeaderPageHero';
import { SectionHeader } from '../../buyer-manager/SectionHeader';
import {
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
} from '../../dashboard/DashboardV3Chrome';
import {
  buyerLeaderDashboardKpiIslandPaddingClass,
  buyerLeaderDashboardOverviewCtaClass,
  buyerLeaderDashboardOverviewStackClass,
  buyerLeaderDashboardOverviewStackCompactClass,
} from '../../../constants/buyerLeaderLayout';
import { BUYER_LEADER_WORK_QUEUE_TABS } from './buyerLeaderCommandCenterConstants';
import { getBuyerLeaderWorkQueueItems } from './buyerLeaderWorkQueueUtils';
import type { BuyerLeaderWorkQueueTabId } from './buyerLeaderCommandCenterTypes';
import { BuyerLeaderQuickActionsPanel } from './BuyerLeaderQuickActionsPanel';

const commandIslandClass = [
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
  buyerLeaderDashboardKpiIslandPaddingClass,
].join(' ');

const glassListClass =
  'overflow-hidden rounded-xl border border-white/70 bg-white/45 shadow-sm ring-1 ring-slate-200/35 backdrop-blur-md';

const glassRowClass =
  'group relative cursor-pointer px-3 py-2.5 transition-colors hover:bg-white/55 sm:px-4';

const glassIconClass = (accent: string) =>
  `flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/65 shadow-sm ring-1 ring-white/85 backdrop-blur-sm ${accent}`;

const TAB_ACTIVE: Record<string, string> = {
  indigo: 'border-indigo-300/90 bg-indigo-50/90 text-indigo-900 shadow-[0_8px_20px_-10px_rgba(79,70,229,0.35)] ring-1 ring-indigo-200/60',
  sky: 'border-sky-300/90 bg-sky-50/90 text-sky-900 shadow-[0_8px_20px_-10px_rgba(14,165,233,0.32)] ring-1 ring-sky-200/60',
  violet: 'border-violet-300/90 bg-violet-50/90 text-violet-900 shadow-[0_8px_20px_-10px_rgba(139,92,246,0.32)] ring-1 ring-violet-200/60',
  rose: 'border-rose-300/90 bg-rose-50/90 text-rose-900 shadow-[0_8px_20px_-10px_rgba(244,63,94,0.28)] ring-1 ring-rose-200/60',
};

const TAB_IDLE =
  'border-slate-200/70 bg-white/50 text-slate-600 hover:border-slate-300/80 hover:bg-white/80 hover:text-slate-900';

export type BuyerLeaderCommandCenterProps = {
  pendingPRs: Array<{ id: string; prNumber?: string; department?: string }>;
  activeRfqs: Array<{ id: string; rfqNumber?: string; prNumber?: string; status?: string }>;
  comparisonRfqs: Array<{ id: string; rfqNumber?: string; prNumber?: string }>;
  overBudgetPRs: Array<{ id: string; prNumber?: string; status?: string }>;
  rfqProgress: number;
  rfqCount: number;
  comparisonPending: number;
};

export function BuyerLeaderCommandCenter({
  pendingPRs,
  activeRfqs,
  comparisonRfqs,
  overBudgetPRs,
  rfqProgress,
  rfqCount,
  comparisonPending,
}: BuyerLeaderCommandCenterProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<BuyerLeaderWorkQueueTabId>('pending_assign');

  const tabCounts = useMemo(
    () => ({
      pending_assign: pendingPRs.length,
      rfq_active: activeRfqs.length,
      compare: comparisonRfqs.length,
      over_budget: overBudgetPRs.length,
    }),
    [pendingPRs.length, activeRfqs.length, comparisonRfqs.length, overBudgetPRs.length]
  );

  const activeTabDef = BUYER_LEADER_WORK_QUEUE_TABS.find((t) => t.id === activeTab)!;
  const queueItems = getBuyerLeaderWorkQueueItems(
    activeTab,
    pendingPRs,
    activeRfqs,
    comparisonRfqs,
    overBudgetPRs
  );

  const stackClass = [buyerLeaderDashboardOverviewStackClass, buyerLeaderDashboardOverviewStackCompactClass].join(
    ' '
  );

  return (
    <div className={stackClass}>
      <BuyerLeaderPageHero
        kicker="Buyer Leader · Tổng quan"
        title="Trung tâm điều phối mua hàng"
        description="Tab lọc hàng đợi, danh sách công việc và tiến độ RFQ trên cùng một màn — không lặp KPI riêng."
        Icon={LayoutDashboard}
        tint="ocean"
        regionLabel="Trung tâm điều phối mua hàng"
      />

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12 lg:gap-5">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <article className={`${commandIslandClass} slide-right-card-1 min-w-0 space-y-4 overflow-visible`}>
            <SectionHeader
              Icon={Target}
              eyebrow="Hàng đợi tác vụ"
              title="Số liệu gắn danh sách"
              description="Nhấp tab để lọc — nhấp dòng để mở trang chi tiết. Không lặp KPI và panel riêng."
              stackDescription
            />

            <div
              className="grid min-w-0 w-full grid-cols-2 gap-2 sm:gap-2.5 2xl:grid-cols-4"
              role="tablist"
              aria-label="Bộ lọc hàng đợi Buyer Leader"
            >
              {BUYER_LEADER_WORK_QUEUE_TABS.map((tab) => {
                const count = tabCounts[tab.id];
                const isActive = activeTab === tab.id;
                const TabIcon = tab.Icon;
                const compactLabel = tab.shortLabel ?? tab.label;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`${tab.label} (${count})`}
                    title={tab.label}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-left transition-all duration-200 motion-reduce:transition-none sm:gap-2 sm:px-3 ${
                      isActive ? TAB_ACTIVE[tab.accent] : TAB_IDLE
                    }`}
                  >
                    <TabIcon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                    <span className="min-w-0 truncate text-[11px] font-semibold leading-tight sm:text-sm">
                      <span className="2xl:hidden">{compactLabel}</span>
                      <span className="hidden 2xl:inline">{tab.label}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-bold tabular-nums ${
                        count > 0 ? 'bg-white/80 text-slate-900' : 'bg-slate-100/90 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-slate-500 sm:text-sm">{activeTabDef.shortHint}</p>

            <div className={`${glassListClass} max-h-[min(22rem,48dvh)] overflow-y-auto scrollbar-hide`}>
              {queueItems.length > 0 ? (
                <div className="divide-y divide-slate-200/50">
                  {queueItems.map((row) => (
                    <div
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(row.detailPath)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(row.detailPath);
                        }
                      }}
                      className={glassRowClass}
                    >
                      <span className="pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-full bg-indigo-400/0 transition-colors group-hover:bg-indigo-400/70" />
                      <div className="flex items-start justify-between gap-3 pl-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className={glassIconClass('text-indigo-600')}>
                              <Target className="h-4 w-4" strokeWidth={2} />
                            </span>
                            <p className="truncate text-sm font-bold text-slate-900">{row.primaryLabel}</p>
                          </div>
                          {row.secondaryLabel ? (
                            <p className="mb-1 line-clamp-1 text-xs text-slate-500">{row.secondaryLabel}</p>
                          ) : null}
                          {row.meta ? (
                            <p className="text-[11px] font-medium text-slate-500">{row.meta}</p>
                          ) : null}
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 group-hover:text-indigo-500" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100/80 ring-1 ring-slate-200/60">
                    <Inbox className="h-6 w-6 text-slate-400" strokeWidth={1.75} />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Không có mục trong hàng đợi này</p>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                    Chọn tab khác hoặc mở trang danh sách đầy đủ.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3">
              <p className="text-xs text-slate-500">
                Hiển thị <span className="font-semibold text-slate-700">{queueItems.length}</span> mục
              </p>
              <button
                type="button"
                onClick={() => navigate(activeTabDef.detailRoute)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 transition hover:text-indigo-900 sm:text-sm"
              >
                Mở trang đầy đủ
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
          </article>

          <article className={`${commandIslandClass} space-y-4`}>
            <SectionHeader
              Icon={TrendingUp}
              eyebrow="RFQ"
              title="Tiến độ thu thập báo giá"
              description="Trung bình hoàn thành trên RFQ đang hoạt động — không tách đảo KPI Tầng 1."
              stackDescription
            />
            <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-br from-cyan-50/50 to-blue-50/30 p-5">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Hoàn thành báo giá</p>
                  <p className="mt-1 text-xs text-slate-500">{rfqCount} RFQ đang hoạt động</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black tabular-nums text-cyan-600">{rfqProgress}</span>
                  <span className="text-lg font-semibold text-cyan-600">%</span>
                </div>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-slate-200/80 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-blue-600 transition-all duration-700"
                  style={{ width: `${rfqProgress}%` }}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <ShoppingCart className="h-4 w-4 text-cyan-600" strokeWidth={2} />
                  {rfqCount} RFQ
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4 text-violet-600" strokeWidth={2} />
                  {comparisonPending} chờ chọn NCC
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/buyer-leader/compare-queue')}
                className={`${buyerLeaderDashboardOverviewCtaClass} mt-4`}
              >
                So sánh và chọn NCC
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          </article>
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-4 lg:self-stretch">
          <BuyerLeaderQuickActionsPanel />
        </aside>
      </div>
    </div>
  );
}
