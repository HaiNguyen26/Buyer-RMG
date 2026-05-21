import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  approveStockIssue,
  getStockIssueWarehouse,
  rejectStockIssue,
  shipStockIssue,
  type StockIssueDto,
  type StockIssueStatus,
} from '../../services/stockIssueService';
import { useToast } from '../../contexts/ToastContext';
import { ArrowLeft, CheckCircle, Package, XCircle } from 'lucide-react';
import {
  departmentHeadInteractiveTableClass,
  departmentHeadTableAccentRailClass,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableDataRowClasses,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableTbodyElevatedClass,
} from '../../constants/departmentHeadLayout';
import {
  saasStockIssueBadgeClass,
  saasTableCodeCellClass,
  saasTableHeadCellClass,
  saasTableRootClass,
} from '../../constants/saasDataTable';

const statusLabel: Record<StockIssueStatus, string> = {
  DRAFT: 'Nháp',
  RESERVED: 'Chờ duyệt',
  APPROVED: 'Đã duyệt — chờ xuất',
  ISSUED: 'Đã xuất',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

function lineSnapshot(data: StockIssueDto | undefined): string {
  if (!data?.items?.length) return '';
  return data.items.map((i) => `${i.id}:${i.qtyShipped ?? 0}:${i.qty}`).join('|');
}

export type WarehouseStockIssueDetailProps = {
  issueId: string;
  /** Đóng modal / quay lại danh sách (sau từ chối hoặc khi gọi từ ngoài) */
  onDismiss?: () => void;
  /** true: có nút quay lại danh sách (trang độc lập); false: chỉ nội dung trong modal */
  showListLink?: boolean;
};

export function WarehouseStockIssueDetailContent({
  issueId,
  onDismiss,
  showListLink = false,
}: WarehouseStockIssueDetailProps) {
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');
  const [shipByLine, setShipByLine] = useState<Record<string, string>>({});
  const DETAIL_ROWS_VISIBLE = 8;
  const detailTableViewportHeightPx = 44 + DETAIL_ROWS_VISIBLE * 56;

  const { data, isLoading, error } = useQuery({
    queryKey: ['warehouse-stock-issue', issueId],
    queryFn: () => getStockIssueWarehouse(issueId),
    enabled: !!issueId,
  });

  const snap = useMemo(() => lineSnapshot(data), [data]);

  useEffect(() => {
    if (!data?.items) return;
    const m: Record<string, string> = {};
    for (const it of data.items) {
      const rem = Math.max(0, it.qty - (it.qtyShipped ?? 0));
      m[it.id] = rem > 0 ? String(rem) : '';
    }
    setShipByLine(m);
  }, [issueId, snap]);

  const invalidateWarehouse = () => {
    queryClient.invalidateQueries({ queryKey: ['warehouse-stock-issue', issueId] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-stock-issues'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-dashboard'] });
  };

  const approveMut = useMutation({
    mutationFn: () => approveStockIssue(issueId),
    onSuccess: () => {
      invalidateWarehouse();
      showSuccess('Đã duyệt phiếu.');
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: string } } };
      showError(ax.response?.data?.error || 'Lỗi duyệt.');
    },
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectStockIssue(issueId, rejectReason.trim() || 'Từ chối'),
    onSuccess: () => {
      invalidateWarehouse();
      showSuccess('Đã từ chối — đã nhả giữ chỗ.');
      onDismiss?.();
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: string } } };
      showError(ax.response?.data?.error || 'Lỗi.');
    },
  });

  const shipMut = useMutation({
    mutationFn: (payload: { items?: { itemId: string; qty: number }[] }) =>
      shipStockIssue(issueId, { items: payload.items }),
    onSuccess: (res) => {
      invalidateWarehouse();
      if (res.status === 'ISSUED') {
        showSuccess('Hoàn tất xuất kho cho phiếu.');
      } else {
        showSuccess('Đã ghi nhận xuất (còn dòng chưa đủ).');
      }
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: string } } };
      showError(ax.response?.data?.error || 'Lỗi xuất.');
    },
  });

  const handleShipPartial = () => {
    if (!data?.items) return;
    const items: { itemId: string; qty: number }[] = [];
    for (const it of data.items) {
      const raw = shipByLine[it.id];
      const q = raw === undefined || raw === '' ? 0 : Number(raw);
      if (!Number.isFinite(q) || q <= 0) continue;
      items.push({ itemId: it.id, qty: q });
    }
    if (!items.length) {
      showError('Nhập số lượng xuất cho ít nhất một dòng.');
      return;
    }
    shipMut.mutate({ items });
  };

  const handleShipAllRemaining = () => {
    if (window.confirm('Xuất toàn bộ số lượng còn lại trên mọi dòng?')) {
      shipMut.mutate({});
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-slate-500">Đang tải…</div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
        Không tìm thấy phiếu.
        {showListLink ? (
          <>
            {' '}
            <Link to="/dashboard/warehouse/stock-issues" className="font-semibold underline">
              Quay lại
            </Link>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {showListLink ? (
        <Link
          to="/dashboard/warehouse/stock-issues"
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Danh sách phiếu
        </Link>
      ) : null}

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{data.issueNumber}</h2>
            <p className="text-sm text-slate-500">
              {data.requestor?.fullName || data.requestor?.username} ·{' '}
              {new Date(data.createdAt).toLocaleString('vi-VN')}
            </p>
            {data.purchaseRequest ? (
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-semibold">PR:</span>{' '}
                <span className="font-mono">{data.purchaseRequest.prNumber}</span>
                {data.purchaseRequest.projectCode || data.purchaseRequest.projectName ? (
                  <span className="text-slate-500">
                    {' '}
                    · Dự án:{' '}
                    {[data.purchaseRequest.projectCode, data.purchaseRequest.projectName]
                      .filter(Boolean)
                      .join(' — ')}
                  </span>
                ) : null}
              </p>
            ) : null}
            {data.salesPO ? (
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-semibold">SO:</span>{' '}
                <span className="font-mono">{data.salesPO.salesPONumber}</span>
                {data.salesPO.customerPONumber ? (
                  <span className="text-slate-500"> · PO khách: {data.salesPO.customerPONumber}</span>
                ) : null}
              </p>
            ) : null}
          </div>
          <span className={saasStockIssueBadgeClass(data.status)}>
            {statusLabel[data.status]}
          </span>
        </div>

        {data.purpose ? <p className="mt-4 text-sm text-slate-700">{data.purpose}</p> : null}

        <h3 className="mt-6 flex items-center gap-2 text-sm font-bold text-slate-600">
          <Package className="h-4 w-4" />
          Chi tiết dòng — yêu cầu / đã giữ / đã xuất
        </h3>

        <div
          className="mt-3 overflow-hidden rounded-2xl border border-slate-100"
          style={{ minHeight: detailTableViewportHeightPx }}
        >
          <div
            className="overflow-auto [scrollbar-width:thin]"
            style={{
              height: detailTableViewportHeightPx,
              minHeight: detailTableViewportHeightPx,
              maxHeight: detailTableViewportHeightPx,
            }}
          >
          <table className={`${departmentHeadInteractiveTableClass} ${saasTableRootClass} min-w-[780px] text-left`}>
            <thead className="bg-slate-50/95 backdrop-blur-sm">
              <tr>
                <th className={`${saasTableHeadCellClass} sticky top-0 z-[1] border-b border-slate-200 px-3 py-2`}>Mã vật tư</th>
                <th className={`${saasTableHeadCellClass} sticky top-0 z-[1] border-b border-slate-200 px-3 py-2`}>Tên</th>
                <th className={`${saasTableHeadCellClass} sticky top-0 z-[1] border-b border-slate-200 px-3 py-2 text-right`}>Yêu cầu</th>
                <th className={`${saasTableHeadCellClass} sticky top-0 z-[1] border-b border-slate-200 px-3 py-2 text-right`}>Đã giữ</th>
                <th className={`${saasTableHeadCellClass} sticky top-0 z-[1] border-b border-slate-200 px-3 py-2 text-right`}>Đã xuất</th>
                {data.status === 'APPROVED' ? (
                  <th className={`${saasTableHeadCellClass} sticky top-0 z-[1] border-b border-slate-200 px-3 py-2 text-right`}>Xuất lần này</th>
                ) : null}
              </tr>
            </thead>
            <tbody className={departmentHeadTableTbodyElevatedClass}>
              {data.items.map((it, index) => {
                const reserved = it.reservedQty ?? 0;
                const shipped = it.qtyShipped ?? 0;
                const rem = Math.max(0, it.qty - shipped);
                return (
                  <tr key={it.id} className={departmentHeadTableDataRowClasses(index, { h72: true })}>
                    <td className={`relative px-3 py-2 ${saasTableCodeCellClass}`}>
                      <div aria-hidden className={departmentHeadTableAccentRailClass} />
                      <div className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass}`}>
                        {it.partInternalCode}
                      </div>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-slate-600">
                      <div className={`${departmentHeadTableCellContentWrapClass} truncate`}>
                        {it.partName || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      <div className={departmentHeadTableCellContentWrapClass}>
                        {it.qty} {it.unit || ''}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      <div className={departmentHeadTableCellContentWrapClass}>{reserved}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-700">
                      <div className={departmentHeadTableCellContentWrapClass}>{shipped}</div>
                    </td>
                    {data.status === 'APPROVED' ? (
                      <td className="px-3 py-2 text-right">
                        {rem > 0 ? (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            className="ml-auto w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm shadow-sm"
                            value={shipByLine[it.id] ?? ''}
                            onChange={(e) =>
                              setShipByLine((prev) => ({ ...prev, [it.id]: e.target.value }))
                            }
                            title={`Tối đa ${rem}`}
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-6">
          {data.status === 'RESERVED' && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={approveMut.isPending}
                onClick={() => approveMut.mutate()}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                Duyệt
              </button>
              <div className="flex flex-1 flex-wrap items-end gap-2">
                <input
                  className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm"
                  placeholder="Lý do từ chối"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <button
                  type="button"
                  disabled={rejectMut.isPending}
                  onClick={() => rejectMut.mutate()}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Từ chối
                </button>
              </div>
            </div>
          )}

          {data.status === 'APPROVED' && (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                disabled={shipMut.isPending}
                onClick={handleShipPartial}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                <Package className="h-4 w-4" />
                Ghi nhận xuất (theo cột “Xuất lần này”)
              </button>
              <button
                type="button"
                disabled={shipMut.isPending}
                onClick={handleShipAllRemaining}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Xuất hết phần còn lại
              </button>
            </div>
          )}

          {(data.status === 'REJECTED' || data.status === 'ISSUED' || data.status === 'CANCELLED') && (
            <p className="text-sm text-slate-500">Phiếu đã kết thúc luồng xử lý.</p>
          )}
        </div>
      </div>
    </div>
  );
}
