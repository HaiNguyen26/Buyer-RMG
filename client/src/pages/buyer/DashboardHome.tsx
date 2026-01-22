import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ShoppingCart, AlertCircle, Clock, FileText, CheckCircle, XCircle, TrendingUp, Calendar, Package } from 'lucide-react';
import { buyerService } from '../../services/buyerService';

const DashboardHome = () => {
  const navigate = useNavigate();

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['buyer-dashboard'],
    queryFn: () => buyerService.getDashboard(),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: assignedPRs } = useQuery({
    queryKey: ['buyer-assigned-prs'],
    queryFn: () => buyerService.getAssignedPRs(),
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="h-full overflow-hidden flex flex-col">
        <div className="flex-1 p-6">
          <div className="animate-pulse space-y-6 h-full">
            <div className="h-24 bg-slate-200 rounded-2xl"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              <div className="bg-slate-200 rounded-2xl"></div>
              <div className="bg-slate-200 rounded-2xl"></div>
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

  const myAssignedPRs = assignedPRs?.prs || [];
  
  // Filter PRs by status from assigned PRs
  const rfqInProgressPRs = myAssignedPRs.filter((pr: any) => pr.status === 'RFQ_IN_PROGRESS' || pr.status === 'QUOTATION_RECEIVED');
  const returnedPRs = myAssignedPRs.filter((pr: any) => pr.status === 'RETURNED' || pr.status === 'NEED_MORE_INFO');
  
  // Calculate upcoming deadlines (PRs with deadline in next 7 days)
  const today = new Date();
  const upcomingDeadlines = myAssignedPRs
    .filter((pr: any) => {
      if (!pr.deadline) return false;
      const deadline = new Date(pr.deadline);
      const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    })
    .map((pr: any) => {
      const deadline = new Date(pr.deadline);
      const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return {
        ...pr,
        daysLeft: diffDays,
      };
    })
    .sort((a: any, b: any) => a.daysLeft - b.daysLeft);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string; icon: any } } = {
      'ASSIGNED_TO_BUYER': { label: 'Đã phân công', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Package },
      'RFQ_IN_PROGRESS': { label: 'Đang hỏi giá', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', icon: ShoppingCart },
      'QUOTATION_RECEIVED': { label: 'Đã nhận báo giá', color: 'bg-teal-50 text-teal-700 border-teal-200', icon: FileText },
      'SUPPLIER_SELECTED': { label: 'Đã chọn NCC', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
      'RETURNED': { label: 'Bị trả về', color: 'bg-orange-50 text-orange-700 border-orange-200', icon: XCircle },
    };
    const statusInfo = statusMap[status] || { label: status, color: 'bg-slate-50 text-slate-700 border-slate-200', icon: FileText };
    const StatusIcon = statusInfo.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border shadow-sm ${statusInfo.color}`}>
        <StatusIcon className="w-3.5 h-3.5" strokeWidth={2} />
        {statusInfo.label}
      </span>
    );
  };

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 p-6 flex flex-col gap-6">
        {/* Header Banner */}
        <div className="flex-shrink-0 rounded-2xl shadow-lg p-6 text-white slide-right-title relative overflow-hidden" style={{
          background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)'
        }}>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-white mb-2">
              Dashboard Buyer
            </h2>
            <p className="text-white/90 text-sm font-normal">
              Xử lý PR được giao - Theo dõi công việc và deadline
            </p>
          </div>
          <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20">
            <ClipboardList className="w-32 h-32 text-white" strokeWidth={1.5} />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="flex flex-col gap-6 min-h-0">
            {/* Widget 1: My Assigned PR */}
            <div className="flex-1 min-h-0 flex flex-col bg-white rounded-2xl shadow-lg border border-slate-200/50 slide-right-card-1 overflow-hidden">
              <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ClipboardList className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">My Assigned PR</h3>
                    <p className="text-xs text-slate-600 mt-0.5">PR được phân công cho tôi</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                {myAssignedPRs.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {myAssignedPRs.slice(0, 10).map((pr: any) => (
                      <div
                        key={pr.id}
                        onClick={() => navigate(`/dashboard/buyer/assigned-pr/${pr.id}`)}
                        className="px-6 py-4 hover:bg-blue-50/50 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" strokeWidth={2} />
                              <p className="font-bold text-sm text-slate-900 truncate">{pr.prNumber}</p>
                            </div>
                            {pr.assignedDate && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                                <Calendar className="w-3 h-3" strokeWidth={2} />
                                <span>Phân công: {formatDate(pr.assignedDate)}</span>
                              </div>
                            )}
                            <div className="mt-2">{getStatusBadge(pr.status || 'ASSIGNED_TO_BUYER')}</div>
                          </div>
                          <div className="flex-shrink-0">
                            <TrendingUp className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-colors" strokeWidth={2} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center p-8">
                    <div className="text-center">
                      <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
                      <p className="text-slate-500 text-sm">Chưa có PR được phân công</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Widget 2: Upcoming Deadlines */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 slide-right-card-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-rose-100 rounded-lg">
                  <Clock className="w-5 h-5 text-rose-600" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Upcoming Deadlines</h3>
                  <p className="text-xs text-slate-600 mt-0.5">PR sắp quá hạn xử lý</p>
                </div>
              </div>
              <div className="space-y-3">
                {upcomingDeadlines.map((pr: any) => (
                  <div
                    key={pr.id}
                    onClick={() => navigate(`/dashboard/buyer/assigned-pr/${pr.id}`)}
                    className="p-4 bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm text-slate-900">{pr.prNumber}</p>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${
                        pr.daysLeft <= 2 ? 'bg-red-100 text-red-700 border border-red-200' :
                        'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}>
                        {pr.daysLeft <= 0 ? 'Quá hạn' : `Còn ${pr.daysLeft} ngày`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Calendar className="w-3 h-3" strokeWidth={2} />
                      <span>Deadline: {formatDate(pr.deadline)}</span>
                    </div>
                  </div>
                ))}
                {upcomingDeadlines.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-4">Không có deadline sắp đến</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-6 min-h-0">
            {/* Widget 3: RFQ in Progress */}
            <div className="flex-1 min-h-0 flex flex-col bg-white rounded-2xl shadow-lg border border-slate-200/50 slide-right-card-2 overflow-hidden">
              <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-cyan-50 to-teal-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <ShoppingCart className="w-5 h-5 text-cyan-600" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">RFQ in Progress</h3>
                    <p className="text-xs text-slate-600 mt-0.5">PR đang hỏi giá</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-hide">
                <div className="space-y-4">
                  {rfqInProgressPRs.map((pr: any) => (
                    <div
                      key={pr.id}
                      onClick={() => navigate(`/dashboard/buyer/assigned-pr/${pr.id}`)}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-bold text-sm text-slate-900">{pr.prNumber}</p>
                        <div className="text-xs font-semibold text-cyan-700">
                          {getStatusBadge(pr.status)}
                        </div>
                      </div>
                      {pr.deadline && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                          <Calendar className="w-3 h-3" strokeWidth={2} />
                          <span>Deadline: {formatDate(pr.deadline)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {rfqInProgressPRs.length === 0 && (
                    <div className="text-center py-8">
                      <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
                      <p className="text-slate-500 text-sm">Không có PR đang hỏi giá</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Widget 4: PR Returned / Rework */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-6 slide-right-card-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-orange-600" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">PR Returned / Rework</h3>
                  <p className="text-xs text-slate-600 mt-0.5">PR bị yêu cầu hỏi lại / cần thương lượng</p>
                </div>
              </div>
              <div className="space-y-3">
                {returnedPRs.map((pr: any) => (
                  <div
                    key={pr.id}
                    onClick={() => navigate(`/dashboard/buyer/assigned-pr/${pr.id}`)}
                    className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm text-slate-900">{pr.prNumber}</p>
                      <span className="px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200 rounded-lg">
                        Cần xử lý
                      </span>
                    </div>
                    {pr.notes && (
                      <p className="text-xs text-slate-600 mb-2 line-clamp-2">{pr.notes}</p>
                    )}
                    {pr.deadline && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" strokeWidth={2} />
                        <span>Deadline: {formatDate(pr.deadline)}</span>
                      </div>
                    )}
                  </div>
                ))}
                {returnedPRs.length === 0 && (
                  <div className="text-center py-4">
                    <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-sm text-slate-500">Không có PR cần xử lý lại</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
