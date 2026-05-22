import type { AssignedPRData } from '../../../services/buyerService';
import type { BuyerWorkQueueTabId, UpcomingDeadlinePR } from './buyerCommandCenterTypes';

export function filterRfqInProgress(prs: AssignedPRData[]): AssignedPRData[] {
  return prs.filter(
    (pr) =>
      pr.status === 'COLLECTING_QUOTATION' ||
      pr.status === 'RFQ_IN_PROGRESS' ||
      pr.status === 'QUOTATION_RECEIVED'
  );
}

export function filterAwaitingRepurchase(prs: AssignedPRData[]): AssignedPRData[] {
  return prs.filter((pr) => pr.status === 'AWAITING_REORDER');
}

export function filterNeedInfo(prs: AssignedPRData[]): AssignedPRData[] {
  return prs.filter((pr) => pr.status === 'RETURNED' || pr.status === 'NEED_MORE_INFO');
}

export function buildUpcomingDeadlines(prs: AssignedPRData[]): UpcomingDeadlinePR[] {
  const today = new Date();
  return prs
    .flatMap((pr): UpcomingDeadlinePR[] => {
      if (!pr.deadline) return [];
      const deadline = new Date(pr.deadline);
      const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0 || diffDays > 7) return [];
      return [{ ...pr, deadline: pr.deadline, daysLeft: diffDays }];
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function getWorkQueueItems(
  tab: BuyerWorkQueueTabId,
  assigned: AssignedPRData[],
  rfq: AssignedPRData[],
  needInfo: AssignedPRData[],
  deadlines: UpcomingDeadlinePR[]
): AssignedPRData[] | UpcomingDeadlinePR[] {
  switch (tab) {
    case 'assigned':
      return assigned;
    case 'rfq':
      return rfq;
    case 'need_info':
      return needInfo;
    case 'deadline':
      return deadlines;
    default:
      return assigned;
  }
}
