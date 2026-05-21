import type { NavigateFunction } from 'react-router-dom';
import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getDepartmentOverview } from '../../services/departmentHeadService';
import {
  BRANCH_OVERVIEW_CHART_DURATION_MS,
  DONUT_ANIMATION_EASING,
  DONUT_CORNER_RADIUS,
} from '../../utils/rechartsDonut';
import { getPrTypeSliceColor } from '../../utils/prTypeChartColors';
import { Building2, FileText, TrendingUp, PenLine, Sparkles } from 'lucide-react';
import { DepartmentPageHero } from '../../components/DepartmentPageHero';
import { DashboardV3ShimmerBlock, dashboardV3IslandClass } from '../../components/dashboard/DashboardV3Chrome';
import { SectionHeader } from '../../components/buyer-manager/SectionHeader';
import { PrStatusDetailByStatusCard } from '../../components/department-head/PrStatusDetailByStatusCard';
import { useIntersectionVisible } from '../../hooks/useIntersectionVisible';
import { departmentHeadChartIntersectionOptions } from '../../constants/departmentHeadLayout';
import { DepartmentHeadEmployeePrBarCard } from './DepartmentOverviewEmployeeBar';

const PR_TYPE_CARD_MOTION =
  'transition-all duration-700 ease-out motion-reduce:transform-none motion-reduce:transition-none motion-reduce:opacity-100';

