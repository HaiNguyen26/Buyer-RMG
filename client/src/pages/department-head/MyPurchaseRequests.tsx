import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requestorService } from '../../services/requestorService';
import { Plus, Edit, Eye, Filter, Search, X, Building2, User, Calendar, DollarSign, Package, Info, FileText, FileEdit, Clock, CheckCircle2, XCircle, ArrowLeftRight, Send, ShoppingCart, FileCheck, UserCheck, Wallet, CheckCircle, XOctagon, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

const MyPurchaseRequests = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const { data: prsData, isLoading, error } = useQuery({
    queryKey: ['requestor-prs', statusFilter],
    queryFn: () => requestorService.getMyPRs({ status: statusFilter === 'all' ? undefined : statusFilter }),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Fetch PR details for modal
  const { data: prDetails, isLoading: isLoadingPRDetails, error: prDetailsError } = useQuery({
    queryKey: ['pr-details', selectedPRId],
    queryFn: () => requestorService.getPR(selectedPRId!),
    enabled: !!selectedPRId && isDetailModalOpen,
    retry: 1,
  });

  const handleViewPRDetails = (prId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedPRId(prId);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedPRId(null);
  };

  const getStatusInfo = (status: string) => {
    const statusMap: { [key: string]: { label: string; color: string; icon: any } } = {
      'DRAFT': {
        label: 'Nháp',
        color: 'bg-white text-slate-800 border-slate-300',
        icon: FileEdit
      },
      'SUBMITTED': {
        label: 'Đã gửi',
        color: 'bg-white text-blue-700 border-blue-300',
        icon: Send
      },
      'MANAGER_PENDING': {
        label: 'Chờ quản lý trực tiếp duyệt',
        color: 'bg-white text-amber-700 border-amber-300',
        icon: Clock
      },
      'MANAGER_APPROVED': {
        label: 'Quản lý trực tiếp đã duyệt',
        color: 'bg-white text-green-700 border-green-300',
        icon: CheckCircle2
      },
      'MANAGER_REJECTED': {
        label: 'Quản lý trực tiếp từ chối',
        color: 'bg-white text-red-700 border-red-300',
        icon: XCircle
      },
      'MANAGER_RETURNED': {
        label: 'Quản lý trực tiếp trả về',
        color: 'bg-white text-orange-700 border-orange-300',
        icon: ArrowLeftRight
      },
      'BRANCH_MANAGER_PENDING': {
        label: 'Chờ GĐ Chi nhánh duyệt',
        color: 'bg-white text-purple-700 border-purple-300',
        icon: Clock
      },
      'BUYER_LEADER_PENDING': {
        label: 'Đã duyệt - chờ Buyer Leader phân công',
        color: 'bg-white text-emerald-700 border-emerald-300',
        icon: CheckCircle
      },
      // Legacy statuses (backward compatibility)
      'DEPARTMENT_HEAD_PENDING': {
        label: 'Chờ quản lý trực tiếp duyệt',
        color: 'bg-white text-amber-700 border-amber-300',
        icon: Clock
      },
      'DEPARTMENT_HEAD_APPROVED': {
        label: 'Quản lý trực tiếp đã duyệt',
        color: 'bg-white text-green-700 border-green-300',
        icon: CheckCircle2
      },
      'DEPARTMENT_HEAD_REJECTED': {
        label: 'Quản lý trực tiếp từ chối',
        color: 'bg-white text-red-700 border-red-300',
        icon: XCircle
      },
      'DEPARTMENT_HEAD_RETURNED': {
        label: 'Quản lý trực tiếp trả về',
        color: 'bg-white text-orange-700 border-orange-300',
        icon: ArrowLeftRight
      },
      'BRANCH_MANAGER_APPROVED': {
        label: 'Đã duyệt - chờ Buyer Leader phân công',
        color: 'bg-white text-emerald-700 border-emerald-300',
        icon: CheckCircle
      },
      'BRANCH_MANAGER_REJECTED': {
        label: 'GĐ Chi nhánh từ chối',
        color: 'bg-white text-red-700 border-red-300',
        icon: XOctagon
      },
      'BRANCH_MANAGER_RETURNED': {
        label: 'GĐ Chi nhánh trả về',
        color: 'bg-white text-orange-700 border-orange-300',
        icon: ArrowLeftRight
      },
      'NEED_MORE_INFO': {
        label: 'Cần thêm thông tin',
        color: 'bg-white text-yellow-700 border-yellow-300',
        icon: AlertCircle
      },
      'ASSIGNED_TO_BUYER': {
        label: 'Đã phân công Buyer',
        color: 'bg-white text-indigo-700 border-indigo-300',
        icon: UserCheck
      },
      'RFQ_IN_PROGRESS': {
        label: 'Đang hỏi giá',
        color: 'bg-white text-cyan-700 border-cyan-300',
        icon: ShoppingCart
      },
      'QUOTATION_RECEIVED': {
        label: 'Đã nhận báo giá',
        color: 'bg-white text-teal-700 border-teal-300',
        icon: FileCheck
      },
      'SUPPLIER_SELECTED': {
        label: 'Đã chọn NCC',
        color: 'bg-white text-blue-700 border-blue-300',
        icon: CheckCircle2
      },
      'BUDGET_EXCEPTION': {
        label: 'Vượt ngân sách',
        color: 'bg-white text-rose-700 border-rose-300',
        icon: AlertCircle
      },
      'BUDGET_APPROVED': {
        label: 'Đã chấp nhận vượt ngân sách',
        color: 'bg-white text-green-700 border-green-300',
        icon: CheckCircle2
      },
      'BUDGET_REJECTED': {
        label: 'Từ chối vượt ngân sách',
        color: 'bg-white text-red-700 border-red-300',
        icon: XCircle
      },
      'PAYMENT_DONE': {
        label: 'Đã thanh toán',
        color: 'bg-white text-emerald-700 border-emerald-300',
        icon: Wallet
      },
      'READY_FOR_RFQ': {
        label: 'Sẵn sàng hỏi giá',
        color: 'bg-white text-emerald-700 border-emerald-300',
        icon: FileCheck
      }
    };

    return statusMap[status] || {
      label: status,
      color: 'bg-white text-slate-800 border-slate-300',
      icon: Info
    };
  };

  const getStatusLabel = (status: string) => {
    return getStatusInfo(status).label;
  };

  const getStatusColor = (status: string) => {
    return getStatusInfo(status).color;
  };

  const getStatusIcon = (status: string) => {
    const IconComponent = getStatusInfo(status).icon;
    return IconComponent;
  };

  const canEdit = (status: string) => {
    return status === 'DRAFT' || status === 'NEED_MORE_INFO' || status === 'MANAGER_RETURNED' || status === 'DEPARTMENT_HEAD_RETURNED' || status === 'BRANCH_MANAGER_RETURNED';
  };

  const prs = prsData?.prs || [];

  const filteredPRs = prs.filter((pr: any) => {
    const matchesSearch =
      pr.prNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (pr.department && pr.department.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

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
        <div className="text-center">
          <p className="text-red-600">Lỗi khi tải dữ liệu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">My Purchase Requests</h2>
            <p className="text-slate-600 mt-1">Quản lý PR do chính bạn tạo</p>
          </div>
          <button
            onClick={() => navigate('/dashboard/department-head/my-prs/create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Tạo PR mới
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã PR, phòng ban..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-600" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="DRAFT">Draft</option>
              <option value="MANAGER_PENDING">Chờ quản lý trực tiếp</option>
              <option value="BRANCH_MANAGER_PENDING">Chờ GĐ CN</option>
              <option value="MANAGER_RETURNED">Trả về (QL trực tiếp)</option>
              <option value="BRANCH_MANAGER_RETURNED">Trả về (GĐ CN)</option>
            </select>
          </div>
        </div>

        {/* PR List */}
        <div className="bg-white/80 backdrop-blur-sm rounded-soft-lg shadow-soft-md border border-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Mã PR</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Phòng ban</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Tổng tiền</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Trạng thái</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Ngày tạo</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredPRs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <p className="text-slate-600">Không có PR nào</p>
                    </td>
                  </tr>
                ) : (
                  filteredPRs.map((pr: any) => (
                    <tr key={pr.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-slate-900">{pr.prNumber}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">{pr.department || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {pr.totalAmount ? (
                          <span className="font-medium text-slate-900">
                            {pr.totalAmount.toLocaleString('vi-VN')} {pr.currency || 'VND'}
                          </span>
                        ) : (
                          <span className="text-slate-400">Chưa có</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pr.status)}`}>
                          {getStatusLabel(pr.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        {new Date(pr.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleViewPRDetails(pr.id, e)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors-theme"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {canEdit(pr.status) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/dashboard/department-head/my-prs/${pr.id}/edit`);
                              }}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors-theme"
                              title="Chỉnh sửa"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PR Details Modal */}
      {isDetailModalOpen && selectedPRId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={handleCloseDetailModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-slideUpFadeIn overflow-hidden" onClick={(e) => e.stopPropagation()}>
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
            <div className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-hide">
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
                    {(prDetails as any).requestor && (
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl shadow-sm">
                        <User className="w-5 h-5 text-slate-600" strokeWidth={2} />
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Người yêu cầu</p>
                          <p className="font-semibold text-slate-900">{(prDetails as any).requestor?.username || 'N/A'}</p>
                        </div>
                      </div>
                    )}
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
                          {formatCurrency((prDetails as any).totalAmount, (prDetails as any).currency)}
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
                        <div className="border border-slate-200 rounded-xl overflow-hidden" style={{ borderRadius: '0.75rem' }}>
                          <table className="w-full">
                            <thead className="bg-slate-100 border-b border-slate-200" style={{ borderTopLeftRadius: '0.75rem', borderTopRightRadius: '0.75rem' }}>
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">STT</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">Mô tả</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">Số lượng</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">Đơn vị</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 bg-slate-100">Mục đích</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white">
                              {prDetails.items.map((item: any, index: number) => {
                                const isLastRow = index === (prDetails.items?.length || 0) - 1;
                                return (
                                  <tr key={item.id || index} className="bg-white border-b border-slate-200 last:border-b-0">
                                    <td className="px-4 py-3 text-sm text-slate-900 bg-white">{item.lineNo || index + 1}</td>
                                    <td className="px-4 py-3 text-sm text-slate-700 bg-white">{item.description || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-900 bg-white">{item.qty || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-700 bg-white">{item.unit || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-700 bg-white" style={isLastRow ? { borderBottomLeftRadius: '0.75rem', borderBottomRightRadius: '0.75rem' } : {}}>
                                      {item.purpose || '-'}
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
                  {prDetails.notes && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-slate-600" strokeWidth={2} />
                        <p className="text-sm font-semibold text-slate-900">Ghi chú</p>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{prDetails.notes}</p>
                    </div>
                  )}

                  {/* Status */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Trạng thái</p>
                        {(() => {
                          const StatusIcon = getStatusIcon(prDetails.status);
                          return (
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border shadow-sm hover:shadow-md transition-shadow ${getStatusColor(prDetails.status)}`}>
                              <StatusIcon className="w-4 h-4" strokeWidth={2.5} />
                              {getStatusLabel(prDetails.status)}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 mb-1">Ngày tạo</p>
                        <p className="text-sm font-medium text-slate-900">{formatDate(prDetails.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              {prDetails && canEdit(prDetails.status) && (
                <button
                  onClick={() => {
                    handleCloseDetailModal();
                    navigate(`/dashboard/department-head/my-prs/${prDetails.id}/edit`);
                  }}
                  className="px-6 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-medium shadow-sm hover:shadow-md flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" strokeWidth={2} />
                  Chỉnh sửa PR
                </button>
              )}
              <button
                onClick={handleCloseDetailModal}
                className="px-6 py-2 text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm hover:shadow-md"
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

export default MyPurchaseRequests;


