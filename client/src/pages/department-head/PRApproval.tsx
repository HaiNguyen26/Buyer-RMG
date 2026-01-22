import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { ClipboardCheck, CheckCircle, XCircle, MessageSquare, Eye, X, FileText, Calendar, User, Building2, DollarSign, Package, Clock, Sparkles } from 'lucide-react';
import { getPendingPRs, approvePR, rejectPR, returnPR } from '../../services/departmentHeadService';

const PRApproval = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [selectedPR, setSelectedPR] = useState<string | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [modalComment, setModalComment] = useState('');

  const { data: prsData, isLoading, error } = useQuery({
    queryKey: ['department-head-pending-prs'],
    queryFn: getPendingPRs,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Parse response data (must be before early returns)
  const pendingPRs: any[] = (() => {
    if (!prsData) return [];
    if (typeof prsData === 'string' && prsData.trim()) {
      try {
        const parsed = JSON.parse(prsData);
        return parsed.prs || [];
      } catch (e) {
        console.error('Failed to parse prsData:', e);
        return [];
      }
    } else if (prsData.prs) {
      return Array.isArray(prsData.prs) ? prsData.prs : [];
    } else if (Array.isArray(prsData)) {
      return prsData;
    }
    return [];
  })();

  // Debug logging
  useEffect(() => {
    console.log('PRApproval component mounted');
    console.log('PRApproval - isLoading:', isLoading);
    console.log('PRApproval - error:', error);
    console.log('PRApproval - prsData:', prsData);
  }, [isLoading, error, prsData]);

  // Auto-select PR from location.state when navigating from dashboard
  useEffect(() => {
    const state = location.state as { prId?: string } | null;
    if (state?.prId) {
      setSelectedPR(state.prId);
      // Clear state after using it
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Auto-select PR from location.state when data is loaded
  useEffect(() => {
    if (!isLoading && pendingPRs.length > 0) {
      const state = location.state as { prId?: string } | null;
      if (state?.prId) {
        // Verify PR exists in the list and set selected
        const prExists = pendingPRs.some((pr) => pr.id === state.prId);
        if (prExists && selectedPR !== state.prId) {
          setSelectedPR(state.prId);
          // Clear state after using it to prevent re-selecting on re-render
          window.history.replaceState({}, document.title);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, pendingPRs.length, location.state]);

  const approveMutation = useMutation({
    mutationFn: (prId: string) => approvePR(prId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-head-pending-prs'] });
      queryClient.invalidateQueries({ queryKey: ['department-head'] });
      setSelectedPR(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ prId, comment }: { prId: string; comment: string }) =>
      rejectPR(prId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-head-pending-prs'] });
      queryClient.invalidateQueries({ queryKey: ['department-head'] });
      setSelectedPR(null);
      setShowRejectModal(false);
      setModalComment('');
    },
  });

  const returnMutation = useMutation({
    mutationFn: ({ prId, comment }: { prId: string; comment: string }) =>
      returnPR(prId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-head-pending-prs'] });
      queryClient.invalidateQueries({ queryKey: ['department-head'] });
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

  if (isLoading) {
    return (
      <div className="h-full overflow-hidden flex flex-col" style={{ backgroundColor: 'transparent' }}>
        <div className="animate-pulse space-y-4 flex-1 p-6">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="flex-1 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    console.error('PRApproval error:', error);
    return (
      <div className="h-full overflow-hidden flex flex-col p-6" style={{ backgroundColor: 'transparent' }}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">
            {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
          </p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['department-head-pending-prs'] })}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const selectedPRData = pendingPRs.find((pr) => pr.id === selectedPR);

  return (
    <div className="h-full overflow-hidden flex flex-col" style={{ backgroundColor: 'transparent' }}>
      <div className="flex-1 min-h-0 px-6 pb-6 pt-6 overflow-hidden flex flex-col">
        <div className="grid grid-cols-2 gap-6 h-full min-h-0 relative">
          {/* PR List Column */}
          <div className="flex flex-col min-h-0 h-full">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 h-full flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl slide-right-card-1 relative z-10" style={{ borderRadius: '1.25rem' }}>
              <div className="flex-shrink-0 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-slate-200 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <ClipboardCheck className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Danh sách PR chờ duyệt</h3>
                    <p className="text-sm text-slate-600 mt-0.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {pendingPRs.length} PR đang chờ duyệt
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {pendingPRs.length === 0 ? (
                  <div className="h-full min-h-[400px] flex items-center justify-center">
                    <div className="text-center animate-fade-in">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ClipboardCheck className="w-10 h-10 text-slate-400" />
                      </div>
                      <p className="text-slate-600 font-medium text-lg">Không có PR nào chờ duyệt</p>
                      <p className="text-slate-400 text-sm mt-1">Tất cả PR đã được xử lý</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-2">
                    {pendingPRs.map((pr, index) => (
                      <button
                        key={pr.id}
                        onClick={() => setSelectedPR(pr.id)}
                        className={`w-full p-5 text-left rounded-xl transition-all duration-200 mb-2 group ${
                          selectedPR === pr.id 
                            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-500 shadow-md scale-[1.02]' 
                            : 'bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md hover:scale-[1.01]'
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`p-1.5 rounded-lg ${
                                selectedPR === pr.id ? 'bg-blue-100' : 'bg-slate-100 group-hover:bg-blue-100'
                              } transition-colors`}>
                                <FileText className={`w-4 h-4 ${
                                  selectedPR === pr.id ? 'text-blue-600' : 'text-slate-600'
                                }`} />
                              </div>
                              <p className={`font-bold text-base truncate ${
                                selectedPR === pr.id ? 'text-blue-900' : 'text-slate-900'
                              }`}>
                                {pr.prNumber}
                              </p>
                            </div>
                            <p className="text-sm text-slate-700 mt-2 line-clamp-2">
                              {pr.itemName || 'Chưa có mô tả'}
                            </p>
                            <div className="flex items-center gap-3 mt-3 flex-wrap">
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <User className="w-3.5 h-3.5" />
                                <span>{pr.requestor?.username}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Building2 className="w-3.5 h-3.5" />
                                <span>{pr.department}</span>
                              </div>
                            </div>
                            {pr.totalAmount && (
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
                                <DollarSign className="w-4 h-4 text-green-600" />
                                <p className="text-base font-bold text-green-700">
                                  {pr.totalAmount.toLocaleString('vi-VN')} {pr.currency}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className={`p-2 rounded-lg transition-all ${
                            selectedPR === pr.id 
                              ? 'bg-blue-100 text-blue-600' 
                              : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                          }`}>
                            <Eye className="w-5 h-5" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PR Detail Column */}
          <div className="flex flex-col min-h-0 h-full">
            {selectedPRData ? (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 h-full flex flex-col overflow-hidden transition-all duration-300 hover:shadow-xl slide-right-card-2 relative z-10" style={{ borderRadius: '1.25rem' }}>
                <div className="flex-shrink-0 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-b border-slate-200 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Chi tiết PR</h3>
                      <p className="text-sm text-slate-600 mt-0.5 font-mono">{selectedPRData.prNumber}</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-6">
                  <div className="space-y-6">
                    {/* PR Info */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Phòng ban:</span>
                        </div>
                        <span className="font-medium text-slate-900">{selectedPRData.department}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5">
                        <div className="flex items-center gap-2 text-slate-600">
                          <User className="w-3.5 h-3.5" />
                          <span>Người yêu cầu:</span>
                        </div>
                        <span className="font-medium text-slate-900">{selectedPRData.requestor?.username}</span>
                      </div>
                      {selectedPRData.requiredDate && (
                        <div className="flex items-center justify-between py-1.5">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Ngày cần:</span>
                          </div>
                          <span className="font-medium text-slate-900">
                            {new Date(selectedPRData.requiredDate).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      )}
                      {selectedPRData.totalAmount && (
                        <div className="flex items-center justify-between py-1.5 pt-2 border-t border-slate-200">
                          <div className="flex items-center gap-2 text-slate-600">
                            <DollarSign className="w-3.5 h-3.5 text-green-600" />
                            <span className="font-medium">Tổng tiền:</span>
                          </div>
                          <span className="font-bold text-green-700">
                            {selectedPRData.totalAmount.toLocaleString('vi-VN')} {selectedPRData.currency}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Items Table */}
                    {selectedPRData.items && selectedPRData.items.length > 0 && (
                      <div className="bg-gradient-to-br from-slate-50 to-purple-50 rounded-xl p-5 border border-slate-200">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="p-1.5 bg-purple-100 rounded-lg">
                            <Package className="w-4 h-4 text-purple-600" />
                          </div>
                          <h4 className="font-bold text-slate-900 text-lg">Danh sách hàng hóa</h4>
                          <span className="ml-auto px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                            {selectedPRData.items.length} mặt hàng
                          </span>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-sm">
                            <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-slate-700 font-semibold">STT</th>
                                <th className="px-4 py-3 text-left text-slate-700 font-semibold">Mô tả</th>
                                <th className="px-4 py-3 text-right text-slate-700 font-semibold">Số lượng</th>
                                <th className="px-4 py-3 text-right text-slate-700 font-semibold">Đơn giá</th>
                                <th className="px-4 py-3 text-right text-slate-700 font-semibold">Thành tiền</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {selectedPRData.items.map((item: any, idx: number) => (
                                <tr 
                                  key={item.id || idx}
                                  className="hover:bg-blue-50 transition-colors duration-150"
                                >
                                  <td className="px-4 py-3 font-medium text-slate-600">{item.lineNo || idx + 1}</td>
                                  <td className="px-4 py-3 text-slate-900">{item.description}</td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                                    {item.qty} {item.unit || ''}
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                                    {item.unitPrice ? item.unitPrice.toLocaleString('vi-VN') : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-right font-bold text-green-700">
                                    {item.amount ? item.amount.toLocaleString('vi-VN') : 'N/A'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Purpose */}
                    {selectedPRData.purpose && (
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-amber-100 rounded-lg">
                            <Sparkles className="w-4 h-4 text-amber-600" />
                          </div>
                          <h4 className="font-bold text-slate-900">Mục đích</h4>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{selectedPRData.purpose}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedPRData.notes && (
                      <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-5 border border-slate-200">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-slate-100 rounded-lg">
                            <MessageSquare className="w-4 h-4 text-slate-600" />
                          </div>
                          <h4 className="font-bold text-slate-900">Ghi chú</h4>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedPRData.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 border-t border-slate-200 px-6 py-5 bg-gradient-to-r from-slate-50 to-gray-50">
                  <div className="flex gap-3">
                    <button
                      onClick={() => approveMutation.mutate(selectedPRData.id)}
                      disabled={approveMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <CheckCircle className="w-5 h-5" />
                      Duyệt
                    </button>
                    <button
                      onClick={handleReturnClick}
                      disabled={returnMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <MessageSquare className="w-5 h-5" />
                      Trả PR
                    </button>
                    <button
                      onClick={handleRejectClick}
                      disabled={rejectMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <XCircle className="w-5 h-5" />
                      Từ chối
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 h-full flex items-center justify-center slide-right-content relative z-10">
                <div className="text-center animate-fade-in">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <Eye className="w-12 h-12 text-blue-400" />
                  </div>
                  <p className="text-slate-700 font-semibold text-lg mb-2">Chọn một PR để xem chi tiết</p>
                  <p className="text-slate-400 text-sm">Nhấp vào PR trong danh sách bên trái</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Return PR Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Trả PR yêu cầu bổ sung</h3>
            <textarea
              value={modalComment}
              onChange={(e) => setModalComment(e.target.value)}
              placeholder="Nhập lý do trả PR..."
              className="w-full h-32 p-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowReturnModal(false);
                  setModalComment('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleReturnSubmit}
                disabled={!modalComment.trim() || returnMutation.isPending}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {returnMutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject PR Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Từ chối PR</h3>
            <textarea
              value={modalComment}
              onChange={(e) => setModalComment(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              className="w-full h-32 p-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setModalComment('');
                }}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!modalComment.trim() || rejectMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rejectMutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PRApproval;

