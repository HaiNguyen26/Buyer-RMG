import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Eye,
  MessageSquare,
  Filter,
  Search,
  X,
  Building2,
  User,
  Calendar,
  DollarSign,
  Info,
  Package,
  FileText,
  Plus,
  FileQuestion,
  ExternalLink,
  ClipboardList,
  Paperclip,
} from 'lucide-react';
import { buyerService } from '../../services/buyerService';
import { extractHttpUrls, openAttachmentWithAuth, toAbsoluteAttachmentHref } from '../../utils/attachmentDownload';
import { useToast } from '../../contexts/ToastContext';
import CustomSelect from '../../components/CustomSelect';
import { PRSalesOrderLine } from '../../components/PRSalesOrderLine';
import { BuyerPageHero } from '../../components/BuyerPageHero';
import { BuyerHiddenPrice } from '../../components/buyer/BuyerHiddenPrice';
import {
  buyerInteractiveTableClass,
  buyerInteractiveTableBodyClass,
  buyerOutletPageShellClass,
  buyerOutletCenterMinHeightClass,
  buyerTableAccentRailClass,
  buyerTableCellWrapClass,
  buyerTableCellWrapFlexClass,
  buyerTableDataRowVisual,
  buyerTableFirstCellInnerClass,
  buyerTableRowInteractive,
  buyerWorkspaceDataCardClass,
  buyerWorkspaceFiltersCardClass,
  buyerWorkspacePageStackClass,
  buyerWorkspaceTableTitleBarClass,
  buyerWorkspaceTableViewportClass,
} from '../../constants/buyerLayout';
import {
  DashboardV3ShimmerBlock,
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
  dashboardV3TableHeaderStripClass,
  dashboardV3ErrorCardClass,
} from '../../components/dashboard/DashboardV3Chrome';

/** Chỉ cho phép mở link http(s) để tránh javascript:... */
function safeReferenceHref(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim();
  if (!t) return null;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  return null;
}

