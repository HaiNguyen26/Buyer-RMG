import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, DollarSign, TrendingUp, CheckCircle } from 'lucide-react';
import { bgdService } from '../../services/bgdService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ExecutiveReports = () => {
  const { data: reportsData, isLoading } = useQuery({
    queryKey: ['bgd-executive-reports'],
    queryFn: bgdService.getExecutiveReports,
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="h-64 bg-slate-200 rounded-soft"></div>
        </div>
      </div>
    );
  }

  const handleExport = (reportType: string) => {
    console.log('Exporting report:', reportType);
    // TODO: Implement export functionality
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Executive Reports</h1>
          <p className="text-slate-600">Báo cáo cho lãnh đạo</p>
        </div>
        <button
          onClick={() => handleExport('all')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Xuất tất cả</span>
        </button>
      </div>

      {/* Key Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-sm text-slate-600">Saving từ mua hàng</div>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {reportsData?.totalSaving || 0}%
          </div>
          <div className="text-sm text-green-600 mt-1">
            ≈ {reportsData?.savingAmount?.toLocaleString() || 0} VNĐ
          </div>
        </div>

        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-sm text-slate-600">Hiệu suất phòng mua</div>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {reportsData?.procurementEfficiency || 0}%
          </div>
          <div className="text-sm text-blue-600 mt-1">Tăng 8% so với quý trước</div>
        </div>

        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-sm text-slate-600">Tỷ lệ hoàn thành</div>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {reportsData?.completionRate || 0}%
          </div>
          <div className="text-sm text-slate-600 mt-1">PR đã mua / Tổng PR</div>
        </div>
      </div>

      {/* Saving Report */}
      <div className="glass rounded-soft p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Saving từ hoạt động mua</h3>
          <button
            onClick={() => handleExport('saving')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Xuất PDF</span>
          </button>
        </div>
        <div className="space-y-3">
          {reportsData?.savingDetails?.map((item: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <div className="font-medium text-slate-800">{item.category}</div>
                <div className="text-sm text-slate-600">{item.description}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">
                  {item.savedAmount.toLocaleString()} VNĐ
                </div>
                <div className="text-sm text-slate-600">{item.percentage}% tiết kiệm</div>
              </div>
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Không có dữ liệu</div>
          )}
        </div>
      </div>

      {/* Procurement Performance */}
      <div className="glass rounded-soft p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Hiệu suất phòng mua</h3>
          <button
            onClick={() => handleExport('performance')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Xuất PDF</span>
          </button>
        </div>
        <div className="space-y-4">
          {reportsData?.procurementPerformance?.map((metric: any, idx: number) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-slate-800">{metric.name}</div>
                <div className="text-lg font-bold text-slate-800">{metric.value}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      metric.percentage >= 80
                        ? 'bg-green-500'
                        : metric.percentage >= 60
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${metric.percentage}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-slate-700 w-16 text-right">
                  {metric.percentage}%
                </span>
              </div>
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Không có dữ liệu</div>
          )}
        </div>
      </div>

      {/* Plan vs Actual Comparison */}
      <div className="glass rounded-soft p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">So sánh kế hoạch vs thực tế</h3>
          <button
            onClick={() => handleExport('plan-vs-actual')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Xuất PDF</span>
          </button>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={reportsData?.planVsActual || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="period" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
            />
            <Legend />
            <Bar dataKey="planned" fill="#3b82f6" name="Kế hoạch" />
            <Bar dataKey="actual" fill="#10b981" name="Thực tế" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Report */}
      <div className="glass rounded-soft p-6 border-l-4 border-purple-500">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Tóm tắt báo cáo</h3>
        <div className="space-y-3">
          {reportsData?.summary?.map((item: any, idx: number) => (
            <div key={idx} className="p-4 bg-purple-50 rounded-lg">
              <div className="font-semibold text-slate-800 mb-1">{item.title}</div>
              <div className="text-sm text-slate-600">{item.content}</div>
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Không có tóm tắt</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutiveReports;


