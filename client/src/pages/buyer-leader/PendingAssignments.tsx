import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, User, Building2, DollarSign, Calendar, ArrowRight, X, Mail, MapPin, Package, Info, FileText, AlertTriangle, Globe, Home, Save, CheckCircle2 } from 'lucide-react';
import { buyerLeaderService } from '../../services/buyerLeaderService';

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
    },
    onError: (error: any) => {
      console.error('Assign error:', error);
      // Error sẽ được hiển thị bởi UI
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

  if (isLoading) {
    return (
      <div className="h-full overflow-hidden flex flex-col p-6">
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
      <div className="h-full overflow-hidden flex flex-col p-6">
        <div className="bg-red-50 border border-red-200 rounded-soft p-4">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col relative" style={{ backgroundColor: 'transparent' }}>
      {/* Banner */}
      <div className="flex-shrink-0 mb-6 px-6 pt-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft-md border border-slate-200/50 p-6 slide-right-title">
          <div className="flex items-center justify-between">
            {/* Left: Introduction */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Phân công PR cho Buyer</h1>
              <p className="text-slate-600">Xem và phân công các PR đã được duyệt cho Buyer xử lý</p>
            </div>
            
            {/* Right: PR Count */}
            <div className="ml-6 flex items-center gap-4 px-6 py-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200/50">
              <div className="p-3 bg-blue-600 rounded-xl">
                <ClipboardList className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <div>
                <p className="text-3xl font-bold text-blue-900">{pendingPRs.length}</p>
                <p className="text-sm text-blue-700 font-medium">PR chờ phân công</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-6 pb-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 flex flex-col overflow-hidden slide-right-content relative z-10" style={{ isolation: 'isolate', borderRadius: '1.25rem' }}>
          {/* Table Header */}
          <div className="flex-shrink-0 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200/50 overflow-hidden" style={{ borderTopLeftRadius: '1.25rem', borderTopRightRadius: '1.25rem' }}>
            <div className="grid grid-cols-12 gap-4 px-6 py-4 text-sm font-semibold text-slate-700">
              <div className="col-span-1">STT</div>
              <div className="col-span-2">Mã PR</div>
              <div className="col-span-2">Người yêu cầu</div>
              <div className="col-span-2">Phòng ban</div>
              <div className="col-span-2">Tổng tiền</div>
              <div className="col-span-2">Ngày tạo</div>
              <div className="col-span-1">Hành động</div>
            </div>
          </div>

          {/* Table Body - Scrollable with fixed height */}
          <div 
            className="bg-white overflow-y-auto overflow-x-hidden" 
            style={{ 
              borderBottomLeftRadius: '1.25rem', 
              borderBottomRightRadius: '1.25rem',
              height: '504px', // Fixed height to show ~7 PRs (72px per row)
              maxHeight: '504px',
            }}
          >
            <div className="bg-white w-full">
              {pendingPRs.length === 0 ? (
                <div className="h-full min-h-[400px] flex items-center justify-center">
                  <div className="text-center">
                    <ClipboardList className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
                    <p className="text-slate-500 text-lg font-medium">Không có PR nào chờ phân công</p>
                    <p className="text-slate-400 text-sm mt-2">Tất cả PR đã được phân công hoặc chưa được duyệt</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100/50 w-full bg-white">
                  {pendingPRs.map((pr: any, index: number) => (
                    <div
                      key={pr.id}
                      className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50/50 transition-all duration-200 bg-white cursor-pointer slide-right-item w-full flex-shrink-0"
                      style={{ animationDelay: `${0.5 + index * 0.03}s` }}
                      onClick={() => handleViewPRDetails(pr.id)}
                    >
                      <div className="col-span-1 flex items-center text-sm text-slate-600">
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 transition-colors whitespace-nowrap shadow-sm"
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
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
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
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignAllToBuyer(e.target.value);
                        }
                      }}
                      className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      defaultValue=""
                    >
                      <option value="">Gán tất cả item cho Buyer...</option>
                      {buyers.map((buyer: any) => (
                        <option key={buyer.id} value={buyer.id}>
                          {buyer.username}
                        </option>
                      ))}
                    </select>
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
        </div>
      )}

      {/* PR Details Modal */}
      {isDetailModalOpen && selectedPRId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col modal-enter overflow-hidden">
            {/* Modal Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Chi tiết Purchase Request</h2>
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

            {/* Modal Body - PR Details */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
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
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl shadow-sm">
                      <User className="w-5 h-5 text-slate-600" strokeWidth={2} />
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Người yêu cầu</p>
                        <p className="font-semibold text-slate-900">{prDetails.requestor?.username || 'N/A'}</p>
                      </div>
                    </div>
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
                          {formatCurrency(prDetails.totalAmount, prDetails.currency)}
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
                        <table className="w-full bg-white border border-slate-200 overflow-hidden shadow-sm" style={{ borderRadius: '0.75rem' }}>
                          <thead className="bg-slate-100 border-b border-slate-200" style={{ borderTopLeftRadius: '0.75rem', borderTopRightRadius: '0.75rem' }}>
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase bg-slate-100">STT</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase bg-slate-100">Mô tả</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase bg-slate-100">Số lượng</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase bg-slate-100">Đơn vị</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase bg-slate-100">Đơn giá</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase bg-slate-100">Thành tiền</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/50 bg-white">
                            {prDetails.items.map((item: any, index: number) => (
                              <tr 
                                key={item.id} 
                                className="hover:bg-slate-50 transition-colors bg-white"
                                style={index === prDetails.items.length - 1 ? { borderBottomLeftRadius: '0.75rem', borderBottomRightRadius: '0.75rem' } : {}}
                              >
                                <td className={`px-4 py-3 text-sm text-slate-600 bg-white ${index === prDetails.items.length - 1 ? 'rounded-bl-xl' : ''}`}>{item.lineNo}</td>
                                <td className="px-4 py-3 text-sm text-slate-900 bg-white">
                                  <div>
                                    <p className="font-medium">{item.description}</p>
                                    {item.spec && (
                                      <p className="text-xs text-slate-500 mt-1">Spec: {item.spec}</p>
                                    )}
                                    {item.manufacturer && (
                                      <p className="text-xs text-slate-500">NSX: {item.manufacturer}</p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600 bg-white">{item.qty}</td>
                                <td className="px-4 py-3 text-sm text-slate-600 bg-white">{item.unit || '-'}</td>
                                <td className="px-4 py-3 text-sm text-slate-600 text-right bg-white">
                                  {item.unitPrice ? formatCurrency(item.unitPrice, prDetails.currency) : '-'}
                                </td>
                                <td className={`px-4 py-3 text-sm font-semibold text-slate-900 text-right bg-white ${index === prDetails.items.length - 1 ? 'rounded-br-xl' : ''}`}>
                                  {item.amount ? formatCurrency(item.amount, prDetails.currency) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {prDetails.notes && (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 shadow-sm">
                      <p className="text-sm font-semibold text-amber-900 mb-2">Ghi chú</p>
                      <p className="text-sm text-slate-700">{prDetails.notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
                    <p className="text-slate-500">Không tìm thấy chi tiết PR</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={handleCloseDetailModal}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingAssignments;

