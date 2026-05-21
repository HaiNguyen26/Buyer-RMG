import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useCreatePRConfirm } from '../../hooks/useCreatePRConfirm';
import { useIntersectionVisible } from '../../hooks/useIntersectionVisible';
import { useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { requestorService } from '../../services/requestorService';
import { FileText, AlertCircle, CheckCircle, Clock, Plus, ShoppingCart, FileEdit, Send, CheckCircle2, XCircle, ArrowLeftRight, XOctagon, UserCheck, FileCheck, Wallet, TrendingUp, TrendingDown, X, Building2, User, Calendar, DollarSign, Package, Info, LayoutDashboard, PenLine, Sparkles, Zap, History } from 'lucide-react';
import { PRSalesOrderLine } from '../../components/PRSalesOrderLine';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import { requestorPageStackClass } from '../../constants/requestorLayout';
import { dataTableScrollWindowSingleClass, dataTableWideMinWidthClass } from '../../constants/dataTableLayout';
import { aggregatePrStatusStack } from '../../utils/prStatusChartBuckets';
import {
  BRANCH_OVERVIEW_CHART_DURATION_MS,
  DONUT_ANIMATION_EASING,
  DONUT_CORNER_RADIUS,
} from '../../utils/rechartsDonut';
import { getPrTypeSliceColor } from '../../utils/prTypeChartColors';

const REQUESTOR_ANALYSIS_CHART_TRANSITION =
  'transition-all duration-700 ease-out motion-reduce:transform-none motion-reduce:transition-none motion-reduce:opacity-100';

/** ~40% diện tích card nằm trong vùng cuộn mới bật reveal + animation (tránh chạy khi mới ló mép). */
const REQUESTOR_ANALYSIS_IO = {
  rootMargin: '0px',
  resetWhenOutOfView: true,
  minIntersectionRatio: 0.4,
} as const;

function isRequestorItemFromStock(item: { status?: string; sourceStatus?: string }) {
  return (
    String(item?.sourceStatus || '').toUpperCase() === 'FROM_STOCK' ||
    String(item?.status || '').toUpperCase() === 'FROM_STOCK'
  );
}

function isRequestorItemNeedPurchase(item: { status?: string; sourceStatus?: string }) {
  return (
    String(item?.sourceStatus || '').toUpperCase() === 'NEED_PURCHASE' ||
    String(item?.status || '').toUpperCase() === 'NEED_PURCHASE'
  );
}

function RequestorItemSourceBadge({ item }: { item: Record<string, unknown> }) {
  if (isRequestorItemFromStock(item)) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
        Kho
      </span>
    );
  }
  if (isRequestorItemNeedPurchase(item)) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
        Mua
      </span>
    );
  }
  return <span className="text-slate-400">—</span>;
}

