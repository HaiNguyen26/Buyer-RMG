import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getDepartmentHeadDashboard } from '../../services/departmentHeadService';
import { requestorService } from '../../services/requestorService';
import { ClipboardCheck, CheckCircle2, XCircle, Clock, FileText, AlertCircle, ArrowLeftRight, Plus, Eye, User, Calendar, DollarSign, Package, X, Building2, Info, TrendingUp } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useAuth';

const DashboardHome = () => {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Fetch Department Head Dashboard (PRs cần duyệt)
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['departmentHeadDashboard'],
    queryFn: getDepartmentHeadDashboard,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Fetch My PRs (PR do chính tôi tạo)
  const { data: myPRsData, isLoading: isLoadingMyPRs } = useQuery({
    queryKey: ['my-prs-department-head'],
    queryFn: () => requestorService.getMyPRs(),
    enabled: !!user,
    staleTime: 30000,
    retry: 1,
  });

  // Fetch PR Details for modal
  const { data: prDetails, isLoading: isLoadingPRDetails, error: prDetailsError } = useQuery({
    queryKey: ['pr-details', selectedPRId],
    queryFn: () => requestorService.getPR(selectedPRId!),
    enabled: !!selectedPRId && isDetailModalOpen,
    retry: 1,
  });

  // Calculate metrics
  const calculateMetrics = () => {
    const pendingForApproval = dashboardData?.pendingCount || 0;
    
    // PR do chính tôi tạo trong tháng này
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const myPRsThisMonth = myPRsData?.prs?.filter((pr: any) => {
      const createdDate = new Date(pr.createdAt);
      return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
    }).length || 0;

    // PR phòng ban trong tháng
    const departmentPRsThisMonth = myPRsThisMonth + (dashboardData?.pendingCount || 0);

    // PR bị trả / tồn đọng
    const returnedPRs = myPRsData?.prs?.filter((pr: any) => 
      ['MANAGER_RETURNED', 'DEPARTMENT_HEAD_RETURNED', 'BRANCH_MANAGER_RETURNED', 'NEED_MORE_INFO'].includes(pr.status)
    ).length || 0;

    return {
      pendingForApproval,
      myPRsThisMonth,
      departmentPRsThisMonth,
      returnedPRs,
    };
  };

  // Get pending PRs for approval (không phải của tôi)
  const getPendingPRsForApproval = () => {
    if (!dashboardData?.pendingPRs) return [];
    return dashboardData.pendingPRs.filter((pr: any) => pr.requestor?.id !== user?.id);
  };

  // Get my PRs (do chính tôi tạo) - sort by createdAt desc
  const getMyPRs = () => {
    if (!myPRsData?.prs) return [];
    return [...myPRsData.prs].sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  // Get returned PRs that haven't been fixed
  const getReturnedPRsNotFixed = () => {
    if (!myPRsData?.prs) return [];
    return myPRsData.prs.filter((pr: any) => 
      ['MANAGER_RETURNED', 'DEPARTMENT_HEAD_RETURNED', 'BRANCH_MANAGER_RETURNED', 'NEED_MORE_INFO'].includes(pr.status)
    );
  };

  // Get PRs that are pending > X days (e.g., 7 days)
  const getPendingPRsOverDays = (days: number = 7) => {
    if (!dashboardData?.pendingPRs) return [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return dashboardData.pendingPRs.filter((pr: any) => {
      const createdDate = new Date(pr.createdAt);
      return createdDate < cutoffDate && pr.requestor?.id !== user?.id;
    });
  };

  // Handle PR row click - navigate to approval page
  const handlePRRowClick = (prId: string) => {
    navigate(`/dashboard/department-head/pr-approval`, { state: { prId } });
  };

  // Handle view PR details
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

  const getDaysPending = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusInfo = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string; bgColor: string } } = {
      'DRAFT': { label: 'Nháp', color: 'text-slate-600', bgColor: 'bg-slate-50' },
      'MANAGER_PENDING': { label: 'Chờ QL trực tiếp', color: 'text-amber-600', bgColor: 'bg-amber-50' },
      'MANAGER_APPROVED': { label: 'QL trực tiếp đã duyệt', color: 'text-green-600', bgColor: 'bg-green-50' },
      'MANAGER_REJECTED': { label: 'QL trực tiếp từ chối', color: 'text-red-600', bgColor: 'bg-red-50' },
      'MANAGER_RETURNED': { label: 'QL trực tiếp trả về', color: 'text-orange-600', bgColor: 'bg-orange-50' },
      'BRANCH_MANAGER_PENDING': { label: 'Chờ GĐ CN', color: 'text-purple-600', bgColor: 'bg-purple-50' },
      'BUYER_LEADER_PENDING': { label: 'Đã duyệt - chờ BL phân công', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
      'BRANCH_MANAGER_RETURNED': { label: 'GĐ CN trả về', color: 'text-orange-600', bgColor: 'bg-orange-50' },
      'NEED_MORE_INFO': { label: 'Cần bổ sung', color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
      'ASSIGNED_TO_BUYER': { label: 'Đã phân công Buyer', color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
      // Legacy statuses (backward compatibility)
      'DEPARTMENT_HEAD_PENDING': { label: 'Chờ QL trực tiếp', color: 'text-amber-600', bgColor: 'bg-amber-50' },
      'DEPARTMENT_HEAD_APPROVED': { label: 'QL trực tiếp đã duyệt', color: 'text-green-600', bgColor: 'bg-green-50' },
      'DEPARTMENT_HEAD_REJECTED': { label: 'QL trực tiếp từ chối', color: 'text-red-600', bgColor: 'bg-red-50' },
      'DEPARTMENT_HEAD_RETURNED': { label: 'QL trực tiếp trả về', color: 'text-orange-600', bgColor: 'bg-orange-50' },
      'BRANCH_MANAGER_APPROVED': { label: 'Đã duyệt - chờ BL phân công', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    };
    return statusMap[status] || { label: status, color: 'text-slate-600', bgColor: 'bg-slate-50' };
  };

  const getCurrentHandler = (status: string) => {
    if (status === 'MANAGER_PENDING') return 'Chờ quản lý trực tiếp duyệt';
    if (status === 'BRANCH_MANAGER_PENDING') return 'Chờ GĐ Chi nhánh duyệt';
    if (status === 'BUYER_LEADER_PENDING') return 'Chờ Buyer Leader phân công';
    if (status === 'ASSIGNED_TO_BUYER') return 'Buyer đang xử lý';
    if (status === 'MANAGER_APPROVED') return 'Quản lý trực tiếp đã duyệt';
    return '-';
  };

  if (isLoading || isLoadingMyPRs) {
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
  const pendingPRsForApproval = getPendingPRsForApproval();
  const myPRs = getMyPRs();
  const returnedPRsNotFixed = getReturnedPRsNotFixed();
  const pendingPRsOver7Days = getPendingPRsOverDays(7);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F8FAFC]">
      <div className="flex-1 min-h-0 p-6 overflow-y-auto scrollbar-hide space-y-6">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg p-6 text-white slide-right-title relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2">
              Dashboard Trưởng phòng
            </h2>
            <p className="text-white/90 text-sm font-normal">
              Tổng quan công việc của bạn ở cả 2 vai trò: Trưởng phòng (Duyệt PR) và Requestor (Tạo PR)
            </p>
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20">
            <ClipboardCheck className="w-32 h-32 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* A. KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 slide-right-content">
          {/* PR chờ tôi duyệt - NỔI BẬT NHẤT */}
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl shadow-lg p-6 border-2 border-amber-400 hover:shadow-xl transition-all slide-right-card-1 transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <AlertCircle className="w-6 h-6 text-amber-600" strokeWidth={2} />
              </div>
            </div>
            <p className="text-3xl font-bold text-amber-900 mb-1">{metrics.pendingForApproval}</p>
            <p className="text-sm text-amber-700 font-medium">PR chờ tôi duyệt</p>
          </div>

          {/* PR của tôi - Xanh nhạt, hover nâng nhẹ */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl shadow-md p-6 border border-blue-200/50 hover:shadow-lg hover:-translate-y-1 transition-all slide-right-card-2">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <FileText className="w-6 h-6 text-blue-600" strokeWidth={2} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1">{metrics.myPRsThisMonth}</p>
            <p className="text-sm text-slate-600">PR của tôi</p>
          </div>

          {/* Tổng PR phòng ban - Xám, không nổi */}
          <div className="bg-slate-100 rounded-xl shadow-sm p-6 border border-slate-200 slide-right-card-3">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-slate-200 rounded-xl">
                <Building2 className="w-6 h-6 text-slate-600" strokeWidth={2} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-700 mb-1">{metrics.departmentPRsThisMonth}</p>
            <p className="text-sm text-slate-500">Tổng PR phòng ban (tháng)</p>
          </div>

          {/* PR tồn đọng - Đỏ nhạt, text đậm */}
          <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl shadow-md p-6 border border-red-200/50 slide-right-card-4">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertCircle className="w-6 h-6 text-red-600" strokeWidth={2} />
              </div>
            </div>
            <p className="text-3xl font-bold text-red-900 mb-1">{metrics.returnedPRs}</p>
            <p className="text-sm font-semibold text-red-700">PR bị trả / Tồn đọng</p>
          </div>
        </div>

        {/* B. DANH SÁCH PR CHỜ DUYỆT */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200/50 slide-right-content overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <ClipboardCheck className="w-5 h-5 text-amber-600" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Hàng đợi duyệt</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{pendingPRsForApproval.length} PR chờ xử lý</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/dashboard/department-head/pr-approval')}
                className="text-sm text-amber-600 hover:text-amber-700 font-semibold"
              >
                Xem tất cả →
              </button>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto scrollbar-hide" style={{ maxHeight: '360px' }}>
            {pendingPRsForApproval.length > 0 ? (
              <table className="w-full">
                <thead className="bg-slate-100 sticky top-0 z-10 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Mã PR</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Người yêu cầu</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Loại PR</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Tổng giá đề xuất</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Ngày gửi</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {pendingPRsForApproval.slice(0, 6).map((pr: any, index: number) => {
                    const isLastRow = index === Math.min(pendingPRsForApproval.length, 6) - 1;
                    return (
                    <tr
                      key={pr.id}
                      onClick={() => handlePRRowClick(pr.id)}
                      className={`bg-white border-b ${isLastRow ? 'border-b-0' : 'border-[#E5E7EB]'} hover:bg-[#F8FAFC] transition-colors-theme cursor-pointer slide-right-item`}
                      style={{ animationDelay: `${0.1 + index * 0.03}s` }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-amber-100/50">
                            <FileText className="w-4 h-4 text-amber-600" strokeWidth={2} />
                          </div>
                          <span className="text-sm font-bold text-slate-900">{pr.prNumber}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700 font-medium">
                          {pr.requestor?.username || 'N/A'}
                        </div>
                        <div className="text-xs text-slate-500">{pr.department || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-700 font-medium max-w-xs">
                          {pr.itemName || 'Chưa có mô tả'}
                        </div>
                        <div className="text-xs text-slate-500">{pr.itemCount || 0} mặt hàng</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {pr.totalAmount ? (
                          <div>
                            <span className="text-sm font-bold text-slate-900">
                              {formatCurrency(pr.totalAmount, pr.currency)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 italic">Chưa có</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600 font-medium">
                          {formatDate(pr.createdAt)}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {getDaysPending(pr.createdAt)} ngày trước
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <ClipboardCheck className="w-16 h-16 mx-auto mb-4 text-slate-300" strokeWidth={1.5} />
                <p>Không có PR nào chờ duyệt</p>
              </div>
            )}
          </div>
        </div>

        {/* C. PR CỦA TÔI (TABLE NHỎ - READ-ONLY) */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200/50 slide-right-content overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <FileText className="w-5 h-5 text-blue-600" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">PR của tôi</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{myPRs.length} PR</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/dashboard/department-head/my-prs')}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
              >
                Xem tất cả →
              </button>
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto scrollbar-hide" style={{ maxHeight: '360px' }}>
            {myPRs.length > 0 ? (
              <table className="w-full">
                <thead className="bg-slate-100 sticky top-0 z-10 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Mã PR</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Loại PR</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Tổng giá</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Trạng thái</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Người đang xử lý</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {myPRs.slice(0, 6).map((pr: any, index: number) => {
                    const statusInfo = getStatusInfo(pr.status);
                    const isLastRow = index === Math.min(myPRs.length, 6) - 1;
                    return (
                      <tr
                        key={pr.id}
                        onClick={() => handleViewPRDetails(pr.id)}
                        className={`bg-white border-b ${isLastRow ? 'border-b-0' : 'border-[#E5E7EB]'} hover:bg-[#F8FAFC] transition-colors-theme cursor-pointer slide-right-item`}
                        style={{ animationDelay: `${0.2 + index * 0.03}s` }}
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
                          <div className="text-sm text-slate-700 font-medium max-w-xs">
                            {pr.itemName || pr.department || 'Chưa có mô tả'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {pr.totalAmount ? (
                            <div>
                              <span className="text-sm font-bold text-slate-900">
                                {formatCurrency(pr.totalAmount, pr.currency)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400 italic">Chưa có</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow ${statusInfo.bgColor} ${statusInfo.color} border`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-600 font-medium">
                            {getCurrentHandler(pr.status)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-slate-500">
                <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" strokeWidth={1.5} />
                <p>Chưa có PR nào</p>
                <button
                  onClick={() => navigate('/dashboard/department-head/my-prs/create')}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold"
                >
                  <Plus className="w-4 h-4" strokeWidth={2} />
                  Tạo PR mới
                </button>
              </div>
            )}
          </div>
        </div>

        {/* KHU VỰC 4 - CẢNH BÁO */}
        {(returnedPRsNotFixed.length > 0 || pendingPRsOver7Days.length > 0) && (
          <div className="bg-white rounded-xl shadow-md border-2 border-red-200 slide-right-content overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-red-50 to-orange-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-600" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-red-900">Cảnh báo</h2>
                  <p className="text-xs text-red-700 mt-0.5">
                    {returnedPRsNotFixed.length + pendingPRsOver7Days.length} vấn đề cần xử lý
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* PR bị trả nhưng Requestor chưa sửa */}
              {returnedPRsNotFixed.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowLeftRight className="w-4 h-4 text-orange-600" strokeWidth={2} />
                    <h3 className="text-sm font-semibold text-orange-900">PR bị trả nhưng chưa sửa ({returnedPRsNotFixed.length})</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {returnedPRsNotFixed.slice(0, 6).map((pr: any, index: number) => {
                      const statusInfo = getStatusInfo(pr.status);
                      return (
                        <div
                          key={pr.id}
                          onClick={() => handleViewPRDetails(pr.id)}
                          className="p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-all cursor-pointer border border-orange-200 slide-right-item"
                          style={{ animationDelay: `${0.3 + index * 0.03}s` }}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <span className="font-bold text-orange-900 text-sm">{pr.prNumber}</span>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${statusInfo.bgColor} ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 mb-1 line-clamp-1">{pr.itemName || pr.department || 'Chưa có mô tả'}</p>
                          <p className="text-xs text-slate-500">Bị trả: {formatDate(pr.updatedAt || pr.createdAt)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PR phòng ban tồn > 7 ngày */}
              {pendingPRsOver7Days.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-red-600" strokeWidth={2} />
                    <h3 className="text-sm font-semibold text-red-900">PR phòng ban tồn &gt; 7 ngày ({pendingPRsOver7Days.length})</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {pendingPRsOver7Days.slice(0, 6).map((pr: any, index: number) => (
                      <div
                        key={pr.id}
                        onClick={() => handlePRRowClick(pr.id)}
                        className="p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-all cursor-pointer border border-red-200 slide-right-item"
                        style={{ animationDelay: `${0.4 + index * 0.03}s` }}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="font-bold text-red-900 text-sm">{pr.prNumber}</span>
                          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700">
                            {getDaysPending(pr.createdAt)} ngày
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 mb-1">{pr.requestor?.username || 'N/A'}</p>
                        <p className="text-xs text-slate-500">Gửi: {formatDate(pr.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PR Details Modal */}
      {isDetailModalOpen && selectedPRId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={handleCloseDetailModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-slideUpFadeIn overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="shrink-0 flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50 rounded-t-2xl">
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
