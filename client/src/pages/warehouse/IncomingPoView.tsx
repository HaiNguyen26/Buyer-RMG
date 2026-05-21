import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, FileText, History } from 'lucide-react';
import { warehouseService, type PoGrnSummary } from '../../services/warehouseService';
import {
  warehouseWorkspacePageContentClass,
  warehouseWorkspacePageShellClass,
} from '../../constants/warehouseLayout';
import {
  departmentHeadInteractiveTableClass,
  departmentHeadTableAccentRailClass,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableDataRowClasses,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableTbodyElevatedClass,
} from '../../constants/departmentHeadLayout';
import { saasTableHeadCellClass, saasTableRootClass } from '../../constants/saasDataTable';

function formatDisplayDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function grnStatusClass(status: PoGrnSummary['status']): string {
  switch (status) {
    case 'FULL':
      return 'bg-emerald-100 text-emerald-800';
    case 'PARTIAL':
      return 'bg-amber-100 text-amber-800';
    case 'PENDING_QC':
      return 'bg-indigo-100 text-indigo-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

const IncomingPoView = () => {
  const { poId } = useParams<{ poId: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['warehouse-incoming-po-view', poId],
    queryFn: () => warehouseService.getIncomingPoView(poId!),
    enabled: Boolean(poId?.trim()),
  });

  if (!poId?.trim()) {
    return (
      <div className="p-6 text-red-600">
        Thiếu mã PO. <Link to="/dashboard/warehouse/incoming">Quay lại</Link>
      </div>
    );
  }

  return (
    <div className={`${warehouseWorkspacePageShellClass} text-slate-800`}>
      <div className={warehouseWorkspacePageContentClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/warehouse/incoming"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
              aria-label="Quay lại"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Xem PO</p>
              <h1 className="text-xl font-extrabold text-slate-900">
                {data?.po.poNumber ?? '…'}
              </h1>
            </div>
          </div>
          <Link
            to={`/dashboard/warehouse/incoming/${poId}/grn`}
            className="inline-flex rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Tạo GRN
          </Link>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Đang tải…</p>
        ) : error || !data ? (
          <p className="text-sm text-red-600">Không tải được PO.</p>
        ) : (
          <>
            <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">NCC</p>
                  <p className="font-semibold text-slate-900">{data.po.vendor}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Trạng thái PO</p>
                  <p className="font-mono text-sm font-semibold text-slate-800">{data.po.status}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">ETA</p>
                <p className="font-semibold text-slate-900">
                  {formatDisplayDate(data.po.earliestExpectedDate ?? data.po.deliveryDate)}
                </p>
              </div>
            </div>

            {data.existingGrns.length > 0 ? (
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <History className="h-3.5 w-3.5" />
                  GRN đã tạo ({data.existingGrns.length})
                </p>
                <ul className="flex flex-wrap gap-2">
                  {data.existingGrns.map((g) => (
                    <li key={g.id}>
                      <Link
                        to={`/dashboard/warehouse/grn-history?grn=${encodeURIComponent(g.id)}`}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${grnStatusClass(g.status)}`}
                      >
                        {g.grnNumber}
                        <span className="font-normal opacity-80">{g.status}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white ring-1 ring-slate-900/5">
              <table className={`${departmentHeadInteractiveTableClass} ${saasTableRootClass} w-full text-left`}>
                <thead className="bg-slate-50/95">
                  <tr>
                    <th className={saasTableHeadCellClass}>Dòng</th>
                    <th className={saasTableHeadCellClass}>Vật tư</th>
                    <th className={`${saasTableHeadCellClass} text-right`}>Đặt mua</th>
                    <th className={`${saasTableHeadCellClass} text-right`}>Confirm</th>
                    <th className={`${saasTableHeadCellClass} text-right`}>Đã nhận</th>
                    <th className={`${saasTableHeadCellClass} text-right`}>Còn lại</th>
                  </tr>
                </thead>
                <tbody className={departmentHeadTableTbodyElevatedClass}>
                  {data.lines.map((line, index) => (
                    <tr key={line.poItemId} className={departmentHeadTableDataRowClasses(index)}>
                      <td className="relative px-4 py-2.5 text-sm tabular-nums text-slate-600">
                        <div aria-hidden className={departmentHeadTableAccentRailClass} />
                        <div className={departmentHeadTableFirstCellInnerClass}>{line.lineNo}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className={departmentHeadTableCellContentWrapClass}>
                          <div className="font-medium text-slate-900">{line.itemLabel}</div>
                          {line.partNo ? (
                            <div className="text-xs text-slate-500">{line.partNo}</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-sm">{line.ordered}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-sm">
                        {line.confirmedQty ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-sm font-medium text-slate-800">
                        {line.alreadyReceived}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-sm font-semibold text-teal-800">
                        {line.remaining}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default IncomingPoView;
