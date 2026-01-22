import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Filter, Eye, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, DollarSign, ArrowRightLeft, Package, Globe, Home, ShoppingBag, BarChart3, FileText, X, Save } from 'lucide-react';
import { buyerManagerService } from '../../services/buyerManagerService';
import type { BuyerTeamMember } from '../../services/buyerManagerService';

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
      } catch (err) {
        console.error('Error fetching team management data:', err);
        // Return default structure to prevent crash
        return {
          totalMembers: 0,
          buyerLeaders: 0,
          buyers: 0,
          avgEfficiency: 0,
          totalWorkload: 0,
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
  
  // Map raw data to ensure it has required fields
  const members: BuyerTeamMember[] = rawMembers.map((member: any, index: number) => {
    // Ensure member has an id - use existing id, userId, or generate from index
    const memberId = member.id || member.userId || member.user?.id || `temp-${index}`;
    
    return {
      id: memberId,
      name: member.name || member.fullName || member.user?.name || member.username || 'N/A',
      email: member.email || member.user?.email || '',
      username: member.username || member.user?.username || '',
      role: member.role || member.user?.role || 'BUYER',
      purchaseTypes: Array.isArray(member.purchaseTypes) ? member.purchaseTypes : 
                     (member.purchaseType ? [member.purchaseType] : ['DOMESTIC']),
      activePRs: member.activePRs || member.activePRsCount || 0,
      avgLeadTime: member.avgLeadTime || member.averageLeadTime || 0,
      overBudgetRate: member.overBudgetRate || member.overBudgetPercentage || 0,
      onTimeRate: member.onTimeRate || member.onTimePercentage || 0,
      overBudgetPRRate: member.overBudgetPRRate || member.overBudgetPRPercentage || 0,
      reworkRate: member.reworkRate || member.reworkPercentage || 0,
      avgPriceVsEstimate: member.avgPriceVsEstimate || member.averagePriceVsEstimate || 100,
      totalPRsCompleted: member.totalPRsCompleted || member.completedPRsCount || 0,
      totalPRsInProgress: member.totalPRsInProgress || member.inProgressPRsCount || 0,
      workload: member.workload || 'NORMAL',
    } as BuyerTeamMember;
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

  // Debug: Log raw data structure if table is empty but stats show members
  if (rawMembers.length > 0 && filteredMembers.length === 0) {
    console.log('Raw members from API:', rawMembers);
    console.log('Mapped members:', members);
    console.log('Filtered members:', filteredMembers);
    console.log('Search query:', searchQuery);
    console.log('Purchase type filter:', purchaseTypeFilter);
    console.log('Workload filter:', workloadFilter);
  }
  
  // Debug: Log mapped members structure
  if (members.length > 0 && filteredMembers.length === 0) {
    console.log('Raw members from API:', rawMembers);
    console.log('Mapped members (first):', members[0]);
  }

  // Get workload badge
  const getWorkloadBadge = (workload: string) => {
    const workloadMap: Record<string, { label: string; color: string; bgColor: string }> = {
      LOW: { label: 'Thấp', color: 'text-blue-700', bgColor: 'bg-blue-100' },
      NORMAL: { label: 'Bình thường', color: 'text-green-700', bgColor: 'bg-green-100' },
      HIGH: { label: 'Cao', color: 'text-orange-700', bgColor: 'bg-orange-100' },
      OVERLOADED: { label: 'Quá tải', color: 'text-red-700', bgColor: 'bg-red-100' },
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


  // Always show UI even while loading - prevent blank screen
  if (isLoading && !teamData) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  // Show error state but still allow viewing
  if (error && !teamData) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-800 font-medium text-center mb-2">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-2 text-center mb-4">
            {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
          </p>
          <button
            onClick={() => refetch()}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
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
    members: [],
  };

  return (
    <div className="h-full w-full overflow-hidden flex flex-col bg-slate-50">
      {/* Error Banner (if error exists but we have cached data) */}
      {error && teamData && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <p className="text-sm text-amber-800">
                Đang hiển thị dữ liệu cũ. {error instanceof Error ? error.message : 'Lỗi kết nối API'}
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="text-xs text-amber-700 hover:text-amber-900 font-medium underline"
            >
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* Header with Stats */}
      <div className="shrink-0 bg-slate-50 border-b border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Users className="w-7 h-7 text-[#2563EB]" strokeWidth={2} />
              Buyer Team Management
            </h2>
            <p className="text-sm text-slate-600 mt-1">Quản lý con người – không quản lý từng PR</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2 text-slate-700 font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-700 font-medium mb-1">Tổng thành viên</p>
                <p className="text-2xl font-bold text-blue-900">{safeTeamData.totalMembers}</p>
              </div>
              <Users className="w-10 h-10 text-blue-600 opacity-50" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700 font-medium mb-1">Buyer Leaders</p>
                <p className="text-2xl font-bold text-green-900">{safeTeamData.buyerLeaders}</p>
              </div>
              <Users className="w-10 h-10 text-green-600 opacity-50" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-700 font-medium mb-1">Buyers</p>
                <p className="text-2xl font-bold text-indigo-900">{safeTeamData.buyers}</p>
              </div>
              <Users className="w-10 h-10 text-indigo-600 opacity-50" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-700 font-medium mb-1">Hiệu suất TB</p>
                <p className="text-2xl font-bold text-purple-900">{safeTeamData.avgEfficiency.toFixed(1)}%</p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-600 opacity-50" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 bg-slate-50 border-b border-slate-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, email, username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
            />
          </div>

          {/* Purchase Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={purchaseTypeFilter}
              onChange={(e) => setPurchaseTypeFilter(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
            >
              <option value="all">Tất cả loại mua</option>
              <option value="DOMESTIC">Nội địa</option>
              <option value="OVERSEA">Overseas</option>
              <option value="SERVICE">Dịch vụ</option>
            </select>
          </div>

          {/* Workload Filter */}
          <select
            value={workloadFilter}
            onChange={(e) => setWorkloadFilter(e.target.value)}
            className="px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
          >
            <option value="all">Tất cả mức tải</option>
            <option value="LOW">Thấp</option>
            <option value="NORMAL">Bình thường</option>
            <option value="HIGH">Cao</option>
            <option value="OVERLOADED">Quá tải</option>
          </select>
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-slate-600">
          Tìm thấy <span className="font-semibold text-slate-900">{filteredMembers.length}</span> thành viên
          {isLoading && <span className="ml-2 text-xs text-blue-600">(Đang tải...)</span>}
        </div>
      </div>

      {/* Buyer List Table */}
      <div className="flex-1 min-h-0 flex flex-col p-4">
        <div className="bg-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          {filteredMembers.length === 0 ? (
            <div className="h-full min-h-[300px] flex items-center justify-center">
              <div className="text-center">
                <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
                <p className="text-slate-500 text-lg font-medium">Không có thành viên nào</p>
                <p className="text-slate-400 text-sm mt-2">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Table Header */}
              <div className="shrink-0 bg-slate-50 border-b border-slate-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">Danh sách Buyer ({filteredMembers.length})</h3>
              </div>
              
              {/* Scrollable Table Container - Dynamic height, max 4 rows */}
              <div 
                className="overflow-y-auto overflow-x-hidden"
                style={{
                  maxHeight: '288px', // ~4 rows × 72px per row - only scroll if more than 4 rows
                }}
              >
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Buyer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Loại mua
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        PR đang xử lý
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Lead time TB
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Tỷ lệ vượt ngân sách
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Mức tải
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Hành động
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {filteredMembers.length === 0 && members.length > 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500 bg-white">
                          <div className="flex flex-col items-center justify-center">
                            <Filter className="w-16 h-16 text-slate-300 mb-4" strokeWidth={1.5} />
                            <p className="text-lg font-medium">Không tìm thấy thành viên phù hợp</p>
                            <p className="text-sm text-slate-400 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((member: BuyerTeamMember) => {
                        // Members are now mapped with guaranteed id field
                        if (!member || !member.id) return null;
                        return (
                        <tr
                          key={member.id}
                          onClick={() => {
                            setSelectedBuyer(member);
                            setShowKPIModal(true);
                          }}
                          className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900">{member.name || 'N/A'}</p>
                                <p className="text-xs text-slate-500">{member.email || 'N/A'}</p>
                                <p className="text-xs text-slate-400">@{member.username || 'N/A'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {getPurchaseTypeBadges(Array.isArray(member.purchaseTypes) ? member.purchaseTypes : [])}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              <FileText className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-medium text-slate-900">{member.activePRs || 0}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Clock className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-medium text-slate-900">{(member.avgLeadTime || 0).toFixed(1)} ngày</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className={`flex items-center justify-center gap-2 ${(member.overBudgetRate || 0) > 10 ? 'text-red-600' : (member.overBudgetRate || 0) > 5 ? 'text-orange-600' : 'text-green-600'}`}>
                              <TrendingUp className="w-4 h-4" />
                              <span className="text-sm font-medium">{formatPercent(member.overBudgetRate)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {getWorkloadBadge(member.workload || 'NORMAL')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedBuyer(member);
                                  setShowKPIModal(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2563EB] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                title="Xem KPI"
                              >
                                <BarChart3 className="w-4 h-4" />
                                KPI
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBuyer(member);
                                  setShowPRListModal(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                title="Xem danh sách PR"
                              >
                                <Eye className="w-4 h-4" />
                                PR
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBuyer(member);
                                  setShowReassignModal(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                                title="Re-assign PR"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                                Điều phối
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
    </div>
  );
};

// KPI Detail Modal Component
const KPIModal = ({ buyer, kpis, isLoading, onClose }: { buyer: BuyerTeamMember; kpis: any; isLoading: boolean; onClose: () => void }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900">KPI Chi tiết - {buyer.name}</h3>
            <p className="text-sm text-slate-500 mt-1">{buyer.email}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
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
  const [prId, setPrId] = useState('');
  const [newBuyerId, setNewBuyerId] = useState('');
  const [reason, setReason] = useState('');
  const [assignByItem, setAssignByItem] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

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
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }
    onReassign({
      prId,
      newBuyerId,
      reason,
      itemIds: assignByItem ? selectedItemIds : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Re-assign PR</h3>
            <p className="text-sm text-slate-500 mt-1">Chuyển PR từ {buyer.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
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
              <select
                value={prId}
                onChange={(e) => setPrId(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent bg-white"
              >
                <option value="">-- Chọn PR --</option>
                {buyerPRs.map((pr: any) => (
                  <option key={pr.id} value={pr.id}>{pr.prNumber || pr.id}</option>
                ))}
              </select>
            )}
            <p className="text-xs text-slate-500 mt-1">Danh sách PR đang được {buyer.name} xử lý</p>
          </div>

          {/* New Buyer Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Chuyển đến Buyer</label>
            <select
              value={newBuyerId}
              onChange={(e) => setNewBuyerId(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
            >
              <option value="">-- Chọn Buyer --</option>
              {allBuyers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} - {b.purchaseTypes.join(', ')}
                </option>
              ))}
            </select>
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
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-6 flex items-center justify-end gap-3 rounded-b-2xl">
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Danh sách PR - {buyer.name}</h3>
            <p className="text-sm text-slate-500 mt-1">Tổng cộng: {prs.length} PR</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
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
