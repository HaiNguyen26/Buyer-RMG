import { useRef } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Users } from 'lucide-react';
import { SectionHeader } from '../../components/buyer-manager/SectionHeader';
import { dashboardV3IslandClass } from '../../components/dashboard/DashboardV3Chrome';
import { useIntersectionVisible } from '../../hooks/useIntersectionVisible';
import { departmentHeadChartIntersectionOptions } from '../../constants/departmentHeadLayout';
import { BRANCH_OVERVIEW_CHART_DURATION_MS, DONUT_ANIMATION_EASING } from '../../utils/rechartsDonut';

const CARD_CHART_TRANSITION =
  'transition-all duration-700 ease-out motion-reduce:transform-none motion-reduce:transition-none motion-reduce:opacity-100';

function horizBarActiveHover(hoverGradientId: string, barProps: Record<string, unknown>) {
  const w = Number(barProps.width ?? 0);
  const h = Number(barProps.height ?? 0);
  const x = Number(barProps.x ?? 0);
  const y = Number(barProps.y ?? 0);
  const padX = Math.max(4, w * 0.06);
  const padY = Math.max(2, h * 0.12);
  return (
    <Rectangle
      {...barProps}
      x={x - padX * 0.35}
      y={y - padY * 0.5}
      width={w + padX}
      height={h + padY}
      radius={[0, 16, 16, 0]}
      fill={`url(#${hoverGradientId})`}
      stroke="#312e81"
      strokeWidth={2}
      style={{ filter: 'drop-shadow(0 12px 22px rgb(79 70 229 / 0.24))', transition: 'all 160ms ease-out' }}
    />
  );
}

export type EmployeePrRow = { name: string; value: number; amount: number };

export function DepartmentHeadEmployeePrBarCard({
  rows,
  chartHeight,
  formatCurrency,
}: {
  rows: EmployeePrRow[];
  chartHeight: number;
  formatCurrency: (amount: number) => string;
}) {
  const cardRef = useRef<HTMLElement | null>(null);
  const { isIntersecting, generation } = useIntersectionVisible(cardRef, departmentHeadChartIntersectionOptions);

  const hasData = rows.length > 0;
  const gradIdMain = generation > 0 ? `dhEmpGrad-${generation}` : 'dhEmpGrad-prelude';
  const gradIdHover = `dhEmpGrad-hover-${Math.max(generation, 1)}`;

  const chartAreaClass = `${CARD_CHART_TRANSITION} ${
    isIntersecting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
  }`;

  return (
    <article ref={cardRef} className={`${dashboardV3IslandClass} flex min-w-0 flex-col space-y-4 rounded-[2.5rem] border border-slate-200/70 bg-white/90 backdrop-blur-md slide-right-card-2`}>
      <SectionHeader
        Icon={Users}
        eyebrow="Nguồn lực"
        title="PR theo nhân viên"
        description="Cột ngang gradient indigo · hover nhấn nhá — đồng bộ Branch Overview."
      />
      {hasData ? (
        <div className={`chart-wrapper flex min-h-0 min-w-0 flex-1 flex-col gap-3 ${chartAreaClass}`}>
          {generation === 0 ? (
            <div
              className="w-full min-w-0 rounded-xl bg-slate-50/95 ring-1 ring-slate-100"
              style={{ height: chartHeight }}
              aria-hidden
            />
          ) : (
            <div className="w-full min-w-0" style={{ height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%" key={`dh-emp-${generation}`}>
                <BarChart
                  layout="vertical"
                  data={rows}
                  margin={{ top: 8, right: 20, left: 4, bottom: 28 }}
                  barCategoryGap="18%"
                >
                  <defs>
                    <linearGradient id={gradIdMain} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#4338CA" stopOpacity={0.98} />
                      <stop offset="45%" stopColor="#6366F1" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#A5B4FC" stopOpacity={0.98} />
                    </linearGradient>
                    <linearGradient id={gradIdHover} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3730A3" />
                      <stop offset="100%" stopColor="#C7D2FE" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.65} horizontal={false} vertical />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={124}
                    tick={{ fontSize: 11, fill: '#475569' }}
                    interval={0}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 16)}…` : v)}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                    animationDuration={200}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0]?.payload as EmployeePrRow;
                      return (
                        <div
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg"
                          style={{ fontSize: 12 }}
                        >
                          <p className="mb-1 font-semibold text-slate-800">{p.name}</p>
                          <p className="tabular-nums text-slate-700">
                            <span className="text-indigo-600">{p.value}</span> PR
                          </p>
                          <p className="mt-0.5 text-slate-500">{formatCurrency(p.amount)}</p>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: '10px', letterSpacing: '0.06em', color: '#94a3b8', paddingTop: 4 }}
                    content={() => (
                      <div className="flex items-center justify-center gap-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
                        Số PR theo người tạo
                      </div>
                    )}
                  />
                  <Bar
                    dataKey="value"
                    name="Số PR"
                    radius={[0, 12, 12, 0]}
                    fill={`url(#${gradIdMain})`}
                    maxBarSize={18}
                    isAnimationActive={isIntersecting}
                    animationDuration={BRANCH_OVERVIEW_CHART_DURATION_MS}
                    animationEasing={DONUT_ANIMATION_EASING}
                    activeBar={(props: Record<string, unknown>) => horizBarActiveHover(gradIdHover, props)}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {generation > 0 ? (
            <ul className="max-h-28 space-y-1.5 overflow-y-auto scrollbar-hide rounded-xl border border-slate-100 bg-[#fafbfd] px-3 py-2 text-[11px] text-slate-500">
              {rows.slice(0, 8).map((r) => (
                <li key={r.name} className="flex min-w-0 justify-between gap-2 tabular-nums">
                  <span className="truncate font-medium text-slate-600" title={r.name}>
                    {r.name}
                  </span>
                  <span className="shrink-0 text-slate-400">{formatCurrency(r.amount)}</span>
                </li>
              ))}
              {rows.length > 8 ? <li className="text-center text-slate-400">…</li> : null}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-slate-500">
          <Users className="mb-4 h-16 w-16 text-slate-300" strokeWidth={1.5} />
          <p>Chưa có dữ liệu</p>
        </div>
      )}
    </article>
  );
}
