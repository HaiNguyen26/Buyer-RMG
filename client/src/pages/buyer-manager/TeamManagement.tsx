import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Filter,
  Eye,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  ArrowRightLeft,
  Package,
  Globe,
  Home,
  ShoppingBag,
  BarChart3,
  ClipboardList,
  Crown,
  FileText,
  UserRound,
  X,
  Save,
  Mail,
  ChevronRight,
  LayoutDashboard,
} from 'lucide-react';
import { buyerManagerService } from '../../services/buyerManagerService';
import type { BuyerTeamMember, BuyerWorkloadBand } from '../../services/buyerManagerService';
import { useToast } from '../../contexts/ToastContext';
import CustomSelect from '../../components/CustomSelect';
import { CountUpNumber } from '../../components/dashboard/CountUpNumber';
import { StatCard } from '../../components/buyer-manager/StatCard';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import {
  dashboardPageContentInsetBottomWorkspaceClass,
  dashboardPageContentInsetXClass,
} from '../../constants/dashboardLayout';
import {
  requestorPageStackClass,
  requestorPanelCardClass,
  requestorDataTableCardClass,
  requestorDataTableCardHeaderClass,
} from '../../constants/requestorLayout';

/** Đồng bộ Buyer `DashboardHome` StatCard bento — `h-full` để hàng grid đều cao. */
const teamStatCardEnterClass =
  'h-full animate-fade-in-right motion-reduce:animate-none motion-reduce:!translate-x-0 motion-reduce:!opacity-100';

function memberInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || '?';
}

function inferWorkloadBand(pct: number): BuyerWorkloadBand {
  if (pct > 90) return 'overload';
  if (pct < 40) return 'idle';
  return 'normal';
}

function rowHeatmapClass(band: BuyerWorkloadBand | undefined) {
  if (band === 'overload') return 'border-l-4 border-rose-600 bg-rose-50/35';
  if (band === 'idle') return 'border-l-4 border-emerald-600 bg-emerald-50/30';
  return 'border-l-4 border-slate-500 bg-slate-50/25';
}