const AssignedPR = () => {
  const navigate = useNavigate();
  const { prId } = useParams<{ prId?: string }>();
  const queryClient = useQueryClient();
  const { showSuccess, showError, showWarning } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showCreateRFQModal, setShowCreateRFQModal] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isTableVisible, setIsTableVisible] = useState(false);
  const [openRepurchaseAfterLoad, setOpenRepurchaseAfterLoad] = useState(false);

  // Open modal if prId is in URL
  useEffect(() => {
    if (prId) {
      setSelectedPRId(prId);
      setIsDetailModalOpen(true);
    }
  }, [prId]);

  // Prevent background scroll + layout shift when modal opens.
  useEffect(() => {
    const shouldLock = isDetailModalOpen || showCreateRFQModal;
    if (!shouldLock) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isDetailModalOpen, showCreateRFQModal]);

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { user } = await authService.getCurrentUser();
      return user;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: prsData, isLoading, isFetching, error: prsError } = useQuery({
    queryKey: ['buyer-assigned-prs', statusFilter],
    queryFn: () =>
      buyerService.getAssignedPRs({
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: prDetails, isLoading: isLoadingPRDetails, error: prDetailsError } = useQuery({
    queryKey: ['buyer-pr-details', selectedPRId],
    queryFn: async () => {
      if (!selectedPRId) {
        throw new Error('PR ID is required');
      }
      try {
        const response = await buyerService.getPRDetails(selectedPRId);
        if (!response) {
          throw new Error('PR details is null or undefined');
        }
        if (!response.items || !Array.isArray(response.items)) {
          response.items = [];
        }
        return response;
      } catch (error: unknown) {
        throw error;
      }
    },
    enabled: !!selectedPRId && isDetailModalOpen,
    retry: 1,
  });

  // Create RFQ Mutation
  const createRFQMutation = useMutation({
    mutationFn: ({ prId, itemIds }: { prId: string; itemIds?: string[] }) => 
      buyerService.createRFQ(prId, undefined, itemIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['buyer-pr-details', selectedPRId] });
      queryClient.invalidateQueries({ queryKey: ['buyer-assigned-prs'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-rfqs'] });
      setShowCreateRFQModal(false);
      setSelectedItemIds(new Set());
      showSuccess(`Đã tạo RFQ ${data.rfqNumber} — xem tại Quản lý RFQ`);
    },
    onError: (error: any) => {
      const data = error.response?.data;
      showError(data?.message || data?.error || 'Lỗi khi tạo RFQ');
    },
  });

  const handleCreateRFQ = (preselectAwaitingRepurchase = false) => {
    if (!selectedPRId || !prDetails?.items) return;
    setShowCreateRFQModal(true);
    if (preselectAwaitingRepurchase) {
      const selectable = prDetails.items.filter(
        (item: { id: string; isLocked?: boolean; status?: string; purchaseQty?: number }) =>
          !item.isLocked &&
          String(item.status) === 'ASSIGNED' &&
          Number(item.purchaseQty ?? 0) > 1e-9
      );
      setSelectedItemIds(new Set(selectable.map((item: { id: string }) => item.id)));
    } else {
      setSelectedItemIds(new Set());
    }
  };

  const canCreateRepurchaseRfq =
    (prDetails?.awaitingPurchaseCount ?? 0) > 0 && !!prDetails?.assignment;

  const openRepurchaseFromStatus = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!canCreateRepurchaseRfq) return;
    handleCreateRFQ(true);
  };

  useEffect(() => {
    if (!openRepurchaseAfterLoad || !prDetails?.items?.length) return;
    const n = prDetails.awaitingPurchaseCount ?? 0;
    if (n > 0 && prDetails.assignment) {
      handleCreateRFQ(true);
    }
    setOpenRepurchaseAfterLoad(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mở popup RFQ sau khi PR detail load xong
  }, [openRepurchaseAfterLoad, prDetails]);

  const handleConfirmCreateRFQ = () => {
    if (!selectedPRId) return;
    if (selectedItemIds.size === 0) {
      showWarning('Vui lòng chọn ít nhất 1 item');
      return;
    }
    createRFQMutation.mutate({ 
      prId: selectedPRId, 
      itemIds: Array.from(selectedItemIds) 
    });
  };

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

  const handleOpenRfqManagement = () => {
    const rfqId = prDetails?.rfq?.id;
    if (!rfqId) return;
    handleCloseDetailModal();
    navigate(`/dashboard/buyer/rfq/${rfqId}`);
  };

  const formatCurrency = (amount: number | null, currency: string = 'VND') => {
    if (!amount) return '-';
    return `${amount.toLocaleString('vi-VN')} ${currency}`;
  };

  const resolveItemUnitPrice = (item: any): number => {
    const estimated = Number(item?.estimatedUnitPriceVnd ?? 0);
    if (Number.isFinite(estimated) && estimated > 0) return estimated;
    const unitPrice = Number(item?.unitPrice ?? 0);
    return Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0;
  };

  const resolveItemAmount = (item: any): number => {
    const amount = Number(item?.amount ?? 0);
    if (Number.isFinite(amount) && amount > 0) return amount;
    const qty = Number(item?.qty ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) return 0;
    const unitPrice = resolveItemUnitPrice(item);
    return unitPrice > 0 ? qty * unitPrice : 0;
  };

  const resolvePrDisplayTotal = (pr: any): number | null => {
    const directTotal = Number(pr?.totalAmount ?? 0);
    if (Number.isFinite(directTotal) && directTotal > 0) return directTotal;
    const items = Array.isArray(pr?.items) ? pr.items : [];
    const computed = items.reduce((sum: number, item: any) => sum + resolveItemAmount(item), 0);
    return computed > 0 ? computed : null;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'READY_FOR_RFQ':
      case 'ASSIGNED_TO_BUYER':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'COLLECTING_QUOTATION':
      case 'RFQ_IN_PROGRESS':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'AWAITING_REORDER':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'QUOTATION_COMPLETED':
      case 'QUOTATION_RECEIVED':
      case 'SUPPLIER_SELECTED':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'AWAITING_PO':
        return 'bg-violet-50 text-violet-800 border-violet-200';
      case 'BUDGET_EXCEPTION_PENDING':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'PO_IN_PROGRESS':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'PO_ISSUED':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string, awaitingCount?: number) => {
    switch (status) {
      case 'READY_FOR_RFQ':
      case 'ASSIGNED_TO_BUYER':
        return 'Sẵn sàng hỏi giá';
      case 'COLLECTING_QUOTATION':
      case 'RFQ_IN_PROGRESS':
        return 'Đang thu thập báo giá';
      case 'AWAITING_REORDER': {
        const n = awaitingCount ?? 0;
        if (n === 1) return 'Còn 1 item cần mua';
        if (n > 1) return `Còn ${n} item cần mua`;
        return 'Còn item cần mua';
      }
      case 'QUOTATION_COMPLETED':
      case 'QUOTATION_RECEIVED':
        return 'Đã hoàn thành báo giá';
      case 'SUPPLIER_SELECTED':
        return 'Đã chọn NCC';
      case 'AWAITING_PO':
        return 'Chờ tạo PO';
      case 'BUDGET_EXCEPTION_PENDING':
        return 'Vượt NS — chờ GĐ CN';
      case 'PO_IN_PROGRESS':
        return 'PO đang xử lý';
      case 'PO_ISSUED':
        return 'Đã phát hành PO';
      default:
        return status;
    }
  };

  // Trạng thái từng item (PurchaseRequestItemStatus)
  const getItemStatusLabel = (status: string) => {
    switch (status) {
      case 'NEW': return 'Mới';
      case 'ASSIGNED': return 'Đã phân công';
      case 'RFQ_CREATED': return 'Đã tạo RFQ';
      case 'RFQ_SUBMITTED': return 'Đã gửi RFQ';
      case 'READY_FOR_REVIEW': return 'Sẵn sàng so sánh';
      case 'SUPPLIER_SELECTED': return 'Đã chọn NCC';
      case 'FULFILLED': return 'Đã nhận đủ (mua hàng)';
      default: return status || 'Mới';
    }
  };
  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'ASSIGNED': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'RFQ_CREATED': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'RFQ_SUBMITTED': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'READY_FOR_REVIEW': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'SUPPLIER_SELECTED': return 'bg-green-50 text-green-700 border-green-200';
      case 'FULFILLED': return 'bg-slate-100 text-slate-800 border-slate-300';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  useEffect(() => {
    if (isLoading || isFetching) {
      setIsTableVisible(false);
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      setIsTableVisible(true);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [isLoading, isFetching, prsData]);

  if (prsError) {
    return (
      <div className={`${buyerOutletPageShellClass} ${buyerOutletCenterMinHeightClass} items-center justify-center p-6`}>
        <div className={`max-w-lg ${dashboardV3ErrorCardClass}`}>
          <p className="text-lg font-bold text-rose-900">Lỗi khi tải dữ liệu</p>
          <p className="mt-2 text-sm font-medium text-rose-800/90">
            {prsError instanceof Error ? prsError.message : 'Vui lòng thử lại sau'}
          </p>
        </div>
      </div>
    );
  }

  const prs = prsData?.prs || [];
  const totalFromApi = prs.length;
  const filteredPRs = prs.filter((pr: any) =>
    pr?.prNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pr?.scope?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pr?.salesOrder?.label?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const showTableSkeleton = isLoading || isFetching || !isTableVisible;
  const SKELETON_ROWS = 6;

  return (
    <div className={buyerOutletPageShellClass}>
      <div className={buyerWorkspacePageStackClass}>
        <BuyerPageHero
          kicker="Buyer · PR"
          title="PR được phân công"
          description="Danh sách yêu cầu mua hàng được giao cho bạn — tạo RFQ và theo dõi tiến độ"
          Icon={ClipboardList}
          tint="emerald"
          regionLabel="PR được phân công"
        />

        <article className={buyerWorkspaceFiltersCardClass}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-0 flex-[2]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Mã PR, phạm vi phụ trách..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
            <div className="flex min-w-[220px] flex-1 items-center gap-2">
              <Filter className="h-5 w-5 shrink-0 text-slate-500" strokeWidth={1.5} />
              <CustomSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="READY_FOR_RFQ">Sẵn sàng hỏi giá</option>
                <option value="COLLECTING_QUOTATION">Đang thu thập báo giá</option>
                <option value="AWAITING_PO">Chờ tạo PO</option>
                <option value="BUDGET_EXCEPTION_PENDING">Vượt ngân sách</option>
                <option value="PO_IN_PROGRESS">PO đang xử lý</option>
                <option value="QUOTATION_COMPLETED">Đã hoàn thành báo giá</option>
                <option value="AWAITING_REORDER">Còn item cần mua</option>
              </CustomSelect>
            </div>
          </div>
        </article>

        <article className={buyerWorkspaceDataCardClass}>
          <div className={buyerWorkspaceTableTitleBarClass}>
            <h2 className="text-xl font-bold text-slate-900">Danh sách ({filteredPRs.length} PR)</h2>
          </div>
          <div className={`relative w-full ${buyerWorkspaceTableViewportClass}`}>
            {showTableSkeleton && (
              <div className="absolute inset-0 z-20 bg-white">
                <table className={`${buyerInteractiveTableClass} w-full min-w-[920px] bg-white`}>
                  <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Mã PR</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">SO / dự án</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Phạm vi phụ trách</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Trạng thái</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Ngày phân công</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className={buyerInteractiveTableBodyClass}>
                    {Array.from({ length: SKELETON_ROWS }).map((_, idx) => (
                      <tr key={`skeleton-${idx}`} className={`h-[72px] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FBFCFE]'}`}>
                        <td className="px-6 py-4" colSpan={6}>
                          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filteredPRs.length > 0 ? (
              <table
                className={`${buyerInteractiveTableClass} w-full min-w-[920px] bg-white`}
                style={{ visibility: showTableSkeleton ? 'hidden' : 'visible' }}
              >
                <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 backdrop-blur-[12px]">
                  <tr>
                    <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Mã PR</th>
                    <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">SO / dự án</th>
                    <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Phạm vi phụ trách</th>
                    <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Trạng thái</th>
                    <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Ngày phân công</th>
                    <th className="bg-slate-50/95 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Thao tác</th>
                  </tr>
                </thead>
                <tbody className={buyerInteractiveTableBodyClass}>
                  {filteredPRs.map((pr: any, index: number) => (
                    <tr
                      key={pr?.id || index}
                      onClick={() => pr?.id && handleViewPRDetails(pr.id)}
                      className={`group ${pr?.id ? buyerTableRowInteractive(index) : buyerTableDataRowVisual(index)}`}
                      style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
                    >
                      <td className="relative whitespace-nowrap px-6 py-4">
                        <div aria-hidden className={buyerTableAccentRailClass} />
                        <div className={`${buyerTableFirstCellInnerClass} ${buyerTableCellWrapClass}`}>
                          <span className="text-sm font-bold text-slate-900">{pr?.prNumber || '-'}</span>
                        </div>
                      </td>
                      <td className="max-w-xs px-6 py-4 align-top">
                        <div className={buyerTableCellWrapClass}>
                          <PRSalesOrderLine salesOrder={pr?.salesOrder} showWhenEmpty />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-normal text-slate-600">
                        <div className={buyerTableCellWrapClass}>{pr?.scope || '-'}</div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className={buyerTableCellWrapClass} onClick={(e) => e.stopPropagation()}>
                          {pr?.status === 'AWAITING_REORDER' && (pr?.awaitingPurchaseCount ?? 0) > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPRId(pr.id);
                                setIsDetailModalOpen(true);
                                setOpenRepurchaseAfterLoad(true);
                              }}
                              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:brightness-95 ${getStatusBadge('AWAITING_REORDER')}`}
                              title="Tạo RFQ mới"
                            >
                              <Plus className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                              {getStatusLabel('AWAITING_REORDER', pr.awaitingPurchaseCount)}
                            </button>
                          ) : (
                            <span
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusBadge(pr?.status || 'READY_FOR_RFQ')}`}
                            >
                              {getStatusLabel(pr?.status || 'READY_FOR_RFQ', pr?.awaitingPurchaseCount)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-normal text-slate-600">
                        <div className={buyerTableCellWrapClass}>
                          {pr?.assignedDate ? new Date(pr.assignedDate).toLocaleDateString('vi-VN') : '-'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div
                          className={`${buyerTableCellWrapFlexClass} gap-2`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewPRDetails(pr.id, e);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-soft transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4" strokeWidth={2} />
                          </button>
                          {pr?.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/dashboard/buyer/assigned-prs/${pr.id}`);
                              }}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-soft transition-colors"
                              title="Yêu cầu bổ sung thông tin"
                            >
                              <MessageSquare className="w-4 h-4" strokeWidth={2} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div
                className="flex min-h-[12rem] flex-col bg-white"
                style={{ visibility: showTableSkeleton ? 'hidden' : 'visible' }}
              >
                <table className={`${buyerInteractiveTableClass} w-full min-w-[920px] bg-white`}>
                  <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 backdrop-blur-[12px]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Mã PR</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">SO / dự án</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Phạm vi phụ trách</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Trạng thái</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Ngày phân công</th>
                      <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Thao tác</th>
                    </tr>
                  </thead>
                </table>
                <div className="flex flex-1 min-h-[300px] items-center justify-center px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <FileQuestion className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
                    <p className="font-medium text-slate-600">
                      {totalFromApi === 0
                        ? 'Chưa có PR nào được phân công cho tài khoản này'
                        : 'Không tìm thấy PR phù hợp'}
                    </p>
                    <p className="max-w-sm text-xs text-slate-500">
                      {totalFromApi === 0 ? (
                        <>
                          Đang đăng nhập:{' '}
                          <span className="font-semibold text-slate-700">
                            {currentUser?.username ?? '—'}
                          </span>
                          . PR chỉ hiện với buyer được Leader giao — kiểm tra đúng tài khoản hoặc nhờ
                          phân công lại.
                        </>
                      ) : (
                        'Thử đổi bộ lọc hoặc từ khóa tìm kiếm'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex-none border-t border-slate-200 bg-white px-3 py-3 sm:px-4">
            <div className="text-sm text-slate-600">
              <p>
                Hiển thị <span className="font-semibold text-slate-900">{filteredPRs.length}</span> /{' '}
                <span className="font-semibold text-slate-900">{totalFromApi}</span> PR
              </p>
            </div>
          </div>
      </article>
      </div>

      {/* PR Details Modal — render qua portal để overlay phủ toàn màn hình */}
      {isDetailModalOpen && selectedPRId && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn sm:p-5"
          onClick={handleCloseDetailModal}
        >
          <div
            className="modal-popup-panel relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] animate-slideUpFadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header - Glassmorphism */}
            <div className="relative flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-5 py-4 backdrop-blur-md sm:px-6 sm:py-5">
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1">Chi tiết Purchase Request</h2>
                {prDetails && (
                  <div className="space-y-1">
                    <p className="text-2xl sm:text-3xl font-black text-indigo-900">
                      {prDetails.prNumber}
                    </p>
                    <PRSalesOrderLine salesOrder={(prDetails as any).salesOrder} showWhenEmpty />
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  {prDetails && !isLoadingPRDetails && !prDetailsError ? (
                    prDetails.rfq ? (
                      <span className="inline-flex max-w-[12rem] items-center gap-1.5 truncate rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 sm:max-w-none sm:text-sm">
                        <FileQuestion className="h-4 w-4 shrink-0" strokeWidth={2} />
                        <span className="truncate">{prDetails.rfq.rfqNumber}</span>
                      </span>
                    ) : prDetails.assignment && (canCreateRepurchaseRfq || !prDetails.rfq) ? (
                      <button
                        type="button"
                        onClick={() => handleCreateRFQ(canCreateRepurchaseRfq)}
                        disabled={createRFQMutation.isPending}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:px-4 sm:py-2.5 sm:text-sm"
                      >
                        {createRFQMutation.isPending ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span className="hidden sm:inline">Đang tạo...</span>
                          </>
                        ) : (
                          <>
                            <FileQuestion className="h-4 w-4 shrink-0" strokeWidth={2} />
                            Tạo RFQ mới
                          </>
                        )}
                      </button>
                    ) : null
                  ) : null}
                  <button
                    onClick={handleCloseDetailModal}
                    className="rounded-xl p-2 transition-colors hover:bg-slate-200/70"
                    type="button"
                    aria-label="Đóng"
                  >
                    <X className="h-5 w-5 text-slate-600" strokeWidth={2} />
                  </button>
                </div>
                {prDetails?.rfq?.id && !isLoadingPRDetails && !prDetailsError ? (
                  <button
                    type="button"
                    onClick={handleOpenRfqManagement}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 sm:text-sm"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    Quản lý RFQ
                  </button>
                ) : null}
              </div>
            </div>

            {/* Modal Body - 2 Column Architecture */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {isLoadingPRDetails ? (
                <div className="flex min-h-[420px] items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Đang tải chi tiết PR...</p>
                  </div>
                </div>
              ) : prDetailsError ? (
                <div className="flex min-h-[420px] items-center justify-center py-12">
                  <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <X className="w-8 h-8 text-red-600" strokeWidth={2} />
                    </div>
                    <p className="text-red-600 font-medium mb-1">Lỗi khi tải chi tiết PR</p>
                    <p className="text-slate-500 text-sm mb-2">
                      {(prDetailsError as any)?.response?.data?.message || 
                       (prDetailsError instanceof Error ? prDetailsError.message : 'Vui lòng thử lại sau')}
                    </p>
                    {(prDetailsError as any)?.response?.status === 403 && (
                      <p className="text-xs text-amber-600 mt-2">
                        💡 PR này có thể không được phân công cho bạn hoặc đã bị thu hồi phân công.
                      </p>
                    )}
                    {(prDetailsError as any)?.response?.status === 404 && (
                      <p className="text-xs text-amber-600 mt-2">
                        💡 PR này có thể không tồn tại hoặc đã bị xóa.
                      </p>
                    )}
                  </div>
                </div>
              ) : !prDetails ? (
                <div className="flex min-h-[420px] items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-slate-400" strokeWidth={2} />
                    </div>
                    <p className="text-slate-600 font-medium mb-1">Không tìm thấy thông tin PR</p>
                    <p className="text-slate-500 text-sm">PR có thể không tồn tại hoặc không được phân công cho bạn</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-0 lg:min-h-full lg:flex-row">
                  {/* Main Column - Lớn */}
                  <div className="min-w-0 flex-[3] space-y-4 p-4 sm:p-5 lg:border-r lg:border-slate-200/70">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 p-4 text-white shadow-md shadow-emerald-500/25">
                        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">
                          Giá trị PR
                        </p>
                        <p className="mt-1 leading-tight">
                          <BuyerHiddenPrice size="lg" suffix={prDetails.currency || 'VND'} />
                        </p>
                        <DollarSign className="absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} />
                      </div>
                      <div
                        className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 p-4 text-white shadow-md shadow-violet-500/25 ${
                          canCreateRepurchaseRfq
                            ? 'cursor-pointer ring-2 ring-transparent transition hover:ring-white/40'
                            : ''
                        }`}
                        role={canCreateRepurchaseRfq ? 'button' : undefined}
                        tabIndex={canCreateRepurchaseRfq ? 0 : undefined}
                        title={
                          canCreateRepurchaseRfq
                            ? 'Bấm để tạo RFQ mới cho item cần mua lại'
                            : undefined
                        }
                        onClick={canCreateRepurchaseRfq ? openRepurchaseFromStatus : undefined}
                        onKeyDown={
                          canCreateRepurchaseRfq
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  openRepurchaseFromStatus();
                                }
                              }
                            : undefined
                        }
                      >
                        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-100">
                          Trạng thái PR
                        </p>
                        <p className="mt-1 text-sm font-bold leading-snug">
                          {getStatusLabel(prDetails.status, prDetails.awaitingPurchaseCount)}
                        </p>
                        {canCreateRepurchaseRfq ? (
                          <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-violet-100/95">
                            <Plus className="h-3 w-3" strokeWidth={2.5} />
                            Bấm để tạo RFQ mới
                          </p>
                        ) : null}
                        <ClipboardList className="absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} />
                      </div>
                      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 p-4 text-white shadow-md shadow-orange-500/25">
                        <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-100">
                          Ngày cần
                        </p>
                        <p className="mt-1 text-lg font-black leading-tight">
                          {formatDate(prDetails.requiredDate)}
                        </p>
                        <Calendar className="absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} />
                      </div>
                    </div>

                    {/* Purpose - High-Value Card */}
                    {prDetails.purpose && (
                      <div className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50/50 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Info className="w-4 h-4 text-violet-600" strokeWidth={2} />
                          <p className="text-xs font-bold uppercase tracking-wide text-violet-900">Mục đích sử dụng</p>
                        </div>
                        <p className="text-sm text-slate-800 font-medium leading-relaxed">{prDetails.purpose}</p>
                      </div>
                    )}

                    {/* Attachments & Links */}
                    {(() => {
                      const prAtt = ((prDetails as { attachments?: Array<{ id: string; fileName: string; fileUrl: string }> })
                        .attachments ?? []) as Array<{ id: string; fileName: string; fileUrl: string }>;
                      const items = (prDetails.items ?? []) as Array<{
                        id?: string;
                        lineNo?: number;
                        attachments?: Array<{ id: string; fileName: string; fileUrl: string }>;
                        spec?: string | null;
                        remark?: string | null;
                      }>;
                      const textUrls = new Set<string>();
                      extractHttpUrls(prDetails.notes).forEach((u) => textUrls.add(u));
                      items.forEach((it) => {
                        extractHttpUrls(it.spec).forEach((u) => textUrls.add(u));
                        extractHttpUrls(it.remark).forEach((u) => textUrls.add(u));
                      });
                      const hasAny =
                        prAtt.length > 0 ||
                        items.some((it) => (it.attachments?.length ?? 0) > 0) ||
                        textUrls.size > 0;
                      if (!hasAny) return null;
                      return (
                        <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm">
                          <div className="mb-3 flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-sky-700" strokeWidth={2} />
                            <p className="text-sm font-semibold text-sky-900">Tài liệu & link từ requestor</p>
                          </div>
                          <div className="space-y-3 text-sm">
                            {prAtt.length > 0 && (
                              <div>
                                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sky-800/80">
                                  Đính kèm PR
                                </p>
                                <ul className="space-y-1.5">
                                  {prAtt.map((a) => {
                                    const href = toAbsoluteAttachmentHref(a.fileUrl);
                                    return (
                                      <li key={a.id}>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void openAttachmentWithAuth(href, (m) => showError(m), a.fileName)
                                          }
                                          className="inline-flex w-full max-w-full items-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-left text-sky-800 hover:bg-sky-100"
                                        >
                                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                          <span className="truncate font-medium" title={a.fileName}>
                                            {a.fileName}
                                          </span>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                            {items.some((it) => (it.attachments?.length ?? 0) > 0) && (
                              <div>
                                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sky-800/80">
                                  Đính kèm theo dòng hàng
                                </p>
                                <ul className="space-y-2">
                                  {items.map((it) => {
                                    const att = it.attachments ?? [];
                                    if (!att.length) return null;
                                    return (
                                      <li key={it.id ?? String(it.lineNo)} className="rounded-lg border border-sky-100 bg-white/90 p-2">
                                        <p className="mb-1 text-xs text-slate-600">
                                          Dòng <span className="font-semibold text-slate-800">{it.lineNo ?? '—'}</span>
                                        </p>
                                        <ul className="space-y-1">
                                          {att.map((a) => {
                                            const href = toAbsoluteAttachmentHref(a.fileUrl);
                                            return (
                                              <li key={a.id}>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    void openAttachmentWithAuth(href, (m) => showError(m), a.fileName)
                                                  }
                                                  className="inline-flex w-full max-w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sky-800 hover:bg-sky-50"
                                                >
                                                  <Paperclip className="h-3.5 w-3.5 shrink-0" />
                                                  <span className="truncate text-xs font-medium">{a.fileName}</span>
                                                </button>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                            {textUrls.size > 0 && (
                              <div>
                                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sky-800/80">
                                  Link trong ghi chú / mô tả
                                </p>
                                <ul className="space-y-1.5">
                                  {Array.from(textUrls).map((url) => (
                                    <li key={url}>
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex max-w-full items-center gap-2 break-all rounded-lg border border-indigo-200 bg-indigo-50/90 px-3 py-2 text-xs font-medium text-indigo-800 hover:bg-indigo-100"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                        {url}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                  {/* Items Table */}
                  {prDetails.items && prDetails.items.length > 0 ? (
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Package className="w-5 h-5 text-slate-600" strokeWidth={2} />
                        Danh sách vật tư/dịch vụ ({prDetails.items.length})
                      </h3>
                      
                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200">
                        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                          <table className="w-full">
                            <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                              <tr>
                                <th className="px-2.5 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">STT</th>
                                <th className="px-2.5 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Số linh kiện</th>
                                <th className="px-2.5 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Tên</th>
                                <th className="px-2.5 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide min-w-[10rem]">Spec</th>
                                <th className="px-2.5 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">SL</th>
                                <th className="px-2.5 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">ĐV</th>
                                <th className="px-2.5 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Đơn giá</th>
                                <th className="px-2.5 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Thành tiền</th>
                                <th className="px-2.5 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Trạng thái</th>
                                <th className="px-2.5 py-2 text-left text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Remark</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {prDetails.items.map((item: any, index: number) => {
                                const itemStatus = item.status || 'NEW';
                                return (
                                  <tr key={item.id || index} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-2.5 py-2 text-xs leading-5 text-slate-600 align-top">{index + 1}</td>
                                    <td className="max-w-[132px] px-2.5 py-2 text-xs leading-5 text-slate-900 font-medium align-top">
                                      <span className="block truncate" title={item.partNumber || item.partNo || '-'}>
                                        {item.partNumber || item.partNo || '-'}
                                      </span>
                                    </td>
                                    <td className="max-w-[190px] px-2.5 py-2 text-xs leading-5 text-slate-900 align-top">
                                      <span className="line-clamp-2">{item.itemName || item.description || '-'}</span>
                                    </td>
                                    <td className="px-2.5 py-2 text-xs leading-5 align-top">
                                      <div className="max-w-xs space-y-1">
                                        {item.spec?.trim() ? (
                                          <p className="line-clamp-2 text-xs leading-5 text-slate-700">{item.spec}</p>
                                        ) : (
                                          <span className="text-xs text-slate-400">-</span>
                                        )}
                                        {(() => {
                                          const href = safeReferenceHref(item.referenceUrl);
                                          if (!href) return null;
                                          return (
                                            <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                                              <ExternalLink className="h-3 w-3 shrink-0" />
                                              Link
                                            </a>
                                          );
                                        })()}
                                        {(item.attachments ?? []).length > 0 && (
                                          <div className="mt-1 space-y-1">
                                            {(item.attachments ?? []).map((a: { id: string; fileName: string; fileUrl: string }) => {
                                              const h = toAbsoluteAttachmentHref(a.fileUrl);
                                              return (
                                                <button
                                                  key={a.id}
                                                  type="button"
                                                  onClick={() => void openAttachmentWithAuth(h, (m) => showError(m), a.fileName)}
                                                  className="flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] text-sky-700 hover:bg-sky-50"
                                                >
                                                  <Paperclip className="h-3 w-3 shrink-0" />
                                                  <span className="truncate max-w-[120px]">{a.fileName}</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-2.5 py-2 text-xs leading-5 text-slate-900 align-top">{item.qty || '-'}</td>
                                    <td className="px-2.5 py-2 text-xs leading-5 text-slate-600 align-top">{item.unit || '-'}</td>
                                    <td className="px-2.5 py-2 text-xs leading-5 whitespace-nowrap align-top">
                                      {item.unitPrice ? <BuyerHiddenPrice size="sm" /> : '-'}
                                    </td>
                                    <td className="px-2.5 py-2 text-xs leading-5 font-medium whitespace-nowrap align-top">
                                      {item.amount ? <BuyerHiddenPrice size="sm" /> : '-'}
                                    </td>
                                    <td className="px-2.5 py-2 text-xs leading-5 align-top">
                                      <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-semibold rounded-full border whitespace-nowrap ${getItemStatusBadge(itemStatus)}`}>
                                        {getItemStatusLabel(itemStatus)}
                                      </span>
                                    </td>
                                    <td className="max-w-[160px] px-2.5 py-2 text-xs leading-5 text-slate-600 align-top">
                                      <span className="line-clamp-2">{item.remark || '-'}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-3 max-h-[520px] overflow-y-auto">
                        {prDetails.items.map((item: any, index: number) => {
                          const itemStatus = item.status || 'NEW';
                          return (
                            <div key={item.id || index} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                              {/* Header */}
                              <div className="flex items-start justify-between mb-2 pb-2 border-b border-slate-100">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
                                    {item.partNumber || item.partNo ? (
                                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                        {item.partNumber || item.partNo}
                                      </span>
                                    ) : null}
                                  </div>
                                  <h4 className="text-sm font-semibold text-slate-900 line-clamp-2">
                                    {item.itemName || item.description || 'N/A'}
                                  </h4>
                                </div>
                                <span className={`ml-2 shrink-0 inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getItemStatusBadge(itemStatus)}`}>
                                  {getItemStatusLabel(itemStatus)}
                                </span>
                              </div>

                              {/* Spec */}
                              {item.spec?.trim() && (
                                <div className="mb-2">
                                  <p className="text-xs text-slate-500 mb-1 font-medium">Spec</p>
                                  <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">{item.spec}</p>
                                </div>
                              )}

                              {/* Attachments */}
                              {(item.attachments ?? []).length > 0 && (
                                <div className="mb-2 space-y-1">
                                  {(item.attachments ?? []).map((a: { id: string; fileName: string; fileUrl: string }) => {
                                    const h = toAbsoluteAttachmentHref(a.fileUrl);
                                    return (
                                      <button
                                        key={a.id}
                                        type="button"
                                        onClick={() => void openAttachmentWithAuth(h, (m) => showError(m), a.fileName)}
                                        className="flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-700 w-full"
                                      >
                                        <Paperclip className="h-3 w-3 shrink-0" />
                                        <span className="truncate">{a.fileName}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Details Grid */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-slate-500">Số lượng</span>
                                  <p className="font-semibold text-slate-900">{item.qty || '-'} {item.unit || ''}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500">Đơn giá</span>
                                  <p className="font-semibold text-slate-900">
                                    {item.unitPrice ? <BuyerHiddenPrice size="sm" /> : '-'}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <span className="text-slate-500">Thành tiền</span>
                                  <p className="text-sm">
                                    {item.amount ? <BuyerHiddenPrice size="sm" /> : '-'}
                                  </p>
                                </div>
                                {item.remark && (
                                  <div className="col-span-2 pt-2 border-t border-slate-100">
                                    <span className="text-slate-500">Remark</span>
                                    <p className="text-slate-700">{item.remark}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-6">
                      <div className="flex items-start gap-3">
                        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={2} />
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 text-sm font-semibold text-amber-900">
                            {prDetails.assignment
                              ? 'Không có dòng hàng hiển thị trong phạm vi phân công'
                              : 'Chưa có items được phân công'}
                          </p>
                          <p className="text-pretty break-words text-xs leading-relaxed text-amber-800 sm:text-sm">
                            {prDetails.assignment
                              ? 'Theo phân công vẫn có thể có dòng thuộc phạm vi của bạn nhưng chưa tải được. Thử đóng và mở lại chi tiết PR, hoặc liên hệ Buyer Leader nếu vẫn trống.'
                              : 'PR này chưa có items nào được phân công cho bạn. Vui lòng liên hệ Buyer Leader.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {prDetails.notes && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-slate-600" strokeWidth={2} />
                        <p className="text-sm font-semibold text-slate-900">Ghi chú</p>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{prDetails.notes}</p>
                    </div>
                  )}

                </div>

                  {/* Sidebar - Nhỏ */}
                  <div className="flex flex-col gap-4 bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5 lg:w-80 lg:shrink-0">
                    {/* Metadata Cards */}
                    <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-800 text-white shadow-lg shadow-indigo-900/30">
                      <div className="border-b border-indigo-700/40 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-300">Thông tin chứng từ</p>
                      </div>
                      <div className="space-y-3 px-4 py-3">
                      
                      <div className="flex items-start gap-3">
                        <Building2 className="w-4 h-4 text-indigo-300 mt-0.5" strokeWidth={2} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-indigo-300 mb-0.5">Phòng ban</p>
                          <p className="text-sm font-semibold text-white">{prDetails.department || 'N/A'}</p>
                        </div>
                      </div>

                      {prDetails.requestor && (
                        <div className="flex items-start gap-3">
                          <User className="w-4 h-4 text-indigo-300 mt-0.5" strokeWidth={2} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-indigo-300 mb-0.5">Người yêu cầu</p>
                            <p className="text-sm font-semibold text-white">{prDetails.requestor.username || 'N/A'}</p>
                          </div>
                        </div>
                      )}

                      {prDetails.requiredDate && (
                        <div className="flex items-start gap-3">
                          <Calendar className="w-4 h-4 text-indigo-300 mt-0.5" strokeWidth={2} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-indigo-300 mb-0.5">Ngày cần</p>
                            <p className="text-sm font-semibold text-white">{formatDate(prDetails.requiredDate)}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <Calendar className="w-4 h-4 text-indigo-300 mt-0.5" strokeWidth={2} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-indigo-300 mb-0.5">Ngày tạo</p>
                          <p className="text-sm font-semibold text-white">{formatDate(prDetails.createdAt)}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-indigo-300 mb-1">Trạng thái</p>
                        {canCreateRepurchaseRfq ? (
                          <button
                            type="button"
                            onClick={openRepurchaseFromStatus}
                            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition hover:brightness-95 ${getStatusBadge(prDetails.status)}`}
                            title="Tạo RFQ mới cho item cần mua lại"
                          >
                            <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                            {getStatusLabel(prDetails.status, prDetails.awaitingPurchaseCount)}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex px-3 py-1.5 text-xs font-semibold rounded-full border bg-white/90 ${getStatusBadge(prDetails.status)}`}
                          >
                            {getStatusLabel(prDetails.status, prDetails.awaitingPurchaseCount)}
                          </span>
                        )}
                      </div>
                    </div>
                    </div>

                    {/* Tổng tiền - High-Value Card */}
                    <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign className="w-5 h-5 text-emerald-600" strokeWidth={2} />
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">
                          Tổng tiền {prDetails.assignment?.scope === 'PARTIAL' ? '(items được giao)' : ''}
                        </p>
                      </div>
                      <p className="text-emerald-700">
                        <BuyerHiddenPrice size="xl" suffix={prDetails.currency || 'VND'} />
                      </p>
                    </div>

                    {/* Assignment Info */}
                    {prDetails.assignment && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-start gap-2 mb-2">
                          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
                          <p className="text-xs font-semibold text-amber-900">Phạm vi phân công</p>
                        </div>
                        <p className="text-sm text-slate-700 mb-1">
                          {prDetails.assignment.scope === 'FULL' ? 'Toàn bộ PR' : 'Một phần PR'}
                        </p>
                        {prDetails.assignment.note && (
                          <p className="text-xs text-slate-600 mt-2">
                            <span className="font-medium">Ghi chú:</span> {prDetails.assignment.note}
                          </p>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-3 px-5 py-4 sm:px-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={handleCloseDetailModal}
                className="px-6 py-2 text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm hover:shadow-md"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create RFQ Modal - Select Items (hiển thị trên PR Detail, dùng portal + z cao hơn) */}
      {showCreateRFQModal && prDetails && createPortal(
        <div
          className="fixed inset-0 z-[140] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm modal-popup-overlay sm:items-center sm:p-4"
          onClick={() => { setShowCreateRFQModal(false); setSelectedItemIds(new Set()); }}
        >
          <div
            className="modal-popup-panel flex max-h-[min(94dvh,100dvh)] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-white/60 bg-white shadow-[0_34px_72px_-12px_rgba(15,23,42,0.34)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/80 bg-white/85 px-5 py-4 backdrop-blur-md sm:px-6">
              <div className="min-w-0 flex-1 pr-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">RFQ Workspace</p>
                <h3 className="truncate text-xl font-black tracking-tight text-slate-900">Tạo RFQ mới</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {canCreateRepurchaseRfq
                    ? 'Chọn item cần mua lại (sau hủy dòng PO) — RFQ mới sẽ hiện tại Quản lý RFQ.'
                    : 'Nhóm item chưa khóa để tạo RFQ cho PR này.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCreateRFQModal(false);
                  setSelectedItemIds(new Set());
                }}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4 [scrollbar-width:thin] sm:p-5">
              {(() => {
                const availableItems = prDetails.items?.filter((item: any) => !item.isLocked) || [];
                const lockedItems = prDetails.items?.filter((item: any) => item.isLocked) || [];
                const allAvailableSelected = availableItems.length > 0 && availableItems.every((item: any) => selectedItemIds.has(item.id));
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 p-3 text-white shadow-md shadow-slate-700/25">
                        <div className="absolute -right-3 -top-3 h-14 w-14 rounded-full bg-white/10" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-200">Tổng item</p>
                        <p className="mt-1 text-2xl font-black leading-tight">{prDetails.items?.length || 0}</p>
                      </div>
                      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 p-3 text-white shadow-md shadow-emerald-500/25">
                        <div className="absolute -right-3 -top-3 h-14 w-14 rounded-full bg-white/10" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">Có thể chọn</p>
                        <p className="mt-1 text-2xl font-black leading-tight">{availableItems.length}</p>
                      </div>
                      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-3 text-white shadow-md shadow-blue-500/25">
                        <div className="absolute -right-3 -top-3 h-14 w-14 rounded-full bg-white/10" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">Đã chọn</p>
                        <p className="mt-1 text-2xl font-black leading-tight">{selectedItemIds.size}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={allAvailableSelected}
                          onChange={(e) => {
                            if (e.target.checked && availableItems.length > 0) {
                              setSelectedItemIds(new Set(availableItems.map((item: any) => item.id)));
                            } else {
                              setSelectedItemIds(new Set());
                            }
                          }}
                          className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-semibold text-slate-700">
                          Chọn tất cả item có thể chọn ({availableItems.length})
                        </span>
                      </label>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="max-h-[48vh] overflow-auto [scrollbar-width:thin]">
                        <table className="w-full min-w-[760px] border-separate border-spacing-0">
                          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 backdrop-blur-sm">
                            <tr>
                              <th className="w-12 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600"></th>
                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">STT</th>
                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">Mô tả</th>
                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">SL</th>
                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">Đơn giá</th>
                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {prDetails.items?.map((item: any, index: number) => {
                              const isSelected = selectedItemIds.has(item.id);
                              const isLocked = item.isLocked;
                              return (
                                <tr
                                  key={item.id}
                                  className={`group transition-colors ${isSelected ? 'bg-blue-50/60' : 'bg-white'} ${isLocked ? 'bg-slate-50/80 opacity-70' : 'hover:bg-indigo-50/35'}`}
                                >
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      disabled={isLocked}
                                      onChange={(e) => {
                                        if (isLocked) return;
                                        const newSet = new Set(selectedItemIds);
                                        if (e.target.checked) newSet.add(item.id);
                                        else newSet.delete(item.id);
                                        setSelectedItemIds(newSet);
                                      }}
                                      className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{item.lineNo || index + 1}</td>
                                  <td className="px-4 py-3 text-sm text-slate-900">
                                    <span className="block line-clamp-2">{item.description}</span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700">{item.qty} {item.unit || ''}</td>
                                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                    <BuyerHiddenPrice size="sm" suffix={prDetails.currency} />
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    {isLocked ? (
                                      <span className="inline-flex rounded-full border border-rose-200 bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                        Đã khóa ({item.lockedByRFQ?.rfqNumber})
                                      </span>
                                    ) : (
                                      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                        Có thể chọn
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {lockedItems.length > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs text-amber-800">
                          <span className="font-semibold">Lưu ý:</span> {lockedItems.length} item đã thuộc RFQ khác và bị khóa.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
              <p className="text-sm text-slate-600">
                Đã chọn <span className="font-semibold text-blue-600">{selectedItemIds.size}</span> item để tạo RFQ.
              </p>
              <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowCreateRFQModal(false);
                  setSelectedItemIds(new Set());
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmCreateRFQ}
                disabled={createRFQMutation.isPending || selectedItemIds.size === 0}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {createRFQMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Đang tạo...
                  </>
                ) : (
                  'Tạo RFQ'
                )}
              </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AssignedPR;

