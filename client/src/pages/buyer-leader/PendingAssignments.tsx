import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, User, Building2, DollarSign, Calendar, ArrowRight, X, Mail, MapPin, Package, Info, FileText, AlertTriangle, Globe, Home, Save, CheckCircle2 } from 'lucide-react';
import { buyerLeaderService } from '../../services/buyerLeaderService';
import CustomSelect from '../../components/CustomSelect';
import { useToast } from '../../contexts/ToastContext';
import { BuyerLeaderPageHero } from '../../components/BuyerLeaderPageHero';
import { AppModal } from '../../components/AppModal';
import { saasTableHeadCellClass, saasPrStatusBadgeClass } from '../../constants/saasDataTable';
import { getPRStatusLabel } from '../../constants/statusLabels';
import { formatIsoDateToDdMmYyyy } from '../../utils/dateDisplay';
import { buyerLeaderPageStackClass } from '../../constants/buyerLeaderLayout';

const formatCurrency = (amount: number | null, currency: string = 'VND') => {
  if (!amount) return 'Chưa có';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

interface ItemAssignment {
  itemId: string;
  buyerId: string | null;
  purchaseType: 'OVERSEA' | 'DOMESTIC' | null;
  note: string;
}

const PendingAssignments = () => {
  const [selectedPR, setSelectedPR] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [itemAssignments, setItemAssignments] = useState<Record<string, ItemAssignment>>({});
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const { data, isLoading, error } = useQuery({
    queryKey: ['buyer-leader-pending-assignments'],
    queryFn: () => buyerLeaderService.getPendingAssignments(),
  });

  const { data: buyersData, isLoading: isLoadingBuyers } = useQuery({
    queryKey: ['buyer-leader-buyers'],
    queryFn: () => buyerLeaderService.getBuyers(),
    enabled: isModalOpen, // Only fetch when modal is open
  });

  const { data: prDetailsForAssign, isLoading: isLoadingPRForAssign } = useQuery({
    queryKey: ['buyer-leader-pr-details-assign', selectedPR?.id],
    queryFn: () => buyerLeaderService.getPRDetails(selectedPR?.id!),
    enabled: !!selectedPR?.id && isModalOpen,
    retry: 1,
  });

  const { data: prDetails, isLoading: isLoadingPRDetails, error: prDetailsError } = useQuery({
    queryKey: ['buyer-leader-pr-details', selectedPRId],
    queryFn: () => buyerLeaderService.getPRDetails(selectedPRId!),
    enabled: !!selectedPRId && isDetailModalOpen,
    retry: 1,
  });

  const pendingPRs = data?.prs || [];
  const buyers = buyersData?.buyers || [];

  // Initialize item assignments when PR details are loaded
  useEffect(() => {
    if (prDetailsForAssign?.items && isModalOpen) {
      const initialAssignments: Record<string, ItemAssignment> = {};
      prDetailsForAssign.items.forEach((item: any) => {
        initialAssignments[item.id] = {
          itemId: item.id,
          buyerId: null,
          purchaseType: item.manufacturer && item.manufacturer.toLowerCase().includes('oversea') ? 'OVERSEA' : 'DOMESTIC',
          note: '',
        };
      });
      setItemAssignments(initialAssignments);
    }
  }, [prDetailsForAssign, isModalOpen]);

  const handleAssignClick = (pr: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPR(pr);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPR(null);
    setItemAssignments({});
  };

  const handleItemBuyerChange = (itemId: string, buyerId: string) => {
    setItemAssignments(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        buyerId,
      },
    }));
  };

  const handleItemPurchaseTypeChange = (itemId: string, purchaseType: 'OVERSEA' | 'DOMESTIC') => {
    setItemAssignments(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        purchaseType,
      },
    }));
  };

  const handleItemNoteChange = (itemId: string, note: string) => {
    setItemAssignments(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        note,
      },
    }));
  };

  // Quick Actions
  const handleAssignAllToBuyer = (buyerId: string) => {
    const updatedAssignments: Record<string, ItemAssignment> = {};
    Object.keys(itemAssignments).forEach(itemId => {
      updatedAssignments[itemId] = {
        ...itemAssignments[itemId],
        buyerId,
      };
    });
    setItemAssignments(updatedAssignments);
  };

  const handleSplitByPurchaseType = () => {
    // Find buyers for Oversea and Domestic
    const overseaBuyers = buyers.filter((b: any) => b.location && b.location.includes('OVERSEA'));
    const domesticBuyers = buyers.filter((b: any) => !b.location || !b.location.includes('OVERSEA'));
    
    const updatedAssignments: Record<string, ItemAssignment> = {};
    Object.keys(itemAssignments).forEach(itemId => {
      const assignment = itemAssignments[itemId];
      let assignedBuyerId = assignment.buyerId;
      
      if (!assignedBuyerId) {
        if (assignment.purchaseType === 'OVERSEA' && overseaBuyers.length > 0) {
          assignedBuyerId = overseaBuyers[0].id;
        } else if (assignment.purchaseType === 'DOMESTIC' && domesticBuyers.length > 0) {
          assignedBuyerId = domesticBuyers[0].id;
        }
      }
      
      updatedAssignments[itemId] = {
        ...assignment,
        buyerId: assignedBuyerId,
      };
    });
    setItemAssignments(updatedAssignments);
  };

  // Check if all items are assigned
  const unassignedItemsCount = Object.values(itemAssignments).filter(a => !a.buyerId).length;
  const canConfirm = unassignedItemsCount === 0 && Object.keys(itemAssignments).length > 0;

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async (data: { prId: string; assignments: Record<string, ItemAssignment> }) => {
      // Validation: Đảm bảo tất cả items đều được gán
      const totalItemsCount = Object.keys(data.assignments).length;
      const assignedItems = Object.values(data.assignments).filter(a => a.buyerId);
      
      if (assignedItems.length !== totalItemsCount) {
        throw new Error(`Còn ${totalItemsCount - assignedItems.length} item chưa được phân công`);
      }

      // Validation: Đảm bảo mỗi item chỉ được gán cho 1 buyer (logic này đã được đảm bảo bởi state structure)
      // Group items by buyer
      const buyerGroups: Record<string, string[]> = {};
      const itemBuyerMap: Record<string, string> = {}; // Track which buyer is assigned to each item
      
      Object.values(data.assignments).forEach(assignment => {
        if (assignment.buyerId) {
          // Đảm bảo mỗi item chỉ có 1 buyer
          if (itemBuyerMap[assignment.itemId]) {
            throw new Error(`Item ${assignment.itemId} đã được gán cho buyer khác`);
          }
          itemBuyerMap[assignment.itemId] = assignment.buyerId;
          
          if (!buyerGroups[assignment.buyerId]) {
            buyerGroups[assignment.buyerId] = [];
          }
          buyerGroups[assignment.buyerId].push(assignment.itemId);
        }
      });

      // Create assignments for each buyer
      const promises = Object.entries(buyerGroups).map(([buyerId, itemIds]) => {
        const isFull = itemIds.length === totalItemsCount;
        const notes = Object.values(data.assignments)
          .filter(a => a.buyerId === buyerId && a.note)
          .map(a => a.note)
          .join('; ');
        
        return buyerLeaderService.assignPR(data.prId, {
          buyerId,
          scope: isFull ? 'FULL' : 'PARTIAL',
          assignedItemIds: isFull ? undefined : itemIds,
          note: notes || `Phân công ${itemIds.length} item(s)`,
        });
      });

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-leader-pending-assignments'] });
      handleCloseModal();
      showSuccess('Đã phân công PR cho Buyer thành công.');
    },
    onError: (error: any) => {
      console.error('Assign error:', error);
      showError(error?.response?.data?.error || error?.message || 'Có lỗi xảy ra khi phân công PR');
    },
  });

  const handleSaveDraft = () => {
    // TODO: Implement save draft functionality
    console.log('Save draft:', itemAssignments);
  };

  const handleConfirmAssignment = () => {
    if (selectedPR?.id && canConfirm) {
      assignMutation.mutate({
        prId: selectedPR.id,
        assignments: itemAssignments,
      });
    }
  };

  // Display error message
  const assignmentError = assignMutation.error instanceof Error 
    ? assignMutation.error.message 
    : assignMutation.error 
      ? 'Có lỗi xảy ra khi phân công PR' 
      : null;

  const handleViewPRDetails = (prId: string) => {
    setSelectedPRId(prId);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedPRId(null);
  };

  const openAssignFromDetail = () => {
    const pr = pendingPRs.find((p: { id: string }) => p.id === selectedPRId);
    if (!pr) return;
    handleCloseDetailModal();
    setSelectedPR(pr);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className={`h-full min-h-0 w-full min-w-0 flex flex-col overflow-hidden p-6 ${buyerLeaderPageStackClass}`}>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-soft-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`h-full min-h-0 w-full min-w-0 flex flex-col overflow-hidden p-6 ${buyerLeaderPageStackClass}`}>
        <div className="bg-red-50 border border-red-200 rounded-soft p-4">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden flex flex-col relative ${buyerLeaderPageStackClass}`}
      style={{ backgroundColor: 'transparent' }}
    >
      {/* Banner */}
      <div className="flex-shrink-0 mb-4 px-2 pt-3 sm:px-3 sm:pt-4 md:px-4">
        <BuyerLeaderPageHero
          kicker="Buyer Leader · Assignment Workspace"
          title="Phân công PR cho Buyer"
          description="Xem và phân công các PR đã được duyệt cho Buyer xử lý."
          Icon={ClipboardList}
          tint="ocean"
          regionLabel="Phân công PR"
          rightSlot={
            <div className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 backdrop-blur-sm">
              <ClipboardList className="h-5 w-5 text-white" strokeWidth={2} />
              <div className="leading-tight">
                <p className="text-2xl font-black tabular-nums text-white">{pendingPRs.length}</p>
                <p className="text-[11px] font-semibold text-white/85">PR chờ phân công</p>
              </div>
            </div>
          }
        />
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-2 pb-3 sm:px-3 sm:pb-4 md:px-4">
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/50 bg-white shadow-lg slide-right-content" style={{ isolation: 'isolate', borderRadius: '1.25rem' }}>
          {/* Table Header */}
          <div className="flex-shrink-0 overflow-hidden border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-slate-100" style={{ borderTopLeftRadius: '1.25rem', borderTopRightRadius: '1.25rem' }}>
            <div className="grid grid-cols-12 gap-4 px-6 py-4 text-sm font-semibold text-slate-700">
              <div className="col-span-1 inline-flex items-center gap-1.5"><span className="text-indigo-600">#</span>STT</div>
              <div className="col-span-2 inline-flex items-center gap-1.5"><FileText className="h-4 w-4 text-indigo-600" strokeWidth={2} />Mã PR</div>
              <div className="col-span-2 inline-flex items-center gap-1.5"><User className="h-4 w-4 text-cyan-600" strokeWidth={2} />Người yêu cầu</div>
              <div className="col-span-2 inline-flex items-center gap-1.5"><Building2 className="h-4 w-4 text-slate-600" strokeWidth={2} />Phòng ban</div>
              <div className="col-span-2 inline-flex items-center gap-1.5"><DollarSign className="h-4 w-4 text-emerald-600" strokeWidth={2} />Tổng tiền</div>
              <div className="col-span-2 inline-flex items-center gap-1.5"><Calendar className="h-4 w-4 text-amber-600" strokeWidth={2} />Ngày tạo</div>
              <div className="col-span-1 inline-flex items-center gap-1.5"><ArrowRight className="h-4 w-4 text-violet-600" strokeWidth={2} />Hành động</div>
            </div>
          </div>

          {/* Table Body — cuộn trong phần cao còn lại của viewport */}
          <div 
            className="min-h-0 flex-1 overflow-y-auto overflow-x-auto bg-white" 
            style={{ 
              borderBottomLeftRadius: '1.25rem', 
              borderBottomRightRadius: '1.25rem',
            }}
          >
            <div className="bg-white w-full min-w-[1120px]">
              {pendingPRs.length === 0 ? (
                <div className="h-full min-h-[400px] flex items-center justify-center">
                  <div className="text-center">
                    <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
                    <p className="text-slate-500 text-lg font-medium">Không có PR nào chờ phân công</p>
                    <p className="text-slate-400 text-sm mt-2">Tất cả PR đã được phân công hoặc chưa được duyệt</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100/50 w-full min-w-[1120px] bg-white">
                  {pendingPRs.map((pr: any, index: number) => (
                    <div
                      key={pr.id}
                      className="group grid min-w-[1120px] grid-cols-12 gap-4 px-6 py-4 transition-all duration-300 ease-out hover:-translate-y-[1px] hover:bg-indigo-50/70 cursor-pointer slide-right-item w-full flex-shrink-0"
                      style={{ animationDelay: `${0.5 + index * 0.03}s` }}
                      onClick={() => handleViewPRDetails(pr.id)}
                    >
                      <div className="col-span-1 relative flex items-center text-sm text-slate-600">
                        <div aria-hidden className="pointer-events-none absolute inset-y-0 -left-6 w-[3px] rounded-r-full bg-indigo-600 opacity-0 transition-all duration-300 group-hover:opacity-100" />
                        {index + 1}
                      </div>
                      <div className="col-span-2 flex items-center">
                        <span className="text-sm font-medium text-slate-900">{pr.prNumber}</span>
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400 flex-shrink-0" strokeWidth={2} />
                        <span className="text-sm text-slate-700 min-w-0 truncate">
                          {pr.requestor?.username || 'N/A'}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" strokeWidth={2} />
                        <span className="text-sm text-slate-700 min-w-0 truncate">
                          {pr.department || 'N/A'}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-slate-400 flex-shrink-0" strokeWidth={2} />
                        <span className="text-sm font-medium text-slate-900">
                          {formatCurrency(pr.totalAmount, pr.currency)}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" strokeWidth={2} />
                        <span className="text-sm text-slate-700">
                          {formatDate(pr.createdAt)}
                        </span>
                      </div>
                      <div className="col-span-1 flex items-center">
                        <button
                          onClick={(e) => handleAssignClick(pr, e)}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-indigo-300/70 bg-gradient-to-b from-indigo-500 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_8px_18px_-10px_rgba(79,70,229,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:from-indigo-600 hover:to-indigo-700"
                        >
                          <span>Phân công</span>
                          <ArrowRight className="w-3 h-3" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal - Assign PR to Buyer */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col modal-enter overflow-hidden animate-slideUpFadeIn">
            {/* A. HEADER PR (STICKY) */}
            <div className="flex-shrink-0 sticky top-0 z-10 flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-t-2xl">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-600 rounded-xl">
                  <FileText className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Phân công PR cho Buyer</h2>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-sm text-slate-600">
                      Mã PR: <span className="font-semibold text-indigo-600">{selectedPR?.prNumber}</span>
                    </p>
                    {prDetailsForAssign?.items && (
                      <p className="text-sm text-slate-600">
                        Tổng số item: <span className="font-semibold text-slate-900">{prDetailsForAssign.items.length}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" strokeWidth={2} />
              </button>
            </div>

            {/* Quick Actions */}
            {!isLoadingPRForAssign && prDetailsForAssign?.items && buyers.length > 0 && (
              <div className="flex-shrink-0 px-6 py-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-700">Quick Actions:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-[320px] max-w-full">
                      <CustomSelect
                        value=""
                        onValueChange={(value) => {
                          if (value) handleAssignAllToBuyer(value);
                        }}
                        options={[
                          { value: '', label: 'Gán tất cả item cho Buyer...' },
                          ...buyers.map((buyer: any) => ({
                            value: buyer.id,
                            label: buyer.username,
                          })),
                        ]}
                        className="h-[38px] rounded-xl border-slate-300 bg-white text-sm hover:border-indigo-400 focus:border-indigo-500"
                        dropdownClassName="rounded-2xl border-slate-200 shadow-2xl"
                        enableDropdownSearch
                        dropdownSearchPlaceholder="Tìm Buyer..."
                      />
                    </div>
                    <button
                      onClick={handleSplitByPurchaseType}
                      className="px-4 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium"
                    >
                      Tách theo loại mua
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Validation Warning */}
            {unassignedItemsCount > 0 && (
              <div className="flex-shrink-0 px-6 py-3 bg-amber-50 border-b border-amber-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" strokeWidth={2} />
                  <p className="text-sm text-amber-800 font-medium">
                    Còn {unassignedItemsCount} item chưa được phân Buyer
                  </p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {assignmentError && (
              <div className="flex-shrink-0 px-6 py-3 bg-red-50 border-b border-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" strokeWidth={2} />
                  <p className="text-sm text-red-800 font-medium">{assignmentError}</p>
                </div>
              </div>
            )}

            {/* B. BẢNG ITEM – PHÂN CÔNG */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
              {isLoadingPRForAssign || isLoadingBuyers ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Đang tải dữ liệu...</p>
                  </div>
                </div>
              ) : !prDetailsForAssign?.items || prDetailsForAssign.items.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
                    <p className="text-slate-500 text-lg font-medium">Không có item nào</p>
                  </div>
                </div>
              ) : buyers.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <User className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
                    <p className="text-slate-500 text-lg font-medium">Chưa có Buyer nào</p>
                    <p className="text-slate-400 text-sm mt-2">Vui lòng tạo tài khoản Buyer trước</p>
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-100 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Item</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Loại mua</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">NCC gợi ý</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Buyer</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {prDetailsForAssign.items.map((item: any, index: number) => {
                          const assignment = itemAssignments[item.id] || {
                            itemId: item.id,
                            buyerId: null,
                            purchaseType: 'DOMESTIC' as const,
                            note: '',
                          };
                          const isUnassigned = !assignment.buyerId;
                          
                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors ${isUnassigned ? 'bg-amber-50/50' : 'bg-white hover:bg-slate-50'}`}
                            >
                              <td className="px-4 py-4">
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{item.description}</p>
                                  {item.spec && (
                                    <p className="text-xs text-slate-500 mt-1">Spec: {item.spec}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-600">SL: {item.qty} {item.unit || ''}</span>
                                    {item.amount && (
                                      <span className="text-xs text-slate-600">
                                        • {formatCurrency(item.amount, prDetailsForAssign.currency)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  <select
                                    value={assignment.purchaseType || 'DOMESTIC'}
                                    onChange={(e) => handleItemPurchaseTypeChange(item.id, e.target.value as 'OVERSEA' | 'DOMESTIC')}
                                    className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white hover:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <option value="DOMESTIC">Domestic</option>
                                    <option value="OVERSEA">Oversea</option>
                                  </select>
                                  {assignment.purchaseType === 'OVERSEA' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full">
                                      <Globe className="w-3 h-3" strokeWidth={2} />
                                      Oversea
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-600 text-white text-xs font-medium rounded-full">
                                      <Home className="w-3 h-3" strokeWidth={2} />
                                      Domestic
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-sm text-slate-600">
                                  {item.manufacturer || '-'}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <select
                                  value={assignment.buyerId || ''}
                                  onChange={(e) => handleItemBuyerChange(item.id, e.target.value)}
                                  className={`px-3 py-2 text-sm border rounded-lg bg-white hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full ${
                                    isUnassigned ? 'border-amber-300 bg-amber-50' : 'border-slate-300'
                                  }`}
                                >
                                  <option value="">-- Chọn Buyer --</option>
                                  {buyers.map((buyer: any) => (
                                    <option key={buyer.id} value={buyer.id}>
                                      {buyer.username} {buyer.location ? `(${buyer.location})` : ''}
                                    </option>
                                  ))}
                                </select>
                                {isUnassigned && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-600" strokeWidth={2} />
                                    <span className="text-xs text-amber-600">Chưa phân công</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                <input
                                  type="text"
                                  value={assignment.note || ''}
                                  onChange={(e) => handleItemNoteChange(item.id, e.target.value)}
                                  placeholder="Ghi chú..."
                                  className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* E. ACTION BAR */}
            <div className="flex-shrink-0 flex items-center justify-between gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                {unassignedItemsCount > 0 && (
                  <AlertTriangle className="w-4 h-4 text-amber-600" strokeWidth={2} />
                )}
                <span>
                  {unassignedItemsCount > 0
                    ? `Còn ${unassignedItemsCount} item chưa được phân Buyer`
                    : 'Tất cả item đã được phân công'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveDraft}
                  className="px-6 py-2.5 text-slate-700 bg-slate-200 rounded-xl hover:bg-slate-300 transition-colors font-medium shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <Save className="w-4 h-4" strokeWidth={2} />
                    <span>Lưu nháp</span>
                  </div>
                </button>
                <button
                  onClick={handleConfirmAssignment}
                  disabled={!canConfirm || assignMutation.isPending}
                  className={`px-6 py-2.5 rounded-xl transition-all font-medium shadow-sm flex items-center gap-2 ${
                    canConfirm
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 button-glow-indigo disabled:opacity-50'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                  <span>Xác nhận phân công</span>
                </button>
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PR Details Modal */}
      <AppModal
        open={isDetailModalOpen && !!selectedPRId}
        onClose={handleCloseDetailModal}
        size="wide"
        zIndexClass="z-[9999]"
        title={
          prDetails ? (
            <>
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                Buyer Leader · PR chờ phân công
              </span>
              <span className="mt-1 block font-mono text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                {prDetails.prNumber}
              </span>
            </>
          ) : (
            'Chi tiết PR'
          )
        }
        subtitle={
          prDetails ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className={saasPrStatusBadgeClass(prDetails.status)}>{getPRStatusLabel(prDetails.status)}</span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Building2 className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                {prDetails.department || '—'}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                Tạo{' '}
                {formatIsoDateToDdMmYyyy(
                  typeof prDetails.createdAt === 'string'
                    ? prDetails.createdAt
                    : new Date(prDetails.createdAt).toISOString(),
                ) || formatDate(prDetails.createdAt)}
              </span>
            </span>
          ) : isLoadingPRDetails ? (
            'Đang tải…'
          ) : undefined
        }
      >
        {isLoadingPRDetails ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : prDetailsError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <X className="mx-auto mb-3 h-8 w-8 text-red-500" strokeWidth={2} />
            <p className="font-semibold text-red-700">Không tải được chi tiết PR</p>
            <p className="mt-1 text-sm text-red-500">
              {prDetailsError instanceof Error ? prDetailsError.message : 'Vui lòng thử lại sau'}
            </p>
          </div>
        ) : prDetails ? (
          <div className="flex min-h-0 flex-col gap-6 md:flex-row md:items-stretch md:gap-0">
            <div className="min-w-0 flex-1 space-y-4 md:border-r md:border-slate-200/60 md:pr-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-md shadow-blue-500/20">
            <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" aria-hidden />
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100">Giá trị PR</p>
            <p className="mt-1 text-xl font-black tabular-nums leading-tight">
            {formatCurrency(prDetails.totalAmount, prDetails.currency)}
            </p>
            <DollarSign className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} aria-hidden />
            </div>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white shadow-md shadow-violet-500/20">
            <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" aria-hidden />
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-100">Mục đích</p>
            <p className="mt-1 line-clamp-3 text-sm font-semibold leading-snug" title={prDetails.purpose || undefined}>
            {prDetails.purpose?.trim() ? prDetails.purpose : '—'}
            </p>
            <Info className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} aria-hidden />
            </div>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 p-4 text-white shadow-md shadow-amber-500/20">
            <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" aria-hidden />
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-100">Ngày cần</p>
            <p className="mt-1 text-lg font-black tabular-nums leading-tight">
            {prDetails.requiredDate ? formatDate(prDetails.requiredDate) : '—'}
            </p>
            <Calendar className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} aria-hidden />
            </div>
            </div>
            {prDetails.items && prDetails.items.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <Package className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
            Danh sách vật tư ({prDetails.items.length})
            </h3>
            </div>
            <div className="max-h-[min(24rem,55vh)] overflow-auto [scrollbar-width:thin]">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50">
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className={`px-3 py-2.5 text-left ${saasTableHeadCellClass}`}>#</th>
            <th className={`min-w-[10rem] px-3 py-2.5 text-left ${saasTableHeadCellClass}`}>Mô tả</th>
            <th className={`px-3 py-2.5 text-right ${saasTableHeadCellClass}`}>SL</th>
            <th className={`px-3 py-2.5 text-left ${saasTableHeadCellClass}`}>ĐVT</th>
            <th className={`px-3 py-2.5 text-right ${saasTableHeadCellClass}`}>Đơn giá</th>
            <th className={`px-3 py-2.5 text-right ${saasTableHeadCellClass}`}>Thành tiền</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
            {prDetails.items.map((item: any) => (
            <tr key={item.id} className="bg-white hover:bg-slate-50/80">
            <td className="px-3 py-2.5 text-xs tabular-nums text-slate-400">{item.lineNo}</td>
            <td className="px-3 py-2.5 text-slate-900">
            <p className="font-medium">{item.description}</p>
            {item.spec ? <p className="mt-0.5 text-xs text-slate-500">Spec: {item.spec}</p> : null}
            {item.manufacturer ? <p className="text-xs text-slate-500">NSX: {item.manufacturer}</p> : null}
            </td>
            <td className="px-3 py-2.5 text-right text-slate-700">{item.qty}</td>
            <td className="px-3 py-2.5 text-slate-600">{item.unit || '—'}</td>
            <td className="px-3 py-2.5 text-right text-slate-600">
            {item.unitPrice ? formatCurrency(item.unitPrice, prDetails.currency) : '—'}
            </td>
            <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
            {item.amount ? formatCurrency(item.amount, prDetails.currency) : '—'}
            </td>
            </tr>
            ))}
            </tbody>
            </table>
            </div>
            </div>
            ) : null}
            {prDetails.notes?.trim() ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Ghi chú</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{prDetails.notes}</p>
            </div>
            ) : null}
            </div>
          <div className="flex w-full shrink-0 flex-col gap-4 border-t border-slate-200/70 bg-gradient-to-b from-slate-50 to-white pt-5 md:mt-0 md:w-72 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-800 text-white shadow-lg shadow-indigo-900/30">
          <div className="border-b border-indigo-700/50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-300">Thông tin chứng từ</p>
          </div>
          <dl className="divide-y divide-indigo-700/30 px-4 py-0 text-sm">
          <div className="flex items-center justify-between gap-2 py-3">
          <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
          <Building2 className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
          Phòng ban
          </dt>
          <dd className="font-semibold text-white">{prDetails.department || '—'}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 py-3">
          <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
          <User className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
          Người yêu cầu
          </dt>
          <dd className="max-w-[10rem] truncate text-right font-semibold text-white" title={prDetails.requestor?.username}>
          {prDetails.requestor?.username || '—'}
          </dd>
          </div>
          <div className="flex items-center justify-between gap-2 py-3">
          <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
          <Calendar className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
          Ngày tạo
          </dt>
          <dd className="font-semibold tabular-nums text-white">
          {formatIsoDateToDdMmYyyy(
          typeof prDetails.createdAt === 'string'
          ? prDetails.createdAt
          : new Date(prDetails.createdAt).toISOString(),
          ) || formatDate(prDetails.createdAt)}
          </dd>
          </div>
          <div className="flex flex-col gap-1 py-3">
          <dt className="text-xs text-indigo-300">Trạng thái</dt>
          <dd>
          <span className="inline-flex max-w-full items-center truncate rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
          {getPRStatusLabel(prDetails.status)}
          </span>
          </dd>
          </div>
          </dl>
          </div>
          <div className="mt-auto flex flex-col gap-2 pb-1 md:pb-0">
          <button
          type="button"
          onClick={openAssignFromDetail}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
          Phân công Buyer
          </button>
          <button
          type="button"
          onClick={handleCloseDetailModal}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
          Đóng
          </button>
          </div>
          </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <FileText className="mx-auto mb-4 h-16 w-16 text-slate-300" strokeWidth={1.5} />
            <p className="text-slate-500">Không tìm thấy chi tiết PR</p>
          </div>
        )}
      </AppModal>
    </div>
  );
};

export default PendingAssignments;

