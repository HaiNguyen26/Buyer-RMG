import { useMemo, useRef } from 'react';
import { Award, Building2, Hash, Layers, ShoppingBag, Sparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionHeader } from '../../components/buyer-manager/SectionHeader';
import { dashboardV3IslandClass } from '../../components/dashboard/DashboardV3Chrome';
import { useIntersectionVisible } from '../../hooks/useIntersectionVisible';
import {
  BRANCH_OVERVIEW_CHART_DURATION_MS,
  DONUT_ANIMATION_EASING,
  DONUT_CORNER_RADIUS,
  donutPaddingAngleDeg,
  donutSectorShapeStatic,
} from '../../utils/rechartsDonut';

const CHART_MIN_H = 'min-h-[300px]';
const CARD_CHART_TRANSITION =
  'transition-all duration-700 ease-out motion-reduce:transform-none motion-reduce:transition-none motion-reduce:opacity-100';

type DeptRow = { department: string; count: number };
type TypeRow = { type: string; count: number };

const PRODUCTION_LABEL = 'Sản xuất';
const COMMERCIAL_LABEL = 'Thương mại';

/** Pastel cho 2 nhóm PR theo loại */
const BRANCH_OVERVIEW_SLICE_PASTEL = {
  PRODUCTION: '#ADB5FB',
  COMMERCIAL: '#9FD9C9',
} as const;

type TypeSliceRow = {
  name: string;
  typeCode: string;
  value: number;
  fill: string;
};

/** activeBar của Recharts: rect lớn hơn một chút + shadow nhẹ (“phình”). */
function barActiveHoverRect(hoverGradientId: string, barProps: Record<string, unknown>) {
  const w = Number(barProps.width ?? 0);
  const h = Number(barProps.height ?? 0);
  const x = Number(barProps.x ?? 0);
  const y = Number(barProps.y ?? 0);
  const dx = w * 0.06;
  const dyTop = h * 0.04;
  return (
    <Rectangle
      {...barProps}
      x={x - dx / 2}
      y={y - dyTop}
      width={w + dx}
      height={h + dyTop}
      radius={[18, 18, 9, 9]}
      fill={`url(#${hoverGradientId})`}
      stroke="#312e81"
      strokeWidth={2}
      style={{ filter: 'drop-shadow(0 14px 24px rgb(79 70 229 / 0.26))', transition: 'all 160ms ease-out' }}
    />
  );
}

