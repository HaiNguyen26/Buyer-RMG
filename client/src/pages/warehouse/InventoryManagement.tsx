import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Upload,
  Download,
  Save,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Info,
} from 'lucide-react';
import {
  warehouseService,
  type InventoryListRow,
  type InventoryReservationDetailLine,
} from '../../services/warehouseService';
import { useToast } from '../../contexts/ToastContext';
import { AppModal } from '../../components/AppModal';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import {
  dashboardPageContentBottomClass,
  dashboardPageContentInsetBottomWorkspaceClass,
  dashboardPageContentInsetXClass,
} from '../../constants/dashboardLayout';
import {
  departmentHeadInteractiveTableFixed880Class,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableDataRowClasses,
  departmentHeadTableScrollViewportThinBars,
  departmentHeadTableTbodyElevatedClass,
} from '../../constants/departmentHeadLayout';
import { saasTableHeadCellClass, saasTableRootClass } from '../../constants/saasDataTable';

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyRow(): InventoryListRow & { key: string } {
  return {
    key: uid(),
    id: '',
    partCode: '',
    partName: '',
    unit: '',
    quantity: 0,
    quantityReserved: 0,
    minStock: null,
    warehouse: '',
    location: '',
  };
}

type RowWithKey = InventoryListRow & { key: string };

const WAREHOUSE_INVENTORY_DRAFT_KEY = 'warehouse-inventory-grid-draft-v1';
const LS_IMPORT_DEFAULT_WH = 'warehouse-import-default-wh';
const LS_IMPORT_DEFAULT_UT = 'warehouse-import-default-unit';

function isRowBlankForDraft(r: RowWithKey): boolean {
  return (
    !r.partCode.trim() &&
    !r.warehouse.trim() &&
    !r.unit.trim() &&
    (r.quantity === 0 || Number.isNaN(r.quantity)) &&
    !r.partName.trim() &&
    !r.location.trim() &&
    (r.minStock == null || Number.isNaN(Number(r.minStock)))
  );
}

function rowsHavePersistableContent(rows: RowWithKey[]): boolean {
  return rows.some((r) => !isRowBlankForDraft(r));
}

function validateGrid(rows: RowWithKey[]): Map<number, string[]> {
  const issues = new Map<number, string[]>();
  const keyCount = new Map<string, number>();
  rows.forEach((r) => {
    const c = r.partCode.trim().toUpperCase();
    const w = r.warehouse.trim().toUpperCase();
    if (c && w) keyCount.set(`${c}|${w}`, (keyCount.get(`${c}|${w}`) ?? 0) + 1);
  });

  rows.forEach((r, i) => {
    const blank =
      !r.partCode.trim() &&
      !r.warehouse.trim() &&
      !r.unit.trim() &&
      (r.quantity === 0 || Number.isNaN(r.quantity)) &&
      !r.partName.trim() &&
      !r.location.trim() &&
      (r.minStock == null || Number.isNaN(Number(r.minStock)));
    if (blank) return;

    const err: string[] = [];
    if (!r.partCode.trim()) err.push('MISSING_PART');
    if (!r.warehouse.trim()) err.push('MISSING_WAREHOUSE');
    if (!r.unit.trim()) err.push('MISSING_UNIT');
    const q = Number(r.quantity);
    if (Number.isNaN(q) || q < 0) err.push('INVALID_QTY');
    const ms = r.minStock;
    if (ms != null && !Number.isNaN(Number(ms)) && Number(ms) < 0) err.push('INVALID_MIN');
    const k = `${r.partCode.trim().toUpperCase()}|${r.warehouse.trim().toUpperCase()}`;
    if (r.partCode.trim() && r.warehouse.trim() && (keyCount.get(k) ?? 0) > 1) err.push('DUPLICATE_KEY');
    if (err.length) issues.set(i, err);
  });
  return issues;
}

function gridErrorLabel(errs: string[]): string {
  const order = [
    ['MISSING_PART', 'Thiếu mã part'],
    ['MISSING_WAREHOUSE', 'Thiếu kho'],
    ['MISSING_UNIT', 'Thiếu ĐVT'],
    ['INVALID_QTY', 'SL không hợp lệ'],
    ['INVALID_MIN', 'Min không hợp lệ'],
    ['DUPLICATE_KEY', 'Trùng part+kho'],
  ] as const;
  for (const [code, label] of order) {
    if (errs.includes(code)) return label;
  }
  return errs.length ? errs.join(', ') : 'Lỗi';
}

