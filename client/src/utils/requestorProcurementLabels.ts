import type { RequestorItemStatusKey } from '../services/requestorService';

export const ITEM_STATUS_BADGE_CLASS: Record<RequestorItemStatusKey, string> = {
  REVISION_REQUIRED: 'bg-amber-100 text-amber-900 ring-amber-200',
  REJECTED: 'bg-rose-100 text-rose-900 ring-rose-200',
  ON_HOLD: 'bg-slate-100 text-slate-800 ring-slate-200',
  FROM_STOCK: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  FULFILLED: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  RECEIVED: 'bg-emerald-100 text-emerald-900 ring-emerald-200',
  PARTIAL_RECEIVED: 'bg-sky-100 text-sky-900 ring-sky-200',
  DELAYED: 'bg-rose-100 text-rose-900 ring-rose-200',
  INCOMING: 'bg-indigo-100 text-indigo-900 ring-indigo-200',
  AWAITING_VENDOR_CONFIRM: 'bg-amber-100 text-amber-900 ring-amber-200',
  PO_SENT: 'bg-violet-100 text-violet-900 ring-violet-200',
  VENDOR_CONFIRMED: 'bg-teal-100 text-teal-900 ring-teal-200',
  SUPPLIER_SELECTED: 'bg-purple-100 text-purple-900 ring-purple-200',
  RFQ: 'bg-blue-100 text-blue-900 ring-blue-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-800 ring-amber-200',
  PROCUREMENT: 'bg-slate-100 text-slate-800 ring-slate-200',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-200',
  LINE_CANCEL_PENDING: 'bg-amber-100 text-amber-950 ring-amber-200',
  AWAITING_REORDER: 'bg-orange-100 text-orange-950 ring-orange-200',
};

export function currentStepToneClass(
  tone: 'indigo' | 'amber' | 'emerald' | 'rose' | 'slate'
): string {
  switch (tone) {
    case 'emerald':
      return 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-900';
    case 'amber':
      return 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900';
    case 'rose':
      return 'border-rose-200 bg-gradient-to-r from-rose-50 to-red-50 text-rose-900';
    case 'slate':
      return 'border-slate-200 bg-slate-50 text-slate-800';
    default:
      return 'border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-900';
  }
}

export function formatEtaDisplay(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
