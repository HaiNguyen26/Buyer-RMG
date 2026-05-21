import type { LucideIcon } from 'lucide-react';

export type BuyerLeaderWorkQueueTabId =
  | 'pending_assign'
  | 'rfq_active'
  | 'compare'
  | 'over_budget';

export type BuyerLeaderWorkQueueTabDef = {
  id: BuyerLeaderWorkQueueTabId;
  label: string;
  shortLabel?: string;
  shortHint: string;
  accent: 'indigo' | 'sky' | 'violet' | 'rose';
  Icon: LucideIcon;
  detailRoute: string;
};

export type BuyerLeaderQueueRow = {
  id: string;
  primaryLabel: string;
  secondaryLabel?: string;
  meta?: string;
  detailPath: string;
};
