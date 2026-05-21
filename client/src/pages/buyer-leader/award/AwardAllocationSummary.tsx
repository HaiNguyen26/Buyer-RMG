import { useEffect, useState } from 'react';
import { Package, TrendingDown } from 'lucide-react';
import { CountUpNumber } from '../../../components/dashboard/CountUpNumber';

export type AwardVendorSplitRow = {
  vendorId: string;
  vendorName: string;
  amount: number;
  items: number;
  pct: number;
};

function useAnimatedAmount(value: number, duration = 380) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const from = display;
    const diff = value - from;
    if (!Number.isFinite(diff) || diff === 0) {
      setDisplay(value);
      return;
    }
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t * (2 - t);
      setDisplay(from + diff * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return display;
}

function CompactVendorRow({
  row,
  formatCurrency,
}: {
  row: AwardVendorSplitRow;
  formatCurrency: (amount: number) => string;
}) {
  const animated = useAnimatedAmount(row.amount, 380);
  return (
    <li className="border-t border-slate-100/90 px-2.5 py-2 first:border-t-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold uppercase leading-snug text-slate-900" title={row.vendorName}>
            {row.vendorName}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-slate-500">
            <Package className="h-3 w-3 shrink-0 text-amber-700/80" aria-hidden />
            {row.items} dòng hàng
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-emerald-800 ring-1 ring-emerald-200/70">
          {row.pct.toFixed(0)}%
        </span>
      </div>
      <p className="mt-1 text-right font-mono text-sm font-black tabular-nums text-slate-900">{formatCurrency(animated)}</p>
    </li>
  );
}

type AwardAllocationSummaryProps = {
  vendors: AwardVendorSplitRow[];
  formatCurrency: (amount: number) => string;
  compact?: boolean;
  savingsAmount?: number;
  savingsPct?: number;
};

/**
 * Sidebar “Tóm tắt trao thầu” — compact dùng trên cột phải workspace award.
 */
export function AwardAllocationSummary({
  vendors,
  formatCurrency,
  compact = false,
  savingsAmount = 0,
  savingsPct = 0,
}: AwardAllocationSummaryProps) {
  if (compact) {
    return (
      <section
        className="rounded-xl drop-shadow-[0_12px_32px_-14px_rgba(15,23,42,0.2)]"
        aria-labelledby="award-allocation-summary-title"
      >
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white ring-1 ring-slate-200/80">
        <header className="flex items-center gap-2 border-b border-slate-100 px-2.5 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/60">
            <Package className="h-3.5 w-3.5" strokeWidth={2.35} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 id="award-allocation-summary-title" className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-900">
              Tóm tắt trao thầu
            </h3>
            <p className="truncate text-[10px] font-medium text-slate-500">Theo nhà cung cấp đang chọn</p>
          </div>
        </header>

        {vendors.length > 0 ? (
          <ul>
            {vendors.map((row) => (
              <CompactVendorRow key={row.vendorId} row={row} formatCurrency={formatCurrency} />
            ))}
          </ul>
        ) : (
          <p className="px-2.5 py-3 text-center text-xs font-medium text-slate-500">Chưa chọn NCC — chọn trên bảng so sánh.</p>
        )}

        {savingsAmount > 0 ? (
          <p className="flex items-center gap-1 border-t border-slate-100 bg-emerald-50/60 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-900">
            <TrendingDown className="h-3 w-3 shrink-0" aria-hidden />
            Tiết kiệm{' '}
            <span className="font-mono font-black tabular-nums">
              <CountUpNumber end={Math.round(savingsAmount)} />
            </span>{' '}
            đ ({savingsPct.toFixed(1)}%)
          </p>
        ) : null}
        </div>
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-teal-200/45 bg-gradient-to-b from-white via-teal-50/15 to-white shadow-[0_8px_28px_-16px_rgba(13,148,136,0.18)] ring-1 ring-slate-950/[0.03]"
      aria-labelledby="award-allocation-summary-title-full"
    >
      <header className="flex items-center justify-between gap-2 border-b border-teal-100/70 bg-gradient-to-r from-teal-600/92 via-teal-600/88 to-cyan-700/90 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/18 text-white ring-1 ring-white/35">
            <Package className="h-5 w-5" strokeWidth={2.35} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 id="award-allocation-summary-title-full" className="text-xs font-black uppercase tracking-[0.12em] text-white">
              Tóm tắt trao thầu
            </h3>
            <p className="truncate text-[11px] font-medium text-teal-100/92">
              Theo NCC đang chọn{vendors.length > 0 ? ` · ${vendors.length} NCC` : ''}
            </p>
          </div>
        </div>
      </header>

      {vendors.length > 0 ? (
        <ul className="divide-y divide-slate-50">
          {vendors.map((row) => (
            <CompactVendorRow key={row.vendorId} row={row} formatCurrency={formatCurrency} />
          ))}
        </ul>
      ) : (
        <p className="px-3 py-4 text-center text-sm font-medium text-slate-700">Chưa có phân bổ — chọn NCC cho từng dòng trong bảng.</p>
      )}
    </section>
  );
}
