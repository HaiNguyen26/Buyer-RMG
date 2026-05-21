import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getDepartmentHeadDashboard } from '../../services/departmentHeadService';
import { requestorService } from '../../services/requestorService';
import {
  Building2,
  ClipboardCheck,
  Clock,
  FileText,
  AlertCircle,
  ArrowLeftRight,
  User,
  Calendar,
  DollarSign,
  Package,
  X,
  Info,
  Sparkles,
  ChevronRight,
  Eye,
  CheckCircle2,
  XCircle,
  FilePlus,
} from 'lucide-react';
import { useCurrentUser } from '../../hooks/useAuth';
import { PRSalesOrderLine } from '../../components/PRSalesOrderLine';
import { DepartmentPageHero } from '../../components/DepartmentPageHero';
import {
  departmentHeadDataTableCardClass,
  departmentHeadListTableScrollClass,
  departmentHeadTableTbodyElevatedClass,
  departmentHeadDashboardDataRowInteractive,
  departmentHeadInteractiveTableClass,
  departmentHeadTableAccentRailClass,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableCellContentWrapFlexClass,
  departmentHeadTableActionClusterClass,
  departmentHeadKpiIslandPaddingClass,
  departmentHeadKpiGridManagerClass,
  departmentHeadKpiGridRequestorClass,
} from '../../constants/departmentHeadLayout';
import {
  saasTableRootClass,
  saasTableHeadCellClass,
  saasPrStatusBadgeClass,
  saasPrStatusLabel,
  SAAS_BADGE_BY_TONE,
  saasTableIconBtnView,
} from '../../constants/saasDataTable';
import {
  DashboardV3ShimmerBlock,
  dashboardV3CtaLinkClass,
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
} from '../../components/dashboard/DashboardV3Chrome';
import { StatCard } from '../../components/buyer-manager/StatCard';
import { SectionHeader } from '../../components/buyer-manager/SectionHeader';
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

  const kpiActivity = (count: number): 'active' | 'zero' => (count > 0 ? 'active' : 'zero');

  /** KPI chỉ số nhanh — API `/department-head/dashboard` + PR của tôi (requestor). */
  const calculateMetrics = () => {
    const pendingForApproval = dashboardData?.pendingCount ?? 0;
    const approvedLast30d = dashboardData?.approvedCount ?? 0;
    const rejectedLast30d = dashboardData?.rejectedCount ?? 0;

    const now = new Date();
    const myPRsThisMonth =
      myPRsData?.prs?.filter((pr: { createdAt: string }) => {
        const created = new Date(pr.createdAt);
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }).length ?? 0;

    const returnedPRs =
      myPRsData?.prs?.filter((pr: { status: string }) =>
        ['MANAGER_RETURNED', 'DEPARTMENT_HEAD_RETURNED', 'BRANCH_MANAGER_RETURNED', 'NEED_MORE_INFO'].includes(
          pr.status,
        ),
      ).length ?? 0;

    return {
      pendingForApproval,
      approvedLast30d,
      rejectedLast30d,
      myPRsThisMonth,
      returnedPRs,
    };
  };

  // Get pending PRs for approval (không phải của tôi)
  const getPendingPRsForApproval = () => {
    if (!dashboardData?.pendingPRs) return [];
    return dashboardData.pendingPRs.filter((pr: any) => pr.requestor?.id !== user?.id);
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

  useEffect(() => {
    if (!isDetailModalOpen) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDetailModalOpen(false);
        setSelectedPRId(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      document.removeEventListener('keydown', onKey);
    };
  }, [isDetailModalOpen]);

  // Format helpers
  const formatCurrency = (amount?: number, currency?: string) => {
    if (!amount) return 'N/A';
    return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency || 'VND'}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const getPRTypeLabel = (pr: any) => {
    const rawType = String(pr?.type || pr?.prType || pr?.typeKey || '').toUpperCase();
    const typeMap: Record<string, string> = {
      COMMERCIAL: 'Thương mại',
      PRODUCTION: 'Sản xuất',
      PROJECT: 'Dự án',
      OFFICE: 'Văn phòng',
      MATERIAL: 'Vật tư',
      SERVICE: 'Dịch vụ',
    };
    if (pr?.typeLabel && String(pr.typeLabel).trim()) return String(pr.typeLabel);
    if (pr?.typeName && String(pr.typeName).trim()) return String(pr.typeName);
    if (rawType && typeMap[rawType]) return typeMap[rawType];
    return 'Chưa phân loại';
  };

  const getDaysPending = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  /** Trang chủ DH: theo công thức Requestor — cao tự nhiên, cuộn trên main shell cha. */
  const pageRootClass = 'w-full min-h-full min-w-0 bg-[#f1f5f9]';
  const pageContentClass =
    'mx-auto w-full max-w-none min-w-0 space-y-6 px-1 pt-3 pb-3 sm:px-1.5 sm:pt-4 sm:pb-4 md:px-3';

  if (isLoading || isLoadingMyPRs) {
    return (
      <div className={pageRootClass}>
        <DashboardV3ShimmerBlock className="h-28 w-full" />
        <div className="rounded-[28px] border border-slate-200/60 bg-white/60 p-6 backdrop-blur-sm md:p-8">
          <div className="mb-6 h-5 w-56 rounded-lg bg-slate-200/90" />
          <div className="space-y-4">
            <div className={departmentHeadKpiGridManagerClass}>
              <DashboardV3ShimmerBlock className="h-28" />
              <DashboardV3ShimmerBlock className="h-28" />
              <DashboardV3ShimmerBlock className="h-28" />
            </div>
            <div className={departmentHeadKpiGridRequestorClass}>
              <DashboardV3ShimmerBlock className="h-28" />
              <DashboardV3ShimmerBlock className="h-28" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={pageRootClass}>
        <div className="rounded-[28px] border border-rose-200/90 bg-rose-50/95 p-6 shadow-[0_20px_25px_-5px_rgba(239,68,68,0.12)] md:p-8">
          <p className="text-lg font-bold text-rose-900">Lỗi khi tải dữ liệu</p>
          <p className="mt-2 text-sm font-medium text-rose-800/90">
            {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
          </p>
        </div>
      </div>
    );
  }

  const metrics = calculateMetrics();
  const pendingPRsForApproval = getPendingPRsForApproval();
  const returnedPRsNotFixed = getReturnedPRsNotFixed();
  const pendingPRsOver7Days = getPendingPRsOverDays(7);

  return (
    <div className={pageRootClass}>
      <div className={pageContentClass}>
        <div className="shrink-0 pb-2">
          <DepartmentPageHero
            kicker="Trưởng phòng · Trang chủ"
            title="Dashboard Trưởng phòng"
            description="Tổng quan công việc của bạn ở cả 2 vai trò: Trưởng phòng (Duyệt PR) và Requestor (Tạo PR)"
            Icon={ClipboardCheck}
            tint="azure"
            regionLabel="Dashboard Trưởng phòng"
          />
        </div>

        <article
          className={`${dashboardV3IslandClass} ${dashboardV3IslandOpaqueClass} ${departmentHeadKpiIslandPaddingClass} space-y-5 slide-right-content`}
        >
          <SectionHeader
            Icon={Sparkles}
            eyebrow="Cốt lõi"
            title="Chỉ số nhanh"
          />

          <div className="space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Vai trò duyệt PR (quản lý)
            </p>
            <div className={departmentHeadKpiGridManagerClass}>
              <StatCard
                variant="bento"
                embedded
                activity={kpiActivity(metrics.pendingForApproval)}
                accent="amber"
                Icon={ClipboardCheck}
                label="PR chờ duyệt"
                value={metrics.pendingForApproval}
                unit="PR"
                hint="Nhân viên có direct manager = bạn; không gồm PR do chính bạn tạo."
                onClick={() => navigate('/dashboard/department-head/pr-approval')}
              />
              <StatCard
                variant="bento"
                embedded
                activity={kpiActivity(metrics.approvedLast30d)}
                accent="emerald"
                Icon={CheckCircle2}
                label="Đã duyệt (30 ngày)"
                value={metrics.approvedLast30d}
                unit="PR"
                hint="Số lần bạn phê duyệt PR trong 30 ngày gần nhất."
              />
              <StatCard
                variant="bento"
                embedded
                activity={kpiActivity(metrics.rejectedLast30d)}
                accent="rose"
                Icon={XCircle}
                label="Từ chối / trả (30 ngày)"
                value={metrics.rejectedLast30d}
                unit="PR"
                hint="Số lần bạn từ chối hoặc trả PR trong 30 ngày gần nhất."
              />
            </div>
          </div>

          <div className="space-y-2.5 border-t border-slate-200/80 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Vai trò Requestor (PR của tôi)
            </p>
            <div className={departmentHeadKpiGridRequestorClass}>
              <StatCard
                variant="bento"
                embedded
                activity={kpiActivity(metrics.myPRsThisMonth)}
                accent="indigo"
                Icon={FilePlus}
                label="PR tạo trong tháng"
                value={metrics.myPRsThisMonth}
                unit="PR"
                hint="PR do bạn tạo trong tháng hiện tại."
                onClick={() => navigate('/dashboard/department-head/my-prs')}
              />
              <StatCard
                variant="bento"
                embedded
                activity={kpiActivity(metrics.returnedPRs)}
                accent="amber"
                Icon={AlertCircle}
                label="Cần bổ sung / bị trả"
                value={metrics.returnedPRs}
                unit="PR"
                hint="PR của bạn đang bị trả hoặc cần thêm thông tin."
                onClick={() => navigate('/dashboard/department-head/my-prs')}
              />
            </div>
          </div>
        </article>

        <article className={`${dashboardV3IslandClass} space-y-6 slide-right-content`}>
          <SectionHeader
            Icon={ClipboardCheck}
            eyebrow="Hàng đợi"
            title="Hàng đợi duyệt"
            description="PR phòng ban cần bạn duyệt — bấm dòng để mở màn hình phê duyệt."
          />
        <div className={`${departmentHeadDataTableCardClass} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-100 bg-[#F8FAFC] px-4 py-3 sm:px-6 sm:py-3.5">
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{pendingPRsForApproval.length}</span> PR trong hàng đợi
            </p>
              <button
                type="button"
                onClick={() => navigate('/dashboard/department-head/pr-approval')}
                className={`${dashboardV3CtaLinkClass} px-4 py-2 text-xs sm:text-sm`}
              >
                Xem tất cả
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </button>
          </div>
          <div className={pendingPRsForApproval.length > 0 ? departmentHeadListTableScrollClass : 'min-w-0'}>
            {pendingPRsForApproval.length > 0 ? (
              <table className={`${departmentHeadInteractiveTableClass} ${saasTableRootClass} min-w-[1260px] whitespace-nowrap`}>
                <thead className="sticky top-0 z-10 border-b border-slate-100 bg-[#F8FAFC]">
                  <tr>
                    <th className={`px-6 py-3.5 text-left ${saasTableHeadCellClass}`}>Mã PR</th>
                    <th className={`min-w-[180px] px-6 py-3.5 text-left ${saasTableHeadCellClass}`}>SO / dự án</th>
                    <th className={`px-6 py-3.5 text-left ${saasTableHeadCellClass}`}>Người yêu cầu</th>
                    <th className={`px-6 py-3.5 text-left ${saasTableHeadCellClass}`}>Loại PR</th>
                    <th className={`px-6 py-3.5 text-left ${saasTableHeadCellClass}`}>Tổng giá đề xuất</th>
                    <th className={`px-6 py-3.5 text-left ${saasTableHeadCellClass}`}>Ngày gửi</th>
                    <th className={`px-6 py-3.5 text-left ${saasTableHeadCellClass}`}>Trạng thái</th>
                    <th className={`border-l border-slate-200 px-6 py-3.5 text-right ${saasTableHeadCellClass}`}>Thao tác</th>
                  </tr>
                </thead>
                <tbody className={departmentHeadTableTbodyElevatedClass}>
                  {pendingPRsForApproval.map((pr: any, index: number) => (
                    <tr
                      key={pr.id}
                      onClick={() => handlePRRowClick(pr.id)}
                      className={`slide-right-item transition-colors-theme ${departmentHeadDashboardDataRowInteractive(index)}`}
                      style={{ animationDelay: `${0.1 + index * 0.03}s` }}
                    >
                      <td className="relative px-6 py-4 whitespace-nowrap">
                        <div aria-hidden className={departmentHeadTableAccentRailClass} />
                        <div
                          className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="rounded-md bg-amber-100/50 p-1.5">
                              <FileText className="h-4 w-4 text-amber-600" strokeWidth={2} />
                            </div>
                            <span className="text-sm font-bold text-slate-900">{pr.prNumber}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top whitespace-nowrap">
                        <div className={`${departmentHeadTableCellContentWrapClass} whitespace-nowrap`}>
                          <PRSalesOrderLine salesOrder={pr.salesOrder} showWhenEmpty />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`${departmentHeadTableCellContentWrapClass} whitespace-nowrap`}>
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <User className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                            <span>{pr.requestor?.username || 'N/A'}</span>
                            <span className="text-slate-300">|</span>
                            <Building2 className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                            <span className="text-slate-500">{pr.department || '-'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`${departmentHeadTableCellContentWrapClass} whitespace-nowrap`}>
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Package className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                            <span>{getPRTypeLabel(pr)}</span>
                            <span className="text-slate-300">|</span>
                            <Sparkles className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                            <span className="text-xs text-slate-500">{pr.itemCount || 0} mặt hàng</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={departmentHeadTableCellContentWrapClass}>
                          {pr.totalAmount ? (
                            <div>
                              <span className="text-sm font-bold text-slate-900">
                                {formatCurrency(pr.totalAmount, pr.currency)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400 italic">Chưa có</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`${departmentHeadTableCellContentWrapClass} whitespace-nowrap`}>
                          <div className="flex items-center gap-2 font-medium tabular-nums text-slate-700">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                            <span>{formatDate(pr.createdAt)}</span>
                            <span className="text-slate-300">|</span>
                            <Clock className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                            <span className="text-[11px] text-slate-400">{getDaysPending(pr.createdAt)} ngày trước</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={departmentHeadTableCellContentWrapClass}>
                          <span
                            className={
                              pr.status
                                ? saasPrStatusBadgeClass(String(pr.status))
                                : SAAS_BADGE_BY_TONE.warning
                            }
                          >
                            {pr.status ? saasPrStatusLabel(String(pr.status)) : 'Chờ phê duyệt'}
                          </span>
                        </div>
                      </td>
                      <td
                        className="border-l border-slate-100 px-4 py-4 whitespace-nowrap text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          className={`${departmentHeadTableCellContentWrapFlexClass} ml-auto justify-end`}
                        >
                          <div className={departmentHeadTableActionClusterClass}>
                            <button
                              type="button"
                              className={saasTableIconBtnView}
                              title="Mở phê duyệt"
                              aria-label="Mở phê duyệt"
                              onClick={() => handlePRRowClick(pr.id)}
                            >
                              <Eye className="h-4 w-4" strokeWidth={2} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
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
        </article>

        {(returnedPRsNotFixed.length > 0 || pendingPRsOver7Days.length > 0) && (
          <article className={`${dashboardV3IslandClass} space-y-6 slide-right-content`}>
            <SectionHeader
              Icon={AlertCircle}
              eyebrow="Cảnh báo"
              title="Cảnh báo & theo dõi"
              description="PR trả về chưa xử lý và hồ sơ tồn quá lâu trong hàng đợi phòng ban."
            />
            <div className="space-y-6">
              {/* PR bị trả nhưng Requestor chưa sửa */}
              {returnedPRsNotFixed.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-amber-600" strokeWidth={2} />
                    <h3 className="text-sm font-semibold text-slate-800">
                      PR bị trả nhưng chưa sửa ({returnedPRsNotFixed.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {returnedPRsNotFixed.slice(0, 6).map((pr: any, index: number) => (
                        <div
                          key={pr.id}
                          onClick={() => handleViewPRDetails(pr.id)}
                          className="slide-right-item cursor-pointer rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-colors duration-200 hover:bg-slate-50/70"
                          style={{ animationDelay: `${0.3 + index * 0.03}s` }}
                        >
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <span className="text-sm font-bold tracking-[-0.01em] text-amber-900 tabular-nums">
                              {pr.prNumber}
                            </span>
                            <span className={`shrink-0 ${saasPrStatusBadgeClass(pr.status)}`}>
                              {saasPrStatusLabel(pr.status)}
                            </span>
                          </div>
                          <p className="mb-1 line-clamp-1 text-xs text-slate-700">{pr.itemName || pr.department || 'Chưa có mô tả'}</p>
                          <p className="text-xs text-slate-500">Bị trả: {formatDate(pr.updatedAt || pr.createdAt)}</p>
                        </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PR phòng ban tồn > 7 ngày */}
              {pendingPRsOver7Days.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-rose-600" strokeWidth={2} />
                    <h3 className="text-sm font-semibold text-slate-800">
                      PR phòng ban tồn trên 7 ngày ({pendingPRsOver7Days.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {pendingPRsOver7Days.slice(0, 6).map((pr: any, index: number) => (
                      <div
                        key={pr.id}
                        onClick={() => handlePRRowClick(pr.id)}
                        className="slide-right-item cursor-pointer rounded-xl border border-slate-100 bg-white p-4 shadow-sm ring-1 ring-rose-100/60 transition-colors duration-200 hover:bg-rose-50/40"
                        style={{ animationDelay: `${0.4 + index * 0.03}s` }}
                      >
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <span className="text-sm font-bold text-rose-900">{pr.prNumber}</span>
                          <span className="shrink-0 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800 ring-1 ring-rose-100">
                            {getDaysPending(pr.createdAt)} ngày
                          </span>
                        </div>
                        <p className="mb-1 text-xs text-slate-700">{pr.requestor?.username || 'N/A'}</p>
                        <p className="text-xs text-slate-500">Gửi: {formatDate(pr.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </article>
        )}
        <div className="h-3 sm:h-4" aria-hidden />
      {/* PR Details Modal — portal ra body: overlay full viewport, không bị cắt bởi main cuộn */}
      {isDetailModalOpen &&
        selectedPRId &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-white"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dh-pr-detail-modal-title"
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-6 sm:pb-5 sm:pt-5">
              <div>
                <h2 id="dh-pr-detail-modal-title" className="text-xl font-bold text-slate-900">
                  Chi tiết Yêu cầu Mua hàng
                </h2>
                {prDetails && (
                  <p className="text-sm text-slate-600 mt-1">
                    Mã PR: <span className="font-semibold text-blue-600">{prDetails.prNumber}</span>
                  </p>
                )}
              </div>
              <button
                onClick={handleCloseDetailModal}
                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                type="button"
              >
                <X className="w-5 h-5 text-slate-600" strokeWidth={2} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 scrollbar-hide pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-3">
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
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Package className="w-4.5 h-4.5 text-indigo-600" strokeWidth={2} />
                          Danh sách hàng hóa
                        </h3>
                        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                          {prDetails.items.length} dòng
                        </span>
                      </div>
                      <div className="h-[484px] overflow-auto [scrollbar-width:thin]">
                        <table className="w-full min-w-[980px]">
                          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-gradient-to-r from-slate-100 to-slate-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">STT</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Mô tả</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Số lượng</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Đơn vị</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Nguồn cấp</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Mục đích</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {prDetails.items.map((item: any, index: number) => (
                              <tr
                                key={item.id || index}
                                className="border-b border-slate-100 bg-white transition-colors last:border-b-0 hover:[&>td]:bg-indigo-50/40"
                              >
                                <td className="px-4 py-3 text-sm font-semibold text-slate-900">{item.lineNo || index + 1}</td>
                                <td className="px-4 py-3 text-sm text-slate-700">{item.description || '-'}</td>
                                <td className="px-4 py-3 text-sm text-slate-900">{item.qty || '-'}</td>
                                <td className="px-4 py-3 text-sm text-slate-700">{item.unit || '-'}</td>
                                <td className="px-4 py-3 text-sm text-slate-700">
                                  {(item.sourceStatus === 'FROM_STOCK' || item.status === 'FROM_STOCK') ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                                      <Package className="h-3.5 w-3.5" strokeWidth={2} />
                                      Dùng kho ({item.fromStockQty ?? 0})
                                    </span>
                                  ) : (item.sourceStatus === 'NEED_PURCHASE' || item.status === 'NEED_PURCHASE') ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                                      <AlertCircle className="h-3.5 w-3.5" strokeWidth={2} />
                                      Cần mua ({item.purchaseQty ?? 0})
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                                      <Info className="h-3.5 w-3.5" strokeWidth={2} />
                                      Chưa xác định
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700">{item.purpose || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
};

export default DashboardHome;

