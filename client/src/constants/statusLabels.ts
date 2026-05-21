/**
 * Chuẩn hóa tên trạng thái sang tiếng Việt cho toàn hệ thống
 */

import {
  FileEdit,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeftRight,
  UserCheck,
  ShoppingCart,
  FileText,
  CheckCircle,
  Wallet,
  FileCheck,
  AlertCircle,
  Info,
  Package,
  User,
} from 'lucide-react';

// PR Status Labels
export const PR_STATUS_LABELS: Record<
  string,
  { label: string; icon: any; iconColor: string; color: string; bgColor?: string }
> = {
  DRAFT: {
    label: 'Nháp',
    icon: FileEdit,
    iconColor: 'text-slate-500',
    color: 'bg-white text-slate-800 border-slate-300',
    bgColor: 'bg-slate-100',
  },
  SUBMITTED: {
    label: 'Đã gửi',
    icon: Send,
    iconColor: 'text-blue-500',
    color: 'bg-white text-blue-700 border-blue-300',
    bgColor: 'bg-blue-100',
  },
  MANAGER_PENDING: {
    label: 'Chờ quản lý trực tiếp duyệt',
    icon: Clock,
    iconColor: 'text-amber-500',
    color: 'bg-white text-amber-700 border-amber-300',
    bgColor: 'bg-amber-100',
  },
  MANAGER_APPROVED: {
    label: 'Quản lý trực tiếp đã duyệt',
    icon: CheckCircle2,
    iconColor: 'text-green-500',
    color: 'bg-white text-green-700 border-green-300',
    bgColor: 'bg-green-100',
  },
  MANAGER_REJECTED: {
    label: 'Quản lý trực tiếp từ chối',
    icon: XCircle,
    iconColor: 'text-red-500',
    color: 'bg-white text-red-700 border-red-300',
    bgColor: 'bg-red-100',
  },
  MANAGER_RETURNED: {
    label: 'Quản lý trực tiếp trả về',
    icon: ArrowLeftRight,
    iconColor: 'text-orange-500',
    color: 'bg-white text-orange-700 border-orange-300',
    bgColor: 'bg-orange-100',
  },
  BRANCH_MANAGER_PENDING: {
    label: 'Chờ GĐ Chi nhánh duyệt',
    icon: Clock,
    iconColor: 'text-purple-500',
    color: 'bg-white text-purple-700 border-purple-300',
    bgColor: 'bg-purple-100',
  },
  BRANCH_MANAGER_APPROVED: {
    label: 'Đã duyệt - chờ Buyer Leader phân công',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    color: 'bg-white text-emerald-700 border-emerald-300',
    bgColor: 'bg-emerald-100',
  },
  BRANCH_MANAGER_REJECTED: {
    label: 'GĐ Chi nhánh từ chối',
    icon: XCircle,
    iconColor: 'text-red-500',
    color: 'bg-white text-red-700 border-red-300',
    bgColor: 'bg-red-100',
  },
  BRANCH_MANAGER_RETURNED: {
    label: 'GĐ Chi nhánh trả về',
    icon: ArrowLeftRight,
    iconColor: 'text-orange-500',
    color: 'bg-white text-orange-700 border-orange-300',
    bgColor: 'bg-orange-100',
  },
  BUYER_LEADER_PENDING: {
    label: 'Đã duyệt - chờ Buyer Leader phân công',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    color: 'bg-white text-emerald-700 border-emerald-300',
    bgColor: 'bg-emerald-100',
  },
  NEED_MORE_INFO: {
    label: 'Cần thêm thông tin',
    icon: AlertCircle,
    iconColor: 'text-yellow-500',
    color: 'bg-white text-yellow-700 border-yellow-300',
    bgColor: 'bg-yellow-100',
  },
  ASSIGNED_TO_BUYER: {
    label: 'Đã phân công Buyer',
    icon: UserCheck,
    iconColor: 'text-indigo-500',
    color: 'bg-white text-indigo-700 border-indigo-300',
    bgColor: 'bg-indigo-100',
  },
  RFQ_IN_PROGRESS: {
    label: 'Đang hỏi giá',
    icon: ShoppingCart,
    iconColor: 'text-cyan-500',
    color: 'bg-white text-cyan-700 border-cyan-300',
    bgColor: 'bg-cyan-100',
  },
  COLLECTING_QUOTATION: {
    label: 'Đang thu thập báo giá',
    icon: ShoppingCart,
    iconColor: 'text-orange-500',
    color: 'bg-white text-orange-700 border-orange-300',
    bgColor: 'bg-orange-100',
  },
  QUOTATION_RECEIVED: {
    label: 'Đã nhận báo giá',
    icon: FileText,
    iconColor: 'text-teal-500',
    color: 'bg-white text-teal-700 border-teal-300',
    bgColor: 'bg-teal-100',
  },
  SUPPLIER_SELECTED: {
    label: 'Đã chọn NCC',
    icon: CheckCircle2,
    iconColor: 'text-blue-500',
    color: 'bg-white text-blue-700 border-blue-300',
    bgColor: 'bg-blue-100',
  },
  RFQ_COMPLETED: {
    label: 'RFQ hoàn tất',
    icon: CheckCircle2,
    iconColor: 'text-teal-500',
    color: 'bg-white text-teal-700 border-teal-300',
    bgColor: 'bg-teal-100',
  },
  PO_PENDING: {
    label: 'Chờ tạo PO',
    icon: FileText,
    iconColor: 'text-amber-500',
    color: 'bg-white text-amber-700 border-amber-300',
    bgColor: 'bg-amber-100',
  },
  PO_IN_PROGRESS: {
    label: 'Đang mua hàng / PO',
    icon: ShoppingCart,
    iconColor: 'text-indigo-500',
    color: 'bg-white text-indigo-700 border-indigo-300',
    bgColor: 'bg-indigo-100',
  },
  PO_ISSUED: {
    label: 'Đã phát hành PO',
    icon: Package,
    iconColor: 'text-blue-500',
    color: 'bg-white text-blue-700 border-blue-300',
    bgColor: 'bg-blue-100',
  },
  CLOSED: {
    label: 'Hoàn tất',
    icon: CheckCircle,
    iconColor: 'text-emerald-500',
    color: 'bg-white text-emerald-700 border-emerald-300',
    bgColor: 'bg-emerald-100',
  },
  BUDGET_EXCEPTION: {
    label: 'Vượt ngân sách',
    icon: AlertCircle,
    iconColor: 'text-amber-600',
    color: 'bg-white text-amber-700 border-amber-300',
    bgColor: 'bg-amber-100',
  },
  BUDGET_APPROVED: {
    label: 'Đã chấp nhận vượt ngân sách',
    icon: CheckCircle2,
    iconColor: 'text-green-500',
    color: 'bg-white text-green-700 border-green-300',
    bgColor: 'bg-green-100',
  },
  BUDGET_REJECTED: {
    label: 'Từ chối vượt ngân sách',
    icon: XCircle,
    iconColor: 'text-red-500',
    color: 'bg-white text-red-700 border-red-300',
    bgColor: 'bg-red-100',
  },
  PAYMENT_DONE: {
    label: 'Đã thanh toán',
    icon: Wallet,
    iconColor: 'text-emerald-500',
    color: 'bg-white text-emerald-700 border-emerald-300',
    bgColor: 'bg-emerald-100',
  },
  READY_FOR_RFQ: {
    label: 'Sẵn sàng hỏi giá',
    icon: FileCheck,
    iconColor: 'text-emerald-500',
    color: 'bg-white text-emerald-700 border-emerald-300',
    bgColor: 'bg-emerald-100',
  },
  CANCELLED: {
    label: 'Đã hủy',
    icon: XCircle,
    iconColor: 'text-slate-500',
    color: 'bg-white text-slate-700 border-slate-300',
    bgColor: 'bg-slate-100',
  },
  // Legacy statuses (backward compatibility)
  DEPARTMENT_HEAD_PENDING: {
    label: 'Chờ quản lý trực tiếp duyệt',
    icon: Clock,
    iconColor: 'text-amber-500',
    color: 'bg-white text-amber-700 border-amber-300',
    bgColor: 'bg-amber-100',
  },
  DEPARTMENT_HEAD_APPROVED: {
    label: 'Quản lý trực tiếp đã duyệt',
    icon: CheckCircle2,
    iconColor: 'text-green-500',
    color: 'bg-white text-green-700 border-green-300',
    bgColor: 'bg-green-100',
  },
  DEPARTMENT_HEAD_REJECTED: {
    label: 'Quản lý trực tiếp từ chối',
    icon: XCircle,
    iconColor: 'text-red-500',
    color: 'bg-white text-red-700 border-red-300',
    bgColor: 'bg-red-100',
  },
  DEPARTMENT_HEAD_RETURNED: {
    label: 'Quản lý trực tiếp trả về',
    icon: ArrowLeftRight,
    iconColor: 'text-orange-500',
    color: 'bg-white text-orange-700 border-orange-300',
    bgColor: 'bg-orange-100',
  },
  APPROVED_BY_BRANCH: {
    label: 'Đã duyệt bởi Chi nhánh',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    color: 'bg-white text-emerald-700 border-emerald-300',
    bgColor: 'bg-emerald-100',
  },
};

