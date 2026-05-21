import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { salesService } from '../../services/salesService';
import {
  ArrowLeft,
  LayoutDashboard,
  ListOrdered,
  Coins,
  ScrollText,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { dashboardPageContentBottomClass } from '../../constants/dashboardLayout';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'prs', label: 'PR List', icon: ListOrdered },
  { id: 'cost', label: 'Cost Tracking', icon: Coins },
  { id: 'activity', label: 'Activity Log', icon: ScrollText },
] as const;

type TabId = (typeof TABS)[number]['id'];

function soStatusLabel(status: string) {
  if (status === 'DRAFT') return 'Draft';
  if (status === 'ACTIVE') return 'In Progress';
  if (status === 'CLOSED') return 'Completed';
  return status;
}

function prStatusShort(status: string) {
  const m: Record<string, string> = {
    DRAFT: 'Nháp',
    PAYMENT_DONE: 'Đã thanh toán',
    SUPPLIER_SELECTED: 'Chọn NCC',
    PO_ISSUED: 'Đã phát hành PO',
    PO_PENDING: 'Chờ PO',
    RFQ_IN_PROGRESS: 'RFQ',
    ASSIGNED_TO_BUYER: 'Đã giao Buyer',
    BUYER_LEADER_PENDING: 'Chờ BL',
    CLOSED: 'Đóng',
    CANCELLED: 'Hủy',
  };
  return m[status] ?? status.replace(/_/g, ' ');
}

function progressBarClass(pct: number, delayed: boolean) {
  if (delayed) return 'bg-rose-500';
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 30) return 'bg-amber-400';
  return 'bg-slate-300';
}

