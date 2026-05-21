import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export type BuyerOverviewPanelTheme = 'assigned' | 'rfq' | 'deadline' | 'returned';

const THEMES: Record<
  BuyerOverviewPanelTheme,
  {
    shell: string;
    headBase: string;
    headAccent: string;
    headBorder: string;
    ornament: string;
    eyebrow: string;
    title: string;
    desc: string;
    iconWrap: string;
    icon: string;
    badge: string;
    cta: string;
    bodyBg: string;
  }
> = {
  assigned: {
    shell: 'border-indigo-200/45 bg-white/55 shadow-[0_14px_44px_-22px_rgba(79,70,229,0.14)] ring-indigo-500/[0.05]',
    headBase: 'from-indigo-100/55 via-slate-50/40 to-white/90',
    headAccent: 'from-violet-200/25 via-indigo-100/15 to-transparent',
    headBorder: 'border-indigo-200/35',
    ornament: 'bg-indigo-400/15',
    eyebrow: 'text-indigo-600/75',
    title: 'text-slate-800',
    desc: 'text-slate-600/90',
    iconWrap: 'bg-white/60 shadow-sm shadow-indigo-500/8 ring-1 ring-white/90 backdrop-blur-md',
    icon: 'text-indigo-600',
    badge: 'bg-indigo-500/[0.08] text-indigo-800 ring-1 ring-indigo-200/50 backdrop-blur-sm',
    cta: 'bg-white/55 text-indigo-700 ring-indigo-200/45 backdrop-blur-md hover:bg-white/75',
    bodyBg: 'from-indigo-50/20 via-white/40 to-slate-50/30',
  },
  rfq: {
    shell: 'border-sky-200/45 bg-white/55 shadow-[0_14px_44px_-22px_rgba(14,165,233,0.12)] ring-sky-500/[0.05]',
    headBase: 'from-sky-100/50 via-slate-50/35 to-white/90',
    headAccent: 'from-cyan-200/20 via-sky-100/15 to-transparent',
    headBorder: 'border-sky-200/35',
    ornament: 'bg-sky-400/15',
    eyebrow: 'text-sky-700/75',
    title: 'text-slate-800',
    desc: 'text-slate-600/90',
    iconWrap: 'bg-white/60 shadow-sm shadow-sky-500/8 ring-1 ring-white/90 backdrop-blur-md',
    icon: 'text-sky-600',
    badge: 'bg-sky-500/[0.08] text-sky-800 ring-1 ring-sky-200/50 backdrop-blur-sm',
    cta: 'bg-white/55 text-sky-700 ring-sky-200/45 backdrop-blur-md hover:bg-white/75',
    bodyBg: 'from-sky-50/25 via-white/40 to-cyan-50/20',
  },
  deadline: {
    shell: 'border-rose-200/40 bg-white/55 shadow-[0_14px_44px_-22px_rgba(244,63,94,0.11)] ring-rose-500/[0.05]',
    headBase: 'from-rose-100/45 via-slate-50/35 to-white/90',
    headAccent: 'from-orange-200/20 via-rose-100/15 to-transparent',
    headBorder: 'border-rose-200/35',
    ornament: 'bg-rose-400/12',
    eyebrow: 'text-rose-600/75',
    title: 'text-slate-800',
    desc: 'text-slate-600/90',
    iconWrap: 'bg-white/60 shadow-sm shadow-rose-500/8 ring-1 ring-white/90 backdrop-blur-md',
    icon: 'text-rose-600',
    badge: 'bg-rose-500/[0.08] text-rose-800 ring-1 ring-rose-200/50 backdrop-blur-sm',
    cta: 'bg-white/55 text-rose-700 ring-rose-200/45 backdrop-blur-md hover:bg-white/75',
    bodyBg: 'from-rose-50/20 via-white/40 to-orange-50/15',
  },
  returned: {
    shell: 'border-amber-200/45 bg-white/55 shadow-[0_14px_44px_-22px_rgba(245,158,11,0.11)] ring-amber-500/[0.05]',
    headBase: 'from-amber-100/45 via-slate-50/35 to-white/90',
    headAccent: 'from-orange-200/18 via-amber-100/12 to-transparent',
    headBorder: 'border-amber-200/35',
    ornament: 'bg-amber-400/12',
    eyebrow: 'text-amber-700/75',
    title: 'text-slate-800',
    desc: 'text-slate-600/90',
    iconWrap: 'bg-white/60 shadow-sm shadow-amber-500/8 ring-1 ring-white/90 backdrop-blur-md',
    icon: 'text-amber-700',
    badge: 'bg-amber-500/[0.08] text-amber-900 ring-1 ring-amber-200/50 backdrop-blur-sm',
    cta: 'bg-white/55 text-amber-800 ring-amber-200/45 backdrop-blur-md hover:bg-white/75',
    bodyBg: 'from-amber-50/22 via-white/40 to-orange-50/15',
  },
};

