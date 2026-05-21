import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { buyerService } from '../../../services/buyerService';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  CheckCircle,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Inbox,
  LayoutDashboard,
  Package,
  Phone,
  ShoppingCart,
  Target,
  TrendingUp,
  XCircle,
  MessageSquareWarning,
} from 'lucide-react';
import { BuyerPageHero } from '../../BuyerPageHero';
import { SectionHeader } from '../../buyer-manager/SectionHeader';
import { StatCard } from '../../buyer-manager/StatCard';
import { CountUpNumber } from '../../dashboard/CountUpNumber';
import {
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
} from '../../dashboard/DashboardV3Chrome';
import {
  buyerDashboardKpiGridClass,
  buyerDashboardKpiIslandPaddingClass,
  buyerDashboardOverviewCtaClass,
  buyerDashboardOverviewStackClass,
  buyerDashboardOverviewStackCompactClass,
} from '../../../constants/buyerLayout';
import type { AssignedPRData } from '../../../services/buyerService';
import { BUYER_WORK_QUEUE_TABS } from './buyerCommandCenterConstants';
import type { BuyerDashboardSnap, BuyerWorkQueueTabId, UpcomingDeadlinePR } from './buyerCommandCenterTypes';
import { mapApiSuppliers } from './buyerSupplierUtils';
import { derivePrBudgetAllocation } from './buyerBudgetAllocation';
import { BuyerBudgetAllocationChart } from './BuyerBudgetAllocationChart';
import { BuyerSupplierMatrix } from './BuyerSupplierMatrix';
import { BuyerQuickActionsPanel } from './BuyerQuickActionsPanel';
import { getWorkQueueItems } from './buyerWorkQueueUtils';

const commandIslandClass = [
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
  buyerDashboardKpiIslandPaddingClass,
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
  amber: 'border-amber-300/90 bg-amber-50/90 text-amber-900 shadow-[0_8px_20px_-10px_rgba(245,158,11,0.28)] ring-1 ring-amber-200/60',
  rose: 'border-rose-300/90 bg-rose-50/90 text-rose-900 shadow-[0_8px_20px_-10px_rgba(244,63,94,0.28)] ring-1 ring-rose-200/60',
};

const TAB_IDLE =
  'border-slate-200/70 bg-white/50 text-slate-600 hover:border-slate-300/80 hover:bg-white/80 hover:text-slate-900';

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString));
}

