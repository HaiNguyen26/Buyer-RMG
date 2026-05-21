import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Search } from 'lucide-react';
import { branchManagerService } from '../../services/branchManagerService';
import { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { BranchManagerPageHero } from '../../components/BranchManagerPageHero';
import CustomSelect from '../../components/CustomSelect';
import {
  DashboardV3ShimmerBlock,
  dashboardV3IslandClass,
  dashboardV3PageBgClass,
  dashboardV3StackYClass,
  dashboardV3TableHeaderStripClass,
  dashboardV3ErrorCardClass,
} from '../../components/dashboard/DashboardV3Chrome';
import { branchManagerPageRootClass, branchManagerPageContentClass } from '../../constants/branchManagerLayout';

const BudgetExceptionApproval = () => {
  const queryClient = useQueryClient();
  const { showWarning } = useToast();
  const [selectedPR, setSelectedPR] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'REQUEST_NEGOTIATION' | null>(null);
  const [comment, setComment] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [overFilter, setOverFilter] = useState<'all' | '10' | '20'>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['branch-manager-budget-exceptions'],
    queryFn: () => branchManagerService.getBudgetExceptions(),
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
        showWarning('Vui lòng nhập lý do yêu cầu thương lượng lại');
        return;
      }
      requestNegotiationMutation.mutate({ prId: selectedPR, comment });
    }
  };

  if (isLoading) {
    return (
      <div className={branchManagerPageRootClass}>
        <div
          className={`flex min-h-[50vh] flex-col gap-4 p-4 pb-8 sm:p-6 ${dashboardV3PageBgClass} ${dashboardV3StackYClass}`}
        >
          <DashboardV3ShimmerBlock className="h-28 w-full shrink-0" />
          <DashboardV3ShimmerBlock className="h-20 w-full shrink-0" />
          <DashboardV3ShimmerBlock className="min-h-[240px] flex-1" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${branchManagerPageRootClass} flex min-h-[40vh] flex-col justify-center p-6`}>
        <div className={`max-w-lg ${dashboardV3ErrorCardClass}`}>
          <p className="text-lg font-bold text-rose-900">Lỗi khi tải dữ liệu</p>
          <p className="mt-2 text-sm font-medium text-rose-800/90">
            {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
          </p>
        </div>
      </div>
    );
  }

  const exceptions = data?.exceptions || [];
  const filteredExceptions = exceptions.filter((exception: any) => {
    const keyword = searchQuery.trim().toLowerCase();
    const hitKeyword =
      keyword.length === 0 ||
      exception.prNumber?.toLowerCase().includes(keyword);
    const over = Number(exception.overPercent || 0);
    const hitOver =
      overFilter === 'all' ||
      (overFilter === '10' && over >= 10) ||
      (overFilter === '20' && over >= 20);
    return hitKeyword && hitOver;
  });

  return (
    <div className={branchManagerPageRootClass}>
      <div className={`${branchManagerPageContentClass} ${dashboardV3StackYClass}`}>
        <div className="shrink-0">
        <BranchManagerPageHero
          kicker="Giám đốc chi nhánh · Ngân sách"
          title="Duyệt ngoại lệ ngân sách"
          description="Điểm quyết định nghiệp vụ: chấp nhận vượt ngân sách, yêu cầu thương lượng lại hoặc trả PR."
          Icon={ShieldAlert}
          tint="rose"
          regionLabel="Duyệt ngoại lệ ngân sách"
        />
        </div>

      {/* Info Card */}
      <article className={`${dashboardV3IslandClass} !border-amber-200/60 !bg-amber-50/50 !p-3 sm:!p-4`}>
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={2} />
          <div className="min-w-0">
            <p className="mb-1 text-sm font-medium text-amber-900">Quyết định quan trọng</p>
            <p className="break-words text-sm text-amber-800/90">
              Đây là điểm quyết định nghiệp vụ mới. GĐ Chi nhánh có thể chấp nhận vượt ngân sách, yêu cầu thương lượng lại, hoặc trả PR.
            </p>
          </div>
        </div>
      </article>

      <article className="flex-none rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_34px_-16px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="relative min-w-0 flex-[2]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Tìm theo mã PR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/25"
            />
          </div>
          <div className="min-w-[220px] flex-1">
            <CustomSelect
              value={overFilter}
              onChange={(e) => setOverFilter(e.target.value as 'all' | '10' | '20')}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/25"
            >
              <option value="all">Tất cả mức vượt</option>
              <option value="10">Vượt từ 10%</option>
              <option value="20">Vượt từ 20%</option>
            </CustomSelect>
          </div>
        </div>
      </article>

      {/* Exceptions Table — một luồng cuộn trên main; chỉ overflow-x cục bộ */}
      <article className="module-container module-content min-w-0 max-w-full overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-[0_16px_28px_-22px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5">
        <div className="flex-none border-b border-slate-200 bg-[#F8FAFC] px-4 py-4 sm:px-6">
          <h2 className="text-xl font-bold text-slate-900">Danh sách PR vượt ngân sách ({filteredExceptions.length})</h2>
          <p className="mt-0.5 text-sm text-slate-600">Ưu tiên xem xét kỹ từng PR.</p>
        </div>
        <div className="relative min-w-0 overflow-x-auto bg-white">
          <table className="w-full min-w-0 max-w-full border-collapse table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead className={`sticky top-0 z-20 border-b border-slate-200 ${dashboardV3TableHeaderStripClass} backdrop-blur-[12px] supports-[backdrop-filter]:bg-[#F8FAFC]/90`}>
              <tr>
                <th className="px-2 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 lg:px-6">
                  PR No
                </th>
                <th className="px-2 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 lg:px-6">
                  Giá PR
                </th>
                <th className="px-2 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 lg:px-6">
                  Giá mua dự kiến
                </th>
                <th className="px-2 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 lg:px-6">
                  % Vượt
                </th>
                <th className="px-2 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-700 sm:px-4 sm:py-4 lg:px-6">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExceptions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-slate-500 sm:px-6 sm:py-12">
                    <ShieldAlert className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="font-medium">Chưa có PR vượt ngân sách</p>
                    <p className="text-sm mt-1">Tất cả PR đều trong ngân sách cho phép</p>
                  </td>
                </tr>
              ) : (
                filteredExceptions.map((exception: any, index: number) => {
                  const isSelected = selectedPR === exception.id;
                  return (
                    <tr
                      key={exception.id}
                      className={`group relative h-[72px] transform-gpu border-b border-slate-100 transition-all duration-200 ease-out before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-transparent before:transition-colors before:duration-200 hover:before:bg-indigo-600 ${
                        isSelected ? 'bg-amber-50/80' : index % 2 === 0 ? 'bg-white' : 'bg-[#FBFCFE]'
                      } hover:z-10 hover:scale-[1.002] hover:bg-blue-50/40 hover:shadow-[0_14px_24px_-16px_rgba(15,23,42,0.26)]`}
                    >
                      <td className="min-w-0 align-top px-2 py-3 sm:px-4 sm:py-4 lg:px-6">
                        <div className="break-all font-semibold text-slate-900">{exception.prNumber}</div>
                      </td>
                      <td className="min-w-0 align-top px-2 py-3 sm:px-4 sm:py-4 lg:px-6">
                        <div className="break-words font-medium text-slate-700">
                          {exception.prAmount?.toLocaleString('vi-VN') || '0'} {exception.currency || 'VND'}
                        </div>
                      </td>
                      <td className="min-w-0 align-top px-2 py-3 sm:px-4 sm:py-4 lg:px-6">
                        <div className="break-words font-medium text-red-600">
                          {exception.purchasePrice?.toLocaleString('vi-VN') || '0'} {exception.currency || 'VND'}
                        </div>
                      </td>
                      <td className="min-w-0 align-top px-2 py-3 sm:px-4 sm:py-4 lg:px-6">
                        <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700 sm:gap-2 sm:px-3 sm:text-sm">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          +{exception.overPercent || 0}%
                        </div>
                      </td>
                      <td className="min-w-0 align-top px-2 py-3 sm:px-4 sm:py-4 lg:px-6">
                        <button
                          onClick={() => {
                            setSelectedPR(exception.id);
                            setActionType(null);
                            setComment('');
                          }}
                          className="w-full max-w-full rounded-xl bg-amber-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 sm:w-auto sm:px-4"
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
      </article>
      </div>

      {/* Action Modal */}
      {selectedPR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-popup-overlay" onClick={() => setSelectedPR(null)}>
          <div className="modal-popup-panel bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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


