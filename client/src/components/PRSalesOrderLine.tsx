import { Link2 } from 'lucide-react';
import type { PRSalesOrderInfo } from '../types/prSalesOrder';

type Props = {
  salesOrder?: PRSalesOrderInfo | null;
  className?: string;
  /** true: luôn hiện một dòng (kể cả khi không có SO) */
  showWhenEmpty?: boolean;
};

/**
 * Một dòng gọn: SO / PO khách / dự án — dùng trong bảng PR và chi tiết.
 */
export function PRSalesOrderLine({ salesOrder, className = '', showWhenEmpty = false }: Props) {
  const label = salesOrder?.label?.trim();
  if (!label) {
    if (!showWhenEmpty) return null;
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-slate-400 ${className}`}>
        <Link2 className="h-3.5 w-3.5 shrink-0 opacity-50" strokeWidth={2} />
        Không gắn SO
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-start gap-1.5 text-xs text-slate-600 ${className}`}
      title={label}
    >
      <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600/90" strokeWidth={2} />
      <span className="min-w-0 break-words font-medium leading-snug text-slate-700">{label}</span>
    </span>
  );
}
