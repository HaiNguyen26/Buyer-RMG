import { useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  AlertTriangle,
  Percent,
  Timer,
  TrendingUp,
  Factory,
  ShoppingBag,
  LayoutDashboard,
  BarChart3,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { branchManagerService } from '../../services/branchManagerService';
import { BranchManagerPageHero } from '../../components/BranchManagerPageHero';
import {
  branchManagerKpiGridClass,
  branchManagerKpiIslandPaddingClass,
  branchManagerPageContentClass,
  branchManagerPageRootClass,
} from '../../constants/branchManagerLayout';
import {
  DashboardV3ShimmerBlock,
  dashboardV3CtaLinkClass,
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
} from '../../components/dashboard/DashboardV3Chrome';
import { StatCard } from '../../components/buyer-manager/StatCard';
import { SectionHeader } from '../../components/buyer-manager/SectionHeader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const DashboardHome = () => {
  const navigate = useNavigate();
  const rightColumnStackRef = useRef<HTMLDivElement | null>(null);
  /** lg: cố định chiều cao khối PR trái = chiều cao cột phải (không giãn theo số dòng bảng). */
  const [pairedRowHeightPx, setPairedRowHeightPx] = useState<number | null>(null);

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['branch-manager-dashboard'],
    queryFn: () => branchManagerService.getDashboard(),
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  useLayoutEffect(() => {
    const el = rightColumnStackRef.current;
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      if (!mq.matches || !el) {
        setPairedRowHeightPx(null);
        return;
      }
      setPairedRowHeightPx(Math.round(el.getBoundingClientRect().height));
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
  }, [isLoading, error, dashboardData]);

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '0 VND';
    if (amount >= 1000000000) {
      return `${(amount / 1000000000).toFixed(2)} tỷ VND`;
    }
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)} triệu VND`;
    }
    return `${amount.toLocaleString('vi-VN')} VND`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className={branchManagerPageRootClass}>
        <div className={branchManagerPageContentClass}>
          <DashboardV3ShimmerBlock className="h-28 w-full rounded-[28px]" />
          <div className="rounded-[28px] border border-slate-200/60 bg-white/60 p-6 backdrop-blur-sm md:p-8">
            <div className="mb-6 h-5 w-52 rounded-lg bg-slate-200/90" />
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 min-[480px]:gap-5 sm:gap-5 xl:grid-cols-4 xl:gap-6">
              <DashboardV3ShimmerBlock className="h-36" />
              <DashboardV3ShimmerBlock className="h-36" />
              <DashboardV3ShimmerBlock className="h-36" />
              <DashboardV3ShimmerBlock className="h-36" />
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-200/60 bg-white/60 p-6 backdrop-blur-sm md:p-8">
            <div className="mb-6 h-5 w-48 rounded-lg bg-slate-200/90" />
            <DashboardV3ShimmerBlock className="h-56 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={branchManagerPageRootClass}>
        <div className={branchManagerPageContentClass}>
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

  const d = dashboardData!;
  const approvalRate = d.approvalRateLast30d ?? 0;
  const leadHours = d.avgBranchApprovalLeadTimeHours ?? 0;
  const budgetVar = d.budgetVarianceAvgOverPercent ?? 0;
  const prodShare = d.productionValueSharePercent ?? 0;

  const prsByTypeData = d.prsByType
    ? [
        { name: 'Sản xuất', value: d.prsByType.PRODUCTION, color: '#10B981' },
        { name: 'Thương mại', value: d.prsByType.COMMERCIAL, color: '#6366F1' },
      ]
    : [];

  const budgetVarianceVariant =
    d.budgetExceptionsPending > 0 && budgetVar > 0 ? 'rose' : 'slate';

  const kpiActivity = (count: number): 'active' | 'zero' => (count > 0 ? 'active' : 'zero');

  return (
    <div className={branchManagerPageRootClass}>
      <div className={branchManagerPageContentClass}>
        <div className="shrink-0 pb-2">
          <BranchManagerPageHero
            kicker="Giám đốc chi nhánh · Tổng quan"
            title="Dashboard Giám đốc Chi nhánh"
            Icon={LayoutDashboard}
            tint="graphite"
            regionLabel="Dashboard Giám đốc Chi nhánh"
          />
        </div>

        <article
          className={`${dashboardV3IslandClass} ${dashboardV3IslandOpaqueClass} ${branchManagerKpiIslandPaddingClass} slide-right-content space-y-5`}
        >
          <SectionHeader Icon={Sparkles} eyebrow="Cốt lõi" title="Chỉ số chủ chốt" />
          <div className={branchManagerKpiGridClass}>
            <StatCard
              variant="bento"
              embedded
              activity={kpiActivity(d.pendingPRs)}
              accent="amber"
              Icon={Clock}
              label="PR chờ duyệt"
              value={d.pendingPRs}
              unit="PR"
              hint="Đang ở trạng thái chờ GĐ chi nhánh."
              onClick={() => navigate('/dashboard/branch-manager/pr-approval')}
            />
            <StatCard
              variant="bento"
              embedded
              activity={kpiActivity(d.budgetExceptionsPending)}
              accent="rose"
              Icon={AlertTriangle}
              label="Ngoại lệ ngân sách"
              value={d.budgetExceptionsPending}
              unit="hồ sơ"
              hint="Cần quyết định chấp nhận / từ chối / đàm phán."
              onClick={() => navigate('/dashboard/branch-manager/budget-exception')}
            />
            <StatCard
              variant="bento"
              embedded
              activity={kpiActivity(approvalRate > 0 ? 1 : 0)}
              accent="emerald"
              Icon={Percent}
              label="Tỷ lệ phê duyệt (30 ngày)"
              value={approvalRate.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
              unit="%"
              hint="Đã duyệt / (đã duyệt + từ chối) trong 30 ngày gần nhất."
            />
            <StatCard
              variant="bento"
              embedded
              activity={kpiActivity(leadHours > 0 ? 1 : 0)}
              accent="indigo"
              Icon={Timer}
              label="Lead time duyệt TB"
              value={leadHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
              unit="giờ"
              hint="Trung bình từ lúc tạo PR đến thời điểm bạn phê duyệt (mẫu APPROVE của bạn)."
            />
          </div>
        </article>

        <div className="grid min-h-0 min-w-0 max-w-full grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start lg:gap-8">
          <article
            className={`${dashboardV3IslandClass} ${dashboardV3IslandOpaqueClass} slide-right-content flex min-h-0 w-full min-w-0 flex-col gap-6 overflow-hidden lg:col-span-2 lg:h-full lg:max-h-full`}
            style={
              pairedRowHeightPx != null
                ? { height: pairedRowHeightPx, maxHeight: pairedRowHeightPx }
                : undefined
            }
          >
            <div className="shrink-0">
              <SectionHeader
                Icon={ClipboardList}
                eyebrow="Hàng đợi"
                title="Hàng đợi duyệt"
                description="PR chờ GĐ chi nhánh — bấm dòng để mở màn hình phê duyệt."
              />
            </div>
            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-[#F8FAFC] px-4 py-3 sm:px-6">
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">{d.recentPendingPRs?.length ?? 0}</span> PR hiển thị
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/branch-manager/pr-approval')}
                  className={`${dashboardV3CtaLinkClass} px-4 py-2 text-xs sm:text-sm`}
                >
                  Mở duyệt
                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto bg-white [-webkit-overflow-scrolling:touch] scrollbar-hide">
                {!d.recentPendingPRs || d.recentPendingPRs.length === 0 ? (
                  <div className="flex min-h-[12rem] flex-col items-center justify-center px-6 py-12 text-center text-slate-500 lg:flex-1 lg:min-h-0">
                    <p>Không có PR nào chờ duyệt</p>
                  </div>
                ) : (
                  <table className="w-full min-w-0 table-fixed border-collapse text-left text-sm">
                    <colgroup>
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '34%' }} />
                      <col style={{ width: '28%' }} />
                      <col style={{ width: '22%' }} />
                    </colgroup>
                    <thead className="sticky top-0 z-10 border-b border-slate-100 bg-[#F8FAFC] shadow-[inset_0_-1px_0_0_rgb(241_245_249)]">
                      <tr>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-4 sm:py-3">
                          Mã PR
                        </th>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-4 sm:py-3">
                          Người yêu cầu
                        </th>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-4 sm:py-3">
                          Tổng tiền
                        </th>
                        <th className="px-2 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-4 sm:py-3">
                          Ngày gửi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {d.recentPendingPRs.map((pr: any, index: number) => (
                        <tr
                          key={pr.id}
                          onClick={() =>
                            navigate('/dashboard/branch-manager/pr-approval', { state: { prId: pr.id } })
                          }
                          className="group cursor-pointer bg-white transition-all duration-300 ease-out [&>td]:relative [&>td]:transition-all [&>td]:duration-300 [&>td]:ease-out [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl hover:[&>td]:z-[2] hover:[&>td]:-translate-y-[1px] hover:[&>td]:bg-indigo-50/80 hover:[&>td]:shadow-[inset_0_1px_0_rgba(99,102,241,0.24),inset_0_-1px_0_rgba(99,102,241,0.24)] hover:[&>td:first-child]:shadow-[-12px_0_28px_-14px_rgba(79,70,229,0.38),inset_0_1px_0_rgba(99,102,241,0.24),inset_0_-1px_0_rgba(99,102,241,0.24)] hover:[&>td:last-child]:shadow-[12px_0_28px_-14px_rgba(79,70,229,0.38),inset_0_1px_0_rgba(99,102,241,0.24),inset_0_-1px_0_rgba(99,102,241,0.24)]"
                          style={{ animationDelay: `${0.05 * index}s` }}
                        >
                          <td className="relative min-w-0 px-2 py-2 sm:px-4 sm:py-3">
                            <div
                              aria-hidden
                              className="pointer-events-none absolute inset-y-2 left-0 z-[1] w-[3px] rounded-r-full bg-indigo-600 opacity-0 transition-all duration-300 ease-out group-hover:opacity-100"
                            />
                            <div className="flex items-center gap-2">
                              <span className="break-words text-sm font-bold text-slate-900">{pr.prNumber}</span>
                              <ChevronRight className="h-3.5 w-3.5 text-indigo-400 opacity-0 transition-all duration-200 group-hover:opacity-100" />
                            </div>
                          </td>
                          <td className="min-w-0 px-2 py-2 sm:px-4 sm:py-3">
                            <div className="break-words text-sm font-medium text-slate-900">
                              {pr.requestor?.username || 'N/A'}
                            </div>
                            <div className="break-words text-xs text-slate-500">{pr.department}</div>
                          </td>
                          <td className="min-w-0 px-2 py-2 sm:px-4 sm:py-3">
                            <span className="break-words text-sm font-semibold text-slate-900">
                              {formatCurrency(pr.totalAmount)}
                            </span>
                          </td>
                          <td className="min-w-0 px-2 py-2 sm:px-4 sm:py-3">
                            <span className="break-words text-sm text-slate-600">{formatDate(pr.createdAt)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </article>

          <div ref={rightColumnStackRef} className="flex min-h-0 min-w-0 flex-col gap-5">
            <article className={`${dashboardV3IslandClass} ${dashboardV3IslandOpaqueClass} slide-right-card-1 min-w-0 space-y-5 sm:space-y-6`}>
              <SectionHeader Icon={BarChart3} eyebrow="Phân tích" title="Ảnh chụp tài chính & cơ cấu" />
              <div className="min-w-0 space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Giá trị PR tháng này</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                    {formatCurrency(d.totalPRValueThisMonth || 0)}
                  </p>
                  <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Tỷ trọng PRODUCTION (giá trị)</dt>
                      <dd className="font-semibold tabular-nums text-emerald-600">
                        {prodShare.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Vượt ngân sách TB (ngoại lệ chờ)</dt>
                      <dd
                        className={`font-semibold tabular-nums ${
                          budgetVarianceVariant === 'rose' ? 'text-rose-600' : 'text-slate-700'
                        }`}
                      >
                        {budgetVar.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">PR đã duyệt (30 ngày)</dt>
                      <dd className="font-semibold text-slate-900">{d.approvedPRsThisPeriod}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-[#F8FAFC] px-4 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 sm:text-base">
                      <TrendingUp className="h-5 w-5 shrink-0 text-indigo-600" strokeWidth={2} />
                      PR đã duyệt theo ngày (30 ngày)
                    </h3>
                  </div>
                  <div className="p-3 sm:p-4">
                    {d.prsByDate && d.prsByDate.length > 0 ? (
                      <div className="h-[200px] w-full min-w-0 sm:h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={d.prsByDate}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 11, fill: '#64748B' }}
                              tickFormatter={(value) => {
                                const date = new Date(value);
                                return `${date.getDate()}/${date.getMonth() + 1}`;
                              }}
                            />
                            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #E5E7EB',
                                borderRadius: '12px',
                                boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                              }}
                              labelFormatter={(value) => formatDate(String(value))}
                            />
                            <Bar dataKey="count" fill="#4F46E5" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="py-8 text-center text-sm text-slate-400">Chưa có dữ liệu</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-[#F8FAFC] px-4 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 sm:text-base">
                      <ShoppingBag className="h-5 w-5 shrink-0 text-indigo-600" strokeWidth={2} />
                      Sản xuất vs Thương mại (tháng)
                    </h3>
                  </div>
                  <div className="flex min-h-[200px] items-center justify-center p-3 sm:p-4">
                    {prsByTypeData.some((item) => item.value > 0) ? (
                      <div className="h-[200px] w-full min-w-0 sm:h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={prsByTypeData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, value, percent }) =>
                                `${name}: ${value} (${percent != null ? (percent * 100).toFixed(0) : 0}%)`
                              }
                              outerRadius={78}
                              dataKey="value"
                            >
                              {prsByTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #E5E7EB',
                                borderRadius: '12px',
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-center text-slate-500">
                        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                          <span className="inline-flex items-center gap-2">
                            <Factory className="h-5 w-5 text-emerald-600" strokeWidth={2} />
                            Sản xuất: {d.prsByType?.PRODUCTION ?? 0}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5 text-indigo-600" strokeWidth={2} />
                            Thương mại: {d.prsByType?.COMMERCIAL ?? 0}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">Chưa có PR đã duyệt trong tháng</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
