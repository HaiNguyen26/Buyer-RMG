import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  ClipboardList,
  FileSearch,
  LayoutGrid,
  Scale,
  ShoppingCart,
} from 'lucide-react';
import { SectionHeader } from '../../buyer-manager/SectionHeader';
import {
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
} from '../../dashboard/DashboardV3Chrome';
import { buyerDashboardKpiIslandPaddingClass } from '../../../constants/buyerLayout';

const islandClass = [
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
  buyerDashboardKpiIslandPaddingClass,
].join(' ');

type QuickLink = {
  label: string;
  path: string;
  Icon: LucideIcon;
  accent: string;
};

const QUICK_LINKS: QuickLink[] = [
  {
    label: 'PR phân công',
    path: '/dashboard/buyer/assigned-prs',
    Icon: ClipboardList,
    accent: 'text-indigo-600 bg-indigo-500/10 ring-indigo-200/50',
  },
  {
    label: 'Quản lý RFQ',
    path: '/dashboard/buyer/rfq',
    Icon: FileSearch,
    accent: 'text-sky-600 bg-sky-500/10 ring-sky-200/50',
  },
  {
    label: 'Báo giá NCC',
    path: '/dashboard/buyer/quotation',
    Icon: ShoppingCart,
    accent: 'text-emerald-600 bg-emerald-500/10 ring-emerald-200/50',
  },
  {
    label: 'So sánh giá',
    path: '/dashboard/buyer/price-comparison',
    Icon: Scale,
    accent: 'text-violet-600 bg-violet-500/10 ring-violet-200/50',
  },
  {
    label: 'Chi phí dự án',
    path: '/dashboard/buyer/project-cost',
    Icon: BarChart3,
    accent: 'text-slate-600 bg-slate-500/10 ring-slate-200/50',
  },
  {
    label: 'Thông báo',
    path: '/dashboard/buyer/notifications',
    Icon: Bell,
    accent: 'text-amber-700 bg-amber-500/10 ring-amber-200/50',
  },
];

type Props = {
  overBudgetAlertCount?: number;
  className?: string;
};

export function BuyerQuickActionsPanel({ overBudgetAlertCount = 0, className = '' }: Props) {
  const navigate = useNavigate();

  return (
    <article className={`${islandClass} flex min-h-[11rem] flex-1 flex-col space-y-3 ${className}`}>
      <SectionHeader
        Icon={LayoutGrid}
        eyebrow="Điều hướng"
        title="Liên kết nhanh"
        description="Mở module chính — không cần qua menu sidebar."
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

      {overBudgetAlertCount > 0 ? (
        <button
          type="button"
          onClick={() => navigate('/dashboard/buyer/price-comparison')}
          className="flex w-full items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2.5 text-left transition hover:bg-amber-50"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
          <span className="min-w-0 flex-1 text-xs text-amber-900">
            <span className="font-bold">{overBudgetAlertCount} cảnh báo vượt ngân sách</span>
            <span className="mt-0.5 block text-amber-800/90">Rà soát tại so sánh báo giá →</span>
          </span>
        </button>
      ) : null}

      <p className="mt-auto rounded-lg border border-dashed border-slate-200/70 bg-slate-50/40 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
        Mẹo: dùng tab hàng đợi bên trái để lọc PR — một danh sách, không cần cuộn nhiều panel.
      </p>
    </article>
  );
}