/** Giá trị hợp đồng / SO Sales luôn hiển thị theo VND */
function formatSalesContractVND(amount: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

const SalesOrderWorkspace = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as TabId | null;
  const [tab, setTab] = useState<TabId>(
    TABS.some((t) => t.id === tabFromUrl) ? (tabFromUrl as TabId) : 'overview'
  );

  useEffect(() => {
    if (tabFromUrl && TABS.some((t) => t.id === tabFromUrl)) {
      setTab(tabFromUrl as TabId);
    }
  }, [tabFromUrl]);

  const setTabAndUrl = (t: TabId) => {
    setTab(t);
    setSearchParams(t === 'overview' ? {} : { tab: t }, { replace: true });
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sales-so-workspace', id],
    queryFn: () => salesService.getSalesPOWorkspace(id!),
    enabled: !!id,
  });

  const header = useMemo(() => {
    if (!data) return null;
    const { salesPO: sp, overview: ov } = data;
    return {
      title: `${sp.salesPONumber}`,
      subtitle: sp.projectName || '—',
      customer: sp.customer?.name ?? '—',
      owner: sp.salesOwner?.name ?? '—',
      status: sp.status,
      delayed: ov.isDelayed,
    };
  }, [data]);

  if (!id) {
    return <p className="text-slate-500">Thiếu mã SO.</p>;
  }

  if (isLoading) {
    return (
      <div className="animate-pulse w-full min-w-0 space-y-4">
        <div className="h-10 bg-slate-200 rounded-lg w-1/2" />
        <div className="h-32 bg-slate-100 rounded-xl" />
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (isError || !data || !header) {
    return (
      <div className="space-y-4">
        <p className="text-rose-600">Không tải được SO hoặc bạn không có quyền xem.</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard/sales/orders')}
          className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          Về danh sách
        </button>
      </div>
    );
  }

  const { salesPO: sp, overview: ov, purchaseRequests, costLines, activityLog } = data;
  const itemPct = ov.itemProgressPercent;
  const barClass = progressBarClass(itemPct, ov.isDelayed);

  return (
    <div className={`w-full min-w-0 space-y-6 ${dashboardPageContentBottomClass}`}>
      <button
        type="button"
        onClick={() => navigate('/dashboard/sales/orders')}
        className="p-2.5 text-slate-600 hover:bg-white rounded-xl border border-slate-200 shrink-0 animate-fade-in-right fade-in-right-delay-0"
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="page-banner page-banner-tint-warm animate-fade-in-right fade-in-right-stagger-1">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="page-banner-icon-box bg-gradient-to-br from-amber-500 to-orange-600 text-white ring-white/40">
            <FileText className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="page-banner-kicker text-amber-800/80">Sales Order</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="page-banner-title">{header.title}</h1>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <span className="text-base font-semibold text-slate-800 sm:text-lg">{header.subtitle}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>
                <span className="text-slate-500">Customer</span>{' '}
                <span className="font-medium text-slate-800">{header.customer}</span>
              </span>
              <span>
                <span className="text-slate-500">Owner</span>{' '}
                <span className="font-medium text-slate-800">{header.owner}</span>
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                  sp.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : sp.status === 'CLOSED'
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {soStatusLabel(header.status)}
              </span>
              {ov.isDelayed && (
                <span className="text-xs font-medium text-rose-600">Trễ deadline giao hàng</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 flex gap-1 overflow-x-auto animate-fade-in-right fade-in-right-stagger-2">
        {TABS.map(({ id: tid, label, icon: Icon }) => (
          <button
            key={tid}
            type="button"
            onClick={() => setTabAndUrl(tid)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === tid
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="w-4 h-4" strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div key="tab-overview" className="space-y-6 animate-premium-fade stagger-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Tổng PR', value: String(ov.totalPR) },
              { label: 'Tổng dòng hàng', value: String(ov.totalItems) },
              {
                label: 'Đã chốt mua (dòng)',
                value: `${ov.itemsCompleted} (${itemPct}%)`,
              },
              {
                label: 'Tổng chi phí (thanh toán)',
                value: `${ov.totalCost.toLocaleString('vi-VN')} ${sp.currency}`,
              },
            ].map((c, idx) => (
              <div
                key={c.label}
                className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm ${
                  idx === 0
                    ? 'slide-right-card-1'
                    : idx === 1
                      ? 'slide-right-card-2'
                      : idx === 2
                        ? 'slide-right-card-3'
                        : 'slide-right-card-4'
                }`}
              >
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {c.label}
                </p>
                <p className="mt-2 text-lg font-bold text-slate-900">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6 slide-right-content">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Tiến độ mua theo dòng hàng</span>
                <span className="text-slate-600">{itemPct}%</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barClass}`}
                  style={{ width: `${itemPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Xanh: tiến độ tốt · Vàng: đang xử lý · Đỏ: trễ deadline dự án
              </p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Chờ xử lý (ước lượng)</span>
                <span className="text-slate-600">{ov.waitingPercent}%</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-300 transition-all"
                  style={{ width: `${ov.waitingPercent}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">
                  Ngân sách hợp đồng đã dùng (chi phí / giá trị SO)
                </span>
                <span className="text-slate-600">{ov.budgetUsagePercent}%</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.min(100, ov.budgetUsagePercent)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Giá trị SO: {formatSalesContractVND(ov.contractValue)}
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'prs' && (
        <div
          key="tab-prs"
          className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm animate-premium-fade stagger-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">PR</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Người tạo</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Dòng</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Trạng thái</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Buyer</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Progress</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Chưa có PR nào gắn SO. Team tạo PR và chọn SO này trong hệ thống.
                    </td>
                  </tr>
                ) : (
                  purchaseRequests.map((pr) => (
                    <tr key={pr.id} className="hover:bg-amber-50/40">
                      <td className="px-4 py-3 font-medium text-slate-900">{pr.prNumber}</td>
                      <td className="px-4 py-3 text-slate-700">{pr.requestorName}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{pr.itemCount}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
                          {prStatusShort(pr.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{pr.buyerName}</td>
                      <td className="px-4 py-3 w-40">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${pr.progressPercent}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-8">{pr.progressPercent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/dashboard/sales/pr?focus=${encodeURIComponent(pr.prNumber)}`
                            )
                          }
                          className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 text-xs font-medium"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          PR
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cost' && (
        <div key="tab-cost" className="space-y-4 animate-premium-fade stagger-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">PR</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Part / Mô tả</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Qty</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600">Cost</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {costLines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Chưa có dòng chi phí từ PR (chưa có line item hoặc chưa nhập giá).
                      </td>
                    </tr>
                  ) : (
                    costLines.map((row, idx) => (
                      <tr key={`${row.prNumber}-${idx}`} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium text-slate-800">{row.prNumber}</td>
                        <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={row.part}>
                          {row.part}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.qty}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">
                          {row.cost.toLocaleString('vi-VN')} {row.currency}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              row.source === 'Stock'
                                ? 'bg-violet-100 text-violet-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {row.source}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-slate-900 text-white rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-slate-300">Total cost (đã thanh toán)</span>
            <span className="text-xl font-bold">
              {ov.totalCost.toLocaleString('vi-VN')} {sp.currency}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Source: <strong>Purchase</strong> khi có giá trị dòng; <strong>Stock</strong> khi giá 0
            (ước tính nội bộ — có thể tinh chỉnh khi module kho sẵn sàng).
          </p>
        </div>
      )}

      {tab === 'activity' && (
        <div
          key="tab-activity"
          className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-sm animate-premium-fade stagger-0"
        >
          {activityLog.length === 0 ? (
            <p className="p-6 text-slate-500 text-center">Chưa có sự kiện.</p>
          ) : (
            activityLog.map((ev, i) => (
              <div
                key={`${ev.at}-${i}`}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4"
              >
                <time className="text-xs text-slate-400 shrink-0 w-44 tabular-nums">
                  {new Date(ev.at).toLocaleString('vi-VN')}
                </time>
                <p className="text-sm text-slate-800 flex-1">{ev.message}</p>
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                  {ev.kind}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SalesOrderWorkspace;
