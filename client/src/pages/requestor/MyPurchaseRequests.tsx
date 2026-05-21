import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { requestorService } from '../../services/requestorService';
import { Plus, Edit, Eye, Filter, Search, X, Building2, User, Calendar, DollarSign, Package, Info, FileText, Mail, MapPin, FileEdit, Clock, CheckCircle2, XCircle, AlertCircle, ArrowLeftRight, Send, ShoppingCart, FileCheck, UserCheck, Ban, Wallet, CheckCircle, XOctagon, Paperclip, ExternalLink, Trash2, PackageOpen, Hash, MessageSquareText, Activity } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import CustomSelect from '../../components/CustomSelect';
import { VndIntegerInput } from '../../components/VndIntegerInput';
import { PRSalesOrderLine } from '../../components/PRSalesOrderLine';
import { useToast } from '../../contexts/ToastContext';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import {
  requestorDataTableCardClass,
  requestorDataTableCardHeaderClass,
} from '../../constants/requestorLayout';
import { dataTableScrollWindowSingleClass } from '../../constants/dataTableLayout';
import {
  DashboardV3ShimmerBlock,
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
  dashboardV3PageBgClass,
  dashboardV3StackYClass,
  dashboardV3TableHeaderStripClass,
  dashboardV3ErrorCardClass,
} from '../../components/dashboard/DashboardV3Chrome';
import {
  departmentHeadInteractiveTableClass,
  departmentHeadTableTbodyElevatedClass,
  departmentHeadTableDataRowClasses,
  departmentHeadTableAccentRailClass,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableCellContentWrapFlexClass,
  departmentHeadTableActionClusterClass,
} from '../../constants/departmentHeadLayout';
import { coerceVndNumber } from '../../utils/vndInputFormat';
import {
  saasTableRootClass,
  saasTableHeadCellClass,
  saasTableCodeCellClass,
  saasTableNumericStrongClass,
  saasPrStatusBadgeClass,
  saasPrStatusLabel,
  saasTableIconBtnView,
  saasTableIconBtnEdit,
  saasTableIconBtnDelete,
} from '../../constants/saasDataTable';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return 'http://localhost:5000';
  }
})();

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

const extractUrls = (input?: string | null): string[] => {
  if (!input) return [];
  const matches = input.match(/https?:\/\/[^\s|)]+/gi);
  if (!matches?.length) return [];
  return matches.map((u) => u.replace(/[.,;]+$/g, '').trim()).filter(Boolean);
};

const extractReferenceTexts = (input?: string | null): string[] => {
  if (!input) return [];
  const refs: string[] = [];
  const parts = String(input).split('|').map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.startsWith('tai lieu:') || lower.startsWith('tài liệu:')) {
      const value = part.split(':').slice(1).join(':').trim();
      if (value) refs.push(value);
    }
  }
  return refs;
};

const toHrefIfPossible = (value: string): string | null => {
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith('/api/')) return `${API_ORIGIN}${v}`;
  if (v.startsWith('/uploads/')) return `${API_ORIGIN}${v}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return `https://${v}`;
  return null;
};

const getAttachmentDisplayLabel = (raw: string): string => {
  const v = raw.trim();
  if (!v) return 'Tài liệu đính kèm';
  if (v.startsWith('/api/requestor/prs/') && v.includes('/attachments/')) {
    return 'Tải file đính kèm';
  }
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      const last = u.pathname.split('/').filter(Boolean).pop();
      return last || u.hostname;
    } catch {
      return v;
    }
  }
  return v;
};

