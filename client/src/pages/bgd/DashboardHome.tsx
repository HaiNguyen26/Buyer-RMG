import { useQuery } from '@tanstack/react-query';
import { 
  DollarSign, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { bgdService } from '../../services/bgdService';

const DashboardHome = () => {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['bgd-dashboard'],
    queryFn: bgdService.getExecutiveDashboard,
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-slate-200 rounded-soft"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const metrics = dashboardData?.metrics || {
    totalSalesPOBudget: 0,
    totalApprovedPRValue: 0,
    projectsAtRisk: 0,
    criticalPRsPending: 0,
  };

  const cards = [
    {
      title: 'Tổng ngân sách Sales PO',
      value: `${(metrics.totalSalesPOBudget / 1000000).toFixed(1)}M`,
      fullValue: `${metrics.totalSalesPOBudget.toLocaleString()} VNĐ`,
      icon: DollarSign,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: 'Tổng giá trị PR đã duyệt',
      value: `${(metrics.totalApprovedPRValue / 1000000).toFixed(1)}M`,
      fullValue: `${metrics.totalApprovedPRValue.toLocaleString()} VNĐ`,
      icon: CheckCircle,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      title: 'Dự án có nguy cơ vượt ngân sách',
      value: metrics.projectsAtRisk,
      icon: AlertTriangle,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
    },
    {
      title: 'PR đang chờ quyết định quan trọng',
      value: metrics.criticalPRsPending,
      icon: Clock,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
  ];

  return (
    <div className="p-8 space-y-8 relative" style={{ backgroundColor: 'transparent' }}>
      {/* Header */}
      <div className="slide-right-title">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Executive Dashboard</h1>
        <p className="text-slate-600">Cái nhìn tổng thể cấp cao</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`bg-white rounded-2xl shadow-md border border-slate-200/50 p-6 hover-lift card-hover ${
                idx === 0 ? 'slide-right-card-1' :
                idx === 1 ? 'slide-right-card-2' :
                idx === 2 ? 'slide-right-card-3' :
                'slide-right-card-4'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl ${card.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${card.textColor}`} />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800 mb-1">{card.value}</div>
                <div className="text-sm text-slate-600 mb-1">{card.title}</div>
                {card.fullValue && (
                  <div className="text-xs text-slate-500">{card.fullValue}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Projects at Risk */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 slide-right-content relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3 className="text-lg font-semibold text-slate-800">Dự án có nguy cơ vượt ngân sách</h3>
        </div>
        <div className="space-y-4">
          {dashboardData?.projectsAtRiskList?.map((project: any, idx: number) => (
            <div key={idx} className="p-4 bg-amber-50 rounded-xl border border-amber-200/50 slide-right-item" style={{ animationDelay: `${0.7 + idx * 0.03}s` }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold text-slate-800">{project.name}</div>
                  <div className="text-sm text-slate-600">{project.salesPOCode}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-amber-600">{project.usagePercent}%</div>
                  <div className="text-xs text-slate-600">Đã sử dụng</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-slate-600">Ngân sách: </span>
                  <span className="font-medium text-slate-800">
                    {project.budget.toLocaleString()} VNĐ
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Thực tế: </span>
                  <span className="font-medium text-red-600">
                    {project.actualCost.toLocaleString()} VNĐ
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Còn lại: </span>
                  <span className="font-medium text-green-600">
                    {project.remaining.toLocaleString()} VNĐ
                  </span>
                </div>
              </div>
              <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    project.usagePercent >= 100
                      ? 'bg-red-500'
                      : project.usagePercent >= 90
                      ? 'bg-amber-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(project.usagePercent, 100)}%` }}
                ></div>
              </div>
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Không có dự án có nguy cơ</div>
          )}
        </div>
      </div>

      {/* Critical PRs Pending */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 slide-right-content relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-slate-800">PR đang chờ quyết định quan trọng</h3>
        </div>
        <div className="space-y-3">
          {dashboardData?.criticalPRsList?.map((pr: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-purple-50 rounded-xl border border-purple-200/50 slide-right-item" style={{ animationDelay: `${0.7 + idx * 0.03}s` }}>
              <div className="flex-1">
                <div className="font-semibold text-slate-800 mb-1">{pr.code}</div>
                <div className="text-sm text-slate-600 mb-2">{pr.description}</div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>Dự án: {pr.projectName}</span>
                  <span>Giá trị: {pr.value.toLocaleString()} VNĐ</span>
                  <span>Lý do: {pr.reason}</span>
                </div>
              </div>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors ml-4 shadow-sm">
                Xem chi tiết
              </button>
            </div>
          )) || (
            <div className="text-center text-slate-500 py-8">Không có PR chờ quyết định</div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 slide-right-content relative z-10">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Tỷ lệ sử dụng ngân sách</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Đã sử dụng</span>
              <span className="font-semibold text-slate-800">
                {dashboardData?.budgetUsage?.usedPercent || 0}%
              </span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                style={{ width: `${dashboardData?.budgetUsage?.usedPercent || 0}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>
                {dashboardData?.budgetUsage?.used?.toLocaleString() || 0} /{' '}
                {dashboardData?.budgetUsage?.total?.toLocaleString() || 0} VNĐ
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 slide-right-content relative z-10">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Xu hướng chi phí</h3>
          <div className="space-y-3">
            {dashboardData?.costTrends?.map((trend: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-medium text-slate-800">{trend.period}</div>
                  <div className="text-sm text-slate-600">{trend.description}</div>
                </div>
                <div className={`flex items-center gap-1 font-semibold ${
                  trend.change > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {trend.change > 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span>{Math.abs(trend.change)}%</span>
                </div>
              </div>
            )) || (
              <div className="text-center text-slate-500 py-4">Không có dữ liệu</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;


