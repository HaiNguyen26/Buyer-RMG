/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { CheckCircle2, Search, TrendingDown, Zap } from 'lucide-react';
import {
  formatQuotationLeadTimeDisplay,
  resolveQuotationLineLeadDays,
} from '../../../utils/quotationLeadTime';

type Props = {
  items: any[];
  quotations: any[];
  selectedItems: Record<string, string>;
  setSelectedItems: Dispatch<SetStateAction<Record<string, string>>>;
  approvalMode: boolean;
  currency: (amount?: number | null, code?: string) => string;
  parseLead: (leadTime: string | number | null | undefined) => number;
  search: string;
  onSearchChange: (value: string) => void;
};

function vendorNameInitials(name: string) {
  const t = name.trim();
  if (!t) return '—';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? '';
    const b = parts[parts.length - 1]?.[0] ?? '';
    return (a + b).toUpperCase() || t.slice(0, 2).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

function lineForItem(q: any, itemId: string) {
  return q.items?.find((x: any) => String(x.purchaseRequestItemId) === String(itemId));
}

export function AwardLineComparisonMatrix({
  items,
  quotations,
  selectedItems,
  setSelectedItems,
  approvalMode,
  currency,
  parseLead,
  search,
  onSearchChange,
}: Props) {
  const columns = useMemo(
    () =>
      [...quotations].sort((a, b) =>
        String(a.supplier?.name ?? '').localeCompare(String(b.supplier?.name ?? ''), 'vi')
      ),
    [quotations]
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item: any) =>
        item.description?.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [items, search]
  );

  const assignedCount = useMemo(
    () => filteredItems.filter((item: any) => Boolean(selectedItems[item.id])).length,
    [filteredItems, selectedItems]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900 sm:text-base">
            So sánh theo từng dòng
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Mỗi hàng là một vật tư — nhấn ô NCC để chọn trao thầu cho dòng đó.
          </p>
          <p className="mt-1 text-xs font-semibold text-indigo-700">
            Đã chọn {assignedCount}/{filteredItems.length} dòng
            {search.trim() ? ' (đang lọc)' : ''}
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Lọc vật tư / dịch vụ..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </header>

      <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800 ring-1 ring-emerald-200/80">
          <TrendingDown className="h-3 w-3" aria-hidden />
          Giá thấp nhất
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-900 ring-1 ring-amber-200/80">
          <Zap className="h-3 w-3" aria-hidden />
          Giao nhanh nhất
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-800 ring-1 ring-indigo-200/80">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Đang chọn
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/90 ring-1 ring-slate-950/[0.04]">
        <div className="max-h-[min(52vh,640px)] overflow-auto [scrollbar-width:thin]">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-30 min-w-[11rem] border-b border-r border-slate-200 bg-slate-50/95 px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 sm:min-w-[14rem]"
                >
                  Dòng hàng
                </th>
                {columns.map((q: any) => (
                  <th
                    key={q.id}
                    scope="col"
                    className="min-w-[7.5rem] border-b border-slate-200 px-2 py-2.5 text-center"
                    title={q.supplier?.name}
                  >
                    <div className="mx-auto flex max-w-[8.5rem] flex-col items-center gap-1">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] font-black text-white shadow-sm">
                        {vendorNameInitials(q.supplier?.name ?? '')}
                      </span>
                      <span className="line-clamp-2 text-[10px] font-bold leading-tight text-slate-800">
                        {q.supplier?.name ?? 'NCC'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-4 py-10 text-center text-sm font-medium text-slate-500"
                  >
                    Không có dòng nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item: any, rowIndex: number) => {
                  const itemId = String(item.id);
                  const selectedQid = selectedItems[item.id];

                  const rowOptions = columns
                    .map((q: any) => ({ q, line: lineForItem(q, itemId) }))
                    .filter((x) => Boolean(x.line));

                  const lowest = rowOptions.reduce<typeof rowOptions[0] | undefined>(
                    (acc, curr) =>
                      !acc || Number(curr.line.unitPrice) < Number(acc.line.unitPrice) ? curr : acc,
                    undefined
                  );
                  const lowestPrice = lowest ? Number(lowest.line.unitPrice) : null;
                  const minLead =
                    rowOptions.length > 0
                      ? Math.min(
                          ...rowOptions.map(
                            (o) => resolveQuotationLineLeadDays(o.line, o.q.leadTime) ?? 999
                          )
                        )
                      : 999;

                  return (
                    <tr key={itemId} className="group border-b border-slate-100 last:border-b-0">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-2.5 text-left align-top group-odd:bg-white group-even:bg-slate-50/40"
                      >
                        <p className="text-[10px] font-bold tabular-nums text-slate-400">#{rowIndex + 1}</p>
                        <p className="mt-0.5 text-xs font-bold leading-snug text-slate-900">{item.description}</p>
                        <p className="mt-1 text-[11px] font-medium text-slate-500">SL: {item.qty ?? '—'}</p>
                        {selectedQid ? (
                          <p className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-700">
                            <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                            Đã chọn
                          </p>
                        ) : (
                          <p className="mt-1 text-[10px] font-semibold text-amber-700">Chưa chọn</p>
                        )}
                      </th>
                      {columns.map((q: any) => {
                        const line = lineForItem(q, itemId);
                        if (!line) {
                          return (
                            <td
                              key={q.id}
                              className="bg-slate-50/60 px-2 py-2 text-center text-xs text-slate-300"
                            >
                              —
                            </td>
                          );
                        }

                        const unitPrice = Number(line.unitPrice);
                        const isSelected = selectedQid === q.id;
                        const isLowest =
                          lowestPrice != null && Number.isFinite(unitPrice) && unitPrice === lowestPrice;
                        const leadDays = resolveQuotationLineLeadDays(line, q.leadTime) ?? 999;
                        const isFastest = leadDays === minLead && rowOptions.length > 1;

                        return (
                          <td key={q.id} className="p-1.5 align-top">
                            <button
                              type="button"
                              disabled={approvalMode}
                              onClick={() =>
                                setSelectedItems((prev) => ({
                                  ...prev,
                                  [item.id]: q.id,
                                }))
                              }
                              className={[
                                'flex w-full min-w-[6.5rem] flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center transition',
                                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
                                isSelected
                                  ? 'border-indigo-500 bg-indigo-50 shadow-sm ring-2 ring-indigo-500/30'
                                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40',
                                approvalMode ? 'cursor-default opacity-70' : 'cursor-pointer',
                              ].join(' ')}
                              aria-pressed={isSelected}
                              aria-label={`Chọn ${q.supplier?.name} cho ${item.description}`}
                            >
                              <span className="font-mono text-xs font-black tabular-nums text-slate-900">
                                {currency(unitPrice)}
                              </span>
                              <span className="text-[10px] font-medium text-slate-500">
                                {formatQuotationLeadTimeDisplay(q.leadTime, line.leadTimeDays)}
                              </span>
                              <div className="flex min-h-[1.125rem] flex-wrap justify-center gap-0.5">
                                {isLowest ? (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1 py-px text-[9px] font-bold text-emerald-800">
                                    <TrendingDown className="h-2.5 w-2.5" aria-hidden />
                                    Giá thấp nhất
                                  </span>
                                ) : null}
                                {isFastest ? (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-px text-[9px] font-bold text-amber-900">
                                    <Zap className="h-2.5 w-2.5" aria-hidden />
                                    Giao nhanh nhất
                                  </span>
                                ) : null}
                              </div>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
