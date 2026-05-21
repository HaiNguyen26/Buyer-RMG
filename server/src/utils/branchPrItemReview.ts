/**
 * GĐ chi nhánh: quyết định theo dòng NEED_PURCHASE đã được Trưởng phòng duyệt.
 */

import type { DepartmentItemOutcomeValue } from './departmentPrItemReview';
import {
  itemEligibleForDepartmentOutcome,
  itemLineAmountForTotal,
  itemDepartmentOutcomeAllowsProcurement,
} from './departmentPrItemReview';

export type { DepartmentItemOutcomeValue };

export { itemLineAmountForTotal, itemEligibleForDepartmentOutcome };

/** Dòng mua ngoài đã qua Trưởng phòng (APPROVED hoặc legacy null). */
export function itemEligibleForBranchLevelDecision(item: {
  status?: string;
  departmentItemOutcome?: string | null;
}): boolean {
  if (!itemEligibleForDepartmentOutcome(String(item.status || ''))) return false;
  const d = item.departmentItemOutcome;
  return d == null || d === 'APPROVED';
}

export function itemProcurementEffectiveOutcome(item: {
  branchItemOutcome?: string | null;
  departmentItemOutcome?: string | null;
}): string | null {
  if (item.branchItemOutcome != null && String(item.branchItemOutcome) !== '') {
    return String(item.branchItemOutcome);
  }
  return item.departmentItemOutcome != null ? String(item.departmentItemOutcome) : null;
}

export function itemAllowsProcurementAfterApprovals(item: {
  branchItemOutcome?: string | null;
  departmentItemOutcome?: string | null;
}): boolean {
  return itemDepartmentOutcomeAllowsProcurement(itemProcurementEffectiveOutcome(item));
}

export function sumPurchaseTotalAfterBranchDecisions(
  items: Array<{
    status: string;
    branchItemOutcome?: DepartmentItemOutcomeValue | null;
    departmentItemOutcome?: DepartmentItemOutcomeValue | null;
    amount?: unknown;
    qty?: unknown;
    unitPrice?: unknown;
    estimatedUnitPriceVnd?: unknown;
  }>,
): number {
  let sum = 0;
  for (const item of items) {
    if (!itemAllowsProcurementAfterApprovals(item)) continue;
    sum += itemLineAmountForTotal(item);
  }
  return Math.round(sum * 100) / 100;
}

export function hasActivePurchasingAfterBranchDecisions(
  items: Array<{
    status: string;
    branchItemOutcome?: DepartmentItemOutcomeValue | null;
    departmentItemOutcome?: DepartmentItemOutcomeValue | null;
  }>,
): boolean {
  for (const item of items) {
    if (!itemEligibleForDepartmentOutcome(String(item.status))) continue;
    const effective = itemProcurementEffectiveOutcome(item);
    if (effective === 'APPROVED') return true;
    if (effective == null && itemEligibleForBranchLevelDecision(item)) return true;
  }
  return false;
}
