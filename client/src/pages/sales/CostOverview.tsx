import { useQuery } from '@tanstack/react-query';
import { salesService } from '../../services/salesService';
import { BarChart3, TrendingUp } from 'lucide-react';

const CostOverview = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['cost-overview'],
    queryFn: () => salesService.getCostOverview(),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="h-96 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Cost Overview</h1>
        <p className="text-slate-600 mt-1">Theo dõi chi phí ở mức tổng hợp & so sánh</p>
      </div>

      {/* Charts Placeholder */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-6 h-6 text-[#3B82F6]" />
          <h2 className="text-xl font-semibold text-slate-800">Sales PO vs Actual Cost</h2>
        </div>
        <div className="h-64 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 rounded-lg">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Biểu đồ sẽ được tích hợp với thư viện chart (Chart.js / Recharts)</p>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      {data?.overview && data.overview.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-800">So sánh nhiều dự án</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Sales PO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Dự án
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Khách hàng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Sales PO Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Actual Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Remaining Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Usage %
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.overview.map((item) => {
                  const usagePercent = (item.actualCost / item.salesPOAmount) * 100;
                  return (
                    <tr key={item.salesPOId} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {item.salesPONumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {item.projectName || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {item.customerName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {formatCurrency(item.salesPOAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-amber-600">
                        {formatCurrency(item.actualCost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600">
                        {formatCurrency(item.remainingBudget)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2 max-w-[100px]">
                            <div
                              className={`h-2 rounded-full ${
                                usagePercent >= 100
                                  ? 'bg-red-500'
                                  : usagePercent >= 90
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-slate-600">{usagePercent.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostOverview;




