import { useQuery } from '@tanstack/react-query';
import { BarChart3, Eye, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { buyerService } from '../../services/buyerService';

const ProjectCostReference = () => {
  const { data: costsData, isLoading, error } = useQuery({
    queryKey: ['buyer-project-costs'],
    queryFn: () => buyerService.getProjectCostReference(),
    staleTime: 60000, // 1 minute - View Only, less frequent updates
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-96 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="bg-red-50 border border-red-200 rounded-soft p-4">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Header - View Only Notice */}
      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-soft p-4">
        <div className="flex items-start gap-3">
          <Eye className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Chế độ xem chỉ đọc (View Only)</h3>
            <p className="text-sm text-blue-700">
              Buyer chỉ xem ngân sách dự án để tham chiếu khi xử lý báo giá. Không có quyền quyết định hoặc can thiệp tài chính.
            </p>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="bg-white rounded-soft shadow-soft border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" strokeWidth={2} />
            <h2 className="text-xl font-bold text-slate-900">Tham chiếu ngân sách dự án</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Sales PO
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Dự án
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Sales PO Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actual Cost (Payment DONE)
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Remaining Budget
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Tiến độ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {costsData?.projects && costsData.projects.length > 0 ? (
                costsData.projects.map((project: any, index: number) => {
                const isOverBudget = project.actualCost > project.salesPOAmount;
                const isNearBudget = project.progress >= 80;
                
                return (
                  <tr
                    key={project.id}
                    className={`transition-colors duration-150 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    } hover:bg-blue-50/50 ${
                      isOverBudget ? 'bg-red-50/50' : isNearBudget ? 'bg-amber-50/50' : ''
                    }`}
                  >
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className="text-sm font-bold text-slate-900">{project.salesPONumber}</span>
                    </td>
                    <td className="px-6 py-6">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{project.projectName}</p>
                        <p className="text-xs text-slate-500">{project.projectCode}</p>
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className="text-sm font-bold text-slate-900">{formatPrice(project.salesPOAmount)}</span>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${
                          isOverBudget ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatPrice(project.actualCost)}
                        </span>
                        {isOverBudget ? (
                          <TrendingUp className="w-4 h-4 text-red-600" strokeWidth={2} />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-green-600" strokeWidth={2} />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <span className={`text-sm font-bold ${
                        project.remainingBudget < 0 ? 'text-red-600' : 'text-slate-900'
                      }`}>
                        {formatPrice(project.remainingBudget)}
                      </span>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-slate-200 rounded-full h-2 max-w-xs">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              isOverBudget
                                ? 'bg-red-500'
                                : isNearBudget
                                ? 'bg-amber-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(project.progress, 100)}%` }}
                          ></div>
                        </div>
                        <span className={`text-sm font-semibold ${
                          isOverBudget
                            ? 'text-red-600'
                            : isNearBudget
                            ? 'text-amber-600'
                            : 'text-green-600'
                        }`}>
                          {project.progress}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Chưa có dữ liệu ngân sách dự án
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-soft shadow-soft border border-slate-200 p-4">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-slate-600">Dưới 80% ngân sách</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-500 rounded"></div>
            <span className="text-slate-600">80-100% ngân sách</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-slate-600">Vượt ngân sách</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectCostReference;

