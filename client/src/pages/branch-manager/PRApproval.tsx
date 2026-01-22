import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowLeftRight, AlertTriangle, FileText, Building2, User, DollarSign, Package, Clock, X } from 'lucide-react';
import { branchManagerService } from '../../services/branchManagerService';

const PRApproval = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [selectedPR, setSelectedPR] = useState<string | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [modalComment, setModalComment] = useState('');

  const { data: prsData, isLoading, error } = useQuery({
    queryKey: ['branch-manager-pending-prs'],
    queryFn: () => branchManagerService.getPendingPRs(),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Auto-select PR if prId is passed from location.state (e.g., from dashboard)
  useEffect(() => {
    if (location.state && (location.state as any).prId && prsData?.prs) {
      const prId = (location.state as any).prId;
      const prExists = prsData.prs.some((pr: any) => pr.id === prId);
      if (prExists) {
        setSelectedPR(prId);
      }
      // Clear state after using it
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, prsData?.prs, navigate, location.pathname]);

  const approveMutation = useMutation({
    mutationFn: (prId: string) => branchManagerService.approvePR(prId),
    onSuccess: () => {
      // Invalidate và refetch ngay lập tức để PR biến mất khỏi danh sách
      queryClient.invalidateQueries({ queryKey: ['branch-manager-pending-prs'] });
      queryClient.refetchQueries({ queryKey: ['branch-manager-pending-prs'] });
      // Invalidate các queries khác liên quan
      queryClient.invalidateQueries({ queryKey: ['branch-manager'] });
      queryClient.invalidateQueries({ queryKey: ['branch-manager-dashboard'] });
      setSelectedPR(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ prId, comment }: { prId: string; comment: string }) =>
      branchManagerService.rejectPR(prId, comment),
    onSuccess: () => {
      // Invalidate và refetch ngay lập tức để PR biến mất khỏi danh sách
      queryClient.invalidateQueries({ queryKey: ['branch-manager-pending-prs'] });
      queryClient.refetchQueries({ queryKey: ['branch-manager-pending-prs'] });
      // Invalidate các queries khác liên quan
      queryClient.invalidateQueries({ queryKey: ['branch-manager'] });
      queryClient.invalidateQueries({ queryKey: ['branch-manager-dashboard'] });
      setSelectedPR(null);
      setShowRejectModal(false);
      setModalComment('');
    },
  });

  const returnMutation = useMutation({
    mutationFn: ({ prId, comment }: { prId: string; comment: string }) =>
      branchManagerService.returnPR(prId, comment),
    onSuccess: () => {
      // Invalidate và refetch ngay lập tức để PR biến mất khỏi danh sách
      queryClient.invalidateQueries({ queryKey: ['branch-manager-pending-prs'] });
      queryClient.refetchQueries({ queryKey: ['branch-manager-pending-prs'] });
      // Invalidate các queries khác liên quan
      queryClient.invalidateQueries({ queryKey: ['branch-manager'] });
      queryClient.invalidateQueries({ queryKey: ['branch-manager-dashboard'] });
      setSelectedPR(null);
      setShowReturnModal(false);
      setModalComment('');
    },
  });

  const handleReturnClick = () => {
    setModalComment('');
    setShowReturnModal(true);
  };

  const handleRejectClick = () => {
    setModalComment('');
    setShowRejectModal(true);
  };

  const handleReturnSubmit = () => {
    if (selectedPR && modalComment.trim()) {
      returnMutation.mutate({ prId: selectedPR, comment: modalComment });
    }
  };

  const handleRejectSubmit = () => {
    if (selectedPR && modalComment.trim()) {
      rejectMutation.mutate({ prId: selectedPR, comment: modalComment });
    }
  };

  // Check if PR is near budget threshold (simplified - can be enhanced with actual budget data)
  const isNearBudgetThreshold = (pr: any) => {
    // For now, we'll check if there's a budget exception or if totalAmount is very high
    // This can be enhanced with actual budget comparison logic
    return pr.totalAmount && pr.totalAmount > 100000000; // Example threshold
  };

  const formatCurrency = (amount: number | null, currency: string = 'VND') => {
    if (!amount) return 'N/A';
    if (amount >= 1000000000) {
      return `${(amount / 1000000000).toFixed(2)} tỷ ${currency}`;
    }
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)} triệu ${currency}`;
    }
    return `${amount.toLocaleString('vi-VN')} ${currency}`;
  };

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
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  // Handle different response structures
  let pendingPRs: any[] = [];
  let parsedData = prsData;
  
  if (typeof prsData === 'string') {
    if (prsData.trim() === '') {
      parsedData = null;
    } else {
      try {
        parsedData = JSON.parse(prsData);
      } catch (parseError) {
        parsedData = null;
      }
    }
  }
  
  if (parsedData) {
    if (Array.isArray(parsedData)) {
      pendingPRs = parsedData;
    } else if (parsedData.prs && Array.isArray(parsedData.prs)) {
      pendingPRs = parsedData.prs;
    } else if (parsedData.data && Array.isArray(parsedData.data)) {
      pendingPRs = parsedData.data;
    }
  }

  const selectedPRData = pendingPRs.find((pr: any) => pr.id === selectedPR);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 flex gap-6 p-6">
        {/* A. DANH SÁCH PR CHỜ DUYỆT */}
        <div className="w-1/3 flex flex-col bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
          <div className="flex-shrink-0 p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" strokeWidth={2} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">PR chờ duyệt</h2>
            </div>
            <p className="text-sm text-slate-600 ml-12">{pendingPRs.length} PR</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-4">
            {pendingPRs.length > 0 ? (
              <div className="space-y-3">
                {pendingPRs.map((pr: any) => {
                  const isNearBudget = isNearBudgetThreshold(pr);
                  const isSelected = selectedPR === pr.id;
                  return (
                    <div
                      key={pr.id}
                      onClick={() => setSelectedPR(pr.id)}
                      className={`group relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-500 shadow-md'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {/* Selected indicator */}
                      {isSelected && (
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 rounded-l-xl"></div>
                      )}
                      
                      {/* PR Number */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${
                            isSelected ? 'bg-blue-200' : 'bg-slate-100 group-hover:bg-blue-100'
                          } transition-colors`}>
                            <FileText className={`w-4 h-4 ${
                              isSelected ? 'text-blue-700' : 'text-slate-600'
                            }`} strokeWidth={2.5} />
                          </div>
                          <span className={`text-base font-bold ${
                            isSelected ? 'text-blue-900' : 'text-slate-900'
                          }`}>{pr.prNumber}</span>
                        </div>
                        {isNearBudget && (
                          <div className="p-1.5 bg-amber-100 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-amber-600" strokeWidth={2.5} />
                          </div>
                        )}
                      </div>

                      {/* Total Amount */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">Tổng giá</span>
                        <span className={`text-lg font-bold ${
                          isSelected ? 'text-blue-700' : 'text-green-700'
                        }`}>
                          {formatCurrency(pr.totalAmount, pr.currency)}
                        </span>
                      </div>

                      {/* Hover effect overlay */}
                      {!isSelected && (
                        <div className="absolute inset-0 rounded-xl bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors pointer-events-none"></div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" strokeWidth={2} />
                  </div>
                  <p className="text-slate-600 font-medium">Không có PR nào chờ duyệt</p>
                  <p className="text-sm text-slate-400 mt-1">Tất cả PR đã được xử lý</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* B. CHI TIẾT PR (READ-ONLY) */}
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-lg border border-slate-200/50 overflow-hidden">
          {selectedPRData ? (
            <>
              {/* Sticky Header */}
              <div className="flex-shrink-0 p-6 border-b border-slate-200 bg-[#F8FAFC] sticky top-0 z-20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-600" strokeWidth={2} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{selectedPRData.prNumber}</h2>
                      <p className="text-sm text-slate-600 mt-1">Chi tiết Purchase Request</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Tổng giá đề xuất</p>
                      <p className="text-lg font-bold text-green-700">
                        {formatCurrency(selectedPRData.totalAmount, selectedPRData.currency)}
                      </p>
                    </div>
                    <div className="px-3 py-1.5 bg-amber-100 rounded-lg">
                      <span className="text-sm font-semibold text-amber-800">Chờ duyệt</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PR Details Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                {/* PR Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                    <Building2 className="w-5 h-5 text-slate-600" strokeWidth={2} />
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Phòng ban</p>
                      <p className="font-semibold text-slate-900">{selectedPRData.department || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                    <User className="w-5 h-5 text-slate-600" strokeWidth={2} />
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Người yêu cầu</p>
                      <p className="font-semibold text-slate-900">{selectedPRData.requestor?.username || 'N/A'}</p>
                    </div>
                  </div>
                  {selectedPRData.requiredDate && (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                      <Clock className="w-5 h-5 text-slate-600" strokeWidth={2} />
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Ngày cần</p>
                        <p className="font-semibold text-slate-900">
                          {new Date(selectedPRData.requiredDate).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedPRData.purpose && (
                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                      <FileText className="w-5 h-5 text-blue-600" strokeWidth={2} />
                      <div>
                        <p className="text-xs text-blue-700 mb-1">Mục đích</p>
                        <p className="text-sm font-medium text-blue-900">{selectedPRData.purpose}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                {selectedPRData.items && selectedPRData.items.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-slate-600" strokeWidth={2} />
                      Danh sách vật tư/dịch vụ ({selectedPRData.items.length})
                    </h3>
                    <div className="overflow-x-auto overflow-hidden rounded-xl">
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full">
                          <thead className="bg-slate-100 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">STT</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">Mô tả</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">Số lượng</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">Đơn vị</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">Đơn giá</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">Thành tiền</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white">
                            {selectedPRData.items.map((item: any, index: number) => {
                              const isLastRow = index === selectedPRData.items.length - 1;
                              return (
                                <tr key={item.id || index} className="bg-white border-b border-slate-200 last:border-b-0">
                                  <td className="px-4 py-3 text-sm text-slate-900 bg-white">{item.lineNo || index + 1}</td>
                                  <td className="px-4 py-3 text-sm text-slate-700 bg-white">{item.description || '-'}</td>
                                  <td className="px-4 py-3 text-sm text-slate-900 bg-white">{item.qty || '-'}</td>
                                  <td className="px-4 py-3 text-sm text-slate-700 bg-white">{item.unit || '-'}</td>
                                  <td className="px-4 py-3 text-sm text-slate-900 bg-white">
                                    {item.unitPrice ? `${item.unitPrice.toLocaleString('vi-VN')}` : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-900 font-medium bg-white" style={isLastRow ? { borderBottomRightRadius: '0.75rem' } : {}}>
                                    {item.amount ? `${item.amount.toLocaleString('vi-VN')}` : '-'}
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

                {/* Notes */}
                {selectedPRData.notes && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-slate-600" strokeWidth={2} />
                      <p className="text-sm font-semibold text-slate-900">Ghi chú</p>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedPRData.notes}</p>
                  </div>
                )}

                {/* File đính kèm placeholder */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-slate-600" strokeWidth={2} />
                    <p className="text-sm font-semibold text-slate-900">File đính kèm</p>
                  </div>
                  <p className="text-sm text-slate-500 italic">Chưa có file đính kèm</p>
                </div>
              </div>

              {/* C. ACTION BAR (QUYẾT ĐỊNH) */}
              <div className="flex-shrink-0 p-6 border-t border-slate-200 bg-white">
                <div className="flex items-center gap-4">
                  {/* ✅ Duyệt - Xanh + Glow */}
                  <button
                    onClick={() => approveMutation.mutate(selectedPRData.id)}
                    disabled={approveMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold shadow-sm hover:shadow-lg hover:shadow-green-500/50 disabled:opacity-50 button-glow"
                  >
                    <CheckCircle className="w-5 h-5" strokeWidth={2} />
                    <span>Duyệt</span>
                  </button>

                  {/* 🔁 Trả PR - Vàng */}
                  <button
                    onClick={handleReturnClick}
                    disabled={returnMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-semibold shadow-sm disabled:opacity-50"
                  >
                    <ArrowLeftRight className="w-5 h-5" strokeWidth={2} />
                    <span>Trả PR</span>
                  </button>

                  {/* ❌ Từ chối - Đỏ */}
                  <button
                    onClick={handleRejectClick}
                    disabled={rejectMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-semibold shadow-sm disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" strokeWidth={2} />
                    <span>Từ chối</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
                <p className="text-slate-500 font-medium">Chọn PR để xem chi tiết</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Return PR Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowReturnModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-slideUpFadeIn overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-yellow-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-amber-600" strokeWidth={2} />
                Trả PR yêu cầu bổ sung
              </h3>
              <button
                onClick={() => {
                  setShowReturnModal(false);
                  setModalComment('');
                }}
                className="p-1 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" strokeWidth={2} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nhập yêu cầu bổ sung thông tin <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={modalComment}
                  onChange={(e) => setModalComment(e.target.value)}
                  placeholder="Nhập yêu cầu bổ sung thông tin..."
                  className="w-full px-4 py-3 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 text-slate-900 placeholder-slate-400"
                  rows={4}
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowReturnModal(false);
                    setModalComment('');
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleReturnSubmit}
                  disabled={returnMutation.isPending || !modalComment.trim()}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {returnMutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject PR Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-slideUpFadeIn overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-red-50 to-rose-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" strokeWidth={2} />
                Từ chối PR
              </h3>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setModalComment('');
                }}
                className="p-1 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" strokeWidth={2} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-800 font-medium">
                  ⚠️ Bạn có chắc chắn muốn từ chối PR này? Hành động này không thể hoàn tác.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nhập lý do từ chối <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={modalComment}
                  onChange={(e) => setModalComment(e.target.value)}
                  placeholder="Nhập lý do từ chối..."
                  className="w-full px-4 py-3 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 text-slate-900 placeholder-slate-400"
                  rows={4}
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setModalComment('');
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={rejectMutation.isPending || !modalComment.trim()}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {rejectMutation.isPending ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PRApproval;