// RFQ Status Labels
export const RFQ_STATUS_LABELS: Record<
  string,
  { label: string; icon?: any; iconColor?: string; color?: string; bgColor?: string }
> = {
  DRAFT: {
    label: 'Nháp',
    icon: FileEdit,
    iconColor: 'text-slate-500',
    color: 'bg-white text-slate-700 border-slate-300',
    bgColor: 'bg-slate-100',
  },
  SENT: {
    label: 'Đã gửi',
    icon: Send,
    iconColor: 'text-blue-500',
    color: 'bg-white text-blue-700 border-blue-300',
    bgColor: 'bg-blue-100',
  },
  QUOTATION_RECEIVED: {
    label: 'Đã nhận báo giá',
    icon: FileText,
    iconColor: 'text-teal-500',
    color: 'bg-white text-teal-700 border-teal-300',
    bgColor: 'bg-teal-100',
  },
  READY_FOR_COMPARISON: {
    label: 'Chờ duyệt',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
    color: 'bg-white text-emerald-700 border-emerald-300',
    bgColor: 'bg-emerald-100',
  },
  CLOSED: {
    label: 'Đã đóng',
    icon: CheckCircle,
    iconColor: 'text-slate-500',
    color: 'bg-white text-slate-700 border-slate-300',
    bgColor: 'bg-slate-100',
  },
  EXPIRED: {
    label: 'Hết hạn',
    icon: Clock,
    iconColor: 'text-red-500',
    color: 'bg-white text-red-700 border-red-300',
    bgColor: 'bg-red-100',
  },
};

