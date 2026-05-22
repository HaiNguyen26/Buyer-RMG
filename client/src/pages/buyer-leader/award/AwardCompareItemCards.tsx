/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Boxes,
  ChevronRight,
  Cpu,
  HardDrive,
  Monitor,
  Package,
  Search,
  Star,
  TrendingDown,
  Truck,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  formatQuotationLeadTimeDisplay,
  formatWarrantyDisplay,
  resolveQuotationLineLeadDays,
} from '../../../utils/quotationLeadTime';

type QuotationOption = {
  q: any;
  line: any;
};

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

function formatRating(rating: unknown) {
  const n = Number(rating);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(1);
}

function resolveItemIcon(item: { description?: string; category?: string }): LucideIcon {
  const text = `${item.category ?? ''} ${item.description ?? ''}`.toLowerCase();
  if (/ổ cứng|ssd|hdd|storage|disk|thiết bị lưu/.test(text)) return HardDrive;
  if (/màn hình|monitor|display/.test(text)) return Monitor;
  if (/cpu|processor|bộ xử lý/.test(text)) return Cpu;
  if (/vận chuyển|logistics|ship|giao hàng/.test(text)) return Truck;
  if (/dịch vụ|service|bảo trì|sửa chữa/.test(text)) return Wrench;
  if (/linh kiện|phụ kiện|accessory|vật tư/.test(text)) return Boxes;
  return Package;
}

function firstItemId(list: any[]) {
  return list[0]?.id != null ? String(list[0].id) : null;
}

