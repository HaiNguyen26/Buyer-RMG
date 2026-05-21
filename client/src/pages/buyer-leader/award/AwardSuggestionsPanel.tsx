import { BadgeCheck, Sparkles, TrendingDown, Wallet, Zap, Building2 } from 'lucide-react';

export type AwardSuggestionsPanelProps = {
  currency: (amount?: number | null, code?: string) => string;
  currencyCompactVi: (amount: number) => string;
  vendorNameInitials: (name: string) => string;
  systemRecommendation: {
    splitByVendor: Array<{ vendorId: string; vendorName: string; items: number; pct: number }>;
    expectedCost: number;
    assignedLineCount: number;
    uncovered: number;
    hasPreferred: boolean;
  };
  baselineRfqValue: number;
  approvalMode: boolean;
  optimizeAward: (mode: 'lowest_cost' | 'cost_plus_leadtime') => void;
};

export function AwardSuggestionsPanel({
  currency,
  currencyCompactVi,
  vendorNameInitials,
  systemRecommendation,
  baselineRfqValue,
  approvalMode,
  optimizeAward,
}: AwardSuggestionsPanelProps) {
  const hasMix = systemRecommendation.splitByVendor.length > 0;
  const canOptimize = hasMix && !approvalMode;
  const expectedCost = systemRecommendation.expectedCost;
  const savingsAmount =
    baselineRfqValue > 0 && expectedCost > 0 ? Math.max(0, baselineRfqValue - expectedCost) : 0;
  const savingsPct = baselineRfqValue > 0 && savingsAmount > 0 ? (savingsAmount / baselineRfqValue) * 100 : 0;
  const primaryVendor = systemRecommendation.splitByVendor[0];
  const singleVendorFull =
    systemRecommendation.splitByVendor.length === 1 && (primaryVendor?.pct ?? 0) >= 99;

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-violet-300/40 bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4c1d95] ring-1 ring-violet-400/20 drop-shadow-[0_20px_48px_rgba(49,46,129,0.45)]">
      <div
        className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-violet-500/25 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/25">
          <Sparkles className="h-5 w-5 text-amber-300" strokeWidth={2.25} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/95 sm:text-sm">
            Đề xuất tối ưu chi phí từ SmartBuyer
          </p>
          <p className="mt-0.5 text-xs font-medium text-violet-200/90">
            Phân bổ theo giá tốt nhất từng dòng hàng
          </p>
        </div>
      </div>

      {hasMix ? (
        <div className="relative flex flex-col lg:flex-row lg:items-stretch">
          <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
            {systemRecommendation.uncovered > 0 ? (
              <p className="mb-3 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-100">
                {systemRecommendation.uncovered} dòng chưa báo giá — đề xuất có thể thiếu.
              </p>
            ) : null}

            {singleVendorFull && primaryVendor ? (
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-600 text-lg font-black text-white shadow-lg">
                    {vendorNameInitials(primaryVendor.vendorName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black uppercase leading-snug text-white">{primaryVendor.vendorName}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-100 ring-1 ring-emerald-400/30">
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                        100% hoàn thành
                      </span>
                      {systemRecommendation.hasPreferred ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-100 ring-1 ring-sky-400/30">
                          <Building2 className="h-3.5 w-3.5" aria-hidden />
                          Đầy đủ năng lực
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {systemRecommendation.splitByVendor.map((row) => (
                  <div
                    key={row.vendorId}
                    className="rounded-xl border border-white/12 bg-white/8 px-3 py-2.5 backdrop-blur-sm"
                  >
                    <p className="truncate text-sm font-bold text-white" title={row.vendorName}>
                      {row.vendorName}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-violet-200">
                      {row.items} dòng · {row.pct.toFixed(0)}%
                    </p>
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-xs leading-relaxed text-violet-200/85">
              {systemRecommendation.splitByVendor.length} NCC · {systemRecommendation.assignedLineCount} dòng trong đề
              xuất — nhấn áp dụng để đưa vào bảng so sánh.
            </p>
          </div>

          <aside className="flex w-full flex-col justify-center border-t border-white/10 px-5 py-5 lg:w-[min(100%,320px)] lg:shrink-0 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                <Wallet className="h-5 w-5 text-teal-300" aria-hidden />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-200">Chi phí dự kiến</p>
                <p className="font-mono text-2xl font-black tabular-nums text-white sm:text-3xl">{currency(expectedCost)}</p>
                <p className="text-xs text-violet-200/90">≈ {currencyCompactVi(expectedCost)}</p>
              </div>
            </div>

            {savingsAmount > 0 ? (
              <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <TrendingDown className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
                Tiết kiệm {currency(savingsAmount)}
                {savingsPct > 0 ? <span className="text-emerald-200/90">({savingsPct.toFixed(1)}%)</span> : null}
              </p>
            ) : null}

            <button
              type="button"
              disabled={!canOptimize}
              onClick={() => optimizeAward('lowest_cost')}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-amber-400 to-yellow-500 py-3.5 text-sm font-black text-slate-900 shadow-[0_12px_32px_-8px_rgba(251,191,36,0.65)] transition hover:brightness-105 active:scale-[0.99] disabled:from-slate-600 disabled:to-slate-700 disabled:text-white/40 disabled:shadow-none"
            >
              <Zap className="h-5 w-5 text-slate-900" strokeWidth={2.5} aria-hidden />
              Áp dụng phương án tối ưu
            </button>
          </aside>
        </div>
      ) : (
        <div className="px-5 py-4">
          <p className="text-sm font-semibold text-amber-100">Chưa đủ báo giá theo item để gợi ý phương án.</p>
        </div>
      )}
    </div>
  );
}
