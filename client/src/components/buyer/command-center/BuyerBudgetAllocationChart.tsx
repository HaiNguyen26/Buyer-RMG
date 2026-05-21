import { BarChart3, Inbox } from 'lucide-react';
import { SectionHeader } from '../../buyer-manager/SectionHeader';
import {
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
} from '../../dashboard/DashboardV3Chrome';
import { buyerDashboardKpiIslandPaddingClass } from '../../../constants/buyerLayout';
import { formatVndInteger } from '../../../utils/vndInputFormat';
import type { BuyerBudgetSegment } from './buyerCommandCenterTypes';

const islandClass = [
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
  buyerDashboardKpiIslandPaddingClass,
].join(' ');

type Props = {
  segments: BuyerBudgetSegment[];
  totalVnd: number;
  prCount: number;
  hasAmounts: boolean;
};

export function BuyerBudgetAllocationChart({ segments, totalVnd, prCount, hasAmounts }: Props) {
  const empty = prCount === 0 || segments.length === 0;

  return (
    <article className={`${islandClass} flex h-full flex-col space-y-3`}>
      <SectionHeader
        Icon={BarChart3}
        eyebrow="Tài chính"
        title="Phân bổ ngân sách PR"
        description={
          empty
            ? 'Chưa có PR được phân công — biểu đồ hiển thị khi có dữ liệu.'
            : hasAmounts
              ? `Theo phòng ban · ${prCount} PR · tổng từ trường totalAmount API.`
              : `Theo phòng ban · ${prCount} PR (chưa có tổng tiền trên PR).`
        }
        stackDescription
      />

      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/70 bg-slate-50/40 px-4 py-8 text-center">
          <Inbox className="mb-2 h-8 w-8 text-slate-300" strokeWidth={1.5} />
          <p className="text-sm font-medium text-slate-600">Chưa có dữ liệu phân bổ</p>
        </div>
      ) : (
        <>
          <div
            className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100/90 ring-1 ring-slate-200/50"
            role="img"
            aria-label="Biểu đồ phân bổ theo phòng ban"
          >
            {segments.map((s) =>
              s.percent > 0 ? (
                <div
                  key={s.id}
                  className={`${s.barClass} transition-[width] duration-500`}
                  style={{ width: `${s.percent}%` }}
                  title={`${s.label}: ${s.percent}%`}
                />
              ) : null
            )}
          </div>

          <ul className="space-y-2.5">
            {segments.map((s) => (
              <li key={s.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 font-medium text-slate-700">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${s.dotClass}`} aria-hidden />
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-600">
                    <span className="font-bold text-slate-900">{s.percent}%</span>
                    {hasAmounts && s.amountVnd > 0 ? (
                      <span className="ml-1 hidden text-slate-500 sm:inline">
                        · {formatVndInteger(s.amountVnd)} ₫
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${s.barClass} transition-[width] duration-500`}
                    style={{ width: `${Math.max(s.percent, 2)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {hasAmounts && totalVnd > 0 ? (
            <p className="mt-auto border-t border-slate-200/60 pt-2 text-[11px] text-slate-500">
              Tổng giá trị PR:{' '}
              <span className="font-semibold text-slate-800">{formatVndInteger(totalVnd)} ₫</span>
            </p>
          ) : null}
        </>
      )}
    </article>
  );
}
