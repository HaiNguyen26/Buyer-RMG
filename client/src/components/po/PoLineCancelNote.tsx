export type PoLineCancelNoteProps = {
  orderedQty: number;
  receivedQty?: number;
  cancelledQty?: number | null;
  reason?: string | null;
  pending?: boolean;
  unit?: string | null;
  className?: string;
};

function fmtQty(n: number, unit?: string | null): string {
  const base = Number.isInteger(n) ? String(n) : n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  return unit?.trim() ? `${base} ${unit.trim()}` : base;
}

/** Khối ghi chú SL + lý do khi hủy dòng PO (đã nhận kho / hủy phần còn lại). */
export function PoLineCancelNote({
  orderedQty,
  receivedQty = 0,
  cancelledQty,
  reason,
  pending = false,
  unit,
  className = '',
}: PoLineCancelNoteProps) {
  const received = Math.max(0, Number(receivedQty) || 0);
  const ordered = Math.max(0, Number(orderedQty) || 0);
  const cancelled =
    cancelledQty != null && Number(cancelledQty) > 0
      ? Number(cancelledQty)
      : Math.max(0, ordered - received);

  const hasReason = Boolean(reason?.trim());
  const showCancelled = cancelled > 1e-9;
  const receivedFull = ordered > 0 && received + 1e-9 >= ordered;

  if (!hasReason && !showCancelled && !receivedFull && !pending) return null;

  const tone = pending
    ? 'border-amber-200/90 bg-amber-50/95 text-amber-950'
    : receivedFull && !showCancelled
      ? 'border-slate-200/90 bg-slate-50/95 text-slate-700'
      : 'border-rose-200/80 bg-rose-50/90 text-rose-950';

  return (
    <div
      className={`mt-1.5 max-w-md rounded-lg border px-2 py-1.5 text-[10px] leading-snug ${tone} ${className}`}
      role="note"
    >
      {pending ? (
        <p className="font-bold uppercase tracking-wide text-amber-800/90">Chờ duyệt hủy dòng</p>
      ) : null}
      {ordered > 0 ? (
        <p>
          <span className="font-semibold">SL trên PO:</span> {fmtQty(ordered, unit)}
        </p>
      ) : null}
      {received > 0 || receivedFull ? (
        <p>
          <span className="font-semibold">Đã nhận kho:</span> {fmtQty(received, unit)}
          {ordered > 0 ? (
            <span className="text-[9px] opacity-80">
              {' '}
              / {fmtQty(ordered, unit)}
              {receivedFull ? ' (đủ)' : ''}
            </span>
          ) : null}
        </p>
      ) : null}
      {showCancelled ? (
        <p>
          <span className="font-semibold">Hủy (phần còn lại):</span> {fmtQty(cancelled, unit)}
        </p>
      ) : null}
      {receivedFull && !showCancelled && !pending ? (
        <p className="font-medium opacity-90">Đã nhận đủ — không hủy phần còn lại trên dòng này.</p>
      ) : null}
      {hasReason ? (
        <p className="mt-0.5 whitespace-pre-wrap">
          <span className="font-semibold">Lý do:</span> {reason!.trim()}
        </p>
      ) : null}
    </div>
  );
}