function RequestorItemLineStatusCell({ item }: { item: Record<string, unknown> }) {
  if (isRequestorItemFromStock(item)) {
    return <span className="text-xs text-slate-600">Tách kho</span>;
  }
  if (!isRequestorItemNeedPurchase(item)) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const o = item.departmentItemOutcome as string | null | undefined;
  const note = item.departmentDecisionNote as string | null | undefined;
  const submitted = !!(item as { departmentRevisionSubmittedAt?: string | null }).departmentRevisionSubmittedAt;

  let main: ReactNode;
  if (o === 'REJECTED') {
    main = <span className="font-semibold text-rose-700">Từ chối</span>;
  } else if (o === 'REVISION_REQUIRED') {
    main = submitted ? (
      <span className="font-semibold text-indigo-700">Chờ duyệt lại</span>
    ) : (
      <span className="font-semibold text-amber-800">Cần chỉnh sửa</span>
    );
  } else if (o === 'APPROVED') {
    main = <span className="font-semibold text-emerald-700">Đã duyệt</span>;
  } else if (o === 'ON_HOLD') {
    main = <span className="text-slate-600">Tạm hoãn</span>;
  } else {
    main = <span className="text-slate-400">Chờ Trưởng phòng</span>;
  }

  return (
    <div className="max-w-[11rem] text-xs text-slate-600">
      {main}
      {note ? (
        <p className="mt-1 line-clamp-2 text-[10px] text-slate-500" title={note}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

const DashboardHome = () => {
  const navigate = useNavigate();
  const { requestCreatePR, createPRConfirmModal } = useCreatePRConfirm();
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const typeChartCardRef = useRef<HTMLElement | null>(null);
  const monthChartCardRef = useRef<HTMLElement | null>(null);
  const statusTrendCardRef = useRef<HTMLElement | null>(null);

  const { isIntersecting: typeChartVisible, generation: typeChartGeneration } = useIntersectionVisible(
    typeChartCardRef,
    REQUESTOR_ANALYSIS_IO,
  );
  const { isIntersecting: monthChartVisible, generation: monthChartGeneration } = useIntersectionVisible(
    monthChartCardRef,
    REQUESTOR_ANALYSIS_IO,
  );
  const { isIntersecting: statusTrendVisible, generation: statusTrendGeneration } = useIntersectionVisible(
    statusTrendCardRef,
    REQUESTOR_ANALYSIS_IO,
  );
  const { data: dashboardQueryData, isLoading, error } = useQuery({
    queryKey: ['requestor-dashboard'],
    queryFn: () => requestorService.getDashboard(),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const dashboardData = dashboardQueryData;

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
      <div className="flex min-h-[50vh] items-center justify-center py-16">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 max-w-md">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  const metrics = calculateMetrics();

  const typeColorExtras = ['#0ea5e9', '#8b5cf6', '#ec4899', '#64748b'] as const;
  const typeChartData = (dashboardData?.prsByType ?? [])
    .map((item: any, index: number) => {
      const name = item.type || item.typeKey || 'Khác';
      return {
        name,
        value: item.count || 0,
        color: getPrTypeSliceColor(String(name), index, typeColorExtras),
      };
    })
    .filter((d: { value: number }) => d.value > 0);

  const monthChartData = (dashboardData?.prsByMonth ?? []).map((item: any, index: number) => ({
    name: item.label || item.monthKey,
    value: item.count || 0,
    color: `hsl(${(index * 47) % 360}, 55%, 52%)`,
  }));

  const statusStackData = aggregatePrStatusStack(
    (dashboardData?.prsByStatus ?? []).map((item: any) => ({
      statusCode: item.status,
      count: item.count || 0,
    }))
  );

  const statusStackRow = statusStackData[0];
  const statusStackTotal =
    (statusStackRow?.moi ?? 0) + (statusStackRow?.cho ?? 0) + (statusStackRow?.hoanTat ?? 0) + (statusStackRow?.huy ?? 0);
  const statusTrendData = [
    { name: 'Mới/Nháp', value: statusStackRow?.moi ?? 0 },
    { name: 'Đang xử lý', value: statusStackRow?.cho ?? 0 },
    { name: 'Hoàn tất', value: statusStackRow?.hoanTat ?? 0 },
    { name: 'Hủy/Từ chối', value: statusStackRow?.huy ?? 0 },
  ];

  const totalOverviewPRs = dashboardData?.totalPRs ?? 0;
  /** Px — Recharts 3 + ResponsiveContainer: chuỗi % có thể không vẽ; giữ nhỏ hơn 125 để khớp legend */
  const donutOuterPx = 82;
  const donutInnerPx = 56;
  const monthBarHeight = Math.min(360, Math.max(140, monthChartData.length * 32 + 48));

  const typeChartBodyClass = `${REQUESTOR_ANALYSIS_CHART_TRANSITION} ${
    typeChartVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
  }`;
  const monthChartBodyClass = `${REQUESTOR_ANALYSIS_CHART_TRANSITION} ${
    monthChartVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
  }`;
  const statusTrendBodyClass = `${REQUESTOR_ANALYSIS_CHART_TRANSITION} ${
    statusTrendVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
  }`;
  const statusAreaGradId =
    statusTrendGeneration > 0 ? `requestorStatusArea-${statusTrendGeneration}` : 'requestorStatusArea-prelude';

  const hasOverviewCharts =
    typeChartData.length > 0 ||
    monthChartData.length > 0 ||
    !!(dashboardData?.prsByStatus && dashboardData.prsByStatus.length > 0);

  const actionRequiredPRs = getActionRequiredPRs();
  const cardBaseClass = 'rounded-2xl border border-slate-200 bg-white ring-1 ring-slate-900/5 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.35)]';
  const cardHoverClass = '';
  const analysisCardClass =
    'relative overflow-hidden rounded-3xl border border-slate-200/85 bg-white ring-1 ring-slate-900/5 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.45)]';
  const summaryBaseline = Math.max(
    totalOverviewPRs,
    metrics.totalPRThisMonth,
    metrics.waitingApproval,
    metrics.returnedPR,
    metrics.inPurchasing,
    1
  );
  const summaryCards = [
    {
      key: 'total',
      title: 'Tổng quan',
      value: metrics.totalPRThisMonth,
      description: 'Tổng PR bạn đã tạo trong tháng này',
      icon: Sparkles,
      trendIcon: TrendingUp,
      trendLabel: 'Nội dung mới',
      iconBg: 'bg-[#EEF2FF]',
      iconText: 'text-[#4F46E5]',
      border: 'border-indigo-100',
      bar: 'bg-[#4F46E5]',
      ornament: 'bg-indigo-200/30',
    },
    {
      key: 'waiting',
      title: 'Chờ duyệt',
      value: metrics.waitingApproval,
      description: 'Các PR đang ở các bước phê duyệt',
      icon: Zap,
      trendIcon: TrendingUp,
      trendLabel: 'Cần xử lý',
      iconBg: 'bg-[#FFFBEB]',
      iconText: 'text-[#D97706]',
      border: 'border-amber-100',
      bar: 'bg-[#D97706]',
      ornament: 'bg-amber-200/30',
    },
    {
      key: 'returned',
      title: 'PR trả về',
      value: metrics.returnedPR,
      description: 'Các PR bị trả về cần cập nhật',
      icon: History,
      trendIcon: TrendingDown,
      trendLabel: 'Cần rà soát',
      iconBg: 'bg-[#FFF1F2]',
      iconText: 'text-[#E11D48]',
      border: 'border-rose-100',
      bar: 'bg-[#E11D48]',
      ornament: 'bg-rose-200/30',
    },
    {
      key: 'purchasing',
      title: 'Đang mua',
      value: metrics.inPurchasing,
      description: 'PR đã qua duyệt và đang mua hàng',
      icon: Package,
      trendIcon: TrendingUp,
      trendLabel: 'Đang tiến hành',
      iconBg: 'bg-[#F0FDFA]',
      iconText: 'text-[#0D9488]',
      border: 'border-teal-100',
      bar: 'bg-[#0D9488]',
      ornament: 'bg-teal-200/30',
    },
  ] as const;

  return (
    <>
      {/* Cuộn trên <main>; padding đáy do main + outlet — không chồng pb lớn ở đây */}
      <div className="w-full min-h-full bg-[#f1f5f9]">
        <div className="mx-auto w-full max-w-[1800px] space-y-6 px-2 pt-3 pb-2 sm:px-3 sm:pt-4 sm:pb-3 md:px-6">
          <RequestorPageHero
            kicker="Requestor · Trang chủ"
            title="Tổng quan PR"
            description="Theo dõi yêu cầu mua hàng, trạng thái duyệt và tiến độ mua hàng — chỉ số tháng này và PR gần đây."
            Icon={LayoutDashboard}
            tint="graphite"
            regionLabel="Tổng quan PR"
            rightSlot={
              <>
                <div className="min-w-[5.5rem] rounded-xl border border-white/25 bg-white/10 px-2.5 py-2 shadow-sm backdrop-blur-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/65">Tháng này</p>
                  <p className="text-lg font-bold tabular-nums leading-tight text-white">{metrics.totalPRThisMonth}</p>
                  <p className="text-[10px] leading-tight text-white/70">PR đã tạo</p>
                </div>
                <button
                  type="button"
                  onClick={() => requestCreatePR('/dashboard/requestor/pr/create')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#F97316] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#EA580C] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                  Tạo PR mới
                </button>
              </>
            }
          />
          {actionRequiredPRs.length > 0 && (
            <section className={`${cardBaseClass} p-4 sm:p-6`}>
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-red-100 p-2">
                  <AlertCircle className="h-5 w-5 text-red-600" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Hành động cần thực hiện</h3>
                  <p className="text-sm text-slate-500">{actionRequiredPRs.length} PR cần bạn xử lý</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {actionRequiredPRs.map((pr: any) => (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => handleViewPRDetails(pr.id)}
                    className={`text-left ${cardBaseClass} ${cardHoverClass} p-4`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{pr.prNumber}</span>
                      <span className="rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Cần bổ sung</span>
                    </div>
                    <p className="line-clamp-2 text-sm text-slate-600">{pr.itemName || '-'}</p>
                    {pr.notes ? <p className="mt-2 text-xs text-red-600">{pr.notes}</p> : null}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="grid min-w-0 grid-cols-1 gap-6 bg-[#f1f5f9] md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              const TrendIcon = card.trendIcon;
              const progress = Math.max(4, Math.min(100, Math.round((card.value / summaryBaseline) * 100)));
              return (
                <article
                  key={card.key}
                  className={`group relative overflow-hidden rounded-[2rem] border bg-white p-5 shadow-[0_14px_24px_-20px_rgba(15,23,42,0.35)] transition-all duration-300 hover:-translate-y-1 ${card.border}`}
                >
                  <div className={`pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-150 ${card.ornament}`} />
                  <div className="relative mb-4 flex items-center justify-between gap-3">
                    <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.iconBg}`}>
                      <Icon className={`h-5 w-5 ${card.iconText}`} strokeWidth={2.5} />
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                      <TrendIcon className="h-3 w-3" strokeWidth={2.5} />
                      {card.trendLabel}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-500">{card.title}</p>
                  <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900">{card.value}</p>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-500">{card.description}</p>
                  <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${card.bar}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </article>
              );
            })}
          </section>

          <section className={`${cardBaseClass} relative overflow-visible p-4 sm:p-6`}>
            {/* Không dùng overflow-x-clip + blob blur tràn viền — dễ lộ “mù” và mép cắt dọc lệch nền wrapper */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-1 rounded-t-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500" />
            <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md ring-4 ring-blue-100/70">
                  <TrendingUp className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Phân tích PR</h3>
                  <p className="text-xs text-slate-500 sm:text-sm">Toan canh du lieu PR theo cau truc, nhịp thang va trang thai xu ly.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-100/80 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-blue-700 shadow-sm backdrop-blur">
                  <FileText className="h-3.5 w-3.5" strokeWidth={2} />
                  {totalOverviewPRs} PR
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-100/80 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 shadow-sm backdrop-blur">
                  <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
                  {monthChartData.length} thang du lieu
                </span>
              </div>
            </div>
            {!hasOverviewCharts ? (
              <div className="py-8 text-center text-slate-500">
                <FileText className="mx-auto mb-2 h-12 w-12 text-slate-300" strokeWidth={1.5} />
                <p className="text-sm">Chưa có dữ liệu để hiển thị</p>
              </div>
            ) : (
              <div className="relative min-w-0 space-y-6">
                <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
                  <div
                    ref={typeChartCardRef}
                    className={`${analysisCardClass} min-w-0 overflow-visible bg-gradient-to-br from-white via-blue-50/35 to-indigo-50/20`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100/90 px-4 py-3.5 sm:px-5">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                          <FileText className="h-4 w-4" strokeWidth={2.2} />
                        </span>
                        <h4 className="text-sm font-semibold text-slate-900">PR theo loại</h4>
                      </div>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">Donut</span>
                    </div>
                    {typeChartData.length > 0 ? (
                      <div className="w-full min-w-0 px-2 pb-1 pt-2 sm:px-3">
                        {/* Key gắn generation (không Math.max): 0→1 khi reveal → remount để Recharts chạy animation xoay lần đầu */}
                        <div className={`h-[280px] w-full min-w-0 ${typeChartBodyClass}`}>
                          <ResponsiveContainer
                            width="100%"
                            height="100%"
                            key={`req-donut-${typeChartGeneration}`}
                          >
                            <PieChart margin={{ top: 8, right: 8, bottom: 52, left: 8 }}>
                              <Pie
                                data={typeChartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="48%"
                                innerRadius={donutInnerPx}
                                outerRadius={donutOuterPx}
                                paddingAngle={8}
                                cornerRadius={Math.min(12, DONUT_CORNER_RADIUS)}
                                stroke="transparent"
                                strokeWidth={0}
                                isAnimationActive={typeChartVisible}
                                animationBegin={40}
                                animationDuration={BRANCH_OVERVIEW_CHART_DURATION_MS}
                                animationEasing={DONUT_ANIMATION_EASING}
                              >
                                {typeChartData.map((entry, index) => (
                                  <Cell key={`req-type-${typeChartGeneration}-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend
                                verticalAlign="bottom"
                                align="center"
                                layout="horizontal"
                                wrapperStyle={{
                                  fontSize: '0.7rem',
                                  paddingTop: 4,
                                  lineHeight: 1.35,
                                  width: '100%',
                                }}
                                iconType="circle"
                                iconSize={7}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="border-t border-slate-100/90 pt-3 pb-3 text-center text-sm font-semibold text-blue-600">
                          Tổng {totalOverviewPRs} PR
                        </p>
                      </div>
                    ) : (
                      <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-500">
                        Chưa có dữ liệu theo loại
                      </div>
                    )}
                  </div>

                  <div
                    ref={monthChartCardRef}
                    className={`${analysisCardClass} min-w-0 bg-gradient-to-br from-white via-indigo-50/35 to-violet-50/20`}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100/90 px-4 py-3.5 sm:px-5">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                          <Calendar className="h-4 w-4" strokeWidth={2.2} />
                        </span>
                        <h4 className="text-sm font-semibold text-slate-900">PR theo tháng</h4>
                      </div>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">Bar</span>
                    </div>
                    {monthChartData.length > 0 ? (
                      <div className="w-full min-w-0 px-2 pb-4 pt-2 sm:px-3">
                        <div className={`min-w-0 ${monthChartBodyClass}`} style={{ height: monthBarHeight + 12 }}>
                          <ResponsiveContainer
                            width="100%"
                            height="100%"
                            key={`req-month-${monthChartGeneration}`}
                          >
                            <BarChart layout="vertical" data={monthChartData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.65} horizontal={false} vertical />
                              <XAxis type="number" hide />
                              <YAxis
                                type="category"
                                dataKey="name"
                                width={110}
                                tick={{ fontSize: 11, fill: '#334155' }}
                                interval={0}
                                tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 14)}…` : v)}
                              />
                              <Tooltip cursor={false} formatter={(v: number) => [`${v} PR`, 'Số lượng']} />
                              <Bar
                                dataKey="value"
                                radius={[0, 10, 10, 0]}
                                maxBarSize={12}
                                isAnimationActive={monthChartVisible}
                                animationDuration={BRANCH_OVERVIEW_CHART_DURATION_MS}
                                animationEasing={DONUT_ANIMATION_EASING}
                              >
                                {monthChartData.map((entry, index) => (
                                  <Cell key={`req-mo-${monthChartGeneration}-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-72 items-center justify-center text-sm text-slate-500">Chưa có dữ liệu theo tháng</div>
                    )}
                  </div>
                </div>

                <div
                  ref={statusTrendCardRef}
                  className={`${analysisCardClass} min-w-0 bg-gradient-to-br from-white via-cyan-50/30 to-blue-50/15`}
                >
                  <div className="flex items-center justify-between border-b border-slate-100/90 px-4 py-3.5 sm:px-5">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                        <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900">Xu hướng trạng thái PR</h4>
                    </div>
                    <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">Area</span>
                  </div>
                  {dashboardData?.prsByStatus && dashboardData.prsByStatus.length > 0 ? (
                    <div className="w-full min-w-0 px-2 pb-4 pt-2 sm:px-3">
                      <div className={`h-64 w-full min-w-0 ${statusTrendBodyClass}`}>
                        <ResponsiveContainer
                          width="100%"
                          height="100%"
                          key={`req-status-${statusTrendGeneration}`}
                        >
                          <AreaChart data={statusTrendData} margin={{ top: 12, right: 12, left: 8, bottom: 8 }}>
                            <defs>
                              <linearGradient id={statusAreaGradId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                            <YAxis
                              tick={{ fontSize: 11, fill: '#64748b' }}
                              allowDecimals={false}
                              domain={[0, 'auto']}
                            />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const raw = Number(payload[0]?.value ?? 0);
                                const pct = statusStackTotal > 0 ? ((raw / statusStackTotal) * 100).toFixed(1) : '0';
                                return (
                                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
                                    <p className="mb-1 font-semibold text-slate-800">{String(label)}</p>
                                    <p className="text-slate-600">{raw} PR ({pct}%)</p>
                                  </div>
                                );
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="#2563eb"
                              strokeWidth={2.5}
                              fill={`url(#${statusAreaGradId})`}
                              baseValue={0}
                              dot={false}
                              activeDot={{ r: 4, strokeWidth: 0, fill: '#1d4ed8' }}
                              isAnimationActive={statusTrendVisible}
                              animationBegin={80}
                              animationDuration={BRANCH_OVERVIEW_CHART_DURATION_MS}
                              animationEasing={DONUT_ANIMATION_EASING}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-64 items-center justify-center text-sm text-slate-500">Chưa có dữ liệu trạng thái</div>
                  )}
                </div>
              </div>
            )}
          </section>

          {dashboardData?.recentPRs && dashboardData.recentPRs.length > 0 ? (
            <section className={`${cardBaseClass} overflow-hidden`}>
              <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 backdrop-blur-sm sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-blue-100 p-2">
                      <FileText className="h-5 w-5 text-blue-600" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 sm:text-lg">PR đang hoạt động</h3>
                      <p className="text-sm text-slate-500">{dashboardData.recentPRs.length} PR</p>
                    </div>
                  </div>
                  <button
                    onClick={() => requestCreatePR('/dashboard/requestor/pr/create')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:bg-orange-600 hover:shadow-xl"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2} />
                    Tạo PR mới
                  </button>
                </div>
              </div>

              <div className={`overflow-x-auto ${dataTableScrollWindowSingleClass}`}>
                <table className={dataTableWideMinWidthClass}>
                  <thead className="sticky top-0 z-10 border-b-2 border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 lg:px-6">Mã PR</th>
                    <th className="min-w-[160px] px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 lg:px-6 sm:min-w-[180px]">SO / dự án</th>
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 lg:px-6">Tên hàng hóa</th>
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 lg:px-6">Trạng thái</th>
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 lg:px-6">Ngày tạo</th>
                    <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 lg:px-6">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {dashboardData.recentPRs.slice(0, 6).map((pr: any, index: number) => (
                    <tr
                      key={pr.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleViewPRDetails(pr.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleViewPRDetails(pr.id);
                        }
                      }}
                      className="animate-fade-in-right bg-white border-b border-[#E5E7EB] hover:bg-[#F8FAFC] cursor-pointer transition-colors-theme"
                      style={{ animationDelay: `${820 + index * 55}ms` }}
                    >
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-blue-100/50">
                            <FileText className="w-4 h-4 text-blue-600" strokeWidth={2} />
                          </div>
                          <span className="text-sm font-bold text-slate-900">{pr.prNumber}</span>
                        </div>
                      </td>
                      <td className="max-w-[220px] align-top px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
                        <PRSalesOrderLine salesOrder={pr.salesOrder} showWhenEmpty />
                      </td>
                      <td className="px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
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
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
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
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
                        <div className="text-sm font-medium text-slate-600">
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
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          ) : (
            <section className={`${cardBaseClass} p-8 text-center sm:p-12`}>
              <FileText className="mx-auto mb-4 h-16 w-16 text-slate-300" strokeWidth={1.5} />
              <h3 className="mb-2 text-lg font-semibold text-slate-900">Chưa có PR nào</h3>
              <p className="mb-6 text-sm text-slate-500">Bắt đầu tạo yêu cầu mua hàng đầu tiên của bạn</p>
              <button
                onClick={() => requestCreatePR('/dashboard/requestor/pr/create')}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:bg-orange-600 hover:shadow-xl"
              >
                <Plus className="h-5 w-5" strokeWidth={2} />
                Tạo PR mới
              </button>
            </section>
          )}

          <div className="h-4 sm:h-5" aria-hidden="true" />
        </div>
      </div>

      {/* PR Details Modal — portal ra body: overlay full viewport, không cuộn theo <main> */}
      {isDetailModalOpen &&
        selectedPRId &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
            style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(15,23,42,0.6)' }}
            role="presentation"
            onClick={handleCloseDetailModal}
          >
            <div
              className="modal-popup-panel flex max-h-[min(96dvh,100dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl"
              style={{
                boxShadow: '0 32px 64px -12px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.06) inset',
                animation: 'modalZoomIn 0.22s cubic-bezier(0.16,1,0.3,1)',
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="requestor-pr-detail-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
            <style>{`@keyframes modalZoomIn{from{opacity:0;transform:scale(0.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
            {/* Modal Header */}
            <div
              className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/60 px-5 py-4 sm:px-6"
              style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)' }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">
                  Purchase Request
                </p>
                <h2 id="requestor-pr-detail-modal-title" className="mt-0.5 font-mono text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                  {prDetails?.prNumber ?? '—'}
                </h2>
                {prDetails && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeColor(prDetails.status)}`}>
                      {getStatusIcon(prDetails.status)}
                      {getStatusLabel(prDetails.status)}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(prDetails.createdAt)}</span>
                    {prDetails.department && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Building2 className="h-3 w-3" strokeWidth={2} />
                        {prDetails.department}
                      </span>
                    )}
                  </div>
                )}
                {prDetails && (
                  <div className="mt-2">
                    <PRSalesOrderLine salesOrder={prDetails.salesOrder} showWhenEmpty />
                  </div>
                )}
              </div>
              <button
                onClick={handleCloseDetailModal}
                className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-400 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
                type="button"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 [scrollbar-width:thin]">
              {isLoadingPRDetails ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                    <p className="text-sm text-slate-500">Đang tải…</p>
                  </div>
                </div>
              ) : prDetailsError ? (
                <div className="flex items-center justify-center py-16 px-6">
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                    <X className="mx-auto mb-3 h-8 w-8 text-red-500" strokeWidth={2} />
                    <p className="font-semibold text-red-700">Không tải được chi tiết PR</p>
                    <p className="mt-1 text-sm text-red-500">{prDetailsError instanceof Error ? prDetailsError.message : 'Vui lòng thử lại sau'}</p>
                  </div>
                </div>
              ) : prDetails ? (
                <div className="flex flex-col gap-0 md:flex-row md:min-h-full">
                  {/* Main column */}
                  <div className="min-w-0 flex-[3] space-y-4 p-4 sm:p-5 md:border-r md:border-slate-200/60">
                    {/* Insight cards */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-md shadow-blue-500/20">
                        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100">Giá trị PR</p>
                        <p className="mt-1 text-xl font-black tabular-nums leading-tight">
                          {formatCurrency((prDetails as any).totalAmount, (prDetails as any).currency)}
                        </p>
                        <DollarSign className="absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} />
                      </div>
                      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white shadow-md shadow-violet-500/20">
                        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-100">Mục đích</p>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{prDetails.purpose || '—'}</p>
                        <Info className="absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} />
                      </div>
                      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 p-4 text-white shadow-md shadow-amber-500/20">
                        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-100">Ngày cần</p>
                        <p className="mt-1 text-lg font-black leading-tight">{formatDate(prDetails.requiredDate)}</p>
                        <Calendar className="absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} />
                      </div>
                    </div>

                    {(prDetails as any).status === 'BUDGET_EXCEPTION' || (prDetails as any).status === 'BUDGET_APPROVED' || (prDetails as any).status === 'BUDGET_REJECTED' ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-medium text-amber-900">
                          {(prDetails as any).status === 'BUDGET_EXCEPTION'
                            ? 'PR này đang được xem xét do vượt ngân sách'
                            : (prDetails as any).status === 'BUDGET_APPROVED'
                              ? 'PR này đã được GĐ CN chấp nhận vượt ngân sách'
                              : 'PR này đã bị GĐ CN từ chối do vượt ngân sách'}
                        </p>
                      </div>
                    ) : null}

                    {prDetails.purpose && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-500" strokeWidth={2} />
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                            Thông tin mục đích và phạm vi mua sắm
                          </p>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{prDetails.purpose}</p>
                      </div>
                    )}

                    <div className="relative overflow-hidden rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 p-4 shadow-sm shadow-indigo-200/40">
                      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-indigo-200/35 blur-2xl" />
                      <div className="relative">
                        <div className="mb-2 flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-indigo-600" strokeWidth={2} />
                          <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
                            Tổng quan PR phòng ban
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="rounded-lg border border-indigo-100 bg-white/80 px-3 py-2">
                            <p className="text-[11px] font-medium text-slate-500">Phòng ban phụ trách</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-900">{prDetails.department || '—'}</p>
                          </div>
                          <div className="rounded-lg border border-indigo-100 bg-white/80 px-3 py-2">
                            <p className="text-[11px] font-medium text-slate-500">Người yêu cầu</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-900">
                              {(prDetails as any).requestor?.username || '—'}
                            </p>
                          </div>
                          <div className="rounded-lg border border-indigo-100 bg-white/80 px-3 py-2">
                            <p className="text-[11px] font-medium text-slate-500">Ngày tạo PR</p>
                            <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
                              {formatDate(prDetails.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {prDetails.items && prDetails.items.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                          <Package className="h-4 w-4 text-slate-500" strokeWidth={2} />
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                            Danh sách vật tư/dịch vụ ({prDetails.items.length})
                          </h3>
                        </div>
                        <div className="max-h-60 overflow-auto [scrollbar-width:thin]">
                          <table className="w-full min-w-[880px] border-collapse text-sm">
                            <thead className="sticky top-0 bg-slate-50">
                              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-2.5 text-left">STT</th>
                                <th className="px-4 py-2.5 text-left">Mô tả</th>
                                <th className="px-4 py-2.5 text-left">SL</th>
                                <th className="px-4 py-2.5 text-left">ĐVT</th>
                                <th className="px-4 py-2.5 text-left">Nguồn</th>
                                <th className="min-w-[8.5rem] px-4 py-2.5 text-left">Trạng thái dòng</th>
                                <th className="px-4 py-2.5 text-left">Mục đích</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {prDetails.items.map((item: any, index: number) => (
                                <tr key={item.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                                  <td className="px-4 py-2.5 text-xs tabular-nums text-slate-400">{item.lineNo || index + 1}</td>
                                  <td className="px-4 py-2.5 text-slate-700">{item.description || '-'}</td>
                                  <td className="px-4 py-2.5 text-slate-900">{item.qty || '-'}</td>
                                  <td className="px-4 py-2.5 text-slate-700">{item.unit || '-'}</td>
                                  <td className="px-4 py-2.5 align-middle">
                                    <RequestorItemSourceBadge item={item} />
                                  </td>
                                  <td className="px-4 py-2.5 align-top">
                                    <RequestorItemLineStatusCell item={item} />
                                  </td>
                                  <td className="px-4 py-2.5 text-slate-700">{item.purpose || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sidebar */}
                  <div className="flex flex-col gap-4 bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5 md:w-64 md:shrink-0 md:border-t-0">
                    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-800 text-white shadow-lg shadow-indigo-900/30">
                      <div className="border-b border-indigo-700/50 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-300">
                          Thông tin chứng từ
                        </p>
                      </div>
                      <dl className="divide-y divide-indigo-700/30 px-4 py-0 text-sm">
                        {(prDetails as any).requestor && (
                          <div className="flex items-center justify-between gap-2 py-3">
                            <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                              <User className="h-3 w-3" strokeWidth={2} />Người yêu cầu
                            </dt>
                            <dd className="font-semibold text-white">{(prDetails as any).requestor?.username || '—'}</dd>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 py-3">
                          <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                            <Calendar className="h-3 w-3" strokeWidth={2} />Ngày tạo
                          </dt>
                          <dd className="font-semibold tabular-nums text-white">{formatDate(prDetails.createdAt)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2 py-3">
                          <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                            <Building2 className="h-3 w-3" strokeWidth={2} />Phòng ban
                          </dt>
                          <dd className="font-semibold text-white">{prDetails.department || '—'}</dd>
                        </div>
                        <div className="flex flex-col gap-1 py-3">
                          <dt className="text-xs text-indigo-300">Trạng thái</dt>
                          <dd>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
                              {getStatusLabel(prDetails.status)}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="mt-auto flex flex-col gap-2">
                      {(prDetails.status === 'DRAFT' || prDetails.status === 'NEED_MORE_INFO') && (
                        <button
                          onClick={() => {
                            handleCloseDetailModal();
                            navigate(`/dashboard/requestor/pr/${prDetails.id}`);
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
                          type="button"
                        >
                          <PenLine className="h-4 w-4" strokeWidth={2} />
                          Chỉnh sửa PR
                        </button>
                      )}
                      <button
                        onClick={handleCloseDetailModal}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                        type="button"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>,
          document.body
        )}
      {createPRConfirmModal}
    </>
  );
};

export default DashboardHome;

