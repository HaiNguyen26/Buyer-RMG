import { AlertTriangle, ClipboardList, Handshake, ShoppingCart } from 'lucide-react';
import type { BuyerLeaderWorkQueueTabDef } from './buyerLeaderCommandCenterTypes';

export const BUYER_LEADER_WORK_QUEUE_TABS: BuyerLeaderWorkQueueTabDef[] = [
  {
    id: 'pending_assign',
    label: 'PR chờ phân công',
    shortLabel: 'Phân công',
    shortHint: 'PR đã duyệt — sẵn sàng giao Buyer.',
    accent: 'indigo',
    Icon: ClipboardList,
    detailRoute: '/dashboard/buyer-leader/pending-assignments',
  },
  {
    id: 'rfq_active',
    label: 'PR đang RFQ',
    shortLabel: 'RFQ',
    shortHint: 'RFQ đang hỏi giá hoặc thu báo giá.',
    accent: 'sky',
    Icon: ShoppingCart,
    detailRoute: '/dashboard/buyer-leader/rfq-monitoring',
  },
  {
    id: 'compare',
    label: 'Chờ chọn NCC',
    shortLabel: 'Chọn NCC',
    shortHint: 'Đủ báo giá — chờ so sánh và quyết định NCC.',
    accent: 'violet',
    Icon: Handshake,
    detailRoute: '/dashboard/buyer-leader/compare-queue',
  },
  {
    id: 'over_budget',
    label: 'PR vượt giá',
    shortLabel: 'Vượt giá',
    shortHint: 'Chờ Giám đốc chi nhánh xem xét ngân sách.',
    accent: 'rose',
    Icon: AlertTriangle,
    detailRoute: '/dashboard/buyer-leader/over-budget-prs',
  },
];
