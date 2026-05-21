import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Truck } from 'lucide-react';
import {
  warehouseService,
  type IncomingLineDisplayStatus,
  type IncomingPOLineRow,
} from '../../services/warehouseService';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import { roleDashboardPanelCardClass } from '../../constants/roleDashboardLayout';
import {
  warehouseWorkspacePageContentClass,
  warehouseWorkspacePageShellClass,
  warehouseWorkspaceTableOuterClass,
  warehouseWorkspaceTableRegionClass,
  warehouseWorkspaceTableScrollClass,
  warehouseWorkspaceTableSurfaceClass,
} from '../../constants/warehouseLayout';
import {
  departmentHeadInteractiveTableClass,
  departmentHeadTableAccentRailClass,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableDataRowClasses,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableTbodyElevatedClass,
} from '../../constants/departmentHeadLayout';
import {
  saasTableCodeCellClass,
  saasTableHeadCellClass,
  saasTableRootClass,
} from '../../constants/saasDataTable';

function formatDisplayDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const DISPLAY_STATUS: Record<
  IncomingLineDisplayStatus,
  { label: string; className: string }
> = {
  AwaitingConfirm: {
    label: 'Chờ confirm',
    className: 'bg-slate-100 text-slate-800',
  },
  Incoming: {
    label: 'Incoming',
    className: 'bg-emerald-100 text-emerald-900',
  },
  Delayed: {
    label: 'Delayed',
    className: 'bg-rose-100 text-rose-900 ring-1 ring-rose-200',
  },
  Partial: {
    label: 'Partial',
    className: 'bg-sky-100 text-sky-900',
  },
  Received: {
    label: 'Received',
    className: 'bg-slate-100 text-slate-600',
  },
};

const STATUS_PRIORITY: IncomingLineDisplayStatus[] = [
  'Delayed',
  'Partial',
  'AwaitingConfirm',
  'Incoming',
  'Received',
];

function shortItemLabel(line: IncomingPOLineRow): string {
  const part = line.partNo?.trim();
  if (part) return part;
  const raw = line.itemLabel.trim();
  const tail = raw.includes('·') ? raw.split('·').pop()?.trim() : raw;
  return tail && tail.length <= 48 ? tail : raw.length > 40 ? `${raw.slice(0, 38)}…` : raw;
}

function summarizeItems(lines: IncomingPOLineRow[]): string {
  if (lines.length === 0) return '—';
  const names = lines.map(shortItemLabel);
  if (lines.length === 1) return names[0];
  if (lines.length === 2) return `${names[0]}, ${names[1]}`;
  return `${names[0]}, ${names[1]} +${lines.length - 2}`;
}

function summarizeEta(lines: IncomingPOLineRow[]): string {
  const isoDates = [
    ...new Set(lines.map((l) => l.expectedDate).filter((d): d is string => Boolean(d?.trim()))),
  ].sort();
  if (isoDates.length === 0) return '—';
  const formatted = isoDates.map(formatDisplayDate);
  if (formatted.length === 1) return formatted[0];
  return `${formatted[0]} – ${formatted[formatted.length - 1]}`;
}

function formatPoReceivedProgress(
  poId: string,
  progressMap: Record<string, { received: number; cap: number }>
): string {
  const p = progressMap[poId];
  if (!p || p.cap <= 0) return '—';
  const r = Math.round(p.received * 1000) / 1000;
  const c = Math.round(p.cap * 1000) / 1000;
  return `${r}/${c}`;
}

function summarizeStatusBadge(lines: IncomingPOLineRow[]): {
  badge: (typeof DISPLAY_STATUS)[IncomingLineDisplayStatus];
  hint?: string;
} {
  for (const key of STATUS_PRIORITY) {
    const matched = lines.filter((l) => l.displayStatus === key);
    if (matched.length === 0) continue;
    const badge = DISPLAY_STATUS[key];
    const distinct = new Set(lines.map((l) => l.displayStatus)).size;
    return {
      badge,
      hint: distinct > 1 ? `${matched.length}/${lines.length} dòng` : undefined,
    };
  }
  return { badge: DISPLAY_STATUS.Incoming };
}

