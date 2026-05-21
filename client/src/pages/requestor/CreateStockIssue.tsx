import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  FileText,
  Layers,
  Link2,
  Loader2,
  Minus,
  Package,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  requestorService,
  type PartCatalogRow,
  type PRData,
} from '../../services/requestorService';
import {
  createStockIssue,
  getPartStockAvailability,
  getStockIssueRequestor,
  submitStockIssue,
  updateDraftStockIssue,
} from '../../services/stockIssueService';
import { useToast } from '../../contexts/ToastContext';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import { DepartmentPageHero } from '../../components/DepartmentPageHero';
import { requestorPanelCardClass } from '../../constants/requestorLayout';

const pageShellClass =
  'flex h-full min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[#f1f5f9] touch-pan-y [scrollbar-width:thin]';
const pageContentClass =
  'mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-1 flex-col gap-3 px-2 pb-3 pt-2 sm:gap-4 sm:px-3 sm:pb-4 sm:pt-3 md:px-4';

type Line = {
  rowKey: string;
  catalogPartId: string;
  partInternalCode: string;
  partName: string;
  unit: string;
  qty: number;
  description: string;
};

const emptyLine = (): Line => ({
  rowKey: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  catalogPartId: '',
  partInternalCode: '',
  partName: '',
  unit: '',
  qty: 1,
  description: '',
});

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10';

const labelClass =
  'flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500';

type PrItemRow = NonNullable<PRData['items']>[number];

/** Tuỳ chọn vật tư trên form — từ PR hoặc danh mục kho. */
type StockIssuePartOption = PartCatalogRow & {
  prItemId?: string;
  lineNo?: number;
  suggestedQty?: number;
};

function buildStockIssueOptionsFromPr(
  prItems: PrItemRow[] | undefined,
  resolved: PartCatalogRow[]
): StockIssuePartOption[] {
  const byCode = new Map(resolved.map((p) => [p.partInternalCode, p]));
  const out: StockIssuePartOption[] = [];
  for (const it of prItems ?? []) {
    const code = it.partNo?.trim();
    if (!code) continue;
    const cat = byCode.get(code);
    const fromStock = Number((it as { fromStockQty?: number }).fromStockQty ?? 0);
    const qtyLine = Number(it.qty) || 1;
    const suggestedQty = fromStock > 0 ? fromStock : qtyLine;
    out.push({
      id: cat?.id ?? `pr-item-${it.id ?? it.lineNo}`,
      partInternalCode: code,
      partName: cat?.partName ?? it.description,
      unit: cat?.unit ?? it.unit ?? 'pcs',
      manufacturer: cat?.manufacturer ?? null,
      referenceUrl: cat?.referenceUrl ?? null,
      stockAvailable: cat?.stockAvailable ?? 0,
      prItemId: it.id,
      lineNo: it.lineNo,
      suggestedQty,
    });
  }
  return out;
}

