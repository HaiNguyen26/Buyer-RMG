import { useQuery } from '@tanstack/react-query';
import { Building2, ShoppingBag, TrendingUp, FileText } from 'lucide-react';
import { branchManagerService } from '../../services/branchManagerService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const BranchOverview = () => {
  const { data: overviewData, isLoading, error } = useQuery({
    queryKey: ['branch-manager-overview'],
    queryFn: () => branchManagerService.getBranchOverview(),
    staleTime: 60000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    onSuccess: (data) => {
      console.log('Branch Overview - Frontend received data:', {
        data,
        prsByDepartment: data?.prsByDepartment,
        prsByType: data?.prsByType,
        topPRsByValue: data?.topPRsByValue,
      });
    },
    onError: (err) => {
      console.error('Branch Overview - Frontend error:', err);
    },
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

  // Prepare chart data
  const departmentChartData = overviewData?.prsByDepartment || [];
  const typeChartData = overviewData?.prsByType || [];
  
  console.log('Branch Overview - Chart data preparation:', {
    overviewData,
    departmentChartData,
    typeChartData,
    departmentChartDataLength: departmentChartData.length,
    typeChartDataLength: typeChartData.length,
  });
  
  const typePieData = [
    { name: 'Sản xuất', value: typeChartData.find((t: any) => t.type === 'PRODUCTION')?.count || 0, color: '#3B82F6' },
    { name: 'Thương mại', value: typeChartData.find((t: any) => t.type === 'COMMERCIAL')?.count || 0, color: '#10B981' },
  ].filter(item => item.value > 0); // Only show types with data

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col space-y-6 p-6">
        {/* Header Banner */}
        <div className="rounded-xl shadow-lg p-6 text-white slide-right-title relative overflow-hidden bg-gradient-to-r from-slate-800 to-slate-900">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2">
              Tổng quan Mua hàng Chi nhánh
            </h2>
            <p className="text-slate-300 text-sm">
              Nhìn xu hướng – không thao tác
            </p>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Tổng PR theo phòng ban */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden slide-right-content" style={{ boxShadow: 'none' }}>
            <div className="flex-shrink-0 p-6 border-b border-slate-200 bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Tổng PR theo phòng ban</h3>
              </div>
            </div>
            <div className="p-6">
              {departmentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentChartData} style={{ boxShadow: 'none' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="department"
                      tick={{ fontSize: 12, fill: '#64748B' }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: 'none',
                      }}
                    />
                    <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-slate-400">Chưa có dữ liệu</p>
                </div>
              )}
            </div>
          </div>

          {/* 2. PR theo loại */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden slide-right-content" style={{ boxShadow: 'none' }}>
            <div className="flex-shrink-0 p-6 border-b border-slate-200 bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <ShoppingBag className="w-5 h-5 text-green-600" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">PR theo loại</h3>
              </div>
            </div>
            <div className="p-6">
              {typePieData.some(item => item.value > 0) ? (
                <div className="flex flex-col items-center justify-center">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart style={{ boxShadow: 'none' }}>
                      <Pie
                        data={typePieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {typePieData.map((entry, index) => (
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
                  <div className="flex items-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <span className="text-sm text-slate-700">Sản xuất: {typePieData[0].value}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-sm text-slate-700">Thương mại: {typePieData[1].value}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-slate-400">Chưa có dữ liệu</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Top PR giá trị cao */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden slide-right-content flex flex-col">
          <div className="flex-shrink-0 p-6 border-b border-slate-200 bg-[#F8FAFC]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-amber-600" strokeWidth={2} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Top PR giá trị cao</h3>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
            {overviewData?.topPRsByValue && overviewData.topPRsByValue.length > 0 ? (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase bg-slate-50">STT</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase bg-slate-50">Mã PR</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase bg-slate-50">Phòng ban</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase bg-slate-50">Người yêu cầu</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase bg-slate-50">Tổng giá</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase bg-slate-50">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overviewData.topPRsByValue.map((pr: any, index: number) => (
                    <tr key={pr.id} className="bg-white hover:bg-[#F8FAFC] transition-colors-theme">
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold text-sm">
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" strokeWidth={2} />
                          <span className="text-sm font-bold text-slate-900">{pr.prNumber}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700">{pr.department}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700">{pr.requestor}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-green-700">
                          {formatCurrency(pr.totalAmount, pr.currency)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">{formatDate(pr.createdAt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center">
                <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
                <p className="text-slate-500">Chưa có dữ liệu</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchOverview;
