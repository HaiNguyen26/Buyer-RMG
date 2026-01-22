import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { requestorService } from '../../services/requestorService';
import { FileText, AlertCircle, CheckCircle, Clock, Plus, ShoppingCart, Eye, Edit, FileEdit, Send, CheckCircle2, XCircle, ArrowLeftRight, XOctagon, UserCheck, FileCheck, Wallet, TrendingUp, X, Building2, User, Calendar, DollarSign, Package, Info } from 'lucide-react';

const DashboardHome = () => {
  const navigate = useNavigate();
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['requestor-dashboard'],
    queryFn: () => requestorService.getDashboard(),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Fetch PR details when modal opens
  const { data: prDetails, isLoading: isLoadingPRDetails, error: prDetailsError } = useQuery({
    queryKey: ['pr-details', selectedPRId],
    queryFn: () => requestorService.getPR(selectedPRId!),
    enabled: !!selectedPRId && isDetailModalOpen,
    retry: 1,
  });

  // Calculate metrics
  const calculateMetrics = () => {
    if (!dashboardData) {
      return {
        totalPRThisMonth: 0,
        waitingApproval: 0,
        returnedPR: 0,
        inPurchasing: 0,
      };
    }

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Count PRs created this month (from recentPRs)
    const totalPRThisMonth = dashboardData.recentPRs?.filter((pr: any) => {
      const createdDate = new Date(pr.createdAt);
      return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
    }).length || 0;

    // Waiting Approval: SUBMITTED, MANAGER_PENDING, BRANCH_MANAGER_PENDING
    const waitingApproval = dashboardData.prsByStatus?.reduce((sum: number, item: any) => {
      if (['SUBMITTED', 'MANAGER_PENDING', 'DEPARTMENT_HEAD_PENDING', 'BRANCH_MANAGER_PENDING'].includes(item.status)) {
        return sum + (item.count || 0);
      }
      return sum;
    }, 0) || 0;

    // Returned PR: MANAGER_RETURNED, BRANCH_MANAGER_RETURNED
    const returnedPR = dashboardData.prsByStatus?.reduce((sum: number, item: any) => {
      if (['MANAGER_RETURNED', 'DEPARTMENT_HEAD_RETURNED', 'BRANCH_MANAGER_RETURNED', 'NEED_MORE_INFO'].includes(item.status)) {
        return sum + (item.count || 0);
      }
      return sum;
    }, 0) || 0;

    // In Purchasing: ASSIGNED_TO_BUYER, RFQ_IN_PROGRESS, QUOTATION_RECEIVED, SUPPLIER_SELECTED
    const inPurchasing = dashboardData.prsByStatus?.reduce((sum: number, item: any) => {
      if (['ASSIGNED_TO_BUYER', 'RFQ_IN_PROGRESS', 'QUOTATION_RECEIVED', 'SUPPLIER_SELECTED', 'READY_FOR_RFQ'].includes(item.status)) {
        return sum + (item.count || 0);
      }
      return sum;
    }, 0) || 0;

    return {
      totalPRThisMonth,
      waitingApproval,
      returnedPR,
      inPurchasing,
    };
  };

  // Prepare chart data - hiển thị TẤT CẢ các trạng thái
  const prepareChartData = () => {
    if (!dashboardData?.prsByStatus) {
      return [];
    }

    // Map đầy đủ tất cả các trạng thái với màu sắc
    const statusColorMap: { [key: string]: string } = {
      'DRAFT': '#94a3b8',
      'SUBMITTED': '#3b82f6',
      'MANAGER_PENDING': '#f59e0b',
      'MANAGER_APPROVED': '#10b981',
      'MANAGER_REJECTED': '#ef4444',
      'MANAGER_RETURNED': '#f97316',
      'BRANCH_MANAGER_PENDING': '#a855f7',
      'BUYER_LEADER_PENDING': '#10b981',
      'BRANCH_MANAGER_REJECTED': '#ef4444',
      'BRANCH_MANAGER_RETURNED': '#f97316',
      'APPROVED_BY_BRANCH': '#10b981',
      'NEED_MORE_INFO': '#eab308',
      'ASSIGNED_TO_BUYER': '#6366f1',
      'RFQ_IN_PROGRESS': '#06b6d4',
      'QUOTATION_RECEIVED': '#14b8a6',
      'SUPPLIER_SELECTED': '#3b82f6',
      'BUDGET_EXCEPTION': '#f43f5e',
      'BUDGET_APPROVED': '#10b981',
      'BUDGET_REJECTED': '#ef4444',
      'PAYMENT_DONE': '#10b981',
      'READY_FOR_RFQ': '#10b981',
      // Legacy statuses (backward compatibility)
      'DEPARTMENT_HEAD_PENDING': '#f59e0b',
      'DEPARTMENT_HEAD_APPROVED': '#10b981',
      'DEPARTMENT_HEAD_REJECTED': '#ef4444',
      'DEPARTMENT_HEAD_RETURNED': '#f97316',
      'BRANCH_MANAGER_APPROVED': '#10b981',
    };

    const chartData = dashboardData.prsByStatus
      .map((item: any) => {
        const statusInfo = getStatusInfo(item.status);
        return {
          name: statusInfo.label,
          value: item.count || 0,
          color: statusColorMap[item.status] || '#94a3b8',
          status: item.status,
        };
      })
      .filter((item: any) => item.value > 0)
      .sort((a: any, b: any) => b.value - a.value); // Sắp xếp theo số lượng giảm dần

    return chartData;
  };

  const getStatusInfo = (status: string) => {
    const statusMap: { [key: string]: { label: string; icon: any; iconColor: string } } = {
      'DRAFT': { label: 'Nháp', icon: FileEdit, iconColor: 'text-slate-500' },
      'SUBMITTED': { label: 'Đã gửi', icon: Send, iconColor: 'text-blue-500' },
      'MANAGER_PENDING': { label: 'Chờ quản lý trực tiếp duyệt', icon: Clock, iconColor: 'text-amber-500' },
      'MANAGER_APPROVED': { label: 'Quản lý trực tiếp đã duyệt', icon: CheckCircle2, iconColor: 'text-green-500' },
      'MANAGER_REJECTED': { label: 'Quản lý trực tiếp từ chối', icon: XCircle, iconColor: 'text-red-500' },
      'MANAGER_RETURNED': { label: 'Quản lý trực tiếp trả về', icon: ArrowLeftRight, iconColor: 'text-orange-500' },
      'BRANCH_MANAGER_PENDING': { label: 'Chờ GĐ Chi nhánh duyệt', icon: Clock, iconColor: 'text-purple-500' },
      'BUYER_LEADER_PENDING': { label: 'Đã duyệt - chờ Buyer Leader phân công', icon: CheckCircle, iconColor: 'text-emerald-500' },
      // Legacy statuses (backward compatibility)
      'DEPARTMENT_HEAD_PENDING': { label: 'Chờ quản lý trực tiếp duyệt', icon: Clock, iconColor: 'text-amber-500' },
      'DEPARTMENT_HEAD_APPROVED': { label: 'Quản lý trực tiếp đã duyệt', icon: CheckCircle2, iconColor: 'text-green-500' },
      'DEPARTMENT_HEAD_REJECTED': { label: 'Quản lý trực tiếp từ chối', icon: XCircle, iconColor: 'text-red-500' },
      'DEPARTMENT_HEAD_RETURNED': { label: 'Quản lý trực tiếp trả về', icon: ArrowLeftRight, iconColor: 'text-orange-500' },
      'BRANCH_MANAGER_APPROVED': { label: 'Đã duyệt - chờ Buyer Leader phân công', icon: CheckCircle, iconColor: 'text-emerald-500' },
      'BRANCH_MANAGER_REJECTED': { label: 'GĐ Chi nhánh từ chối', icon: XOctagon, iconColor: 'text-red-500' },
      'BRANCH_MANAGER_RETURNED': { label: 'GĐ Chi nhánh trả về', icon: ArrowLeftRight, iconColor: 'text-orange-500' },
      'APPROVED_BY_BRANCH': { label: 'Đã duyệt bởi Chi nhánh', icon: CheckCircle, iconColor: 'text-emerald-500' },
      'NEED_MORE_INFO': { label: 'Cần thêm thông tin', icon: AlertCircle, iconColor: 'text-yellow-500' },
      'ASSIGNED_TO_BUYER': { label: 'Đã phân công Buyer', icon: UserCheck, iconColor: 'text-indigo-500' },
      'RFQ_IN_PROGRESS': { label: 'Đang hỏi giá', icon: ShoppingCart, iconColor: 'text-cyan-500' },
      'QUOTATION_RECEIVED': { label: 'Đã nhận báo giá', icon: FileCheck, iconColor: 'text-teal-500' },
      'SUPPLIER_SELECTED': { label: 'Đã chọn NCC', icon: CheckCircle2, iconColor: 'text-blue-500' },
      'BUDGET_EXCEPTION': { label: 'Vượt ngân sách', icon: AlertCircle, iconColor: 'text-amber-600' },
      'BUDGET_APPROVED': { label: 'Đã chấp nhận vượt ngân sách', icon: CheckCircle2, iconColor: 'text-green-500' },
      'BUDGET_REJECTED': { label: 'Từ chối vượt ngân sách', icon: XCircle, iconColor: 'text-red-500' },
      'PAYMENT_DONE': { label: 'Đã thanh toán', icon: Wallet, iconColor: 'text-emerald-500' },
      'READY_FOR_RFQ': { label: 'Sẵn sàng hỏi giá', icon: FileCheck, iconColor: 'text-emerald-500' }
    };

    return statusMap[status] || { label: status, icon: FileText, iconColor: 'text-slate-500' };
  };

  const getStatusIcon = (status: string) => {
    const statusInfo = getStatusInfo(status);
    const IconComponent = statusInfo.icon;
    return <IconComponent className={`w-5 h-5 ${statusInfo.iconColor}`} strokeWidth={2} />;
  };

  const getStatusLabel = (status: string) => {
    return getStatusInfo(status).label;
  };

    const getStatusBadgeColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      'DRAFT': 'bg-slate-50 text-slate-700 border-slate-300',
      'SUBMITTED': 'bg-blue-50 text-blue-700 border-blue-300',
      'MANAGER_PENDING': 'bg-amber-50 text-amber-700 border-amber-300',
      'MANAGER_APPROVED': 'bg-green-50 text-green-700 border-green-300',
      'MANAGER_REJECTED': 'bg-red-50 text-red-700 border-red-300',
      'MANAGER_RETURNED': 'bg-orange-50 text-orange-700 border-orange-300',
      'BRANCH_MANAGER_PENDING': 'bg-purple-50 text-purple-700 border-purple-300',
      'BUYER_LEADER_PENDING': 'bg-emerald-50 text-emerald-700 border-emerald-300',
      'BRANCH_MANAGER_REJECTED': 'bg-red-50 text-red-700 border-red-300',
      'BRANCH_MANAGER_RETURNED': 'bg-orange-50 text-orange-700 border-orange-300',
      'APPROVED_BY_BRANCH': 'bg-emerald-50 text-emerald-700 border-emerald-300',
      'NEED_MORE_INFO': 'bg-yellow-50 text-yellow-700 border-yellow-300',
      'ASSIGNED_TO_BUYER': 'bg-indigo-50 text-indigo-700 border-indigo-300',
      'RFQ_IN_PROGRESS': 'bg-cyan-50 text-cyan-700 border-cyan-300',
      'QUOTATION_RECEIVED': 'bg-teal-50 text-teal-700 border-teal-300',
      'SUPPLIER_SELECTED': 'bg-blue-50 text-blue-700 border-blue-300',
      'BUDGET_EXCEPTION': 'bg-amber-50 text-amber-700 border-amber-300',
      'BUDGET_APPROVED': 'bg-green-50 text-green-700 border-green-300',
      'BUDGET_REJECTED': 'bg-red-50 text-red-700 border-red-300',
      'PAYMENT_DONE': 'bg-emerald-50 text-emerald-700 border-emerald-300',
      'READY_FOR_RFQ': 'bg-emerald-50 text-emerald-700 border-emerald-300',
      // Legacy statuses (backward compatibility)
      'DEPARTMENT_HEAD_PENDING': 'bg-amber-50 text-amber-700 border-amber-300',
      'DEPARTMENT_HEAD_APPROVED': 'bg-green-50 text-green-700 border-green-300',
      'DEPARTMENT_HEAD_REJECTED': 'bg-red-50 text-red-700 border-red-300',
      'DEPARTMENT_HEAD_RETURNED': 'bg-orange-50 text-orange-700 border-orange-300',
      'BRANCH_MANAGER_APPROVED': 'bg-emerald-50 text-emerald-700 border-emerald-300',
    };

    return colorMap[status] || 'bg-slate-50 text-slate-700 border-slate-300';
  };

  // Get action required PRs
  const getActionRequiredPRs = () => {
    if (!dashboardData) return [];

    const actionRequired: any[] = [];

    // PRs Need More Info from dashboardData
    if (dashboardData.prsNeedMoreInfo && dashboardData.prsNeedMoreInfo.length > 0) {
      dashboardData.prsNeedMoreInfo.forEach((pr: any) => {
        actionRequired.push({
          ...pr,
          type: 'NEED_MORE_INFO',
          priority: 'high',
        });
      });
    }

    return actionRequired;
  };

  // Handle PR click
  const handleViewPRDetails = (prId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedPRId(prId);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedPRId(null);
  };

  // Format helpers
  const formatCurrency = (amount?: number, currency?: string) => {
    if (!amount) return 'N/A';
    return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency || 'VND'}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  // Format currency with compact notation for large numbers
  const formatCurrencyCompact = (amount: number): string => {
    if (amount >= 1000000000) {
      // >= 1 tỷ
      const billions = amount / 1000000000;
      return billions % 1 === 0
        ? `${billions.toFixed(0)} tỷ`
        : `${billions.toFixed(1)} tỷ`;
    } else if (amount >= 1000000) {
      // >= 1 triệu
      const millions = amount / 1000000;
      return millions % 1 === 0
        ? `${millions.toFixed(0)} triệu`
        : `${millions.toFixed(1)} triệu`;
    } else if (amount >= 1000) {
      // >= 1 nghìn
      const thousands = amount / 1000;
      return thousands % 1 === 0
        ? `${thousands.toFixed(0)}K`
        : `${thousands.toFixed(1)}K`;
    } else {
      // < 1 nghìn
      return new Intl.NumberFormat('vi-VN').format(amount);
    }
  };

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

  const metrics = calculateMetrics();
  const chartData = prepareChartData();
  const actionRequiredPRs = getActionRequiredPRs();

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F8FAFC]">
      <div className="flex-1 min-h-0 p-6 overflow-y-auto scrollbar-hide space-y-6">
        {/* D. ACTION REQUIRED - Priority Section */}
        {actionRequiredPRs.length > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl p-6 slide-right-title shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-600" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-900">Hành động cần thực hiện ngay</h2>
                <p className="text-sm text-red-700">Có {actionRequiredPRs.length} PR cần bạn xử lý</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {actionRequiredPRs.map((pr: any, index: number) => (
                <div
                  key={pr.id}
                  onClick={() => handleViewPRDetails(pr.id)}
                  className="bg-white border-2 border-red-300 rounded-xl p-4 hover:shadow-lg transition-all cursor-pointer slide-right-item"
                  style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-bold text-red-900">{pr.prNumber}</span>
                    <span className="px-2 py-1 text-xs font-semibold rounded-lg bg-red-100 text-red-700">
                      {pr.type === 'NEED_MORE_INFO' ? 'Cần bổ sung' : 'Trả về'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mb-2">{pr.itemName || '-'}</p>
                  {pr.notes && (
                    <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-xs font-semibold text-red-900 mb-1">Nhận xét:</p>
                      <p className="text-xs text-red-700">{pr.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* A. KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 slide-right-content">
          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200/50 hover:shadow-lg transition-shadow slide-right-card-1">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <FileText className="w-6 h-6 text-blue-600" strokeWidth={2} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{metrics.totalPRThisMonth}</p>
            <p className="text-sm text-slate-600">Tổng PR (Tháng này)</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200/50 hover:shadow-lg transition-shadow slide-right-card-2">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="w-6 h-6 text-amber-600" strokeWidth={2} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{metrics.waitingApproval}</p>
            <p className="text-sm text-slate-600">Chờ duyệt</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200/50 hover:shadow-lg transition-shadow slide-right-card-3">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-xl">
                <ArrowLeftRight className="w-6 h-6 text-orange-600" strokeWidth={2} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{metrics.returnedPR}</p>
            <p className="text-sm text-slate-600">PR trả về</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200/50 hover:shadow-lg transition-shadow slide-right-card-4">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <ShoppingCart className="w-6 h-6 text-indigo-600" strokeWidth={2} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{metrics.inPurchasing}</p>
            <p className="text-sm text-slate-600">Đang mua hàng</p>
          </div>
        </div>

        {/* B. PR STATUS OVERVIEW - Chart */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200/50 slide-right-content">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-xl">
              <TrendingUp className="w-5 h-5 text-purple-600" strokeWidth={2} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Tổng quan trạng thái PR</h2>
          </div>
          {chartData.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Donut Chart */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-4 text-center">Biểu đồ Donut</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Bar Chart */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-4 text-center">Biểu đồ Cột</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6">
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" strokeWidth={1.5} />
              <p>Chưa có dữ liệu để hiển thị</p>
            </div>
          )}
        </div>

        {/* C. MY ACTIVE PR - Table */}
        {dashboardData?.recentPRs && dashboardData.recentPRs.length > 0 && (
          <div className="bg-white rounded-xl shadow-md border border-slate-200/50 slide-right-content overflow-hidden">
            {/* Header Bảng */}
            <div className="p-6 border-b border-slate-200 bg-[#F8FAFC]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#EFF6FF] rounded-xl">
                    <FileText className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#0F172A]">PR đang hoạt động</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{dashboardData.recentPRs.length} PR</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/dashboard/requestor/pr/create')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#F97316] text-white rounded-xl hover:bg-[#EA580C] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:ring-offset-2 transition-theme font-semibold text-sm shadow-sm hover:shadow-md"
                >
                  <Plus className="w-4 h-4" strokeWidth={2} />
                  <span>Tạo PR mới</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto scrollbar-hide" style={{ maxHeight: '400px' }}>
              <table className="w-full">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Mã PR</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Tên hàng hóa</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Trạng thái</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Ngày tạo</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Tổng tiền</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dashboardData.recentPRs.slice(0, 6).map((pr: any, index: number) => (
                    <tr
                      key={pr.id}
                      className="bg-white border-b border-[#E5E7EB] hover:bg-[#F8FAFC] cursor-pointer transition-colors-theme slide-right-item"
                      style={{ animationDelay: `${0.5 + index * 0.03}s` }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-blue-100/50">
                            <FileText className="w-4 h-4 text-blue-600" strokeWidth={2} />
                          </div>
                          <span className="text-sm font-bold text-slate-900">{pr.prNumber}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-700 font-medium max-w-md">
                          {pr.itemName && pr.itemName !== 'N/A' && pr.itemName.trim() ? (
                            <span className="line-clamp-2">{pr.itemName}</span>
                          ) : pr.itemCount > 0 ? (
                            <span className="text-slate-600">{pr.itemCount} mặt hàng</span>
                          ) : (
                            <span className="text-slate-400 italic">Chưa có hàng hóa</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {pr.status === 'BUDGET_EXCEPTION' || pr.status === 'BUDGET_APPROVED' || pr.status === 'BUDGET_REJECTED' ? (
                          <div className="group relative inline-block">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border shadow-sm ${getStatusBadgeColor(pr.status)}`}>
                              <AlertCircle className="w-3.5 h-3.5" strokeWidth={2} />
                              {pr.status === 'BUDGET_EXCEPTION' ? 'Vượt ngân sách' : getStatusLabel(pr.status)}
                            </span>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                              {pr.status === 'BUDGET_EXCEPTION' && 'Giá mua cao hơn giá đề xuất ban đầu'}
                              {pr.status === 'BUDGET_APPROVED' && 'GĐ CN đã chấp nhận vượt ngân sách'}
                              {pr.status === 'BUDGET_REJECTED' && 'GĐ CN đã từ chối vượt ngân sách'}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                <div className="w-2 h-2 bg-slate-900 rotate-45"></div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border shadow-sm ${getStatusBadgeColor(pr.status)}`}>
                            {getStatusIcon(pr.status)}
                            {getStatusLabel(pr.status)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600 font-medium">
                          {new Date(pr.createdAt).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {new Date(pr.createdAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {pr.totalAmount && typeof pr.totalAmount === 'number' && pr.totalAmount > 0 ? (
                          <div className="group relative inline-block">
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-semibold text-[#0F172A]">
                                {formatCurrencyCompact(pr.totalAmount)}
                              </span>
                              <span className="text-xs text-[#64748B]">{pr.currency || 'VND'}</span>
                            </div>
                            {/* Tooltip for full amount - only show if number is compacted */}
                            {pr.totalAmount >= 1000 && (
                              <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50">
                                {new Intl.NumberFormat('vi-VN').format(pr.totalAmount)} {pr.currency || 'VND'}
                                <div className="absolute top-full left-4 -mt-1 w-2 h-2 bg-slate-900 transform rotate-45"></div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 italic">Chưa có</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => handleViewPRDetails(pr.id, e)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all duration-200 hover:scale-110 hover:shadow-md"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4" strokeWidth={2} />
                          </button>
                          {(pr.status === 'DRAFT' || pr.status === 'NEED_MORE_INFO') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/dashboard/requestor/pr/${pr.id}`);
                              }}
                              className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-all duration-200 hover:scale-110 hover:shadow-md"
                              title="Chỉnh sửa"
                            >
                              <Edit className="w-4 h-4" strokeWidth={2} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!dashboardData?.recentPRs || dashboardData.recentPRs.length === 0) && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Chưa có PR nào</h3>
            <p className="text-slate-500 mb-6">Bắt đầu tạo yêu cầu mua hàng đầu tiên của bạn</p>
            <button
              onClick={() => navigate('/dashboard/requestor/pr/create')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-semibold shadow-sm"
            >
              <Plus className="w-5 h-5" strokeWidth={2} />
              <span>Tạo PR mới</span>
            </button>
          </div>
        )}
      </div>

      {/* PR Details Modal */}
      {isDetailModalOpen && selectedPRId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={handleCloseDetailModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col modal-enter overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Chi tiết Yêu cầu Mua hàng</h2>
                {prDetails && (
                  <p className="text-sm text-slate-600 mt-1">
                    Mã PR: <span className="font-semibold text-blue-600">{prDetails.prNumber}</span>
                  </p>
                )}
              </div>
              <button
                onClick={handleCloseDetailModal}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
                type="button"
              >
                <X className="w-5 h-5 text-slate-600" strokeWidth={2} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-hide">
              {isLoadingPRDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Đang tải chi tiết PR...</p>
                  </div>
                </div>
              ) : prDetailsError ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <X className="w-8 h-8 text-red-600" strokeWidth={2} />
                    </div>
                    <p className="text-red-600 font-medium mb-1">Lỗi khi tải chi tiết PR</p>
                    <p className="text-slate-500 text-sm">{prDetailsError instanceof Error ? prDetailsError.message : 'Vui lòng thử lại sau'}</p>
                  </div>
                </div>
              ) : prDetails ? (
                <div className="space-y-6">
                  {/* Over-Budget Banner (REQUESTOR - Read-only) */}
                  {(prDetails as any).status === 'BUDGET_EXCEPTION' || (prDetails as any).status === 'BUDGET_APPROVED' || (prDetails as any).status === 'BUDGET_REJECTED' ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-amber-900">
                          {(prDetails as any).status === 'BUDGET_EXCEPTION'
                            ? 'PR này đang được xem xét do vượt ngân sách'
                            : (prDetails as any).status === 'BUDGET_APPROVED'
                              ? 'PR này đã được GĐ CN chấp nhận vượt ngân sách'
                              : 'PR này đã bị GĐ CN từ chối do vượt ngân sách'}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* PR Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl shadow-sm">
                      <Building2 className="w-5 h-5 text-slate-600" strokeWidth={2} />
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Phòng ban</p>
                        <p className="font-semibold text-slate-900">{prDetails.department || 'N/A'}</p>
                      </div>
                    </div>
                    {(prDetails as any).requestor && (
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl shadow-sm">
                        <User className="w-5 h-5 text-slate-600" strokeWidth={2} />
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Người yêu cầu</p>
                          <p className="font-semibold text-slate-900">{(prDetails as any).requestor?.username || 'N/A'}</p>
                        </div>
                      </div>
                    )}
                    {prDetails.requiredDate && (
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl shadow-sm">
                        <Calendar className="w-5 h-5 text-slate-600" strokeWidth={2} />
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Ngày cần</p>
                          <p className="font-semibold text-slate-900">{formatDate(prDetails.requiredDate)}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200 shadow-sm">
                      <DollarSign className="w-5 h-5 text-green-600" strokeWidth={2} />
                      <div>
                        <p className="text-xs text-green-700 mb-1">Tổng tiền</p>
                        <p className="font-bold text-green-700 text-lg">
                          {formatCurrency((prDetails as any).totalAmount, (prDetails as any).currency)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Purpose */}
                  {prDetails.purpose && (
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="w-4 h-4 text-blue-600" strokeWidth={2} />
                        <p className="text-sm font-semibold text-blue-900">Mục đích sử dụng</p>
                      </div>
                      <p className="text-sm text-slate-700">{prDetails.purpose}</p>
                    </div>
                  )}

                  {/* Items Table */}
                  {prDetails.items && prDetails.items.length > 0 && (
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-slate-600" strokeWidth={2} />
                        Danh sách vật tư/dịch vụ ({prDetails.items.length})
                      </h3>
                      <div className="overflow-x-auto overflow-hidden rounded-xl">
                        <div className="border border-slate-200 rounded-xl overflow-hidden" style={{ borderRadius: '0.75rem' }}>
                          <table className="w-full">
                            <thead className="bg-slate-100 border-b border-slate-200" style={{ borderTopLeftRadius: '0.75rem', borderTopRightRadius: '0.75rem' }}>
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">STT</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">Mô tả</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">Số lượng</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">Đơn vị</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">Mục đích</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {prDetails.items.map((item: any, index: number) => {
                                const isLastRow = index === (prDetails.items?.length || 0) - 1;
                                return (
                                  <tr key={item.id || index} className="bg-white border-b border-slate-200 last:border-b-0">
                                    <td className="px-4 py-3 text-sm text-slate-900 bg-white">{item.lineNo || index + 1}</td>
                                    <td className="px-4 py-3 text-sm text-slate-700 bg-white">{item.description || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-900 bg-white">{item.qty || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-700 bg-white">{item.unit || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-700 bg-white" style={isLastRow ? { borderBottomLeftRadius: '0.75rem', borderBottomRightRadius: '0.75rem' } : {}}>
                                      {item.purpose || '-'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHome;
