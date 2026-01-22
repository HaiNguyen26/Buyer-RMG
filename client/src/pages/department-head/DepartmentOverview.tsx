import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getDepartmentOverview } from '../../services/departmentHeadService';
import { Building2, Users, FileText, TrendingUp } from 'lucide-react';

const DepartmentOverview = () => {
  const { data: overviewData, isLoading, error } = useQuery({
    queryKey: ['department-overview'],
    queryFn: getDepartmentOverview,
    staleTime: 60000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-w-md">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const prsByEmployeeData = (overviewData?.prsByEmployee || []).map((item: any, index: number) => ({
    name: item.username,
    value: item.count,
    amount: item.totalAmount,
    color: `hsl(${(index * 137.5) % 360}, 70%, 50%)`, // Generate distinct colors
  }));

  const prsByTypeData = (overviewData?.prsByType || []).map((item: any, index: number) => ({
    name: item.type,
    value: item.count,
    amount: item.totalAmount,
    color: item.type === 'Thương mại' ? '#3b82f6' : '#10b981',
  }));

  const prsByStatusData = (overviewData?.prsByStatus || []).map((item: any, index: number) => ({
    name: item.status,
    value: item.count,
    amount: item.totalAmount,
    color: `hsl(${(index * 60) % 360}, 70%, 50%)`,
  }));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F8FAFC]">
      <div className="flex-1 min-h-0 p-6 overflow-y-auto scrollbar-hide space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-lg p-6 text-white slide-right-title relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2">
              Tổng quan PR phòng ban
            </h2>
            <p className="text-white/90 text-sm font-normal">
              Quản lý xu hướng mua hàng của phòng ban - Chỉ xem, không thao tác
            </p>
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20">
            <Building2 className="w-32 h-32 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200/50 slide-right-card-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <FileText className="w-6 h-6 text-indigo-600" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Tổng số PR</h3>
              <p className="text-sm text-slate-500">Tất cả PR trong phòng ban</p>
            </div>
          </div>
          <p className="text-4xl font-bold text-indigo-600">{overviewData?.totalPRs || 0}</p>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PR theo nhân viên */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200/50 slide-right-card-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Users className="w-5 h-5 text-blue-600" strokeWidth={2} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">PR theo nhân viên</h3>
            </div>
            {prsByEmployeeData.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={prsByEmployeeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {prsByEmployeeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
                  {prsByEmployeeData.map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }}></div>
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900">{item.value} PR</span>
                        <div className="text-xs text-slate-500">{formatCurrency(item.amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" strokeWidth={1.5} />
                <p>Chưa có dữ liệu</p>
              </div>
            )}
          </div>

          {/* PR theo loại */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200/50 slide-right-card-3">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-100 rounded-xl">
                <TrendingUp className="w-5 h-5 text-purple-600" strokeWidth={2} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">PR theo loại</h3>
            </div>
            {prsByTypeData.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={prsByTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {prsByTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {prsByTypeData.map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }}></div>
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900">{item.value} PR</span>
                        <div className="text-xs text-slate-500">{formatCurrency(item.amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 text-slate-300" strokeWidth={1.5} />
                <p>Chưa có dữ liệu</p>
              </div>
            )}
          </div>
        </div>

        {/* PR theo trạng thái - Full Width */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200/50 slide-right-content">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-amber-100 rounded-xl">
              <FileText className="w-5 h-5 text-amber-600" strokeWidth={2} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">PR theo trạng thái</h3>
          </div>
          {prsByStatusData.length > 0 ? (
            <div className="space-y-6">
              {/* Bar Chart */}
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={prsByStatusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6">
                    {prsByStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b-2 border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Trạng thái</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Số lượng PR</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Tổng giá trị</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {prsByStatusData.map((item: any, index: number) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors slide-right-item" style={{ animationDelay: `${0.1 + index * 0.03}s` }}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: item.color }}></div>
                            <span className="text-sm font-medium text-slate-900">{item.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold text-slate-900">{item.value}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{formatCurrency(item.amount)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" strokeWidth={1.5} />
              <p>Chưa có dữ liệu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepartmentOverview;

