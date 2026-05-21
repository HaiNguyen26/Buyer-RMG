import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Handshake,
  Layers3,
  ClipboardList,
  Scale,
  Search,
  ShoppingCart,
  X,
} from 'lucide-react';
import { buyerLeaderService } from '../../services/buyerLeaderService';
import { BuyerLeaderPageHero } from '../../components/BuyerLeaderPageHero';
import {
  DashboardV3ShimmerBlock,
  dashboardV3PageBgClass,
  dashboardV3IslandClass,
  dashboardV3IslandOpaqueClass,
  dashboardV3StackYClass,
  dashboardV3ErrorCardClass,
} from '../../components/dashboard/DashboardV3Chrome';
import {
  departmentHeadInteractiveTableClass,
  departmentHeadTableAccentRailClass,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableCellContentWrapFlexClass,
  departmentHeadDashboardDataRowInteractive,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableTbodyElevatedClass,
} from '../../constants/departmentHeadLayout';

/** Shell theo cong thuc table cu: wrapper gon, de surface quan ly bo goc + shadow. */
const COMPARISON_QUEUE_TABLE_SHELL_CLASS = 'relative w-full min-h-0 overflow-visible';

/** Surface theo cong thuc V3 cu: bo goc 24/3xl + border slate + shadow ambient. */
const COMPARISON_QUEUE_TABLE_SURFACE_CLASS =
  'relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_24px_46px_-24px_rgba(15,23,42,0.38)] ring-1 ring-slate-900/5';

const fmtMoney = (n: number | null | undefined, cur = 'VND') => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: cur }).format(Number(n));
};

type BaselineFilter = '' | 'OK' | 'OVER' | 'OTHER';

type RfqComparisonRow = { prDepartment?: string | null };

/**
 * Hub workspace so sánh báo giá · chọn NCC — cùng pattern filter + bảng với Phân công PR (PendingAssignments).
 */
