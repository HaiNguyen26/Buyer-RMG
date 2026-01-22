import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { branchManagerService } from '../../services/branchManagerService';
import { useState } from 'react';

const BudgetExceptionApproval = () => {
  const queryClient = useQueryClient();
  const [selectedPR, setSelectedPR] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'REQUEST_NEGOTIATION' | null>(null);
  const [comment, setComment] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['branch-manager-budget-exceptions'],
    queryFn: () => branchManagerService.getBudgetExceptions(),
    enabled: false, // Disable until API is ready
  });

  const approveMutation = useMutation({
    mutationFn: ({ prId, comment }: { prId: string; comment?: string }) =>
      branchManagerService.approveBudgetException(prId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-manager-budget-exceptions'] });
      setSelectedPR(null);
      setActionType(null);
      setComment('');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ prId, comment }: { prId: string; comment?: string }) =>
      branchManagerService.rejectBudgetException(prId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-manager-budget-exceptions'] });
      setSelectedPR(null);
      setActionType(null);
      setComment('');
    },
  });

  const requestNegotiationMutation = useMutation({
    mutationFn: ({ prId, comment }: { prId: string; comment: string }) =>
      branchManagerService.requestNegotiation(prId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-manager-budget-exceptions'] });
      setSelectedPR(null);
      setActionType(null);
      setComment('');
    },
  });

  const handleAction = () => {
    if (!selectedPR) return;

    if (actionType === 'APPROVE') {
      approveMutation.mutate({ prId: selectedPR, comment });
    } else if (actionType === 'REJECT') {
      rejectMutation.mutate({ prId: selectedPR, comment });
    } else if (actionType === 'REQUEST_NEGOTIATION') {
      if (!comment.trim()) {
        alert('Vui lòng nhập lý do yêu cầu thương lượng lại');
        return;
      }
      requestNegotiationMutation.mutate({ prId: selectedPR, comment });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">Đang tải...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          Lỗi khi tải dữ liệu
        </div>
      </div>
    );
  }

  // Mock data structure
  const exceptions = data?.exceptions || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-amber-100 rounded-xl">
          <ShieldAlert className="w-6 h-6 text-amber-600" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Budget Exception Approval</h1>
          <p className="text-sm text-slate-600">Điểm quyết định nghiệp vụ: Chấp nhận vượt ngân sách hoặc yêu cầu thương lượng lại</p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5" strokeWidth={2} />
          <div>
            <p className="text-sm font-medium text-amber-900 mb-1">Quyết định quan trọng</p>
            <p className="text-sm text-amber-700">
              Đây là điểm quyết định nghiệp vụ mới. GĐ Chi nhánh có thể chấp nhận vượt ngân sách, yêu cầu thương lượng lại, hoặc trả PR.
            </p>
          </div>
        </div>
      </div>

      {/* Exceptions Table */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">PR No</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Giá PR</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Giá mua dự kiến</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">% Vượt</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exceptions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium">Chưa có PR vượt ngân sách</p>
                    <p className="text-sm mt-1">Tất cả PR đều trong ngân sách cho phép</p>
                  </td>
                </tr>
              ) : (
                exceptions.map((exception: any) => {
                  const isSelected = selectedPR === exception.id;
                  return (
                    <tr key={exception.id} className={`hover:bg-amber-50/30 transition-colors ${isSelected ? 'bg-amber-50' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{exception.prNumber}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-700">
                          {exception.prAmount?.toLocaleString('vi-VN') || '0'} {exception.currency || 'VND'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-red-600">
                          {exception.purchasePrice?.toLocaleString('vi-VN') || '0'} {exception.currency || 'VND'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">
                          <AlertTriangle className="w-4 h-4" />
                          +{exception.overPercent || 0}%
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedPR(exception.id);
                            setActionType(null);
                            setComment('');
                          }}
                          className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors text-sm font-medium"
                        >
                          Xử lý
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {selectedPR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Xử lý PR vượt ngân sách</h2>
                <button
                  onClick={() => {
                    setSelectedPR(null);
                    setActionType(null);
                    setComment('');
                  }}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Chọn hành động</label>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => setActionType('APPROVE')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      actionType === 'APPROVE'
                        ? 'border-green-500 bg-green-50'
                        : 'border-slate-200 hover:border-green-300 hover:bg-green-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={`w-5 h-5 ${actionType === 'APPROVE' ? 'text-green-600' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-semibold text-slate-900">Chấp nhận vượt</div>
                        <div className="text-sm text-slate-600">Cho phép Buyer tiếp tục mua với giá cao hơn</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActionType('REQUEST_NEGOTIATION')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      actionType === 'REQUEST_NEGOTIATION'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`w-5 h-5 ${actionType === 'REQUEST_NEGOTIATION' ? 'text-amber-600' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-semibold text-slate-900">Yêu cầu thương lượng lại</div>
                        <div className="text-sm text-slate-600">Yêu cầu Buyer thương lượng lại với NCC</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActionType('REJECT')}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      actionType === 'REJECT'
                        ? 'border-red-500 bg-red-50'
                        : 'border-slate-200 hover:border-red-300 hover:bg-red-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <XCircle className={`w-5 h-5 ${actionType === 'REJECT' ? 'text-red-600' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-semibold text-slate-900">Trả PR</div>
                        <div className="text-sm text-slate-600">Trả PR về Requestor để điều chỉnh</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {(actionType === 'REQUEST_NEGOTIATION' || actionType === 'REJECT') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ghi chú / Lý do {actionType === 'REQUEST_NEGOTIATION' ? '(bắt buộc)' : '(tùy chọn)'}
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    placeholder={actionType === 'REQUEST_NEGOTIATION' ? 'Nhập lý do yêu cầu thương lượng lại...' : 'Nhập ghi chú (nếu có)...'}
                  />
                </div>
              )}

              {actionType && (
                <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      setSelectedPR(null);
                      setActionType(null);
                      setComment('');
                    }}
                    className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleAction}
                    disabled={
                      approveMutation.isPending ||
                      rejectMutation.isPending ||
                      requestNegotiationMutation.isPending ||
                      (actionType === 'REQUEST_NEGOTIATION' && !comment.trim())
                    }
                    className={`px-5 py-2.5 rounded-xl text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      actionType === 'APPROVE'
                        ? 'bg-green-600 hover:bg-green-700'
                        : actionType === 'REJECT'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    {approveMutation.isPending || rejectMutation.isPending || requestNegotiationMutation.isPending
                      ? 'Đang xử lý...'
                      : actionType === 'APPROVE'
                      ? 'Chấp nhận'
                      : actionType === 'REJECT'
                      ? 'Trả PR'
                      : 'Yêu cầu thương lượng'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetExceptionApproval;