const CreateStockIssue = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const stockIssuesBase = location.pathname.startsWith('/dashboard/department-head')
    ? '/dashboard/department-head/stock-issues'
    : '/dashboard/requestor/stock-issues';
  const trackingBase = location.pathname.startsWith('/dashboard/department-head')
    ? '/dashboard/department-head/tracking'
    : '/dashboard/requestor/tracking';
  const [searchParams] = useSearchParams();
  const salesPoFromUrl = searchParams.get('salesPoId')?.trim() ?? '';
  const prIdFromUrl = searchParams.get('prId')?.trim() ?? '';
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = Boolean(editId);
  const isDepartmentHead = location.pathname.startsWith('/dashboard/department-head');
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const [partListSearch, setPartListSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [salesPoId, setSalesPoId] = useState('');
  const [linkedPrId, setLinkedPrId] = useState('');
  const [copiedPr, setCopiedPr] = useState(false);
  const prLinesPrefilledRef = useRef(false);

  const restrictCatalogToPr = Boolean(linkedPrId?.trim());

  const { data: catalogParts = [] } = useQuery({
    queryKey: ['part-catalog', partListSearch],
    queryFn: () => requestorService.listPartCatalog(partListSearch || undefined),
    enabled: !restrictCatalogToPr,
    staleTime: 30_000,
  });

  const { data: linkedPr, isLoading: linkedPrLoading } = useQuery({
    queryKey: ['requestor-pr-link', linkedPrId],
    queryFn: () => requestorService.getPR(linkedPrId),
    enabled: restrictCatalogToPr,
    staleTime: 60_000,
  });

  const prPartCodes = useMemo(() => {
    const items = linkedPr?.items ?? [];
    return [...new Set(items.map((i) => i.partNo?.trim()).filter(Boolean) as string[])];
  }, [linkedPr?.items]);

  const { data: resolvedPrParts } = useQuery({
    queryKey: ['part-catalog-resolve-pr', linkedPrId, prPartCodes.join('|')],
    queryFn: () => requestorService.resolvePartCatalogByCodes(prPartCodes),
    enabled: restrictCatalogToPr && prPartCodes.length > 0,
    staleTime: 60_000,
  });

  const prScopedCatalog = useMemo(
    () => buildStockIssueOptionsFromPr(linkedPr?.items, resolvedPrParts?.parts ?? []),
    [linkedPr?.items, resolvedPrParts?.parts]
  );

  const { data: existing } = useQuery({
    queryKey: ['stock-issue', editId],
    queryFn: () => getStockIssueRequestor(editId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!isEdit) {
      if (salesPoFromUrl) setSalesPoId(salesPoFromUrl);
      if (prIdFromUrl) setLinkedPrId(prIdFromUrl);
    }
  }, [isEdit, salesPoFromUrl, prIdFromUrl]);

  useEffect(() => {
    if (!restrictCatalogToPr || prLinesPrefilledRef.current || isEdit) return;
    if (linkedPrLoading || !linkedPr?.items?.length) return;
    if (prPartCodes.length > 0 && resolvedPrParts == null) return;

    const options = buildStockIssueOptionsFromPr(
      linkedPr.items,
      resolvedPrParts?.parts ?? []
    );
    if (options.length > 0) {
      setLines(
        options.map((opt) => {
          const it = linkedPr.items!.find((i) => i.id === opt.prItemId);
          const specRemark = [it?.spec, it?.remark].filter(Boolean).join(' · ');
          return {
            rowKey: `pr-${opt.prItemId ?? opt.id}`,
            catalogPartId: opt.id.startsWith('pr-item-') ? '' : opt.id,
            partInternalCode: opt.partInternalCode,
            partName: opt.partName,
            unit: opt.unit,
            qty: opt.suggestedQty ?? 1,
            description: specRemark,
          };
        })
      );
    }
    prLinesPrefilledRef.current = true;
  }, [
    restrictCatalogToPr,
    linkedPrLoading,
    linkedPr,
    resolvedPrParts,
    prPartCodes.length,
    isEdit,
  ]);

  useEffect(() => {
    if (!existing || !isEdit) return;
    if (existing.status !== 'DRAFT') {
      navigate(`${stockIssuesBase}/${existing.id}`, { replace: true });
      return;
    }
    setPurpose(existing.purpose ?? '');
    setNotes(existing.notes ?? '');
    setSalesPoId(existing.salesPO?.id ?? '');
    setLinkedPrId(existing.purchaseRequest?.id ?? '');
    setLines(
      existing.items.length
        ? existing.items.map((it, i) => ({
            rowKey: `edit-${it.id ?? i}`,
            catalogPartId: '',
            partInternalCode: it.partInternalCode,
            partName: it.partName ?? '',
            unit: it.unit ?? '',
            qty: it.qty,
            description: it.description ?? '',
          }))
        : [emptyLine()]
    );
  }, [existing, isEdit, navigate, stockIssuesBase]);

  const partCodes = useMemo(
    () => [...new Set(lines.map((l) => l.partInternalCode.trim()).filter(Boolean))],
    [lines]
  );

  const { data: stockData } = useQuery({
    queryKey: ['part-stock', partCodes.join(',')],
    queryFn: () => getPartStockAvailability(partCodes),
    enabled: partCodes.length > 0,
  });

  const byPart = stockData?.byPart ?? {};

  const prLinkLabel = useMemo(() => {
    if (linkedPr?.prNumber) return linkedPr.prNumber;
    if (linkedPrId) return linkedPrId.length > 12 ? `${linkedPrId.slice(0, 8)}…` : linkedPrId;
    return '';
  }, [linkedPr?.prNumber, linkedPrId]);

  const prCopyValue = linkedPr?.prNumber ?? linkedPrId;

  const handleCopyPr = useCallback((text: string) => {
    const done = () => {
      setCopiedPr(true);
      setTimeout(() => setCopiedPr(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(done).catch(() => {});
      return;
    }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      done();
    } catch {
      /* ignore */
    }
    document.body.removeChild(textArea);
  }, []);

  const handleClose = () => {
    if (prIdFromUrl && !isEdit) {
      navigate(trackingBase);
      return;
    }
    navigate(stockIssuesBase);
  };

  const createMut = useMutation({
    mutationFn: (action: 'DRAFT' | 'SUBMIT') =>
      createStockIssue({
        purpose: purpose.trim() || undefined,
        notes: notes.trim() || undefined,
        salesPoId: salesPoId.trim() || undefined,
        purchaseRequestId: linkedPrId.trim() || undefined,
        action,
        items: lines
          .filter((l) => l.partInternalCode.trim() && l.qty > 0)
          .map((l) => ({
            partInternalCode: l.partInternalCode.trim(),
            partName: l.partName.trim() || undefined,
            unit: l.unit.trim() || undefined,
            qty: l.qty,
            description: l.description.trim() || undefined,
          })),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-stock-issues'] });
      queryClient.invalidateQueries({ queryKey: ['pr-tracking-list'] });
      showSuccess(data.status === 'DRAFT' ? 'Đã lưu nháp.' : 'Đã gửi — tồn đã được giữ.');
      navigate(`${stockIssuesBase}/${data.id}`);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: string } } };
      showError(ax.response?.data?.error || 'Không tạo được phiếu.');
    },
  });

  const updateMut = useMutation({
    mutationFn: () =>
      updateDraftStockIssue(editId!, {
        purpose: purpose.trim() || undefined,
        notes: notes.trim() || undefined,
        salesPoId: salesPoId.trim() || undefined,
        items: lines
          .filter((l) => l.partInternalCode.trim() && l.qty > 0)
          .map((l) => ({
            partInternalCode: l.partInternalCode.trim(),
            partName: l.partName.trim() || undefined,
            unit: l.unit.trim() || undefined,
            qty: l.qty,
            description: l.description.trim() || undefined,
          })),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-stock-issues'] });
      queryClient.invalidateQueries({ queryKey: ['stock-issue', editId] });
      showSuccess('Đã cập nhật nháp.');
      navigate(`${stockIssuesBase}/${data.id}`);
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: string } } };
      showError(ax.response?.data?.error || 'Không lưu được.');
    },
  });

  const applyPart = (rowKey: string, partId: string) => {
    const p = catalogOptions.find((x) => x.id === partId);
    if (!p) return;
    const it = linkedPr?.items?.find((i) => i.id === p.prItemId);
    const specRemark = [it?.spec, it?.remark].filter(Boolean).join(' · ');
    setLines((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey
          ? {
              ...row,
              catalogPartId: partId.startsWith('pr-item-') ? '' : partId,
              partInternalCode: p.partInternalCode,
              partName: p.partName,
              unit: p.unit,
              qty: p.suggestedQty ?? row.qty,
              description: specRemark || row.description,
            }
          : row
      )
    );
  };

  const buildItemsPayload = () =>
    lines
      .filter((l) => l.partInternalCode.trim() && l.qty > 0)
      .map((l) => ({
        partInternalCode: l.partInternalCode.trim(),
        partName: l.partName.trim() || undefined,
        unit: l.unit.trim() || undefined,
        qty: l.qty,
        description: l.description.trim() || undefined,
      }));

  const validateForSubmit = (): boolean => {
    const valid = lines.filter((l) => l.partInternalCode.trim() && l.qty > 0);
    if (!valid.length) {
      showError('Cần ít nhất một dòng có mã vật tư và số lượng > 0.');
      return false;
    }
    for (const l of valid) {
      const av = stockAvailableForCode(l.partInternalCode.trim(), l.catalogPartId);
      if (l.qty > av) {
        showError(
          `Dòng ${l.partInternalCode}: yêu cầu ${l.qty} nhưng tồn khả dụng ${av}. Giảm SL hoặc dùng PR mua hàng.`
        );
        return false;
      }
    }
    return true;
  };

  const onSaveDraft = () => {
    if (!buildItemsPayload().length) {
      showError('Cần ít nhất một dòng hợp lệ.');
      return;
    }
    if (isEdit) updateMut.mutate();
    else createMut.mutate('DRAFT');
  };

  const submitReserveMut = useMutation({
    mutationFn: async () => {
      const items = buildItemsPayload();
      if (!items.length) throw new Error('NO_ITEMS');
      if (isEdit) {
        await updateDraftStockIssue(editId!, {
          purpose: purpose.trim() || undefined,
          notes: notes.trim() || undefined,
          salesPoId: salesPoId.trim() || undefined,
          items,
        });
        return submitStockIssue(editId!);
      }
      return createStockIssue({
        purpose: purpose.trim() || undefined,
        notes: notes.trim() || undefined,
        salesPoId: salesPoId.trim() || undefined,
        purchaseRequestId: linkedPrId.trim() || undefined,
        action: 'SUBMIT',
        items,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-stock-issues'] });
      queryClient.invalidateQueries({ queryKey: ['stock-issue', data.id] });
      queryClient.invalidateQueries({ queryKey: ['pr-tracking-list'] });
      showSuccess('Đã gửi — tồn đã được giữ.');
      navigate(`${stockIssuesBase}/${data.id}`);
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message === 'NO_ITEMS') {
        showError('Cần ít nhất một dòng hợp lệ.');
        return;
      }
      const ax = err as { response?: { data?: { error?: string } } };
      showError(ax.response?.data?.error || 'Không gửi được phiếu.');
    },
  });

  const onSubmitReserve = () => {
    if (!validateForSubmit()) return;
    submitReserveMut.mutate();
  };

  const busy = createMut.isPending || updateMut.isPending || submitReserveMut.isPending;

  const updateQty = (rowKey: string, delta: number) => {
    setLines((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey
          ? { ...row, qty: Math.max(0.0001, Math.round((row.qty + delta) * 1000) / 1000) }
          : row
      )
    );
  };

  const setQtyInput = (rowKey: string, val: string) => {
    const parsed = parseFloat(val.replace(',', '.'));
    setLines((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey
          ? { ...row, qty: Number.isFinite(parsed) && parsed > 0 ? parsed : 0.0001 }
          : row
      )
    );
  };

  const deleteRow = (rowKey: string) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((r) => r.rowKey !== rowKey));
  };

  const addRow = () => setLines((prev) => [...prev, emptyLine()]);

  const catalogOptions: StockIssuePartOption[] = restrictCatalogToPr
    ? prScopedCatalog
    : catalogParts;

  const filteredCatalog = useMemo(() => {
    const q = partListSearch.trim().toLowerCase();
    if (!q) return catalogOptions;
    return catalogOptions.filter(
      (p) =>
        p.partInternalCode.toLowerCase().includes(q) ||
        p.partName.toLowerCase().includes(q) ||
        (p.lineNo != null && String(p.lineNo).includes(q))
    );
  }, [catalogOptions, partListSearch]);

  const stockAvailableForCode = useCallback(
    (code: string, optionId?: string) => {
      const fromLive = byPart[code]?.available;
      if (fromLive != null) return fromLive;
      const opt = catalogOptions.find(
        (p) => p.partInternalCode === code || p.id === optionId
      );
      return opt?.stockAvailable ?? 0;
    },
    [byPart, catalogOptions]
  );

  const closeBtn = (
    <button
      type="button"
      onClick={handleClose}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
      aria-label="Đóng"
    >
      <X className="h-4 w-4" strokeWidth={2.5} />
      Đóng
    </button>
  );

  return (
    <div className={pageShellClass}>
      <div className={pageContentClass}>
        <div className="shrink-0">
          {isDepartmentHead ? (
            <DepartmentPageHero
              kicker="Trưởng bộ phận · Xuất kho"
              title={isEdit ? 'Sửa phiếu xuất (nháp)' : 'Tạo yêu cầu xuất kho'}
              description="Chỉ xuất khi đủ tồn khả dụng. Gửi phiếu sẽ giữ hàng (RESERVED)."
              Icon={Package}
              tint="cyan"
              regionLabel="Tạo phiếu xuất kho"
              rightSlot={closeBtn}
            />
          ) : (
            <RequestorPageHero
              kicker="Requestor · Xuất kho"
              title={isEdit ? 'Sửa phiếu xuất (nháp)' : 'Tạo yêu cầu xuất kho'}
              description="Chỉ xuất khi đủ tồn khả dụng. Gửi phiếu sẽ giữ hàng (RESERVED)."
              Icon={Package}
              tint="cyan"
              regionLabel="Tạo phiếu xuất kho"
              rightSlot={closeBtn}
            />
          )}
        </div>

        <div
          className={`${requestorPanelCardClass} flex min-h-0 flex-1 flex-col overflow-hidden !p-0 shadow-xl shadow-slate-300/50`}
        >
          {linkedPrId ? (
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-teal-50/80 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="rounded-lg bg-emerald-500/15 p-1.5 text-emerald-600">
                  <Link2 className="h-4 w-4" strokeWidth={2.5} />
                </div>
                <p className="text-xs font-bold leading-snug text-emerald-900 sm:text-sm">
                  Phiếu xuất này sẽ tự động gắn với PR{' '}
                  <button
                    type="button"
                    onClick={() => prCopyValue && handleCopyPr(prCopyValue)}
                    className="font-mono rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-800 underline decoration-dotted underline-offset-2 transition hover:bg-emerald-500/20"
                    title="Sao chép mã PR"
                  >
                    {prLinkLabel || '…'}
                  </button>{' '}
                  đã gửi.
                </p>
              </div>
              {copiedPr ? (
                <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 shadow-sm ring-1 ring-emerald-200/60">
                  Đã sao chép!
                </span>
              ) : null}
            </div>
          ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
              <div className="space-y-1.5">
                <label className={labelClass}>
                  <Layers className="h-3.5 w-3.5 text-indigo-500" strokeWidth={2} />
                  Mục đích xuất kho
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="VD: Xuất cho dự án X, bàn giao phòng ban…"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>
                  <FileText className="h-3.5 w-3.5 text-indigo-500" strokeWidth={2} />
                  Ghi chú kèm theo
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Chứng từ đi kèm hoặc lý do xuất…"
                  className={inputClass}
                />
              </div>
            </div>

            {salesPoId ? (
              <p className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Sales PO:</span>{' '}
                {existing?.salesPO ? (
                  <>
                    <span className="font-mono">{existing.salesPO.salesPONumber}</span>
                    {existing.salesPO.customerPONumber ? (
                      <span className="text-slate-500"> · {existing.salesPO.customerPONumber}</span>
                    ) : null}
                  </>
                ) : (
                  'Đã liên kết theo luồng tạo (mã SO hiện sau khi lưu).'
                )}
              </p>
            ) : null}

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                    Danh mục vật tư xuất kho
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {restrictCatalogToPr
                      ? 'Chỉ vật tư trên PR này — không hiển thị toàn bộ kho'
                      : 'Chọn vật tư và nhập số lượng cần bàn giao'}
                  </p>
                </div>
                <div className="relative w-full min-w-[200px] max-w-xs sm:w-auto">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={partListSearch}
                    onChange={(e) => setPartListSearch(e.target.value)}
                    placeholder={
                      restrictCatalogToPr ? 'Tìm trên PR…' : 'Tìm danh mục nhanh…'
                    }
                    className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                  />
                </div>
              </div>

              {restrictCatalogToPr && linkedPrLoading ? (
                <p className="text-xs font-medium text-slate-500">Đang tải vật tư từ PR…</p>
              ) : null}
              {restrictCatalogToPr && !linkedPrLoading && filteredCatalog.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  PR không có dòng nào có mã vật tư (part no) để xuất kho.
                </p>
              ) : null}

              <div className="space-y-2.5">
                {lines.map((row, idx) => {
                  const code = row.partInternalCode.trim();
                  const av = code ? stockAvailableForCode(code, row.catalogPartId) : 0;
                  const stockOk = !code || row.qty <= av + 1e-9;
                  const selectedLabel = row.partName
                    ? `${row.partInternalCode} — ${row.partName}`
                    : row.partInternalCode;

                  return (
                    <div
                      key={row.rowKey}
                      className={`grid grid-cols-1 gap-3 rounded-xl border p-3.5 transition sm:grid-cols-12 sm:gap-3 sm:p-4 ${
                        stockOk
                          ? 'border-slate-200/80 bg-gradient-to-br from-[#fafbfe] to-slate-50/50'
                          : 'border-amber-300/80 bg-amber-50/40'
                      }`}
                    >
                      <div className="space-y-1.5 sm:col-span-7">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Hạng mục #{idx + 1}
                        </span>
                        <div className="relative">
                          <select
                            value={row.catalogPartId}
                            onChange={(e) => applyPart(row.rowKey, e.target.value)}
                            className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-10 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                          >
                            <option value="">
                              {restrictCatalogToPr
                                ? '— Chọn vật tư trên PR —'
                                : '— Chọn vật tư trong kho —'}
                            </option>
                            {filteredCatalog.map((p) => (
                              <option key={`${p.id}-${p.prItemId ?? p.lineNo ?? ''}`} value={p.id}>
                                {p.partInternalCode} — {p.partName}
                                {p.lineNo != null ? ` (dòng ${p.lineNo})` : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>
                        {code ? (
                          <p
                            className={`flex items-center gap-1 text-[10px] font-bold ${
                              stockOk ? 'text-indigo-700' : 'text-amber-800'
                            }`}
                          >
                            <Package className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                            {selectedLabel}
                            <span className="font-normal text-slate-500">· Tồn khả dụng:</span>
                            <span className={stockOk ? 'text-emerald-700' : 'text-amber-900'}>
                              {av}
                            </span>
                            {!stockOk ? (
                              <span className="font-normal"> — giảm SL hoặc tạo PR mua</span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-1.5 sm:col-span-4">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Số lượng xuất
                        </span>
                        <div className="flex h-10 items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                          <button
                            type="button"
                            onClick={() => updateQty(row.rowKey, -1)}
                            className="border-r border-slate-100 px-3 text-slate-500 transition hover:bg-slate-50 active:text-indigo-600"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input
                            type="number"
                            min={0.0001}
                            step="any"
                            value={row.qty}
                            onChange={(e) => setQtyInput(row.rowKey, e.target.value)}
                            className="w-full min-w-0 bg-transparent text-center text-sm font-black tabular-nums text-slate-800 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateQty(row.rowKey, 1)}
                            className="border-l border-slate-100 px-3 text-slate-500 transition hover:bg-slate-50 active:text-indigo-600"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-end justify-end sm:col-span-1">
                        <button
                          type="button"
                          onClick={() => deleteRow(row.rowKey)}
                          disabled={lines.length <= 1}
                          title="Xóa dòng"
                          className={`rounded-xl border p-2 transition ${
                            lines.length <= 1
                              ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300'
                              : 'border-rose-100 bg-rose-500/5 text-rose-500 hover:border-rose-400 hover:bg-rose-500 hover:text-white'
                          }`}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addRow}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-3 text-xs font-bold text-slate-500 transition hover:border-indigo-400 hover:bg-indigo-500/5 hover:text-indigo-600"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Thêm dòng vật tư yêu cầu
              </button>
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/90 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500" strokeWidth={2} />
            Mã hóa bảo mật ERP
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <button
              type="button"
              disabled={busy}
              onClick={handleClose}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onSaveDraft}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-slate-500" />}
              Lưu nháp
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onSubmitReserve}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gửi & giữ hàng
            </button>
          </div>
        </footer>
        </div>
      </div>
    </div>
  );
};

export default CreateStockIssue;
