import { useQuery } from '@tanstack/react-query';
import { PieChart, TrendingUp, DollarSign } from 'lucide-react';
import { bgdService } from '../../services/bgdService';
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const BusinessOverview = () => {
  const { data: overviewData, isLoading } = useQuery({
    queryKey: ['bgd-business-overview'],
    queryFn: bgdService.getBusinessOverview,
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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Business Overview</h1>
        <p className="text-slate-600">Nhìn tổng quan chi phí & nhu cầu</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-sm text-slate-600">Tổng chi phí</div>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {((overviewData?.totalCost || 0) / 1000000).toFixed(1)}M VNĐ
          </div>
          <div className="text-sm text-slate-600 mt-1">
            {overviewData?.totalCost?.toLocaleString() || 0} VNĐ
          </div>
        </div>

        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-sm text-slate-600">Tỷ lệ PR → mua</div>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {overviewData?.prToPurchaseRatio || 0}%
          </div>
          <div className="text-sm text-green-600 mt-1">Tăng 5% so với quý trước</div>
        </div>

        <div className="glass rounded-soft p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <PieChart className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-sm text-slate-600">Số dự án active</div>
          </div>
          <div className="text-3xl font-bold text-slate-800">
            {overviewData?.activeProjects || 0}
          </div>
          <div className="text-sm text-slate-600 mt-1">Dự án đang triển khai</div>
        </div>
      </div>

      {/* Cost Distribution by Project */}
      <div className="glass rounded-soft p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Phân bổ chi phí theo dự án</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Legend />
                {overviewData?.costDistribution?.map((item: any, idx: number) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {overviewData?.costDistribution?.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  ></div>
                  <div>
                    <div className="font-medium text-slate-800">{item.projectName}</div>
                    <div className="text-sm text-slate-600">{item.salesPOCode}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-800">
                    {(item.amount / 1000000).toFixed(1)}M VNĐ
                  </div>
                  <div className="text-sm text-slate-600">{item.percentage}%</div>
                </div>
              </div>
            )) || (
              <div className="text-center text-slate-500 py-8">Không có dữ liệu</div>
            )}
          </div>
        </div>
      </div>

      {/* Purchase Demand Trend */}
      <div className="glass rounded-soft p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Xu hướng nhu cầu mua</h3>
        <div className="space-y-4">
          {overviewData?.demandTrends?.map((trend: any, idx: number) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-slate-800">{trend.period}</div>
                <div className="text-sm text-slate-600">{trend.prCount} PRs</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                    style={{ width: `${(trend.prCount / (overviewData?.maxPRCount || 1)) * 100}%` }}
                  ></div>
                </div>
                <div className="text-sm font-medium text-slate-700 w-24 text-right">
                  {trend.totalValue.toLocaleString()} VNĐ
                </div>
              </div>
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Không có dữ liệu</div>
          )}
        </div>
      </div>

      {/* PR to Purchase Ratio */}
      <div className="glass rounded-soft p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Tỷ lệ PR → mua</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {overviewData?.prToPurchaseRatio || 0}%
            </div>
            <div className="text-sm text-slate-600">Tỷ lệ chuyển đổi</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <div className="text-3xl font-bold text-green-600 mb-1">
              {overviewData?.prStats?.totalPRs || 0}
            </div>
            <div className="text-sm text-slate-600">Tổng số PR</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg text-center">
            <div className="text-3xl font-bold text-purple-600 mb-1">
              {overviewData?.prStats?.completedPRs || 0}
            </div>
            <div className="text-sm text-slate-600">PR đã mua</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessOverview;

