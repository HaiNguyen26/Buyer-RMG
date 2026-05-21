import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { requestorService } from '../../services/requestorService';
import { FileText, AlertCircle, CheckCircle, Clock, Plus, Sparkles, ShoppingCart, ArrowRight, Eye, Edit } from 'lucide-react';
import { useCurrentUser } from '../../hooks/useAuth';
import { useCreatePRConfirm } from '../../hooks/useCreatePRConfirm';
import { DepartmentPageHero } from '../../components/DepartmentPageHero';
import { departmentHeadPageStackClass, departmentHeadPanelCardClass } from '../../constants/departmentHeadLayout';

const MyPRDashboard = () => {
  const navigate = useNavigate();
  const { requestCreatePR, createPRConfirmModal } = useCreatePRConfirm();
  const { data: user } = useCurrentUser();
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['requestor-dashboard'],
    queryFn: () => requestorService.getDashboard(),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Lỗi khi tải dữ liệu</p>
        </div>
      </div>
    );
  }

  const { totalPRs = 0, prsByStatus = {}, prsNeedMoreInfo = [], recentPRs = [] } = dashboardData || {};

  return (
    <div className="h-full min-w-0 w-full max-w-none overflow-y-auto overflow-x-hidden scrollbar-hide">
      <div className={`w-full min-w-0 max-w-none ${departmentHeadPageStackClass}`}>
        <div className="shrink-0 pb-2">
          <DepartmentPageHero
            kicker="Trưởng phòng · PR của tôi"
            title="My PR Dashboard"
            description="Tổng quan PR do chính bạn tạo"
            Icon={FileText}
            tint="ocean"
            regionLabel="My PR Dashboard"
            rightSlot={
              <button
                type="button"
                onClick={() => requestCreatePR('/dashboard/department-head/my-prs/create')}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/35 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                <Plus className="h-5 w-5" />
                Tạo PR mới
              </button>
            }
          />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className={`min-w-0 ${departmentHeadPanelCardClass} !p-4 sm:!p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Tổng PR</p>
                <p className="text-2xl font-bold text-slate-900">{totalPRs}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className={`min-w-0 ${departmentHeadPanelCardClass} !p-4 sm:!p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Chờ duyệt</p>
                <p className="text-2xl font-bold text-blue-600">
                  {(prsByStatus as any)?.MANAGER_PENDING || (prsByStatus as any)?.DEPARTMENT_HEAD_PENDING || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className={`min-w-0 ${departmentHeadPanelCardClass} !p-4 sm:!p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Cần bổ sung</p>
                <p className="text-2xl font-bold text-amber-600">{prsNeedMoreInfo.length}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className={`min-w-0 ${departmentHeadPanelCardClass} !p-4 sm:!p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Đã duyệt</p>
                <p className="text-2xl font-bold text-green-600">
                  {(prsByStatus as any)?.BUYER_LEADER_PENDING || (prsByStatus as any)?.BRANCH_MANAGER_APPROVED || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent PRs */}
        {recentPRs.length > 0 && (
          <div className={`min-w-0 ${departmentHeadPanelCardClass} !p-4 sm:!p-6`}>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">PR gần đây</h3>
            <div className="space-y-3">
              {recentPRs.slice(0, 5).map((pr: any) => (
                <div
                  key={pr.id}
                  onClick={() => navigate(`/dashboard/department-head/my-prs/${pr.id}`)}
                  className="flex flex-col gap-2 rounded-lg bg-slate-50 p-4 transition-colors hover:bg-slate-100 cursor-pointer sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{pr.prNumber}</p>
                    <p className="text-sm text-slate-600">{pr.itemName || 'Chưa có mô tả'}</p>
                  </div>
                  <div className="w-full shrink-0 text-left sm:w-auto sm:text-right">
                    <p className="font-semibold text-slate-900">
                      {pr.totalAmount ? `${pr.totalAmount.toLocaleString('vi-VN')} ${pr.currency}` : 'Chưa có'}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      pr.status === 'DRAFT' ? 'bg-slate-100 text-slate-700' :
                      pr.status === 'MANAGER_PENDING' || pr.status === 'DEPARTMENT_HEAD_PENDING' || pr.status === 'BRANCH_MANAGER_PENDING' ? 'bg-blue-100 text-blue-700' :
                      pr.status === 'MANAGER_RETURNED' || pr.status === 'DEPARTMENT_HEAD_RETURNED' || pr.status === 'BRANCH_MANAGER_RETURNED' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {pr.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {createPRConfirmModal}
    </div>
  );
};

export default MyPRDashboard;









