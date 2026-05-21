/**
 * Chuẩn SaaS nhẹ cho bảng dữ liệu: typography Inter (sans), badge trạng thái, nút icon.
 */
import type { StockIssueStatus } from '../services/stockIssueService';
import { PR_STATUS_LABELS } from './statusLabels';

export const saasTableRootClass =
  'font-sans text-[13px] leading-snug tracking-[-0.01em] text-slate-800 antialiased';

export const saasTableHeadCellClass =
  'font-sans text-[11px] font-semibold uppercase tracking-wide text-slate-500';

export const saasTableNumericStrongClass = 'tabular-nums font-semibold tracking-[-0.01em] text-slate-900';

/** Mã phiếu / số tiền: sans + tabular (không dùng font-mono) */
export const saasTableCodeCellClass =
  'font-sans text-[13px] font-semibold tabular-nums tracking-[-0.01em] text-slate-900';

export type SaasStatusTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'purple';

export const SAAS_BADGE_BY_TONE: Record<SaasStatusTone, string> = {
  success:
    'inline-flex max-w-full items-center truncate rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-700/12',
  warning:
    'inline-flex max-w-full items-center truncate rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-950 ring-1 ring-inset ring-amber-700/15',
  danger:
    'inline-flex max-w-full items-center truncate rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-900 ring-1 ring-inset ring-rose-600/15',
  neutral:
    'inline-flex max-w-full items-center truncate rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-800 ring-1 ring-inset ring-slate-600/10',
  info:
    'inline-flex max-w-full items-center truncate rounded-md bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-900 ring-1 ring-inset ring-sky-700/12',
  purple:
    'inline-flex max-w-full items-center truncate rounded-md bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-900 ring-1 ring-inset ring-violet-600/15',
};

const PR_SAAS_TONE: Record<string, SaasStatusTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  MANAGER_PENDING: 'warning',
  MANAGER_APPROVED: 'success',
  MANAGER_REJECTED: 'danger',
  MANAGER_RETURNED: 'danger',
  BRANCH_MANAGER_PENDING: 'purple',
  BRANCH_MANAGER_APPROVED: 'success',
  BRANCH_MANAGER_REJECTED: 'danger',
  BRANCH_MANAGER_RETURNED: 'danger',
  BUYER_LEADER_PENDING: 'success',
  NEED_MORE_INFO: 'warning',
  ASSIGNED_TO_BUYER: 'info',
  RFQ_IN_PROGRESS: 'info',
  COLLECTING_QUOTATION: 'warning',
  QUOTATION_RECEIVED: 'success',
  SUPPLIER_SELECTED: 'success',
  BUDGET_EXCEPTION: 'warning',
  BUDGET_APPROVED: 'success',
  BUDGET_REJECTED: 'danger',
  PAYMENT_DONE: 'success',
  READY_FOR_RFQ: 'success',
  CANCELLED: 'neutral',
  DEPARTMENT_HEAD_PENDING: 'warning',
  DEPARTMENT_HEAD_APPROVED: 'success',
  DEPARTMENT_HEAD_REJECTED: 'danger',
  DEPARTMENT_HEAD_RETURNED: 'danger',
  APPROVED_BY_BRANCH: 'success',
};

export function saasPrStatusTone(status: string): SaasStatusTone {
  const key = (status || '').toUpperCase();
  return PR_SAAS_TONE[key] ?? 'neutral';
}

export function saasPrStatusBadgeClass(status: string): string {
  return SAAS_BADGE_BY_TONE[saasPrStatusTone(status)];
}

export function saasPrStatusLabel(status: string): string {
  const key = (status || '').toUpperCase();
  return PR_STATUS_LABELS[key]?.label ?? status;
}

const STOCK_ISSUE_TONE: Record<StockIssueStatus, SaasStatusTone> = {
  DRAFT: 'neutral',
  RESERVED: 'warning',
  APPROVED: 'info',
  ISSUED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

export function saasStockIssueBadgeClass(status: StockIssueStatus): string {
  return SAAS_BADGE_BY_TONE[STOCK_ISSUE_TONE[status] ?? 'neutral'];
}

const saasIconBtnBase =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-all duration-150 hover:text-slate-900 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/35 focus-visible:ring-offset-0';

export const saasTableIconBtnView = `${saasIconBtnBase} hover:bg-slate-100 hover:text-indigo-600`;

export const saasTableIconBtnEdit = `${saasIconBtnBase} hover:bg-amber-50 hover:text-amber-800`;

export const saasTableIconBtnDelete = `${saasIconBtnBase} text-rose-500 hover:bg-rose-50 hover:text-rose-700`;
