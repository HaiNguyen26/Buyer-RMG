import { useQuery } from '@tanstack/react-query';
import { salesService } from '../../services/salesService';
import { AlertTriangle, TrendingUp, DollarSign, Wallet, FileText } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DashboardHome = () => {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['sales-dashboard'],
    queryFn: () => salesService.getDashboard(),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const getWarningColor = (usagePercent: number) => {
    if (usagePercent >= 100) {
      return {
        border: 'border-red-500',
        bg: 'bg-red-50',
        icon: 'text-red-600',
        text: 'text-red-800',
      };
    } else if (usagePercent >= 90) {
      return {
        border: 'border-red-400',
        bg: 'bg-red-50',
        icon: 'text-red-600',
        text: 'text-red-800',
      };
    } else {
      return {
        border: 'border-amber-500',
        bg: 'bg-amber-50',
        icon: 'text-amber-600',
        text: 'text-amber-800',
      };
    }
  };

  return (
    <div className="p-6 space-y-6 relative" style={{ backgroundColor: 'transparent' }}>
      {/* Header */}
      <div className="slide-right-title">
        <h1 className="text-3xl font-bold text-slate-900">Sales Dashboard</h1>
        <p className="text-slate-600 mt-1 font-normal">Tổng quan nhanh về Sales PO và ngân sách</p>
      </div>

      {/* 4 Chỉ số vàng */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active PO */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-200/50 card-hover slide-right-card-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Active PO</p>
              <p className="number-large mt-2">
                {dashboardData?.activeSalesPOs || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" strokeWidth={2} />
            </div>
          </div>
        </div>

        {/* Total Budget */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-200/50 card-hover slide-right-card-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Total Budget</p>
              <p className="number-xl mt-2">
                {dashboardData?.totalSalesPOAmount
                  ? formatCurrency(dashboardData.totalSalesPOAmount)
                  : '0 ₫'}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" strokeWidth={2} />
            </div>
          </div>
        </div>

        {/* Actual Cost (Payment DONE) */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-200/50 card-hover slide-right-card-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Actual Cost</p>
              <p className="number-xl mt-2">
                {dashboardData?.actualCost
                  ? formatCurrency(dashboardData.actualCost)
                  : '0 ₫'}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-normal">(Payment = DONE)</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-amber-600" strokeWidth={2} />
            </div>
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-200/50 card-hover slide-right-card-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 font-medium">Remaining Budget</p>
              <p className="number-xl mt-2">
                {dashboardData?.remainingBudget
                  ? formatCurrency(dashboardData.remainingBudget)
                  : '0 ₫'}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-emerald-600" strokeWidth={2} />
            </div>
          </div>
        </div>
      </div>

      {/* Cảnh báo thông minh (>= 80%) */}
      {dashboardData?.warnings && dashboardData.warnings.length > 0 && (
        <div className="space-y-3 slide-right-content">
          <h2 className="text-xl font-bold text-slate-900">Cảnh báo thông minh</h2>
          {dashboardData.warnings.map((warning: any, idx: number) => {
            const usagePercent = parseFloat(warning.usagePercent || '0');
            const colors = getWarningColor(usagePercent);
            return (
              <div
                key={idx}
                className={`bg-white rounded-xl shadow-md p-4 border-l-4 card-hover ${colors.border} ${colors.bg} slide-right-item`}
                style={{ animationDelay: `${0.7 + idx * 0.03}s` }}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${colors.icon}`} strokeWidth={2} />
                  <div className="flex-1">
                    <p className={`font-semibold ${colors.text}`}>
                      {usagePercent >= 100
                        ? '⚠️ PO đã vượt ngân sách'
                        : usagePercent >= 90
                        ? '🔴 PO sắp vượt ngân sách (≥90%)'
                        : '🟠 PO đang chi tiêu cao (≥80%)'}
                    </p>
                    <p className="text-sm text-slate-700 mt-1 font-normal">
                      <span className="font-medium">{warning.salesPONumber}</span>
                      {warning.projectName && ` - ${warning.projectName}`}
                    </p>
                    <div className="mt-2 text-sm text-slate-700 font-normal">
                      <p>
                        Ngân sách: {formatCurrency(warning.amount)} | Đã chi:{' '}
                        {formatCurrency(warning.actualCost)} | Còn lại:{' '}
                        {formatCurrency(warning.remaining)}
                      </p>
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-600">Tỉ lệ chi tiêu</span>
                          <span className={`text-xs font-bold ${colors.text}`}>
                            {usagePercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              usagePercent >= 100
                                ? 'bg-red-500'
                                : usagePercent >= 90
                                ? 'bg-red-400'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Biểu đồ xu hướng */}
      {dashboardData?.trendData && dashboardData.trendData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 slide-right-content relative z-10">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Biểu đồ xu hướng</h2>
          <p className="text-sm text-slate-600 mb-4 font-normal">
            So sánh ngân sách và chi phí thực tế qua các tháng
          </p>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={dashboardData.trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                stroke="#64748b"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#64748b' }}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: '12px' }}
                tick={{ fill: '#64748b' }}
                tickFormatter={(value) => {
                  if (value >= 1000000) {
                    return `${(value / 1000000).toFixed(1)}M`;
                  } else if (value >= 1000) {
                    return `${(value / 1000).toFixed(0)}K`;
                  }
                  return value.toString();
                }}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="budget"
                name="Ngân sách"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ fill: '#3B82F6', r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="actualCost"
                name="Chi phí thực tế"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ fill: '#F59E0B', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Active Sales POs List */}
      {dashboardData?.salesPOs && dashboardData.salesPOs.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 slide-right-content relative z-10 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Danh sách Sales PO đang Active</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Số Sales PO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Khách hàng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Dự án
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Giá trị PO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Ngày hiệu lực
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dashboardData.salesPOs.map((po: any) => (
                  <tr key={po.id} className="table-row-hover">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {po.salesPONumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-normal">
                      {po.customer}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-normal">
                      {po.projectName || po.projectCode || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                      {formatCurrency(po.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-normal">
                      {new Date(po.effectiveDate).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-xl ${
                          po.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {po.status === 'ACTIVE' ? 'Active' : 'Closed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHome;
