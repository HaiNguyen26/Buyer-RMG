import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Building2, User, DollarSign, Calendar, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
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
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getStatusBadge = (statusLabel: string, statusColor: string) => {
  const baseClasses = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold';
  
  if (statusColor === 'green') {
    return (
      <span className={`${baseClasses} bg-green-100 text-green-700`}>
        <CheckCircle className="w-3.5 h-3.5" strokeWidth={2} />
        {statusLabel}
      </span>
    );
  } else if (statusColor === 'red') {
    return (
      <span className={`${baseClasses} bg-red-100 text-red-700`}>
        <XCircle className="w-3.5 h-3.5" strokeWidth={2} />
        {statusLabel}
      </span>
    );
  } else {
    return (
      <span className={`${baseClasses} bg-amber-100 text-amber-700`}>
        <Clock className="w-3.5 h-3.5" strokeWidth={2} />
        {statusLabel}
      </span>
    );
  }
};

const OverBudgetPRs = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['buyer-leader-over-budget-prs', statusFilter],
    queryFn: () => buyerLeaderService.getOverBudgetPRs(statusFilter === 'all' ? undefined : statusFilter),
  });

  const prs = data?.prs || [];

  // Count by status
  const pendingCount = prs.filter((p: any) => p.status === 'BUDGET_EXCEPTION').length;
  const approvedCount = prs.filter((p: any) => p.status === 'BUDGET_APPROVED').length;
  const rejectedCount = prs.filter((p: any) => p.status === 'BUDGET_REJECTED').length;

  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ backgroundColor: 'transparent' }}>
      {/* Header */}
      <div className="flex-shrink-0 mb-6 px-6 pt-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-soft-md border border-slate-200/50 p-6 slide-right-title">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">PR Vượt ngân sách</h1>
              <p className="text-slate-600">Theo dõi PR vượt ngân sách trước khi lên GĐ CN</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex-shrink-0 px-6 mb-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/50 p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-700">Lọc theo trạng thái:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tất cả ({prs.length})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'pending'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Clock className="w-4 h-4" strokeWidth={2} />
                Chờ GĐ CN ({pendingCount})
              </button>
              <button
                onClick={() => setStatusFilter('approved')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'approved'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <CheckCircle className="w-4 h-4" strokeWidth={2} />
                Đã duyệt ({approvedCount})
              </button>
              <button
                onClick={() => setStatusFilter('rejected')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'rejected'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <XCircle className="w-4 h-4" strokeWidth={2} />
                Bị từ chối ({rejectedCount})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-6 pb-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/50 flex-1 flex flex-col overflow-hidden slide-right-content">
          {/* Table Header */}
          <div className="flex-shrink-0 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200/50 overflow-hidden" style={{ borderTopLeftRadius: '1.25rem', borderTopRightRadius: '1.25rem' }}>
            <div className="grid grid-cols-12 gap-4 px-6 py-4 text-sm font-semibold text-slate-700">
              <div className="col-span-2">Mã PR</div>
              <div className="col-span-2">Phòng ban</div>
              <div className="col-span-2">Người yêu cầu</div>
              <div className="col-span-2">Giá PR</div>
              <div className="col-span-2">Giá mua</div>
              <div className="col-span-1">% vượt</div>
              <div className="col-span-1">Trạng thái</div>
            </div>
          </div>

          {/* Table Body - Scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-white overflow-hidden scrollbar-hide" style={{ borderBottomLeftRadius: '1.25rem', borderBottomRightRadius: '1.25rem' }}>
            {prs.length === 0 ? (
              <div className="h-full min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
                  <p className="text-slate-500 text-lg font-medium">
                    {statusFilter === 'all' 
                      ? 'Không có PR vượt ngân sách' 
                      : statusFilter === 'pending'
                        ? 'Không có PR chờ GĐ CN duyệt'
                        : statusFilter === 'approved'
                          ? 'Không có PR đã được duyệt'
                          : 'Không có PR bị từ chối'}
                  </p>
                  <p className="text-slate-400 text-sm mt-2">Tất cả PR đều trong ngân sách hoặc đã được xử lý</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100/50 w-full bg-white">
                {prs.map((pr: any, index: number) => (
                  <div
                    key={pr.id}
                    className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors bg-white slide-right-item cursor-pointer"
                    style={{ animationDelay: `${0.5 + index * 0.03}s` }}
                    onClick={() => {
                      // TODO: Open PR details modal
                      alert(`Chi tiết PR ${pr.prNumber} sẽ được hiển thị ở đây`);
                    }}
                  >
                    <div className="col-span-2 flex items-center">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-red-500 flex-shrink-0" strokeWidth={2} />
                        <span className="text-sm font-medium text-slate-900">{pr.prNumber}</span>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" strokeWidth={2} />
                      <span className="text-sm text-slate-700 min-w-0 truncate">
                        {pr.department || 'N/A'}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400 flex-shrink-0" strokeWidth={2} />
                      <span className="text-sm text-slate-700 min-w-0 truncate">
                        {pr.requestor?.username || 'N/A'}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-slate-400 flex-shrink-0" strokeWidth={2} />
                      <span className="text-sm font-medium text-slate-900">
                        {formatCurrency(pr.prAmount, pr.currency)}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <span className="text-sm font-bold text-red-600">
                        {formatCurrency(pr.purchaseAmount, pr.currency)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center">
                      <span className="text-sm font-bold text-red-600">
                        +{pr.overPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center">
                      {getStatusBadge(pr.statusLabel, pr.statusColor)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverBudgetPRs;