function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; color: string; icon: LucideIcon }> = {
    ASSIGNED_TO_BUYER: { label: 'Đã phân công', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Package },
    READY_FOR_RFQ: { label: 'Sẵn sàng hỏi giá', color: 'bg-sky-50 text-sky-700 border-sky-200', icon: FileText },
    RFQ_IN_PROGRESS: { label: 'Đang hỏi giá', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', icon: ShoppingCart },
    QUOTATION_RECEIVED: { label: 'Đã nhận báo giá', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: FileText },
    SUPPLIER_SELECTED: { label: 'Đã chọn NCC', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
    RETURNED: { label: 'Bị trả về', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: XCircle },
    NEED_MORE_INFO: { label: 'Cần bổ sung', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: MessageSquareWarning },
  };
  const info = statusMap[status] ?? {
    label: status,
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: FileText,
  };
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-medium sm:text-xs ${info.color}`}>
      <Icon className="h-3 w-3" strokeWidth={2} />
      {info.label}
    </span>
  );
}

export type BuyerCommandCenterProps = {
  assignedPRs: AssignedPRData[];
  rfqInProgressPRs: AssignedPRData[];
  returnedPRs: AssignedPRData[];
  upcomingDeadlines: UpcomingDeadlinePR[];
  poStats: {
    prWaitingPO: number;
    poDraft: number;
    poWaitingApproval: number;
    poIssued: number;
  };
  dashboardSnap: BuyerDashboardSnap;
};

export function BuyerCommandCenter({
  assignedPRs,
  rfqInProgressPRs,
  returnedPRs,
  upcomingDeadlines,
  poStats,
  dashboardSnap,
}: BuyerCommandCenterProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<BuyerWorkQueueTabId>('assigned');

  const tabCounts: Record<BuyerWorkQueueTabId, number> = useMemo(
    () => ({
      assigned: assignedPRs.length,
      rfq: rfqInProgressPRs.length,
      need_info: returnedPRs.length,
      deadline: upcomingDeadlines.length,
    }),
    [assignedPRs.length, rfqInProgressPRs.length, returnedPRs.length, upcomingDeadlines.length]
  );

  const activeTabDef = BUYER_WORK_QUEUE_TABS.find((t) => t.id === activeTab)!;
  const queueItems = getWorkQueueItems(
    activeTab,
    assignedPRs,
    rfqInProgressPRs,
    returnedPRs,
    upcomingDeadlines
  );

  const kpiActivity = (count: number): 'active' | 'zero' => (count > 0 ? 'active' : 'zero');

  const budgetAllocation = useMemo(
    () => derivePrBudgetAllocation(assignedPRs),
    [assignedPRs]
  );

  const { data: overBudgetData } = useQuery({
    queryKey: ['buyer-over-budget-alerts', 'overview'],
    queryFn: () => buyerService.getOverBudgetAlerts(),
    staleTime: 60_000,
    retry: 0,
  });
  const overBudgetAlertCount = overBudgetData?.alerts?.length ?? 0;

  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers', 'buyer-overview'],
    queryFn: () => buyerService.getSuppliers(),
    staleTime: 60_000,
  });
  const suppliers = useMemo(() => mapApiSuppliers(suppliersData), [suppliersData]);
  const quickDialSuppliers = useMemo(
    () => suppliers.filter((s) => s.phone).slice(0, 5),
    [suppliers]
  );

  const openPr = (prId: string) => navigate(`/dashboard/buyer/assigned-prs/${prId}`);

  const stackClass = [buyerDashboardOverviewStackClass, buyerDashboardOverviewStackCompactClass].join(' ');

  return (
    <div className={stackClass}>
      <BuyerPageHero
        kicker="Buyer · Tổng quan"
        title="Trung tâm mua hàng"
        description="Tab lọc hàng đợi, danh sách công việc và widget SLA / hiệu suất trên cùng một màn."
        Icon={LayoutDashboard}
        tint="ocean"
        regionLabel="Trung tâm mua hàng"
      />

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12 lg:gap-5">
        {/* Cột chính 8 — hàng đợi + PO */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          <article className={`${commandIslandClass} slide-right-card-1 min-w-0 space-y-4 overflow-visible`}>
            <SectionHeader
              Icon={Target}
              eyebrow="Hàng đợi tác vụ"
              title="Số liệu gắn danh sách"
              description="Nhấp tab để lọc — nhấp dòng PR để mở chi tiết. Không lặp KPI và panel riêng."
              stackDescription
            />

            <div
              className="grid min-w-0 w-full grid-cols-2 gap-2 sm:gap-2.5 2xl:grid-cols-4"
              role="tablist"
              aria-label="Bộ lọc hàng đợi công việc"
            >
              {BUYER_WORK_QUEUE_TABS.map((tab) => {
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
                  {queueItems.map((pr) => {
                    const deadlineRow = 'daysLeft' in pr ? (pr as UpcomingDeadlinePR) : null;
                    return (
                      <div
                        key={pr.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openPr(pr.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openPr(pr.id);
                          }
                        }}
                        className={glassRowClass}
                      >
                        <span className="pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-full bg-indigo-400/0 transition-colors group-hover:bg-indigo-400/70" />
                        <div className="flex items-start justify-between gap-3 pl-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2">
                              <span className={glassIconClass('text-indigo-600')}>
                                <FileText className="h-4 w-4" strokeWidth={2} />
                              </span>
                              <p className="truncate text-sm font-bold text-slate-900">{pr.prNumber}</p>
                              {deadlineRow ? (
                                <span
                                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                                    deadlineRow.daysLeft <= 0
                                      ? 'border-rose-200/60 bg-rose-500/10 text-rose-800'
                                      : deadlineRow.daysLeft <= 2
                                        ? 'border-rose-200/50 bg-rose-500/[0.08] text-rose-700'
                                        : 'border-amber-200/55 bg-amber-500/[0.08] text-amber-800'
                                  }`}
                                >
                                  {deadlineRow.daysLeft <= 0 ? 'Quá hạn' : `Còn ${deadlineRow.daysLeft} ngày`}
                                </span>
                              ) : null}
                            </div>
                            {'scope' in pr && pr.scope ? (
                              <p className="mb-1 line-clamp-1 text-xs text-slate-500">{pr.scope}</p>
                            ) : null}
                            {pr.deadline ? (
                              <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
                                <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                                <span>Hạn: {formatDate(pr.deadline)}</span>
                              </div>
                            ) : null}
                            <StatusBadge status={pr.status || 'ASSIGNED_TO_BUYER'} />
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 group-hover:text-indigo-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100/80 ring-1 ring-slate-200/60">
                    <Inbox className="h-6 w-6 text-slate-400" strokeWidth={1.75} />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Không có mục trong hàng đợi này</p>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                    Chọn tab khác hoặc mở trang danh sách đầy đủ khi cần lọc nâng cao.
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

          <article className={`${commandIslandClass} space-y-3`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeader
                Icon={ShoppingCart}
                eyebrow="PO"
                title="Hàng đợi đơn mua"
                description="Nhấp ô để mở danh sách / PR chờ lập PO — không lặp panel chi tiết."
                className="min-w-0 flex-1"
                stackDescription
              />
              <button
                type="button"
                onClick={() => navigate('/dashboard/buyer/po/list')}
                className={`${buyerDashboardOverviewCtaClass} shrink-0`}
              >
                Danh sách PO
              </button>
            </div>
            <div className={buyerDashboardKpiGridClass}>
              <StatCard
                variant="bento"
                embedded
                activity={kpiActivity(poStats.prWaitingPO)}
                accent="slate"
                Icon={ClipboardList}
                label="PR chờ tạo PO"
                value={<CountUpNumber end={poStats.prWaitingPO} />}
                hint="Sẵn sàng lập đơn."
                onClick={() => navigate('/dashboard/buyer/po/prs-waiting')}
              />
              <StatCard
                variant="bento"
                embedded
                activity={kpiActivity(poStats.poDraft)}
                accent="violet"
                Icon={FileText}
                label="PO nháp"
                value={<CountUpNumber end={poStats.poDraft} />}
                onClick={() => navigate('/dashboard/buyer/po/list')}
              />
              <StatCard
                variant="bento"
                embedded
                activity={kpiActivity(poStats.poWaitingApproval)}
                accent="amber"
                Icon={Clock}
                label="Chờ duyệt"
                value={<CountUpNumber end={poStats.poWaitingApproval} />}
                onClick={() => navigate('/dashboard/buyer/po/list')}
              />
              <StatCard
                variant="bento"
                embedded
                activity={kpiActivity(poStats.poIssued)}
                accent="emerald"
                Icon={BadgeCheck}
                label="Đã gửi NCC"
                value={<CountUpNumber end={poStats.poIssued} />}
                onClick={() => navigate('/dashboard/buyer/po/list')}
              />
            </div>
          </article>

          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
            <BuyerBudgetAllocationChart
              segments={budgetAllocation.segments}
              totalVnd={budgetAllocation.totalVnd}
              prCount={budgetAllocation.prCount}
              hasAmounts={budgetAllocation.hasAmounts}
            />
            <BuyerSupplierMatrix suppliers={suppliers} isLoading={suppliersLoading} />
          </div>
        </div>

        {/* Cột phụ 4 — widget (kéo cao ngang cột trái) */}
        <aside className="flex flex-col gap-4 lg:col-span-4 lg:self-stretch">
          <article className={`${commandIslandClass} space-y-3`}>
            <SectionHeader
              Icon={TrendingUp}
              eyebrow="Tổng quan API"
              title="Chỉ số hệ thống"
              description="Lấy từ GET /buyer/dashboard."
              stackDescription
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/90 to-white/80 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700/80">PR phân công</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  <CountUpNumber end={dashboardSnap.assignedPRs} />
                </p>
              </div>
              <div className="rounded-xl border border-sky-200/50 bg-gradient-to-br from-sky-50/90 to-white/80 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700/80">RFQ đang chạy</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  <CountUpNumber end={dashboardSnap.rfqInProgress} />
                </p>
              </div>
              <div className="rounded-xl border border-amber-200/50 bg-gradient-to-br from-amber-50/90 to-white/80 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/80">Cần bổ sung</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  <CountUpNumber end={dashboardSnap.prsNeedMoreInfo} />
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/90 to-white/80 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/80">Báo giá hoàn tất</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  <CountUpNumber end={dashboardSnap.quotationsCompleted} />
                </p>
              </div>
            </div>
          </article>

          <article className={`${commandIslandClass} space-y-3`}>
            <SectionHeader
              Icon={Calendar}
              eyebrow="SLA"
              title="Mốc deadline khẩn"
              description="7 ngày tới — nhấp tab Deadline để lọc danh sách chính."
              stackDescription
            />
            {upcomingDeadlines.length > 0 ? (
              <ul className="max-h-40 space-y-2 overflow-y-auto scrollbar-hide">
                {upcomingDeadlines.slice(0, 5).map((pr) => (
                  <li key={pr.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('deadline');
                        openPr(pr.id);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200/60 bg-white/55 px-2.5 py-2 text-left text-xs transition hover:bg-white/90 sm:text-sm"
                    >
                      <span className="truncate font-semibold text-slate-800">{pr.prNumber}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          pr.daysLeft <= 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {pr.daysLeft <= 0 ? 'Quá hạn' : `${pr.daysLeft}d`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200/70 bg-slate-50/50 px-3 py-4 text-center text-xs text-slate-500">
                Không có mốc SLA trong 7 ngày.
              </p>
            )}
          </article>

          <article className={`${commandIslandClass} space-y-3`}>
            <SectionHeader
              Icon={Phone}
              eyebrow="NCC"
              title="Quay số nhanh"
              description="Liên hệ NCC thường dùng — một chạm gọi."
              stackDescription
            />
            {suppliersLoading ? (
              <p className="py-4 text-center text-xs text-slate-500">Đang tải NCC…</p>
            ) : quickDialSuppliers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200/70 bg-slate-50/50 px-3 py-4 text-center text-xs text-slate-500">
                Chưa có NCC có số điện thoại trong hệ thống.
              </p>
            ) : (
              <ul className="space-y-2">
                {quickDialSuppliers.map((v) => (
                  <li key={v.id}>
                    <a
                      href={`tel:${v.phone!.replace(/\s/g, '')}`}
                      className="flex items-center gap-3 rounded-xl border border-slate-200/65 bg-white/55 px-3 py-2.5 transition hover:border-indigo-200/60 hover:bg-white/90 hover:shadow-sm"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-200/40">
                        <Phone className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{v.name}</span>
                        {v.code ? (
                          <span className="text-xs text-slate-500">{v.code}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs font-bold text-indigo-700">{v.phone}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <BuyerQuickActionsPanel overBudgetAlertCount={overBudgetAlertCount} />
        </aside>
      </div>
    </div>
  );
}
