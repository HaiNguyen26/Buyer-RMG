import { TrendingDown, Wallet } from 'lucide-react';
import { CountUpNumber } from '../../../components/dashboard/CountUpNumber';

type Props = {
  currency: (amount?: number | null, code?: string) => string;
  currencyCompactVi: (amount: number) => string;
  rfqBaseline: number;
  currentAwardCost: number;
  headlineVendor?: string | null;
  coveragePercent?: number;
};

export function AwardLiveCostCard({
  currency,
  currencyCompactVi,
  rfqBaseline,
  currentAwardCost,
  headlineVendor,
  coveragePercent = 0,
}: Props) {
  const savings =
    rfqBaseline > 0 && currentAwardCost > 0 ? Math.max(0, rfqBaseline - currentAwardCost) : 0;
  const savingsPct = rfqBaseline > 0 && savings > 0 ? (savings / rfqBaseline) * 100 : 0;
  const pct = Math.min(100, Math.max(0, coveragePercent));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_28px_-16px_rgba(15,23,42,0.14)] ring-1 ring-slate-950/[0.04]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40 px-3.5 py-2.5">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Tóm tắt trao thầu</p>
      </div>
      <div className="p-3.5 sm:p-4">
        {headlineVendor ? (
          <p className="truncate text-sm font-black uppercase text-slate-900" title={headlineVendor}>
            {headlineVendor}
          </p>
        ) : (
          <p className="text-sm font-semibold text-slate-500">Chưa chọn NCC</p>
        )}
        <div className="mt-2 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
            <Wallet className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-2xl font-black tabular-nums tracking-tight text-slate-900">
              {currency(currentAwardCost)}
            </p>
            <p className="text-xs font-medium text-slate-500">≈ {currencyCompactVi(currentAwardCost)}</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <span>Phủ dòng PR</span>
            <span className="tabular-nums text-indigo-700">{pct.toFixed(0)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(pct > 0 ? 4 : 0, pct)}%` }}
            />
          </div>
        </div>
        {savings > 0 ? (
          <p className="mt-3 inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1.5 text-xs font-semibold text-emerald-900">
            <TrendingDown className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
            <span>
              Tiết kiệm{' '}
              <span className="font-mono font-black tabular-nums">
                <CountUpNumber end={Math.round(savings)} />
              </span>{' '}
              đ ({savingsPct.toFixed(1)}%)
            </span>
          </p>
        ) : rfqBaseline > 0 ? (
          <p className="mt-3 text-xs text-slate-500">Chọn NCC trên bảng — tổng tiền cập nhật theo thời gian thực.</p>
        ) : null}
      </div>
    </div>
  );
}
