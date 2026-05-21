import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Đảo nội dung — bo 16px, bóng mịn trên nền #F8FAFC */
export const rfqDetailCardClass =
  'overflow-hidden rounded-2xl border border-slate-200/55 bg-white shadow-[0_12px_40px_-18px_rgba(15,23,42,0.1),0_4px_16px_-8px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.03]';

export const rfqDetailCardBodyClass = 'p-5 md:p-6';

export const rfqDetailFieldBoxClass =
  'rounded-xl border border-slate-100/90 bg-[#F8FAFC] px-4 py-3.5 transition-colors hover:border-slate-200/80 hover:bg-white';

/** Secondary CTA — nền trắng, viền/chữ tím chàm (empty state, điều hướng nhẹ). */
export const rfqDetailSecondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-violet-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-violet-300 hover:bg-violet-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500/40';

const countBadgeToneMap = {
  violet: 'bg-violet-500/[0.08] text-violet-800 ring-violet-200/50',
  sky: 'bg-sky-500/[0.08] text-sky-800 ring-sky-200/50',
  indigo: 'bg-indigo-500/[0.08] text-indigo-800 ring-indigo-200/50',
} as const;

export function RfqDetailCountBadge({
  count,
  tone = 'violet',
  label,
}: {
  count: number;
  tone?: keyof typeof countBadgeToneMap;
  /** Nếu có — hiển thị dạng «3 báo giá» thay vì chỉ số */
  label?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${countBadgeToneMap[tone]}`}
    >
      {label ?? count}
    </span>
  );
}

const iconToneMap = {
  indigo: 'bg-indigo-500/[0.08] text-indigo-600 ring-indigo-500/15',
  cyan: 'bg-cyan-500/[0.08] text-cyan-600 ring-cyan-500/15',
  sky: 'bg-sky-500/[0.08] text-sky-600 ring-sky-500/15',
  violet: 'bg-violet-500/[0.08] text-violet-600 ring-violet-500/15',
  amber: 'bg-amber-500/[0.08] text-amber-600 ring-amber-500/15',
  emerald: 'bg-emerald-500/[0.08] text-emerald-600 ring-emerald-500/15',
  slate: 'bg-slate-500/[0.08] text-slate-600 ring-slate-500/15',
} as const;

export type RfqIconTone = keyof typeof iconToneMap;

export function RfqDetailSectionHeader({
  Icon,
  tone = 'indigo',
  title,
  description,
  trailing,
}: {
  Icon: LucideIcon;
  tone?: RfqIconTone;
  title: string;
  description?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3.5">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${iconToneMap[tone]}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight text-[#1E293B] md:text-[1.0625rem]">{title}</h2>
          {description ? <p className="mt-0.5 text-xs leading-relaxed text-[#64748B]">{description}</p> : null}
        </div>
      </div>
      {trailing ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0.5">{trailing}</div>
      ) : null}
    </div>
  );
}

export function RfqDetailField({
  label,
  children,
  icon: Icon,
  iconClass = 'text-indigo-500',
  className = '',
}: {
  label: string;
  children: ReactNode;
  icon?: LucideIcon;
  iconClass?: string;
  className?: string;
}) {
  return (
    <div className={`${rfqDetailFieldBoxClass} ${className}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</dt>
      <dd className="mt-2 flex min-w-0 items-center gap-2 text-sm font-semibold text-[#1E293B]">
        {Icon ? <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} strokeWidth={2} aria-hidden /> : null}
        <span className="min-w-0 truncate">{children}</span>
      </dd>
    </div>
  );
}

export function RfqDetailEmptyState({
  Icon,
  title,
  description,
  action,
}: {
  Icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/70 bg-[#F8FAFC]/80 px-6 py-12 text-center sm:py-14">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 ring-1 ring-slate-200/80 shadow-sm">
        <Icon className="h-7 w-7" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="font-semibold text-[#1E293B]">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[#64748B]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function rfqStatusPillClass(status: string, awardedDone?: boolean) {
  if (awardedDone || status === 'CLOSED') {
    return 'border-emerald-200/70 bg-emerald-50/90 text-emerald-800 ring-emerald-100/80';
  }
  if (status === 'READY_FOR_COMPARISON') {
    return 'border-amber-200/70 bg-amber-50/90 text-amber-900 ring-amber-100/80';
  }
  if (status === 'SENT' || status === 'QUOTATION_RECEIVED') {
    return 'border-sky-200/70 bg-sky-50/90 text-sky-900 ring-sky-100/80';
  }
  return 'border-slate-200/80 bg-slate-50/95 text-slate-800 ring-slate-100/80';
}
