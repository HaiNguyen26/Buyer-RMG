import { useQuery } from '@tanstack/react-query';
import { Users, Building2, ClipboardList, Settings, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import { systemAdminService } from '../../services/systemAdminService';

const DashboardHome = () => {
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['system-admin-dashboard'],
    queryFn: () => systemAdminService.getDashboard(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
        <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
      </div>
    );
  }

  const stats = dashboardData || {
    totalEmployees: 0,
    totalDepartments: 0,
    totalBranches: 0,
    activePRs: 0,
    activeApprovalRules: 0,
    warnings: [],
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Employees */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" strokeWidth={2} />
            </div>
            <TrendingUp className="w-5 h-5 text-green-500" strokeWidth={2} />
          </div>
          <h3 className="text-sm font-medium text-slate-600 mb-1">Tổng nhân viên</h3>
          <p className="text-3xl font-bold text-slate-900">{stats.totalEmployees}</p>
          <p className="text-xs text-slate-500 mt-1">Nhân viên trong hệ thống</p>
        </div>

        {/* Total Departments */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Building2 className="w-6 h-6 text-green-600" strokeWidth={2} />
            </div>
            <TrendingUp className="w-5 h-5 text-green-500" strokeWidth={2} />
          </div>
          <h3 className="text-sm font-medium text-slate-600 mb-1">Tổng phòng ban</h3>
          <p className="text-3xl font-bold text-slate-900">{stats.totalDepartments}</p>
          <p className="text-xs text-slate-500 mt-1">Phòng ban đang hoạt động</p>
        </div>

        {/* Total Branches */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Building2 className="w-6 h-6 text-purple-600" strokeWidth={2} />
            </div>
            <TrendingUp className="w-5 h-5 text-green-500" strokeWidth={2} />
          </div>
          <h3 className="text-sm font-medium text-slate-600 mb-1">Tổng chi nhánh</h3>
          <p className="text-3xl font-bold text-slate-900">{stats.totalBranches}</p>
          <p className="text-xs text-slate-500 mt-1">Chi nhánh trong hệ thống</p>
        </div>

        {/* Active PRs */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <ClipboardList className="w-6 h-6 text-amber-600" strokeWidth={2} />
            </div>
            <TrendingUp className="w-5 h-5 text-blue-500" strokeWidth={2} />
          </div>
          <h3 className="text-sm font-medium text-slate-600 mb-1">PR đang chạy</h3>
          <p className="text-3xl font-bold text-slate-900">{stats.activePRs}</p>
          <p className="text-xs text-slate-500 mt-1">Purchase Requests đang xử lý</p>
        </div>

        {/* Active Approval Rules */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Settings className="w-6 h-6 text-indigo-600" strokeWidth={2} />
            </div>
            <CheckCircle2 className="w-5 h-5 text-green-500" strokeWidth={2} />
          </div>
          <h3 className="text-sm font-medium text-slate-600 mb-1">Approval Rules</h3>
          <p className="text-3xl font-bold text-slate-900">{stats.activeApprovalRules}</p>
          <p className="text-xs text-slate-500 mt-1">Quy tắc đang active</p>
        </div>
      </div>

      {/* Warnings Section */}
      {stats.warnings && stats.warnings.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-amber-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" strokeWidth={2} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Cảnh báo hệ thống</h2>
          </div>
          <div className="space-y-3">
            {stats.warnings.map((warning: any, index: number) => (
              <div
                key={index}
                className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 animate-pulse-warning"
              >
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-900">{warning.title}</p>
                  <p className="text-xs text-amber-700 mt-1">{warning.message}</p>
                  {warning.count !== undefined && (
                    <p className="text-xs text-amber-600 mt-1 font-semibold">
                      Số lượng: {warning.count}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Warnings */}
      {(!stats.warnings || stats.warnings.length === 0) && (
        <div className="bg-white rounded-xl shadow-md border border-green-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Hệ thống hoạt động bình thường</h2>
              <p className="text-sm text-slate-600 mt-1">Không có cảnh báo nào</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHome;







