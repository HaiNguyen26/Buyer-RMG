import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestorService, type PartCatalogRow } from '../../services/requestorService';
import {
  createStockIssue,
  getPartStockAvailability,
  type CreateStockIssueLine,
} from '../../services/stockIssueService';
import { useCurrentUser } from '../../hooks/useAuth';
import { useToast } from '../../contexts/ToastContext';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Eye,
  FileSpreadsheet,
  FileText,
  FileUp,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  User,
  TrendingUp,
} from 'lucide-react';
import CustomSelect from '../../components/CustomSelect';
import { VndIntegerInput } from '../../components/VndIntegerInput';
import { RequestorPageHero } from '../../components/RequestorPageHero';
import { RequestorCustomerPODetailModal } from '../../components/RequestorCustomerPODetailModal';
import { parseMaterialImportFile } from '../../utils/prMaterialImport';
import { formatIsoDateToDdMmYyyy } from '../../utils/dateDisplay';

const createPRSchema = z.object({
  department: z.string().min(1, 'Vui lòng chọn Phòng ban'),
  type: z.enum(['COMMERCIAL', 'PRODUCTION', 'PROJECT', 'OFFICE']).default('PRODUCTION'),
  requiredDate: z.string().optional(),
  currency: z.string().default('VND'),
  tax: z.number().min(0, 'Thuế không được âm').optional(),
  notes: z.string().optional(),
  purpose: z.string().optional(),
  salesPOId: z.string().uuid().optional().or(z.literal('')),
  customerPO: z.string().optional(),
  projectCode: z.string().optional(),
  projectName: z.string().optional(),
  customerName: z.string().optional(),
  salesPersonId: z.string().optional(),
  items: z
    .array(
      z.object({
        // Cho phép để trống catalogPartId (đặc biệt với dòng import chưa map danh mục)
        catalogPartId: z.string().optional().default(''),
        itemType: z.enum(['STANDARD', 'CUSTOM']),
        description: z.string().min(1, 'Tên vật tư là bắt buộc'),
        partNo: z.string().min(1, 'Thiếu mã vật tư'),
        model: z.string().optional(),
        spec: z.string().optional(),
        manufacturer: z.string().optional(),
        itemAttachmentLink: z.string().optional(),
        qty: z.number().positive('Số lượng phải lớn hơn 0'),
        unit: z.string().min(1, 'Thiếu đơn vị'),
        estimatedUnitPriceVnd: z.preprocess((v) => {
          if (v === '' || v === null || v === undefined) return undefined;
          if (typeof v === 'number' && Number.isNaN(v)) return undefined;
          const s = typeof v === 'number' ? String(v) : String(v);
          const intPart = s.split(',')[0] ?? s;
          const digits = intPart.replace(/\s/g, '').replace(/\./g, '');
          if (!digits) return undefined;
          const n = Number(digits.replace(',', '.'));
          if (!Number.isFinite(n) || n < 0) return undefined;
          return Math.round(n);
        }, z.number().optional()),
        desiredDeliveryDate: z.preprocess(
          (v) => (v === '' || v == null ? undefined : String(v).trim()),
          z.string().optional()
        ),
        purpose: z.string().optional(),
        remark: z.string().optional(),
        /** Dòng từ file import — không hiện lại dropdown chọn danh mục */
        fromImport: z.boolean().optional().default(false),
      })
    )
    .min(1, 'Cần ít nhất 1 dòng vật tư/dịch vụ'),
});

type CreatePRFormInput = z.input<typeof createPRSchema>;
type CreatePRForm = z.output<typeof createPRSchema>;

type ItemRuleIssue = {
  index: number;
  messages: string[];
};

/** Chuẩn hoá id Sales PO trước khi gọi API — trim + UUID hợp lệ (không dùng length === 36 vì dễ sai với khoảng trắng / format lệch). */
function optionalSalesPOUuid(raw: string | undefined | null): string | undefined {
  if (raw == null) return undefined;
  const t = String(raw).trim();
  if (!t) return undefined;
  return z.string().uuid().safeParse(t).success ? t : undefined;
}

type LineStockAnalysis = {
  available: number;
  requestedQty: number;
  issueQty: number;
  prQty: number;
  badge: 'full' | 'partial' | 'short';
};

function analyzeLineStock(
  line: { partNo?: string | null; qty?: number | null },
  byPart: Record<string, { available: number; onHand: number; reserved: number }>
): LineStockAnalysis {
  const code = line.partNo?.trim() ?? '';
  const qty = Number(line.qty ?? 0);
  const available = code ? Number(byPart[code]?.available ?? 0) : 0;
  const issueQty = Math.min(qty, Math.max(0, available));
  const prQty = Math.max(0, qty - available);
  let badge: LineStockAnalysis['badge'];
  if (prQty === 0) badge = 'full';
  else if (issueQty === 0) badge = 'short';
  else badge = 'partial';
  return { available, requestedQty: qty, issueQty, prQty, badge };
}

function buildIssueLinesFromForm(
  data: CreatePRForm,
  analyses: LineStockAnalysis[]
): CreateStockIssueLine[] {
  const lines: CreateStockIssueLine[] = [];
  data.items.forEach((it, i) => {
    const a = analyses[i];
    if (a.issueQty <= 0) return;
    const specRemark = [it.spec, it.remark].filter(Boolean).join(' · ');
    lines.push({
      partInternalCode: it.partNo.trim(),
      partName: it.description,
      unit: it.unit,
      qty: a.issueQty,
      description: specRemark || undefined,
    });
  });
  return lines;
}

type CreatePRMutationVars = CreatePRForm & {
  action: 'SAVE' | 'SUBMIT';
  skipNavigate?: boolean;
  itemAttachmentRows?: Array<{ lineNo: number; files: File[] }>;
};

const ALLOWED_SITE_CODES = new Set(['HCM', 'HN', 'QN']);
const normalizeSiteCode = (raw?: string | null) => {
  const value = String(raw ?? '').trim().toUpperCase();
  if (ALLOWED_SITE_CODES.has(value)) return value;
  return 'HCM';
};

const ensurePrNumberHasSite = (prNumber: string, siteCode?: string | null) => {
  const normalized = String(prNumber ?? '').trim();
  if (!normalized) return normalized;
  if (/^(HCM|HN|QN)-/i.test(normalized)) return normalized;
  return `${normalizeSiteCode(siteCode)}-${normalized}`;
};

