import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  cancelStockIssue,
  getPartStockAvailability,
  getStockIssueRequestor,
  patchStockIssueItemQty,
  submitStockIssue,
  type StockIssueStatus,
} from '../../services/stockIssueService';
import { useToast } from '../../contexts/ToastContext';
import { ArrowLeft, Ban, Send, Package } from 'lucide-react';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import { requestorPageStackClass } from '../../constants/requestorLayout';
import { useEffect, useState } from 'react';

const statusLabel: Record<StockIssueStatus, string> = {
  DRAFT: 'Nháp',
  RESERVED: 'Chờ kho',
  APPROVED: 'Đã duyệt — chờ xuất',
  ISSUED: 'Đã xuất',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy',
};

export type RequestorStockIssueContext = 'requestor' | 'department_head';

function listPath(ctx: RequestorStockIssueContext): string {
  return ctx === 'department_head'
    ? '/dashboard/department-head/stock-issues'
    : '/dashboard/requestor/stock-issues';
}

export type RequestorStockIssueDetailContentProps = {
  issueId: string;
  context: RequestorStockIssueContext;
  mode: 'page' | 'modal';
};

export function RequestorStockIssueDetailContent({
  issueId,
  context,
  mode,
}: RequestorStockIssueDetailContentProps) {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [qtyEdits, setQtyEdits] = useState<Record<string, number>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock-issue', issueId],
    queryFn: () => getStockIssueRequestor(issueId),
    enabled: !!issueId,
  });

  const partCodes = data?.items.map((i) => i.partInternalCode) ?? [];
  const { data: stockData } = useQuery({
    queryKey: ['part-stock', partCodes.join(',')],
    queryFn: () => getPartStockAvailability(partCodes),
    enabled: partCodes.length > 0,
  });
  const byPart = stockData?.byPart ?? {};

  useEffect(() => {
    if (!data?.items) return;
    const m: Record<string, number> = {};
    data.items.forEach((i) => {
      m[i.id] = i.qty;
    });
    setQtyEdits(m);
  }, [data?.id, data?.items]);

  const submitMut = useMutation({
    mutationFn: () => submitStockIssue(issueId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['stock-issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['my-stock-issues'] });
      showSuccess('Đã gửi giữ hàng.');
      const list =
        context === 'department_head'
          ? '/dashboard/department-head/stock-issues'
          : '/dashboard/requestor/stock-issues';
      navigate({ pathname: list, search: `?detail=${encodeURIComponent(res.id)}` }, { replace: true });
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: string } } };
      showError(ax.response?.data?.error || 'Không gửi được.');
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelStockIssue(issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['my-stock-issues'] });
      showSuccess('Đã hủy phiếu.');
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: string } } };
      showError(ax.response?.data?.error || 'Không hủy được.');
    },
  });

  const patchQtyMut = useMutation({
    mutationFn: ({ itemId, qty }: { itemId: string; qty: number }) =>
      patchStockIssueItemQty(issueId, itemId, qty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['my-stock-issues'] });
      queryClient.invalidateQueries({ queryKey: ['part-stock'] });
      showSuccess('Đã cập nhật số lượng.');
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: string } } };
      showError(ax.response?.data?.error || 'Không đổi được SL.');
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-slate-500">Đang tải…</div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
        Không tìm thấy phiếu.
        {mode === 'page' ? (
          <>
            {' '}
            <Link to={listPath(context)} className="font-semibold underline">
              Quay lại
            </Link>
          </>
        ) : null}
      </div>
    );
  }

  const editPath =
    context === 'department_head'
      ? `/dashboard/department-head/stock-issues/${data.id}/edit`
      : `/dashboard/requestor/stock-issues/${data.id}/edit`;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {mode === 'page' ? (
        <button
          type="button"
          onClick={() => navigate(listPath(context))}
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Danh sách
        </button>
      ) : null}

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{data.issueNumber}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {statusLabel[data.status]} · {new Date(data.createdAt).toLocaleString('vi-VN')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.status === 'DRAFT' && (
              <>
                <Link
                  to={editPath}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
                >
                  Sửa nháp
                </Link>
                <button
                  type="button"
                  onClick={() => submitMut.mutate()}
                  disabled={submitMut.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Gửi giữ hàng
                </button>
              </>
            )}
            {(data.status === 'DRAFT' || data.status === 'RESERVED') && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Hủy phiếu này?')) cancelMut.mutate();
                }}
                disabled={cancelMut.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                Hủy
              </button>
            )}
          </div>
        </div>

        {data.purpose ? (
          <p className="mt-4 text-sm text-slate-700">
            <span className="font-semibold">Mục đích:</span> {data.purpose}
          </p>
        ) : null}
        {data.notes ? (
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-semibold">Ghi chú:</span> {data.notes}
          </p>
        ) : null}
        {data.salesPO ? (
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Sales PO:</span>{' '}
            <span className="font-mono">{data.salesPO.salesPONumber}</span>
            {data.salesPO.customerPONumber ? (
              <span className="text-slate-500"> · PO khách: {data.salesPO.customerPONumber}</span>
            ) : null}
          </p>
        ) : null}

        <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">Dòng vật tư</h3>
        <ul className="mt-2 max-h-[min(48vh,22rem)] divide-y divide-slate-100 overflow-auto rounded-xl border border-slate-100">
          {data.items.map((it) => {
            const av = byPart[it.partInternalCode]?.available ?? 0;
            const editQty = qtyEdits[it.id] ?? it.qty;
            const shipped = it.qtyShipped ?? 0;
            const reserved = it.reservedQty ?? 0;
            const lineDone = shipped >= it.qty - 1e-9;
            const lineStatus =
              lineDone ? 'Đã xuất' : shipped > 0 ? 'Đang xuất một phần' : 'Chờ xuất';
            return (
              <li key={it.id} className="flex flex-col gap-2 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono font-semibold text-slate-900">{it.partInternalCode}</p>
                  <p className="text-sm text-slate-600">{it.partName || '—'}</p>
                  <p className="text-xs text-slate-500">
                    SL: {it.qty} {it.unit || ''}
                    {data.status === 'RESERVED' || data.status === 'APPROVED' ? (
                      <> · Đã giữ: {reserved}</>
                    ) : null}
                    {shipped > 0 || data.status === 'ISSUED' ? (
                      <> · Đã xuất: {shipped}</>
                    ) : null}
                    {data.status !== 'DRAFT' && data.status !== 'CANCELLED' && data.status !== 'REJECTED' ? (
                      <>
                        {' '}
                        · <span className="font-medium text-slate-700">{lineStatus}</span>
                      </>
                    ) : null}
                  </p>
                  {data.status === 'RESERVED' ? (
                    <p className="text-xs text-slate-500">Tồn khả dụng (ước tính): {av}</p>
                  ) : null}
                </div>
                {data.status === 'RESERVED' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0.0001}
                      step="any"
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm shadow-sm"
                      value={editQty}
                      onChange={(e) =>
                        setQtyEdits((prev) => ({ ...prev, [it.id]: Number(e.target.value) || 0 }))
                      }
                    />
                    <button
                      type="button"
                      disabled={patchQtyMut.isPending || editQty === it.qty}
                      onClick={() => patchQtyMut.mutate({ itemId: it.id, qty: editQty })}
                      className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Lưu SL
                    </button>
                  </div>
                ) : (
                  <span className="text-sm font-semibold text-slate-800">
                    SL: {it.qty} {it.unit || ''}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Trang đầy đủ — dùng cho department head (URL cũ) */
const RequestorStockIssueDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const ctx: RequestorStockIssueContext = location.pathname.startsWith('/dashboard/department-head')
    ? 'department_head'
    : 'requestor';

  if (!id) return null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-slate-50">
      <div className={ctx === 'requestor' ? `${requestorPageStackClass} pb-4` : 'p-4 sm:p-6'}>
        {ctx === 'requestor' ? (
          <RequestorPageHero
            kicker="Requestor · Xuất kho"
            title="Chi tiết phiếu xuất"
            description="Theo dõi trạng thái, dòng vật tư và thao tác gửi / hủy khi còn nháp."
            Icon={Package}
            tint="ocean"
            regionLabel="Chi tiết phiếu xuất kho"
          />
        ) : null}
        <RequestorStockIssueDetailContent issueId={id} context={ctx} mode="page" />
      </div>
    </div>
  );
};

export default RequestorStockIssueDetail;