const MyPurchaseRequests = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const stockIssuesBase = location.pathname.startsWith('/dashboard/department-head')
    ? '/dashboard/department-head/stock-issues'
    : '/dashboard/requestor/stock-issues';
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  const [revisionDraft, setRevisionDraft] = useState<
    Record<
      string,
      {
        description: string;
        partNo: string;
        spec: string;
        manufacturer: string;
        qty: string;
        unit: string;
        estimatedUnitPriceVnd: number | undefined;
        desiredDeliveryDate: string;
        purpose: string;
        remark: string;
      }
    >
  >({});

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

  useEffect(() => {
    if (!prDetails?.items) {
      setRevisionDraft({});
      return;
    }
    const next: Record<
      string,
      {
        description: string;
        partNo: string;
        spec: string;
        manufacturer: string;
        qty: string;
        unit: string;
        estimatedUnitPriceVnd: number | undefined;
        desiredDeliveryDate: string;
        purpose: string;
        remark: string;
      }
    > = {};
    for (const it of prDetails.items as Array<Record<string, unknown>>) {
      const st = String(it.status || '').toUpperCase();
      if (
        st === 'NEED_PURCHASE' &&
        it.departmentItemOutcome === 'REVISION_REQUIRED' &&
        !it.departmentRevisionSubmittedAt
      ) {
        const id = String(it.id);
        next[id] = {
          description: String(it.description || ''),
          partNo: String(it.partNo || ''),
          spec: String(it.spec || ''),
          manufacturer: String(it.manufacturer || ''),
          qty: String(it.qty ?? ''),
          unit: String(it.unit || ''),
          estimatedUnitPriceVnd: coerceVndNumber(it.estimatedUnitPriceVnd),
          desiredDeliveryDate: String(it.desiredDeliveryDate || '').slice(0, 10),
          purpose: String(it.purpose || ''),
          remark: String(it.remark || ''),
        };
      }
    }
    setRevisionDraft(next);
  }, [prDetails?.id, prDetails?.updatedAt, prDetails?.items]);

  const resubmitRevisionMutation = useMutation({
    mutationFn: async (vars: {
      itemId: string;
      draft: {
        description: string;
        partNo: string;
        spec: string;
        manufacturer: string;
        qty: string;
        unit: string;
        estimatedUnitPriceVnd: number | undefined;
        desiredDeliveryDate: string;
        purpose: string;
        remark: string;
      };
    }) => {
      if (!selectedPRId) throw new Error('Thiếu dữ liệu');
      const d = vars.draft;
      return requestorService.resubmitPRItemDepartmentRevision(selectedPRId, vars.itemId, {
        description: d.description.trim(),
        partNo: d.partNo.trim(),
        spec: d.spec.trim() || undefined,
        manufacturer: d.manufacturer.trim() || undefined,
        qty: Number(d.qty),
        unit: d.unit.trim(),
        estimatedUnitPriceVnd: d.estimatedUnitPriceVnd,
        desiredDeliveryDate: d.desiredDeliveryDate.trim() || undefined,
        purpose: d.purpose.trim() || undefined,
        remark: d.remark.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['requestor-pr-details', selectedPRId] });
      await queryClient.invalidateQueries({ queryKey: ['requestor-prs'] });
      showSuccess('Đã gửi lại dòng cho Trưởng phòng duyệt.');
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      showError(e.response?.data?.error || e.response?.data?.message || e.message || 'Gửi lại thất bại');
    },
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

  const deletePRMutation = useMutation({
    mutationFn: (prId: string) => requestorService.deletePR(prId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['requestor-prs'] });
      if (selectedPRId) {
        await queryClient.invalidateQueries({ queryKey: ['requestor-pr-details', selectedPRId] });
      }
      if (isDetailModalOpen) handleCloseDetailModal();
      showSuccess('Đã xóa PR thành công');
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!selectedPRId) throw new Error('Không xác định được PR');
      return requestorService.uploadPRAttachments(selectedPRId, files);
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['requestor-pr-details', selectedPRId] });
      showSuccess(`Đã upload ${res.uploaded || 0} tài liệu`);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string; message?: string } }; message?: string };
      showError(e.response?.data?.error || e.response?.data?.message || e.message || 'Upload tài liệu thất bại');
    },
  });

  const handleDeleteSubmittedPR = (prId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (deletePRMutation.isPending) return;
    const ok = window.confirm('Bạn chắc chắn muốn xóa PR đã gửi này? Hành động này không thể hoàn tác.');
    if (!ok) return;
    deletePRMutation.mutate(prId);
  };

  const handlePickAttachmentFiles = () => {
    if (uploadAttachmentMutation.isPending) return;
    attachmentInputRef.current?.click();
  };

  const handleAttachmentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    uploadAttachmentMutation.mutate(files);
    e.target.value = '';
  };

  const openAttachmentWithAuth = async (href: string, fallbackLabel?: string) => {
    try {
      const rawToken = localStorage.getItem('token');
      const token = rawToken ? rawToken.trim().replace(/^"(.*)"$/, '$1') : '';
      if (!token) {
        showError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        return;
      }
      const res = await axios.get(href, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      });
      const blobUrl = URL.createObjectURL(res.data);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      showError(`Không mở được tài liệu${fallbackLabel ? `: ${fallbackLabel}` : ''}`);
    }
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

  const canDeleteSubmitted = (status: string) => {
    return status === 'SUBMITTED'
      || status === 'MANAGER_PENDING'
      || status === 'DEPARTMENT_HEAD_PENDING'
      || status === 'BRANCH_MANAGER_PENDING';
  };

  const prsList = prsData?.prs ?? [];

  const filteredPRs = prsList.filter((pr: any) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        pr.prNumber.toLowerCase().includes(query) ||
        pr.itemName.toLowerCase().includes(query) ||
        pr.department?.toLowerCase().includes(query) ||
        pr.purpose?.toLowerCase().includes(query) ||
        pr.salesOrder?.label?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const requestorPageShellClass = 'flex h-full min-h-full w-full flex-1 flex-col bg-[#f1f5f9]';
  const requestorPageContentClass = 'mx-auto flex h-full min-h-full w-full max-w-[1800px] flex-1 flex-col gap-6 px-2 pt-2 pb-2 sm:px-3 sm:pt-3 sm:pb-3 md:px-6';
  const requestorCardClass = 'rounded-2xl border border-slate-200 bg-white ring-1 ring-slate-900/5 shadow-xl shadow-slate-300/65';

  if (isLoading) {
    return (
      <div className={requestorPageShellClass}>
        <div className={requestorPageContentClass}>
          <DashboardV3ShimmerBlock className="h-24 w-full shrink-0" />
          <DashboardV3ShimmerBlock className="h-16 w-full max-w-xl shrink-0" />
          <DashboardV3ShimmerBlock className="min-h-[280px] flex-1" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={requestorPageShellClass}>
        <div className={`${requestorPageContentClass} flex items-center justify-center`}>
          <div className={`max-w-lg ${dashboardV3ErrorCardClass}`}>
            <p className="text-lg font-bold text-rose-900">Lỗi khi tải dữ liệu</p>
            <p className="mt-2 text-sm font-medium text-rose-800/90">
              {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={requestorPageShellClass}>
      <div className={requestorPageContentClass}>
        <div className="flex-shrink-0">
          <RequestorPageHero
            kicker="Requestor · Mua hàng"
            title="Yêu cầu mua hàng của tôi"
            description="Danh sách PR do bạn tạo — theo dõi trạng thái và chỉnh sửa khi cần"
            Icon={FileText}
            tint="azure"
            regionLabel="Yêu cầu mua hàng"
          />
        </div>
        <article
          className={`flex-none p-4 ${requestorCardClass}`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sky-500" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo số PR, tên hàng hóa, phòng ban..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
              </div>
              <div className="flex w-full min-w-0 items-center gap-2 md:w-auto md:max-w-xs">
                <Filter className="h-5 w-5 shrink-0 text-sky-500" />
                <CustomSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 md:flex-none md:px-4"
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
                </CustomSelect>
              </div>
          </div>
        </article>

        <article
          className="module-container mb-2 flex min-h-0 flex-1 flex-col overflow-visible rounded-[24px] shadow-[0_20px_44px_-22px_rgba(15,23,42,0.42),0_10px_24px_-16px_rgba(15,23,42,0.28)] sm:mb-3"
        >
          <div
            className="module-content relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white ring-1 ring-slate-900/5"
          >
            <div className="flex-none border-b border-slate-200 bg-[#F8FAFC] px-6 py-4">
              <h2 className="text-xl font-bold text-slate-900">
                Danh sách PR ({filteredPRs?.length || 0})
              </h2>
            </div>

            <div className="relative flex-1 overflow-x-auto overflow-y-visible bg-white [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:h-[5px] [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 [&::-webkit-scrollbar-track]:bg-transparent">
              <table
                className={`${departmentHeadInteractiveTableClass} min-w-[1100px] bg-white ${saasTableRootClass}`}
              >
                <thead className={`sticky top-0 z-20 ${dashboardV3TableHeaderStripClass} backdrop-blur-[12px] supports-[backdrop-filter]:bg-[#F8FAFC]/90`}>
                  <tr>
                    <th className={`min-w-[13rem] bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Số PR</th>
                    <th className={`min-w-[200px] bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>
                      Liên kết SO / dự án
                    </th>
                    <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Phòng ban</th>
                    <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Mục đích</th>
                    <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Tổng tiền</th>
                    <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Trạng thái</th>
                    <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Ngày tạo</th>
                    <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Thao tác</th>
                  </tr>
                </thead>
                <tbody className={departmentHeadTableTbodyElevatedClass}>
                  {filteredPRs && filteredPRs.length > 0 ? (
                    filteredPRs.map((pr: any, index: number) => {
                      return (
                        <tr
                          key={pr.id}
                          onClick={() => handleViewPRDetails(pr.id)}
                          className={`${departmentHeadTableDataRowClasses(index, { h72: true })} cursor-pointer`}
                          style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
                        >
                          <td className="relative min-w-[13rem] max-w-[22rem] overflow-hidden whitespace-nowrap px-6 py-4">
                            <div aria-hidden className={departmentHeadTableAccentRailClass} />
                            <div
                              className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass}`}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <Hash
                                  className="h-3.5 w-3.5 shrink-0 text-indigo-500/90"
                                  strokeWidth={2}
                                  aria-hidden
                                />
                                <span
                                  className={`${saasTableCodeCellClass} min-w-0 flex-1 truncate`}
                                  title={pr.prNumber}
                                >
                                  {pr.prNumber}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="min-w-[200px] max-w-md px-6 py-4 align-top">
                            <div className={departmentHeadTableCellContentWrapClass}>
                              <PRSalesOrderLine salesOrder={pr.salesOrder} showWhenEmpty />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            <div className={departmentHeadTableCellContentWrapClass}>
                              <span className="inline-flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
                                <span>{pr.department || '-'}</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            <div className={departmentHeadTableCellContentWrapClass}>
                              <span className="flex items-start gap-2">
                                <MessageSquareText
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
                                  strokeWidth={2}
                                  aria-hidden
                                />
                                {pr.purpose ? (
                                  <span className="line-clamp-2 min-w-0 flex-1 leading-snug" title={pr.purpose}>
                                    {pr.purpose}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className={departmentHeadTableCellContentWrapClass}>
                              {pr.totalAmount ? (
                                <span className={`${saasTableNumericStrongClass} inline-flex items-center gap-2`}>
                                  <DollarSign className="h-3.5 w-3.5 shrink-0 text-emerald-600/85" strokeWidth={2} aria-hidden />
                                  <span>
                                    {pr.totalAmount.toLocaleString('vi-VN')} {pr.currency || 'VND'}
                                  </span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2 text-slate-400">
                                  <DollarSign className="h-3.5 w-3.5 shrink-0 opacity-50" strokeWidth={2} aria-hidden />
                                  <span>—</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            <div className={departmentHeadTableCellContentWrapClass}>
                              <span className="inline-flex items-center gap-2">
                                <Activity className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} aria-hidden />
                                <span className={saasPrStatusBadgeClass(pr.status)} title={getStatusLabel(pr.status)}>
                                  {saasPrStatusLabel(pr.status)}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 tabular-nums text-slate-600">
                            <div className={departmentHeadTableCellContentWrapClass}>
                              <span className="inline-flex items-center gap-2 tabular-nums">
                                <Calendar className="h-3.5 w-3.5 shrink-0 text-sky-600/75" strokeWidth={2} aria-hidden />
                                {new Date(pr.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          </td>
                          <td
                            className="whitespace-nowrap px-4 py-4"
                            onClick={(e) => e.stopPropagation()}
                          >
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
                                    onClick={(e) => handleEditPR(pr.id, e)}
                                    className={saasTableIconBtnEdit}
                                    title="Chỉnh sửa"
                                    aria-label="Chỉnh sửa"
                                  >
                                    <Edit className="h-4 w-4" strokeWidth={2} />
                                  </button>
                                )}
                                {canDeleteSubmitted(pr.status) && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteSubmittedPR(pr.id, e)}
                                    disabled={deletePRMutation.isPending}
                                    className={`${saasTableIconBtnDelete} disabled:cursor-not-allowed disabled:opacity-40`}
                                    title="Xóa PR đã gửi"
                                    aria-label="Xóa PR đã gửi"
                                  >
                                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="min-h-[12rem] bg-white px-6 py-12 text-center text-slate-500">
                        <div className="flex min-h-[300px] flex-col items-center justify-center">
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
        </article>
      </div>

      {/* PR Details Modal */}
      {isDetailModalOpen && selectedPRId && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(15,23,42,0.6)' }}
          onClick={handleCloseDetailModal}
        >
          <div
            className="modal-popup-panel flex max-h-[min(96dvh,100dvh)] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-2xl"
            style={{ boxShadow: '0 32px_64px -12px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.06) inset', animation: 'modalZoomIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`@keyframes modalZoomIn{from{opacity:0;transform:scale(0.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

            {/* ── Glassmorphism Header ── */}
            <div
              className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/60 px-5 py-4 sm:px-6"
              style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)' }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-500">
                  Purchase Request
                </p>
                <h2 className="mt-0.5 font-mono text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                  {prDetails?.prNumber ?? '—'}
                </h2>
                {prDetails && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {(() => {
                      const StatusIcon = getStatusIcon(prDetails.status);
                      return (
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(prDetails.status)}`}>
                          <StatusIcon className="h-3 w-3" strokeWidth={2.5} />
                          {getStatusLabel(prDetails.status)}
                        </span>
                      );
                    })()}
                    <span className="text-xs text-slate-400">{formatDate(prDetails.createdAt)}</span>
                    {prDetails.department && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Building2 className="h-3 w-3" strokeWidth={2} />
                        {prDetails.department}
                      </span>
                    )}
                  </div>
                )}
                {prDetails?.salesOrder && (
                  <div className="mt-2">
                    <PRSalesOrderLine salesOrder={prDetails.salesOrder} showWhenEmpty className="text-xs text-slate-500" />
                  </div>
                )}
              </div>
              <button
                onClick={handleCloseDetailModal}
                className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-400 shadow-sm transition hover:border-slate-300 hover:text-slate-700"
                type="button"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            {/* ── Body ── */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 [scrollbar-width:thin]">
              {isLoadingPRDetails ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
                    <p className="text-sm text-slate-500">Đang tải…</p>
                  </div>
                </div>
              ) : prDetailsError ? (
                <div className="flex items-center justify-center py-16 px-6">
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                    <X className="mx-auto mb-3 h-8 w-8 text-red-500" strokeWidth={2} />
                    <p className="font-semibold text-red-700">Không tải được chi tiết PR</p>
                    <p className="mt-1 text-sm text-red-500">{prDetailsError instanceof Error ? prDetailsError.message : 'Vui lòng thử lại sau'}</p>
                  </div>
                </div>
              ) : prDetails ? (() => {
                const links = new Set<string>();
                const referenceTexts = new Set<string>();
                (prDetails.attachments ?? []).forEach((a: any) => {
                  if (a?.fileUrl) links.add(String(a.fileUrl));
                  if (a?.fileName) referenceTexts.add(String(a.fileName));
                });
                const detailsRequestor = (prDetails as any).requestor as { username?: string } | undefined;
                const detailsItems = prDetails.items ?? [];
                const detailsComputedTotal = detailsItems.reduce((sum: number, item: any) => {
                  const explicitAmount = Number(item?.amount ?? 0);
                  if (Number.isFinite(explicitAmount) && explicitAmount > 0) return sum + explicitAmount;
                  const qty = Number(item?.qty ?? 0);
                  const unitPrice = Number(item?.estimatedUnitPriceVnd ?? 0);
                  const lineTotal = qty * unitPrice;
                  return Number.isFinite(lineTotal) && lineTotal > 0 ? sum + lineTotal : sum;
                }, 0);
                const detailsResolvedTotal =
                  Number(prDetails.totalAmount ?? 0) > 0
                    ? Number(prDetails.totalAmount)
                    : detailsComputedTotal > 0
                      ? detailsComputedTotal
                      : null;
                extractUrls(prDetails.notes).forEach((u) => links.add(u));
                extractReferenceTexts(prDetails.notes).forEach((t) => referenceTexts.add(t));
                (prDetails.items ?? []).forEach((it: any) => {
                  (it.attachments ?? []).forEach((a: any) => {
                    if (a?.fileUrl) links.add(String(a.fileUrl));
                    if (a?.fileName) referenceTexts.add(String(a.fileName));
                  });
                  extractUrls(it?.spec).forEach((u) => links.add(u));
                  extractUrls(it?.remark).forEach((u) => links.add(u));
                  extractReferenceTexts(it?.spec).forEach((t) => referenceTexts.add(t));
                  extractReferenceTexts(it?.remark).forEach((t) => referenceTexts.add(t));
                });
                const attachmentLinks = Array.from(links);
                const referenceList = Array.from(referenceTexts);

                return (
                  <div className="flex flex-col gap-0 md:flex-row md:min-h-full">

                    {/* ── Cột chính (tiến trình + bảng vật tư + tài liệu) ── */}
                    <div className="min-w-0 flex-[3] space-y-4 p-4 sm:p-5 md:border-r md:border-slate-200/60">

                      {/* 3 insight cards */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {/* Giá trị */}
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-md shadow-blue-500/20">
                          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100">Giá trị PR</p>
                          <p className="mt-1 text-xl font-black tabular-nums leading-tight">
                            {formatCurrency(detailsResolvedTotal, prDetails.currency)}
                          </p>
                          <DollarSign className="absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} />
                        </div>

                        {/* Mục đích */}
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white shadow-md shadow-violet-500/20">
                          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-100">Mục đích</p>
                          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">
                            {prDetails.purpose || '—'}
                          </p>
                          <Info className="absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} />
                        </div>

                        {/* SLA / Ngày cần */}
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 p-4 text-white shadow-md shadow-amber-500/20">
                          <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-100">Ngày cần</p>
                          <p className="mt-1 text-lg font-black leading-tight">
                            {prDetails.requiredDate ? formatDate(prDetails.requiredDate) : '—'}
                          </p>
                          <Calendar className="absolute bottom-3 right-3 h-6 w-6 text-white/20" strokeWidth={1.5} />
                        </div>
                      </div>

                      {/* Ghi chú */}
                      {prDetails.notes && (
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-500" strokeWidth={2} />
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Ghi chú</p>
                          </div>
                          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{prDetails.notes}</p>
                        </div>
                      )}

                      {/* Bảng vật tư */}
                      {detailsItems.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                            <Package className="h-4 w-4 text-slate-500" strokeWidth={2} />
                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                              Danh sách vật tư / dịch vụ ({detailsItems.length})
                            </h3>
                          </div>
                          <div className="max-h-60 overflow-auto [scrollbar-width:thin]">
                            <table className="w-full min-w-[640px] border-collapse text-sm">
                              <thead className="sticky top-0 bg-slate-50">
                                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  <th className="px-4 py-2.5 text-left">#</th>
                                  <th className="px-4 py-2.5 text-left">Mã / Tên</th>
                                  <th className="px-4 py-2.5 text-left">Nhà SX</th>
                                  <th className="px-4 py-2.5 text-right">SL</th>
                                  <th className="px-4 py-2.5 text-left">Nguồn</th>
                                  <th className="px-4 py-2.5 text-left">Trưởng phòng</th>
                                  <th className="px-4 py-2.5 text-right">Thành tiền</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {detailsItems.map((item: any, idx: number) => (
                                  <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                                    <td className="px-4 py-2.5 text-xs tabular-nums text-slate-400">{item.lineNo ?? idx + 1}</td>
                                    <td className="px-4 py-2.5">
                                      <p className="font-semibold text-slate-900">{item.partNo || '—'}</p>
                                      <p className="text-xs text-slate-500">{item.description || ''}</p>
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-slate-600">{item.manufacturer || '—'}</td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                                      {item.qty} <span className="text-xs text-slate-400">{item.unit}</span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      {(item.sourceStatus === 'FROM_STOCK' || item.status === 'FROM_STOCK') ? (
                                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">Kho</span>
                                      ) : (item.sourceStatus === 'NEED_PURCHASE' || item.status === 'NEED_PURCHASE') ? (
                                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">Mua</span>
                                      ) : <span className="text-slate-400">—</span>}
                                    </td>
                                    <td className="max-w-[10rem] px-4 py-2.5 text-xs text-slate-600">
                                      {item.departmentItemOutcome === 'REJECTED' ? (
                                        <span className="font-semibold text-rose-700">Từ chối</span>
                                      ) : item.departmentItemOutcome === 'REVISION_REQUIRED' ? (
                                        item.departmentRevisionSubmittedAt ? (
                                          <span className="font-semibold text-indigo-700">Chờ duyệt lại</span>
                                        ) : (
                                          <span className="font-semibold text-amber-800">Cần chỉnh sửa</span>
                                        )
                                      ) : item.departmentItemOutcome === 'APPROVED' ? (
                                        <span className="font-semibold text-emerald-700">Đã duyệt</span>
                                      ) : item.departmentItemOutcome === 'ON_HOLD' ? (
                                        <span className="text-slate-600">Tạm hoãn</span>
                                      ) : (
                                        <span className="text-slate-400">—</span>
                                      )}
                                      {item.departmentDecisionNote ? (
                                        <p className="mt-1 line-clamp-2 text-[10px] text-slate-500" title={item.departmentDecisionNote}>
                                          {item.departmentDecisionNote}
                                        </p>
                                      ) : null}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-800">
                                      {(() => {
                                        const explicitAmount = Number(item?.amount ?? 0);
                                        if (Number.isFinite(explicitAmount) && explicitAmount > 0) {
                                          return explicitAmount.toLocaleString('vi-VN');
                                        }
                                        const qty = Number(item?.qty ?? 0);
                                        const unitPrice = Number(item?.estimatedUnitPriceVnd ?? 0);
                                        const fallbackAmount = qty * unitPrice;
                                        return Number.isFinite(fallbackAmount) && fallbackAmount > 0
                                          ? fallbackAmount.toLocaleString('vi-VN')
                                          : '—';
                                      })()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {Object.keys(revisionDraft).length > 0 && selectedPRId ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
                          <p className="text-sm font-bold text-amber-950">Chỉnh sửa & gửi lại cho Trưởng phòng</p>
                          <p className="mt-1 text-xs text-amber-900/90">
                            Các dòng dưới đây cần chỉnh theo ghi chú Trưởng phòng. Sau khi sửa, nhấn «Gửi lại dòng».
                          </p>
                          <div className="mt-3 space-y-4">
                            {(detailsItems as any[])
                              .filter((it) => revisionDraft[it.id])
                              .map((it) => {
                                const d = revisionDraft[it.id];
                                if (!d) return null;
                                const set =
                                  (field: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                                    setRevisionDraft((prev) => ({
                                      ...prev,
                                      [it.id]: { ...prev[it.id]!, [field]: e.target.value },
                                    }));
                                return (
                                  <div
                                    key={it.id}
                                    className="rounded-lg border border-amber-100 bg-white p-3 shadow-sm"
                                  >
                                    <p className="text-xs font-semibold text-slate-700">
                                      Dòng {it.lineNo ?? '—'}{' '}
                                      <span className="font-normal text-slate-500">({it.partNo || '—'})</span>
                                    </p>
                                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                      <label className="block text-[11px] font-medium text-slate-600">
                                        Mô tả
                                        <input
                                          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                          value={d.description}
                                          onChange={set('description')}
                                        />
                                      </label>
                                      <label className="block text-[11px] font-medium text-slate-600">
                                        Mã vật tư
                                        <input
                                          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                          value={d.partNo}
                                          onChange={set('partNo')}
                                        />
                                      </label>
                                      <label className="block text-[11px] font-medium text-slate-600">
                                        Spec
                                        <input
                                          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                          value={d.spec}
                                          onChange={set('spec')}
                                        />
                                      </label>
                                      <label className="block text-[11px] font-medium text-slate-600">
                                        Nhà SX
                                        <input
                                          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                          value={d.manufacturer}
                                          onChange={set('manufacturer')}
                                        />
                                      </label>
                                      <label className="block text-[11px] font-medium text-slate-600">
                                        SL
                                        <input
                                          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                          value={d.qty}
                                          onChange={set('qty')}
                                        />
                                      </label>
                                      <label className="block text-[11px] font-medium text-slate-600">
                                        Đơn vị
                                        <input
                                          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                          value={d.unit}
                                          onChange={set('unit')}
                                        />
                                      </label>
                                      <label className="block text-[11px] font-medium text-slate-600">
                                        Giá dự kiến (VND)
                                        <VndIntegerInput
                                          className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                          placeholder="Ví dụ: 1.500.000"
                                          value={d.estimatedUnitPriceVnd}
                                          onChange={(v) =>
                                            setRevisionDraft((prev) => ({
                                              ...prev,
                                              [it.id]: { ...prev[it.id]!, estimatedUnitPriceVnd: v },
                                            }))
                                          }
                                        />
                                      </label>
                                      <label className="block text-[11px] font-medium text-slate-600">
                                        Ngày cần giao
                                        <input
                                          type="date"
                                          className="mt-0.5 w-full min-h-[2.25rem] rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/25 [color-scheme:light]"
                                          value={d.desiredDeliveryDate}
                                          onChange={set('desiredDeliveryDate')}
                                        />
                                      </label>
                                    </div>
                                    <label className="mt-2 block text-[11px] font-medium text-slate-600">
                                      Ghi chú dòng
                                      <textarea
                                        className="mt-0.5 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                        rows={2}
                                        value={d.remark}
                                        onChange={set('remark')}
                                      />
                                    </label>
                                    <div className="mt-3 flex justify-end">
                                      <button
                                        type="button"
                                        disabled={resubmitRevisionMutation.isPending}
                                        onClick={() => {
                                          const draft = revisionDraft[it.id];
                                          if (!draft || !Number(draft.qty) || !draft.unit.trim()) {
                                            showError('Nhập đủ số lượng và đơn vị.');
                                            return;
                                          }
                                          resubmitRevisionMutation.mutate({ itemId: it.id, draft });
                                        }}
                                        className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                                      >
                                        <Send className="h-4 w-4" strokeWidth={2} />
                                        Gửi lại dòng
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      ) : null}

                      {/* Tài liệu đính kèm */}
                      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-slate-500" strokeWidth={2} />
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Tài liệu đính kèm</p>
                          </div>
                          <div>
                            <input ref={attachmentInputRef} type="file" multiple className="hidden" onChange={handleAttachmentFileChange} />
                            <button
                              type="button"
                              onClick={handlePickAttachmentFiles}
                              disabled={uploadAttachmentMutation.isPending}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-60"
                            >
                              <Paperclip className="h-3 w-3" strokeWidth={2} />
                              {uploadAttachmentMutation.isPending ? 'Đang upload…' : 'Upload thêm'}
                            </button>
                          </div>
                        </div>
                        {attachmentLinks.length > 0 || referenceList.length > 0 ? (
                          <div className="space-y-1.5">
                            {attachmentLinks.map((url) => {
                              const href = toHrefIfPossible(url) ?? url;
                              return (
                                <a key={url} href={href} target="_blank" rel="noreferrer"
                                  onClick={(e) => { if (href.startsWith(API_ORIGIN) || href.startsWith('/api/')) { e.preventDefault(); void openAttachmentWithAuth(href, url); } }}
                                  className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                                >
                                  <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                                  <span className="truncate text-xs">{getAttachmentDisplayLabel(url)}</span>
                                </a>
                              );
                            })}
                            {referenceList.map((ref) => {
                              const href = toHrefIfPossible(ref);
                              return href ? (
                                <a key={`ref-${ref}`} href={href} target="_blank" rel="noreferrer"
                                  className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-700 hover:bg-indigo-100"
                                >
                                  <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                                  <span className="truncate">{ref}</span>
                                </a>
                              ) : (
                                <div key={`ref-${ref}`} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                  <Paperclip className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                                  <span className="truncate">{ref}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">Chưa có tài liệu đính kèm.</p>
                        )}
                      </div>
                    </div>

                    {/* ── Cột phụ (chứng từ + actions) ── */}
                    <div className="flex flex-col gap-4 bg-gradient-to-b from-slate-50 to-white p-4 sm:p-5 md:w-64 md:shrink-0 md:border-t-0">

                      {/* Khối chứng từ — indigo-900 */}
                      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-800 text-white shadow-lg shadow-indigo-900/30">
                        <div className="border-b border-indigo-700/50 px-4 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-300">Thông tin chứng từ</p>
                        </div>
                        <dl className="divide-y divide-indigo-700/30 px-4 py-0 text-sm">
                          {detailsRequestor && (
                            <div className="flex items-center justify-between gap-2 py-3">
                              <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                                <User className="h-3 w-3" strokeWidth={2} />Người tạo
                              </dt>
                              <dd className="font-semibold text-white">{detailsRequestor.username || '—'}</dd>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-2 py-3">
                            <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                              <Calendar className="h-3 w-3" strokeWidth={2} />Ngày tạo
                            </dt>
                            <dd className="font-semibold tabular-nums text-white">{formatDate(prDetails.createdAt)}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2 py-3">
                            <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                              <Building2 className="h-3 w-3" strokeWidth={2} />Phòng ban
                            </dt>
                            <dd className="font-semibold text-white">{prDetails.department || '—'}</dd>
                          </div>
                          <div className="flex flex-col gap-1 py-3">
                            <dt className="text-xs text-indigo-300">Trạng thái</dt>
                            <dd>
                              {(() => {
                                const SI = getStatusIcon(prDetails.status);
                                return (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
                                    <SI className="h-3 w-3" strokeWidth={2.5} />
                                    {getStatusLabel(prDetails.status)}
                                  </span>
                                );
                              })()}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {/* Actions */}
                      <div className="mt-auto flex flex-col gap-2">
                        {canEdit(prDetails.status) && (
                          <button
                            onClick={() => { handleCloseDetailModal(); navigate(`/dashboard/requestor/pr/${prDetails.id}`); }}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
                          >
                            <Edit className="h-4 w-4" strokeWidth={2} />
                            Chỉnh sửa PR
                          </button>
                        )}
                        {!canEdit(prDetails.status) && (() => {
                          const fromStockItems = (prDetails.items ?? []).filter(
                            (it: any) => it.sourceStatus === 'FROM_STOCK' || it.status === 'FROM_STOCK'
                          );
                          if (!fromStockItems.length) return null;
                          const params = new URLSearchParams({
                            prId: prDetails.id,
                            ...(prDetails.salesOrder?.id ? { salesPoId: prDetails.salesOrder.id } : {}),
                          });
                          return (
                            <button
                              onClick={() => { handleCloseDetailModal(); navigate(`${stockIssuesBase}/create?${params.toString()}`); }}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                            >
                              <PackageOpen className="h-4 w-4" strokeWidth={2} />
                              Tạo phiếu xuất kho
                            </button>
                          );
                        })()}
                        {canDeleteSubmitted(prDetails.status) && (
                          <button
                            onClick={() => handleDeleteSubmittedPR(prDetails.id)}
                            disabled={deletePRMutation.isPending}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-600 hover:text-white disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2} />
                            {deletePRMutation.isPending ? 'Đang xóa…' : 'Xóa PR đã gửi'}
                          </button>
                        )}
                        <button
                          onClick={handleCloseDetailModal}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          Đóng
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })() : null}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MyPurchaseRequests;


