export type PoBudgetComparison = {
  prProposedAmount: number;
  poTotalAmount: number;
  deltaAmount: number;
  deltaPercent: number;
  direction: 'savings' | 'over' | 'on_budget';
};

export function resolvePoBudgetComparison(
  poTotal: number | null | undefined,
  prBudget: number | null | undefined,
  fromApi?: PoBudgetComparison | null
): PoBudgetComparison | null {
  if (fromApi) return fromApi;
  if (poTotal == null || prBudget == null || prBudget <= 0 || poTotal <= 0) return null;
  const delta = prBudget - poTotal;
  const deltaAmount = Math.abs(Math.round(delta));
  const deltaPercent = Math.round((deltaAmount / prBudget) * 1000) / 10;
  const direction = delta > 0 ? 'savings' : delta < 0 ? 'over' : 'on_budget';
  return {
    prProposedAmount: Math.round(prBudget),
    poTotalAmount: Math.round(poTotal),
    deltaAmount,
    deltaPercent,
    direction,
  };
}

export function poBudgetUsagePercent(comp: PoBudgetComparison): number {
  return Math.round((comp.poTotalAmount / comp.prProposedAmount) * 1000) / 10;
}

export function formatPoBudgetDeltaLabel(comp: PoBudgetComparison): string {
  const amt = comp.deltaAmount.toLocaleString('vi-VN');
  if (comp.direction === 'savings') {
    return `Tiết kiệm ${amt} đ (${comp.deltaPercent}% so với ngân sách PR)`;
  }
  if (comp.direction === 'over') {
    return `Vượt ngân sách ${amt} đ (+${comp.deltaPercent}%)`;
  }
  return 'Khớp ngân sách PR';
}
