/** Ngân sách đề xuất PR — ưu tiên estimatedUnitPriceVnd, fallback unitPrice. */
export type PrItemProposedBudgetInput = {
  qty: unknown;
  unitPrice?: unknown;
  estimatedUnitPriceVnd?: unknown | null;
};

export function computePrProposedBudgetAmount(items: PrItemProposedBudgetInput[]): number {
  let sum = 0;
  for (const item of items) {
    const qty = Number(item.qty) || 0;
    const est = Number(item.estimatedUnitPriceVnd) || 0;
    const unit = Number(item.unitPrice) || 0;
    const effective = est > 0 ? est : unit;
    sum += qty * effective;
  }
  return Math.round(sum);
}

export type PoVsPrBudgetComparison = {
  prProposedAmount: number;
  poTotalAmount: number;
  deltaAmount: number;
  deltaPercent: number;
  direction: 'savings' | 'over' | 'on_budget';
};

export function comparePoTotalToPrProposedBudget(
  poTotalAmount: number,
  prProposedAmount: number
): PoVsPrBudgetComparison | null {
  if (!(prProposedAmount > 0) || !(poTotalAmount > 0)) return null;
  const delta = prProposedAmount - poTotalAmount;
  const deltaAmount = Math.abs(Math.round(delta));
  const deltaPercent = Math.round((deltaAmount / prProposedAmount) * 1000) / 10;
  const direction =
    delta > 0 ? 'savings' : delta < 0 ? 'over' : ('on_budget' as const);
  return {
    prProposedAmount: Math.round(prProposedAmount),
    poTotalAmount: Math.round(poTotalAmount),
    deltaAmount,
    deltaPercent,
    direction,
  };
}
