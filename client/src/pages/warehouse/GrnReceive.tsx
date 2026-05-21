import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  FileCheck,
  FileText,
  Inbox,
  Paperclip,
  User,
  X,
  AlertCircle,
} from 'lucide-react';
import axios from 'axios';
import { warehouseService } from '../../services/warehouseService';
import { useToast } from '../../contexts/ToastContext';
import {
  dashboardPageContentInsetBottomWorkspaceClass,
  dashboardPageContentInsetXClass,
} from '../../constants/dashboardLayout';
import { warehouseWorkspacePageShellClass } from '../../constants/warehouseLayout';

/** Khung page — card `flex-1`; vùng giữa card cuộn, footer luôn ở đáy viewport. */
const grnFormPageLayoutClass = [
  'mx-auto flex w-full min-w-0 max-w-[1800px] flex-1 flex-col justify-start min-h-0',
  dashboardPageContentInsetXClass,
  'pt-3 sm:pt-4',
  dashboardPageContentInsetBottomWorkspaceClass,
].join(' ');

/** Nội dung form (bảng + trường) — cuộn trong card, không đẩy nút xác nhận ra ngoài màn hình. */
const grnFormBodyScrollClass =
  'min-h-0 flex-1 overflow-y-auto overflow-x-hidden touch-pan-y [scrollbar-width:thin]';
import {
  departmentHeadTableAccentRailClass,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableCellContentWrapFlexClass,
  departmentHeadTableDataRowClasses,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableScrollViewportThinBars,
  departmentHeadTableTbodyElevatedClass,
} from '../../constants/departmentHeadLayout';
import {
  saasTableHeadCellClass,
  saasTableNumericStrongClass,
  saasTableRootClass,
} from '../../constants/saasDataTable';

function todayISO(): string {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso?.trim()) {
    const [y, m, d] = todayISO().split('-');
    return `${d}/${m}/${y}`;
  }
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function clampQty(raw: string, max: number): number {
  const n = parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, Math.round(n * 1000) / 1000);
}

const GRN_LINES_ROWS_VISIBLE = 10;
const grnLinesTableViewportHeight = `calc(2.75rem + ${GRN_LINES_ROWS_VISIBLE} * 3.5rem)`;

function grnTableScrollWrapClass(lineCount: number): string {
  if (lineCount > GRN_LINES_ROWS_VISIBLE) {
    return departmentHeadTableScrollViewportThinBars;
  }
  return 'min-w-0 w-full max-w-full';
}

const GRN_ELEVATED_CARD_CLASS =
  'relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-15px_rgba(15,23,42,0.12),0_20px_50px_rgba(0,0,0,0.08)] ring-1 ring-slate-900/[0.04] sm:rounded-2xl';

const GRN_FORM_FOOTER_CLASS =
  'flex shrink-0 flex-col gap-4 rounded-b-xl border-t border-slate-100 bg-slate-50/50 px-6 py-4 shadow-[0_-10px_28px_-12px_rgba(15,23,42,0.12)] sm:flex-row sm:items-center sm:justify-between sm:rounded-b-2xl sm:px-8 sm:py-5';

/** Bảng GRN: co theo nội dung, không ép min-width / cột % rộng. */
const GRN_LINES_TABLE_CLASS =
  'w-full max-w-full border-separate border-spacing-0';

const GRN_LINES_TH_CLASS = `${saasTableHeadCellClass} bg-slate-50/95 px-2.5 py-2 text-left sm:px-3`;
const GRN_LINES_TH_NUM_CLASS = `${saasTableHeadCellClass} bg-slate-50/95 px-2 py-2 text-right whitespace-nowrap sm:px-2.5`;
const GRN_LINES_TD_CLASS = 'px-2.5 py-2 sm:px-3';
const GRN_LINES_TD_NUM_CLASS = 'px-2 py-2 text-right whitespace-nowrap tabular-nums sm:px-2.5';

