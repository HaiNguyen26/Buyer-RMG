import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

export type StatCardAccent = 'emerald' | 'sky' | 'indigo' | 'rose' | 'amber' | 'violet' | 'slate';

const ACCENT: Record<
  StatCardAccent,
  { iconWrap: string; iconWrapBento: string; iconClass: string; valueClass: string }
> = {
  emerald: {
    iconWrap: 'bg-emerald-50 ring-1 ring-emerald-100/80',
    iconWrapBento: 'rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/15',
    iconClass: 'text-emerald-600',
    valueClass: 'text-slate-900',
  },
  sky: {
    iconWrap: 'bg-sky-50 ring-1 ring-sky-100/80',
    iconWrapBento: 'rounded-xl bg-sky-500/10 ring-1 ring-sky-500/15',
    iconClass: 'text-sky-600',
    valueClass: 'text-slate-900',
  },
  indigo: {
    iconWrap: 'bg-indigo-50 ring-1 ring-indigo-100/80',
    iconWrapBento: 'rounded-xl bg-[#4F46E5]/10 ring-1 ring-[#4F46E5]/20',
    iconClass: 'text-indigo-600',
    valueClass: 'text-slate-900',
  },
  rose: {
    iconWrap: 'bg-rose-50 ring-1 ring-rose-100/80',
    iconWrapBento: 'rounded-xl bg-[#EF4444]/10 ring-1 ring-[#EF4444]/18',
    iconClass: 'text-rose-600',
    valueClass: 'text-slate-900',
  },
  amber: {
    iconWrap: 'bg-amber-50 ring-1 ring-amber-100/80',
    iconWrapBento: 'rounded-xl bg-[#F59E0B]/10 ring-1 ring-[#F59E0B]/20',
    iconClass: 'text-amber-600',
    valueClass: 'text-slate-900',
  },
  violet: {
    iconWrap: 'bg-violet-50 ring-1 ring-violet-100/80',
    iconWrapBento: 'rounded-xl bg-violet-500/10 ring-1 ring-violet-500/15',
    iconClass: 'text-violet-600',
    valueClass: 'text-slate-900',
  },
  slate: {
    iconWrap: 'bg-slate-50 ring-1 ring-slate-100/80',
    iconWrapBento: 'rounded-xl bg-slate-500/10 ring-1 ring-slate-500/15',
    iconClass: 'text-slate-600',
    valueClass: 'text-slate-900',
  },
};

/** KPI `embedded` — pastel + viền accent khi có việc; hover glow theo màu. */
const EMBEDDED_ACTIVE: Record<
  StatCardAccent,
  { shell: string; hover: string; chevronHover: string; iconWrap: string }
> = {
  indigo: {
    shell:
      'border-indigo-200/90 bg-gradient-to-br from-indigo-50/95 via-indigo-50/40 to-white/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85)]',
    hover:
      'hover:border-indigo-300 hover:shadow-[0_10px_28px_-10px_rgba(79,70,229,0.35)] hover:-translate-y-0.5',
    chevronHover: 'group-hover:text-indigo-600',
    iconWrap: 'rounded-lg bg-indigo-500/15 ring-1 ring-indigo-500/25',
  },
  sky: {
    shell:
      'border-sky-200/90 bg-gradient-to-br from-sky-50/95 via-sky-50/35 to-white/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85)]',
    hover: 'hover:border-sky-300 hover:shadow-[0_10px_28px_-10px_rgba(14,165,233,0.32)] hover:-translate-y-0.5',
    chevronHover: 'group-hover:text-sky-600',
    iconWrap: 'rounded-lg bg-sky-500/15 ring-1 ring-sky-500/25',
  },
  emerald: {
    shell:
      'border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 via-emerald-50/35 to-white/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85)]',
    hover:
      'hover:border-emerald-300 hover:shadow-[0_10px_28px_-10px_rgba(16,185,129,0.3)] hover:-translate-y-0.5',
    chevronHover: 'group-hover:text-emerald-600',
    iconWrap: 'rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/25',
  },
  amber: {
    shell:
      'border-amber-200/90 bg-gradient-to-br from-amber-50/95 via-amber-50/35 to-white/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85)]',
    hover: 'hover:border-amber-300 hover:shadow-[0_10px_28px_-10px_rgba(245,158,11,0.28)] hover:-translate-y-0.5',
    chevronHover: 'group-hover:text-amber-600',
    iconWrap: 'rounded-lg bg-amber-500/15 ring-1 ring-amber-500/25',
  },
  violet: {
    shell:
      'border-violet-200/90 bg-gradient-to-br from-violet-50/95 via-violet-50/35 to-white/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85)]',
    hover:
      'hover:border-violet-300 hover:shadow-[0_10px_28px_-10px_rgba(139,92,246,0.3)] hover:-translate-y-0.5',
    chevronHover: 'group-hover:text-violet-600',
    iconWrap: 'rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25',
  },
  rose: {
    shell:
      'border-rose-200/90 bg-gradient-to-br from-rose-50/95 via-rose-50/35 to-white/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85)]',
    hover: 'hover:border-rose-300 hover:shadow-[0_10px_28px_-10px_rgba(244,63,94,0.28)] hover:-translate-y-0.5',
    chevronHover: 'group-hover:text-rose-600',
    iconWrap: 'rounded-lg bg-rose-500/15 ring-1 ring-rose-500/25',
  },
  slate: {
    shell:
      'border-slate-300/80 bg-gradient-to-br from-slate-100/90 via-slate-50/50 to-white/70 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85)]',
    hover: 'hover:border-slate-400/80 hover:shadow-[0_10px_28px_-10px_rgba(100,116,139,0.22)] hover:-translate-y-0.5',
    chevronHover: 'group-hover:text-slate-700',
    iconWrap: 'rounded-lg bg-slate-500/12 ring-1 ring-slate-500/20',
  },
};