const ComparisonQueue = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterBaseline, setFilterBaseline] = useState<BaselineFilter>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['buyer-leader-rfqs-for-comparison', 'queue'],
    queryFn: () => buyerLeaderService.getRFQsForComparison(),
    staleTime: 15_000,
  });

  const openRfqs = useMemo(() => {
    return data?.rfqs ?? [];
  }, [data?.rfqs]);

  const closedRfqs = data?.closedRfqs ?? [];

  const departmentOptions = useMemo((): string[] => {
    const vals = (openRfqs as RfqComparisonRow[])
      .map((r) => (r.prDepartment || '').trim())
      .filter((s): s is string => s.length > 0);
    return Array.from(new Set(vals)).sort((a, b) => a.localeCompare(b));
  }, [openRfqs]);

  const filteredOpenRfqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return openRfqs.filter((rfq: any) => {
      const matchesSearch =
        !q ||
        (rfq.rfqNumber && String(rfq.rfqNumber).toLowerCase().includes(q)) ||
        (rfq.prNumber && String(rfq.prNumber).toLowerCase().includes(q)) ||
        (rfq.buyer?.username && String(rfq.buyer.username).toLowerCase().includes(q)) ||
        (rfq.prDepartment && String(rfq.prDepartment).toLowerCase().includes(q)) ||
        (rfq.status && String(rfq.status).toLowerCase().includes(q));

      const dept = (rfq.prDepartment || '').trim();
      const matchesDept = !filterDepartment || dept === filterDepartment;

      let matchesBaseline = true;
      if (filterBaseline === 'OK') matchesBaseline = rfq.budgetStatus === 'OK';
      else if (filterBaseline === 'OVER') matchesBaseline = rfq.budgetStatus === 'OVER';
      else if (filterBaseline === 'OTHER')
        matchesBaseline = rfq.budgetStatus !== 'OK' && rfq.budgetStatus !== 'OVER';

      return matchesSearch && matchesDept && matchesBaseline;
    });
  }, [openRfqs, searchQuery, filterDepartment, filterBaseline]);

  const hasFilters = Boolean(searchQuery.trim() || filterDepartment || filterBaseline);

  if (isLoading) {
    return (
      <div
        className={`flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden px-2 pb-4 pt-3 sm:px-3 sm:pb-5 sm:pt-4 md:px-4 ${dashboardV3PageBgClass} ${dashboardV3StackYClass}`}
      >
        <DashboardV3ShimmerBlock className="h-28 w-full shrink-0" />
        <DashboardV3ShimmerBlock className="h-20 w-full shrink-0" />
        <DashboardV3ShimmerBlock className="min-h-0 flex-1" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex h-full min-w-0 w-full items-center justify-center px-3 py-6 sm:px-4 ${dashboardV3PageBgClass}`}
      >
        <div className={`max-w-lg ${dashboardV3ErrorCardClass}`}>
          <p className="text-lg font-bold text-slate-900">Lỗi khi tải dữ liệu</p>
          <p className="mt-2 text-sm text-slate-600">Vui lòng thử lại sau.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden ${dashboardV3PageBgClass}`}
    >
      <div className={`shrink-0 space-y-4 px-2 pt-3 sm:px-3 sm:pt-4 md:px-4 ${dashboardV3StackYClass}`}>
      <BuyerLeaderPageHero
        kicker="Buyer Leader · RFQ"
        title="Chọn NCC"
        description="Đối chiếu báo giá theo RFQ và quyết định nhà cung cấp trong workspace."
        Icon={Handshake}
        tint="azure"
        regionLabel="Chọn NCC"
        className="min-w-0 shrink-0"
        rightSlot={
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/25 bg-white/10 px-3 py-2 backdrop-blur-sm sm:gap-3 sm:px-4 sm:py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white sm:h-10 sm:w-10">
              <ClipboardList className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums text-white sm:text-2xl">{filteredOpenRfqs.length}</p>
              <p className="text-[11px] font-medium text-sky-100 sm:text-xs">RFQ hiển thị</p>
            </div>
          </div>
        }
      />

      {/* Smart filter bar — giống Phân công PR (docs §8.2) */}
      <div className="rounded-2xl border border-slate-200/60 bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative lg:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã RFQ, PR, Buyer, phòng ban..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100/80 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100/80 px-3 text-sm text-slate-700 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">Tất cả phòng ban</option>
            {departmentOptions.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          <select
            value={filterBaseline}
            onChange={(e) => setFilterBaseline(e.target.value as BaselineFilter)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100/80 px-3 text-sm text-slate-700 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">Baseline — tất cả</option>
            <option value="OK">Trong ngân sách (OK)</option>
            <option value="OVER">Vượt ngân sách</option>
            <option value="OTHER">Chưa xác định</option>
          </select>
        </div>
        {hasFilters ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterDepartment('');
                setFilterBaseline('');
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.2} />
              Xóa bộ lọc
            </button>
          </div>
        ) : null}
      </div>
      </div>

      {/* Bảng chiếm phần cao còn lại viewport — cuộn trong surface (parity PendingAssignments). */}
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-3 sm:px-3 sm:pb-4 md:px-4 ${COMPARISON_QUEUE_TABLE_SHELL_CLASS}`}
      >
        <div className={`${COMPARISON_QUEUE_TABLE_SURFACE_CLASS} flex min-h-0 flex-1 flex-col`}>
          <div
            className="relative z-10 min-h-0 min-w-0 w-full flex-1 overflow-y-auto overflow-x-auto rounded-3xl pb-[env(safe-area-inset-bottom,0px)] [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:h-[6px] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 [&::-webkit-scrollbar-track]:bg-transparent"
          >
          <table
            className={`${departmentHeadInteractiveTableClass} table-fixed min-w-[980px] text-left text-sm`}
          >
            <colgroup>
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[14%]" />
              <col className="w-[8%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[34%]" />
            </colgroup>
            <thead>
              <tr className="sticky top-0 z-20 border-b border-slate-200 bg-[#F8FAFC]">
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  RFQ
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  PR
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Buyer
                </th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Báo giá
                </th>
                <th scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Tiền tốt nhất
                </th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Baseline
                </th>
                <th
                  scope="col"
                  className="bg-[#F8FAFC] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600"
                >
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className={departmentHeadTableTbodyElevatedClass}>
              {openRfqs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <ShoppingCart className="mx-auto mb-3 h-12 w-12 text-slate-300" strokeWidth={1.5} />
                    <p className="font-medium text-slate-500">Không có RFQ nào đang chờ so sánh</p>
                    <p className="mt-2 text-sm text-slate-400">
                      Theo dõi trên{' '}
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard/buyer-leader/rfq-monitoring')}
                        className="font-semibold text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
                      >
                        Giám sát RFQ
                      </button>
                    </p>
                  </td>
                </tr>
              ) : filteredOpenRfqs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <Search className="mx-auto mb-3 h-12 w-12 text-slate-300" strokeWidth={1.5} />
                    <p className="font-medium text-slate-500">Không có RFQ nào phù hợp bộ lọc</p>
                  </td>
                </tr>
              ) : (
                filteredOpenRfqs.map((rfq: any, index: number) => {
                  return (
                  <tr key={rfq.id} className={`group h-[72px] ${departmentHeadDashboardDataRowInteractive(index)}`}>
                    <td className="relative px-4 py-3 align-top">
                      <div aria-hidden className={departmentHeadTableAccentRailClass} />
                      <div className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass}`}>
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-1">
                            <p className="truncate font-mono text-sm font-bold text-indigo-800">{rfq.rfqNumber}</p>
                          </div>
                          <p className="truncate text-[11px] text-slate-500">{rfq.status}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className={departmentHeadTableCellContentWrapClass}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{rfq.prNumber}</p>
                          {rfq.prDepartment ? (
                            <p className="truncate text-[11px] text-slate-500">{rfq.prDepartment}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-slate-700">
                      <div className={`${departmentHeadTableCellContentWrapFlexClass} items-center gap-2`}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-800 ring-1 ring-indigo-200/80">
                          {String(rfq.buyer?.username ?? '?')[0].toUpperCase()}
                        </span>
                        <span className="min-w-0 truncate">{rfq.buyer?.username ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-center text-sm font-semibold tabular-nums text-slate-900">
                      <div className={departmentHeadTableCellContentWrapClass}>{rfq.quotationsCount}</div>
                    </td>
                    <td className="px-4 py-3 align-middle text-sm font-bold text-slate-900">
                      <div className={departmentHeadTableCellContentWrapClass}>{fmtMoney(rfq.minAmount, rfq.prCurrency)}</div>
                    </td>
                    <td className="px-4 py-3 align-middle text-center">
                      <div className={`${departmentHeadTableCellContentWrapFlexClass} justify-center`}>
                        {rfq.budgetStatus === 'OVER' ? (
                          <span className="inline-flex rounded-full border border-rose-200 bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">
                            Vượt
                          </span>
                        ) : rfq.budgetStatus === 'OK' ? (
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            OK
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <div className={`${departmentHeadTableCellContentWrapFlexClass} justify-center gap-2`}>
                        <button
                          type="button"
                          onClick={() => {
                            navigate(`/dashboard/buyer-leader/compare-quotations/${rfq.id}/compare`);
                          }}
                          className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
                        >
                          So sánh
                          <Scale className="h-3 w-3" strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigate(`/dashboard/buyer-leader/compare-quotations/${rfq.id}/allocation`);
                          }}
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-50"
                        >
                          Phân bổ
                          <Layers3 className="h-3 w-3" strokeWidth={2.5} />
                        </button>
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

      {closedRfqs.length > 0 && (
        <article
          className={`${dashboardV3IslandClass} ${dashboardV3IslandOpaqueClass} mx-2 mb-3 min-w-0 shrink-0 p-5 sm:mx-3 sm:mb-4 sm:p-6 md:mx-4 md:p-8`}
        >
          <h3 className="mb-4 text-base font-bold text-slate-900">RFQ đã đóng (xem lại)</h3>
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
            <div className="max-h-[min(16rem,40dvh)] overflow-auto [scrollbar-width:thin]">
              <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[35%]" />
                  <col className="w-[30%]" />
                  <col className="w-[35%]" />
                </colgroup>
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-slate-200 bg-[#F8FAFC]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">RFQ</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">PR</th>
                    <th className="bg-[#F8FAFC] px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {closedRfqs.slice(0, 20).map((rfq: any, idx: number) => (
                    <tr
                      key={rfq.id}
                      className={`h-[72px] border-b border-slate-100 transition-colors hover:bg-slate-50/80 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-[#FBFCFE]'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800">{rfq.rfqNumber}</td>
                      <td className="px-4 py-3 text-slate-700">{rfq.prNumber}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/buyer-leader/compare-quotations/${rfq.id}/compare`)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          Mở workspace
                          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </article>
      )}
    </div>
  );
};

export default ComparisonQueue;