// Quotation Status Labels
export const QUOTATION_STATUS_LABELS: Record<
  string,
  { label: string; icon?: any; iconColor?: string; color?: string; bgColor?: string }
> = {
  DRAFT: {
    label: 'Nháp',
    icon: FileEdit,
    iconColor: 'text-slate-500',
    color: 'bg-white text-slate-700 border-slate-300',
    bgColor: 'bg-slate-100',
  },
  VALID: {
    label: 'Hợp lệ',
    icon: CheckCircle2,
    iconColor: 'text-green-500',
    color: 'bg-white text-green-700 border-green-300',
    bgColor: 'bg-green-100',
  },
  INVALID: {
    label: 'Không hợp lệ',
    icon: XCircle,
    iconColor: 'text-red-500',
    color: 'bg-white text-red-700 border-red-300',
    bgColor: 'bg-red-100',
  },
  SELECTED: {
    label: 'Đã chọn',
    icon: CheckCircle,
    iconColor: 'text-blue-500',
    color: 'bg-white text-blue-700 border-blue-300',
    bgColor: 'bg-blue-100',
  },
};

// Helper functions
export const getPRStatusLabel = (status: string): string => {
  return PR_STATUS_LABELS[status]?.label || status;
};

export const getRFQStatusLabel = (status: string): string => {
  return RFQ_STATUS_LABELS[status]?.label || status;
};

export const getQuotationStatusLabel = (status: string): string => {
  return QUOTATION_STATUS_LABELS[status]?.label || status;
};

export const getPRStatusInfo = (status: string) => {
  return (
    PR_STATUS_LABELS[status] || {
      label: status,
      icon: Info,
      iconColor: 'text-slate-500',
      color: 'bg-white text-slate-800 border-slate-300',
      bgColor: 'bg-slate-100',
    }
  );
};

export const getRFQStatusInfo = (status: string) => {
  return (
    RFQ_STATUS_LABELS[status] || {
      label: status,
      icon: Info,
      iconColor: 'text-slate-500',
      color: 'bg-white text-slate-800 border-slate-300',
      bgColor: 'bg-slate-100',
    }
  );
};

export const getQuotationStatusInfo = (status: string) => {
  return (
    QUOTATION_STATUS_LABELS[status] || {
      label: status,
      icon: Info,
      iconColor: 'text-slate-500',
      color: 'bg-white text-slate-800 border-slate-300',
      bgColor: 'bg-slate-100',
    }
  );
};

// PR Status filter options (for dropdowns)
export const PR_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'READY_FOR_RFQ', label: 'Sẵn sàng hỏi giá' },
  { value: 'RFQ_IN_PROGRESS', label: 'Đang hỏi giá' },
  { value: 'COLLECTING_QUOTATION', label: 'Đang thu thập báo giá' },
  { value: 'QUOTATION_RECEIVED', label: 'Đã nhận báo giá' },
  { value: 'SUPPLIER_SELECTED', label: 'Đã chọn NCC' },
  { value: 'QUOTATION_COMPLETED', label: 'Đã hoàn thành báo giá' },
] as const;

// RFQ Status filter options
export const RFQ_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'SENT', label: 'Đã gửi' },
  { value: 'QUOTATION_RECEIVED', label: 'Đã nhận báo giá' },
  { value: 'READY_FOR_COMPARISON', label: 'Chờ duyệt' },
  { value: 'CLOSED', label: 'Đã đóng' },
] as const;

// Quotation Status filter options
export const QUOTATION_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'valid', label: 'Hợp lệ' },
  { value: 'invalid', label: 'Không hợp lệ' },
] as const;
