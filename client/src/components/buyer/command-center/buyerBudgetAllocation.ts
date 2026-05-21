import type { AssignedPRData } from '../../../services/buyerService';
import type { BuyerBudgetSegment } from './buyerCommandCenterTypes';

const BAR_PALETTE = [
  { barClass: 'bg-indigo-500', dotClass: 'bg-indigo-500' },
  { barClass: 'bg-sky-500', dotClass: 'bg-sky-500' },
  { barClass: 'bg-emerald-500', dotClass: 'bg-emerald-500' },
  { barClass: 'bg-violet-500', dotClass: 'bg-violet-500' },
  { barClass: 'bg-amber-500', dotClass: 'bg-amber-500' },
  { barClass: 'bg-slate-400', dotClass: 'bg-slate-400' },
] as const;

const UNCLASSIFIED = 'Chưa phân loại';

function departmentLabel(pr: AssignedPRData): string {
  const d = pr.department?.trim();
  return d && d.length > 0 ? d : UNCLASSIFIED;
}

/** Phân bổ theo phòng ban + tổng `totalAmount` từ API (không ước tính). */
export function derivePrBudgetAllocation(prs: AssignedPRData[]): {
  segments: BuyerBudgetSegment[];
  totalVnd: number;
  prCount: number;
  hasAmounts: boolean;
} {
  const prCount = prs.length;
  if (prCount === 0) {
    return { segments: [], totalVnd: 0, prCount: 0, hasAmounts: false };
  }

  const buckets = new Map<string, { count: number; amountVnd: number }>();

  for (const pr of prs) {
    const label = departmentLabel(pr);
    const prev = buckets.get(label) ?? { count: 0, amountVnd: 0 };
    const amt = pr.totalAmount != null && pr.totalAmount > 0 ? pr.totalAmount : 0;
    buckets.set(label, {
      count: prev.count + 1,
      amountVnd: prev.amountVnd + amt,
    });
  }

  const totalVnd = [...buckets.values()].reduce((s, b) => s + b.amountVnd, 0);
  const hasAmounts = totalVnd > 0;

  const sorted = [...buckets.entries()].sort((a, b) => {
    if (hasAmounts) return b[1].amountVnd - a[1].amountVnd;
    return b[1].count - a[1].count;
  });

  const segments: BuyerBudgetSegment[] = sorted.slice(0, 6).map(([label, data], index) => {
    const palette = BAR_PALETTE[index % BAR_PALETTE.length];
    const basis = hasAmounts ? totalVnd : prCount;
    const value = hasAmounts ? data.amountVnd : data.count;
    const percent = basis > 0 ? Math.round((value / basis) * 100) : 0;
    return {
      id: `dept-${index}`,
      label,
      percent,
      amountVnd: data.amountVnd,
      barClass: palette.barClass,
      dotClass: palette.dotClass,
    };
  });

  const sumPct = segments.reduce((a, s) => a + s.percent, 0);
  if (segments[0] && sumPct !== 100 && sumPct > 0) {
    segments[0].percent += 100 - sumPct;
  }

  return { segments, totalVnd, prCount, hasAmounts };
}
