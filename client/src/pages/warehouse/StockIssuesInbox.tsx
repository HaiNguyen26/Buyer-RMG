import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  ClipboardList,
  Eye,
  FileText,
  Package,
  ScrollText,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import {
  listWarehouseStockIssues,
  type ListStockIssuesParams,
  type StockIssueDto,
  type StockIssueStatus,
} from '../../services/stockIssueService';
import { AppModal } from '../../components/AppModal';
import { WarehouseStockIssueDetailContent } from './WarehouseStockIssueDetail';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import { roleDashboardPanelCardClass } from '../../constants/roleDashboardLayout';
import {
  warehouseStockIssuesTableViewportHeight,
  warehouseWorkspacePageContentScrollClass,
  warehouseWorkspacePageShellScrollClass,
  warehouseWorkspaceTableOuterFixedClass,
  warehouseWorkspaceTableRegionFixedClass,
  warehouseWorkspaceTableSurfaceFixedClass,
} from '../../constants/warehouseLayout';
import {
  departmentHeadInteractiveTableClass,
  departmentHeadTableAccentRailClass,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableCellContentWrapFlexClass,
  departmentHeadTableDataRowClasses,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableTbodyElevatedClass,
} from '../../constants/departmentHeadLayout';
import {
  saasTableCodeCellClass,
  saasTableHeadCellClass,
  saasTableRootClass,
  saasStockIssueBadgeClass,
} from '../../constants/saasDataTable';

