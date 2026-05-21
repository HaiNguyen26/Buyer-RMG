import { ClipboardList, FileSearch, MessageSquareWarning, Timer } from 'lucide-react';
import type { BuyerWorkQueueTabDef } from './buyerCommandCenterTypes';

export const BUYER_WORK_QUEUE_TABS: BuyerWorkQueueTabDef[] = [
  {
    id: 'assigned',
    label: 'PR phân công',
    shortLabel: 'PR phân công',
    shortHint: 'PR đang thuộc bạn trong luồng mua.',
    accent: 'indigo',
    Icon: ClipboardList,
    detailRoute: '/dashboard/buyer/assigned-prs',
  },
  {
    id: 'rfq',
    label: 'RFQ đang chạy',
    shortLabel: 'RFQ',
    shortHint: 'Đang hỏi giá hoặc đã nhận báo giá.',
    accent: 'sky',
    Icon: FileSearch,
    detailRoute: '/dashboard/buyer/rfq',
  },
  {
    id: 'need_info',
    label: 'Cần bổ sung',
    shortLabel: 'Bổ sung',
    shortHint: 'PR trả về hoặc cần làm rõ thông tin.',
    accent: 'amber',
    Icon: MessageSquareWarning,
    detailRoute: '/dashboard/buyer/assigned-prs',
  },
  {
    id: 'deadline',
    label: 'Deadline 7 ngày',
    shortLabel: 'Deadline 7d',
    shortHint: 'Hạn trong tuần hoặc đã quá hạn.',
    accent: 'rose',
    Icon: Timer,
    detailRoute: '/dashboard/buyer/assigned-prs',
  },
];