function focusCell(row: number, col: number) {
  const el = document.querySelector(
    `input[data-cell="${row}-${col}"]`
  ) as HTMLInputElement | null;
  requestAnimationFrame(() => el?.focus());
}

const COL_LAST = 6;

export default function InventoryManagement() {
  const { showSuccess, showError, showInfo, showWarning } = useToast();
  const qc = useQueryClient();
  const nextSaveSourceRef = useRef<'manual' | 'import'>('manual');
  const draftToastShownRef = useRef(false);
  const draftWriteGenRef = useRef(0);
  const [rows, setRows] = useState<RowWithKey[]>([emptyRow()]);
  const [reservationModal, setReservationModal] = useState<{
    partCode: string;
    warehouse: string;
  } | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<
    Awaited<ReturnType<typeof warehouseService.importPreview>> | null
  >(null);
  const [importDefaultWarehouse, setImportDefaultWarehouse] = useState(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(LS_IMPORT_DEFAULT_WH) || 'MAIN' : 'MAIN'
  );
  const [importDefaultUnit, setImportDefaultUnit] = useState(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(LS_IMPORT_DEFAULT_UT) || 'pcs' : 'pcs'
  );
  const importFileRef = useRef<File | null>(null);

  const closeImportModal = useCallback(() => {
    setImportOpen(false);
    setImportPreview(null);
    importFileRef.current = null;
  }, []);

  const runImportPreview = useCallback(
    async (file: File) => {
      try {
        const wh = importDefaultWarehouse.trim();
        const ut = importDefaultUnit.trim();
        const prev = await warehouseService.importPreview(file, {
          defaultWarehouse: wh,
          ...(ut ? { defaultUnit: ut } : {}),
        });
        setImportPreview(prev);
        try {
          localStorage.setItem(LS_IMPORT_DEFAULT_WH, wh || 'MAIN');
          if (ut) localStorage.setItem(LS_IMPORT_DEFAULT_UT, ut);
          else localStorage.removeItem(LS_IMPORT_DEFAULT_UT);
        } catch {
          /* ignore */
        }
      } catch {
        showError('Không đọc được file Excel');
      }
    },
    [importDefaultWarehouse, importDefaultUnit, showError]
  );

  useEffect(() => {
    if (!importOpen || !importFileRef.current) return;
    const file = importFileRef.current;
    const t = window.setTimeout(() => {
      void runImportPreview(file);
    }, 150);
    return () => clearTimeout(t);
  }, [importOpen, importDefaultWarehouse, importDefaultUnit, runImportPreview]);

  const { data, isLoading } = useQuery<InventoryListRow[]>({
    queryKey: ['warehouse-inventory'],
    queryFn: warehouseService.list,
  });

  const { data: reservationDetails, isFetching: reservationLoading } = useQuery({
    queryKey: ['warehouse-reservation-details', reservationModal?.partCode, reservationModal?.warehouse],
    queryFn: () =>
      warehouseService.listReservationDetails(
        reservationModal!.partCode,
        reservationModal!.warehouse
      ),
    enabled: !!reservationModal?.partCode && !!reservationModal?.warehouse,
  });

  const reservationLines: InventoryReservationDetailLine[] = reservationDetails?.lines ?? [];

  useEffect(() => {
    if (data === undefined) return;

    const raw = sessionStorage.getItem(WAREHOUSE_INVENTORY_DRAFT_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { rows?: RowWithKey[] };
        if (Array.isArray(parsed.rows) && parsed.rows.length > 0) {
          const hydrated = parsed.rows.map((r) => ({
            ...r,
            key: r.key || uid(),
          }));
          setRows(hydrated);
          if (!draftToastShownRef.current) {
            draftToastShownRef.current = true;
            showInfo(
              'Đã khôi phục lưới chưa lưu (import/chỉnh sửa). Nhấn Lưu để ghi server — hoặc Tải lại từ server để hủy nháp.'
            );
          }
          return;
        }
      } catch {
        sessionStorage.removeItem(WAREHOUSE_INVENTORY_DRAFT_KEY);
      }
    }

    draftToastShownRef.current = false;
    if (data.length > 0) {
      setRows(
        data.map((r) => ({
          ...r,
          key: r.id || uid(),
        }))
      );
    } else {
      setRows([emptyRow()]);
    }
  }, [data, showInfo]);

  useEffect(() => {
    const gen = draftWriteGenRef.current;
    const t = window.setTimeout(() => {
      if (gen !== draftWriteGenRef.current) return;
      if (rowsHavePersistableContent(rows)) {
        sessionStorage.setItem(
          WAREHOUSE_INVENTORY_DRAFT_KEY,
          JSON.stringify({ v: 1, rows, savedAt: Date.now() })
        );
      } else {
        sessionStorage.removeItem(WAREHOUSE_INVENTORY_DRAFT_KEY);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      if (gen !== draftWriteGenRef.current) return;
      if (rowsHavePersistableContent(rows)) {
        sessionStorage.setItem(
          WAREHOUSE_INVENTORY_DRAFT_KEY,
          JSON.stringify({ v: 1, rows, savedAt: Date.now() })
        );
      } else {
        sessionStorage.removeItem(WAREHOUSE_INVENTORY_DRAFT_KEY);
      }
    };
  }, [rows]);

  const issueMap = useMemo(() => validateGrid(rows), [rows]);
  const dupOnly = useMemo(() => {
    const d = new Set<number>();
    issueMap.forEach((errs, i) => {
      if (errs.length === 1 && errs[0] === 'DUPLICATE_KEY') d.add(i);
    });
    return d;
  }, [issueMap]);
  const INVENTORY_ROWS_VISIBLE = 10;
  const inventoryTableViewportHeightPx = 44 + INVENTORY_ROWS_VISIBLE * 56;

  const saveMutation = useMutation({
    mutationFn: () =>
      warehouseService.save(rows, nextSaveSourceRef.current === 'import' ? 'import' : undefined),
    onSuccess: (res) => {
      nextSaveSourceRef.current = 'manual';
      draftWriteGenRef.current += 1;
      sessionStorage.removeItem(WAREHOUSE_INVENTORY_DRAFT_KEY);
      draftToastShownRef.current = false;
      showSuccess(`Đã lưu ${res.saved} dòng`);
      qc.invalidateQueries({ queryKey: ['warehouse-inventory'] });
      qc.invalidateQueries({ queryKey: ['warehouse-dashboard'] });
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { issues?: unknown; error?: string } } };
      showError(ax.response?.data?.error || 'Lưu thất bại');
    },
  });

  const addRow = () => setRows((p) => [...p, emptyRow()]);

  const onBlurPartCode = async (index: number) => {
    const code = rows[index]?.partCode.trim();
    if (!code) return;
    try {
      const hit = await warehouseService.lookup(code);
      if (hit) {
        setRows((prev) => {
          const n = [...prev];
          const row = n[index];
          if (!row) return prev;
          n[index] = {
            ...row,
            partName: row.partName.trim() || hit.partName,
            unit: row.unit.trim() || hit.unit,
          };
          return n;
        });
      }
    } catch {
      /* ignore */
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      let nc = col + (e.shiftKey ? -1 : 1);
      let nr = row;
      if (!e.shiftKey && nc > COL_LAST) {
        nc = 0;
        nr += 1;
        setRows((prev) => (nr >= prev.length ? [...prev, emptyRow()] : prev));
        setTimeout(() => focusCell(nr, nc), 0);
        return;
      }
      if (e.shiftKey && nc < 0) {
        nc = COL_LAST;
        nr -= 1;
        if (nr < 0) nr = 0;
      }
      focusCell(nr, nc);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const nr = row + 1;
      setRows((prev) => (nr >= prev.length ? [...prev, emptyRow()] : prev));
      setTimeout(() => focusCell(nr, col), 0);
    }
  };

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData?.getData('text/plain');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) return;
    const target = e.target as HTMLInputElement;
    const sr = Number(target.dataset.row);
    const sc = Number(target.dataset.col);
    if (Number.isNaN(sr) || Number.isNaN(sc)) return;
    e.preventDefault();

    const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
    setRows((prev) => {
      const next = [...prev];
      const need = sr + lines.length;
      while (next.length < need) next.push(emptyRow());
      lines.forEach((line, li) => {
        const cells = line.split('\t');
        const tr = sr + li;
        const row = { ...next[tr], key: next[tr].key };
        cells.forEach((cell, ci) => {
          const tc = sc + ci;
          const v = cell.trim();
          if (tc === 0) row.partCode = v;
          else if (tc === 1) row.partName = v;
          else if (tc === 2) row.unit = v;
          else if (tc === 3) row.quantity = v === '' ? 0 : Number(String(v).replace(',', '.'));
          else if (tc === 4) row.minStock = v === '' ? null : Number(String(v).replace(',', '.'));
          else if (tc === 5) row.warehouse = v;
          else if (tc === 6) row.location = v;
        });
        next[tr] = row;
      });
      return next;
    });
  }, []);

  const totalItems = rows.filter((r) => r.partCode.trim() && r.warehouse.trim()).length;
  const totalQty = rows.reduce((s, r) => s + (Number.isFinite(Number(r.quantity)) ? Number(r.quantity) : 0), 0);
  const errorRows = issueMap.size;

  const rowBg = (i: number) => {
    const errs = issueMap.get(i);
    if (!errs?.length) return '';
    const hard = errs.some((e) => e !== 'DUPLICATE_KEY');
    if (hard) return 'bg-red-50/90 border-red-200';
    if (errs.includes('DUPLICATE_KEY')) return 'bg-amber-50/90 border-amber-200';
    return '';
  };

  const onImportFile = (f: File) => {
    importFileRef.current = f;
    setImportPreview(null);
    setImportOpen(true);
  };

  const applyImport = () => {
    if (!importPreview?.length) {
      closeImportModal();
      return;
    }
    const valid = importPreview.filter((p) => p.errors.length === 0);
    if (valid.length === 0) {
      showError(
        'Không có dòng hợp lệ. File thường thiếu cột kho — đặt "Mã kho mặc định" trong hộp Import hoặc thêm cột warehouse trong Excel.'
      );
      return;
    }
    const skipped = importPreview.length - valid.length;
    const mapped: RowWithKey[] = valid.map((p) => ({
      key: uid(),
      id: '',
      partCode: p.partCode,
      partName: p.partName,
      unit: p.unit,
      quantity: p.quantity,
      quantityReserved: 0,
      minStock: p.minStock ?? null,
      warehouse: p.warehouse,
      location: p.location,
    }));
    nextSaveSourceRef.current = 'import';
    setRows((prev) => [...prev.filter((r) => r.partCode.trim() || r.warehouse.trim()), ...mapped, emptyRow()]);
    closeImportModal();
    if (skipped > 0) {
      showWarning(`Đã nhập ${valid.length} dòng; bỏ qua ${skipped} dòng lỗi — kiểm tra và bấm Save`);
    } else {
      showSuccess(`Đã nhập ${valid.length} dòng — kiểm tra và bấm Save`);
    }
  };

  if (isLoading && data === undefined) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-24 text-slate-500">
        Đang tải tồn kho…
      </div>
    );
  }

  return (
    <div
      className="flex min-w-0 w-full flex-col overflow-x-clip animate-fade-in"
      onPaste={onPaste}
    >
        <div
          className={`mx-auto flex w-full max-w-none flex-col space-y-3 pt-1.5 sm:pt-2 ${dashboardPageContentInsetXClass} ${dashboardPageContentInsetBottomWorkspaceClass}`}
        >
      <RequestorPageHero
        kicker="Kho · Tồn kho"
        title="Inventory Management"
        description="Lưới chỉnh sửa tồn kho, hỗ trợ import Excel và xem chi tiết giữ chỗ."
        Icon={Upload}
        tint="teal"
        regionLabel="Quản lý tồn kho"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
        >
          <Plus className="w-4 h-4" />
          Add Row
        </button>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium cursor-pointer hover:bg-slate-50">
          <Upload className="w-4 h-4" />
          Import Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setImportOpen(true);
                onImportFile(f);
              }
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => warehouseService.downloadTemplate()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50"
        >
          <Download className="w-4 h-4" />
          Export Template
        </button>
        <button
          type="button"
          disabled={saveMutation.isPending || errorRows > 0}
          onClick={() => {
            if (errorRows > 0) {
              showError('Sửa lỗi (ô đỏ/vàng) trước khi lưu');
              return;
            }
            saveMutation.mutate();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
        <button
          type="button"
          title="Xóa nháp và lấy lại dữ liệu từ server"
          onClick={async () => {
            draftWriteGenRef.current += 1;
            sessionStorage.removeItem(WAREHOUSE_INVENTORY_DRAFT_KEY);
            draftToastShownRef.current = false;
            try {
              const fresh = await qc.fetchQuery({
                queryKey: ['warehouse-inventory'],
                queryFn: warehouseService.list,
              });
              if (fresh && fresh.length > 0) {
                setRows(fresh.map((r) => ({ ...r, key: r.id || uid() })));
              } else {
                setRows([emptyRow()]);
              }
              showInfo('Đã tải lại từ server');
            } catch {
              showError('Không tải được từ server');
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
          Tải lại từ server
        </button>
      </div>

      <div className="min-w-0 w-full rounded-2xl border border-slate-200 bg-white shadow-[0_24px_48px_-20px_rgba(15,23,42,0.36)] ring-1 ring-slate-900/5">
        <div
          className={`${departmentHeadTableScrollViewportThinBars} relative min-h-0 w-full rounded-2xl`}
          style={{
            height: inventoryTableViewportHeightPx,
            minHeight: inventoryTableViewportHeightPx,
            maxHeight: inventoryTableViewportHeightPx,
          }}
        >
        <table
          className={`${departmentHeadInteractiveTableFixed880Class} ${saasTableRootClass} w-full min-w-[1240px] text-sm`}
        >
          <colgroup>
            <col className="w-[44px]" />
            <col className="w-[11%]" />
            <col className="w-[20%]" />
            <col className="w-[7%]" />
            <col className="w-[9%]" />
            <col className="w-[7%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
            <col className="w-[15%]" />
          </colgroup>
          <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 shadow-[inset_0_-1px_0_0_rgb(226_232_240)] backdrop-blur-sm">
            <tr>
              <th className={`${saasTableHeadCellClass} bg-slate-50/95 px-2 py-2.5 text-center`}>#</th>
              <th className={`${saasTableHeadCellClass} bg-slate-50/95 px-2 py-2.5 text-left`}>Part Code</th>
              <th className={`${saasTableHeadCellClass} bg-slate-50/95 px-2 py-2.5 text-left`}>Part Name</th>
              <th className={`${saasTableHeadCellClass} bg-slate-50/95 px-2 py-2.5 text-left`}>Unit</th>
              <th className={`${saasTableHeadCellClass} bg-slate-50/95 px-2 py-2.5 text-left`}>Quantity</th>
              <th className={`${saasTableHeadCellClass} bg-slate-50/95 px-2 py-2.5 text-left`}>Min</th>
              <th className={`${saasTableHeadCellClass} bg-slate-50/95 px-2 py-2.5 text-left`}>Warehouse</th>
              <th className={`${saasTableHeadCellClass} bg-slate-50/95 px-2 py-2.5 text-left`}>Location</th>
              <th className={`${saasTableHeadCellClass} bg-slate-50/95 px-2 py-2.5 text-left`}>Đặt cọc</th>
              <th className={`${saasTableHeadCellClass} bg-slate-50/95 px-2 py-2.5 text-left`}>Status</th>
            </tr>
          </thead>
          <tbody className={departmentHeadTableTbodyElevatedClass}>
            {rows.map((row, i) => {
              const errs = issueMap.get(i);
              const onlyDup = errs?.length === 1 && errs[0] === 'DUPLICATE_KEY';
              const statusIcon =
                !errs?.length && (row.partCode.trim() || row.warehouse.trim()) ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <CheckCircle className="w-4 h-4" /> OK
                  </span>
                ) : onlyDup ? (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <AlertTriangle className="w-4 h-4" /> Trùng kho+mã
                  </span>
                ) : errs?.length ? (
                  <span className="inline-flex items-center gap-1 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    {gridErrorLabel(errs)}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                );

              return (
                <tr key={row.key} className={`${departmentHeadTableDataRowClasses(i, { h72: true })} ${rowBg(i)}`}>
                  <td className="px-2 py-1 text-center text-slate-500 tabular-nums">
                    <div className={departmentHeadTableCellContentWrapClass}>{i + 1}</div>
                  </td>
                  {(
                    [
                      ['partCode', row.partCode, 'text'] as const,
                      ['partName', row.partName, 'text'] as const,
                      ['unit', row.unit, 'text'] as const,
                      ['quantity', String(row.quantity), 'number'] as const,
                      [
                        'minStock',
                        row.minStock == null || Number.isNaN(Number(row.minStock)) ? '' : String(row.minStock),
                        'number',
                      ] as const,
                      ['warehouse', row.warehouse, 'text'] as const,
                      ['location', row.location, 'text'] as const,
                    ] as const
                  ).map(([field, val, typ], colIdx) => (
                    <td key={field} className="p-0">
                      <input
                        data-cell={`${i}-${colIdx}`}
                        data-row={i}
                        data-col={colIdx}
                        type={typ === 'number' ? 'number' : 'text'}
                        min={typ === 'number' ? 0 : undefined}
                        step={typ === 'number' ? 'any' : undefined}
                        className="w-full min-w-0 rounded-md px-2 py-1.5 bg-transparent outline-none focus:ring-2 focus:ring-teal-400/40 text-slate-800"
                        value={val}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRows((prev) => {
                            const n = [...prev];
                            const r = { ...n[i] };
                            if (field === 'quantity') r.quantity = v === '' ? 0 : Number(v);
                            else if (field === 'minStock')
                              r.minStock = v === '' ? null : Number(String(v).replace(',', '.'));
                            else (r as Record<string, string>)[field] = v;
                            n[i] = r;
                            return n;
                          });
                        }}
                        onKeyDown={(e) => handleKeyDown(e, i, colIdx)}
                        onBlur={() => field === 'partCode' && onBlurPartCode(i)}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-slate-600 tabular-nums bg-slate-50/80">
                    <div className="flex items-center justify-between gap-1">
                      <span>{row.quantityReserved}</span>
                      {row.quantityReserved > 0 && row.partCode.trim() && row.warehouse.trim() ? (
                        <button
                          type="button"
                          title="Xem giữ chỗ theo phiếu xuất / PR / dự án"
                          onClick={() =>
                            setReservationModal({
                              partCode: row.partCode.trim(),
                              warehouse: row.warehouse.trim(),
                            })
                          }
                          className="shrink-0 rounded-lg p-1 text-teal-700 hover:bg-teal-100"
                        >
                          <Info className="h-4 w-4" strokeWidth={2} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-xs">
                    <div className={departmentHeadTableCellContentWrapClass}>{statusIcon}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <footer className="flex flex-wrap gap-6 text-sm text-slate-700 border-t border-slate-200 pt-4">
        <span>
          <strong>Total Items:</strong> {totalItems}
        </span>
        <span>
          <strong>Total Quantity:</strong> {totalQty.toLocaleString()}
        </span>
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className={`w-4 h-4 ${errorRows ? 'text-amber-600' : 'text-slate-300'}`} />
          <strong>Errors:</strong> {errorRows} dòng
        </span>
        {dupOnly.size > 0 && (
          <span className="text-amber-700">Trùng (part + warehouse): {dupOnly.size} dòng — tô vàng</span>
        )}
      </footer>
        </div>

      <AppModal
        open={!!reservationModal}
        onClose={() => setReservationModal(null)}
        title="Chi tiết đặt cọc (giữ chỗ)"
        subtitle={
          reservationModal
            ? `${reservationModal.partCode} · Kho ${reservationModal.warehouse}`
            : undefined
        }
        size="3xl"
        zIndexClass="z-[200]"
        className="!rounded-3xl shadow-2xl ring-1 ring-slate-200/70"
        footer={
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setReservationModal(null)}
          >
            Đóng
          </button>
        }
      >
        <div className="max-h-[min(60vh,28rem)] overflow-auto rounded-xl border border-slate-100">
          {reservationLoading ? (
            <p className="p-4 text-sm text-slate-500">Đang tải…</p>
          ) : reservationLines.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Không có bản ghi giữ chỗ (hoặc phiếu đã đóng).</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 font-semibold text-slate-700">SL giữ</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Phiếu xuất</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Trạng thái</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">PR</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Dự án (PR / SO)</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Người yêu cầu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservationLines.map((ln) => {
                  const prProj = [ln.purchaseRequest?.projectCode, ln.purchaseRequest?.projectName]
                    .filter(Boolean)
                    .join(' — ');
                  const soProj = [ln.salesPO?.projectCode, ln.salesPO?.projectName]
                    .filter(Boolean)
                    .join(' — ');
                  const projectLabel = [prProj, soProj].filter(Boolean).join(' · ') || '—';
                  return (
                    <tr key={ln.reservationId} className="bg-white">
                      <td className="px-3 py-2 tabular-nums font-medium">
                        {ln.qtyReserved.toLocaleString('vi-VN')}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-800">{ln.issueNumber}</td>
                      <td className="px-3 py-2 text-xs uppercase text-slate-600">{ln.issueStatus}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {ln.purchaseRequest?.prNumber ?? '—'}
                      </td>
                      <td className="max-w-[220px] px-3 py-2 text-xs text-slate-600">
                        {projectLabel}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {ln.requestor?.fullName || ln.requestor?.username || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </AppModal>

      <AppModal
        open={importOpen}
        onClose={closeImportModal}
        title="Import — Preview"
        subtitle="Xem lại dữ liệu Excel; nền mờ phủ toàn màn hình."
        size="3xl"
        zIndexClass="z-[200]"
        className="!rounded-3xl shadow-2xl ring-1 ring-slate-200/70"
        description="Hộp thoại xem trước import tồn kho từ file Excel."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              onClick={closeImportModal}
            >
              Hủy
            </button>
            <button
              type="button"
              className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
              onClick={applyImport}
            >
              Import vào lưới
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/90 px-4 py-3 sm:px-5">
            <p className="text-xs leading-relaxed text-slate-600">
              Nhiều file chỉ có part / tên / SL mà không có cột kho. Điền mã kho áp dụng cho các ô trống (mặc định{' '}
              <strong>MAIN</strong>). Đổi giá trị để xem preview cập nhật.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 items-end">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Mã kho mặc định</span>
                <input
                  type="text"
                  className="w-44 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  value={importDefaultWarehouse}
                  onChange={(e) => setImportDefaultWarehouse(e.target.value)}
                  placeholder="VD: WH-HCM, MAIN…"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Đơn vị mặc định (nếu file thiếu)</span>
                <input
                  type="text"
                  className="w-32 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  value={importDefaultUnit}
                  onChange={(e) => setImportDefaultUnit(e.target.value)}
                  placeholder="pcs"
                />
              </label>
            </div>
          </div>
          <div className="max-h-[min(52vh,28rem)] overflow-auto rounded-2xl border border-slate-200 bg-white">
            {!importPreview?.length ? (
              <p className="p-6 text-center text-sm text-slate-500">Đang đọc file…</p>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 z-[1] bg-slate-100/95 backdrop-blur-sm">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Row</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Part Code</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-700">ĐVT</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Tồn (quantity_available)</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Mã kho (warehouse_code)</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((p) => (
                    <tr key={p.rowIndex} className="border-t border-slate-100">
                      <td className="px-3 py-2">{p.rowIndex}</td>
                      <td className="px-3 py-2">{p.partCode || '(empty)'}</td>
                      <td className="px-3 py-2">{p.unit || '—'}</td>
                      <td className="px-3 py-2">{p.quantity}</td>
                      <td className="px-3 py-2 font-mono text-xs">{p.warehouse || '—'}</td>
                      <td className="px-3 py-2">
                        {p.errors.length ? (
                          <span className="text-xs text-red-600">{gridErrorLabel(p.errors)}</span>
                        ) : (
                          <span className="text-emerald-600">✅</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </AppModal>
    </div>
  );
}

