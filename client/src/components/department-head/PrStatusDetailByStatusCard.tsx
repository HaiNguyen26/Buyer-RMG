import { ChevronRight } from 'lucide-react';

export type PrStatusDetailRow = {
  statusCode?: string;
  label: string;
  count: number;
  totalAmount: number;
};

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function activeDotClass(statusCode?: string): string {
  switch (statusCode) {
    case 'QUOTATION_RECEIVED':
      return 'bg-violet-500';
    case 'RFQ_IN_PROGRESS':
      return 'bg-cyan-500';
    case 'DRAFT':
      return 'bg-sky-500';
    case 'MANAGER_PENDING':
    case 'DEPARTMENT_HEAD_PENDING':
    case 'BRANCH_MANAGER_PENDING':
      return 'bg-amber-400';
    case 'MANAGER_APPROVED':
    case 'BRANCH_MANAGER_APPROVED':
    case 'BUYER_LEADER_PENDING':
      return 'bg-emerald-500';
    case 'MANAGER_REJECTED':
    case 'MANAGER_RETURNED':
    case 'BRANCH_MANAGER_REJECTED':
    case 'BRANCH_MANAGER_RETURNED':
    case 'NEED_MORE_INFO':
      return 'bg-orange-400';
    case 'ASSIGNED_TO_BUYER':
    case 'SUPPLIER_SELECTED':
      return 'bg-indigo-500';
    default:
      return 'bg-indigo-500';
  }
}

function formatQty(n: number): string {
  if (n >= 100) return String(n);
  return String(n).padStart(2, '0');
}

/** Chiều cao ước lượng 1 dòng header bảng / 1 dòng tbody (px), dùng giới hạn cuộn */
const EST_HEAD_ROW_PX = 50;
const EST_BODY_ROW_PX = 56;

type PrStatusDetailByStatusCardProps = {
  rows: PrStatusDetailRow[];
  onViewAll?: () => void;
  onRowAction?: (row: PrStatusDetailRow) => void;
  /** Khi không có dữ liệu API — ẩn bảng */
  emptyMessage?: string;
  className?: string;
  /**
   * Giới hạn số dòng dữ liệu hiển thị theo chiều dọc trong viewport (header dính trên);
   * nhiều hơn → cuộn nội dung bảng.
   */
  maxVisibleBodyRows?: number;
};

/**
 * Khối "Chi tiết PR theo trạng thái" — layout bám design: tiêu đề + phụ đề + XEM TẤT CẢ,
 * bảng có chấm tròn trạng thái, SL padded, tổng tiền / -- và cột chevron.
 */
export function PrStatusDetailByStatusCard({
  rows,
  onViewAll,
  onRowAction,
  emptyMessage,
  className = '',
  maxVisibleBodyRows,
}: PrStatusDetailByStatusCardProps) {
  const sorted = [...rows].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label, 'vi');
  });

  const tableScrollMaxPx =
    typeof maxVisibleBodyRows === 'number' && maxVisibleBodyRows > 0
      ? EST_HEAD_ROW_PX + maxVisibleBodyRows * EST_BODY_ROW_PX
      : undefined;

  const shell =
    'rounded-2xl border border-slate-200 bg-white shadow-[0_16px_28px_-22px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5';

  if (!sorted.length) {
    return (
      <article className={`${shell} p-6 ${className}`}>
        <h2 className="text-lg font-bold text-slate-900">Chi tiết PR theo trạng thái</h2>
        <p className="mt-1 text-sm text-slate-500">
          Bảng số liệu thô và giá trị tương ứng
        </p>
        <p className="mt-8 text-center text-sm text-slate-500">{emptyMessage ?? 'Chưa có dữ liệu trạng thái PR.'}</p>
      </article>
    );
  }

  return (
    <article className={`${shell} ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-snug text-slate-900">Chi tiết PR theo trạng thái</h2>
          <p className="mt-1 text-sm text-slate-500">Bảng số liệu thô và giá trị tương ứng</p>
        </div>
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="shrink-0 text-xs font-bold uppercase tracking-[0.12em] text-blue-600 transition-colors hover:text-blue-700"
          >
            Xem tất cả
          </button>
        ) : null}
      </div>

      <div
        className="min-w-0 overflow-x-auto overflow-y-auto rounded-b-2xl"
        style={tableScrollMaxPx != null ? { maxHeight: `${tableScrollMaxPx}px` } : undefined}
      >
        <table className="w-full text-left">
          <thead className={tableScrollMaxPx != null ? 'sticky top-0 z-[1]' : undefined}>
            <tr className="border-b border-slate-100 bg-slate-50/95 shadow-[0_1px_0_0_rgb(241_245_249)] backdrop-blur-sm">
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-6">
                Trạng thái
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-6">
                Số lượng (SL)
              </th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-6">
                Tổng giá trị
              </th>
              <th className="w-14 px-2 py-3 sm:w-16" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sorted.map((row) => {
              const muted = row.count <= 0;
              const dot = muted ? 'bg-slate-300' : activeDotClass(row.statusCode);
              return (
                <tr
                  key={`${row.statusCode ?? row.label}-${row.label}`}
                  className={
                    muted
                      ? '[&>td]:bg-white border-b border-slate-100 transition-colors duration-150 hover:[&>td]:bg-slate-50/90'
                      : '[&>td]:bg-white cursor-pointer border-b border-slate-100 transition-colors duration-150 [&>td]:transition-colors hover:[&>td]:bg-indigo-50/70'
                  }
                >
                  <td className="px-4 py-3.5 sm:px-6 sm:py-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
                      <span
                        className={`min-w-0 text-sm leading-snug ${
                          muted ? 'font-medium text-slate-400' : 'font-semibold text-slate-900'
                        }`}
                      >
                        {row.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums sm:px-6 sm:py-4">
                    <span className={`text-sm ${muted ? 'font-medium text-slate-400' : 'font-bold text-slate-900'}`}>
                      {formatQty(row.count)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums sm:px-6 sm:py-4">
                    <span className={`text-sm ${muted ? 'font-medium text-slate-400' : 'font-bold text-slate-900'}`}>
                      {muted ? '—' : formatVnd(row.totalAmount)}
                    </span>
                  </td>
                  <td className="px-2 py-3.5 align-middle text-right sm:py-4">
                    {onRowAction ? (
                      <button
                        type="button"
                        aria-label={`Mở — ${row.label}`}
                        onClick={() => onRowAction(row)}
                        className={`inline-flex rounded-lg p-1.5 transition-colors ${
                          muted
                            ? 'text-slate-300 hover:bg-slate-50 hover:text-slate-400'
                            : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                      >
                        <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
                      </button>
                    ) : (
                      <span className={`inline-flex p-1.5 ${muted ? 'text-slate-300' : 'text-slate-400'}`}>
                        <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
