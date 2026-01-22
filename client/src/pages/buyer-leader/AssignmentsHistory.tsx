import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserCheck, Calendar, User, CheckCircle, X, FileText, Building2, DollarSign, Package, Info } from 'lucide-react';
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

const AssignmentsHistory = () => {
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['buyer-leader-assignments'],
    queryFn: () => buyerLeaderService.getAssignments(),
  });

  const { data: prDetails, isLoading: isLoadingPRDetails, error: prDetailsError } = useQuery({
    queryKey: ['buyer-leader-pr-details', selectedPRId],
    queryFn: () => buyerLeaderService.getPRDetails(selectedPRId!),
    enabled: !!selectedPRId && isDetailModalOpen,
    retry: 1,
  });

  const assignments = data?.assignments || [];

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
      {/* Header - Fixed */}
      <div className="flex-shrink-0 mb-6 px-6 pt-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft-md border border-slate-200/50 p-6 slide-right-title">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Lịch sử phân công</h1>
              <p className="text-slate-600 mt-1">Xem tất cả các PR đã được phân công cho Buyer</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-2xl">
              <UserCheck className="w-5 h-5 text-green-600" strokeWidth={2} />
              <span className="font-semibold text-green-900">{assignments.length} phân công</span>
            </div>
          </div>
        </div>
      </div>

      {/* Assignments List - Scrollable */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-6 pb-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 flex-1 flex flex-col overflow-hidden slide-right-content relative z-10" style={{ isolation: 'isolate', borderRadius: '1.25rem' }}>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ borderBottomLeftRadius: '1.25rem', borderBottomRightRadius: '1.25rem' }}>
            {assignments.length === 0 ? (
              <div className="h-full min-h-[400px] flex items-center justify-center p-12">
                <div className="text-center">
                  <UserCheck className="w-16 h-16 text-slate-400 mx-auto mb-4" strokeWidth={2} />
                  <p className="text-slate-600 font-medium text-lg">Chưa có phân công nào</p>
                  <p className="text-slate-500 text-sm mt-2">Các phân công sẽ hiển thị ở đây sau khi bạn phân công PR cho Buyer</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/50 w-full bg-white">
                {assignments.map((assignment: any, index: number) => (
                <div
                  key={assignment.id}
                  className="px-6 py-6 hover:bg-slate-50/50 transition-all duration-200 cursor-pointer slide-right-item w-full"
                  style={{ animationDelay: `${0.5 + index * 0.03}s` }}
                  onClick={() => handleViewPRDetails(assignment.prId)}
                >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-bold text-slate-900">{assignment.prNumber}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      assignment.prStatus === 'ASSIGNED_TO_BUYER' ? 'bg-blue-100 text-blue-700' :
                      assignment.prStatus === 'SUPPLIER_SELECTED' ? 'bg-green-100 text-green-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {assignment.prStatus}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" strokeWidth={2} />
                      <span className="text-sm text-slate-600">
                        <span className="font-medium">Buyer:</span> {assignment.buyer?.username || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" strokeWidth={2} />
                      <span className="text-sm text-slate-600">
                        <span className="font-medium">Ngày phân công:</span> {new Date(assignment.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-slate-400" strokeWidth={2} />
                      <span className="text-sm text-slate-600">
                        <span className="font-medium">Phạm vi:</span> {assignment.scope === 'FULL' ? 'Toàn bộ' : 'Một phần'}
                      </span>
                    </div>
                  </div>

                  {assignment.note && (
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200/50">
                      <p className="text-sm font-medium text-slate-700 mb-1">Ghi chú:</p>
                      <p className="text-sm text-slate-600">{assignment.note}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
              ))}
              </div>
            )}
          </div>
        </div>
      </div>

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

export default AssignmentsHistory;

