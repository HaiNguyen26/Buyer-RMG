import type { LucideIcon } from 'lucide-react';
import type { AssignedPRData } from '../../../services/buyerService';
import type { StatCardAccent } from '../../buyer-manager/StatCard';

export type BuyerWorkQueueTabId = 'assigned' | 'rfq' | 'need_info' | 'deadline';

export type UpcomingDeadlinePR = AssignedPRData & { deadline: string; daysLeft: number };

export type BuyerWorkQueueTabDef = {
  id: BuyerWorkQueueTabId;
  label: string;
  /** Nhãn gọn khi viewport hẹp / zoom — tránh cắt chữ trên tab. */
  shortLabel?: string;
  shortHint: string;
  accent: StatCardAccent;
  Icon: LucideIcon;
  detailRoute: string;
};

/** Chỉ số từ API GET /buyer/dashboard — không ước tính phía client. */
export type BuyerDashboardSnap = {
  assignedPRs: number;
  rfqInProgress: number;
  prsNeedMoreInfo: number;
  quotationsCompleted: number;
};

export type BuyerBudgetSegment = {
  id: string;
  label: string;
  percent: number;
  amountVnd: number;
  barClass: string;
  dotClass: string;
};
