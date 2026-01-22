import { useQuery } from '@tanstack/react-query';
import { DollarSign, Clock, AlertTriangle, ShoppingCart, FileText, TrendingUp, TrendingDown, Users, UserCheck, UserX, Package, Shield } from 'lucide-react';
import { buyerManagerService } from '../../services/buyerManagerService';

const BuyerManagerDashboardHome = () => {
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['buyer-manager-dashboard'],
    queryFn: () => buyerManagerService.getDashboard(),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="h-full overflow-hidden flex flex-col">
        <div className="flex-1 p-6">
          <div className="animate-pulse space-y-6 h-full">
            <div className="h-24 bg-slate-200 rounded-2xl"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 bg-slate-200 rounded-2xl"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-64 bg-slate-200 rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-hidden flex flex-col p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  const metrics = dashboardData?.metrics || {
    totalPRValue: 0,
    avgLeadTime: 0,
    overBudgetRate: 0,
    totalPRsInProgress: 0,
  };

  // Calculate additional metrics from dashboard data
  const prsInProgress = metrics.totalPRsInProgress || 0;
  const riskyPOs = 0; // TODO: Calculate from actual data
  const strategicSuppliers = 0; // TODO: Calculate from supplier performance
  const problematicSuppliers = 0; // TODO: Calculate from supplier performance
  
  // Calculate buyer workload from buyerPerformance
  const buyerPerformance = dashboardData?.buyerPerformance || [];
  const overloadedBuyers = buyerPerformance.filter((b: any) => b.prsHandled > 15).length;
  const idleBuyers = buyerPerformance.filter((b: any) => b.prsHandled <= 3).length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 p-6 flex flex-col gap-6">
        {/* Header Banner */}
        <div className="flex-shrink-0 rounded-2xl shadow-lg p-6 text-white slide-right-title relative overflow-hidden" style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)'
        }}>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2">
              Buyer Manager Dashboard
            </h2>
            <p className="text-white/90 text-sm font-normal">
              Chịu trách nhiệm phòng mua hàng & PO - Dashboard để tham mưu BGĐ
            </p>
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20">
            <Shield className="w-32 h-32 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Main Content Grid - 2 rows x 2 columns */}
        <div className="flex-1 min-h-0 flex flex-col gap-6">
          {/* Row 1: Procurement KPI + PR & PO Oversight */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Procurement KPI */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 slide-right-card-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Procurement KPI</h3>
              </div>
              <div className="space-y-4">
                {/* Total PR Value */}
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600" strokeWidth={2} />
                      <span className="text-sm font-semibold text-slate-700">Total PR Value</span>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-emerald-700 truncate" title={formatCurrency(metrics.totalPRValue)}>
                    {formatCurrency(metrics.totalPRValue)}
                  </p>
                </div>

                {/* Avg Lead Time */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" strokeWidth={2} />
                      <span className="text-sm font-semibold text-slate-700">Avg Lead Time</span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold text-blue-700">{metrics.avgLeadTime}</p>
                    <span className="text-sm text-slate-600">ngày</span>
                  </div>
                </div>

                {/* Over-Budget Rate */}
                <div className="p-4 bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600" strokeWidth={2} />
                      <span className="text-sm font-semibold text-slate-700">Over-Budget Rate</span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold text-rose-700">{metrics.overBudgetRate}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* PR & PO Oversight */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 slide-right-card-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-indigo-600" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">PR & PO Oversight</h3>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-indigo-600" strokeWidth={2} />
                      <span className="text-sm font-semibold text-slate-700">PR đang mua</span>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-indigo-700">{prsInProgress}</p>
                </div>

                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" strokeWidth={2} />
                      <span className="text-sm font-semibold text-slate-700">PO rủi ro</span>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-amber-700">{riskyPOs}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Supplier Performance Snapshot + Buyer Workload */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Supplier Performance Snapshot */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 slide-right-card-3">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <UserCheck className="w-5 h-5 text-purple-600" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Supplier Performance Snapshot</h3>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-green-600" strokeWidth={2} />
                      <span className="text-sm font-semibold text-slate-700">NCC chiến lược</span>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-green-700">{strategicSuppliers}</p>
                </div>

                <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" strokeWidth={2} />
                      <span className="text-sm font-semibold text-slate-700">NCC có vấn đề</span>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-red-700">{problematicSuppliers}</p>
                </div>
              </div>
            </div>

            {/* Buyer Workload */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 slide-right-card-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Users className="w-5 h-5 text-slate-600" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Buyer Workload</h3>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <UserX className="w-4 h-4 text-red-600" strokeWidth={2} />
                      <span className="text-sm font-semibold text-slate-700">Buyer quá tải</span>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-red-700">{overloadedBuyers}</p>
                  <p className="text-xs text-slate-500 mt-1">Cần điều phối lại</p>
                </div>

                <div className="p-4 bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-slate-600" strokeWidth={2} />
                      <span className="text-sm font-semibold text-slate-700">Buyer nhàn rỗi</span>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-slate-700">{idleBuyers}</p>
                  <p className="text-xs text-slate-500 mt-1">Có thể phân công thêm</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyerManagerDashboardHome;
