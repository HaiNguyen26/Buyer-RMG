import type { LucideIcon } from 'lucide-react';
import { Radar } from 'lucide-react';
import type { RequestorPageHeroTint } from '../../components/RequestorPageHero';
import type { MonitorApiBase } from '../../services/procurementMonitoringService';

export type ProcurementHeroConfig = {
  kicker: string;
  title: string;
  description: string;
  tint: RequestorPageHeroTint;
  regionLabel: string;
  Icon: LucideIcon;
};

export const PROCUREMENT_MONITOR_HERO: Record<MonitorApiBase, ProcurementHeroConfig> = {
  'buyer-manager': {
    kicker: 'Trưởng phòng Mua hàng · Vận hành',
    title: 'Giám sát mua hàng',
    description:
      'Trung tâm vận hành — không phải báo cáo: theo dõi PR nghẽn, PO trễ, buyer, NCC và SLA mua hàng.',
    tint: 'ocean',
    regionLabel: 'Giám sát mua hàng',
    Icon: Radar,
  },
  'branch-manager': {
    kicker: 'Giám đốc chi nhánh · Vận hành',
    title: 'Giám sát mua hàng',
    description:
      'Theo dõi tiến độ mua hàng chi nhánh — luồng xử lý, trễ giao, mua lại và ngoại lệ ngân sách chờ duyệt.',
    tint: 'graphite',
    regionLabel: 'Giám sát mua hàng chi nhánh',
    Icon: Radar,
  },
  'department-head': {
    kicker: 'Trưởng phòng · Phòng ban',
    title: 'Giám sát mua hàng',
    description:
      'Giám sát PR/PO đội trực tiếp — ai đang xử lý, bước nào kẹt, có quá SLA hay cần mua lại.',
    tint: 'violet',
    regionLabel: 'Giám sát mua hàng phòng ban',
    Icon: Radar,
  },
  manager: {
    kicker: 'Quản lý · Vận hành',
    title: 'Giám sát mua hàng',
    description:
      'Trung tâm giám sát vận hành — sức khỏe mua hàng: kẹt luồng, SLA, buyer theo dõi, giao NCC.',
    tint: 'azure',
    regionLabel: 'Giám sát mua hàng',
    Icon: Radar,
  },
};
