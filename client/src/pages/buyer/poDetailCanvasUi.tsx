import type { ReactNode } from 'react';
import { FileText, type LucideIcon } from 'lucide-react';
import { PO_STATUS_LABELS } from '../../utils/poDetailUiStrings';
import type { PoDisplayLang } from '../../utils/poDisplayLang';

export const poCanvasLabelClass =
  'text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400';

export const poCanvasMetaValueClass = 'mt-0.5 text-sm font-bold text-slate-900';

export const poCanvasRmgGradientClass =
  'bg-gradient-to-r from-rose-600 via-rose-500 to-pink-500 bg-clip-text text-transparent';

export function daysUntilDelivery(deliveryDate: string | null | undefined): {
  dateStr: string | null;
  daysLeft: number | null;
} {
  if (!deliveryDate) return { dateStr: null, daysLeft: null };
  const target = new Date(deliveryDate);
  if (Number.isNaN(target.getTime())) return { dateStr: null, daysLeft: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  return {
    dateStr: target.toLocaleDateString('vi-VN'),
    daysLeft,
  };
}

export function poStatusKpiCopy(
  status: string,
  lang: PoDisplayLang,
): { text: string; valueClass: string } {
  const label = PO_STATUS_LABELS[lang][status] ?? status;
  switch (status) {
    case 'SUBMITTED':
      return {
        text: lang === 'vi' ? 'Chờ Trưởng phòng duyệt' : label,
        valueClass: 'text-amber-700',
      };
    case 'APPROVED':
    case 'ISSUED':
    case 'CREATED':
    case 'SENT':
    case 'CONFIRMED':
      return {
        text:
          lang === 'vi' && (status === 'CREATED' || status === 'APPROVED')
            ? 'Trưởng bộ phận đã ký duyệt'
            : label,
        valueClass: 'text-emerald-700',
      };
    case 'REJECTED':
    case 'CANCELLED':
    case 'CANCEL_REQUESTED':
      return { text: label, valueClass: 'text-rose-700' };
    default:
      return { text: label, valueClass: 'text-slate-800' };
  }
}

export type PoKpiVariant = 'violet' | 'orange' | 'emerald';

const PO_KPI_VARIANT: Record<
  PoKpiVariant,
  { iconWrap: string; icon: string; card: string }
> = {
  violet: {
    iconWrap:
      'bg-gradient-to-br from-violet-500 via-violet-600 to-purple-700 shadow-md shadow-violet-500/35',
    icon: 'text-white',
    card: 'bg-gradient-to-br from-white via-violet-50/30 to-violet-100/25 ring-violet-100/90',
  },
  orange: {
    iconWrap:
      'bg-gradient-to-br from-orange-400 via-amber-500 to-orange-600 shadow-md shadow-orange-500/35',
    icon: 'text-white',
    card: 'bg-gradient-to-br from-white via-orange-50/35 to-amber-100/25 ring-orange-100/90',
  },
  emerald: {
    iconWrap:
      'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 shadow-md shadow-emerald-500/35',
    icon: 'text-white',
    card: 'bg-gradient-to-br from-white via-emerald-50/30 to-teal-100/25 ring-emerald-100/90',
  },
};

export function PoCanvasKpiCard({
  icon: Icon,
  variant = 'violet',
  label,
  value,
  valueClass = 'text-slate-900',
  hint,
}: {
  icon: LucideIcon;
  variant?: PoKpiVariant;
  label: string;
  value: ReactNode;
  valueClass?: string;
  hint?: string;
}) {
  const preset = PO_KPI_VARIANT[variant];

  return (
    <div
      className={`rounded-xl p-3 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.1)] ring-1 ${preset.card}`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${preset.iconWrap}`}
          aria-hidden
        >
          <Icon className={`h-4 w-4 ${preset.icon}`} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.06em] text-slate-400">
            {label}
          </p>
          <div className={`mt-1 text-base font-black leading-snug tracking-tight ${valueClass}`}>
            {value}
          </div>
          {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

function PoDocMetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-start gap-x-1.5 sm:justify-end">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-bold text-slate-900">{children}</span>
    </div>
  );
}

/** Đầu tờ PO — gọn, label + value cùng dòng (theo bản in). */
export function PoDocumentSheetHeader({
  lang,
  poNumber,
  prValue,
  buyer,
  orderDate,
}: {
  lang: PoDisplayLang;
  poNumber: string;
  prValue: ReactNode;
  buyer: string;
  orderDate: string;
}) {
  const vi = lang === 'vi';
  const buyerDisplay = buyer?.trim() ? buyer.trim().toUpperCase() : '—';
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="flex min-w-0 gap-2">
        <FileText
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
          strokeWidth={2}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {vi ? 'Phòng cung ứng vật tư RMG' : 'RMG procurement'}
          </p>
          <h2 className="text-2xl font-black leading-tight tracking-tight text-slate-900">
            {vi ? 'ĐƠN ĐẶT HÀNG' : 'PURCHASE ORDER'}{' '}
            <span className="text-rose-600">RMG</span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {vi ? 'Bản thảo số hiệu:' : 'Draft no.:'}{' '}
            <span className="font-mono font-semibold text-slate-700">{poNumber}</span>
          </p>
        </div>
      </div>
      <div className="shrink-0 space-y-1 sm:text-right">
        <PoDocMetaRow label={vi ? 'Mã yêu cầu (PR):' : 'PR request:'}>{prValue}</PoDocMetaRow>
        <PoDocMetaRow label="Buyer PIC:">{buyerDisplay}</PoDocMetaRow>
        <PoDocMetaRow label={vi ? 'Ngày lập đơn:' : 'Order date:'}>{orderDate}</PoDocMetaRow>
      </div>
    </div>
  );
}

export function PoCanvasDocSection({
  num,
  title,
  icon: Icon,
  children,
}: {
  num: number;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="pt-8 first:pt-0">
      <div className="mb-5 flex items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-violet-600" strokeWidth={2} aria-hidden />
        <h3 className="shrink-0 text-sm font-bold text-indigo-950">
          {num}. {title}
        </h3>
        <div className="h-px min-w-8 flex-1 bg-slate-200" aria-hidden />
      </div>
      {children}
    </section>
  );
}