const GrnReceive = () => {
  const { poId } = useParams<{ poId: string }>();
  const [searchParams] = useSearchParams();
  const highlightPoItemId = searchParams.get('highlight')?.trim() || null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [note, setNote] = useState('');
  const [receiveDate, setReceiveDate] = useState(todayISO);
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    setQtyByLine({});
    setNote('');
    setReceiveDate(todayISO());
    setAttachmentNames([]);
  }, [poId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['warehouse-grn-po', poId],
    queryFn: () => warehouseService.getPOForGrn(poId!),
    enabled: !!poId?.trim(),
  });

  const lines = data?.lines ?? [];
  const receiveProgressBase = data?.receiveProgress ?? { received: 0, cap: 0 };

  const progressPreview = useMemo(() => {
    let delta = 0;
    for (const l of lines) {
      delta += clampQty(qtyByLine[l.poItemId] ?? '0', l.remaining);
    }
    const received = Math.round((receiveProgressBase.received + delta) * 1000) / 1000;
    const cap = Math.round(receiveProgressBase.cap * 1000) / 1000;
    return { received, cap, delta };
  }, [lines, qtyByLine, receiveProgressBase]);

  const grnYear = new Date().getFullYear();
  const tableNeedsViewportScroll = lines.length > GRN_LINES_ROWS_VISIBLE;

  const mutation = useMutation({
    mutationFn: () => {
      if (!poId) throw new Error('Thiếu PO');
      const bodyLines = lines.map((l) => ({
        poItemId: l.poItemId,
        qtyReceived: clampQty(qtyByLine[l.poItemId] ?? '0', l.remaining),
      }));
      return warehouseService.submitGrn(poId, {
        lines: bodyLines,
        note: note.trim() || null,
        receivedAt: receiveDate.trim() || null,
        attachmentNames: attachmentNames.length ? attachmentNames : undefined,
      });
    },
    onSuccess: (res) => {
      showSuccess(`Đã tạo ${res.grnNumber}. Tồn kho và PO đã cập nhật.`);
      queryClient.invalidateQueries({ queryKey: ['warehouse-incoming-pos'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-grn-po', poId] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-grn-history'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['department-head-pending-prs'] });
      queryClient.invalidateQueries({ queryKey: ['requestor-pr-tracking'] });
      navigate(`/dashboard/warehouse/grn-history?grn=${encodeURIComponent(res.grnId)}`);
    },
    onError: (e: unknown) => {
      const msg =
        axios.isAxiosError(e) && e.response?.data && typeof (e.response.data as { error?: string }).error === 'string'
          ? (e.response.data as { error: string }).error
          : 'Không gửi được phiếu nhập kho.';
      showError(msg);
    },
  });

  const validationError = useMemo(() => {
    let anyPositive = false;
    for (const l of lines) {
      if (!l.canReceive && l.remaining <= 0) continue;
      if (!l.canReceive) {
        return `Dòng ${l.lineNo}: chưa có SL confirm từ buyer — không thể nhập kho.`;
      }
      const raw = qtyByLine[l.poItemId] ?? '';
      const n = parseFloat(String(raw).replace(',', '.'));
      if (raw.trim() !== '' && (!Number.isFinite(n) || n < 0)) {
        return `Dòng ${l.lineNo}: số lượng không hợp lệ.`;
      }
      const q = clampQty(raw || '0', l.remaining);
      if (q > l.remaining + 1e-6) return `Dòng ${l.lineNo}: nhận vượt quá còn lại (${l.remaining}).`;
      if (q > 0) anyPositive = true;
    }
    if (!anyPositive && lines.some((l) => l.canReceive && l.remaining > 0)) {
      return 'Nhập ít nhất một dòng có số lượng nhận > 0.';
    }
    if (!anyPositive && lines.length) return 'Không có dòng nào sẵn sàng nhận kho.';
    if (!receiveDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(receiveDate.trim())) {
      return 'Chọn ngày nhận (Receive Date).';
    }
    return null;
  }, [lines, qtyByLine, receiveDate]);

  const handleCopy = useCallback((text: string, fieldName: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedField(fieldName);
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      showError('Không thể sao chép');
    }
    document.body.removeChild(textArea);
  }, [showError]);

  if (!poId?.trim()) {
    return (
      <div className="p-6 text-red-600">
        Thiếu mã PO. <Link to="/dashboard/warehouse/incoming">Quay lại</Link>
      </div>
    );
  }

  return (
    <div className={`${warehouseWorkspacePageShellClass} text-slate-800`}>
      <div className={grnFormPageLayoutClass}>
        <div className={GRN_ELEVATED_CARD_CLASS}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-transparent px-6 py-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard/warehouse/incoming')}
              className="shrink-0 rounded-xl border border-slate-200/40 bg-slate-50 p-2.5 text-slate-500 shadow-sm transition-all hover:bg-slate-100"
              aria-label="Quay lại PO chờ nhận"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                  Quản lý kho bãi / Kho vận
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300" aria-hidden />
                <span className="text-[10px] font-bold text-slate-400">GRN-{grnYear}</span>
              </div>
              <h1 className="truncate text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                Phiếu nhập kho
              </h1>
              {data && receiveProgressBase.cap > 0 ? (
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Tiến độ PO:{' '}
                  <span className="font-bold tabular-nums text-slate-800">
                    {progressPreview.received}/{progressPreview.cap}
                  </span>
                  {progressPreview.delta > 0 ? (
                    <span className="text-teal-700">
                      {' '}
                      (+{progressPreview.delta} lần này)
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/15 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 shadow-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden />
            Chờ nhập kho
          </span>
        </div>

        {isLoading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500 sm:px-8">Đang tải PO…</div>
        ) : error || !data ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm text-red-600 sm:px-8">
            <p>Không tải được PO.</p>
            <Link to="/dashboard/warehouse/incoming" className="font-medium text-indigo-600 hover:underline">
              Quay lại danh sách
            </Link>
          </div>
        ) : (
          <>
            <div className={grnFormBodyScrollClass}>
            {(data.existingGrns?.length ?? 0) > 0 ? (
              <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-6 py-3 sm:px-8">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  GRN trước đó (cùng PO)
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {data.existingGrns!.map((g) => (
                    <Link
                      key={g.id}
                      to={`/dashboard/warehouse/grn-history?grn=${encodeURIComponent(g.id)}`}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 font-mono text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-800"
                    >
                      {g.grnNumber}
                      <span className="ml-1 font-sans font-normal text-slate-500">{g.status}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Info banner */}
            <div className="grid shrink-0 grid-cols-1 divide-y divide-slate-100 border-b border-slate-100 bg-slate-50/30 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              <div className="flex min-w-0 items-center gap-4 px-6 py-4 sm:px-8">
                <div className="shrink-0 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 p-2.5 text-white shadow-md shadow-indigo-500/10">
                  <FileCheck className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0">
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Mã PO liên kết
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-extrabold tracking-tight text-slate-900">
                      {data.po.poNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(data.po.poNumber, 'poId')}
                      className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      title="Sao chép mã PO"
                    >
                      {copiedField === 'poId' ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-4 px-6 py-4 sm:px-8">
                <div className="shrink-0 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 p-2.5 text-white shadow-md shadow-emerald-500/10">
                  <Building2 className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0">
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Nhà cung cấp
                  </span>
                  <p className="truncate text-sm font-extrabold text-slate-900" title={data.po.vendor}>
                    {data.po.vendor}
                  </p>
                  {data.po.vendorCode ? (
                    <span className="font-mono text-[10px] font-semibold text-slate-400">{data.po.vendorCode}</span>
                  ) : null}
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-4 px-6 py-4 sm:px-8">
                <div className="shrink-0 rounded-xl bg-gradient-to-tr from-rose-500 to-orange-500 p-2.5 text-white shadow-md shadow-rose-500/10">
                  <User className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0">
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Người nhận
                  </span>
                  <span className="block truncate text-sm font-extrabold tracking-tight text-slate-900">
                    {data.receiver.displayName}
                  </span>
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-4 px-6 py-4 sm:px-8">
                <div className="shrink-0 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-500 p-2.5 text-white shadow-md shadow-amber-500/10">
                  <Calendar className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0">
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    ETA sớm nhất
                  </span>
                  <span className="block truncate text-sm font-extrabold tracking-tight text-slate-900">
                    {formatDisplayDate(data.po.earliestExpectedDate ?? data.po.deliveryDate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Workspace — bảng co theo nội dung; khung cố định chỉ khi >10 dòng */}
            <div className="space-y-4 bg-white px-6 py-6 sm:px-8">
              <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-white ring-1 ring-slate-900/5">
                <div
                  className={grnTableScrollWrapClass(lines.length)}
                  style={tableNeedsViewportScroll ? { maxHeight: grnLinesTableViewportHeight } : undefined}
                >
                  <table className={`${GRN_LINES_TABLE_CLASS} ${saasTableRootClass} text-left`}>
                    <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 shadow-[inset_0_-1px_0_0_rgb(226_232_240)] backdrop-blur-sm">
                      <tr>
                        <th className={GRN_LINES_TH_CLASS}>Vật tư / mô tả</th>
                        <th className={GRN_LINES_TH_NUM_CLASS}>ETA</th>
                        <th className={GRN_LINES_TH_NUM_CLASS}>Đặt mua</th>
                        <th className={GRN_LINES_TH_NUM_CLASS}>Confirm</th>
                        <th className={GRN_LINES_TH_NUM_CLASS}>Đã nhận</th>
                        <th className={GRN_LINES_TH_NUM_CLASS}>Còn lại</th>
                        <th className={`${GRN_LINES_TH_NUM_CLASS} w-[7.5rem]`}>Received Qty</th>
                      </tr>
                    </thead>
                    <tbody className={departmentHeadTableTbodyElevatedClass}>
                      {lines.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-5 text-center text-sm text-slate-500">
                            PO không có dòng hàng.
                          </td>
                        </tr>
                      ) : (
                        lines.map((l, index) => {
                          const raw = qtyByLine[l.poItemId] ?? '';
                          const parsed = clampQty(raw, l.remaining + 999999);
                          const over = parsed > l.remaining + 1e-6;
                          const highlighted = highlightPoItemId === l.poItemId;
                          const rowDisabled = !l.canReceive || l.remaining <= 0;
                          return (
                            <tr
                              key={l.poItemId}
                              className={`${departmentHeadTableDataRowClasses(index)} ${
                                highlighted ? 'bg-teal-50/80 ring-1 ring-inset ring-teal-200' : ''
                              }`}
                            >
                              <td className={`relative max-w-[min(100%,22rem)] ${GRN_LINES_TD_CLASS}`}>
                                <div aria-hidden className={departmentHeadTableAccentRailClass} />
                                <div
                                  className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass}`}
                                >
                                  <div className="truncate font-medium text-slate-900" title={l.itemLabel}>
                                    {l.itemLabel}
                                  </div>
                                  {l.partNo ? (
                                    <div className="text-xs text-slate-500">Part: {l.partNo}</div>
                                  ) : (
                                    <div className="text-xs text-amber-700">
                                      Thiếu part no trên PR — không thể ghi tồn
                                    </div>
                                  )}
                                  {!l.canReceive ? (
                                    <div className="mt-1 text-xs font-medium text-amber-800">
                                      Chưa có SL confirm — buyer cần ghi nhận xác nhận NCC trước.
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                              <td className={`${GRN_LINES_TD_NUM_CLASS} text-slate-700`}>
                                <div className={departmentHeadTableCellContentWrapClass}>
                                  {formatDisplayDate(l.expectedDeliveryDate)}
                                </div>
                              </td>
                              <td className={GRN_LINES_TD_NUM_CLASS}>
                                <div className={departmentHeadTableCellContentWrapClass}>{l.ordered}</div>
                              </td>
                              <td className={`${GRN_LINES_TD_NUM_CLASS} text-emerald-800`}>
                                <div className={departmentHeadTableCellContentWrapClass}>
                                  {l.confirmedQty != null ? l.confirmedQty : '—'}
                                </div>
                              </td>
                              <td className={GRN_LINES_TD_NUM_CLASS}>
                                <div className={departmentHeadTableCellContentWrapClass}>{l.alreadyReceived}</div>
                              </td>
                              <td className={`${GRN_LINES_TD_NUM_CLASS} ${saasTableNumericStrongClass}`}>
                                <div className={departmentHeadTableCellContentWrapClass}>{l.remaining}</div>
                              </td>
                              <td className={`${GRN_LINES_TD_NUM_CLASS} w-[7.5rem]`}>
                                <div className={`${departmentHeadTableCellContentWrapFlexClass} justify-end`}>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    disabled={rowDisabled}
                                    value={raw}
                                    placeholder="0"
                                    onChange={(e) => {
                                      setQtyByLine((prev) => ({ ...prev, [l.poItemId]: e.target.value }));
                                    }}
                                    onBlur={() => {
                                      const q = clampQty(qtyByLine[l.poItemId] ?? '0', l.remaining);
                                      setQtyByLine((prev) => ({
                                        ...prev,
                                        [l.poItemId]: q === 0 ? '' : String(q),
                                      }));
                                    }}
                                    className={`w-full max-w-[5.5rem] rounded-lg border px-2 py-1.5 text-right tabular-nums outline-none ring-teal-500/30 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
                                      over ? 'border-red-400 bg-red-50' : 'border-slate-200'
                                    }`}
                                  />
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
              {lines.length > GRN_LINES_ROWS_VISIBLE ? (
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Hiển thị tối đa {GRN_LINES_ROWS_VISIBLE} dòng trong một khung — cuộn trong bảng để xem tiếp.
                </p>
              ) : null}

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    Receive Date
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={receiveDate}
                    onChange={(e) => setReceiveDate(e.target.value)}
                    className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none ring-teal-500/30 focus:ring-2"
                  />
                  <p className="text-[11px] text-slate-500">
                    Hiển thị: {formatDisplayDate(receiveDate)}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <Paperclip className="h-4 w-4 text-slate-400" />
                    Attachments
                    <span className="font-normal normal-case text-slate-300">(tên file — lưu vào ghi chú)</span>
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    className="block w-full max-w-md text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-teal-800 hover:file:bg-teal-100"
                    onChange={(e) => {
                      const names = Array.from(e.target.files ?? []).map((f) => f.name);
                      setAttachmentNames(names);
                    }}
                  />
                  {attachmentNames.length > 0 ? (
                    <ul className="list-inside list-disc text-xs text-slate-600">
                      {attachmentNames.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-slate-400">Biên bản / ảnh giao hàng (tuỳ chọn)</p>
                  )}
                </div>

                <div className="space-y-2.5 lg:col-span-2">
                  <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <FileText className="h-4 w-4 text-slate-400" />
                    Note
                    <span className="font-normal normal-case text-slate-300">(tuỳ chọn)</span>
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ví dụ: giao đợt 1, tình trạng hàng, biên bản bàn giao…"
                    className="min-h-[82px] w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-teal-500/30 placeholder:text-slate-400 focus:ring-2"
                  />
                </div>
              </div>
            </div>
            </div>

            {/* Footer — cố định đáy card / viewport */}
            <div className={GRN_FORM_FOOTER_CLASS}>
              <div className="flex min-w-0 items-center gap-2.5 text-xs font-bold">
                {validationError ? (
                  <div className="flex items-center gap-2 text-rose-600">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Thông tin hợp lệ. Sẵn sàng nhập kho.</span>
                  </div>
                )}
              </div>
              <div className="flex w-full shrink-0 items-center justify-end gap-3 sm:w-auto">
                <Link
                  to="/dashboard/warehouse/incoming"
                  className="inline-flex items-center gap-1.5 rounded-xl px-4.5 py-2.5 text-xs font-bold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 sm:text-sm"
                >
                  <X className="h-4 w-4" /> Hủy bỏ
                </Link>
                <button
                  type="button"
                  disabled={mutation.isPending || !!validationError}
                  onClick={() => mutation.mutate()}
                  className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold transition-all duration-150 sm:text-sm ${
                    !validationError && !mutation.isPending
                      ? 'cursor-pointer bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/15 hover:scale-[1.01] hover:shadow-indigo-500/25 active:scale-[0.99]'
                      : 'cursor-not-allowed border border-slate-200/40 bg-slate-100 text-slate-300'
                  }`}
                >
                  <Inbox className="h-4 w-4" />
                  {mutation.isPending ? 'Đang gửi…' : 'Xác nhận nhập kho'}
                </button>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
};

export default GrnReceive;