function AwardCompareItemRow({
  item,
  options,
  selected,
  lowest,
  lowestPrice,
  minLead,
  expanded,
  onToggle,
  approvalMode,
  currency,
  parseLead,
  setSelectedItems,
}: {
  item: any;
  options: QuotationOption[];
  selected: string | undefined;
  lowest: QuotationOption | undefined;
  lowestPrice: number | null;
  minLead: number;
  expanded: boolean;
  onToggle: () => void;
  approvalMode: boolean;
  currency: (amount?: number | null, code?: string) => string;
  parseLead: (leadTime: string | number | null | undefined) => number;
  setSelectedItems: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  const ItemIcon = resolveItemIcon(item);
  const selectedSupplier = options.find((o) => o.q.id === selected)?.q.supplier?.name;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white ring-1 ring-slate-950/[0.03] lg:drop-shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`award-item-details-${item.id}`}
        className="flex w-full flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-indigo-50/30 px-4 py-3.5 text-left transition-colors hover:from-slate-50 hover:to-indigo-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        <div className="flex min-w-0 flex-1 gap-3">
          <span
            className={[
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-slate-500 transition-transform duration-300 ease-in-out',
              expanded ? 'rotate-90' : 'rotate-0',
            ].join(' ')}
            aria-hidden
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/25 ring-1 ring-indigo-400/30">
            <ItemIcon className="h-5 w-5" strokeWidth={2.15} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug text-slate-900">{item.description}</h3>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-medium text-slate-500">
              <span>Số lượng: {item.qty ?? '—'}</span>
              {item.category ? <span>Danh mục: {item.category}</span> : null}
              {selectedSupplier ? (
                <span className="font-semibold text-indigo-700">Đã chọn: {selectedSupplier}</span>
              ) : null}
            </p>
            {!expanded ? (
              <p className="mt-1.5 text-[11px] font-medium text-slate-400">Nhấn để xem báo giá từng NCC</p>
            ) : null}
          </div>
        </div>
        {lowestPrice != null ? (
          <div className="flex shrink-0 flex-col items-end gap-1 sm:pl-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Giá tốt nhất</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-black tabular-nums text-emerald-800 ring-1 ring-emerald-200/80">
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
              {currency(lowestPrice)}
            </span>
          </div>
        ) : null}
      </button>

      <div
        id={`award-item-details-${item.id}`}
        className={[
          'details-wrapper overflow-hidden transition-all duration-300 ease-in-out',
          expanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0',
        ].join(' ')}
        aria-hidden={!expanded}
      >
        <div
          className="grid gap-3 border-t border-slate-100/80 p-4 sm:grid-cols-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {options.map((o) => {
            const isSelected = selected === o.q.id;
            const isLowest = lowest?.q.id === o.q.id;
            const lineLead = resolveQuotationLineLeadDays(o.line, o.q.leadTime) ?? 999;
            const isFastest = lineLead === minLead;
            const rating = formatRating(o.q.supplier?.rating);

            return (
              <button
                key={o.q.id}
                type="button"
                disabled={approvalMode}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItems((prev) => ({ ...prev, [item.id]: o.q.id }));
                }}
                onKeyDown={(e) => e.stopPropagation()}
                className={[
                  'relative rounded-2xl border-2 p-4 text-left transition',
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/40 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/20',
                  approvalMode ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute right-3 top-3 h-5 w-5 rounded-full border-2 transition-colors',
                    isSelected ? 'border-indigo-600 bg-indigo-600 shadow-inner' : 'border-slate-300 bg-white',
                  ].join(' ')}
                  aria-hidden
                />
                <p className="pr-8 text-sm font-black uppercase leading-snug tracking-tight text-slate-900">
                  {o.q.supplier.name}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {isLowest ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200/90 shadow-sm">
                      <TrendingDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                      Giá thấp nhất
                    </span>
                  ) : null}
                  {isFastest ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-800 ring-1 ring-sky-200/90 shadow-sm">
                      <Zap className="h-3.5 w-3.5 shrink-0 fill-sky-400/30" strokeWidth={2.5} aria-hidden />
                      Giao nhanh nhất
                    </span>
                  ) : null}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <dt className="font-medium text-slate-500">Đơn giá</dt>
                    <dd className="font-bold tabular-nums text-slate-900">{currency(o.line.unitPrice)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Bảo hành</dt>
                    <dd className="font-semibold text-slate-800">
                      {formatWarrantyDisplay(o.line?.warrantyMonths ?? o.q.warranty)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Thời gian giao</dt>
                    <dd className="font-semibold text-slate-800">
                      {formatQuotationLeadTimeDisplay(o.q.leadTime, o.line?.leadTimeDays)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Đánh giá</dt>
                    <dd className="inline-flex items-center gap-0.5 font-bold text-amber-700">
                      {rating ? (
                        <>
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                          {rating}
                        </>
                      ) : (
                        '—'
                      )}
                    </dd>
                  </div>
                </dl>
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}

export function AwardCompareItemCards({
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const id = firstItemId(items);
    return id ? new Set([id]) : new Set();
  });

  useEffect(() => {
    const firstId = firstItemId(items);
    if (!firstId) {
      setExpandedIds(new Set());
      return;
    }
    setExpandedIds((prev) => {
      const valid = [...prev].filter((id) => items.some((it) => String(it.id) === id));
      if (valid.length > 0) return new Set(valid);
      return new Set([firstId]);
    });
  }, [items]);

  const toggleItem = (itemId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-900 sm:text-base">
            So sánh NCC
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Mở rộng từng dòng để xem đầy đủ điều khoản, bảo hành và đánh giá NCC.
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Lọc vật tư / dịch vụ..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-medium text-slate-600">
            Không có dòng nào khớp bộ lọc.
          </p>
        ) : (
          items.map((item) => {
            const itemId = String(item.id);
            const options: QuotationOption[] = quotations
              .map((q: any) => ({ q, line: q.items.find((x: any) => x.purchaseRequestItemId === item.id) }))
              .filter((x): x is QuotationOption => Boolean(x.line));

            const selected = selectedItems[item.id];
            const lowest = options.reduce<QuotationOption | undefined>(
              (acc, curr) =>
                !acc || Number(curr.line.unitPrice) < Number(acc.line.unitPrice) ? curr : acc,
              undefined
            );
            const lowestPrice = lowest ? Number(lowest.line.unitPrice) : null;
            const minLead =
              options.length > 0
                ? Math.min(
                    ...options.map(
                      (o) => resolveQuotationLineLeadDays(o.line, o.q.leadTime) ?? 999
                    )
                  )
                : 999;

            return (
              <AwardCompareItemRow
                key={itemId}
                item={item}
                options={options}
                selected={selected}
                lowest={lowest}
                lowestPrice={lowestPrice}
                minLead={minLead}
                expanded={expandedIds.has(itemId)}
                onToggle={() => toggleItem(itemId)}
                approvalMode={approvalMode}
                currency={currency}
                parseLead={parseLead}
                setSelectedItems={setSelectedItems}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
