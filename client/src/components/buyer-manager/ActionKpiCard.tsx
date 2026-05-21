import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

export type ActionKpiAccent = 'strategic' | 'alert' | 'overload' | 'capacity';

const ACCENT_STYLES: Record<
  ActionKpiAccent,
  {
    shell: string;
    iconWrap: string;
    icon: string;
    valueGlow: string;
    progressTrack: string;
    progressFill: string;
  }
> = {
  strategic: {
    shell:
      'border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-white/80 to-white/70 shadow-[0_16px_40px_-14px_rgba(16,185,129,0.22),inset_0_1px_0_0_rgba(255,255,255,0.95)] ring-emerald-100/60',
    iconWrap: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/35 ring-2 ring-white/80',
    icon: 'text-white',
    valueGlow: 'text-emerald-950',
    progressTrack: 'bg-emerald-100/80',
    progressFill: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  },
  alert: {
    shell:
      'border-orange-200/80 bg-gradient-to-br from-orange-50/95 via-white/75 to-amber-50/60 shadow-[0_16px_40px_-14px_rgba(249,115,22,0.24),inset_0_1px_0_0_rgba(255,255,255,0.95)] ring-orange-100/70',
    iconWrap: 'bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/40 ring-2 ring-white/80',
    icon: 'text-white',
    valueGlow: 'text-orange-950',
    progressTrack: 'bg-orange-100/80',
    progressFill: 'bg-gradient-to-r from-orange-500 to-red-500',
  },
  overload: {
    shell:
      'border-fuchsia-200/75 bg-gradient-to-br from-fuchsia-50/90 via-white/75 to-rose-50/65 shadow-[0_16px_40px_-14px_rgba(217,70,239,0.22),inset_0_1px_0_0_rgba(255,255,255,0.95)] ring-fuchsia-100/65',
    iconWrap: 'bg-gradient-to-br from-fuchsia-600 to-rose-600 text-white shadow-lg shadow-fuchsia-500/40 ring-2 ring-white/80',
    icon: 'text-white',
    valueGlow: 'text-fuchsia-950',
    progressTrack: 'bg-fuchsia-100/80',
    progressFill: 'bg-gradient-to-r from-fuchsia-600 to-rose-600',
  },
  capacity: {
    shell:
      'border-sky-200/75 bg-gradient-to-br from-sky-50/95 via-white/80 to-indigo-50/55 shadow-[0_16px_40px_-14px_rgba(14,165,233,0.22),inset_0_1px_0_0_rgba(255,255,255,0.95)] ring-sky-100/65',
    iconWrap: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/35 ring-2 ring-white/80',
    icon: 'text-white',
    valueGlow: 'text-sky-950',
    progressTrack: 'bg-sky-100/80',
    progressFill: 'bg-gradient-to-r from-sky-500 to-blue-600',
  },
};

export type ActionKpiTrend = {
  label: string;
  tone: 'up' | 'down' | 'neutral' | 'info';
};

export type ActionKpiCardProps = {
  accent: ActionKpiAccent;
  Icon: LucideIcon;
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  /** Chỉ số trực quan góc phải (sparkline, thước ngưỡng, SLA, ma trận đội). */
  topRight?: ReactNode;
  trend?: ActionKpiTrend;
  progress?: { value: number; max: number; label: string };
  /** Thu padding, icon và cỡ chữ — dashboard dày KPI. */
  compact?: boolean;
  className?: string;
};

