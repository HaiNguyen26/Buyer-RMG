import { useQuery } from '@tanstack/react-query';
import { salesService } from '../../services/salesService';
import { FileText, DollarSign, TrendingUp, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardPageContentBottomClass } from '../../constants/dashboardLayout';

const SalesDashboardHome = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['sales-dashboard'],
    queryFn: () => salesService.getDashboard(),
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-28 bg-slate-100 rounded-xl" />
          <div className="h-28 bg-slate-100 rounded-xl" />
          <div className="h-28 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const dashboard = data ?? {
    activeSalesPOs: 0,
    totalSalesPOAmount: 0,
    actualCost: 0,
    remainingBudget: 0,
    salesPOs: [],
  };

  return (
    <div className={`w-full min-w-0 space-y-6 ${dashboardPageContentBottomClass}`}>
      <div className="page-banner page-banner-tint-warm animate-fade-in-right fade-in-right-delay-0">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="page-banner-icon-box bg-gradient-to-br from-amber-500 to-orange-600 text-white ring-white/40">
            <LayoutDashboard className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="page-banner-kicker text-amber-700/80">Sales</p>
            <h1 className="page-banner-title">Tổng quan</h1>
            <p className="page-banner-desc">
              Theo dõi Sales Orders, ngân sách dự án và chi phí mua hàng — một nhìn biết dự án đang tới đâu.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer slide-right-card-1"
          onClick={() => navigate('/dashboard/sales/orders')}
        >
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <FileText className="w-6 h-6 text-amber-700" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Sales Orders (active)</p>
              <p className="text-2xl font-bold text-slate-900">{dashboard.activeSalesPOs ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm slide-right-card-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <DollarSign className="w-6 h-6 text-emerald-700" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Tổng giá trị PO</p>
              <p className="text-xl font-bold text-slate-900">
                {(dashboard.totalSalesPOAmount ?? 0).toLocaleString('vi-VN')} VND
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm slide-right-card-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-blue-700" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Chi phí đã mua</p>
              <p className="text-xl font-bold text-slate-900">
                {(dashboard.actualCost ?? 0).toLocaleString('vi-VN')} VND
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 slide-right-content">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Tổng quan dự án</h2>
        <p className="text-slate-500 text-sm">
          Vào{' '}
          <button
            type="button"
            className="text-amber-600 hover:underline font-medium"
            onClick={() => navigate('/dashboard/sales/orders')}
          >
            Sales Orders
          </button>{' '}
          để tạo SO, gắn PR và theo dõi tiến độ mua / chi phí.
        </p>
      </div>
    </div>
  );
};

export default SalesDashboardHome;