export type BuyerOverviewPanelProps = {
  theme: BuyerOverviewPanelTheme;
  Icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  count: number;
  onViewAll?: () => void;
  viewAllLabel?: string;
  animationClass?: string;
  bodyClassName?: string;
  /** Thu header, bo góc và padding — dashboard tổng quan dày. */
  compact?: boolean;
  children: ReactNode;
};

export function BuyerOverviewPanel({
  theme,
  Icon,
  eyebrow,
  title,
  description,
  count,
  onViewAll,
  viewAllLabel = 'Xem tất cả',
  animationClass = '',
  bodyClassName = '',
  compact = false,
  children,
}: BuyerOverviewPanelProps) {
  const t = THEMES[theme];

  return (
    <div className="flex h-full min-h-0 min-w-0">
      <article
        className={`group flex h-full min-h-0 w-full flex-col overflow-hidden border backdrop-blur-xl ${compact ? 'rounded-[22px]' : 'rounded-[26px]'} ${t.shell} ${animationClass}`}
      >
        <header className={`relative overflow-hidden border-b ${t.headBorder}`}>
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${t.headBase}`}
            aria-hidden
          />
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-tr ${t.headAccent}`}
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 bg-white/35 backdrop-blur-md" aria-hidden />
          <div
            className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl ${t.ornament}`}
            aria-hidden
          />
          <div
            className={`pointer-events-none absolute -bottom-10 left-0 h-24 w-24 rounded-full blur-3xl ${t.ornament} opacity-80`}
            aria-hidden
          />

          <div
            className={`relative z-10 flex flex-col ${compact ? 'gap-2 px-4 py-3 sm:px-4 sm:py-3.5' : 'gap-3 px-5 py-4 sm:px-6 sm:py-5'}`}
          >
            <div className={`flex items-start ${compact ? 'gap-2' : 'gap-3'}`}>
              <span
                className={`flex shrink-0 items-center justify-center ${t.iconWrap} transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none ${compact ? 'h-9 w-9 rounded-xl' : 'h-12 w-12 rounded-2xl'}`}
              >
                <Icon className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} ${t.icon}`} strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className={`font-bold uppercase tracking-[0.16em] ${t.eyebrow} ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
                  {eyebrow}
                </p>
                <h2
                  className={`mt-0.5 line-clamp-2 font-bold tracking-tight ${t.title} ${compact ? 'text-sm sm:text-base' : 'text-base sm:text-lg'}`}
                >
                  {title}
                </h2>
              </div>
              <span
                className={`shrink-0 rounded-full font-bold tabular-nums ${t.badge} ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}`}
                title="Số mục trong danh sách"
              >
                {count}
              </span>
            </div>
            <p className={`line-clamp-2 leading-relaxed ${t.desc} ${compact ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>
              {description}
            </p>
            {onViewAll ? (
              <button
                type="button"
                onClick={onViewAll}
                className={`inline-flex w-fit items-center gap-1 rounded-full font-semibold ring-1 transition ${t.cta} ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}
              >
                {viewAllLabel}
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              </button>
            ) : null}
          </div>
        </header>

        <div
          className={`relative flex min-h-0 flex-1 flex-col bg-gradient-to-b backdrop-blur-[2px] ${t.bodyBg} ${bodyClassName} ${
            compact ? 'px-2.5 pb-2.5 pt-1.5 sm:px-3 sm:pb-3 sm:pt-2' : 'px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3'
          }`}
        >
          <div className="pointer-events-none absolute inset-0 bg-white/25 backdrop-blur-[1px]" aria-hidden />
          <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
            {children}
            <div className="min-h-0 flex-1" aria-hidden />
          </div>
        </div>
      </article>
    </div>
  );
}