/** Mount riêng sau khi có dữ liệu — ref PR theo loại tồn tại trong lần useEffect observer đầu tiên */
function DepartmentOverviewLoaded({ overviewData, navigate }: { overviewData: Record<string, any>; navigate: NavigateFunction }) {
  const pageRootClass = 'w-full min-h-full min-w-0 bg-[#f1f5f9]';
  const pageContentClass = 'mx-auto w-full max-w-none min-w-0 space-y-6 px-1 pt-3 pb-4 sm:px-1.5 sm:pt-4 sm:pb-5 md:px-3';

  const prByTypeCardRef = useRef<HTMLElement | null>(null);
  const { isIntersecting: prByTypeChartVisible, generation: prByTypeGeneration } = useIntersectionVisible(
    prByTypeCardRef,
    departmentHeadChartIntersectionOptions,
  );

  const prsByEmployeeData = (overviewData?.prsByEmployee || []).map((item: any) => ({
    name: item.username,
    value: item.count,
    amount: item.totalAmount,
  }));

  const typeColorExtras = ['#0ea5e9', '#8b5cf6', '#ec4899', '#64748b'] as const;

  const prsByTypeData = (overviewData?.prsByType || []).map((item: any, index: number) => ({
    name: item.type,
    value: item.count,
    amount: item.totalAmount,
    color: getPrTypeSliceColor(String(item.type ?? ''), index, typeColorExtras),
  }));

  const totalPRsCharts = overviewData?.totalPRs ?? 0;
  const donutOuter = 125;
  const donutInner = 90;

  const employeeBarHeight = Math.min(
    520,
    Math.max(100, (overviewData?.prsByEmployee?.length || 1) * 36 + 40)
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  const totalPRCount = overviewData?.totalPRs ?? 0;

  return (
    <div className={pageRootClass}>
      <div className={pageContentClass}>
        <div className="shrink-0 pb-2">
          <DepartmentPageHero
            kicker="Trưởng phòng · Phòng ban"
            title="Tổng quan PR phòng ban"
            description="Quản lý xu hướng mua hàng của phòng ban — chỉ xem, không thao tác"
            Icon={Building2}
            tint="violet"
            regionLabel="Tổng quan PR phòng ban"
          />
        </div>

        <article
          className={`${dashboardV3IslandClass} !p-4 !shadow-[0_12px_22px_-10px_rgba(15,23,42,0.07)] space-y-3 md:!p-5 slide-right-card-1`}
        >
          <SectionHeader
            Icon={Sparkles}
            eyebrow="Tổng quan"
            title="Khối lượng PR phòng ban"
            description="Một con số tổng trước khi drill-down biểu đồ."
            className="gap-1.5 md:gap-2"
          />
          <div className="rounded-2xl border border-indigo-100/80 bg-gradient-to-br from-slate-50 to-indigo-50/70 p-2 ring-1 ring-indigo-200/40 sm:p-2.5">
            <div className="rounded-xl border border-indigo-100/90 bg-white/95 p-3 shadow-[0_12px_24px_-18px_rgba(79,70,229,0.28)] sm:p-3.5">
              <div className="flex items-center gap-3 sm:gap-3.5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-md shadow-indigo-200/50 sm:h-12 sm:w-12 sm:rounded-2xl">
                  <FileText className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-500 sm:text-[11px]">
                    Tổng số PR
                  </p>
                  <p className="mt-0.5 text-3xl font-black tabular-nums leading-none text-slate-900 sm:text-4xl">
                    {totalPRCount.toLocaleString('vi-VN')}
                  </p>
                  <div className="mt-1.5 h-px w-full bg-gradient-to-r from-indigo-200 via-slate-200 to-transparent sm:mt-2" />
                  <p className="mt-1.5 line-clamp-2 text-xs text-slate-600 sm:text-sm">
                    Tất cả PR trong phòng ban (theo dữ liệu tổng hợp).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <div className="flex min-w-0 max-w-full flex-col gap-4 md:gap-5 lg:gap-6">
          <div className="slide-right-content min-w-0">
            <PrStatusDetailByStatusCard
              maxVisibleBodyRows={10}
              rows={(overviewData?.prsByStatus ?? []).map((item: any) => ({
                statusCode: item.statusCode as string | undefined,
                label: item.status,
                count: item.count,
                totalAmount: item.totalAmount,
              }))}
              onViewAll={() => navigate('/dashboard/department-head/my-prs')}
              onRowAction={() => navigate('/dashboard/department-head/my-prs')}
              emptyMessage="Chưa có dữ liệu"
            />
          </div>

          <div className="grid min-w-0 max-w-full grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-2 lg:gap-6">
            <article
              ref={prByTypeCardRef}
              className={`${dashboardV3IslandClass} flex min-w-0 flex-col space-y-4 rounded-[2.5rem] border border-slate-200/70 bg-white/90 backdrop-blur-md slide-right-card-3`}
            >
              <SectionHeader
                Icon={PenLine}
                eyebrow="Cơ cấu"
                title="PR theo loại"
                description="Donut + danh sách — tỷ trọng loại hình mua hàng."
              />
              {prsByTypeData.length > 0 ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                  <div
                    className={`chart-wrapper relative h-[300px] w-full min-w-0 ${PR_TYPE_CARD_MOTION} ${
                      prByTypeChartVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
                    }`}
                  >
                    {prByTypeGeneration === 0 ? (
                      <div className="flex h-[300px] w-full items-center justify-center rounded-xl bg-slate-50/95 ring-1 ring-slate-100" aria-hidden />
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height="100%" key={`dept-head-type-${prByTypeGeneration}`}>
                          <PieChart margin={{ top: 12, right: 8, bottom: 20, left: 8 }}>
                            <Pie
                              data={prsByTypeData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={donutInner}
                              outerRadius={donutOuter}
                              paddingAngle={10}
                              cornerRadius={DONUT_CORNER_RADIUS}
                              stroke="transparent"
                              strokeWidth={0}
                              isAnimationActive={prByTypeChartVisible}
                              animationBegin={40}
                              animationDuration={BRANCH_OVERVIEW_CHART_DURATION_MS}
                              animationEasing={DONUT_ANIMATION_EASING}
                            >
                              {prsByTypeData.map((entry, index) => (
                                <Cell key={`type-${entry.name}-${prByTypeGeneration}-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              cursor={false}
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const itemName = String(payload[0]?.name ?? payload[0]?.payload?.name ?? '');
                                return (
                                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg">
                                    {itemName || 'Loại PR'}
                                  </div>
                                );
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px' }} iconType="circle" iconSize={8} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                          <div className="text-center">
                            <p className="text-2xl font-bold tabular-nums text-blue-600 sm:text-3xl">{totalPRsCharts}</p>
                            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">TỔNG PR</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div
                    className={`max-h-36 space-y-2 overflow-y-auto scrollbar-hide ${PR_TYPE_CARD_MOTION} ${
                      prByTypeChartVisible ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {prsByTypeData.map((item: any, index: number) => (
                      <div
                        key={index}
                        className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-slate-50 p-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="h-3.5 w-3.5 shrink-0 rounded" style={{ backgroundColor: item.color }} />
                          <span className="truncate text-sm font-medium text-slate-700" title={item.name}>
                            {item.name}
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-sm font-bold tabular-nums text-slate-900">{item.value}</span>
                          <div className="text-[11px] text-slate-500">{formatCurrency(item.amount)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center py-12 text-slate-500">
                  <TrendingUp className="mb-4 h-16 w-16 text-slate-300" strokeWidth={1.5} />
                  <p>Chưa có dữ liệu</p>
                </div>
              )}
            </article>

            <DepartmentHeadEmployeePrBarCard
              rows={prsByEmployeeData}
              chartHeight={employeeBarHeight}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const DepartmentOverview = () => {
  const navigate = useNavigate();
  const pageRootClass = 'w-full min-h-full min-w-0 bg-[#f1f5f9]';
  const pageContentClass = 'mx-auto w-full max-w-none min-w-0 space-y-6 px-1 pt-3 pb-4 sm:px-1.5 sm:pt-4 sm:pb-5 md:px-3';

  const { data: overviewData, isLoading, error } = useQuery({
    queryKey: ['department-overview'],
    queryFn: getDepartmentOverview,
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className={pageRootClass}>
        <div className={pageContentClass}>
          <DashboardV3ShimmerBlock className="h-28 w-full" />
          <div className="rounded-[28px] border border-slate-200/60 bg-white/60 p-6 backdrop-blur-sm md:p-8">
            <div className="mb-6 h-5 w-64 rounded-lg bg-slate-200/90" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <DashboardV3ShimmerBlock className="min-h-[280px]" />
              <DashboardV3ShimmerBlock className="min-h-[280px]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={pageRootClass}>
        <div className={pageContentClass}>
          <div className="rounded-[28px] border border-rose-200/90 bg-rose-50/95 p-6 shadow-[0_20px_25px_-5px_rgba(239,68,68,0.12)] md:p-8">
            <p className="text-lg font-bold text-rose-900">Lỗi khi tải dữ liệu</p>
            <p className="mt-2 text-sm font-medium text-rose-800/90">
              {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!overviewData) {
    return (
      <div className={pageRootClass}>
        <div className={pageContentClass}>
          <DashboardV3ShimmerBlock className="h-28 w-full" />
        </div>
      </div>
    );
  }

  return <DepartmentOverviewLoaded overviewData={overviewData as Record<string, any>} navigate={navigate} />;
};

export default DepartmentOverview;