function TrendBadge({ trend }: { trend: ActionKpiTrend }) {
  const toneClass =
    trend.tone === 'up'
      ? 'border-emerald-200/90 bg-emerald-50 text-emerald-800'
      : trend.tone === 'down'
        ? 'border-rose-200/90 bg-rose-50 text-rose-800'
        : trend.tone === 'info'
          ? 'border-sky-200/90 bg-sky-50 text-sky-800'
          : 'border-slate-200/90 bg-slate-50 text-slate-700';

  const TrendIcon =
    trend.tone === 'up' ? ArrowUpRight : trend.tone === 'down' ? ArrowDownRight : Minus;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${toneClass}`}
    >
      <TrendIcon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
      {trend.label}
    </span>
  );
}

/** KPI Tầng 3 — actionable visual + metric (Buyer Manager). */
export function ActionKpiCard({
  accent,
  Icon,
  label,
  value,
  unit,
  hint,
  topRight,
  trend,
  progress,
  compact = false,
  className = '',
}: ActionKpiCardProps) {
  const a = ACCENT_STYLES[accent];
  const progressPct =
    progress && progress.max > 0 ? Math.min(100, Math.round((progress.value / progress.max) * 100)) : 0;

  return (
    <article
      className={`relative w-full min-w-0 overflow-hidden border backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-0.5 ${
        compact
          ? 'rounded-2xl p-3.5 shadow-[0_10px_24px_-12px_rgba(15,23,42,0.1)] hover:shadow-[0_14px_28px_-12px_rgba(15,23,42,0.12)] sm:p-4'
          : 'rounded-[24px] p-4 shadow-[0_22px_48px_-16px_rgba(15,23,42,0.14)] hover:shadow-[0_22px_48px_-16px_rgba(15,23,42,0.14)] sm:p-5'
      } ${a.shell} ${className}`}
    >
      <div className={`pointer-events-none absolute -right-6 -top-6 rounded-full bg-white/35 blur-2xl ${compact ? 'h-14 w-14' : 'h-20 w-20'}`}
        aria-hidden
      />
      <div className={`relative z-[1] flex flex-col ${compact ? 'gap-2' : 'gap-3'}`}>
        <div className={`flex items-start ${compact ? 'gap-2' : 'gap-3'}`}>
          <div
            className={`flex shrink-0 items-center justify-center ${a.iconWrap} ${compact ? 'h-9 w-9 rounded-lg' : 'h-11 w-11 rounded-xl'}`}
          >
            <Icon className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} ${a.icon}`} strokeWidth={2.25} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className={`flex flex-wrap items-center ${compact ? 'gap-1.5' : 'gap-2'}`}>
              <p
                className={`font-bold uppercase tracking-[0.12em] text-slate-500 ${compact ? 'text-[10px]' : 'text-[11px]'}`}
              >
                {label}
              </p>
              {trend ? <TrendBadge trend={trend} /> : null}
            </div>
            <div className={`flex flex-wrap items-baseline gap-x-1.5 gap-y-0 ${compact ? 'mt-1' : 'mt-1.5'}`}>
              <span
                className={`font-black tabular-nums leading-none tracking-tight ${a.valueGlow} ${
                  compact ? 'text-xl sm:text-2xl' : 'text-[1.75rem] sm:text-[2rem]'
                }`}
              >
                {value}
              </span>
              {unit ? (
                <span className={`font-semibold text-slate-500 ${compact ? 'text-xs' : 'text-sm'}`}>{unit}</span>
              ) : null}
            </div>
          </div>
          {topRight ? (
            <div className={`shrink-0 self-start ${compact ? 'max-w-[118px] origin-top-right scale-[0.88]' : ''}`}>
              {topRight}
            </div>
          ) : null}
        </div>

        {progress ? (
          <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
            <div className={`flex items-center justify-between gap-2 font-semibold text-slate-600 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
              <span>{progress.label}</span>
              <span className="tabular-nums text-slate-800">{progressPct}%</span>
            </div>
            <div className={`${compact ? 'h-1.5' : 'h-2'} overflow-hidden rounded-full ${a.progressTrack}`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${a.progressFill}`}
                style={{ width: `${progressPct}%` }}
                role="progressbar"
                aria-valuenow={progress.value}
                aria-valuemin={0}
                aria-valuemax={progress.max}
              />
            </div>
          </div>
        ) : null}

        {hint ? <p className={`leading-relaxed text-slate-600 ${compact ? 'text-[11px]' : 'text-xs'}`}>{hint}</p> : null}
      </div>
    </article>
  );
}
