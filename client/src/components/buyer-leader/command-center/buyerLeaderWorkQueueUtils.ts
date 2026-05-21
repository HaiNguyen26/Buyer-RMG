import type { BuyerLeaderQueueRow, BuyerLeaderWorkQueueTabId } from './buyerLeaderCommandCenterTypes';

export function getBuyerLeaderWorkQueueItems(
  tab: BuyerLeaderWorkQueueTabId,
  pendingPRs: Array<{ id: string; prNumber?: string; department?: string }>,
  activeRfqs: Array<{ id: string; rfqNumber?: string; prNumber?: string; status?: string }>,
  comparisonRfqs: Array<{ id: string; rfqNumber?: string; prNumber?: string }>,
  overBudgetPRs: Array<{ id: string; prNumber?: string; status?: string }>
): BuyerLeaderQueueRow[] {
  switch (tab) {
    case 'pending_assign':
      return pendingPRs.slice(0, 12).map((pr) => ({
        id: pr.id,
        primaryLabel: pr.prNumber ?? pr.id,
        secondaryLabel: pr.department,
        detailPath: '/dashboard/buyer-leader/pending-assignments',
      }));
    case 'rfq_active':
      return activeRfqs.slice(0, 12).map((rfq) => ({
        id: rfq.id,
        primaryLabel: rfq.rfqNumber ?? rfq.id,
        secondaryLabel: rfq.prNumber,
        meta: rfq.status,
        detailPath: '/dashboard/buyer-leader/rfq-monitoring',
      }));
    case 'compare':
      return comparisonRfqs.slice(0, 12).map((rfq) => ({
        id: rfq.id,
        primaryLabel: rfq.rfqNumber ?? rfq.id,
        secondaryLabel: rfq.prNumber,
        detailPath: `/dashboard/buyer-leader/compare-quotations/${rfq.id}/compare`,
      }));
    case 'over_budget':
      return overBudgetPRs.slice(0, 12).map((pr) => ({
        id: pr.id,
        primaryLabel: pr.prNumber ?? pr.id,
        meta: pr.status,
        detailPath: '/dashboard/buyer-leader/over-budget-prs',
      }));
    default:
      return [];
  }
}
