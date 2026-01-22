import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, DollarSign, CheckCircle, FileText, TrendingUp, Factory, ShoppingBag } from 'lucide-react';
import { branchManagerService } from '../../services/branchManagerService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const DashboardHome = () => {
  const navigate = useNavigate();
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['branch-manager-dashboard'],
    queryFn: () => branchManagerService.getDashboard(),
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

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
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  const prsByTypeData = dashboardData?.prsByType ? [
    { name: 'Sản xuất', value: dashboardData.prsByType.PRODUCTION, color: '#3B82F6' },
    { name: 'Thương mại', value: dashboardData.prsByType.COMMERCIAL, color: '#10B981' },
  ] : [];

  return (
    <div className="flex flex-col">
      <div className="flex flex-col space-y-6">
        {/* Header Banner */}
        <div className="rounded-2xl shadow-lg p-6 text-white slide-right-title relative overflow-hidden bg-gradient-to-r from-slate-800 to-slate-900">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2">
              Dashboard Giám đốc Chi nhánh
            </h2>
            <p className="text-slate-300 text-sm">
              Nhìn vào là biết chi nhánh đang chi bao nhiêu – rủi ro ở đâu
            </p>
          </div>
        </div>

        {/* A. KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 slide-right-content">
          {/* PR chờ duyệt - Vàng */}
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-yellow-400 hover:shadow-lg transition-all slide-right-card-1">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Clock className="w-6 h-6 text-yellow-600" strokeWidth={2} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{dashboardData?.pendingPRs || 0}</p>
            <p className="text-sm text-slate-600 font-medium">PR chờ duyệt</p>
          </div>

          {/* PR vượt ngân sách - Đỏ nhạt (Dễ thấy nhất) */}
          <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl shadow-lg p-6 border-2 border-red-300 hover:shadow-xl transition-all slide-right-card-2 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-red-200 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-700" strokeWidth={2.5} />
              </div>
            </div>
            <p className="text-3xl font-bold text-red-700 mb-1">{dashboardData?.budgetExceptionsPending || 0}</p>
            <p className="text-sm text-red-600 font-semibold">PR vượt ngân sách</p>
            <p className="text-xs text-red-500 mt-1">Cần xử lý ngay</p>
          </div>

          {/* Tổng giá PR tháng - Xanh */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-blue-200 hover:shadow-lg hover:-translate-y-1 transition-all slide-right-card-3">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-blue-600" strokeWidth={2} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">
              {formatCurrency(dashboardData?.totalPRValueThisMonth || 0)}
            </p>
            <p className="text-sm text-slate-600">Tổng giá PR tháng</p>
          </div>

          {/* PR đã duyệt - Xám (Không nổi) */}
          <div className="bg-slate-100 rounded-xl shadow-sm p-6 border border-slate-200 slide-right-card-4">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-slate-200 rounded-xl">
                <CheckCircle className="w-6 h-6 text-slate-600" strokeWidth={2} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-700 mb-1">{dashboardData?.approvedPRsThisPeriod || 0}</p>
            <p className="text-sm text-slate-500">PR đã duyệt</p>
          </div>
        </div>

        {/* B. DANH SÁCH PR CHỜ DUYỆT & C. BIỂU ĐỒ TỔNG QUAN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
          {/* Danh sách PR chờ duyệt */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 flex flex-col overflow-hidden slide-right-content">
            <div className="flex-shrink-0 p-6 border-b border-slate-200 bg-[#F8FAFC]">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" strokeWidth={2} />
                PR chờ duyệt ({dashboardData?.recentPendingPRs?.length || 0})
              </h3>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
              {!dashboardData?.recentPendingPRs || dashboardData.recentPendingPRs.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-slate-400">Không có PR nào chờ duyệt</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Mã PR</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Người yêu cầu</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Tổng tiền</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Ngày gửi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dashboardData.recentPendingPRs.map((pr: any, index: number) => (
                      <tr
                        key={pr.id}
                        onClick={() => navigate(`/dashboard/branch-manager/pr-approval`, { state: { prId: pr.id } })}
                        className="bg-white hover:bg-[#F8FAFC] transition-colors-theme cursor-pointer slide-right-item"
                        style={{ animationDelay: `${0.2 + index * 0.03}s` }}
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-slate-900">{pr.prNumber}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-slate-900">{pr.requestor?.username || 'N/A'}</div>
                          <div className="text-xs text-slate-500">{pr.department}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(pr.totalAmount)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">{formatDate(pr.createdAt)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Biểu đồ tổng quan */}
          <div className="flex flex-col gap-6 min-h-0">
            {/* Tổng PR theo ngày/tháng */}
            <div className="bg-white rounded-xl border border-slate-200/50 flex flex-col overflow-hidden slide-right-content" style={{ boxShadow: 'none' }}>
              <div className="flex-shrink-0 p-4 border-b border-slate-200 bg-[#F8FAFC]">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  Tổng PR theo ngày (30 ngày gần nhất)
                </h3>
              </div>
              <div className="flex-1 min-h-0 p-4">
                {dashboardData?.prsByDate && dashboardData.prsByDate.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                    <BarChart data={dashboardData.prsByDate} style={{ boxShadow: 'none' }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#64748B' }}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          return `${date.getDate()}/${date.getMonth() + 1}`;
                        }}
                      />
                      <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px',
                          boxShadow: 'none',
                        }}
                        labelFormatter={(value) => {
                          const date = new Date(value);
                          return formatDate(date.toISOString());
                        }}
                      />
                      <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-slate-400">Chưa có dữ liệu</p>
                  </div>
                )}
              </div>
            </div>

            {/* Production vs Commercial */}
            <div className="bg-white rounded-xl border border-slate-200/50 flex flex-col overflow-hidden slide-right-content" style={{ boxShadow: 'none' }}>
              <div className="flex-shrink-0 p-4 border-b border-slate-200 bg-[#F8FAFC]">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  Production vs Commercial
                </h3>
              </div>
              <div className="flex-1 min-h-0 p-4 flex items-center justify-center">
                {prsByTypeData.length > 0 && prsByTypeData.some(item => item.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                    <PieChart style={{ boxShadow: 'none' }}>
                      <Pie
                        data={prsByTypeData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
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
                          borderRadius: '8px',
                          boxShadow: 'none',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Factory className="w-5 h-5 text-blue-600" strokeWidth={2} />
                        <span className="text-sm text-slate-700">Sản xuất: {dashboardData?.prsByType?.PRODUCTION || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-green-600" strokeWidth={2} />
                        <span className="text-sm text-slate-700">Thương mại: {dashboardData?.prsByType?.COMMERCIAL || 0}</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400">Chưa có PR nào trong tháng này</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