const statusLabel: Record<StockIssueStatus, string> = {
  DRAFT: 'Nháp',
  RESERVED: 'Chờ duyệt',
  APPROVED: 'Đã duyệt — chờ xuất',
  ISSUED: 'Đã xuất',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

type TabId = 'pending' | 'approved' | 'completed';

const TAB_CONFIG: { id: TabId; label: string; status: string }[] = [
  { id: 'pending', label: 'Chờ xử lý', status: 'RESERVED' },
  { id: 'approved', label: 'Đã duyệt — chờ xuất', status: 'APPROVED' },
  { id: 'completed', label: 'Đã đóng', status: 'ISSUED,REJECTED,CANCELLED' },
];

function CellWithIcon({
  icon: Icon,
  iconClassName = 'text-slate-400',
  align = 'left',
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  align?: 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <span
      className={['inline-flex min-w-0 max-w-full items-center gap-2', align === 'right' ? 'ml-auto justify-end' : ''].join(
        ' '
      )}
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} aria-hidden />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

function itemCountMeta(row: StockIssueDto): {
  count: number;
  totalQty: number;
  hint: string | null;
  title: string;
} {
  const items = row.items ?? [];
  if (!items.length) {
    return { count: 0, totalQty: 0, hint: null, title: 'Không có item' };
  }
  const count = items.length;
  const totalQty = items.reduce((sum, line) => sum + (Number(line.qty) || 0), 0);
  const first = items[0];
  const hint =
    count === 1 ? `${first.partInternalCode} ×${first.qty}` : `${first.partInternalCode}…`;
  const title =
    count === 1
      ? `1 item · ${first.partInternalCode} ×${first.qty}`
      : `${count} item · tổng SL ${totalQty.toLocaleString('vi-VN')} · ${items.map((i) => i.partInternalCode).join(', ')}`;
  return { count, totalQty, hint, title };
}

function soDisplay(row: StockIssueDto): string {
  const po = row.salesPO;
  if (!po) return '—';
  return po.salesPONumber || po.customerPONumber || '—';
}

const StockIssuesInbox = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const detailId = searchParams.get('detail')?.trim() ?? '';

  const closeDetailModal = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('detail');
    setSearchParams(next, { replace: true });
  };

  const [tab, setTab] = useState<TabId>('pending');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [salesPo, setSalesPo] = useState('');

  const statusParam = TAB_CONFIG.find((t) => t.id === tab)?.status ?? 'RESERVED';

  const listParams = useMemo((): ListStockIssuesParams => {
    const p: ListStockIssuesParams = { status: statusParam };
    if (from.trim()) p.from = from.trim();
    if (to.trim()) p.to = to.trim();
    if (salesPo.trim()) p.salesPo = salesPo.trim();
    return p;
  }, [statusParam, from, to, salesPo]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['warehouse-stock-issues', listParams],
    queryFn: () => listWarehouseStockIssues(listParams),
  });

  const issues = data?.issues ?? [];

  return (
    <div className={warehouseWorkspacePageShellScrollClass}>
      <div className={warehouseWorkspacePageContentScrollClass}>
        <RequestorPageHero
          kicker="Phiếu xuất kho · Warehouse"
          title="Quản lý phiếu xuất kho"
          description="Duyệt, từ chối hoặc ghi nhận xuất kho theo từng phiếu; chi tiết mở trong modal."
          Icon={ClipboardList}
          tint="cyan"
          regionLabel="Danh sách phiếu xuất kho"
        />

        <div className={`flex flex-wrap gap-2 p-2 ${roleDashboardPanelCardClass}`}>
        {TAB_CONFIG.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'bg-teal-600 text-white shadow'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
        </div>

        <div
          className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end ${roleDashboardPanelCardClass}`}
        >
        <label className="flex min-w-[140px] flex-col gap-1 text-xs font-semibold text-slate-600">
          Từ ngày
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex min-w-[140px] flex-col gap-1 text-xs font-semibold text-slate-600">
          Đến ngày
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">
          SO / mã PO khách
          <input
            type="text"
            value={salesPo}
            onChange={(e) => setSalesPo(e.target.value)}
            placeholder="Lọc theo Sales PO…"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        </div>

        <div className={warehouseWorkspaceTableRegionFixedClass}>
          <div className={warehouseWorkspaceTableOuterFixedClass}>
            <div className={warehouseWorkspaceTableSurfaceFixedClass}>
              <div
                className="overflow-x-auto overflow-y-auto bg-white [scrollbar-width:thin]"
                style={{
                  height: warehouseStockIssuesTableViewportHeight,
                  maxHeight: warehouseStockIssuesTableViewportHeight,
                }}
              >
                <table
                  className={`${departmentHeadInteractiveTableClass} ${saasTableRootClass} min-w-[980px] text-left`}
                >
                  <thead className="bg-slate-50/95 backdrop-blur-sm">
                    <tr>
                      <th
                        className={`${saasTableHeadCellClass} sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-3`}
                      >
                        Mã phiếu
                      </th>
                      <th
                        className={`${saasTableHeadCellClass} sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-3`}
                      >
                        Người yêu cầu
                      </th>
                      <th
                        className={`${saasTableHeadCellClass} sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-3`}
                      >
                        SO
                      </th>
                      <th
                        className={`${saasTableHeadCellClass} sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-3`}
                      >
                        Số item
                      </th>
                      <th
                        className={`${saasTableHeadCellClass} sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-3`}
                      >
                        Trạng thái
                      </th>
                      <th
                        className={`${saasTableHeadCellClass} sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-3`}
                      >
                        Ngày
                      </th>
                      <th
                        className={`${saasTableHeadCellClass} sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-3 text-right`}
                      />
                    </tr>
                  </thead>
                  <tbody className={departmentHeadTableTbodyElevatedClass}>
                    {isLoading ? (
                      <tr className="h-[72px] bg-white">
                        <td colSpan={7} className="px-4 py-3 text-center text-slate-500">
                          Đang tải…
                        </td>
                      </tr>
                    ) : error ? (
                      <tr className="h-[72px] bg-white">
                        <td colSpan={7} className="px-4 py-3 text-center text-red-600">
                          Không tải được danh sách.
                        </td>
                      </tr>
                    ) : issues.length === 0 ? (
                      <tr className="h-[72px] bg-white">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex h-full items-center justify-center gap-2 text-slate-500">
                            <ClipboardList className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
                            <span>Không có phiếu trong tab này.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      issues.map((row, index) => {
                        const { count: itemCount, totalQty, hint, title: itemTitle } =
                          itemCountMeta(row);
                        const so = soDisplay(row);
                        const requestorName =
                          row.requestor?.fullName || row.requestor?.username || '—';
                        const createdLabel = new Date(row.createdAt).toLocaleString('vi-VN');

                        return (
                          <tr
                            key={row.id}
                            className={departmentHeadTableDataRowClasses(index, { h72: true })}
                          >
                            <td className={`relative px-4 py-3 ${saasTableCodeCellClass}`}>
                              <div aria-hidden className={departmentHeadTableAccentRailClass} />
                              <div
                                className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass}`}
                              >
                                <CellWithIcon icon={FileText} iconClassName="text-teal-600/85">
                                  <span className="font-semibold text-slate-900">
                                    {row.issueNumber}
                                  </span>
                                </CellWithIcon>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className={departmentHeadTableCellContentWrapClass}>
                                <CellWithIcon icon={UserRound} iconClassName="text-slate-500/85">
                                  {requestorName}
                                </CellWithIcon>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div
                                className={departmentHeadTableCellContentWrapClass}
                                title={so}
                              >
                                <CellWithIcon icon={ScrollText} iconClassName="text-violet-500/75">
                                  <span className="font-mono text-xs text-slate-700">{so}</span>
                                </CellWithIcon>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div
                                className={departmentHeadTableCellContentWrapClass}
                                title={itemTitle}
                              >
                                {itemCount === 0 ? (
                                  <span className="text-slate-400">—</span>
                                ) : (
                                  <CellWithIcon icon={Package} iconClassName="text-amber-600/80">
                                    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 ring-1 ring-slate-200/80">
                                        <span className="font-bold tabular-nums text-slate-900">
                                          {itemCount}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-600">
                                          item
                                        </span>
                                      </span>
                                      {itemCount > 1 ? (
                                        <span className="text-xs text-slate-500 tabular-nums">
                                          · {totalQty.toLocaleString('vi-VN')} SL
                                        </span>
                                      ) : null}
                                      {hint ? (
                                        <span className="max-w-[10rem] truncate text-xs text-slate-500">
                                          {hint}
                                        </span>
                                      ) : null}
                                    </span>
                                  </CellWithIcon>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className={departmentHeadTableCellContentWrapClass}>
                                <span className={saasStockIssueBadgeClass(row.status)}>
                                  {statusLabel[row.status]}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className={departmentHeadTableCellContentWrapClass}>
                                <CellWithIcon icon={Calendar} iconClassName="text-slate-500/80">
                                  <span className="tabular-nums text-slate-700">
                                    {createdLabel}
                                  </span>
                                </CellWithIcon>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div
                                className={`${departmentHeadTableCellContentWrapFlexClass} justify-end`}
                              >
                                <Link
                                  to={{
                                    pathname: '/dashboard/warehouse/stock-issues',
                                    search: `?detail=${encodeURIComponent(row.id)}`,
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50"
                                >
                                  <Eye className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                                  Chi tiết
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AppModal
        open={Boolean(detailId)}
        onClose={closeDetailModal}
        title="Chi tiết phiếu xuất kho"
        subtitle="Duyệt, từ chối hoặc ghi nhận xuất — lưới phía sau vẫn hiển thị."
        size="wide"
        zIndexClass="z-[200]"
        className="!rounded-3xl shadow-2xl ring-1 ring-slate-200/70"
        description="Chi tiết phiếu xuất kho kho."
      >
        {detailId ? (
          <WarehouseStockIssueDetailContent issueId={detailId} onDismiss={closeDetailModal} />
        ) : null}
      </AppModal>
    </div>
  );
};

export default StockIssuesInbox;
