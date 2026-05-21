import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Package, Plus, Search, Filter, Eye, Edit } from 'lucide-react';
import {
  listMyStockIssues,
  type ListStockIssuesParams,
  type StockIssueDto,
  type StockIssueStatus,
} from '../../services/stockIssueService';
import { AppModal } from '../../components/AppModal';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import { DepartmentPageHero } from '../../components/DepartmentPageHero';
import CustomSelect from '../../components/CustomSelect';
import {
  dashboardV3ErrorCardClass,
  dashboardV3TableHeaderStripClass,
} from '../../components/dashboard/DashboardV3Chrome';
import {
  departmentHeadTableScrollViewportThinBars,
  departmentHeadTableTbodyElevatedClass,
  departmentHeadTableDataRowClasses,
  departmentHeadInteractiveTableFixed880Class,
  departmentHeadInteractiveTableClass,
  departmentHeadTableAccentRailClass,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableCellContentWrapFlexClass,
  departmentHeadTableActionClusterClass,
} from '../../constants/departmentHeadLayout';
import {
  saasTableRootClass,
  saasTableHeadCellClass,
  saasStockIssueBadgeClass,
  saasTableCodeCellClass,
  saasTableIconBtnView,
  saasTableIconBtnEdit,
} from '../../constants/saasDataTable';
import {
  RequestorStockIssueDetailContent,
  type RequestorStockIssueContext,
} from './RequestorStockIssueDetail';

const statusLabel: Record<StockIssueStatus, string> = {
  DRAFT: 'Nháp',
  RESERVED: 'Chờ kho',
  APPROVED: 'Đã duyệt — chờ xuất',
  ISSUED: 'Đã xuất',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'DRAFT', label: statusLabel.DRAFT },
  { value: 'RESERVED', label: statusLabel.RESERVED },
  { value: 'APPROVED', label: statusLabel.APPROVED },
  { value: 'ISSUED', label: statusLabel.ISSUED },
  { value: 'REJECTED', label: statusLabel.REJECTED },
  { value: 'CANCELLED', label: statusLabel.CANCELLED },
  { value: 'RESERVED,APPROVED', label: 'Đang xử lý (chờ kho / chờ xuất)' },
];

function itemsPreview(row: StockIssueDto): string {
  const items = row.items ?? [];
  if (!items.length) return '—';
  const first = items[0];
  const extra = items.length - 1;
  const bit = `${first.partInternalCode} ×${first.qty}`;
  return extra > 0 ? `${bit} +${extra}` : bit;
}

function soDisplay(row: StockIssueDto): string {
  const po = row.salesPO;
  if (!po) return '—';
  return po.salesPONumber || po.customerPONumber || '—';
}