/** Ngày trễ nhất (max calendar date) trong các `desiredDeliveryDate` (yyyy-mm-dd) của từng dòng vật tư */
function maxDesiredDeliveryDateIso(
  lines: Array<{ desiredDeliveryDate?: string | null | undefined }>
): string {
  let maxMs = -Infinity;
  for (const line of lines) {
    const raw = line?.desiredDeliveryDate;
    if (raw == null || !String(raw).trim()) continue;
    const t = String(raw).trim().slice(0, 10);
    const parts = t.split('-').map((x) => Number(x));
    if (parts.length !== 3) continue;
    const [y, mo, d] = parts;
    if (!y || !mo || !d || mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    const ms = new Date(y, mo - 1, d).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms > maxMs) maxMs = ms;
  }
  if (!Number.isFinite(maxMs) || maxMs === -Infinity) return '';
  const dt = new Date(maxMs);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const createPRShellClass = 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#f1f5f9]';
const createPRScrollClass =
  'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto';
const createPRContentClass =
  'mx-auto w-full max-w-[1800px] min-w-0 space-y-4 px-2 pt-3 pb-3 sm:space-y-5 sm:px-3 sm:pt-4 sm:pb-4 md:space-y-6 md:px-6';

const CreatePR = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const canSubmitForApproval = !!currentUser?.directManagerCode?.trim();
  const { showSuccess, showError } = useToast();
  const [attachments, setAttachments] = useState<File[]>([]);
  const [itemAttachments, setItemAttachments] = useState<Record<string, File[]>>({});
  const [localCreatedParts, setLocalCreatedParts] = useState<PartCatalogRow[]>([]);
  const localCreatedPartIdSet = useMemo(() => new Set(localCreatedParts.map((p) => p.id)), [localCreatedParts]);
  const [partListSearch, setPartListSearch] = useState('');
  const [newPartOpen, setNewPartOpen] = useState(false);
  const [newPartRowIndex, setNewPartRowIndex] = useState<number | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const materialImportRef = useRef<HTMLInputElement>(null);
  const [materialImportBusy, setMaterialImportBusy] = useState(false);
  const [newPartForm, setNewPartForm] = useState({
    partInternalCode: '',
    partName: '',
    unit: 'pcs',
    manufacturer: '',
    referenceUrl: '',
  });
  const [customerPODetailOpen, setCustomerPODetailOpen] = useState(false);
  const [allStockModalOpen, setAllStockModalOpen] = useState(false);
  const [afterPrIssueModalOpen, setAfterPrIssueModalOpen] = useState(false);
  const [pendingIssueContext, setPendingIssueContext] = useState<{
    purpose?: string;
    notes?: string;
    items: CreateStockIssueLine[];
  } | null>(null);
  const [postPrIssueContext, setPostPrIssueContext] = useState<{
    purchaseRequestId: string;
    prNumber: string;
    items: CreateStockIssueLine[];
  } | null>(null);
  /** Bấm "Để sau" sau khi gửi PR: đang tạo phiếu xuất kho nháp để hiện trong Theo dõi phiếu xuất kho */
  const [deferPostPrStockIssueBusy, setDeferPostPrStockIssueBusy] = useState(false);

  useEffect(() => {
    const lockScroll = newPartOpen || afterPrIssueModalOpen;
    if (!lockScroll) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [newPartOpen, afterPrIssueModalOpen]);

  // Determine back route based on current pathname
  const getBackRoute = () => {
    if (location.pathname.includes('/department-head')) {
      return '/dashboard/department-head/my-prs';
    }
    return '/dashboard/requestor/pr';
  };

  const getStockIssueDetailPath = (issueId: string) =>
    location.pathname.includes('/department-head')
      ? `/dashboard/department-head/stock-issues/${issueId}`
      : `/dashboard/requestor/stock-issues/${issueId}`;

  const getStockIssuesListPath = () =>
    location.pathname.includes('/department-head')
      ? '/dashboard/department-head/stock-issues'
      : '/dashboard/requestor/stock-issues';

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<CreatePRFormInput, unknown, CreatePRForm>({
    resolver: zodResolver(createPRSchema),
    mode: 'onChange', // Enable real-time validation and updates
    defaultValues: {
      currency: 'VND',
      type: 'PRODUCTION',
      salesPOId: '',
      purpose: '',
      customerPO: '',
      projectCode: '',
      projectName: '',
      customerName: '',
      salesPersonId: '',
      notes: '',
      items: [
        {
          catalogPartId: '',
          itemType: 'STANDARD',
          description: '',
          partNo: '',
          model: '',
          spec: '',
          manufacturer: '',
          itemAttachmentLink: '',
          qty: 1,
          unit: '',
          purpose: '',
          remark: '',
          estimatedUnitPriceVnd: undefined,
          desiredDeliveryDate: '',
          fromImport: false,
        },
      ],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'items',
  });

  const department = watch('department');
  const prType = watch('type');
  const salesPOId = watch('salesPOId');
  const items = useWatch({ control, name: 'items' }) || [];

  const partCodesForStock = useMemo(() => {
    const set = new Set<string>();
    for (const line of items) {
      const c = line?.partNo?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [items]);

  const { data: partStockData, isFetching: partStockFetching } = useQuery({
    queryKey: ['create-pr-part-stock', partCodesForStock.join('|')],
    queryFn: () => getPartStockAvailability(partCodesForStock),
    enabled: partCodesForStock.length > 0,
    staleTime: 10_000,
  });
  const byPartLive = partStockData?.byPart ?? {};

  const lineAnalysesPreview = useMemo(
    () => items.map((line) => analyzeLineStock(line, byPartLive)),
    [items, byPartLive]
  );
  const userSiteCode = normalizeSiteCode(currentUser?.location);

  const needsPrPath = useMemo(
    () => lineAnalysesPreview.some((a) => a.prQty > 0),
    [lineAnalysesPreview]
  );

  // Tính tổng giá trị PR (dự kiến)
  const estimatedTotalValue = useMemo(() => {
    return items.reduce((sum, item) => {
      const unitPrice = Number(item?.estimatedUnitPriceVnd ?? 0);
      const qty = Number(item?.qty ?? 0);
      return sum + unitPrice * qty;
    }, 0);
  }, [items]);

  const latestExpectedReceiveDateIso = useMemo(
    () =>
      maxDesiredDeliveryDateIso(
        items as Array<{ desiredDeliveryDate?: string | null | undefined }>
      ),
    [items]
  );

  useEffect(() => {
    setValue('requiredDate', latestExpectedReceiveDateIso, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [latestExpectedReceiveDateIso, setValue]);

  const {
    data: catalogParts = [],
    isLoading: catalogLoading,
    isError: catalogQueryFailed,
    error: catalogQueryError,
    refetch: refetchCatalog,
  } = useQuery({
    queryKey: ['part-catalog', partListSearch],
    queryFn: () => requestorService.listPartCatalog(partListSearch || undefined),
    staleTime: 30_000,
    retry: 1,
  });

  const catalogErrorMessage = useMemo(() => {
    if (!catalogQueryFailed || catalogQueryError == null) return '';
    const err = catalogQueryError as {
      message?: string;
      response?: { data?: { message?: unknown; error?: unknown } };
    };
    const d = err.response?.data;
    if (d && typeof d.message === 'string') return d.message;
    if (d && typeof d.error === 'string') return d.error;
    if (typeof err.message === 'string') return err.message;
    return 'Lỗi tải danh mục vật tư.';
  }, [catalogQueryFailed, catalogQueryError]);

  const mergedCatalogParts = useMemo(() => {
    const existingCodes = new Set(catalogParts.map((p) => p.partInternalCode.trim().toUpperCase()));
    const locals = localCreatedParts.filter((p) => !existingCodes.has(p.partInternalCode.trim().toUpperCase()));
    return [...locals, ...catalogParts];
  }, [catalogParts, localCreatedParts]);

  const applyCatalogPart = (rowIndex: number, partId: string) => {
    if (!partId || partId === '__NEW__') return;
    const p = mergedCatalogParts.find((x) => x.id === partId);
    if (!p) return;
    setValue(`items.${rowIndex}.catalogPartId`, p.id, { shouldValidate: true, shouldDirty: true });
    setValue(`items.${rowIndex}.partNo`, p.partInternalCode, { shouldValidate: true, shouldDirty: true });
    setValue(`items.${rowIndex}.description`, p.partName, { shouldValidate: true, shouldDirty: true });
    setValue(`items.${rowIndex}.unit`, p.unit, { shouldValidate: true, shouldDirty: true });
    setValue(`items.${rowIndex}.manufacturer`, p.manufacturer || '', { shouldValidate: true, shouldDirty: true });
    const ref = (p.referenceUrl ?? '').trim();
    if (ref) {
      const cur = (getValues(`items.${rowIndex}.spec`) ?? '').trim();
      if (!cur) setValue(`items.${rowIndex}.spec`, ref, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleMaterialImportFile = async (file: File) => {
    setMaterialImportBusy(true);
    try {
      const parsed = await parseMaterialImportFile(file);
      if (!parsed.length) {
        showError('File không có dòng hợp lệ. Cần cột part_internal_code (mã vật tư).');
        return;
      }
      const codes = [...new Set(parsed.map((r) => r.partInternalCode.trim()).filter(Boolean))];
      const { parts } = await requestorService.resolvePartCatalogByCodes(codes);

      const partByUpper = new Map(parts.map((p) => [p.partInternalCode.trim().toUpperCase(), p]));

      /** Mã có trong file nhưng chưa có PartMaster — vẫn hiện dòng (mua mới), dùng vật tư tạm phiên */
      const localImportByCode = new Map<string, PartCatalogRow>();
      const newId = () =>
        typeof globalThis.crypto?.randomUUID === 'function'
          ? `local-import-${globalThis.crypto.randomUUID()}`
          : `local-import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      for (const row of parsed) {
        const u = row.partInternalCode.trim().toUpperCase();
        if (!u || partByUpper.has(u) || localImportByCode.has(u)) continue;
        const fr = row;
        localImportByCode.set(u, {
          id: newId(),
          partInternalCode: fr.partInternalCode.trim(),
          partName: (fr.partName?.trim() || fr.partInternalCode.trim()).slice(0, 500),
          unit: (fr.unit?.trim() || 'pcs').slice(0, 40),
          manufacturer: fr.manufacture?.trim() || null,
          referenceUrl: fr.specification?.trim() || null,
          stockAvailable: 0,
        });
      }

      setLocalCreatedParts((prev) => {
        const have = new Set(prev.map((x) => x.partInternalCode.trim().toUpperCase()));
        const fromResolved = parts.filter((p) => !have.has(p.partInternalCode.trim().toUpperCase()));
        const fromImportLocal = [...localImportByCode.values()].filter((p) => !have.has(p.partInternalCode.trim().toUpperCase()));
        return [...fromImportLocal, ...fromResolved, ...prev];
      });

      const newRows: CreatePRForm['items'] = [];
      for (const row of parsed) {
        const u = row.partInternalCode.trim().toUpperCase();
        if (!u) continue;
        const p = partByUpper.get(u) ?? localImportByCode.get(u);
        if (!p) continue;

        const fromFile = row.quantity != null && Number.isFinite(row.quantity) && row.quantity > 0 ? row.quantity : undefined;
        // Luôn có SL dương: ưu tiên file — không gán theo tồn (tồn chỉ dùng khi gửi: xuất kho / PR qua analyzeLineStock)
        const qty = fromFile != null ? fromFile : 1;

        const desc = row.partName?.trim() || p.partName;
        const spec = row.specification?.trim() || '';
        const mfr = row.manufacture?.trim() || p.manufacturer || '';
        newRows.push({
          catalogPartId: p.id,
          itemType: 'STANDARD',
          description: desc,
          partNo: p.partInternalCode,
          model: 'Import',
          spec,
          manufacturer: mfr,
          itemAttachmentLink: '',
          qty,
          unit: (row.unit?.trim() || p.unit || 'pcs').trim(),
          purpose: '',
          remark: localImportByCode.has(u) ? 'Import: mã chưa có trong danh mục — cần tạo Part / chỉnh trước khi gửi' : '',
          estimatedUnitPriceVnd: row.estimatedCost,
          desiredDeliveryDate: row.leadTime ?? '',
          fromImport: true,
        });
      }

      if (!newRows.length) {
        showError('Không có dòng import được (thiếu part_internal_code).');
        return;
      }

      const existingItems = getValues('items') ?? [];
      const isInitialBlankRow = (r: CreatePRFormInput['items'][number]) =>
        !r.fromImport &&
        !(String(r.catalogPartId ?? '').trim()) &&
        !(r.partNo ?? '').trim() &&
        !(r.description ?? '').trim() &&
        !(r.unit ?? '').trim() &&
        !(r.model ?? '').trim() &&
        !(r.spec ?? '').trim() &&
        !(r.manufacturer ?? '').trim() &&
        !(r.remark ?? '').trim() &&
        !(r.purpose ?? '').trim() &&
        !(r.itemAttachmentLink ?? '').trim() &&
        (r.qty === 1 || r.qty === undefined);

      if (existingItems.length === 1 && isInitialBlankRow(existingItems[0]!)) {
        replace(newRows);
      } else {
        append(newRows);
      }
      const nLocal = newRows.filter((r) =>
        localImportByCode.has((r.partNo ?? '').trim().toUpperCase())
      ).length;
      showSuccess(
        `Đã import ${newRows.length} dòng vào danh sách (đủ thứ tự file).${
          nLocal
            ? ` ${nLocal} dòng mã mới (chưa PartMaster): coi là mua mới, tồn 0 — kiểm tra trước khi gửi.`
            : ' Có tồn kho: khi gửi hệ thống tách xuất kho / phần cần mua theo số lượng dòng.'
        }`
      );
    } catch {
      showError('Không đọc được file. Dùng CSV/Excel, dòng đầu là tiêu đề cột (part_internal_code, …).');
    } finally {
      setMaterialImportBusy(false);
    }
  };

  const createTemporaryPart = () => {
    const code = newPartForm.partInternalCode.trim();
    const name = newPartForm.partName.trim();
    const unit = newPartForm.unit.trim();
    if (!code || !name || !unit) return;

    const exists = mergedCatalogParts.some(
      (p) => p.partInternalCode.trim().toUpperCase() === code.toUpperCase()
    );
    if (exists) {
      showError(`Mã vật tư "${code}" đã tồn tại trong danh mục hiện tại.`);
      return;
    }

    const localPart: PartCatalogRow = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      partInternalCode: code,
      partName: name,
      unit,
      manufacturer: newPartForm.manufacturer.trim() || null,
      referenceUrl: newPartForm.referenceUrl.trim() || null,
      stockAvailable: 0,
    };
    setLocalCreatedParts((prev) => [localPart, ...prev]);

    if (newPartRowIndex != null) {
      const i = newPartRowIndex;
      setValue(`items.${i}.catalogPartId`, localPart.id, { shouldValidate: true, shouldDirty: true });
      setValue(`items.${i}.partNo`, localPart.partInternalCode, { shouldValidate: true, shouldDirty: true });
      setValue(`items.${i}.description`, localPart.partName, { shouldValidate: true, shouldDirty: true });
      setValue(`items.${i}.unit`, localPart.unit, { shouldValidate: true, shouldDirty: true });
      setValue(`items.${i}.manufacturer`, localPart.manufacturer || '', { shouldValidate: true, shouldDirty: true });
      const ref = (localPart.referenceUrl ?? '').trim();
      if (ref) {
        const cur = (getValues(`items.${i}.spec`) ?? '').trim();
        if (!cur) setValue(`items.${i}.spec`, ref, { shouldValidate: true, shouldDirty: true });
      }
    }
    setNewPartOpen(false);
    setNewPartRowIndex(null);
    setNewPartForm({ partInternalCode: '', partName: '', unit: 'pcs', manufacturer: '', referenceUrl: '' });
    showSuccess('Đã thêm vật tư tạm cho phiên này (reload trang sẽ mất).');
  };

  const { data: customerPOsData } = useQuery({
    queryKey: ['requestor-customer-pos'],
    queryFn: () => requestorService.getCustomerPOs(),
    staleTime: 60_000,
  });
  const customerPOs = customerPOsData?.customerPOs ?? [];

  const normalizedSalesPOId = optionalSalesPOUuid(salesPOId);

  const itemRuleIssues = useMemo<ItemRuleIssue[]>(() => {
    const issues: ItemRuleIssue[] = [];
    items.forEach((it, idx) => {
      const messages: string[] = [];
      const itemType = it?.itemType ?? 'STANDARD';
      const rowKey = fields[idx]?.id;
      const rowFiles = rowKey ? itemAttachments[rowKey] ?? [] : [];
      const hasLink = !!it?.itemAttachmentLink?.trim();

      const hasCatalogSelected = !!it?.catalogPartId?.trim();
      if (hasCatalogSelected) {
        if (itemType === 'STANDARD') {
          if (!it?.model?.trim()) messages.push('Standard (đã chọn danh mục) bắt buộc nhập Model');
          if (!it?.manufacturer?.trim()) messages.push('Standard (đã chọn danh mục) bắt buộc nhập Brand/NSX');
        } else {
          if (!hasLink && rowFiles.length === 0) {
            messages.push('Custom (đã chọn danh mục) bắt buộc có file hoặc link tài liệu theo item');
          }
        }
      }

      if (messages.length) issues.push({ index: idx, messages });
    });
    return issues;
  }, [items, fields, itemAttachments]);

  const hasItemRuleErrors = itemRuleIssues.length > 0;
  const itemRuleIssueByIndex = useMemo(() => {
    const map = new Map<number, string[]>();
    itemRuleIssues.forEach((i) => map.set(i.index, i.messages));
    return map;
  }, [itemRuleIssues]);

  const { data: selectedCustomerPODetail } = useQuery({
    queryKey: ['customer-po-detail', normalizedSalesPOId],
    queryFn: () => requestorService.getCustomerPOById(normalizedSalesPOId!),
    enabled: !!normalizedSalesPOId,
  });

  const { data: prNoPreview, isFetching: isFetchingPRNo } = useQuery({
    queryKey: ['requestor-next-pr-number', department],
    queryFn: () => requestorService.getNextPRNumber(department),
    enabled: !!department?.trim(),
    staleTime: 30_000,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreatePRMutationVars) =>
      requestorService.createPR({
        department: payload.department,
        type: payload.type,
        requiredDate: payload.requiredDate,
        currency: payload.currency,
        tax: undefined,
        notes: payload.notes,
        purpose: payload.purpose,
        salesPOId: optionalSalesPOUuid(payload.salesPOId),
        customerPO: payload.customerPO,
        projectCode: payload.projectCode,
        projectName: payload.projectName,
        customerName: payload.customerName,
        salesPersonId: payload.salesPersonId,
        items: payload.items.map((item) => ({
          description: item.description,
          partNo: item.partNo,
          spec:
            item.itemType === 'STANDARD' && item.model?.trim()
              ? [item.spec?.trim(), `Model: ${item.model.trim()}`].filter(Boolean).join(' | ')
              : item.spec,
          manufacturer: item.manufacturer || undefined,
          qty: item.qty,
          unit: item.unit,
          estimatedUnitPriceVnd: item.estimatedUnitPriceVnd,
          desiredDeliveryDate: item.desiredDeliveryDate?.trim() || undefined,
          purpose: item.purpose,
          remark: [
            `Loai: ${item.itemType === 'CUSTOM' ? 'Custom' : 'Standard'}`,
            item.itemType === 'CUSTOM' && item.itemAttachmentLink?.trim()
              ? `Tai lieu: ${item.itemAttachmentLink.trim()}`
              : null,
            item.remark?.trim() || null,
          ]
            .filter(Boolean)
            .join(' | '),
        })),
        action: payload.action,
        attachments,
        itemAttachments:
          payload.itemAttachmentRows
            ?? fields
              .map((f, idx) => ({
                lineNo: idx + 1,
                files: itemAttachments[f.id] ?? [],
              }))
              .filter((x) => x.files.length > 0),
      }),
    onSuccess: (created, variables) => {
      const prNumberDisplay = ensurePrNumberHasSite(created.prNumber, userSiteCode);
      queryClient.invalidateQueries({ queryKey: ['requestor-prs'] });
      queryClient.invalidateQueries({ queryKey: ['requestor-dashboard'] });
      if (variables.skipNavigate) return;
      if (variables.action === 'SUBMIT') {
        const link = created?.salesOrder?.label;
        showSuccess(
          link
            ? `Đã gửi PR ${prNumberDisplay}. Liên kết: ${link}`
            : `Đã gửi PR ${prNumberDisplay} đi duyệt.`
        );
      } else {
        showSuccess(`Đã lưu nháp PR ${prNumberDisplay}.`);
      }
      navigate(getBackRoute());
    },
    onError: (err: unknown) => {
      const data = (
        err as {
          response?: { data?: { error?: string; message?: string; details?: { path: (string | number)[]; message: string }[] } };
        }
      ).response?.data;
      if (data?.details?.length) {
        const msg = data.details.map((d) => `${d.path.join('.')}: ${d.message}`).join(' · ');
        showError(msg);
        return;
      }
      const msg =
        (typeof data?.error === 'string' && data.error) ||
        (typeof data?.message === 'string' && data.message) ||
        '';
      showError(msg || 'Không tạo được PR. Kiểm tra dữ liệu hoặc quyền gửi duyệt.');
    },
  });

  const stockIssueMutation = useMutation({
    mutationFn: (payload: {
      purpose?: string;
      notes?: string;
      salesPoId?: string;
      purchaseRequestId?: string;
      items: CreateStockIssueLine[];
    }) => createStockIssue({ ...payload, action: 'SUBMIT' }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['my-stock-issues'] });
      queryClient.invalidateQueries({ queryKey: ['create-pr-part-stock'] });
      showSuccess(`Đã tạo phiếu xuất kho ${created.issueNumber}.`);
      navigate(getStockIssueDetailPath(created.id));
    },
    onError: (err: unknown) => {
      const ax = err as { response?: { data?: { error?: string } } };
      showError(ax.response?.data?.error || 'Không tạo được phiếu xuất kho.');
    },
  });

  const onSaveDraft = handleSubmit((data) => {
    createMutation.mutate({
      ...data,
      action: 'SAVE',
      itemAttachmentRows: fields
        .map((f, idx) => ({
          lineNo: idx + 1,
          files: itemAttachments[f.id] ?? [],
        }))
        .filter((x) => x.files.length > 0),
    });
  });

  const onSubmitPR = handleSubmit(async (data) => {
    if (hasItemRuleErrors) {
      showError('Các dòng đã chọn danh mục cần hoàn thiện Loại hàng/Model/Brand/Attachment trước khi gửi.');
      return;
    }
    const codes = [...new Set(data.items.map((i) => i.partNo.trim()).filter(Boolean))].sort();
    const fresh = await queryClient.fetchQuery({
      queryKey: ['create-pr-part-stock', codes.join('|')],
      queryFn: () => getPartStockAvailability(codes),
    });
    const bp = fresh.byPart;
    const analyses = data.items.map((it) => analyzeLineStock(it, bp));

    const hasPr = analyses.some((a) => a.prQty > 0);
    const hasIssue = analyses.some((a) => a.issueQty > 0);

    if (!hasPr && hasIssue) {
      setPendingIssueContext({
        purpose: data.purpose,
        notes: data.notes,
        items: buildIssueLinesFromForm(data, analyses),
      });
      setAllStockModalOpen(true);
      return;
    }

    if (hasPr && !canSubmitForApproval) {
      showError(
        'Thiếu direct_manager_code trên tài khoản — không gửi duyệt PR được. Bạn vẫn có thể Lưu nháp.'
      );
      return;
    }

    const selectedIndexes = analyses
      .map((a, i) => (a.prQty > 0 ? i : -1))
      .filter((i) => i >= 0);

    const prFormItems = selectedIndexes.map((i) => ({ ...data.items[i], qty: analyses[i].prQty }));
    const submittedItemAttachmentRows = selectedIndexes
      .map((originalIndex, newIndex) => {
        const rowKey = fields[originalIndex]?.id;
        return {
          lineNo: newIndex + 1,
          files: rowKey ? (itemAttachments[rowKey] ?? []) : [],
        };
      })
      .filter((x) => x.files.length > 0);

    if (!hasPr) return;

    try {
      const created = await createMutation.mutateAsync({
        ...data,
        items: prFormItems,
        action: 'SUBMIT',
        skipNavigate: hasIssue,
        itemAttachmentRows: submittedItemAttachmentRows,
      });

      if (hasIssue) {
        const issueLines = buildIssueLinesFromForm(data, analyses);
        const prNumberDisplay = ensurePrNumberHasSite(created.prNumber, userSiteCode);
        setPostPrIssueContext({
          purchaseRequestId: created.id,
          prNumber: prNumberDisplay,
          items: issueLines,
        });
        setAfterPrIssueModalOpen(true);
        const link = created?.salesOrder?.label;
        showSuccess(
          link
            ? `Đã gửi PR ${prNumberDisplay} (phần cần mua). Liên kết: ${link}`
            : `Đã gửi PR ${prNumberDisplay} cho các dòng cần mua. Có thể tạo phiếu xuất kho cho phần đủ tồn.`
        );
      }
    } catch {
      /* createMutation.onError đã toast */
    }
  });

  const confirmAllStockIssue = () => {
    if (!pendingIssueContext?.items.length) {
      setAllStockModalOpen(false);
      return;
    }
    stockIssueMutation.mutate({
      purpose: pendingIssueContext.purpose,
      notes: pendingIssueContext.notes,
      items: pendingIssueContext.items,
    });
    setAllStockModalOpen(false);
    setPendingIssueContext(null);
  };

  const cancelAllStockModal = () => {
    setAllStockModalOpen(false);
    setPendingIssueContext(null);
  };

  const confirmPostPrIssue = () => {
    if (!postPrIssueContext?.items.length) {
      setAfterPrIssueModalOpen(false);
      navigate(getBackRoute());
      return;
    }
    stockIssueMutation.mutate(
      {
        purpose: getValues('purpose'),
        notes: getValues('notes'),
        salesPoId: getValues('salesPOId')?.trim() || undefined,
        purchaseRequestId: postPrIssueContext.purchaseRequestId,
        items: postPrIssueContext.items,
      },
      {
        onSuccess: () => {
          setAfterPrIssueModalOpen(false);
          setPostPrIssueContext(null);
        },
      }
    );
  };

  const skipPostPrIssue = async () => {
    const ctx = postPrIssueContext;
    if (!ctx?.items.length) {
      setAfterPrIssueModalOpen(false);
      setPostPrIssueContext(null);
      navigate(getBackRoute());
      return;
    }
    setDeferPostPrStockIssueBusy(true);
    try {
      await createStockIssue({
        purpose: getValues('purpose'),
        notes: getValues('notes'),
        salesPoId: getValues('salesPOId')?.trim() || undefined,
        purchaseRequestId: ctx.purchaseRequestId,
        items: ctx.items,
        action: 'DRAFT',
      });
      queryClient.invalidateQueries({ queryKey: ['my-stock-issues'] });
      queryClient.invalidateQueries({ queryKey: ['create-pr-part-stock'] });
      showSuccess(
        'Đã lưu phiếu xuất kho dạng nháp. Danh sách phiếu xuất kho bên dưới — trạng thái Nháp, gửi kho khi sẵn sàng.'
      );
      setAfterPrIssueModalOpen(false);
      setPostPrIssueContext(null);
      navigate(getStockIssuesListPath());
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      showError(ax.response?.data?.error || 'Không lưu được phiếu xuất kho nháp. Vui lòng thử lại.');
    } finally {
      setDeferPostPrStockIssueBusy(false);
    }
  };

  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = 0;
    }
  }, []);

  useEffect(() => {
    if (!salesPOId) setCustomerPODetailOpen(false);
  }, [salesPOId]);

  return (
    <div className={createPRShellClass}>
      <div className={`${createPRScrollClass} animate-fade-in`}>
        <div className={createPRContentClass}>
        {/* Back Button */}
        <div className="flex items-center gap-4 animate-slide-up">
          <button
            onClick={() => navigate(getBackRoute())}
            className="p-2.5 text-slate-600 hover:bg-white/80 rounded-xl transition-all shadow-sm hover:shadow-md border border-slate-200/60"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <span className="text-sm text-slate-500 font-normal">Quay lại danh sách PR</span>
        </div>

        {location.pathname.includes('/requestor/') && (
          <RequestorPageHero
            kicker="Requestor · Mua hàng"
            title="Tạo yêu cầu mua hàng (PR)"
            description="Điền thông tin dự án, vật tư và gửi — hệ thống kiểm tra tồn kho và định tuyến PR hoặc phiếu xuất kho."
            Icon={FileText}
            tint="graphite"
            regionLabel="Tạo PR"
          />
        )}

        <form className="space-y-6">
          {/* SECTION 1 – HEADER */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 rounded-2xl shadow-xl p-5 text-center
                          before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] before:from-emerald-500/10 before:via-transparent before:to-transparent before:opacity-70
                          after:content-[''] after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] after:from-cyan-500/10 after:via-transparent after:to-transparent after:opacity-70">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
            <div className="relative border border-slate-600/30 rounded-xl p-3 backdrop-blur-sm">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-400/30 rounded-full text-emerald-200 text-[10px] font-medium tracking-wider uppercase mb-2 shadow-inner">
                <Sparkles className="w-3 h-3 text-emerald-300" />
                Official Document
              </div>
              <div className="text-sm font-semibold text-slate-200 tracking-wide">
                RMG TECHNOLOGIES VIETNAM CO., LTD
              </div>
              <div className="mt-1 text-xl font-bold text-white drop-shadow-sm">
                PURCHASE REQUISITION
              </div>
              <div className="text-xs text-slate-300 font-medium mt-0.5">
                Phiếu Yêu Cầu Mua Vật Tư
              </div>
            </div>
          </div>

          {/* PART 1 — THÔNG TIN DỰ ÁN / PO KHÁCH HÀNG */}
          <div className="space-y-4 rounded-2xl border-2 border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50/50 to-yellow-50/60 p-4 shadow-lg sm:space-y-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white shadow-md">
                <Briefcase className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Thông tin dự án / PO khách hàng</h2>
                <p className="text-xs text-slate-500">Chọn Customer PO có sẵn hoặc để trống nếu mua nội bộ — thông tin dự án tự điền từ hệ thống</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2">PO khách hàng</label>
              <CustomSelect
                value={salesPOId ?? ''}
                onChange={(e) => setValue('salesPOId', e.target.value || '', { shouldDirty: true })}
                className="w-full px-4 py-3 border border-amber-200 rounded-xl bg-white hover:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
              >
                <option value="">-- Không chọn / Mua nội bộ --</option>
                {customerPOs.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} | {po.customer} | {po.projectName}
                  </option>
                ))}
              </CustomSelect>
            </div>

            {selectedCustomerPODetail && (
              <div className="flex flex-col gap-3 rounded-xl border border-amber-200/90 bg-white p-4 shadow-sm ring-1 ring-amber-900/[0.04] sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800/90">
                    Đã chọn PO khách hàng
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {selectedCustomerPODetail.poNumber}
                    <span className="font-normal text-slate-500">
                      {' '}
                      · {selectedCustomerPODetail.customer?.name ?? '—'}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {selectedCustomerPODetail.projectName ?? '—'}
                    {selectedCustomerPODetail.projectCode
                      ? ` · ${selectedCustomerPODetail.projectCode}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomerPODetailOpen(true)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-sm transition-colors hover:bg-amber-50"
                >
                  <Eye className="h-4 w-4" strokeWidth={2} />
                  Xem chi tiết PO
                </button>
              </div>
            )}
          </div>

          {/* INSIGHT CARD — Tổng giá trị PR */}
          {estimatedTotalValue > 0 && (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-5 text-white shadow-lg shadow-blue-500/25">
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
              <div className="relative">
                <p className="text-[11px] font-bold uppercase tracking-widest text-blue-100">
                  Tổng giá trị PR (dự kiến)
                </p>
                <p className="mt-2 text-3xl font-black tabular-nums leading-tight">
                  {estimatedTotalValue.toLocaleString('vi-VN')} VND
                </p>
                <p className="mt-2 text-xs text-blue-100/80">
                  Tính từ giá dự kiến × số lượng các dòng vật tư
                </p>
              </div>
              <DollarSign
                className="absolute bottom-4 right-4 h-10 w-10 text-white/15"
                strokeWidth={1.5}
              />
            </div>
          )}

          {/* Danh sách vật tư / dịch vụ */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/60">
            <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-2.5 text-white shadow-md">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 sm:text-lg">Danh sách vật tư / dịch vụ</h2>
                  <p className="text-xs text-slate-500">
                    Danh mục (tự điền) hoặc import file — gửi PR sẽ tách xuất kho / mua theo tồn. Giá dự kiến chỉ tham khảo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  append({
                    catalogPartId: '',
                    itemType: 'STANDARD',
                    description: '',
                    partNo: '',
                    model: '',
                    spec: '',
                    manufacturer: '',
                    itemAttachmentLink: '',
                    qty: 1,
                    unit: '',
                    purpose: '',
                    remark: '',
                    estimatedUnitPriceVnd: undefined,
                    desiredDeliveryDate: '',
                    fromImport: false,
                  })
                }
                className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:from-violet-700 hover:to-purple-700 hover:shadow-lg sm:w-auto"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Thêm dòng
              </button>
              <input
                ref={materialImportRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void handleMaterialImportFile(f);
                }}
              />
              <button
                type="button"
                disabled={materialImportBusy || catalogQueryFailed}
                onClick={() => materialImportRef.current?.click()}
                className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-medium text-violet-800 shadow-sm transition-all hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />
                {materialImportBusy ? 'Đang import…' : 'Import CSV / Excel'}
              </button>
            </div>

            {errors.items && typeof errors.items.message === 'string' && (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 sm:px-6">
                <p className="text-sm text-rose-600 font-medium">{errors.items.message}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-3 py-3 sm:px-6">
              <label className="text-xs font-medium text-slate-600">Lọc danh mục vật tư:</label>
              <input
                type="text"
                value={partListSearch}
                onChange={(e) => setPartListSearch(e.target.value)}
                placeholder="Gõ mã hoặc tên..."
                className="flex-1 min-w-[200px] max-w-md px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
              />
              {catalogLoading && <span className="text-xs text-slate-500">Đang tải...</span>}
              {catalogQueryFailed && (
                <span className="text-xs text-rose-600">
                  Không tải được danh mục.{' '}
                  <button
                    type="button"
                    className="font-semibold text-violet-700 underline"
                    onClick={() => void refetchCatalog()}
                  >
                    Thử lại
                  </button>
                </span>
              )}
            </div>

            {catalogQueryFailed ? (
              <div className="border-b border-rose-200 bg-rose-50/90 px-3 py-2 text-sm text-rose-800 sm:px-6">
                {catalogErrorMessage || 'Lỗi mạng hoặc máy chủ. Kiểm tra đăng nhập và API.'}
              </div>
            ) : null}

            <div className="px-3 pt-2 sm:px-6">
              <p className="text-[11px] text-slate-400 sm:hidden">
                Vuốt ngang bảng để xem đầy đủ các cột.
              </p>
            </div>

            {/* Wrapper 2 lớp: ngoài cuộn ngang, trong giới hạn ~7-8 dòng + cuộn dọc */}
            <div
              ref={tableScrollRef}
              className="max-w-full overflow-x-auto px-1 pb-2 [-webkit-overflow-scrolling:touch] sm:px-0 [scrollbar-gutter:stable]"
            >
              <div className="max-h-[min(34rem,72vh)] overflow-y-auto [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 [&::-webkit-scrollbar-track]:bg-transparent">
              <table className="w-full min-w-[1400px] lg:min-w-[1900px]">
                <thead className="sticky top-0 z-20 bg-gradient-to-r from-slate-100 to-slate-50">
                  <tr className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="px-4 py-4 text-left w-14">STT</th>
                    <th className="px-4 py-4 text-left min-w-[280px]">
                      Mã vật tư (danh mục) <span className="text-rose-500">*</span>
                    </th>
                    <th className="px-4 py-4 text-left min-w-[200px]">Tên</th>
                    <th className="px-4 py-4 text-left min-w-[120px]">Loại</th>
                    <th className="px-4 py-4 text-left min-w-[160px]">Model</th>
                    <th className="px-4 py-4 text-left min-w-[220px]">Spec</th>
                    <th className="px-4 py-4 text-left min-w-[160px]">Brand / NSX</th>
                    <th className="px-4 py-4 text-left min-w-[240px]">Attachment theo item</th>
                    <th className="px-4 py-4 text-left min-w-[110px]">SL <span className="text-rose-500">*</span></th>
                    <th className="px-4 py-4 text-left min-w-[110px]">ĐVT</th>
                    <th className="px-4 py-4 text-left min-w-[130px] normal-case">
                      <span className="uppercase tracking-wider">Ngày mong muốn giao</span>
                      <span className="mt-0.5 block text-[10px] font-semibold normal-case text-emerald-700">lead_time</span>
                    </th>
                    <th className="px-4 py-4 text-left min-w-[120px] normal-case">
                      <span className="uppercase tracking-wider">Giá dự kiến (VND)</span>
                      <span className="mt-0.5 block text-[10px] font-semibold normal-case text-emerald-700">Estimated Cost</span>
                    </th>
                    <th className="px-4 py-4 text-left min-w-[100px]">Tồn KHD</th>
                    <th className="px-4 py-4 text-left min-w-[120px]">Tồn / mua</th>
                    <th className="px-4 py-4 text-left min-w-[140px]">Khi gửi yêu cầu</th>
                    <th className="px-4 py-4 text-left min-w-[220px]">Ghi chú dòng</th>
                    <th className="px-4 py-4 text-right w-14"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fields.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-violet-50/30 transition-colors align-top group">
                      {(() => {
                        const a = lineAnalysesPreview[idx] ?? {
                          available: 0,
                          requestedQty: 0,
                          issueQty: 0,
                          prQty: 0,
                          badge: 'short' as const,
                        };
                        const badgeLabel =
                          a.badge === 'full'
                            ? 'Đủ tồn'
                            : a.badge === 'partial'
                              ? 'Một phần'
                              : 'Thiếu';
                        const badgeClass =
                          a.badge === 'full'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : a.badge === 'partial'
                              ? 'border-amber-300 bg-amber-50 text-amber-800'
                              : 'border-rose-200 bg-rose-50 text-rose-800';
                        const itemRuleMessages = itemRuleIssueByIndex.get(idx) ?? [];
                        // Ưu tiên cờ từ row của field-array để render đúng trạng thái import ngay frame đầu
                        const isImportLine = Boolean((row as any)?.fromImport ?? items[idx]?.fromImport);
                        return (
                          <>
                      <td className="px-4 py-4">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center text-sm font-bold text-violet-700">
                          {idx + 1}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isImportLine ? (
                          <div className="space-y-1">
                            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Từ file import</p>
                              <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
                                {(items[idx]?.partNo ?? '').trim() || '—'}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-xs text-slate-600" title={items[idx]?.description}>
                                {items[idx]?.description?.trim() || '—'}
                              </p>
                            </div>
                            {errors.items?.[idx]?.catalogPartId && (
                              <p className="text-xs text-rose-500">{errors.items[idx]?.catalogPartId?.message}</p>
                            )}
                            <input type="hidden" {...register(`items.${idx}.catalogPartId` as const)} />
                            <input type="hidden" {...register(`items.${idx}.partNo` as const)} />
                            <input type="hidden" {...register(`items.${idx}.fromImport` as const)} />
                          </div>
                        ) : (
                          <>
                        <div className="flex items-center gap-2">
                          <CustomSelect
                            enableDropdownSearch
                            dropdownSearchPlaceholder="Lọc mã hoặc tên..."
                            disabled={catalogLoading || catalogQueryFailed}
                            placeholder={
                              catalogLoading
                                ? 'Đang tải danh mục…'
                                : catalogQueryFailed
                                  ? 'Lỗi tải danh mục'
                                  : 'Chọn vật tư…'
                            }
                            value={watch(`items.${idx}.catalogPartId` as const) || ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === '__NEW__') {
                                setNewPartRowIndex(idx);
                                setValue(`items.${idx}.catalogPartId`, '', { shouldValidate: true, shouldDirty: true });
                                setValue(`items.${idx}.partNo`, '', { shouldValidate: true, shouldDirty: true });
                                setValue(`items.${idx}.description`, '', { shouldValidate: true, shouldDirty: true });
                                setValue(`items.${idx}.unit`, '', { shouldValidate: true, shouldDirty: true });
                                setValue(`items.${idx}.manufacturer`, '', { shouldValidate: true, shouldDirty: true });
                                setNewPartOpen(true);
                                return;
                              }
                              applyCatalogPart(idx, v);
                            }}
                            className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 text-sm ${
                              errors.items?.[idx]?.catalogPartId ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                            }`}
                          >
                            <option value="__NEW__">+ Tạo vật tư mới…</option>
                            <option value="">— Chọn từ danh mục —</option>
                            {mergedCatalogParts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.partInternalCode} | {p.partName}
                                {localCreatedPartIdSet.has(p.id)
                                  ? ' (sẽ được tạo khi gửi yêu cầu)'
                                  : Number(p.stockAvailable ?? 0) <= 0
                                    ? ' | MỚI (chưa có tồn)'
                                    : ''}
                              </option>
                            ))}
                          </CustomSelect>
                          <button
                            type="button"
                            onClick={() => {
                              setValue(`items.${idx}.catalogPartId`, '', { shouldValidate: true, shouldDirty: true });
                            }}
                            className="shrink-0 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                            title="Bỏ chọn danh mục"
                          >
                            Reset
                          </button>
                        </div>
                        {errors.items?.[idx]?.catalogPartId && (
                          <p className="text-xs text-rose-500 mt-1">{errors.items[idx]?.catalogPartId?.message}</p>
                        )}
                        <p className="mt-1 text-[11px] text-slate-500">
                          Có thể tạo mã vật tư mới (stock mặc định 0). Sau khi kho nhập hàng thì tồn kho mới tăng.
                        </p>
                        <input type="hidden" {...register(`items.${idx}.partNo` as const)} />
                        <input type="hidden" {...register(`items.${idx}.fromImport` as const)} />
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          {...register(`items.${idx}.description` as const)}
                          readOnly
                          className={`w-full px-3 py-2.5 border rounded-lg bg-slate-50 text-slate-700 text-sm cursor-not-allowed ${
                            errors.items?.[idx]?.description ? 'border-rose-400' : 'border-slate-200'
                          }`}
                          placeholder="Chọn danh mục"
                          title="Tự điền từ danh mục"
                        />
                        {errors.items?.[idx]?.description && (
                          <p className="text-xs text-rose-500 mt-1">{errors.items[idx]?.description?.message}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <CustomSelect
                          value={watch(`items.${idx}.itemType` as const) || 'STANDARD'}
                          onChange={(e) =>
                            setValue(`items.${idx}.itemType`, (e.target.value as 'STANDARD' | 'CUSTOM') ?? 'STANDARD', {
                              shouldValidate: true,
                              shouldDirty: true,
                            })
                          }
                          className={`w-full px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 text-sm ${
                            itemRuleMessages.length ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                          }`}
                        >
                          <option value="STANDARD">Standard</option>
                          <option value="CUSTOM">Custom</option>
                        </CustomSelect>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          {...register(`items.${idx}.model` as const)}
                          className={`w-full px-3 py-2.5 border rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm ${
                            itemRuleMessages.some((m) => m.includes('Model')) ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                          }`}
                          placeholder="Model (bắt buộc với Standard)"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          {...register(`items.${idx}.spec` as const)}
                          className="w-full min-w-[210px] px-3 py-2.5 border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm"
                          placeholder="Thông số / link tham khảo (buyer)"
                          title="Có thể dán URL datasheet hoặc catalog — buyer dùng khi báo giá"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          {...register(`items.${idx}.manufacturer` as const)}
                          className={`w-full min-w-[150px] px-3 py-2.5 border rounded-lg text-sm transition-all ${
                            itemRuleMessages.some((m) => m.includes('Brand')) ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'
                          }`}
                          placeholder="Brand / NSX"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-2">
                          <input
                            {...register(`items.${idx}.itemAttachmentLink` as const)}
                            className={`w-full min-w-[220px] px-3 py-2.5 border rounded-lg text-sm transition-all ${
                              itemRuleMessages.some((m) => m.includes('file hoặc link'))
                                ? 'border-rose-400 bg-rose-50/50'
                                : 'border-slate-200'
                            }`}
                            placeholder="Link bản vẽ/spec (bắt buộc với Custom nếu không upload file)"
                          />
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700">
                            <FileUp className="h-3.5 w-3.5" />
                            Upload file theo item
                            <input
                              type="file"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                setItemAttachments((prev) => ({ ...prev, [row.id]: files }));
                              }}
                            />
                          </label>
                          {(itemAttachments[row.id]?.length ?? 0) > 0 ? (
                            <p className="text-[11px] text-sky-700">
                              {itemAttachments[row.id].length} file cho dòng này
                            </p>
                          ) : null}
                          {itemRuleMessages.length > 0 && (
                            <p className="text-xs text-rose-500">{itemRuleMessages[0]}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          {...register(`items.${idx}.qty` as const, { valueAsNumber: true })}
                          className={`w-full min-w-[90px] px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm ${
                            errors.items?.[idx]?.qty ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        />
                        {errors.items?.[idx]?.qty && (
                          <p className="text-xs text-rose-500 mt-1">{errors.items[idx]?.qty?.message}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          {...register(`items.${idx}.unit` as const)}
                          readOnly
                          className={`w-full min-w-[90px] px-3 py-2.5 border rounded-lg bg-slate-50 text-sm cursor-not-allowed ${
                            errors.items?.[idx]?.unit ? 'border-rose-400' : 'border-slate-200'
                          }`}
                          placeholder="—"
                        />
                        {errors.items?.[idx]?.unit && (
                          <p className="text-xs text-rose-500 mt-1">{errors.items[idx]?.unit?.message}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          {...register(`items.${idx}.desiredDeliveryDate` as const)}
                          className={`w-full min-w-[120px] px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm ${
                            errors.items?.[idx]?.desiredDeliveryDate
                              ? 'border-rose-400 bg-rose-50/50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        />
                        {errors.items?.[idx]?.desiredDeliveryDate && (
                          <p className="text-xs text-rose-500 mt-1">{errors.items[idx]?.desiredDeliveryDate?.message}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Controller
                          control={control}
                          name={`items.${idx}.estimatedUnitPriceVnd`}
                          render={({ field }) => (
                            <VndIntegerInput
                              placeholder="Ví dụ: 1.500.000"
                              value={field.value ?? undefined}
                              onChange={field.onChange}
                              className={`w-full min-w-[100px] px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm ${
                                errors.items?.[idx]?.estimatedUnitPriceVnd
                                  ? 'border-rose-400 bg-rose-50/50'
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                            />
                          )}
                        />
                        {errors.items?.[idx]?.estimatedUnitPriceVnd && (
                          <p className="text-xs text-rose-500 mt-1">{errors.items[idx]?.estimatedUnitPriceVnd?.message}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                          {!items[idx]?.partNo?.trim()
                            ? '—'
                            : partStockFetching
                              ? '…'
                              : a.available.toLocaleString('vi-VN')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className={`inline-flex px-2.5 py-1 rounded-lg border text-xs font-bold uppercase tracking-wide ${badgeClass}`}
                        >
                          {badgeLabel}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1 text-xs text-slate-600">
                          {a.issueQty > 0 && (
                            <div>
                              <span className="font-semibold text-emerald-700">Xuất kho:</span>{' '}
                              {a.issueQty.toLocaleString('vi-VN')}
                            </div>
                          )}
                          {a.prQty > 0 && (
                            <div>
                              <span className="font-semibold text-indigo-700">Gửi mua:</span>{' '}
                              {a.prQty.toLocaleString('vi-VN')}
                            </div>
                          )}
                          {a.issueQty === 0 && a.prQty === 0 && (
                            <span className="text-slate-400">Nhập SL / chọn mã</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[220px]">
                        <input
                          {...register(`items.${idx}.remark` as const)}
                          className="w-full min-w-[180px] px-3 py-2.5 border border-slate-200 rounded-lg hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all text-sm"
                          placeholder="Ghi chú"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (fields.length <= 1) return;
                            const rowKey = fields[idx]?.id;
                            if (rowKey) {
                              setItemAttachments((prev) => {
                                const next = { ...prev };
                                delete next[rowKey];
                                return next;
                              });
                            }
                            remove(idx);
                          }}
                          className={`p-2 rounded-lg transition-all ${
                            fields.length > 1
                              ? 'text-rose-500 hover:bg-rose-100 hover:text-rose-600 opacity-0 group-hover:opacity-100'
                              : 'text-slate-200 cursor-not-allowed'
                          }`}
                          title="Xóa dòng"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={2} />
                        </button>
                      </td>
                          </>
                        );
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>{/* end inner scroll-y */}
            </div>
            {hasItemRuleErrors && (
              <div className="mx-3 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:mx-6">
                Có dòng chưa hợp lệ theo rule Loại hàng: Standard cần Model + Brand, Custom cần file hoặc link theo item.
              </div>
            )}
          </div>

          {/* Thông tin chung PR — sau danh sách vật tư */}
          <div className="space-y-4 rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-lg backdrop-blur-sm sm:space-y-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 text-white shadow-md">
                <User className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Thông tin chung của PR</h2>
                <p className="text-xs text-slate-500">Thông tin cơ bản và mục đích mua hàng</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Người yêu cầu</label>
                <input
                  value={currentUser?.fullName || currentUser?.username || ''}
                  readOnly
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50/80 text-slate-700 font-medium"
                />
              </div>

              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Phòng ban <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  {...register('department')}
                  value={department || ''}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all ${
                    errors.department ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <option value="">-- Chọn phòng ban --</option>
                  <option value="ENGINEERING">Engineering</option>
                  <option value="QS">QS</option>
                  <option value="SITE">Site</option>
                  <option value="ADMIN">Admin</option>
                  <option value="IT">IT</option>
                  <option value="OTHER">Other</option>
                </CustomSelect>
                {errors.department && (
                  <p className="text-xs text-rose-500 mt-1.5 font-medium">{errors.department.message}</p>
                )}
              </div>

              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Loại PR <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  {...register('type')}
                  value={prType || ''}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all ${
                    errors.type ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <option value="PRODUCTION">Sản xuất</option>
                  <option value="PROJECT">Dự án</option>
                  <option value="OFFICE">Văn phòng</option>
                  <option value="COMMERCIAL">Thương mại</option>
                </CustomSelect>
                {errors.type && (
                  <p className="text-xs text-rose-500 mt-1.5 font-medium">{errors.type.message}</p>
                )}
              </div>

              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ngày</label>
                <input
                  value={new Date().toLocaleDateString('vi-VN')}
                  readOnly
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50/80 text-slate-700 font-medium"
                />
              </div>

              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Ngày dự kiến nhận
                </label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={
                    latestExpectedReceiveDateIso
                      ? formatIsoDateToDdMmYyyy(latestExpectedReceiveDateIso)
                      : '—'
                  }
                  className="w-full cursor-not-allowed px-4 py-3 border border-slate-200 rounded-xl bg-slate-50/80 font-medium tabular-nums text-slate-700"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Chỉ đọc — lấy theo ngày mong muốn giao <span className="font-semibold text-slate-600">trễ nhất</span> trong
                  danh sách vật tư / dịch vụ phía trên.
                </p>
              </div>

              <div className="group">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tiền tệ (dùng khi báo giá sau)</label>
                <CustomSelect
                  {...register('currency')}
                  value={watch('currency') || 'VND'}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                >
                  <option value="VND">VND</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="JPY">JPY</option>
                </CustomSelect>
              </div>

              <div className="lg:col-span-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mục đích mua</label>
                <textarea
                  {...register('purpose')}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all resize-none"
                  placeholder="VD: Mua thiết bị cho dự án camera nhà máy Samsung"
                />
                <p className="text-xs text-slate-400 mt-1">Giúp người duyệt hiểu lý do mua hàng</p>
              </div>

              <div className="lg:col-span-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Số PR</label>
                <div className="relative">
                  <input
                    value={
                      department?.trim()
                        ? prNoPreview?.prNumber
                          ? ensurePrNumberHasSite(prNoPreview.prNumber, userSiteCode)
                          : isFetchingPRNo
                            ? 'Đang tạo số PR...'
                            : ''
                        : ''
                    }
                    readOnly
                    placeholder="Chọn Phòng ban để tạo số PR"
                    className="w-full px-4 py-3 border border-dashed border-indigo-300 rounded-xl bg-gradient-to-r from-indigo-50/50 to-blue-50/50 text-indigo-700 font-bold text-lg placeholder:text-slate-400 placeholder:font-normal"
                  />
                  {prNoPreview?.prNumber && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Ghi chú & tệp đính kèm */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200/60 p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl text-white shadow-md">
                <FileUp className="w-5 h-5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Ghi chú & Tệp đính kèm</h2>
                <p className="text-xs text-slate-500">Bản vẽ, spec, link tham khảo — PDF, Excel, Image</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ghi chú</label>
              <textarea
                {...register('notes')}
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all resize-none"
                placeholder="Thông tin bổ sung (bản vẽ, spec, bối cảnh, báo giá sơ bộ, link tham khảo...)"
              />
              <p className="text-xs text-slate-400 mt-1.5">
                Đơn giá do bộ phận mua xác định sau khi báo giá. Có thể đính kèm tài liệu tham khảo nếu cần.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Tệp đính kèm</label>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 px-5 py-3 border-2 border-dashed border-sky-300 bg-sky-50/50 rounded-xl hover:bg-sky-100/50 hover:border-sky-400 cursor-pointer transition-all">
                  <FileUp className="w-5 h-5 text-sky-600" strokeWidth={2} />
                  <span className="text-sm font-medium text-sky-700">Chọn file đính kèm</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setAttachments(files);
                    }}
                  />
                </label>
                <div className="text-sm text-slate-500 font-medium">
                  {attachments.length > 0 ? (
                    <span className="text-sky-600">{attachments.length} file đã chọn</span>
                  ) : (
                    'Chưa có file'
                  )}
                </div>
              </div>
              {attachments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {attachments.map((f) => (
                    <div key={f.name} className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg text-sm font-medium">
                      <FileUp className="w-3.5 h-3.5" />
                      {f.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SECTION 5 – APPROVAL FLOW */}
          <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 rounded-2xl shadow-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-xl text-white">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Quy trình duyệt</h2>
                <p className="text-xs text-slate-400">GĐ Chi nhánh duyệt dựa trên: Nội dung / quy mô PR & Mục đích mua (giá do bộ phận mua xử lý sau)</p>
              </div>
            </div>
            {!canSubmitForApproval && (
              <div className="flex gap-3 rounded-xl border border-amber-400/50 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-300" strokeWidth={2} />
                <div>
                  <p className="font-semibold text-amber-50">Chưa cấu hình người duyệt cấp 1</p>
                  <p className="mt-1 text-xs text-amber-100/90 leading-relaxed">
                    Tài khoản cần có <strong className="text-amber-50">direct_manager_code</strong> trỏ tới username của{' '}
                    <strong className="text-amber-50">Trưởng phòng (DEPARTMENT_HEAD)</strong>. Liên hệ quản trị hoặc chạy lại script seed user mặc định.
                    Bạn vẫn có thể <strong className="text-amber-50">Lưu nháp</strong>.
                  </p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative p-5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">1</div>
                <div className="text-sm font-semibold text-white mt-2">Người yêu cầu</div>
                <div className="text-xs text-slate-400 mt-1">Tạo PR & Gửi duyệt</div>
              </div>
              <div className="relative p-5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">2</div>
                <div className="absolute top-1/2 -left-4 w-4 h-0.5 bg-white/20 hidden md:block"></div>
                <div className="text-sm font-semibold text-white mt-2">Trưởng phòng (QLTT)</div>
                <div className="text-xs text-slate-400 mt-1">Duyệt cấp 1 / Trả bổ sung</div>
              </div>
              <div className="relative p-5 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">3</div>
                <div className="absolute top-1/2 -left-4 w-4 h-0.5 bg-white/20 hidden md:block"></div>
                <div className="text-sm font-semibold text-white mt-2">Người mua</div>
                <div className="text-xs text-slate-400 mt-1">Xử lý mua (Giai đoạn sau)</div>
              </div>
            </div>
          </div>
        </form>
        </div>

        {newPartOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 app-modal-backdrop-enter"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-part-dialog-title"
            >
              <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-md" aria-hidden />
              <div
                className="app-modal-panel-enter modal-popup-panel relative w-full max-w-lg space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl ring-1 ring-slate-200/50"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div>
                  <h3 id="new-part-dialog-title" className="text-lg font-bold text-slate-900">
                    Tạo vật tư mới trong danh mục
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Mã phải duy nhất. Vật tư tạo tại đây là tạm thời cho phiên hiện tại (reload trang sẽ mất).
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Mã vật tư <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={newPartForm.partInternalCode}
                      onChange={(e) => setNewPartForm((s) => ({ ...s, partInternalCode: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
                      placeholder="VD: P-001"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Tên vật tư <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={newPartForm.partName}
                      onChange={(e) => setNewPartForm((s) => ({ ...s, partName: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
                      placeholder="VD: Motor Servo 750W"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Đơn vị <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={newPartForm.unit}
                      onChange={(e) => setNewPartForm((s) => ({ ...s, unit: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
                      placeholder="pcs, set, m..."
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Hãng / NSX
                    </label>
                    <input
                      value={newPartForm.manufacturer}
                      onChange={(e) => setNewPartForm((s) => ({ ...s, manufacturer: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
                      placeholder="Tuỳ chọn"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Link tham khảo (buyer)
                    </label>
                    <input
                      value={newPartForm.referenceUrl}
                      onChange={(e) => setNewPartForm((s) => ({ ...s, referenceUrl: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
                      placeholder="https://… (datasheet, catalog — tuỳ chọn)"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Lưu vào danh mục; nếu cột Spec đang trống sẽ tự điền link vào dòng PR.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewPartOpen(false);
                      setNewPartRowIndex(null);
                      setNewPartForm({ partInternalCode: '', partName: '', unit: 'pcs', manufacturer: '', referenceUrl: '' });
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={
                      !newPartForm.partInternalCode.trim() ||
                      !newPartForm.partName.trim() ||
                      !newPartForm.unit.trim()
                    }
                    onClick={createTemporaryPart}
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:from-violet-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Lưu tạm & gán vào dòng
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>

      {/* Thanh hành động: nằm dưới vùng cuộn (flex shrink-0) — không dùng fixed để tránh đè nội dung */}
      <div className="shrink-0 w-full border-t border-slate-200 bg-white py-2 pb-[env(safe-area-inset-bottom,0px)] sm:py-2.5">
        <div className="mx-auto flex w-full max-w-[1800px] min-w-0 flex-wrap items-center justify-between gap-2 px-3 sm:px-4 md:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-3 w-3 shrink-0 rounded-full bg-amber-400 animate-pulse" />
              <div className="text-sm text-slate-600">
                <span className="font-bold text-slate-900">Nháp</span>
                <span className="mx-2 text-slate-300">•</span>
                Lưu nháp hoặc gửi duyệt
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => navigate(getBackRoute())}
                className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all font-medium"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Save className="w-4 h-4" strokeWidth={2} />
                {createMutation.isPending ? 'Đang lưu...' : 'Lưu nháp'}
              </button>
              <button
                type="button"
                onClick={onSubmitPR}
                disabled={
                  createMutation.isPending ||
                  stockIssueMutation.isPending ||
                  hasItemRuleErrors ||
                  (needsPrPath && !canSubmitForApproval)
                }
                title={
                  hasItemRuleErrors
                    ? 'Có dòng chưa đạt rule Loại hàng'
                    : needsPrPath && !canSubmitForApproval
                    ? 'Thiếu direct_manager_code trên tài khoản — không gửi duyệt PR được'
                    : undefined
                }
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Send className="w-4 h-4" strokeWidth={2} />
                {createMutation.isPending || stockIssueMutation.isPending
                  ? 'Đang xử lý...'
                  : 'Gửi yêu cầu'}
              </button>
            </div>
        </div>
      </div>

      <RequestorCustomerPODetailModal
        open={customerPODetailOpen && !!selectedCustomerPODetail}
        onClose={() => setCustomerPODetailOpen(false)}
        data={selectedCustomerPODetail}
        resolvePrPath={(prId) =>
          location.pathname.includes('/department-head')
            ? `/dashboard/department-head/my-prs/${prId}`
            : `/dashboard/requestor/pr/${prId}`
        }
      />

      {allStockModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="all-stock-modal-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
              <h3 id="all-stock-modal-title" className="text-lg font-bold text-slate-900">
                Đủ tồn kho
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Tất cả vật tư đều có sẵn trong kho. Hệ thống không tạo PR mua hàng. Bạn có muốn tạo{' '}
                <strong className="text-slate-800">phiếu xuất kho</strong> để giữ hàng / xuất theo quy trình
                kho không?
              </p>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={cancelAllStockModal}
                  disabled={stockIssueMutation.isPending}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={confirmAllStockIssue}
                  disabled={stockIssueMutation.isPending}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-medium text-sm disabled:opacity-50"
                >
                  {stockIssueMutation.isPending ? 'Đang tạo...' : 'Tạo phiếu xuất kho'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {afterPrIssueModalOpen &&
        postPrIssueContext &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 app-modal-backdrop-enter"
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-pr-issue-modal-title"
          >
            <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-md" aria-hidden />
            <div
              className="app-modal-panel-enter relative w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xl ring-1 ring-slate-200/50 max-h-[min(90vh,40rem)]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h3 id="post-pr-issue-modal-title" className="text-lg font-bold text-slate-900">
                Tạo phiếu xuất kho cho phần đủ tồn?
              </h3>
              <p className="text-sm text-slate-600">
                PR <strong>{postPrIssueContext.prNumber}</strong> đã được tạo cho phần cần mua. Các dòng sau có
                thể xuất từ kho. Chọn <strong>Để sau</strong> để lưu phiếu xuất kho dạng <strong>nháp</strong> — sẽ
                hiện trong <strong>Theo dõi phiếu xuất kho</strong> để bạn gửi kho sau.
              </p>
              <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100 text-sm">
                {postPrIssueContext.items.map((it, li) => (
                  <li key={`${it.partInternalCode}-${li}`} className="flex justify-between gap-2 px-3 py-2">
                    <span className="truncate font-medium text-slate-800">{it.partInternalCode}</span>
                    <span className="shrink-0 text-slate-600">
                      {it.qty.toLocaleString('vi-VN')} {it.unit ?? ''}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => void skipPostPrIssue()}
                  disabled={stockIssueMutation.isPending || deferPostPrStockIssueBusy}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {deferPostPrStockIssueBusy ? 'Đang lưu nháp...' : 'Để sau'}
                </button>
                <button
                  type="button"
                  onClick={confirmPostPrIssue}
                  disabled={stockIssueMutation.isPending || deferPostPrStockIssueBusy}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {stockIssueMutation.isPending ? 'Đang tạo...' : 'Tạo phiếu xuất kho'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default CreatePR;

