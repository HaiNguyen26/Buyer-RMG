import type { ReactNode } from 'react';

type BuyerHiddenPriceProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  suffix?: ReactNode;
};

const SIZE_CLASS: Record<NonNullable<BuyerHiddenPriceProps['size']>, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg font-bold',
  xl: 'text-xl font-black sm:text-2xl',
};

/** Che giá đề xuất Requestor trên PR — Buyer hỏi giá NCC độc lập, không đọc số thật trong DOM. */
export function BuyerHiddenPrice({ className = '', size = 'md', suffix }: BuyerHiddenPriceProps) {
  return (
    <span
      className={['inline-flex flex-wrap items-baseline gap-1.5', className].filter(Boolean).join(' ')}
      title="Giá đề xuất Requestor — ẩn để Buyer hỏi giá NCC độc lập"
    >
      <span
        className={[
          'inline-block select-none rounded-md bg-white/30 px-1.5 py-0.5 font-mono tabular-nums text-slate-700',
          'blur-[7px] brightness-95',
          SIZE_CLASS[size],
        ].join(' ')}
        aria-hidden="true"
      >
        000.000.000
      </span>
      {suffix ? (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-inherit opacity-80">
          {suffix}
        </span>
      ) : null}
      <span className="sr-only">Giá đề xuất đã ẩn</span>
    </span>
  );
}
