import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bell,
  ClipboardList,
  FileQuestion,
  Handshake,
  LayoutGrid,
  Scale,
} from 'lucide-react';
import { SectionHeader } from '../../buyer-manager/SectionHeader';
import {
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
} from '../../dashboard/DashboardV3Chrome';
import { buyerLeaderDashboardKpiIslandPaddingClass } from '../../../constants/buyerLeaderLayout';

const islandClass = [
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
  buyerLeaderDashboardKpiIslandPaddingClass,
].join(' ');

type QuickLink = {
  label: string;
  path: string;
  Icon: LucideIcon;
  accent: string;
};

const QUICK_LINKS: QuickLink[] = [
  {
    label: 'Phân công PR',
    path: '/dashboard/buyer-leader/pending-assignments',
    Icon: ClipboardList,
    accent: 'text-indigo-600 bg-indigo-500/10 ring-indigo-200/50',
  },
  {
    label: 'Giám sát RFQ',
    path: '/dashboard/buyer-leader/rfq-monitoring',
    Icon: FileQuestion,
    accent: 'text-sky-600 bg-sky-500/10 ring-sky-200/50',
  },
  {
    label: 'Chọn NCC',
    path: '/dashboard/buyer-leader/compare-queue',
    Icon: Handshake,
    accent: 'text-violet-600 bg-violet-500/10 ring-violet-200/50',
  },
  {
    label: 'Theo dõi PR',
    path: '/dashboard/buyer-leader/pr-tracking',
    Icon: Activity,
    accent: 'text-emerald-600 bg-emerald-500/10 ring-emerald-200/50',
  },
  {
    label: 'Vượt ngân sách',
    path: '/dashboard/buyer-leader/over-budget-prs',
    Icon: Scale,
    accent: 'text-rose-600 bg-rose-500/10 ring-rose-200/50',
  },
  {
    label: 'Thông báo',
    path: '/dashboard/buyer-leader/notifications',
    Icon: Bell,
    accent: 'text-amber-700 bg-amber-500/10 ring-amber-200/50',
  },
];

export function BuyerLeaderQuickActionsPanel() {
  const navigate = useNavigate();

  return (
    <article className={`${islandClass} flex min-h-[11rem] flex-1 flex-col space-y-3`}>
      <SectionHeader
        Icon={LayoutGrid}
        eyebrow="Điều hướng"
        title="Liên kết nhanh"
        description="Mở module chính — không lặp CTA trong từng panel."
        stackDescription
      />

      <div className="grid flex-1 grid-cols-2 content-start gap-2">
        {QUICK_LINKS.map((link) => {
          const Icon = link.Icon;
          return (
            <button
              key={link.path}
              type="button"
              onClick={() => navigate(link.path)}
              className="flex items-center gap-2 rounded-xl border border-slate-200/65 bg-white/55 px-2.5 py-2.5 text-left transition hover:border-indigo-200/55 hover:bg-white/90 hover:shadow-sm sm:px-3"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${link.accent}`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <span className="text-xs font-semibold leading-tight text-slate-800 sm:text-sm">{link.label}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-auto rounded-lg border border-dashed border-slate-200/70 bg-slate-50/40 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
        Mẹo: tab hàng đợi bên trái gắn số liệu — một danh sách, không tách KPI riêng.
      </p>
    </article>
  );
}