const EMBEDDED_ZERO_SHELL =
  'group relative w-full text-left rounded-xl border border-slate-200/45 bg-slate-50/35 opacity-[0.82] transition-all duration-200 hover:border-slate-200/65 hover:bg-slate-50/55 hover:opacity-95';

export type StatCardProps = {
  Icon: LucideIcon;
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  accent: StatCardAccent;
  /** V3 Bento: bo 24–28px, ambient shadow, hover lift, typography value black. */
  variant?: 'default' | 'bento';
  /**
   * Chỉ khi `variant="bento"`: thu padding, icon và typography một bước — hàng KPI dày (grid 4 cột, trang phụ).
   * Xem `docs/design/dashboard-v3-design-philosophy.md` §4.
   */
  compact?: boolean;
  /**
   * KPI nằm trong `dashboardV3IslandClass` — không lồng thẻ trắng + bóng riêng; chỉ tile nhẹ trong đảo.
   */
  embedded?: boolean;
  /** Chỉ `embedded`: `active` = có việc (pastel + CTA), `zero` = số 0 làm mờ. */
  activity?: 'active' | 'zero';
  className?: string;
  onClick?: () => void;
  /** Vùng mở rộng dưới hint — funnel, progress phân bổ, heatmap (Tầng 1 nâng cao). */
  extension?: ReactNode;
};

/**
 * Thẻ chỉ số — hierarchy: value lớn đậm, unit/hint nhỏ; elevation nhẹ + hover.
 */
