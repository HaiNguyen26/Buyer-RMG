import { ArrowRight } from 'lucide-react';
import { formatEtaDisplay } from '../../utils/requestorProcurementLabels';

type RequestorEtaDisplayProps = {
  eta: string | null;
  etaOriginal?: string | null;
  etaRevised?: string | null;
  className?: string;
};

/** ETA dòng PR: ngày hiện tại; nếu đổi so với ngày yêu cầu ban đầu thì hiển thị mũi tên. */
export function RequestorEtaDisplay({
  eta,
  etaOriginal,
  etaRevised,
  className = '',
}: RequestorEtaDisplayProps) {
  if (etaOriginal && etaRevised && etaOriginal !== etaRevised) {
    return (
      <span
        className={`inline-flex flex-wrap items-center justify-end gap-1 tabular-nums ${className}`}
        title="ETA đã cập nhật theo báo giá / xác nhận NCC"
      >
        <span className="text-[10px] font-medium text-slate-500 line-through decoration-slate-400">
          {formatEtaDisplay(etaOriginal)}
        </span>
        <ArrowRight className="h-3 w-3 shrink-0 text-indigo-500" aria-hidden />
        <span className="font-bold text-indigo-700">{formatEtaDisplay(etaRevised)}</span>
      </span>
    );
  }
  return (
    <span className={`tabular-nums ${className}`}>{formatEtaDisplay(eta)}</span>
  );
}
