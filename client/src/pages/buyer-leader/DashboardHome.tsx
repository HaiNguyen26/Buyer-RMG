import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, ShoppingCart, Scale, AlertTriangle, CheckCircle, Clock, TrendingUp, UserCheck, DollarSign, FileCheck, Package } from 'lucide-react';
import { buyerLeaderService } from '../../services/buyerLeaderService';
import { useNavigate } from 'react-router-dom';

const DashboardHome = () => {
  const navigate = useNavigate();

  // Fetch data for dashboard widgets
  const { data: pendingAssignments, isLoading: loadingPending } = useQuery({
    queryKey: ['buyer-leader-pending-assignments'],
    queryFn: () => buyerLeaderService.getPendingAssignments(),
  });

  // Mock data for other widgets (will be replaced with actual API calls)
  const rfqProgress = 65; // % hoàn thành báo giá
  const comparisonPending = 8; // PR đã đủ báo giá, chờ chọn NCC
  const overBudgetCount = 3; // PR vượt giá PR

  if (loadingPending) {
    return (
      <div className="h-full overflow-hidden flex flex-col">
        <div className="flex-1 p-6">
          <div className="animate-pulse space-y-6 h-full">
            <div className="h-32 bg-slate-200 rounded-2xl"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-40 bg-slate-200 rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = pendingAssignments?.prs?.length || 0;
  const rfqCount = 12; // Mock: PR đang hỏi giá

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 p-6 flex flex-col gap-6">
        {/* Header Banner */}
        <div className="flex-shrink-0 rounded-2xl shadow-lg p-6 text-white slide-right-title relative overflow-hidden" style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%)'
        }}>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2">
              Dashboard Buyer Leader
            </h2>
            <p className="text-white/90 text-sm font-normal">
              Điều phối & quyết định NCC - Dashboard quyết định
            </p>
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20">
            <UserCheck className="w-32 h-32 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Main Widgets Grid */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Widget 1: PR Waiting for Assignment */}
          <div 
            className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 flex flex-col hover:shadow-xl transition-all duration-300 slide-right-card-1 cursor-pointer group"
            onClick={() => navigate('/dashboard/buyer-leader/pending-assignments')}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                  <ClipboardCheck className="w-6 h-6 text-blue-600" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">PR Waiting for Assignment</h3>
                  <p className="text-xs text-slate-500 mt-0.5">PR đã duyệt xong (sẵn sàng mua)</p>
                </div>
              </div>
              <div className="px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-2xl font-bold text-blue-700">{pendingCount}</span>
              </div>
            </div>
            <div className="mt-auto pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Nhấp để phân công PR
              </p>
            </div>
          </div>

          {/* Widget 2: PR Under RFQ */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 flex flex-col hover:shadow-xl transition-all duration-300 slide-right-card-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-cyan-100 rounded-xl">
                  <ShoppingCart className="w-6 h-6 text-cyan-600" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">PR Under RFQ</h3>
                  <p className="text-xs text-slate-500 mt-0.5">PR Buyer đang hỏi giá</p>
                </div>
              </div>
              <div className="px-3 py-1.5 bg-cyan-50 rounded-lg border border-cyan-200">
                <span className="text-2xl font-bold text-cyan-700">{rfqCount}</span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">% hoàn thành báo giá</span>
                <span className="text-sm font-bold text-cyan-700">{rfqProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-full transition-all duration-500"
                  style={{ width: `${rfqProgress}%` }}
                ></div>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <TrendingUp className="w-3 h-3" />
                <span>Đang tiến hành hỏi giá từ NCC</span>
              </div>
            </div>
          </div>

          {/* Widget 3: Supplier Comparison Pending */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 flex flex-col hover:shadow-xl transition-all duration-300 slide-right-card-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Scale className="w-6 h-6 text-purple-600" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Supplier Comparison Pending</h3>
                  <p className="text-xs text-slate-500 mt-0.5">PR đã đủ báo giá - Chờ chọn NCC</p>
                </div>
              </div>
              <div className="px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
                <span className="text-2xl font-bold text-purple-700">{comparisonPending}</span>
              </div>
            </div>
            
            <div className="mt-auto pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <FileCheck className="w-3 h-3" />
                <span>Sẵn sàng so sánh và quyết định NCC</span>
              </div>
            </div>
          </div>

          {/* Widget 4: Over-Budget Pending Approval */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 flex flex-col hover:shadow-xl transition-all duration-300 slide-right-card-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-rose-600" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Over-Budget Pending Approval</h3>
                  <p className="text-xs text-slate-500 mt-0.5">PR vượt giá PR</p>
                </div>
              </div>
              <div className="px-3 py-1.5 bg-rose-50 rounded-lg border border-rose-200">
                <span className="text-2xl font-bold text-rose-700">{overBudgetCount}</span>
              </div>
            </div>
            
            {/* Status Badge */}
            <div className="mt-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <Clock className="w-4 h-4 text-amber-600" strokeWidth={2} />
                <span className="text-xs font-semibold text-amber-700">Chờ GĐ CN duyệt</span>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <DollarSign className="w-3 h-3" />
                <span>Trạng thái: {overBudgetCount > 0 ? 'Cần xử lý' : 'Không có'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