export function StatCard({
  Icon,
  label,
  value,
  unit,
  hint,
  accent,
  variant = 'default',
  compact = false,
  embedded = false,
  activity,
  className = '',
  onClick,
  extension,
}: StatCardProps) {
  const a = ACCENT[accent];
  const isBento = variant === 'bento';
  const isEmbedded = isBento && embedded;
  const isEmbeddedActive = isEmbedded && activity === 'active';
  const isEmbeddedZero = isEmbedded && activity === 'zero';
  const isCompact = isBento && (compact || embedded);
  const embeddedActive = isEmbeddedActive ? EMBEDDED_ACTIVE[accent] : null;
  const iconShell = isEmbeddedActive && embeddedActive
    ? embeddedActive.iconWrap
    : isBento
      ? a.iconWrapBento
      : a.iconWrap;
  const iconPad = isBento
    ? isEmbedded
      ? 'rounded-lg p-1.5'
      : isCompact
        ? 'p-2'
        : 'p-3'
    : 'p-2.5';
  const iconSize = isBento ? (isEmbedded ? 'h-4 w-4' : isCompact ? 'h-5 w-5' : 'h-6 w-6') : 'h-5 w-5';

  const shell = !isBento
    ? 'rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md'
    : isEmbeddedActive && embeddedActive
      ? `group relative w-full rounded-xl border p-2.5 text-left transition-all duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-3 ${embeddedActive.shell} ${onClick ? embeddedActive.hover : ''}`
      : isEmbeddedZero
        ? `${EMBEDDED_ZERO_SHELL} p-2.5 sm:p-3`
        : isEmbedded
          ? 'rounded-lg bg-slate-100/55 p-2.5 transition-colors duration-200 hover:bg-slate-100/90 sm:p-3'
          : isCompact
            ? 'rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_14px_22px_-8px_rgba(15,23,42,0.08),inset_0_1px_0_0_rgba(255,255,255,0.88)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_28px_-10px_rgba(15,23,42,0.11)] sm:p-5'
            : 'rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_20px_25px_-5px_rgba(15,23,42,0.07),inset_0_1px_0_0_rgba(255,255,255,0.85)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_20px_25px_-5px_rgba(15,23,42,0.12)]';

  const rowGap = isBento ? (isEmbedded ? 'gap-2' : isCompact ? 'gap-3' : 'gap-4') : 'gap-3';
  const valueColorClass = isEmbeddedZero
    ? 'text-slate-300'
    : isEmbeddedActive
      ? a.valueClass
      : a.valueClass;
  const labelClass = isBento
    ? isEmbeddedZero
      ? 'text-[10px] font-semibold uppercase tracking-wide text-slate-400/90'
      : isEmbedded
        ? 'text-[10px] font-semibold uppercase tracking-wide text-slate-500'
      : isCompact
        ? 'text-[11px] font-semibold uppercase tracking-wide text-slate-400'
        : 'text-xs font-medium uppercase tracking-wide text-slate-400'
    : 'text-xs font-semibold uppercase tracking-wide text-slate-500';
  const valueBlockMt = isBento ? (isEmbedded ? 'mt-1' : isCompact ? 'mt-2' : 'mt-3') : 'mt-2';
  const valueTextClass = isBento
    ? isEmbedded
      ? isEmbeddedZero
        ? 'text-xl font-semibold leading-none sm:text-2xl'
        : 'text-xl font-black leading-none sm:text-2xl'
      : isCompact
        ? 'text-[1.375rem] font-black leading-none sm:text-2xl md:text-[1.75rem]'
        : 'text-[2rem] font-black leading-none md:text-4xl'
    : 'text-3xl font-bold';
  const unitClass = isBento ? (isEmbedded ? 'text-[11px]' : isCompact ? 'text-xs' : 'text-sm') : 'text-sm';
  const hintClass = isBento
    ? isEmbeddedZero
      ? 'mt-1 line-clamp-2 text-[10px] leading-snug text-slate-400'
      : isEmbedded
        ? 'mt-1 line-clamp-2 text-[10px] leading-snug text-slate-500'
      : isCompact
        ? 'mt-2 text-[11px] leading-snug text-slate-500'
        : 'mt-3 text-xs leading-relaxed text-slate-500'
    : 'mt-2 text-xs leading-relaxed text-slate-500';

  const showNavigateCue = Boolean(isEmbedded && onClick);
  const titleAttr = showNavigateCue ? 'Nhấp để mở chi tiết' : undefined;

  const body = (
    <>
      <div className={`flex items-start ${rowGap}`}>
        <div className={`shrink-0 ${iconPad} ${iconShell}`}>
          <Icon
            className={`${iconSize} ${isEmbeddedZero ? 'text-slate-400' : a.iconClass}`}
            strokeWidth={2}
            aria-hidden
          />
        </div>
        <div className={`min-w-0 flex-1 ${showNavigateCue ? 'pr-5' : ''}`}>
          <p className={labelClass}>{label}</p>
          <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0 ${valueBlockMt}`}>
            <span className={`tabular-nums tracking-tight ${valueColorClass} ${valueTextClass}`}>{value}</span>
            {unit ? (
              <span className={`font-medium ${isEmbeddedZero ? 'text-slate-400' : 'text-slate-500'} ${unitClass}`}>
                {unit}
              </span>
            ) : null}
          </div>
          {hint && !extension ? <p className={hintClass}>{hint}</p> : null}
        </div>
      </div>
      {showNavigateCue ? (
        <ChevronRight
          className={`pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 shrink-0 text-slate-300 transition-all duration-200 ${
            isEmbeddedActive && embeddedActive
              ? `opacity-0 group-hover:opacity-100 ${embeddedActive.chevronHover}`
              : 'opacity-40 group-hover:opacity-70 group-hover:text-slate-500'
          }`}
          strokeWidth={2.25}
          aria-hidden
        />
      ) : null}
      {hint && extension ? <p className={`${hintClass} ${isBento ? 'mt-3' : 'mt-2'}`}>{hint}</p> : null}
      {extension ? (
        <div className={isBento ? (isCompact ? 'mt-3 border-t border-slate-100 pt-3' : 'mt-4 border-t border-slate-100 pt-4') : 'mt-3 border-t border-slate-100 pt-3'}>
          {extension}
        </div>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" title={titleAttr} className={`${shell} ${className}`} onClick={onClick}>
        {body}
      </button>
    );
  }

  return <div className={`${shell} ${className}`}>{body}</div>;
}
