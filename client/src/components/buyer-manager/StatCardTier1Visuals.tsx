export type LeadTimeFunnelStage = {
  label: string;
  days: number;
  isBottleneck?: boolean;
};

type BudgetAllocationBarProps = {
  branchApprovedValue: number;
  buyerProcessingValue: number;
  monthlySpendPct: number;
  formatCurrency: (n: number) => string;
};

/** Phân bổ giá trị pipeline: đã duyệt nhánh vs đang xử lý buyer + % hạn mức tháng. */
export function BudgetAllocationBar({
  branchApprovedValue,
  buyerProcessingValue,
  monthlySpendPct,
  formatCurrency,
}: BudgetAllocationBarProps) {
  const total = branchApprovedValue + buyerProcessingValue || 1;
  const branchPct = Math.round((branchApprovedValue / total) * 100);
  const buyerPct = 100 - branchPct;

  return (
    <div className="space-y-2.5" role="img" aria-label="Phân bổ giá trị PR theo giai đoạn duyệt">
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-600">
        <span>Hạn mức tháng (pipeline)</span>
        <span className={`tabular-nums ${monthlySpendPct >= 85 ? 'text-rose-700' : monthlySpendPct >= 60 ? 'text-amber-700' : 'text-emerald-700'}`}>
          {monthlySpendPct}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${monthlySpendPct >= 85 ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`}
          style={{ width: `${Math.min(100, monthlySpendPct)}%` }}
        />
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/60">
        <div className="bg-emerald-400/90 transition-all" style={{ width: `${branchPct}%` }} title="Đã duyệt nhánh" />
        <div className="bg-indigo-500/90 transition-all" style={{ width: `${buyerPct}%` }} title="Đang xử lý buyer" />
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[10px] leading-snug text-slate-600">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-400 align-middle" aria-hidden />
          Duyệt nhánh {formatCurrency(branchApprovedValue)} ({branchPct}%)
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-indigo-500 align-middle" aria-hidden />
          Xử lý {formatCurrency(buyerProcessingValue)} ({buyerPct}%)
        </span>
      </div>
    </div>
  );
}

type LeadTimeFunnelProps = {
  stages: LeadTimeFunnelStage[];
};

/** Timeline 3 chặng — highlight cổ chai (chặng có số ngày cao nhất). */
export function LeadTimeFunnel({ stages }: LeadTimeFunnelProps) {
  if (stages.length === 0) return null;

  const maxDays = Math.max(...stages.map((s) => s.days), 1);

  return (
    <div className="space-y-2" role="img" aria-label="Lead-time theo chặng pipeline">
      <div className="flex items-stretch gap-1">
        {stages.map((stage, i) => {
          const w = Math.max(18, Math.round((stage.days / maxDays) * 100));
          const bottleneck = stage.isBottleneck;
          return (
            <div key={stage.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className={`flex w-full min-h-[2.25rem] items-end justify-center rounded-lg px-0.5 pb-1 pt-2 transition-all ${
                  bottleneck
                    ? 'bg-amber-100 ring-2 ring-amber-400/60'
                    : 'bg-indigo-50 ring-1 ring-indigo-100'
                }`}
                style={{ flexBasis: `${w}%` }}
              >
                <span className={`text-xs font-black tabular-nums ${bottleneck ? 'text-amber-900' : 'text-indigo-800'}`}>
                  {stage.days}
                  <span className="text-[9px] font-bold">d</span>
                </span>
              </div>
              {i < stages.length - 1 ? (
                <span className="absolute hidden" aria-hidden />
              ) : null}
              <p className="w-full truncate text-center text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                {stage.label}
              </p>
            </div>
          );
        })}
      </div>
      {stages.some((s) => s.isBottleneck) ? (
        <p className="text-[10px] font-medium text-amber-800">Cổ chai: {stages.find((s) => s.isBottleneck)?.label}</p>
      ) : (
        <p className="text-[10px] text-slate-500">Tuổi TB PR đang ở từng chặng (ngày)</p>
      )}
    </div>
  );
}

export type RiskHeatLevel = 'low' | 'medium' | 'high';

type RiskHeatmapIndicatorProps = {
  level: RiskHeatLevel;
  overBudgetCount: number;
  overBudgetRate: number;
  totalNonDraft: number;
};

/** Thanh heatmap + số PR chạm ngưỡng ngân sách. */
export function RiskHeatmapIndicator({
  level,
  overBudgetCount,
  overBudgetRate,
  totalNonDraft,
}: RiskHeatmapIndicatorProps) {
  const markerLeft = level === 'low' ? '14%' : level === 'medium' ? '50%' : '86%';
  const label = level === 'low' ? 'Thấp' : level === 'medium' ? 'Theo dõi' : 'Cao';

  return (
    <div className="space-y-2" role="img" aria-label={`Mức rủi ro ngân sách: ${label}`}>
      <div className="relative h-2 overflow-hidden rounded-full ring-1 ring-slate-200/80">
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-emerald-400 to-emerald-500" />
        <div className="absolute inset-y-0 left-1/3 w-1/3 bg-gradient-to-r from-amber-400 to-amber-500" />
        <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-r from-rose-500 to-red-600" />
        <div
          className="absolute top-1/2 z-[1] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-800 shadow"
          style={{ left: markerLeft }}
          aria-hidden
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold">
        <span className={level === 'high' ? 'text-rose-700' : level === 'medium' ? 'text-amber-800' : 'text-emerald-700'}>
          Rủi ro {label}
        </span>
        <span className="tabular-nums text-slate-700">
          <strong className="text-rose-700">{overBudgetCount}</strong> PR ngoại lệ / {totalNonDraft.toLocaleString('vi-VN')} PR
        </span>
      </div>
      <p className="text-[10px] leading-snug text-slate-500">
        {overBudgetCount === 0
          ? 'Chưa có PR ở trạng thái BUDGET_EXCEPTION — tiếp tục giám sát proxy.'
          : `${overBudgetRate}% tổng PR (không nháp) đang chạm ngưỡng cảnh báo ngân sách.`}
      </p>
    </div>
  );
}
