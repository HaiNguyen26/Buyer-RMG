import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requestorService } from '../../services/requestorService';
import { Plus, Edit, Eye, Filter, Search, X, Building2, User, Calendar, DollarSign, Package, Info, FileText, FileEdit, Clock, CheckCircle2, XCircle, ArrowLeftRight, Send, ShoppingCart, FileCheck, UserCheck, Wallet, CheckCircle, XOctagon, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DepartmentPageHero } from '../../components/DepartmentPageHero';
import {
  departmentHeadListTableScrollClass,
  departmentHeadTableTbodyElevatedClass,
  departmentHeadTableDataRowClasses,
  departmentHeadInteractiveTableClass,
  departmentHeadTableAccentRailClass,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableCellContentWrapFlexClass,
  departmentHeadTableActionClusterClass,
} from '../../constants/departmentHeadLayout';
import {
  saasTableRootClass,
  saasTableHeadCellClass,
  saasTableNumericStrongClass,
  saasTableCodeCellClass,
  saasPrStatusBadgeClass,
  saasPrStatusLabel,
  saasTableIconBtnView,
  saasTableIconBtnEdit,
} from '../../constants/saasDataTable';

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

  useEffect(() => {
    if (!isDetailModalOpen) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDetailModalOpen(false);
        setSelectedPRId(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      document.removeEventListener('keydown', onKey);
    };
  }, [isDetailModalOpen]);

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

  const pageShellClass = 'w-full min-h-full min-w-0 bg-[#f1f5f9]';
  const pageContentClass = 'mx-auto w-full max-w-none min-w-0 space-y-6 px-1 pt-3 pb-4 sm:px-1.5 sm:pt-4 sm:pb-5 md:px-3';
  const cardClass = 'rounded-2xl border border-slate-200 bg-white ring-1 ring-slate-900/5 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.35)]';

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
    <div className={pageShellClass}>
      <div className={pageContentClass}>
        <DepartmentPageHero
          kicker="Trưởng phòng · Mua hàng"
          title="My Purchase Requests"
          description="Quản lý PR do chính bạn tạo"
          Icon={FileText}
          tint="ocean"
          regionLabel="My Purchase Requests"
          rightSlot={
            <button
              onClick={() => navigate('/dashboard/department-head/my-prs/create')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <Plus className="h-5 w-5" />
              Tạo PR mới
            </button>
          }
        />

        {/* Filters */}
        <div className={`${cardClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4`}>
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
        <div className="overflow-visible rounded-2xl shadow-[0_16px_30px_-20px_rgba(15,23,42,0.3)]">
          <div className={`${cardClass} overflow-hidden`}>
            <div className={departmentHeadListTableScrollClass}>
            <table className={`${departmentHeadInteractiveTableClass} ${saasTableRootClass}`}>
              <thead className="sticky top-0 z-20 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                <tr>
                  <th className={`px-6 py-3 text-left ${saasTableHeadCellClass}`}>Mã PR</th>
                  <th className={`px-6 py-3 text-left ${saasTableHeadCellClass}`}>Phòng ban</th>
                  <th className={`px-6 py-3 text-left ${saasTableHeadCellClass}`}>Tổng tiền</th>
                  <th className={`px-6 py-3 text-left ${saasTableHeadCellClass}`}>Trạng thái</th>
                  <th className={`px-6 py-3 text-left ${saasTableHeadCellClass}`}>Ngày tạo</th>
                  <th className={`px-6 py-3 text-left ${saasTableHeadCellClass}`}>Hành động</th>
                </tr>
              </thead>
              <tbody className={departmentHeadTableTbodyElevatedClass}>
                {filteredPRs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <p className="text-slate-600">Không có PR nào</p>
                    </td>
                  </tr>
                ) : (
                  filteredPRs.map((pr: any, idx: number) => (
                    <tr key={pr.id} className={departmentHeadTableDataRowClasses(idx)}>
                      <td className="relative px-6 py-4 whitespace-nowrap">
                        <div aria-hidden className={departmentHeadTableAccentRailClass} />
                        <div
                          className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass}`}
                        >
                          <span className={saasTableCodeCellClass}>{pr.prNumber}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        <div className={departmentHeadTableCellContentWrapClass}>
                          <span>{pr.department || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={departmentHeadTableCellContentWrapClass}>
                          {pr.totalAmount ? (
                            <span className={saasTableNumericStrongClass}>
                              {pr.totalAmount.toLocaleString('vi-VN')} {pr.currency || 'VND'}
                            </span>
                          ) : (
                            <span className="text-slate-400">Chưa có</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={departmentHeadTableCellContentWrapClass}>
                          <span
                            className={saasPrStatusBadgeClass(pr.status)}
                            title={getStatusLabel(pr.status)}
                          >
                            {saasPrStatusLabel(pr.status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 tabular-nums">
                        <div className={departmentHeadTableCellContentWrapClass}>
                          <span className="tabular-nums">
                            {new Date(pr.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`${departmentHeadTableCellContentWrapFlexClass} ml-auto justify-end`}
                        >
                          <div className={departmentHeadTableActionClusterClass}>
                            <button
                              type="button"
                              onClick={(e) => handleViewPRDetails(pr.id, e)}
                              className={saasTableIconBtnView}
                              title="Xem chi tiết"
                              aria-label="Xem chi tiết"
                            >
                              <Eye className="h-4 w-4" strokeWidth={2} />
                            </button>
                            {canEdit(pr.status) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/dashboard/department-head/my-prs/${pr.id}/edit`);
                                }}
                                className={saasTableIconBtnEdit}
                                title="Chỉnh sửa"
                                aria-label="Chỉnh sửa"
                              >
                                <Edit className="h-4 w-4" strokeWidth={2} />
                              </button>
                            )}
                          </div>
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
      </div>

      {/* PR Details Modal — fullscreen portal, không cắt bởi layout dashboard */}
      {isDetailModalOpen &&
        selectedPRId &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-white"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dh-mpr-detail-modal-title"
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-sky-50 via-white to-indigo-50 px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-6 sm:pb-5 sm:pt-5">
              <div>
                <h2 id="dh-mpr-detail-modal-title" className="text-xl font-bold text-slate-900">
                  Chi tiết Purchase Request
                </h2>
                {prDetails && (
                  <p className="text-sm text-slate-600 mt-1">
                    Mã PR: <span className="font-semibold text-blue-600">{prDetails.prNumber}</span>
                  </p>
                )}
              </div>
              <button
                onClick={handleCloseDetailModal}
                className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                type="button"
              >
                <X className="w-5 h-5 text-slate-600" strokeWidth={2} />
              </button>
            </div>

            {/* Modal Body - PR Details */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 scrollbar-hide pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-3">
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
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-4 sm:px-6 sm:py-5">
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
          </div>,
          document.body,
        )}
    </div>
  );
};

export default MyPurchaseRequests;



