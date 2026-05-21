import { useQuery } from '@tanstack/react-query';
import { TrendingUp, FileText, BarChart3 } from 'lucide-react';
import { branchManagerService } from '../../services/branchManagerService';
import { BranchOverviewChartCards } from './BranchOverviewChartCards';
import { BranchManagerPageHero } from '../../components/BranchManagerPageHero';
import {
  branchManagerPageContentClass,
  branchManagerPageRootClass,
} from '../../constants/branchManagerLayout';
import { dashboardV3IslandClass, DashboardV3ShimmerBlock } from '../../components/dashboard/DashboardV3Chrome';
import { SectionHeader } from '../../components/buyer-manager/SectionHeader';

/** Chiều cao vùng bảng (~10 hàng dữ liệu + thead) — phần dài cuộn trong khối */
const TOP_PR_TABLE_VIEWPORT_CLASS =
  'max-h-[min(35rem,calc(100dvh-14rem))] overflow-x-auto overflow-y-auto scrollbar-hide touch-pan-y rounded-xl border border-slate-100 bg-white shadow-[inset_0_1px_0_0_rgba(248,250,252,1)]';

const BranchOverview = () => {
  const { data: overviewData, isLoading, error } = useQuery({
    queryKey: ['branch-manager-overview'],
    queryFn: () => branchManagerService.getBranchOverview(),
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const formatCurrency = (amount: number | null, currency: string = 'VND') => {
    if (!amount) return 'N/A';
    if (amount >= 1000000000) {
      return `${(amount / 1000000000).toFixed(2)} tỷ ${currency}`;
    }
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)} triệu ${currency}`;
    }
    return `${amount.toLocaleString('vi-VN')} ${currency}`;
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
          <DashboardV3ShimmerBlock className="min-h-[22rem] w-full rounded-[28px]" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <DashboardV3ShimmerBlock className="min-h-[320px] rounded-[28px]" />
            <DashboardV3ShimmerBlock className="min-h-[320px] rounded-[28px]" />
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

  const departmentChartData = overviewData?.prsByDepartment ?? [];
  const typeChartData = overviewData?.prsByType ?? [];

  const topPRsCount = overviewData?.topPRsByValue?.length ?? 0;

  return (
    <div className={branchManagerPageRootClass}>
      <div className={branchManagerPageContentClass}>
        <div className="shrink-0 pb-2">
          <BranchManagerPageHero
            kicker="Giám đốc chi nhánh · Phân tích"
            title="Tổng quan Mua hàng Chi nhánh"
            description="Nhìn xu hướng – không thao tác"
            Icon={BarChart3}
            tint="graphite"
            regionLabel="Tổng quan chi nhánh"
          />
        </div>

        <article className={`${dashboardV3IslandClass} slide-right-content overflow-hidden`}>
          <SectionHeader
            Icon={TrendingUp}
            eyebrow="Giá trị"
            title="Top PR giá trị cao"
            description="Khung cố định ~10 dòng; danh sách dài cuộn trong bảng."
          />
          <div className="mt-4 min-h-0 md:mt-6">
            {overviewData?.topPRsByValue && topPRsCount > 0 ? (
              <div className={TOP_PR_TABLE_VIEWPORT_CLASS}>
                  <table className="w-full min-w-[640px] text-left">
                    <thead className="sticky top-0 z-10 border-b border-slate-200 bg-[#F8FAFC] shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                      <tr>
                        <th className="bg-[#F8FAFC] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700 sm:px-6 sm:py-3.5">
                          STT
                        </th>
                        <th className="bg-[#F8FAFC] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700 sm:px-6 sm:py-3.5">
                          Mã PR
                        </th>
                        <th className="bg-[#F8FAFC] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700 sm:px-6 sm:py-3.5">
                          Phòng ban
                        </th>
                        <th className="bg-[#F8FAFC] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700 sm:px-6 sm:py-3.5">
                          Người yêu cầu
                        </th>
                        <th className="bg-[#F8FAFC] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700 sm:px-6 sm:py-3.5">
                          Tổng giá
                        </th>
                        <th className="bg-[#F8FAFC] px-4 py-3 text-left text-xs font-semibold uppercase text-slate-700 sm:px-6 sm:py-3.5">
                          Ngày tạo
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {overviewData.topPRsByValue.map((pr: any, index: number) => (
                        <tr key={pr.id} className="bg-white transition-colors hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3 sm:px-6 sm:py-3.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-3.5">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-slate-400" strokeWidth={2} />
                              <span className="text-sm font-bold text-slate-900">{pr.prNumber}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-3.5">
                            <span className="text-sm text-slate-700">{pr.department}</span>
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-3.5">
                            <span className="text-sm text-slate-700">{pr.requestor}</span>
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-3.5">
                            <span className="text-sm font-bold text-green-700">
                              {formatCurrency(pr.totalAmount, pr.currency)}
                            </span>
                          </td>
                          <td className="px-4 py-3 sm:px-6 sm:py-3.5">
                            <span className="text-sm text-slate-600">{formatDate(pr.createdAt)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            ) : (
              <div className="flex flex-col items-center py-12 text-center">
                <TrendingUp className="mx-auto mb-4 h-12 w-12 text-slate-300" strokeWidth={1.5} />
                <p className="text-slate-500">Chưa có dữ liệu</p>
              </div>
            )}
          </div>
        </article>

        <BranchOverviewChartCards
          departmentChartData={departmentChartData}
          typeChartData={typeChartData}
        />
      </div>
    </div>
  );
};

export default BranchOverview;