function DepartmentPRBarChartCard({ departmentChartData }: { departmentChartData: DeptRow[] }) {
  const cardRef = useRef<HTMLElement | null>(null);
  const { isIntersecting, generation } = useIntersectionVisible(cardRef, {
    threshold: 0.2,
    rootMargin: '0px 0px 14% 0px',
    resetWhenOutOfView: true,
  });

  const hasData = departmentChartData.length > 0;

  const deptSummary = useMemo(() => {
    if (!departmentChartData.length) return null;
    const total = departmentChartData.reduce((s, d) => s + d.count, 0);
    const sorted = [...departmentChartData].sort((a, b) => b.count - a.count);
    const withPr = departmentChartData.filter((d) => d.count > 0).length;
    return {
      total,
      withPr,
      top: sorted[0],
      topThree: sorted.slice(0, 3).filter((d) => d.count > 0),
    };
  }, [departmentChartData]);

  const gradIdMain = generation > 0 ? `branchOvDeptGrad-${generation}` : 'branchOvDeptGrad-prelude';
  const gradIdHover = `branchOvDeptGrad-hover-${Math.max(generation, 1)}`;

  const chartAreaClass = `${CHART_MIN_H} ${CARD_CHART_TRANSITION} ${
    isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
  }`;

  return (
    <article ref={cardRef} className={`${dashboardV3IslandClass} slide-right-content flex flex-col`}>
      <SectionHeader
        Icon={Building2}
        eyebrow="Phòng ban"
        title="Tổng PR theo phòng ban"
        description="Gradient indigo · bo cột · hover nhấn nhá."
      />
      <div className={`mt-4 min-w-0 flex-1 md:mt-6 ${chartAreaClass}`}>
        {!hasData ? (
          <div className="flex h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
            <p className="text-sm text-slate-400">Chưa có dữ liệu</p>
          </div>
        ) : generation === 0 ? (
          <div className="flex h-[300px] items-center rounded-xl bg-slate-50/95 ring-1 ring-slate-100" aria-hidden />
        ) : (
          <ResponsiveContainer width="100%" height={300} key={`branch-dept-${generation}`}>
            <BarChart
              data={departmentChartData}
              margin={{ top: 14, right: 8, left: -8, bottom: 4 }}
              barCategoryGap="24%"
              barGap={4}
            >
              <defs>
                <linearGradient id={gradIdMain} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#4338CA" stopOpacity={0.98} />
                  <stop offset="55%" stopColor="#6366F1" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#E0E7FF" stopOpacity={0.98} />
                </linearGradient>
                <linearGradient id={gradIdHover} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#3730A3" />
                  <stop offset="100%" stopColor="#C7D2FE" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeOpacity={0.85} vertical={false} />
              <XAxis
                dataKey="department"
                tick={{ fontSize: 12, fill: '#64748B' }}
                angle={-40}
                textAnchor="end"
                height={86}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748B' }}
                tickLine={false}
                axisLine={{ stroke: '#E2E8F0' }}
                width={42}
              />
              <Tooltip
                cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                animationDuration={200}
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 12px 32px rgb(15 23 42 / 0.1)',
                  fontSize: '12px',
                }}
              />
              <Bar
                dataKey="count"
                name="Số PR"
                radius={[14, 14, 6, 6]}
                fill={`url(#${gradIdMain})`}
                maxBarSize={56}
                isAnimationActive={isIntersecting}
                animationDuration={BRANCH_OVERVIEW_CHART_DURATION_MS}
                animationEasing={DONUT_ANIMATION_EASING}
                activeBar={(props: Record<string, unknown>) => barActiveHoverRect(gradIdHover, props)}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {hasData && generation > 0 && deptSummary ? (
        <div
          className={`mt-5 min-w-0 space-y-4 border-t border-slate-100/90 pt-5 ${CARD_CHART_TRANSITION} ${
            isIntersecting ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
          }`}
        >
          <div className="relative overflow-hidden rounded-2xl border border-indigo-100/90 bg-gradient-to-br from-indigo-50/95 via-white to-slate-50/90 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_10px_40px_-20px_rgba(79,70,229,0.18)] ring-1 ring-indigo-500/5 sm:p-5">
            <div
              className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-indigo-400/25 to-transparent blur-2xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-10 left-1/3 h-24 w-40 rounded-full bg-violet-400/10 blur-3xl"
              aria-hidden
            />
            <div className="relative flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600/90">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" strokeWidth={2} aria-hidden />
              Tóm tắt nhanh
            </div>
            <div className="relative mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white/80 px-3 py-3 shadow-sm ring-1 ring-slate-100/95 backdrop-blur-sm sm:py-3.5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Layers className="h-4 w-4 shrink-0 text-indigo-500" strokeWidth={2} aria-hidden />
                  Tổng PR
                </div>
                <p className="mt-1.5 font-black tabular-nums leading-none text-slate-900">
                  <span className="text-2xl tracking-tight">{deptSummary.total}</span>
                  <span className="ml-1.5 text-sm font-semibold text-slate-500">PR</span>
                </p>
              </div>
              <div className="rounded-xl bg-white/80 px-3 py-3 shadow-sm ring-1 ring-slate-100/95 backdrop-blur-sm sm:py-3.5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Hash className="h-4 w-4 shrink-0 text-indigo-500" strokeWidth={2} aria-hidden />
                  Phòng ban có PR
                </div>
                <p className="mt-1.5 font-black tabular-nums leading-none text-slate-900">
                  <span className="text-2xl tracking-tight">{deptSummary.withPr}</span>
                  <span className="ml-1.5 text-sm font-semibold text-slate-500">/ {departmentChartData.length}</span>
                </p>
              </div>
              <div className="rounded-xl bg-white/80 px-3 py-3 shadow-sm ring-1 ring-slate-100/95 backdrop-blur-sm sm:py-3.5">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <Award className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={2} aria-hidden />
                  Dẫn đầu
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-slate-900">
                  {deptSummary.top?.department ?? '—'}
                </p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums text-indigo-700">
                  {deptSummary.top?.count ?? 0} PR
                </p>
              </div>
            </div>

            {deptSummary.topThree.length > 1 ? (
              <div className="relative mt-4 flex flex-wrap gap-2">
                {deptSummary.topThree.map((row, idx) => (
                  <span
                    key={row.department}
                    className="inline-flex items-center gap-2 rounded-full border border-indigo-100/90 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_2px_8px_-4px_rgba(79,70,229,0.35)] ring-1 ring-white/80"
                    style={{
                      opacity: isIntersecting ? 1 : 0,
                      transform: isIntersecting ? 'translateY(0)' : 'translateY(8px)',
                      transition: 'opacity 450ms cubic-bezier(0.25, 1, 0.5, 1), transform 450ms cubic-bezier(0.25, 1, 0.5, 1)',
                      transitionDelay: isIntersecting ? `${120 + idx * 70}ms` : '0ms',
                    }}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-black text-indigo-700">
                      {idx + 1}
                    </span>
                    <span className="max-w-[9rem] truncate sm:max-w-[11rem]">{row.department}</span>
                    <span className="tabular-nums text-indigo-700">{row.count}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function TypeCompositionDonutCard({ typeChartData }: { typeChartData: TypeRow[] }) {
  const cardRef = useRef<HTMLElement | null>(null);
  const { isIntersecting, generation } = useIntersectionVisible(cardRef, {
    threshold: 0.2,
    rootMargin: '0px 0px 14% 0px',
    resetWhenOutOfView: true,
  });

  const typePieData: TypeSliceRow[] = useMemo(() => {
    const prodCount = Number(typeChartData.find((t) => t.type === 'PRODUCTION')?.count ?? 0);
    const commCount = Number(typeChartData.find((t) => t.type === 'COMMERCIAL')?.count ?? 0);
    return [
      {
        name: PRODUCTION_LABEL,
        typeCode: 'PRODUCTION',
        value: prodCount,
        fill: BRANCH_OVERVIEW_SLICE_PASTEL.PRODUCTION,
      },
      {
        name: COMMERCIAL_LABEL,
        typeCode: 'COMMERCIAL',
        value: commCount,
        fill: BRANCH_OVERVIEW_SLICE_PASTEL.COMMERCIAL,
      },
    ].filter((r) => r.value > 0);
  }, [typeChartData]);

  const total = useMemo(() => typePieData.reduce((s, r) => s + r.value, 0), [typePieData]);
  const outerRadius = 96;
  const innerRadius = Math.round(outerRadius * 0.75);
  const padDeg = donutPaddingAngleDeg(outerRadius, 5);

  const chartMotion = `${CARD_CHART_TRANSITION} ${isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`;

  const hasSlices = typePieData.length > 0;

  return (
    <article ref={cardRef} className={`${dashboardV3IslandClass} slide-right-card-1 flex flex-col`}>
      <SectionHeader
        Icon={ShoppingBag}
        eyebrow="Cơ cấu"
        title="PR theo loại"
        description="Pastel donut 75% · legend SL + phần trăm · stagger vào nhìn."
      />
      <div className="mt-4 flex min-h-[320px] min-w-0 flex-1 flex-col gap-5 md:mt-6">
        {!hasSlices ? (
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-14">
            <p className="text-sm text-slate-400">Chưa có dữ liệu theo loại</p>
          </div>
        ) : generation === 0 ? (
          <div className="flex min-h-[300px] w-full flex-1 items-center justify-center rounded-xl bg-slate-50/95 ring-1 ring-slate-100" aria-hidden />
        ) : (
          <>
            <div className={`relative mx-auto h-[260px] w-full max-w-md shrink-0 sm:h-[280px] md:h-[300px] ${chartMotion}`}>
              <ResponsiveContainer width="100%" height="100%" key={`branch-type-${generation}`}>
                <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                  <Pie
                    data={typePieData}
                    dataKey="value"
                    nameKey="name"
                    cx="48%"
                    cy="50%"
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    paddingAngle={padDeg}
                    cornerRadius={DONUT_CORNER_RADIUS}
                    stroke="transparent"
                    strokeWidth={0}
                    isAnimationActive={isIntersecting}
                    animationBegin={40}
                    animationDuration={BRANCH_OVERVIEW_CHART_DURATION_MS}
                    animationEasing={DONUT_ANIMATION_EASING}
                    shape={donutSectorShapeStatic}
                  >
                    {typePieData.map((entry, idx) => (
                      <Cell key={`slice-${entry.typeCode}-${generation}-${idx}`} fill={entry.fill} stroke="white" strokeWidth={1.25} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E5E7EB',
                      borderRadius: '12px',
                      boxShadow: '0 12px 32px rgb(15 23 42 / 0.1)',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {total > 0 ? (
                <div className="pointer-events-none absolute left-[48%] top-1/2 z-[1] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-center">
                  <span className="text-2xl font-black tabular-nums leading-none text-indigo-900">{total}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">PR</span>
                </div>
              ) : null}
            </div>

            <ul
              className={`flex w-full flex-1 flex-col justify-center gap-3 rounded-2xl border border-slate-100 bg-[#fafbfd] px-4 py-4 sm:py-5 ${CARD_CHART_TRANSITION}`}
              style={{
                opacity: isIntersecting ? 1 : 0,
                transform: isIntersecting ? 'translateY(0)' : 'translateY(12px)',
              }}
            >
              {typePieData.map((row, idx) => {
                const pct = total > 0 ? (row.value / total) * 100 : 0;
                return (
                  <li
                    key={row.typeCode}
                    className="flex min-w-0 items-start gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100/90 shadow-[0_1px_6px_-2px_rgb(15_23_42/0.08)] sm:gap-4"
                    style={{
                      opacity: isIntersecting ? 1 : 0,
                      transform: isIntersecting ? 'translateY(0)' : 'translateY(14px)',
                      transitionProperty: 'opacity, transform',
                      transitionDuration: '500ms',
                      transitionTimingFunction: 'cubic-bezier(0.25, 1, 0.5, 1)',
                      transitionDelay: isIntersecting ? `${80 + idx * 105}ms` : '0ms',
                    }}
                  >
                    <span
                      className="mt-1 h-3.5 w-3.5 shrink-0 rounded-md shadow-sm ring-2 ring-white"
                      style={{ backgroundColor: row.fill }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-bold text-slate-900">{row.name}</span>
                        <span className="tabular-nums text-sm font-semibold text-slate-600">
                          SL:{' '}
                          <span className="text-indigo-700">{String(Math.round(row.value)).padStart(2, '0')}</span>
                        </span>
                        <span className="tabular-nums text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          {pct >= 99.94 ? pct.toFixed(0) : pct.toFixed(1)}%
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-slate-400">
                        {row.typeCode === 'PRODUCTION' ? 'Tổ hợp sản xuất / vật tư' : 'Thu mua kinh doanh'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </article>
  );
}

export type BranchOverviewChartCardsProps = {
  departmentChartData: DeptRow[];
  typeChartData: TypeRow[];
};

export function BranchOverviewChartCards({ departmentChartData, typeChartData }: BranchOverviewChartCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
      <DepartmentPRBarChartCard departmentChartData={departmentChartData} />
      <TypeCompositionDonutCard typeChartData={typeChartData} />
    </div>
  );
}
