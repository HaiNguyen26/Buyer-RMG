import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, FileText, Clock, DollarSign, User, Building2, AlertTriangle, CheckCircle, XCircle, Eye } from 'lucide-react';

const PRMonitoring = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPR, setSelectedPR] = useState<any | null>(null);

  // Fetch all PRs for monitoring (read-only view)
  // Note: Using requestorService.getAllPRs temporarily until buyerManagerService.getAllPRs is implemented
  const { data: prsData, isLoading, error } = useQuery({
    queryKey: ['buyer-manager-pr-monitoring', statusFilter],
    queryFn: async () => {
      // Temporary: Use requestor service to get all PRs
      // TODO: Implement buyerManagerService.getAllPRs on backend
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/requestor/prs?status=${statusFilter === 'all' ? '' : statusFilter}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) throw new Error('Failed to fetch PRs');
        return await response.json();
      } catch (error) {
        // Fallback: return empty array if API not available
        console.warn('PR Monitoring API not available, returning empty array:', error);
        return { prs: [] };
      }
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Handle different response structures
  let prs: any[] = [];
  if (prsData) {
    if (Array.isArray(prsData)) {
      prs = prsData;
    } else if (prsData.prs && Array.isArray(prsData.prs)) {
      prs = prsData.prs;
    } else if (prsData.data && Array.isArray(prsData.data)) {
      prs = prsData.data;
    }
  }

  // Filter PRs by search query
  const filteredPRs = prs.filter((pr) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      pr.prNumber?.toLowerCase().includes(searchLower) ||
      pr.requestor?.username?.toLowerCase().includes(searchLower) ||
      pr.requestor?.email?.toLowerCase().includes(searchLower) ||
      pr.department?.toLowerCase().includes(searchLower) ||
      pr.itemName?.toLowerCase().includes(searchLower)
    );
  });

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

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
      DRAFT: { label: 'Nháp', color: 'text-slate-700', bgColor: 'bg-slate-100', icon: FileText },
      SUBMITTED: { label: 'Đã gửi', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: FileText },
      MANAGER_PENDING: { label: 'Chờ quản lý trực tiếp', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Clock },
      MANAGER_APPROVED: { label: 'Quản lý trực tiếp đã duyệt', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
      MANAGER_REJECTED: { label: 'Quản lý trực tiếp từ chối', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
      BRANCH_MANAGER_PENDING: { label: 'Chờ GĐ Chi nhánh', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: Clock },
      BUYER_LEADER_PENDING: { label: 'Đã duyệt - chờ Buyer Leader phân công', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
      // Legacy statuses (backward compatibility)
      DEPARTMENT_HEAD_PENDING: { label: 'Chờ quản lý trực tiếp', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Clock },
      DEPARTMENT_HEAD_APPROVED: { label: 'Quản lý trực tiếp đã duyệt', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
      DEPARTMENT_HEAD_REJECTED: { label: 'Quản lý trực tiếp từ chối', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
      BRANCH_MANAGER_APPROVED: { label: 'Đã duyệt - chờ Buyer Leader phân công', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
      ASSIGNED_TO_BUYER: { label: 'Đã phân công Buyer', color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: User },
      RFQ_IN_PROGRESS: { label: 'Đang hỏi giá', color: 'text-cyan-700', bgColor: 'bg-cyan-100', icon: Clock },
      QUOTATION_RECEIVED: { label: 'Đã nhận báo giá', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: FileText },
      SUPPLIER_SELECTED: { label: 'Đã chọn NCC', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: CheckCircle },
      BUDGET_EXCEPTION: { label: 'Vượt ngân sách', color: 'text-red-700', bgColor: 'bg-red-100', icon: AlertTriangle },
      BUDGET_APPROVED: { label: 'Đã duyệt vượt ngân sách', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
      BUDGET_REJECTED: { label: 'Từ chối vượt ngân sách', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
      PAYMENT_DONE: { label: 'Đã thanh toán', color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: CheckCircle },
      CANCELLED: { label: 'Đã hủy', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: XCircle },
    };

    const statusInfo = statusMap[status] || { label: status, color: 'text-slate-700', bgColor: 'bg-slate-100', icon: FileText };
    const Icon = statusInfo.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color} ${statusInfo.bgColor}`}>
        <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        {statusInfo.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-800 font-medium text-center">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-2 text-center">
            {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col bg-slate-50">
      {/* Filters and Search Bar */}
      <div className="shrink-0 bg-white border-b border-slate-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã PR, người yêu cầu, phòng ban..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="DRAFT">Nháp</option>
              <option value="MANAGER_PENDING">Chờ quản lý trực tiếp</option>
              <option value="BRANCH_MANAGER_PENDING">Chờ GĐ Chi nhánh</option>
              <option value="ASSIGNED_TO_BUYER">Đã phân công</option>
              <option value="RFQ_IN_PROGRESS">Đang hỏi giá</option>
              <option value="QUOTATION_RECEIVED">Đã nhận báo giá</option>
              <option value="SUPPLIER_SELECTED">Đã chọn NCC</option>
              <option value="BUDGET_EXCEPTION">Vượt ngân sách</option>
              <option value="PAYMENT_DONE">Đã thanh toán</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-slate-600">
          Tìm thấy <span className="font-semibold text-slate-900">{filteredPRs.length}</span> PR
        </div>
      </div>

      {/* PR Table */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          {filteredPRs.length === 0 ? (
            <div className="h-full min-h-[400px] flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" strokeWidth={1.5} />
                <p className="text-slate-500 text-lg font-medium">Không có PR nào</p>
                <p className="text-slate-400 text-sm mt-2">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Mã PR
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Người yêu cầu
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Phòng ban
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Tổng tiền
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Ngày tạo
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredPRs.map((pr) => (
                    <tr
                      key={pr.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedPR(pr)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-900">{pr.prNumber || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {pr.requestor?.username || 'N/A'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {pr.requestor?.email || ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-700">{pr.department || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-900">
                            {formatCurrency(pr.totalAmount)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(pr.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-700">
                            {pr.createdAt
                              ? new Date(pr.createdAt).toLocaleDateString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })
                              : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPR(pr);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#2563EB] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          Xem
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* PR Detail Modal */}
      {selectedPR && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPR(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Chi tiết PR</h3>
                <p className="text-sm text-slate-500 mt-1">{selectedPR.prNumber || 'N/A'}</p>
              </div>
              <button
                onClick={() => setSelectedPR(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* PR Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Người yêu cầu</label>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {selectedPR.requestor?.username || 'N/A'}
                  </p>
                  <p className="text-xs text-slate-500">{selectedPR.requestor?.email || ''}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Phòng ban</label>
                  <p className="mt-1 text-sm font-medium text-slate-900">{selectedPR.department || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Tổng tiền</label>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {formatCurrency(selectedPR.totalAmount)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Trạng thái</label>
                  <div className="mt-1">{getStatusBadge(selectedPR.status)}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Ngày tạo</label>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {selectedPR.createdAt
                      ? new Date(selectedPR.createdAt).toLocaleString('vi-VN')
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Ngày cập nhật</label>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {selectedPR.updatedAt
                      ? new Date(selectedPR.updatedAt).toLocaleString('vi-VN')
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Notes */}
              {selectedPR.notes && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Ghi chú</label>
                  <p className="mt-1 text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                    {selectedPR.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PRMonitoring;
