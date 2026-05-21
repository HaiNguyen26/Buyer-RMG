import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

/** Màu semantic — Modern Enterprise UI */
export type MetricVariant = 'indigo' | 'emerald' | 'rose' | 'amber' | 'slate';

const VARIANT: Record<
  MetricVariant,
  { iconWrap: string; iconClass: string }
> = {
  indigo: {
    iconWrap: 'bg-indigo-50 ring-1 ring-indigo-100/80',
    iconClass: 'text-indigo-600',
  },
  emerald: {
    iconWrap: 'bg-emerald-50 ring-1 ring-emerald-100/80',
    iconClass: 'text-emerald-600',
  },
  rose: {
    iconWrap: 'bg-rose-50 ring-1 ring-rose-100/80',
    iconClass: 'text-rose-600',
  },
  amber: {
    iconWrap: 'bg-amber-50 ring-1 ring-amber-100/80',
    iconClass: 'text-amber-600',
  },
  slate: {
    iconWrap: 'bg-slate-50 ring-1 ring-slate-100/80',
    iconClass: 'text-slate-600',
  },
};

export type MetricTrend =
  | { direction: 'up' | 'down' | 'flat'; label: string; variant?: 'emerald' | 'rose' | 'amber' | 'slate' }
  | undefined;

export type MetricCardProps = {
  Icon: LucideIcon;
  title: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  trend?: MetricTrend;
  variant: MetricVariant;
  /** Nhấn mạnh nhẹ (vd. hàng đợi duyệt): viền semantic, vẫn nền trắng */
  emphasis?: 'default' | 'watch';
  className?: string;
};

function TrendIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'up') return <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />;
  if (direction === 'down') return <TrendingDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />;
  return <Minus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />;
}

/**
 * Thẻ chỉ số dùng chung dashboard (Atomic) — value lớn đậm, unit nhỏ, elevation + hover.
 */
export function MetricCard({
  Icon,
  title,
  value,
  unit,
  hint,
  trend,
  variant,
  emphasis = 'default',
  className = '',
}: MetricCardProps) {
  const v = VARIANT[variant];
  const watchRing = emphasis === 'watch' ? 'ring-1 ring-amber-200/90' : '';

  const trendTone =
    trend?.variant ??
    (trend?.direction === 'up' ? 'emerald' : trend?.direction === 'down' ? 'rose' : 'slate');
  const trendClass =
    trendTone === 'emerald'
      ? 'text-emerald-700 bg-emerald-50/90'
      : trendTone === 'rose'
        ? 'text-rose-700 bg-rose-50/90'
        : trendTone === 'amber'
          ? 'text-amber-800 bg-amber-50/90'
          : 'text-slate-600 bg-slate-100/80';

  return (
    <div
      className={`rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md ${watchRing} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`shrink-0 rounded-lg p-2.5 ${v.iconWrap}`}>
          <Icon className={`h-5 w-5 ${v.iconClass}`} strokeWidth={2} aria-hidden />
        </div>
        {trend ? (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${trendClass}`}
          >
            <TrendIcon direction={trend.direction} />
            {trend.label}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-slate-900">{value}</span>
        {unit ? <span className="text-sm font-medium text-slate-500">{unit}</span> : null}
      </div>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}