const IncomingPurchaseOrders = () => {
  const [vendor, setVendor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<'all' | 'pending' | 'partial' | 'delayed'>('all');

  const queryParams = useMemo(
    () => ({
      ...(vendor.trim() ? { vendor: vendor.trim() } : {}),
      ...(from.trim() ? { from: from.trim() } : {}),
      ...(to.trim() ? { to: to.trim() } : {}),
      status,
    }),
    [vendor, from, to, status]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['warehouse-incoming-pos', queryParams],
    queryFn: () => warehouseService.listIncomingPOs(queryParams),
  });

  const rows = data?.rows ?? [];
  const poGrns = data?.poGrns ?? {};
  const poProgress = data?.poProgress ?? {};

  /** Gộp dòng theo PO — tránh hiển thị trùng mã PO như nhiều đơn khác nhau. */
  const poGroups = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = map.get(r.poId) ?? [];
      list.push(r);
      map.set(r.poId, list);
    }
    return Array.from(map.values())
      .map((lines) => [...lines].sort((a, b) => a.lineNo - b.lineNo))
      .sort((a, b) => (a[0]?.poNumber ?? '').localeCompare(b[0]?.poNumber ?? '', 'vi'));
  }, [rows]);

  const poCount = poGroups.length;
  const lineCount = rows.length;
  const INCOMING_PO_ROWS_VISIBLE = 10;
  const incomingPoTableViewportHeight = `calc(2.75rem + ${INCOMING_PO_ROWS_VISIBLE} * 3.5rem)`;
  const compactTable = poCount <= INCOMING_PO_ROWS_VISIBLE;

  return (
    <div className={warehouseWorkspacePageShellClass}>
      <div className={warehouseWorkspacePageContentClass}>
        <RequestorPageHero
          kicker="Kho · Incoming"
          title="PO chờ nhận"
          description="Incoming queue — một dòng một PO. Tiến độ Received; Tạo GRN hoặc xem chi tiết PO."
          Icon={Truck}
          tint="cyan"
          regionLabel="Danh sách PO chờ nhận"
        />

        <div
          className={`flex min-w-0 shrink-0 flex-wrap items-end gap-3 ${roleDashboardPanelCardClass}`}
        >
          <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
            Nhà cung cấp / mã
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500/30 focus:ring-2"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Lọc theo tên hoặc code NCC"
            />
          </label>
          <label className="flex min-w-[120px] flex-col gap-1 text-xs font-medium text-slate-600">
            Từ ngày (ETA dòng)
            <input
              type="date"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500/30 focus:ring-2"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="flex min-w-[120px] flex-col gap-1 text-xs font-medium text-slate-600">
            Đến ngày
            <input
              type="date"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500/30 focus:ring-2"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label className="flex min-w-[160px] flex-col gap-1 text-xs font-medium text-slate-600">
            Trạng thái
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-teal-500/30 focus:ring-2"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="all">Tất cả (còn việc nhận)</option>
              <option value="pending">SENT / CONFIRMED (chưa nhận dở)</option>
              <option value="partial">Partial (đã nhận một phần)</option>
              <option value="delayed">Delayed (quá ETA)</option>
            </select>
          </label>
        </div>

        <div className={warehouseWorkspaceTableRegionClass}>
          <div className={warehouseWorkspaceTableOuterClass}>
            <div className={warehouseWorkspaceTableSurfaceClass}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">Đang tải…</div>
          ) : error ? (
            <div className="p-6 text-center text-red-600">Không tải được danh sách PO.</div>
          ) : lineCount === 0 ? (
            <div className="p-8 text-center text-slate-500">Không có PO nào phù hợp bộ lọc.</div>
          ) : (
            <div
              className={
                compactTable
                  ? `${warehouseWorkspaceTableScrollClass} overflow-x-auto`
                  : `${warehouseWorkspaceTableScrollClass} overflow-auto`
              }
              style={compactTable ? undefined : { maxHeight: incomingPoTableViewportHeight }}
            >
              {poCount > 0 ? (
                <p className="border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-xs font-medium text-slate-600">
                  <span className="font-semibold text-slate-800">{poCount}</span> PO
                  <span className="mx-1.5 text-slate-300" aria-hidden>
                    ·
                  </span>
                  <span className="font-semibold text-slate-800">{lineCount}</span> dòng vật tư
                </p>
              ) : null}
              <table className={`${departmentHeadInteractiveTableClass} ${saasTableRootClass} min-w-[920px] text-left`}>
                <thead className="bg-slate-50/95 backdrop-blur-sm">
                  <tr>
                    <th className={`${saasTableHeadCellClass} sticky top-0 z-10 border-b border-slate-200 px-4 py-3`}>
                      PO
                    </th>
                    <th className={`${saasTableHeadCellClass} sticky top-0 z-10 border-b border-slate-200 px-4 py-3`}>
                      Vendor
                    </th>
                    <th className={`${saasTableHeadCellClass} sticky top-0 z-10 border-b border-slate-200 px-4 py-3 whitespace-nowrap`}>
                      ETA
                    </th>
                    <th className={`${saasTableHeadCellClass} sticky top-0 z-10 border-b border-slate-200 px-4 py-3 whitespace-nowrap tabular-nums`}>
                      Received
                    </th>
                    <th className={`${saasTableHeadCellClass} sticky top-0 z-10 border-b border-slate-200 px-4 py-3`}>
                      Status
                    </th>
                    <th className={`${saasTableHeadCellClass} sticky top-0 z-10 border-b border-slate-200 px-4 py-3 text-right`}>
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className={departmentHeadTableTbodyElevatedClass}>
                  {poGroups.map((group, index) => {
                    const head = group[0];
                    const { badge, hint: statusHint } = summarizeStatusBadge(group);
                    const linkedGrns = poGrns[head.poId] ?? [];
                    return (
                      <tr
                        key={head.poId}
                        className={departmentHeadTableDataRowClasses(index, { h72: true })}
                      >
                        <td className={`relative px-4 py-3 ${saasTableCodeCellClass}`}>
                          <div aria-hidden className={departmentHeadTableAccentRailClass} />
                          <div
                            className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass}`}
                          >
                            <div className="font-semibold">{head.poNumber}</div>
                            <div
                              className="mt-0.5 truncate text-[11px] text-slate-500"
                              title={group.map((l) => l.itemLabel).join(' · ')}
                            >
                              {summarizeItems(group)}
                            </div>
                            {linkedGrns.length > 0 ? (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {linkedGrns.map((g) => (
                                  <Link
                                    key={g.id}
                                    to={`/dashboard/warehouse/grn-history?grn=${encodeURIComponent(g.id)}`}
                                    className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-800"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {g.grnNumber}
                                  </Link>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <div
                            className={`${departmentHeadTableCellContentWrapClass} truncate text-sm text-slate-800`}
                            title={head.vendor}
                          >
                            {head.vendor}
                            {head.vendorCode ? (
                              <span className="text-slate-500"> ({head.vendorCode})</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-800">
                          <span title={group.map((l) => formatDisplayDate(l.expectedDate)).join(', ')}>
                            {summarizeEta(group)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold tabular-nums text-slate-800">
                          {formatPoReceivedProgress(head.poId, poProgress)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                            {statusHint ? (
                              <span className="font-normal opacity-80">{statusHint}</span>
                            ) : null}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <Link
                              to={`/dashboard/warehouse/incoming/${head.poId}/view`}
                              className="inline-flex shrink-0 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              Xem PO
                            </Link>
                            <Link
                              to={`/dashboard/warehouse/incoming/${head.poId}/grn`}
                              className="inline-flex shrink-0 whitespace-nowrap rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700"
                            >
                              Tạo GRN
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingPurchaseOrders;
