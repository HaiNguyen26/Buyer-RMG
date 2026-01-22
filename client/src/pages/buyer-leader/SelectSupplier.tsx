import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Star, AlertTriangle, ArrowLeft, Info, X, FileText } from 'lucide-react';
import { buyerLeaderService } from '../../services/buyerLeaderService';

const formatCurrency = (amount: number | null, currency: string = 'VND') => {
  if (!amount) return 'Chưa có';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const SelectSupplier = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const prId = searchParams.get('prId');
  const rfqId = searchParams.get('rfqId');
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);
  const [showOtherReasonModal, setShowOtherReasonModal] = useState(false);
  const [otherReason, setOtherReason] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [showOverBudgetModal, setShowOverBudgetModal] = useState(false);
  const [overBudgetReason, setOverBudgetReason] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['buyer-leader-select-supplier', prId, rfqId],
    queryFn: () => buyerLeaderService.getPRForSupplierSelection(prId!, rfqId || undefined),
    enabled: !!prId,
  });

  const selectSupplierMutation = useMutation({
    mutationFn: (data: {
      purchaseRequestId: string;
      quotationId: string;
      selectionReason: string;
      overBudgetReason?: string;
    }) => buyerLeaderService.selectSupplier(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['buyer-leader-select-supplier'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-leader-compare-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-leader-over-budget-prs'] });
      
      if (response.isOverBudget) {
        alert('Đã chọn NCC. PR đang chờ GĐ CN duyệt do vượt ngân sách.');
      }
      
      navigate('/dashboard/buyer-leader');
    },
    onError: (error: any) => {
      if (error.response?.data?.error === 'Lý do đề xuất vượt ngân sách là bắt buộc') {
        setShowOverBudgetModal(true);
        if (error.response?.data?.overBudgetInfo) {
          // Store over-budget info for display
        }
      }
    },
  });

  if (!prId) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-12 text-center">
          <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-slate-600 font-medium text-lg mb-2">Thiếu thông tin PR</p>
          <p className="text-slate-500 text-sm">Vui lòng truy cập từ module So sánh báo giá</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Đang tải dữ liệu...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" strokeWidth={2} />
            <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          </div>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  if (!data || !data.recommendedQuotation) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 p-12 text-center">
          <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-slate-600 font-medium text-lg mb-2">Chưa có NCC được đề xuất</p>
          <p className="text-slate-500 text-sm">Vui lòng kiểm tra lại RFQ và báo giá</p>
        </div>
      </div>
    );
  }

  const { pr, recommendedQuotation, otherQuotations, overBudgetInfo, quotations } = data;

  const handleSelectRecommended = () => {
    if (!recommendedQuotation || !prId) return;
    
    // Check if over-budget
    if (overBudgetInfo && overBudgetInfo.isOverBudget) {
      // Show modal to require over-budget reason
      setShowOverBudgetModal(true);
      return;
    }
    
    const reason = 'Chọn NCC được hệ thống đề xuất';
    selectSupplierMutation.mutate({
      purchaseRequestId: prId,
      quotationId: recommendedQuotation.id,
      selectionReason: reason,
    });
  };

  const handleSelectOther = () => {
    if (!selectedQuotationId) {
      alert('Vui lòng chọn NCC khác');
      return;
    }
    setShowOtherReasonModal(true);
  };

  const handleConfirmOtherSelection = () => {
    if (!otherReason.trim()) {
      alert('Vui lòng nhập lý do chọn NCC');
      return;
    }
    
    if (!selectedQuotationId || !prId) return;
    
    // Check if selected quotation is over-budget
    const selectedQuotation = quotations.find((q: any) => q.id === selectedQuotationId);
    const isOverBudget = selectedQuotation && pr && 
      Number(selectedQuotation.totalAmount) > Number(pr.totalAmount) && Number(pr.totalAmount) > 0;
    
    if (isOverBudget) {
      // Show modal to require over-budget reason
      setShowOverBudgetModal(true);
      return;
    }
    
    selectSupplierMutation.mutate({
      purchaseRequestId: prId,
      quotationId: selectedQuotationId,
      selectionReason: otherReason,
    });
  };

  const handleConfirmOverBudget = () => {
    if (!overBudgetReason.trim()) {
      alert('Vui lòng nhập lý do đề xuất vượt ngân sách');
      return;
    }
    
    if (!prId) return;
    
    const quotationId = selectedQuotationId || recommendedQuotation?.id;
    if (!quotationId) return;
    
    const selectionReason = selectedQuotationId ? otherReason : 'Chọn NCC được hệ thống đề xuất';
    
    selectSupplierMutation.mutate({
      purchaseRequestId: prId,
      quotationId: quotationId,
      selectionReason: selectionReason,
      overBudgetReason: overBudgetReason,
    });
    
    setShowOverBudgetModal(false);
    setOverBudgetReason('');
  };

  const handleReturnToBuyer = () => {
    setShowReturnModal(true);
  };

  const handleConfirmReturn = () => {
    if (!returnReason.trim()) {
      alert('Vui lòng nhập lý do trả PR');
      return;
    }
    
    // TODO: Implement return to buyer API
    console.log('Return to buyer:', { prId, reason: returnReason });
    alert('Chức năng trả PR cho Buyer đang được phát triển');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'transparent' }}>
      {/* Header */}
      <div className="flex-shrink-0 mb-6 px-6 pt-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft-md border border-slate-200/50 p-6 slide-right-title">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Chọn NCC</h1>
              <p className="text-slate-600">
                PR: <span className="font-semibold text-indigo-600">{pr.prNumber}</span>
                {' • '}
                RFQ: <span className="font-semibold text-slate-900">{data.rfq?.rfqNumber}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-6 pb-24">
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-6">
          {/* A. NCC RECOMMEND (HIGHLIGHT) */}
          {recommendedQuotation && (
            <div className="bg-white rounded-2xl shadow-lg border-2 border-indigo-500 p-6 slide-right-content relative overflow-hidden">
              {/* Decorative background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100/30 rounded-full -mr-16 -mt-16"></div>
              
              <div className="relative">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-indigo-600 rounded-xl">
                    <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" strokeWidth={2} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-xl font-bold text-slate-900">NCC Đề xuất</h2>
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg">
                        Hệ thống đề xuất
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-indigo-900 mb-1">
                      {recommendedQuotation.supplier.name}
                    </p>
                    {recommendedQuotation.supplier.code && (
                      <p className="text-sm text-slate-600">Mã: {recommendedQuotation.supplier.code}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Tổng giá</p>
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(recommendedQuotation.totalAmount, recommendedQuotation.currency)}
                    </p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Thời gian giao hàng</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {recommendedQuotation.leadTime ? `${recommendedQuotation.leadTime} ngày` : '-'}
                    </p>
                  </div>
                  {recommendedQuotation.paymentTerms && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-xs text-slate-500 mb-1">Điều khoản thanh toán</p>
                      <p className="text-sm font-medium text-slate-900">{recommendedQuotation.paymentTerms}</p>
                    </div>
                  )}
                  {recommendedQuotation.warranty && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-xs text-slate-500 mb-1">Bảo hành</p>
                      <p className="text-sm font-medium text-slate-900">{recommendedQuotation.warranty}</p>
                    </div>
                  )}
                </div>

                {recommendedQuotation.recommendationScore !== null && (
                  <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                    <p className="text-xs text-indigo-700 mb-1">Điểm đánh giá</p>
                    <p className="text-lg font-bold text-indigo-900">
                      {recommendedQuotation.recommendationScore.toFixed(1)}/100
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* C. OVER-BUDGET BANNER (STICKY) - BUYER LEADER */}
          {overBudgetInfo && overBudgetInfo.isOverBudget && (
            <div className="sticky top-0 z-20 bg-red-50 border-2 border-red-400 rounded-2xl p-4 slide-right-card-1 mb-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" strokeWidth={2} />
                <div className="flex-1">
                  <p className="text-base font-bold text-red-900">
                    ⚠️ PR này vượt ngân sách {overBudgetInfo.overBudgetPercent.toFixed(1)}% so với giá đề xuất ban đầu
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    Giá PR: {formatCurrency(overBudgetInfo.prAmount, pr.currency)} • 
                    Giá NCC: {formatCurrency(overBudgetInfo.quotationAmount, pr.currency)} • 
                    Vượt: {formatCurrency(overBudgetInfo.overBudgetAmount, pr.currency)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* B. DANH SÁCH NCC KHÁC */}
          {otherQuotations && otherQuotations.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 slide-right-card-2">
              <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-2xl">
                <h2 className="text-lg font-bold text-slate-900">Các NCC khác</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {otherQuotations.map((q: any) => (
                  <div
                    key={q.id}
                    className={`p-6 hover:bg-slate-50 transition-colors cursor-pointer ${
                      selectedQuotationId === q.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                    onClick={() => setSelectedQuotationId(q.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-base font-semibold text-slate-900">{q.supplier.name}</h3>
                          {selectedQuotationId === q.id && (
                            <CheckCircle className="w-5 h-5 text-blue-600" strokeWidth={2} />
                          )}
                        </div>
                        {q.supplier.code && (
                          <p className="text-sm text-slate-600 mb-2">Mã: {q.supplier.code}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">Giá: </span>
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(q.totalAmount, q.currency)}
                            </span>
                          </div>
                          {q.leadTime && (
                            <div>
                              <span className="text-slate-500">Lead time: </span>
                              <span className="font-medium text-slate-900">{q.leadTime} ngày</span>
                            </div>
                          )}
                          {q.recommendationScore !== null && (
                            <div>
                              <span className="text-slate-500">Điểm: </span>
                              <span className="font-semibold text-slate-900">
                                {q.recommendationScore.toFixed(1)}/100
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Show quotation details modal
                          alert('Chi tiết báo giá sẽ được hiển thị ở đây');
                        }}
                        className="ml-4 p-2 hover:bg-slate-200 rounded-lg transition-colors"
                        title="Xem chi tiết"
                      >
                        <FileText className="w-5 h-5 text-slate-600" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* D. ACTION BAR (STICKY) */}
      <div className="fixed bottom-0 bg-white border-t border-slate-200 shadow-lg z-50 px-6 py-4" style={{ left: '240px', right: 0 }}>
        <div className="flex items-center justify-between gap-4 max-w-full mx-auto">
          <button
            onClick={handleReturnToBuyer}
            className="px-6 py-3 bg-slate-300 text-slate-700 rounded-xl hover:bg-slate-400 transition-colors font-medium shadow-sm flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            <span>Trả Buyer</span>
          </button>
          
          <div className="flex items-center gap-3">
            {selectedQuotationId && (
              <button
                onClick={handleSelectOther}
                className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-medium shadow-sm"
              >
                Chọn khác
              </button>
            )}
            <button
              onClick={handleSelectRecommended}
              disabled={selectSupplierMutation.isPending || (overBudgetInfo?.isOverBudget && !overBudgetReason.trim())}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium shadow-sm button-glow-indigo disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" strokeWidth={2} />
              <span>{overBudgetInfo?.isOverBudget ? 'Gửi GĐ Chi nhánh xem xét' : 'Chọn NCC'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Chọn khác - Nhập lý do */}
      {showOtherReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 modal-enter animate-slideUpFadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Chọn NCC khác</h3>
              <button
                onClick={() => {
                  setShowOtherReasonModal(false);
                  setOtherReason('');
                }}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" strokeWidth={2} />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Lý do chọn NCC này <span className="text-red-500">*</span>
              </label>
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Nhập lý do chọn NCC này..."
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                rows={4}
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowOtherReasonModal(false);
                  setOtherReason('');
                }}
                className="px-4 py-2 text-slate-700 bg-slate-200 rounded-xl hover:bg-slate-300 transition-colors font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmOtherSelection}
                disabled={!otherReason.trim() || selectSupplierMutation.isPending}
                className="px-6 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-medium disabled:opacity-50"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Over-Budget - Nhập lý do */}
      {showOverBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 modal-enter animate-slideUpFadeIn">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-red-600" strokeWidth={2} />
                <h3 className="text-lg font-bold text-slate-900">Vượt ngân sách</h3>
              </div>
              <button
                onClick={() => {
                  setShowOverBudgetModal(false);
                  setOverBudgetReason('');
                }}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" strokeWidth={2} />
              </button>
            </div>
            
            {overBudgetInfo && overBudgetInfo.isOverBudget && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-800 mb-2">
                  <span className="font-semibold">Giá PR:</span> {formatCurrency(overBudgetInfo.prAmount, pr.currency)}
                </p>
                <p className="text-sm text-red-800 mb-2">
                  <span className="font-semibold">Giá NCC:</span> {formatCurrency(overBudgetInfo.quotationAmount, pr.currency)}
                </p>
                <p className="text-sm font-bold text-red-900">
                  Vượt: {formatCurrency(overBudgetInfo.overBudgetAmount, pr.currency)} ({overBudgetInfo.overBudgetPercent}%)
                </p>
              </div>
            )}
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Lý do đề xuất vượt ngân sách <span className="text-red-500">*</span>
              </label>
              <textarea
                value={overBudgetReason}
                onChange={(e) => setOverBudgetReason(e.target.value)}
                placeholder="Ví dụ: Thị trường tăng giá, hàng đặc thù, chất lượng cao hơn..."
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                rows={4}
              />
              <p className="text-xs text-slate-500 mt-1">
                Lý do này sẽ được gửi lên GĐ CN để xem xét
              </p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowOverBudgetModal(false);
                  setOverBudgetReason('');
                }}
                className="px-4 py-2 text-slate-700 bg-slate-200 rounded-xl hover:bg-slate-300 transition-colors font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmOverBudget}
                disabled={!overBudgetReason.trim() || selectSupplierMutation.isPending}
                className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Trả Buyer - Nhập lý do */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 modal-enter animate-slideUpFadeIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Trả PR cho Buyer</h3>
              <button
                onClick={() => {
                  setShowReturnModal(false);
                  setReturnReason('');
                }}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" strokeWidth={2} />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Lý do trả PR <span className="text-red-500">*</span>
              </label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Nhập lý do trả PR cho Buyer..."
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none"
                rows={4}
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowReturnModal(false);
                  setReturnReason('');
                }}
                className="px-4 py-2 text-slate-700 bg-slate-200 rounded-xl hover:bg-slate-300 transition-colors font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmReturn}
                disabled={!returnReason.trim()}
                className="px-6 py-2 bg-slate-600 text-white rounded-xl hover:bg-slate-700 transition-colors font-medium disabled:opacity-50"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SelectSupplier;