const MyStockIssues = () => {
  const location = useLocation();
  const isDepartmentHead = location.pathname.startsWith('/dashboard/department-head');
  const stockIssuesBase = isDepartmentHead
    ? '/dashboard/department-head/stock-issues'
    : '/dashboard/requestor/stock-issues';
  const stockIssueUiContext: RequestorStockIssueContext = isDepartmentHead ? 'department_head' : 'requestor';

  const [searchParams, setSearchParams] = useSearchParams();
  const detailId = searchParams.get('detail')?.trim() ?? '';

  const closeDetailModal = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('detail');
    setSearchParams(next, { replace: true });
  };

  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [salesPo, setSalesPo] = useState('');

  const listParams = useMemo((): ListStockIssuesParams => {
    const p: ListStockIssuesParams = {};
    if (status.trim()) p.status = status.trim();
    if (from.trim()) p.from = from.trim();
    if (to.trim()) p.to = to.trim();
    if (salesPo.trim()) p.salesPo = salesPo.trim();
    return p;
  }, [status, from, to, salesPo]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-stock-issues', listParams],
    queryFn: () => listMyStockIssues(listParams),
  });

  const issues = data?.issues ?? [];
  const [isTableVisible, setIsTableVisible] = useState(false);
  useEffect(() => {
    if (isLoading) {
      setIsTableVisible(false);
      return;
    }
    const rafId = window.requestAnimationFrame(() => setIsTableVisible(true));
    return () => window.cancelAnimationFrame(rafId);
  }, [isLoading, issues.length]);
  const showTableSkeleton = isLoading || !isTableVisible;
  const deptPageShellClass = 'w-full min-h-full min-w-0 bg-[#f1f5f9]';
  const deptPageContentClass =
    'mx-auto w-full max-w-none min-w-0 space-y-6 px-1 pt-3 pb-4 sm:px-1.5 sm:pt-4 sm:pb-5 md:px-3';
  const deptIslandCard =
    'rounded-2xl border border-slate-200 bg-white ring-1 ring-slate-900/5 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.35)]';
  const deptFilterBarClass =
    'rounded-2xl border border-slate-200/60 bg-white/90 p-4 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/5 backdrop-blur-sm sm:p-5';

  const stockShellClass =
    'flex h-full min-h-0 w-full max-w-none flex-1 flex-col self-stretch bg-[#f1f5f9]';
  const stockContentClass =
    'mx-auto flex h-full min-h-full w-full max-w-[1800px] flex-1 flex-col gap-6 px-2 pt-2 pb-6 sm:px-3 sm:pt-3 sm:pb-7 md:px-6';
  const stockCardClass = 'rounded-2xl border border-slate-200 bg-white ring-1 ring-slate-900/5 shadow-xl shadow-slate-300/65';

  /** Bang + skeleton (Trưởng phòng: giong PRApproval island + scroll viewport.) */
  const stockIssuesDeptTableBlock = (
    <div className="overflow-visible rounded-2xl shadow-[0_16px_30px_-20px_rgba(15,23,42,0.3)]">
      <div className={`${deptIslandCard} flex flex-col overflow-hidden`}>
        <div className="flex-none border-b border-slate-200 bg-[#F8FAFC] px-4 py-3 sm:px-5">
          <p className="text-sm font-semibold text-slate-800">
            Danh sách phiếu{' '}
            <span className="font-normal tabular-nums text-slate-500">({issues.length})</span>
          </p>
        </div>
        <div className={`${departmentHeadTableScrollViewportThinBars} relative shrink-0 bg-white`}>
          {showTableSkeleton && (
            <div className="absolute inset-0 z-20 bg-white">
              <table className={`${departmentHeadInteractiveTableFixed880Class} text-left ${saasTableRootClass}`}>
                <thead className="sticky top-0 z-20 border-b border-slate-200 bg-[#F8FAFC]/95 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Số phiếu
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      SO
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Dòng vật tư
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Trạng thái
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Ngày tạo
                    </th>
                    <th className="border-l border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className={departmentHeadTableTbodyElevatedClass}>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <tr
                      key={`skeleton-${idx}`}
                      className={`h-[72px] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FBFCFE]'}`}
                    >
                      <td colSpan={6} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {issues.length > 0 ? (
            <table
              className={`${departmentHeadInteractiveTableFixed880Class} text-left ${saasTableRootClass}`}
              style={{ visibility: showTableSkeleton ? 'hidden' : 'visible' }}
            >
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[14%]" />
                <col className="w-[26%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="sticky top-0 z-20 border-b border-slate-200 bg-[#F8FAFC]/95 backdrop-blur-sm shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                <tr>
                  <th className={`px-4 py-3 text-left ${saasTableHeadCellClass}`}>Số phiếu</th>
                  <th className={`px-4 py-3 text-left ${saasTableHeadCellClass}`}>SO</th>
                  <th className={`px-4 py-3 text-left ${saasTableHeadCellClass}`}>Dòng vật tư</th>
                  <th className={`px-4 py-3 text-left ${saasTableHeadCellClass}`}>Trạng thái</th>
                  <th className={`px-4 py-3 text-left ${saasTableHeadCellClass}`}>Ngày tạo</th>
                  <th className={`border-l border-slate-200 px-4 py-3 text-right ${saasTableHeadCellClass}`}>Thao tác</th>
                </tr>
              </thead>
              <tbody className={departmentHeadTableTbodyElevatedClass}>
                {issues.map((row, idx) => (
                  <tr key={row.id} className={departmentHeadTableDataRowClasses(idx, { h72: true })}>
                    <td className="relative truncate px-4 py-2 align-middle" title={row.issueNumber}>
                      <div aria-hidden className={departmentHeadTableAccentRailClass} />
                      <div
                        className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass} ${saasTableCodeCellClass} truncate`}
                      >
                        {row.issueNumber}
                      </div>
                    </td>
                    <td
                      className="truncate px-4 py-2 align-middle"
                      title={soDisplay(row)}
                    >
                      <div
                        className={`${departmentHeadTableCellContentWrapClass} font-sans text-[12px] tabular-nums tracking-[-0.01em] text-slate-700`}
                      >
                        {soDisplay(row)}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <div className={departmentHeadTableCellContentWrapClass}>
                        <p className="line-clamp-2 text-slate-700" title={itemsPreview(row)}>
                          {itemsPreview(row)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <div className={departmentHeadTableCellContentWrapClass}>
                        <span className={saasStockIssueBadgeClass(row.status)}>{statusLabel[row.status]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 align-middle tabular-nums text-slate-600">
                      <div className={departmentHeadTableCellContentWrapClass}>
                        {new Date(row.createdAt).toLocaleString('vi-VN')}
                      </div>
                    </td>
                    <td className="border-l border-slate-100 px-3 py-2 align-middle">
                      <div
                        className={`${departmentHeadTableCellContentWrapFlexClass} ml-auto justify-end`}
                      >
                        <div className={departmentHeadTableActionClusterClass}>
                          <Link
                            to={{
                              pathname: stockIssuesBase,
                              search: `?detail=${encodeURIComponent(row.id)}`,
                            }}
                            className={saasTableIconBtnView}
                            title="Xem chi tiết"
                            aria-label="Xem chi tiết"
                          >
                            <Eye className="h-4 w-4" strokeWidth={2} />
                          </Link>
                          {row.status === 'DRAFT' ? (
                            <Link
                              to={`${stockIssuesBase}/${row.id}/edit`}
                              className={saasTableIconBtnEdit}
                              title="Sửa nháp"
                              aria-label="Sửa nháp"
                            >
                              <Edit className="h-4 w-4" strokeWidth={2} />
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              className="flex min-h-[12rem] flex-col items-center justify-center px-6 py-12 text-center"
              style={{ visibility: showTableSkeleton ? 'hidden' : 'visible' }}
            >
              <Package className="mb-3 h-12 w-12 text-slate-300" />
              <p className="text-slate-600">Không có phiếu khớp bộ lọc.</p>
              <Link
                to={`${stockIssuesBase}/create`}
                className="mt-4 text-sm font-semibold text-indigo-700 hover:underline"
              >
                Tạo phiếu mới
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={isDepartmentHead ? deptPageShellClass : stockShellClass}>
      <div className={isDepartmentHead ? deptPageContentClass : stockContentClass}>
        {isDepartmentHead ? (
          <>
            <DepartmentPageHero
              kicker="Trưởng phòng · Xuất kho"
              title="Yêu cầu xuất kho của tôi"
              description="Lọc theo trạng thái, thời gian và SO — theo dõi từng phiếu."
              Icon={Package}
              tint="ocean"
              regionLabel="Yêu cầu xuất kho của tôi"
              rightSlot={
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <div className="rounded-xl border border-white/35 bg-white/15 px-4 py-2 text-center backdrop-blur-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">Phiếu theo lọc</p>
                    <p className="text-2xl font-bold tabular-nums text-white">{issues.length}</p>
                  </div>
                  <Link
                    to={`${stockIssuesBase}/create`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/35 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-white/25"
                  >
                    <Plus className="h-4 w-4" />
                    Tạo phiếu xuất
                  </Link>
                </div>
              }
            />
            <div className={deptFilterBarClass}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
                <div className="flex min-w-0 items-center gap-2 lg:col-span-5">
                  <Filter className="h-5 w-5 shrink-0 text-slate-500" />
                  <CustomSelect
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value || 'all'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </CustomSelect>
                </div>
                <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-slate-600 lg:col-span-2">
                  Từ ngày
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-slate-600 lg:col-span-2">
                  Đến ngày
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </label>
                <div className="relative min-w-0 sm:col-span-2 lg:col-span-3">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                    strokeWidth={1.5}
                  />
                  <input
                    type="search"
                    value={salesPo}
                    onChange={(e) => setSalesPo(e.target.value)}
                    placeholder="Sales PO…"
                    autoComplete="off"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100/80 pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <RequestorPageHero
              kicker="Requestor · Xuất kho"
              title="Yêu cầu xuất kho của tôi"
              description="Lọc theo trạng thái, thời gian và SO — theo dõi từng phiếu."
              Icon={Package}
              tint="ocean"
              regionLabel="Danh sách phiếu xuất kho"
              rightSlot={
                <Link
                  to={`${stockIssuesBase}/create`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/35 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-white/25"
                >
                  <Plus className="h-4 w-4" />
                  Tạo phiếu xuất
                </Link>
              }
            />

            <article className={`flex-none p-4 ${stockCardClass}`}>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-[220px] flex-1 items-center gap-2">
                  <Filter className="h-5 w-5 shrink-0 text-sky-500" />
                  <CustomSelect
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value || 'all'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </CustomSelect>
                </div>
                <label className="flex min-w-[140px] flex-col gap-1 text-xs font-semibold text-slate-600">
                  Từ ngày
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </label>
                <label className="flex min-w-[140px] flex-col gap-1 text-xs font-semibold text-slate-600">
                  Đến ngày
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </label>
                <div className="relative min-w-[220px] flex-[2]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={1.5} />
                  <input
                    type="text"
                    value={salesPo}
                    onChange={(e) => setSalesPo(e.target.value)}
                    placeholder="Tìm theo số Sales PO…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
              </div>
            </article>
          </>
        )}

      {error && (
        <div className={`max-w-lg ${dashboardV3ErrorCardClass}`}>
          <p className="text-lg font-bold text-rose-900">Không tải được danh sách phiếu xuất kho</p>
          <p className="mt-2 text-sm font-medium text-rose-800/90">Vui lòng thử lại sau.</p>
        </div>
      )}

      {!error && (
        <>
          {isDepartmentHead ? (
            stockIssuesDeptTableBlock
          ) : (
        <article className="module-container mb-2 flex min-h-0 flex-1 flex-col overflow-visible rounded-[24px] shadow-[0_20px_44px_-22px_rgba(15,23,42,0.42),0_10px_24px_-16px_rgba(15,23,42,0.28)] sm:mb-3">
          <div className="module-content relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white ring-1 ring-slate-900/5">
          <div className="flex-none border-b border-slate-200 bg-[#F8FAFC] px-6 py-4">
            <h2 className="text-xl font-bold text-slate-900">Danh sách phiếu ({issues.length})</h2>
          </div>
          <div className="relative flex-1 overflow-x-auto overflow-y-visible bg-white [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:h-[5px] [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 [&::-webkit-scrollbar-track]:bg-transparent">
            {showTableSkeleton && (
              <div className="absolute inset-0 z-20 bg-white">
                <table className={`${departmentHeadInteractiveTableClass} text-left ${saasTableRootClass}`}>
                  <thead className={`sticky top-0 z-20 ${dashboardV3TableHeaderStripClass} backdrop-blur-[12px] supports-[backdrop-filter]:bg-[#F8FAFC]/90`}>
                    <tr>
                      <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Số phiếu</th>
                      <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>SO</th>
                      <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Dòng vật tư</th>
                      <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Trạng thái</th>
                      <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Ngày tạo</th>
                      <th className={`bg-[#F8FAFC] px-6 py-3 text-right ${saasTableHeadCellClass}`}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className={departmentHeadTableTbodyElevatedClass}>
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={`skeleton-${idx}`} className={`h-[72px] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FBFCFE]'}`}>
                        <td colSpan={6} className="px-6 py-4">
                          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {issues.length > 0 ? (
              <table
                className={`${departmentHeadInteractiveTableClass} text-left ${saasTableRootClass}`}
                style={{ visibility: showTableSkeleton ? 'hidden' : 'visible' }}
              >
            <thead className={`sticky top-0 z-20 ${dashboardV3TableHeaderStripClass} backdrop-blur-[12px] supports-[backdrop-filter]:bg-[#F8FAFC]/90`}>
              <tr>
                <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Số phiếu</th>
                <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>SO</th>
                <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Dòng vật tư</th>
                <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Trạng thái</th>
                <th className={`bg-[#F8FAFC] px-6 py-3 text-left ${saasTableHeadCellClass}`}>Ngày tạo</th>
                <th className={`bg-[#F8FAFC] px-6 py-3 text-right ${saasTableHeadCellClass}`}>Thao tác</th>
              </tr>
            </thead>
            <tbody className={departmentHeadTableTbodyElevatedClass}>
              {issues.map((row, index) => (
                <tr
                  key={row.id}
                  className={departmentHeadTableDataRowClasses(index, { h72: true })}
                >
                  <td className="relative px-6 py-4">
                    <div aria-hidden className={departmentHeadTableAccentRailClass} />
                    <div
                      className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass} ${saasTableCodeCellClass} min-w-0 truncate`}
                    >
                      {row.issueNumber}
                    </div>
                  </td>
                  <td className="max-w-[140px] truncate px-6 py-4 font-sans text-[12px] tabular-nums tracking-[-0.01em] text-slate-700">
                    <div className={departmentHeadTableCellContentWrapClass}>{soDisplay(row)}</div>
                  </td>
                  <td className="max-w-[240px] truncate px-6 py-4 text-slate-700" title={itemsPreview(row)}>
                    <div className={departmentHeadTableCellContentWrapClass}>{itemsPreview(row)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={departmentHeadTableCellContentWrapClass}>
                      <span className={saasStockIssueBadgeClass(row.status)}>{statusLabel[row.status]}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 tabular-nums text-slate-600">
                    <div className={departmentHeadTableCellContentWrapClass}>
                      {new Date(row.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </td>
                  <td className="border-l border-slate-100 px-4 py-4 text-right">
                    <div
                      className={`${departmentHeadTableCellContentWrapFlexClass} ml-auto justify-end`}
                    >
                      <div className={departmentHeadTableActionClusterClass}>
                        <Link
                          to={{
                            pathname: stockIssuesBase,
                            search: `?detail=${encodeURIComponent(row.id)}`,
                          }}
                          className={saasTableIconBtnView}
                          title="Xem chi tiết"
                          aria-label="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" strokeWidth={2} />
                        </Link>
                        {row.status === 'DRAFT' ? (
                          <Link
                            to={`${stockIssuesBase}/${row.id}/edit`}
                            className={saasTableIconBtnEdit}
                            title="Sửa nháp"
                            aria-label="Sửa nháp"
                          >
                            <Edit className="h-4 w-4" strokeWidth={2} />
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
            ) : (
              <div className="flex min-h-full flex-col items-center justify-center px-6 py-12 text-center" style={{ visibility: showTableSkeleton ? 'hidden' : 'visible' }}>
                <Package className="mb-3 h-12 w-12 text-slate-300" />
                <p className="text-slate-600">Không có phiếu khớp bộ lọc.</p>
                <Link
                  to={`${stockIssuesBase}/create`}
                  className="mt-4 text-sm font-semibold text-blue-600 hover:underline"
                >
                  Tạo phiếu mới
                </Link>
              </div>
            )}
          </div>
          </div>
        </article>
          )}
        </>
      )}

      <AppModal
        open={Boolean(detailId)}
        onClose={closeDetailModal}
        title="Chi tiết phiếu xuất kho"
        subtitle="Theo dõi trạng thái, chỉnh SL khi chờ kho, gửi hoặc hủy phiếu."
        size="wide"
        zIndexClass="z-[200]"
        className="!max-w-3xl"
        description="Chi tiết phiếu xuất kho của bạn."
      >
        {detailId ? (
          <RequestorStockIssueDetailContent issueId={detailId} context={stockIssueUiContext} mode="modal" />
        ) : null}
      </AppModal>
      </div>
    </div>
  );
};

export default MyStockIssues;

