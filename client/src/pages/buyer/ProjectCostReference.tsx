import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Eye, FileText, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { buyerService } from '../../services/buyerService';
import { BuyerPageHero } from '../../components/BuyerPageHero';
import {
  buyerInteractiveTableClass,
  buyerInteractiveTableBodyClass,
  buyerOutletPageShellClass,
  buyerOutletCenterMinHeightClass,
  buyerTableAccentRailClass,
  buyerTableCellWrapClass,
  buyerTableDataRowVisual,
  buyerTableFirstCellInnerClass,
  buyerWorkspacePageStackClass,
  buyerWorkspaceTableViewportClass,
  buyerPanelCardClass,
  buyerDataTableCardClass,
  buyerDataTableCardHeaderClass,
} from '../../constants/buyerLayout';
import { DashboardV3ShimmerBlock, dashboardV3ErrorCardClass } from '../../components/dashboard/DashboardV3Chrome';

const ProjectCostReference = () => {
  const { data: costsData, isLoading, error } = useQuery({
    queryKey: ['buyer-project-costs'],
    queryFn: () => buyerService.getProjectCostReference(),
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const projectsSource = costsData?.projects || [];

  const projectStats = useMemo(() => {
    const projects = projectsSource;
    let over = 0;
    let near = 0;
    for (const p of projects) {
      const budget = p.salesPOAmount ?? p.budget ?? 0;
      if (p.actualCost > budget) over++;
      else if (p.progress >= 80) near++;
    }
    const normal = Math.max(0, projects.length - over - near);
    return { total: projects.length, over, near, normal };
  }, [projectsSource]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className={buyerOutletPageShellClass}>
        <div className={buyerWorkspacePageStackClass}>
          <DashboardV3ShimmerBlock className="h-36 w-full shrink-0 rounded-[28px]" />
          <DashboardV3ShimmerBlock className="h-24 w-full max-w-xl shrink-0 rounded-2xl" />
          <DashboardV3ShimmerBlock className="min-h-[240px] shrink-0 rounded-[28px]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={buyerOutletPageShellClass}>
        <div className={`${buyerWorkspacePageStackClass} ${buyerOutletCenterMinHeightClass} flex flex-col items-center justify-center py-16`}>
          <div className={`max-w-md ${dashboardV3ErrorCardClass}`}>
            <p className="font-medium text-red-800">Lỗi khi tải dữ liệu</p>
            <p className="mt-1 text-sm text-red-600">
              {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const projects = projectsSource;

  return (
    <div className={buyerOutletPageShellClass}>
      <div className={`${buyerWorkspacePageStackClass} animate-fade-in-right fade-in-right-delay-0`}>
      <BuyerPageHero
        kicker="Buyer · Tham chiếu"
        title="Tham chiếu chi phí dự án"
        description="Xem ngân sách và tiến độ chi theo dự án / SO — chỉ đọc, dùng khi đối chiếu báo giá."
        Icon={BarChart3}
        tint="graphite"
        regionLabel="Tham chiếu chi phí dự án"
        rightSlot={
          <div className="min-w-[5.5rem] rounded-xl border border-white/25 bg-white/10 px-2.5 py-2 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/65">Dự án</p>
            <p className="text-lg font-bold tabular-nums leading-tight text-white">{projectStats.total}</p>
            <p className="text-[10px] leading-tight text-white/70">mã trong bảng</p>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="animate-fade-in-right rounded-lg border border-slate-200/50 bg-white p-3.5 shadow-md transition-shadow fade-in-right-stagger-2 hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <div className="rounded-lg bg-indigo-100 p-1.5">
              <FileText className="h-4 w-4 text-indigo-600" strokeWidth={2} />
            </div>
          </div>
          <p className="mb-0.5 text-xl font-bold tabular-nums leading-tight text-slate-900">{projectStats.total}</p>
          <p className="text-[11px] leading-snug text-slate-600">Tổng mã dự án</p>
        </div>
        <div className="animate-fade-in-right rounded-lg border border-slate-200/50 bg-white p-3.5 shadow-md transition-shadow fade-in-right-stagger-3 hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <div className="rounded-lg bg-emerald-100 p-1.5">
              <TrendingDown className="h-4 w-4 text-emerald-600" strokeWidth={2} />
            </div>
          </div>
          <p className="mb-0.5 text-xl font-bold tabular-nums leading-tight text-slate-900">{projectStats.normal}</p>
          <p className="text-[11px] leading-snug text-slate-600">Dưới 80% ngân sách</p>
        </div>
        <div className="animate-fade-in-right rounded-lg border border-slate-200/50 bg-white p-3.5 shadow-md transition-shadow fade-in-right-stagger-4 hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <div className="rounded-lg bg-amber-100 p-1.5">
              <TrendingUp className="h-4 w-4 text-amber-600" strokeWidth={2} />
            </div>
          </div>
          <p className="mb-0.5 text-xl font-bold tabular-nums leading-tight text-slate-900">{projectStats.near}</p>
          <p className="text-[11px] leading-snug text-slate-600">80–100% tiến độ</p>
        </div>
        <div className="animate-fade-in-right rounded-lg border border-slate-200/50 bg-white p-3.5 shadow-md transition-shadow fade-in-right-stagger-5 hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <div className="rounded-lg bg-rose-100 p-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-600" strokeWidth={2} />
            </div>
          </div>
          <p className="mb-0.5 text-xl font-bold tabular-nums leading-tight text-slate-900">{projectStats.over}</p>
          <p className="text-[11px] leading-snug text-slate-600">Vượt ngân sách</p>
        </div>
      </div>

      <div className="animate-fade-in-right rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm fade-in-right-stagger-6 sm:p-5">
        <div className="flex items-start gap-3">
          <Eye className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" strokeWidth={2} />
          <div>
            <h3 className="mb-1 font-semibold text-blue-900">Chế độ xem chỉ đọc (View Only)</h3>
            <p className="text-sm leading-snug text-blue-800/90">
              Buyer chỉ xem ngân sách dự án để tham chiếu khi xử lý báo giá. Không có quyền quyết định hoặc can thiệp tài chính.
            </p>
          </div>
        </div>
      </div>

      <div className={`animate-fade-in-right fade-in-right-stagger-6 ${buyerPanelCardClass}`}>
        <div className="mb-4 flex min-w-0 items-start gap-2">
          <div className="rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 p-2">
            <BarChart3 className="h-4 w-4 text-indigo-600" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Bảng ngân sách dự án</h2>
            <p className="mt-0.5 text-sm leading-snug text-slate-600">
              So sánh ngân sách (SO), chi thực tế (Payment DONE), còn lại và thanh tiến độ — cùng công thức bố cục với Tổng quan PR Requestor.
            </p>
          </div>
        </div>

        <div className={buyerDataTableCardClass}>
          <div className={buyerDataTableCardHeaderClass}>
            <h3 className="text-base font-bold text-slate-900 sm:text-lg">Chi tiết theo dự án</h3>
          </div>
          <div className={buyerWorkspaceTableViewportClass}>
            <table className={`${buyerInteractiveTableClass} w-full min-w-[760px]`}>
              <thead className="sticky top-0 z-10 border-b-2 border-slate-200 bg-slate-50">
                <tr>
                  <th className="bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-4 sm:py-4 md:px-6">
                    Mã dự án
                  </th>
                  <th className="bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-4 sm:py-4 md:px-6">
                    Dự án
                  </th>
                  <th className="bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-4 sm:py-4 md:px-6">
                    Ngân sách
                  </th>
                  <th className="bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-4 sm:py-4 md:px-6">
                    Actual Cost (Payment DONE)
                  </th>
                  <th className="bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-4 sm:py-4 md:px-6">
                    Remaining Budget
                  </th>
                  <th className="bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 sm:px-4 sm:py-4 md:px-6">
                    Tiến độ
                  </th>
                </tr>
              </thead>
              <tbody className={buyerInteractiveTableBodyClass}>
                {projects.length > 0 ? (
                  projects.map((project: any, index: number) => {
                    const isOverBudget = project.actualCost > (project.salesPOAmount ?? project.budget ?? 0);
                    const isNearBudget = project.progress >= 80;

                    return (
                      <tr
                        key={project.id}
                        className={[
                          'group',
                          buyerTableDataRowVisual(index),
                          isOverBudget
                            ? '[&>td]:!bg-red-50/55'
                            : isNearBudget
                              ? '[&>td]:!bg-amber-50/50'
                              : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <td className="relative whitespace-nowrap px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6">
                          <div aria-hidden className={buyerTableAccentRailClass} />
                          <div className={`${buyerTableFirstCellInnerClass} ${buyerTableCellWrapClass}`}>
                            <span className="text-sm font-bold text-slate-900">
                              {project.salesPONumber ?? project.projectCode ?? '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6">
                          <div className={buyerTableCellWrapClass}>
                            <p className="text-sm font-medium text-slate-900">{project.projectName}</p>
                            <p className="text-xs text-slate-500">{project.projectCode}</p>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6">
                          <div className={buyerTableCellWrapClass}>
                            <span className="text-sm font-bold text-slate-900">
                              {formatPrice(project.salesPOAmount ?? project.budget ?? 0)}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6">
                          <div className={buyerTableCellWrapClass}>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-bold ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}
                              >
                                {formatPrice(project.actualCost)}
                              </span>
                              {isOverBudget ? (
                                <TrendingUp className="h-4 w-4 text-red-600" strokeWidth={2} />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-green-600" strokeWidth={2} />
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6">
                          <div className={buyerTableCellWrapClass}>
                            <span
                              className={`text-sm font-bold ${
                                project.remainingBudget < 0 ? 'text-red-600' : 'text-slate-900'
                              }`}
                            >
                              {formatPrice(project.remainingBudget)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6">
                          <div className={buyerTableCellWrapClass}>
                          <div className="flex min-w-[10rem] flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                            <div className="h-2 max-w-xs flex-1 rounded-full bg-slate-200 overflow-hidden shadow-inner">
                              <div
                                className={`relative h-2 rounded-full transition-all duration-700 ease-out ${
                                  isOverBudget 
                                    ? 'bg-gradient-to-r from-rose-500 via-red-500 to-pink-600' 
                                    : isNearBudget 
                                      ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500' 
                                      : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-green-600'
                                }`}
                                style={{ width: `${Math.min(project.progress, 100)}%` }}
                              >
                                {/* Liquid Flow Animation */}
                                {!isOverBudget && (
                                  <div
                                    className="absolute inset-0 animate-liquid-flow"
                                    style={{
                                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                                      backgroundSize: '200% 100%',
                                    }}
                                  />
                                )}
                                
                                {/* Micro Bubbles */}
                                {project.progress > 20 && !isOverBudget && (
                                  <>
                                    <div 
                                      className="absolute left-[15%] top-0.5 h-0.5 w-0.5 animate-pulse rounded-full bg-white/40" 
                                      style={{ animationDuration: '2.2s' }} 
                                    />
                                    <div 
                                      className="absolute left-[45%] top-0.5 h-0.5 w-0.5 animate-pulse rounded-full bg-white/30" 
                                      style={{ animationDuration: '2.8s' }} 
                                    />
                                    <div 
                                      className="absolute left-[75%] top-0.5 h-0.5 w-0.5 animate-pulse rounded-full bg-white/35" 
                                      style={{ animationDuration: '3.1s' }} 
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                            <span
                              className={`text-sm font-semibold ${
                                isOverBudget ? 'text-red-600' : isNearBudget ? 'text-amber-600' : 'text-green-600'
                              }`}
                            >
                              {project.progress}%
                            </span>
                          </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 sm:px-6">
                      Chưa có dữ liệu ngân sách dự án
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={`${buyerPanelCardClass}`}>
        <h3 className="mb-3 text-sm font-bold text-slate-900">Chú thích tiến độ</h3>
        <div className="flex flex-col gap-4 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-green-500" />
            <span className="text-slate-600">Dưới 80% ngân sách</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-amber-500" />
            <span className="text-slate-600">80–100% ngân sách</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-500" />
            <span className="text-slate-600">Vượt ngân sách</span>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes liquid-flow {
          from { transform: translateX(-200%); }
          to { transform: translateX(300%); }
        }
        .animate-liquid-flow {
          animation: liquid-flow 3s linear infinite;
        }
      `}</style>
      </div>
    </div>
  );
};

export default ProjectCostReference;

