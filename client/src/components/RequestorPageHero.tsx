import type { LucideIcon } from 'lucide-react';

const TINT_CLASS = {
  graphite: 'page-banner-dark-tint-graphite',
  azure: 'page-banner-dark-tint-azure',
  ocean: 'page-banner-dark-tint-ocean',
  violet: 'page-banner-dark-tint-violet',
  emerald: 'page-banner-dark-tint-emerald',
  cyan: 'page-banner-dark-tint-cyan',
  rose: 'page-banner-dark-tint-rose',
} as const;

export type RequestorPageHeroTint = keyof typeof TINT_CLASS;

export type RequestorPageHeroProps = {
  kicker: string;
  title: string;
  /** Tùy chọn — bỏ qua để không hiển thị dòng mô tả dưới tiêu đề. */
  description?: string;
  Icon: LucideIcon;
  /** Mau nen banner (moi module co the khac nhau). */
  tint?: RequestorPageHeroTint;
  rightSlot?: React.ReactNode;
  className?: string;
  /** aria-label cho vung hero */
  regionLabel?: string;
};

/**
 * Banner toi giong trang tong quan Requestor (`page-banner-dark` + deco icon).
 */
export function RequestorPageHero({
  kicker,
  title,
  description,
  Icon,
  tint = 'graphite',
  rightSlot,
  className = '',
  regionLabel,
}: RequestorPageHeroProps) {
  const tintClass = TINT_CLASS[tint] ?? TINT_CLASS.graphite;
  const innerLayoutClass = rightSlot
    ? 'relative z-10 flex min-h-[inherit] flex-col justify-center gap-3 pr-14 sm:flex-row sm:items-center sm:justify-between sm:pr-16'
    : 'relative z-10 flex flex-col gap-3 pr-14 sm:pr-16';

  return (
    <div
      className={`page-banner-dark ${tintClass} page-banner-dark-no-outer-shadow relative block w-full min-h-[96px] sm:min-h-[112px] animate-fade-in-right fade-in-right-delay-0 ${className}`}
      role="region"
      aria-label={regionLabel ?? title}
    >
      <div className={innerLayoutClass}>
        <div className="min-w-0 md:max-w-[min(100%,28rem)]">
          <p className="page-banner-dark-kicker">{kicker}</p>
          <h1 className="page-banner-dark-title mt-1">{title}</h1>
          {description ? (
            <p className="page-banner-dark-desc mt-1 max-w-xl">{description}</p>
          ) : null}
        </div>
        {rightSlot ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{rightSlot}</div>
        ) : null}
      </div>
      <div className="page-banner-deco-icon" aria-hidden>
        <Icon className="h-12 w-12 sm:h-14 sm:w-14" strokeWidth={1.5} />
      </div>
    </div>
  );
}
