import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requestorService } from '../../services/requestorService';
import { Plus, Edit, Eye, Filter, Search, X, Building2, User, Calendar, DollarSign, Package, Info, FileText, Mail, MapPin, FileEdit, Clock, CheckCircle2, XCircle, AlertCircle, ArrowLeftRight, Send, ShoppingCart, FileCheck, UserCheck, Ban, Wallet, CheckCircle, XOctagon } from 'lucide-react';
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
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const { data: prDetails, isLoading: isLoadingPRDetails, error: prDetailsError } = useQuery({
    queryKey: ['requestor-pr-details', selectedPRId],
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

  const handleEditPR = (prId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/dashboard/requestor/pr/${prId}`);
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
      'APPROVED_BY_BRANCH': {
        label: 'Đã duyệt bởi Chi nhánh',
        color: 'bg-white text-emerald-700 border-emerald-300',
        icon: CheckCircle
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
    return status === 'DRAFT' || status === 'NEED_MORE_INFO';
  };

  const filteredPRs = prsData?.prs?.filter((pr: any) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        pr.prNumber.toLowerCase().includes(query) ||
        pr.itemName.toLowerCase().includes(query) ||
        pr.department?.toLowerCase().includes(query) ||
        pr.purpose?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col overflow-hidden p-6">
        <div className="animate-pulse space-y-4 flex-shrink-0">
          <div className="h-12 bg-slate-200 rounded w-64"></div>
        </div>
        <div className="flex-1 min-h-0 bg-slate-200 rounded mt-4"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="bg-red-50 border border-red-200 rounded-soft p-4">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex flex-col h-full">
        {/* Filters - Fixed at top */}
        <div className="flex-shrink-0 p-6 pb-4">
          <div className="rounded-2xl shadow-md border border-slate-200/50 p-4 bg-white slide-right-title">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo số PR, tên hàng hóa, phòng ban..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 bg-white"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="DRAFT">Nháp</option>
                  <option value="MANAGER_PENDING">Chờ quản lý trực tiếp duyệt</option>
                  <option value="MANAGER_APPROVED">Quản lý trực tiếp đã duyệt</option>
                  <option value="MANAGER_REJECTED">Quản lý trực tiếp từ chối</option>
                  <option value="MANAGER_RETURNED">Quản lý trực tiếp trả về</option>
                  <option value="BRANCH_MANAGER_PENDING">Chờ GĐ Chi nhánh duyệt</option>
                  <option value="BUYER_LEADER_PENDING">Đã duyệt - chờ Buyer Leader phân công</option>
                  <option value="BRANCH_MANAGER_REJECTED">GĐ Chi nhánh từ chối</option>
                  <option value="BRANCH_MANAGER_RETURNED">GĐ Chi nhánh trả về</option>
                  <option value="NEED_MORE_INFO">Cần thêm thông tin</option>
                  <option value="ASSIGNED_TO_BUYER">Đã phân công Buyer</option>
                  <option value="RFQ_IN_PROGRESS">Đang hỏi giá</option>
                  <option value="QUOTATION_RECEIVED">Đã nhận báo giá</option>
                  <option value="SUPPLIER_SELECTED">Đã chọn NCC</option>
                  <option value="PAYMENT_DONE">Đã thanh toán</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* PRs List - Fixed height with scroll */}
        <div className="flex-1 min-h-0 flex flex-col px-6 pb-6">
          <div className="flex-1 min-h-0 flex flex-col rounded-2xl shadow-lg border border-slate-200/50 bg-white overflow-hidden slide-right-content relative z-10" style={{ borderRadius: '1.25rem' }}>
            {/* Header */}
            <div className="flex-shrink-0 p-6 pb-4 border-b border-slate-200 bg-white">
              <h2 className="text-xl font-bold text-slate-900">
                Danh sách PR ({filteredPRs?.length || 0})
              </h2>
            </div>
            
            {/* Table Container - Scrollable with fixed height */}
            <div 
              className="bg-white overflow-y-auto overflow-x-hidden" 
              style={{ 
                borderBottomLeftRadius: '1.25rem', 
                borderBottomRightRadius: '1.25rem',
                height: '504px', // Fixed height to show ~7 PRs (72px per row)
                maxHeight: '504px',
              }}
            >
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider bg-slate-50">
                      Số PR
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider bg-slate-50">
                      Phòng ban
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider bg-slate-50">
                      Mục đích
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider bg-slate-50">
                      Tổng tiền
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider bg-slate-50">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider bg-slate-50">
                      Ngày tạo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider bg-slate-50">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredPRs && filteredPRs.length > 0 ? (
                    filteredPRs.map((pr: any, index: number) => {
                      const isLastRow = index === filteredPRs.length - 1;
                      return (
                        <tr 
                          key={pr.id} 
                          onClick={() => handleViewPRDetails(pr.id)}
                          className={`hover:bg-blue-50/50 transition-colors bg-white cursor-pointer ${!isLastRow ? 'border-b border-slate-200' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                            {pr.prNumber}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 font-normal">
                            {pr.department || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 font-normal">
                            {pr.purpose ? (
                              <span className="line-clamp-2" title={pr.purpose}>{pr.purpose}</span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                            {pr.totalAmount 
                              ? `${pr.totalAmount.toLocaleString('vi-VN')} ${pr.currency || 'VND'}`
                              : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {(() => {
                              const StatusIcon = getStatusIcon(pr.status);
                              return (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border shadow-sm hover:shadow-md transition-shadow ${getStatusColor(pr.status)}`}>
                                  <StatusIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
                                  {getStatusLabel(pr.status)}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-normal">
                            {new Date(pr.createdAt).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => handleViewPRDetails(pr.id, e)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-soft transition-colors"
                                title="Xem chi tiết"
                              >
                                <Eye className="w-4 h-4" strokeWidth={2} />
                              </button>
                              {canEdit(pr.status) && (
                                <button
                                  onClick={(e) => handleEditPR(pr.id, e)}
                                  className="p-2 text-amber-600 hover:bg-amber-50 rounded-soft transition-colors"
                                  title="Chỉnh sửa"
                                >
                                  <Edit className="w-4 h-4" strokeWidth={2} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500 bg-white" style={{ height: '504px' }}>
                        <div className="flex flex-col items-center justify-center h-full">
                          <FileText className="w-16 h-16 text-slate-300 mb-4" strokeWidth={1.5} />
                          <p className="text-slate-500 text-lg font-medium">Không có PR nào</p>
                          <p className="text-slate-400 text-sm mt-2">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                    {prDetails.requestor && (
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl shadow-sm">
                        <User className="w-5 h-5 text-slate-600" strokeWidth={2} />
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Người yêu cầu</p>
                          <p className="font-semibold text-slate-900">{prDetails.requestor.username || 'N/A'}</p>
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
                        <div className="border border-slate-200 rounded-xl overflow-hidden" style={{ borderRadius: '0.75rem' }}>
                          <table className="w-full">
                            <thead className="bg-slate-100 border-b border-slate-200" style={{ borderTopLeftRadius: '0.75rem', borderTopRightRadius: '0.75rem' }}>
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100">STT</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100">Số linh kiện</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100">Tên</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100">Thông số</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100">Nhà SX</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100">SL</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100">ĐV</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100">Đơn giá</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100">Thành tiền</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-100">Ghi chú</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                              {prDetails.items.map((item: any, index: number) => {
                                const isLastRow = index === prDetails.items.length - 1;
                                return (
                                  <tr key={item.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                    <td className={`px-4 py-3 text-sm text-slate-900 ${isLastRow ? 'rounded-bl-xl' : ''}`} style={isLastRow ? { borderBottomLeftRadius: '0.75rem' } : {}}>
                                      {item.lineNo || index + 1}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-900">{item.partNo || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">{item.description || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{item.spec || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{item.manufacturer || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-900">{item.qty || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-600">{item.unit || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-slate-900">
                                      {item.unitPrice ? `${item.unitPrice.toLocaleString('vi-VN')}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                                      {item.amount ? `${item.amount.toLocaleString('vi-VN')}` : '-'}
                                    </td>
                                    <td className={`px-4 py-3 text-sm text-slate-600 ${isLastRow ? 'rounded-br-xl' : ''}`} style={isLastRow ? { borderBottomRightRadius: '0.75rem' } : {}}>
                                      {item.remark || '-'}
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
                    navigate(`/dashboard/requestor/pr/${prDetails.id}`);
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