const TeamManagement = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState<string>('all');
  const [workloadFilter, setWorkloadFilter] = useState<string>('all');
  const [selectedBuyer, setSelectedBuyer] = useState<BuyerTeamMember | null>(null);
  const [showKPIModal, setShowKPIModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showPRListModal, setShowPRListModal] = useState(false);

  // Fetch team data
  const { data: teamData, isLoading, error, refetch } = useQuery({
    queryKey: ['buyer-manager-team-management'],
    queryFn: async () => {
      try {
        return await buyerManagerService.getTeamManagement();
      } catch {
        // Return default structure to prevent crash
        return {
          totalMembers: 0,
          buyerLeaders: 0,
          buyers: 0,
          avgEfficiency: 0,
          totalWorkload: 0,
          workloadCapacityPerBuyer: 10,
          members: [],
        };
      }
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    retryOnMount: false,
  });

  // Fetch buyer KPIs when modal is open
  const { data: buyerKPIs, isLoading: isLoadingKPIs } = useQuery({
    queryKey: ['buyer-manager-buyer-kpis', selectedBuyer?.id],
    queryFn: () => buyerManagerService.getBuyerKPIs(selectedBuyer!.id),
    enabled: !!selectedBuyer?.id && showKPIModal,
    staleTime: 30000,
    retry: 1,
  });

  // Fetch buyer PRs when modal is open
  const { data: buyerPRs, isLoading: isLoadingPRs } = useQuery({
    queryKey: ['buyer-manager-buyer-prs', selectedBuyer?.id],
    queryFn: () => buyerManagerService.getBuyerPRs(selectedBuyer!.id),
    enabled: !!selectedBuyer?.id && showPRListModal,
    staleTime: 30000,
    retry: 1,
  });

  const reassignMutation = useMutation({
    mutationFn: (data: any) => buyerManagerService.reassignPR(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-manager-team-management'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-manager-buyer-prs'] });
      setShowReassignModal(false);
    },
  });

  // Filter members - with safe handling and data mapping
  const rawMembers = (teamData?.members && Array.isArray(teamData.members)) ? teamData.members : [];
  
  const workloadCapacity = teamData?.workloadCapacityPerBuyer ?? 10;

  const normalizeWorkload = (raw: unknown): BuyerTeamMember['workload'] => {
    const u = String(raw ?? '')
      .toUpperCase()
      .replace(/\s+/g, '_');
    if (u === 'OVERLOADED' || u === 'OVERLOAD') return 'OVERLOADED';
    if (u === 'HIGH') return 'HIGH';
    if (u === 'LOW') return 'LOW';
    if (u === 'NORMAL') return 'NORMAL';
    return 'NORMAL';
  };

  const members: BuyerTeamMember[] = rawMembers.map((member: any, index: number) => {
    const memberId = member.id || member.userId || member.user?.id || `temp-${index}`;
    const activePRs = member.activePRs ?? member.activePRsCount ?? 0;
    const avgLead =
      member.avgLeadTime ??
      member.avgLeadTimeDays ??
      member.avgProcessingTime ??
      member.averageLeadTime ??
      0;
    const workloadPercentRaw =
      typeof member.workloadPercent === 'number'
        ? member.workloadPercent
        : Math.min(100, Math.round((activePRs / workloadCapacity) * 1000) / 10);
    const workloadBand: BuyerWorkloadBand =
      member.workloadBand === 'overload' || member.workloadBand === 'idle' || member.workloadBand === 'normal'
        ? member.workloadBand
        : inferWorkloadBand(workloadPercentRaw);

    return {
      id: memberId,
      name: member.name || member.fullName || member.user?.name || member.username || 'N/A',
      email: member.email || member.user?.email || '',
      username: member.username || member.user?.username || '',
      role: (member.role || member.user?.role || 'BUYER') as BuyerTeamMember['role'],
      purchaseTypes: Array.isArray(member.purchaseTypes)
        ? member.purchaseTypes
        : member.purchaseType
          ? [member.purchaseType]
          : ['DOMESTIC'],
      activePRs,
      avgLeadTime: avgLead,
      workloadPercent: workloadPercentRaw,
      workloadBand,
      overBudgetRate: member.overBudgetRate ?? member.overBudgetPercentage ?? 0,
      onTimeRate: member.onTimeRate ?? member.onTimePercentage ?? 0,
      overBudgetPRRate: member.overBudgetPRRate ?? member.overBudgetPRPercentage ?? 0,
      reworkRate: member.reworkRate ?? member.reworkPercentage ?? 0,
      avgPriceVsEstimate: member.avgPriceVsEstimate ?? member.averagePriceVsEstimate ?? 100,
      totalPRsCompleted: member.totalPRsCompleted ?? member.completedPRsCount ?? 0,
      totalPRsInProgress: member.totalPRsInProgress ?? member.inProgressPRsCount ?? activePRs,
      workload: normalizeWorkload(member.workload),
    };
  });
  
  const filteredMembers = members.filter((member: BuyerTeamMember) => {
    if (!member || !member.id) return false;
    
    // Search filter - if no search query, show all
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      searchQuery === '' ||
      (member.name || '').toLowerCase().includes(searchLower) ||
      (member.email || '').toLowerCase().includes(searchLower) ||
      (member.username || '').toLowerCase().includes(searchLower);
    
    // Purchase type filter
    const matchesPurchaseType = 
      purchaseTypeFilter === 'all' ||
      (Array.isArray(member.purchaseTypes) && member.purchaseTypes.length > 0 && member.purchaseTypes.some(type => type === purchaseTypeFilter));
    
    // Workload filter
    const matchesWorkload = 
      workloadFilter === 'all' ||
      (member.workload || 'NORMAL') === workloadFilter;

    return matchesSearch && matchesPurchaseType && matchesWorkload;
  });

  // Get workload badge
  const getWorkloadBadge = (workload: string) => {
    const workloadMap: Record<string, { label: string; color: string; bgColor: string }> = {
      LOW: { label: 'Thấp', color: 'text-emerald-800', bgColor: 'bg-emerald-100' },
      NORMAL: { label: 'Bình thường', color: 'text-slate-800', bgColor: 'bg-slate-100' },
      HIGH: { label: 'Cao', color: 'text-amber-800', bgColor: 'bg-amber-100' },
      OVERLOADED: { label: 'Quá tải', color: 'text-rose-800', bgColor: 'bg-rose-100' },
    };
    const info = workloadMap[workload] || { label: workload, color: 'text-slate-700', bgColor: 'bg-slate-100' };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${info.color} ${info.bgColor}`}>
        {info.label}
      </span>
    );
  };

  // Get purchase type badges
  const getPurchaseTypeBadges = (types: Array<'DOMESTIC' | 'OVERSEA' | 'SERVICE'>) => {
    const typeMap: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
      DOMESTIC: { label: 'Nội địa', icon: Home, color: 'text-green-700', bgColor: 'bg-green-100' },
      OVERSEA: { label: 'Overseas', icon: Globe, color: 'text-blue-700', bgColor: 'bg-blue-100' },
      SERVICE: { label: 'Dịch vụ', icon: ShoppingBag, color: 'text-purple-700', bgColor: 'bg-purple-100' },
    };
    return types.map((type) => {
      const info = typeMap[type] || { label: type, icon: Package, color: 'text-slate-700', bgColor: 'bg-slate-100' };
      const Icon = info.icon;
      return (
        <span
          key={type}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${info.color} ${info.bgColor}`}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
          {info.label}
        </span>
      );
    });
  };

  // Format percentage
  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return '0.0%';
    return `${value.toFixed(1)}%`;
  };


  if (isLoading && !teamData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center py-16">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (error && !teamData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-800">Lỗi khi tải dữ liệu</p>
          <p className="mt-1 text-sm text-red-600">
            {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // Ensure we always have data structure
  const safeTeamData = teamData || {
    totalMembers: 0,
    buyerLeaders: 0,
    buyers: 0,
    avgEfficiency: 0,
    totalWorkload: 0,
    workloadCapacityPerBuyer: 10,
    members: [],
  };

  const cap = safeTeamData.workloadCapacityPerBuyer ?? 10;

  const filterToolbar = (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="relative w-full min-w-0">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm theo tên, email hoặc username…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full min-w-0 rounded-2xl border border-slate-200/90 bg-white py-3 pl-11 pr-4 text-sm shadow-sm ring-1 ring-slate-900/[0.03] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40"
        />
      </div>
      <div className="hidden flex-wrap items-center gap-4 lg:flex">
        <div className="flex min-w-0 items-center gap-3">
          <Filter className="h-5 w-5 shrink-0 text-slate-400" />
          <CustomSelect
            value={purchaseTypeFilter}
            onChange={(e) => setPurchaseTypeFilter(e.target.value)}
            className="min-w-[10rem] rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-900/[0.03] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40"
          >
            <option value="all">Tất cả loại mua</option>
            <option value="DOMESTIC">Nội địa</option>
            <option value="OVERSEA">Overseas</option>
            <option value="SERVICE">Dịch vụ</option>
          </CustomSelect>
        </div>
        <CustomSelect
          value={workloadFilter}
          onChange={(e) => setWorkloadFilter(e.target.value)}
          className="min-w-[10rem] rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-900/[0.03] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40"
        >
          <option value="all">Tất cả mức tải</option>
          <option value="LOW">Thấp</option>
          <option value="NORMAL">Bình thường</option>
          <option value="HIGH">Cao</option>
          <option value="OVERLOADED">Quá tải</option>
        </CustomSelect>
      </div>
      <details className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm ring-1 ring-slate-900/[0.02] lg:hidden">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              Mở bộ lọc
            </span>
            <span className="text-xs font-medium text-slate-500">Chạm để mở</span>
          </span>
        </summary>
        <div className="mt-4 flex flex-col gap-4 border-t border-slate-100 pt-4">
          <CustomSelect
            value={purchaseTypeFilter}
            onChange={(e) => setPurchaseTypeFilter(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40"
          >
            <option value="all">Tất cả loại mua</option>
            <option value="DOMESTIC">Nội địa</option>
            <option value="OVERSEA">Overseas</option>
            <option value="SERVICE">Dịch vụ</option>
          </CustomSelect>
          <CustomSelect
            value={workloadFilter}
            onChange={(e) => setWorkloadFilter(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40"
          >
            <option value="all">Tất cả mức tải</option>
            <option value="LOW">Thấp</option>
            <option value="NORMAL">Bình thường</option>
            <option value="HIGH">Cao</option>
            <option value="OVERLOADED">Quá tải</option>
          </CustomSelect>
        </div>
      </details>
      <p className="text-sm font-medium text-slate-600">
        Đang hiển thị <span className="font-bold text-slate-900">{filteredMembers.length}</span> /{' '}
        {members.length} thành viên
        {isLoading ? <span className="ml-2 text-xs font-medium text-indigo-600">(Đang làm mới…)</span> : null}
      </p>
    </div>
  );

  return (
    <>
      <div
        className={`${requestorPageStackClass} ${dashboardPageContentInsetXClass} ${dashboardPageContentInsetBottomWorkspaceClass}`}
      >
        {error && teamData ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={2} aria-hidden />
                <div className="min-w-0">
                  <p className="font-bold text-amber-900">Đang hiển thị dữ liệu đệm (cache)</p>
                  <p className="mt-1 text-sm font-medium text-amber-800">
                    {error instanceof Error ? error.message : 'Lỗi kết nối API'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                className="shrink-0 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50"
              >
                Thử lại
              </button>
            </div>
          </div>
        ) : null}

        <RequestorPageHero
          kicker="Buyer Manager · Đội ngũ"
          title="Quản lý đội Buyer"
          description={`Theo dõi tải công việc và phân loại role — định mức tham chiếu ${cap} PR / buyer (cùng công thức bố cục với Tổng quan PR Requestor).`}
          Icon={Users}
          tint="ocean"
          regionLabel="Quản lý đội Buyer"
          rightSlot={
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white shadow-sm backdrop-blur-sm transition-all hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
              Làm mới dữ liệu
            </button>
          }
        />

        {/* A. KPI — StatCard bento `compact` (Dashboard V3 §4: hàng 4 cột, typography thu gọn) */}
        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-4">
          <StatCard
            variant="bento"
            compact
            accent="indigo"
            Icon={Users}
            label="Tổng thành viên"
            value={<CountUpNumber end={Math.max(0, Math.round(safeTeamData.totalMembers))} durationMs={800} />}
            hint="Headcount từ dữ liệu hiện tại."
            className={`${teamStatCardEnterClass} fade-in-right-stagger-2`}
          />
          <StatCard
            variant="bento"
            compact
            accent="emerald"
            Icon={Crown}
            label="Buyer Leaders"
            value={<CountUpNumber end={Math.max(0, Math.round(safeTeamData.buyerLeaders))} durationMs={800} />}
            hint="Điều phối cấp đội."
            className={`${teamStatCardEnterClass} fade-in-right-stagger-3`}
          />
          <StatCard
            variant="bento"
            compact
            accent="slate"
            Icon={UserRound}
            label="Buyers"
            value={<CountUpNumber end={Math.max(0, Math.round(safeTeamData.buyers))} durationMs={800} />}
            hint="RFQ · báo giá · PO."
            className={`${teamStatCardEnterClass} fade-in-right-stagger-4`}
          />
          <StatCard
            variant="bento"
            compact
            accent="amber"
            Icon={ClipboardList}
            label="PR đang xử lý"
            value={<CountUpNumber end={Math.max(0, Math.round(Number(safeTeamData.totalWorkload)))} durationMs={800} />}
            hint={`Tham chiếu tải: ${cap} PR/buyer.`}
            className={`${teamStatCardEnterClass} fade-in-right-stagger-5`}
          />
        </div>

        {/* B. Lọc + bảng — một panel trắng lớn (đồng bộ khối “Phân tích PR” Requestor) */}
        <div className={`animate-fade-in-right fade-in-right-stagger-6 ${requestorPanelCardClass}`}>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <div className="rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 p-2">
                <BarChart3 className="h-4 w-4 text-indigo-600" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">Danh sách & lọc đội</h2>
                <p className="mt-0.5 text-sm leading-snug text-slate-600">
                  Tìm theo tên hoặc email; lọc loại mua và mức tải. Chạm một hàng để xem KPI — viền trái hàng gợi ý quá tải / nhàn / ổn định.
                </p>
              </div>
            </div>
            <Link
              to="/dashboard/buyer-manager"
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 sm:text-sm"
            >
              <LayoutDashboard className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
              Tổng quan mua hàng
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            </Link>
          </div>

          {filterToolbar}

          <div className={`mt-5 min-w-0 ${requestorDataTableCardClass}`}>
              <div className={requestorDataTableCardHeaderClass}>
                <h3 className="text-base font-bold text-slate-900 sm:text-lg">Bảng thành viên</h3>
              </div>

              {filteredMembers.length === 0 ? (
                <div className="flex min-h-[280px] items-center justify-center px-4 py-12">
                  <div className="text-center">
                    {members.length > 0 ? (
                      <>
                        <Filter className="mx-auto mb-4 h-16 w-16 text-slate-300" strokeWidth={1.5} />
                        <p className="text-lg font-medium text-slate-600">Không tìm thấy thành viên phù hợp</p>
                        <p className="mt-1 text-sm text-slate-400">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                      </>
                    ) : (
                      <>
                        <Users className="mx-auto mb-4 h-16 w-16 text-slate-300" strokeWidth={1.5} />
                        <p className="text-lg font-medium text-slate-600">Không có thành viên nào</p>
                        <p className="mt-1 text-sm text-slate-400">Chưa có buyer / buyer leader trong hệ thống</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="min-w-0 overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-6">
                          Buyer
                        </th>
                        <th className="hidden px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 md:table-cell sm:px-6">
                          Loại mua
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-6">
                          PR
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-6">
                          % tải
                        </th>
                        <th className="hidden px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 sm:table-cell sm:px-6 md:table-cell">
                          Lead TB
                        </th>
                        <th className="hidden px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 md:table-cell sm:px-6">
                          Vượt NS
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-6">
                          Mức tải
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-6">
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredMembers.map((member: BuyerTeamMember) => {
                        if (!member?.id) return null;
                        const pct =
                          typeof member.workloadPercent === 'number'
                            ? member.workloadPercent
                            : Math.min(100, Math.round(((member.activePRs || 0) / cap) * 1000) / 10);
                        const band: BuyerWorkloadBand =
                          member.workloadBand ?? inferWorkloadBand(pct);
                        const roleLabel = member.role === 'BUYER_LEADER' ? 'Buyer Leader' : 'Buyer';
                        return (
                          <tr
                            key={member.id}
                            onClick={() => {
                              setSelectedBuyer(member);
                              setShowKPIModal(true);
                            }}
                            className={`cursor-pointer transition-all duration-200 hover:bg-white/90 ${rowHeatmapClass(band)}`}
                          >
                            <td className="whitespace-nowrap px-3 py-3 sm:px-6 sm:py-4">
                              <div className="flex min-w-0 items-center gap-3">
                                <div
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-xs font-bold text-white shadow ring-2 ring-white transition-transform duration-200 hover:scale-105"
                                  aria-hidden
                                >
                                  {memberInitials(member.name || '?')}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900">{member.name || 'N/A'}</p>
                                  <p className="text-xs text-slate-500">{roleLabel}</p>
                                  <p className="truncate text-xs text-slate-400">@{member.username || '—'}</p>
                                  <div className="mt-0.5 flex items-center gap-1.5 md:mt-1">
                                    <span
                                      className="inline-flex md:hidden"
                                      title={member.email || 'Không có email'}
                                    >
                                      <Mail className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                                    </span>
                                    <p className="hidden truncate text-xs text-slate-500 md:block" title={member.email}>
                                      {member.email || '—'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="hidden px-3 py-3 sm:px-6 sm:py-4 md:table-cell">
                              <div className="flex flex-wrap gap-1.5">
                                {getPurchaseTypeBadges(
                                  Array.isArray(member.purchaseTypes) ? member.purchaseTypes : []
                                )}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-center sm:px-6 sm:py-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                                <span className="text-sm font-semibold tabular-nums text-slate-900">
                                  {member.activePRs ?? 0}
                                </span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-center sm:px-6 sm:py-4">
                              <span className="text-sm font-bold tabular-nums text-slate-900">{pct.toFixed(1)}%</span>
                              <span className="mt-0.5 block text-[10px] font-medium uppercase text-slate-500">
                                {band === 'overload' ? 'Quá tải' : band === 'idle' ? 'Nhàn' : 'Ổn định'}
                              </span>
                            </td>
                            <td className="hidden whitespace-nowrap px-3 py-3 text-center sm:table-cell sm:px-6 sm:py-4 md:table-cell">
                              <div className="flex items-center justify-center gap-1.5">
                                <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                                <span className="text-sm font-medium tabular-nums text-slate-900">
                                  {(member.avgLeadTime || 0).toFixed(1)}d
                                </span>
                              </div>
                            </td>
                            <td className="hidden whitespace-nowrap px-3 py-3 text-center md:table-cell sm:px-6 sm:py-4">
                              <div
                                className={`flex items-center justify-center gap-1.5 ${
                                  (member.overBudgetRate || 0) > 10
                                    ? 'text-red-600'
                                    : (member.overBudgetRate || 0) > 5
                                      ? 'text-orange-600'
                                      : 'text-emerald-600'
                                }`}
                              >
                                <TrendingUp className="h-4 w-4 shrink-0" />
                                <span className="text-sm font-medium">{formatPercent(member.overBudgetRate)}</span>
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-center sm:px-6 sm:py-4">
                              <div className="flex flex-col items-center gap-1">
                                {getWorkloadBadge(member.workload || 'NORMAL')}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-center sm:px-6 sm:py-4" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBuyer(member);
                                    setShowKPIModal(true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-xl border border-indigo-200/60 bg-indigo-50/90 px-2 py-1.5 text-[11px] font-semibold text-indigo-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-100 sm:px-3 sm:text-xs"
                                  title="Xem KPI"
                                >
                                  <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  <span className="hidden sm:inline">KPI</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBuyer(member);
                                    setShowPRListModal(true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 sm:px-3 sm:text-xs"
                                  title="Xem danh sách PR"
                                >
                                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  <span className="hidden sm:inline">PR</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBuyer(member);
                                    setShowReassignModal(true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-xl border border-amber-200/70 bg-amber-50/90 px-2 py-1.5 text-[11px] font-semibold text-amber-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-100 sm:px-3 sm:text-xs"
                                  title="Re-assign PR"
                                >
                                  <ArrowRightLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  <span className="hidden sm:inline">Điều phối</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* KPI Detail Modal */}
      {showKPIModal && selectedBuyer && (
        <KPIModal
          buyer={selectedBuyer}
          kpis={buyerKPIs}
          isLoading={isLoadingKPIs}
          onClose={() => {
            setShowKPIModal(false);
            setSelectedBuyer(null);
          }}
        />
      )}

      {/* Re-assign PR Modal */}
      {showReassignModal && selectedBuyer && (
        <ReassignPRModal
          buyer={selectedBuyer}
          allBuyers={members.filter((m: BuyerTeamMember) => m.id !== selectedBuyer.id && m.role === 'BUYER')}
          onClose={() => {
            setShowReassignModal(false);
            setSelectedBuyer(null);
          }}
          onReassign={(data) => {
            reassignMutation.mutate({
              prId: data.prId,
              currentBuyerId: selectedBuyer.id,
              newBuyerId: data.newBuyerId,
              reason: data.reason,
              itemIds: data.itemIds,
            });
          }}
        />
      )}

      {/* PR List Modal */}
      {showPRListModal && selectedBuyer && (
        <PRListModal
          buyer={selectedBuyer}
          prs={buyerPRs?.prs || []}
          isLoading={isLoadingPRs}
          onClose={() => {
            setShowPRListModal(false);
            setSelectedBuyer(null);
          }}
        />
      )}
    </>
  );
};

// KPI Detail Modal Component
const KPIModal = ({ buyer, kpis, isLoading, onClose }: { buyer: BuyerTeamMember; kpis: any; isLoading: boolean; onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-popup-overlay" onClick={onClose}>
      <div
        className="modal-popup-panel bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">KPI Chi tiết - {buyer.name}</h3>
            <p className="text-sm text-slate-500 mt-1">{buyer.email}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Đang tải KPI...</p>
              </div>
            </div>
          ) : kpis ? (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <h4 className="text-lg font-bold text-green-900">% PR đúng hạn</h4>
                  </div>
                  <p className="text-3xl font-bold text-green-700 mb-2">{kpis.onTimeRate?.toFixed(1) || 0}%</p>
                  <p className="text-sm text-green-600">
                    {kpis.totalPRsCompleted || 0} PR đã hoàn thành trong thời gian quy định
                  </p>
                </div>

                <div className="bg-red-50 rounded-xl p-6 border border-red-200">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                    <h4 className="text-lg font-bold text-red-900">% PR vượt ngân sách</h4>
                  </div>
                  <p className="text-3xl font-bold text-red-700 mb-2">{kpis.overBudgetPRRate?.toFixed(1) || 0}%</p>
                  <p className="text-sm text-red-600">
                    So với giá estimate của Requestor
                  </p>
                </div>

                <div className="bg-orange-50 rounded-xl p-6 border border-orange-200">
                  <div className="flex items-center gap-3 mb-3">
                    <RefreshCw className="w-6 h-6 text-orange-600" />
                    <h4 className="text-lg font-bold text-orange-900">% PR phải làm lại</h4>
                  </div>
                  <p className="text-3xl font-bold text-orange-700 mb-2">{kpis.reworkRate?.toFixed(1) || 0}%</p>
                  <p className="text-sm text-orange-600">
                    PR cần chỉnh sửa hoặc làm lại
                  </p>
                </div>

                <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                    <h4 className="text-lg font-bold text-blue-900">Giá trung bình vs Estimate</h4>
                  </div>
                  <p className={`text-3xl font-bold mb-2 ${(kpis.avgPriceVsEstimate || 0) > 100 ? 'text-red-700' : (kpis.avgPriceVsEstimate || 0) > 95 ? 'text-orange-700' : 'text-green-700'}`}>
                    {(kpis.avgPriceVsEstimate || 0).toFixed(1)}%
                  </p>
                  <p className="text-sm text-blue-600">
                    {(kpis.avgPriceVsEstimate || 0) > 100 ? 'Cao hơn' : (kpis.avgPriceVsEstimate || 0) > 95 ? 'Gần bằng' : 'Thấp hơn'} giá requestor đề xuất
                  </p>
                </div>
              </div>

              {/* Recent PRs */}
              {kpis.recentPRs && kpis.recentPRs.length > 0 && (
                <div>
                  <h4 className="text-lg font-bold text-slate-900 mb-4">PR gần đây</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border border-slate-200 rounded-xl overflow-hidden">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Mã PR</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Đúng hạn</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Vượt ngân sách</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Làm lại</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {kpis.recentPRs.map((pr: any) => (
                          <tr key={pr.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-medium text-slate-900">{pr.prNumber}</td>
                            <td className="px-4 py-3 text-center">
                              {pr.onTime ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                              ) : (
                                <Clock className="w-5 h-5 text-orange-600 mx-auto" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {pr.overBudget ? (
                                <AlertTriangle className="w-5 h-5 text-red-600 mx-auto" />
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {pr.rework ? (
                                <RefreshCw className="w-5 h-5 text-orange-600 mx-auto" />
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{pr.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Không có dữ liệu KPI</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Re-assign PR Modal Component
const ReassignPRModal = ({ buyer, allBuyers, onClose, onReassign }: { buyer: BuyerTeamMember; allBuyers: BuyerTeamMember[]; onClose: () => void; onReassign: (data: any) => void }) => {
  const { showWarning } = useToast();
  const [prId, setPrId] = useState('');
  const [newBuyerId, setNewBuyerId] = useState('');
  const [reason, setReason] = useState('');
  const [assignByItem, setAssignByItem] = useState(false);

  // Fetch PRs assigned to this buyer
  const { data: buyerPRsData, isLoading: isLoadingBuyerPRs } = useQuery({
    queryKey: ['buyer-manager-buyer-prs-for-reassign', buyer.id],
    queryFn: () => buyerManagerService.getBuyerPRs(buyer.id),
    enabled: !!buyer.id,
    staleTime: 30000,
    retry: 1,
  });

  const buyerPRs = buyerPRsData?.prs || [];

  const handleSubmit = () => {
    if (!prId || !newBuyerId || !reason.trim()) {
      showWarning('Vui lòng điền đầy đủ thông tin');
      return;
    }
    onReassign({
      prId,
      newBuyerId,
      reason,
      itemIds: assignByItem ? [] : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-popup-overlay" onClick={onClose}>
      <div
        className="modal-popup-panel bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Re-assign PR</h3>
            <p className="text-sm text-slate-500 mt-1">Chuyển PR từ {buyer.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
          {/* PR Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Chọn PR</label>
            {isLoadingBuyerPRs ? (
              <div className="flex items-center justify-center py-4 border border-slate-300 rounded-xl bg-slate-50">
                <div className="flex items-center gap-2 text-slate-600">
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Đang tải danh sách PR...</span>
                </div>
              </div>
            ) : buyerPRs.length === 0 ? (
              <div className="px-4 py-3 border border-slate-300 rounded-xl bg-slate-50">
                <p className="text-sm text-slate-600 text-center">Không có PR nào đang được {buyer.name} xử lý</p>
              </div>
            ) : (
              <CustomSelect
                value={prId}
                onChange={(e) => setPrId(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent bg-white"
              >
                <option value="">-- Chọn PR --</option>
                {buyerPRs.map((pr: any) => (
                  <option key={pr.id} value={pr.id}>{pr.prNumber || pr.id}</option>
                ))}
              </CustomSelect>
            )}
            <p className="text-xs text-slate-500 mt-1">Danh sách PR đang được {buyer.name} xử lý</p>
          </div>

          {/* New Buyer Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Chuyển đến Buyer</label>
            <CustomSelect
              value={newBuyerId}
              onChange={(e) => setNewBuyerId(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
            >
              <option value="">-- Chọn Buyer --</option>
              {allBuyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {(b.purchaseTypes ?? ['DOMESTIC']).join(', ')}
                </option>
              ))}
            </CustomSelect>
          </div>

          {/* Assign by Item Toggle */}
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              id="assignByItem"
              checked={assignByItem}
              onChange={(e) => setAssignByItem(e.target.checked)}
              className="w-4 h-4 text-[#2563EB] border-slate-300 rounded focus:ring-[#2563EB]"
            />
            <label htmlFor="assignByItem" className="text-sm font-medium text-slate-700 cursor-pointer">
              Chia PR theo item (ví dụ: NCC nước ngoài → Buyer A, NCC trong nước → Buyer B)
            </label>
          </div>

          {/* Item Selection (if assignByItem) */}
          {assignByItem && prId && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-sm font-semibold text-blue-900 mb-3">Chọn items cần chuyển</p>
              <p className="text-xs text-blue-700">
                Tính năng chia PR theo item sẽ được triển khai trong phiên bản tiếp theo.
                Hiện tại, PR sẽ được chuyển toàn bộ cho buyer mới.
              </p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Lý do re-assign <span className="text-red-500">*</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Giải thích lý do chuyển PR (bắt buộc)"
              rows={4}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              required
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex-shrink-0 bg-slate-50 border-t border-slate-200 p-6 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl hover:bg-[#1e40af] transition-colors font-medium flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Xác nhận Re-assign
          </button>
        </div>
      </div>
    </div>
  );
};

// PR List Modal Component
const PRListModal = ({ buyer, prs, isLoading, onClose }: { buyer: BuyerTeamMember; prs: any[]; isLoading: boolean; onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-popup-overlay" onClick={onClose}>
      <div
        className="modal-popup-panel bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Danh sách PR - {buyer.name}</h3>
            <p className="text-sm text-slate-500 mt-1">Tổng cộng: {prs.length} PR</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600">Đang tải danh sách PR...</p>
              </div>
            </div>
          ) : prs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Không có PR nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Mã PR</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Phòng ban</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase">Trạng thái</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase">Tổng tiền</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {prs.map((pr) => (
                    <tr key={pr.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{pr.prNumber}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{pr.department || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                          {pr.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 text-right">
                        {pr.totalAmount ? `${pr.totalAmount.toLocaleString('vi-VN')} VND` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {pr.createdAt ? new Date(pr.createdAt).toLocaleDateString('vi-VN') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamManagement;
