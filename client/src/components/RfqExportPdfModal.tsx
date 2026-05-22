import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Calendar,
  CalendarClock,
  ClipboardList,
  FileCheck2,
  FileDown,
  FileSpreadsheet,
  FileText,
  Coins,
  CreditCard,
  Handshake,
  Hash,
  Link2,
  MessageSquare,
  Truck,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  User,
  type LucideIcon,
} from 'lucide-react';
import { dashboardV3CtaLinkClass } from './dashboard/DashboardV3Chrome';
import { AppModal } from './AppModal';
import CustomSelect from './CustomSelect';
import { buyerService } from '../services/buyerService';
import { useCurrentUser } from '../hooks/useAuth';
import { RFQ_PDF_COMPANY_LEGAL_NAME_VI } from '../constants/companyConfig';
import {
  downloadRfqPdf,
  formatDdMmYyyy,
  formatExpectedDeliveryDdMmYyyy,
  formatExpectedReceiptFromVendorDdMmYyyy,
  type RfqPdfItemRow,
} from '../utils/rfqPdf';
import type { PRSalesOrderInfo } from '../types/prSalesOrder';
import { SUPPLIERS_QUERY_KEY } from '../constants/supplierQuery';

type RfqPdfSupplierOption = { id: string; name: string; code?: string | null };

/** Khớp dòng SO trên bảng PR: mã SO/PO/mã dự án, tên dự án/KH, hoặc cả `label` ghép */
function resolveSoCodeForRfqPdf(pr: any): string {
  if (!pr) return '';
  const sum = (pr.salesOrder ?? pr.salesOrderSummary) as PRSalesOrderInfo | undefined;
  const so = pr.salesPO;
  const t = (v: unknown) => {
    if (v == null) return '';
    const s = String(v).trim();
    return s;
  };

  const narrow =
    t(sum?.salesPONumber) ||
    t(sum?.customerPONumber) ||
    t(sum?.projectCode) ||
    t(sum?.projectName) ||
    t(sum?.customerName) ||
    t(so?.salesPONumber) ||
    t(so?.customerPONumber) ||
    t(pr.customerPO) ||
    t(so?.projectCode) ||
    t(pr.projectCode) ||
    t(pr.projectName) ||
    t(so?.projectName) ||
    t(pr.customerName);

  if (narrow) return narrow;
  return t(sum?.label);
}

/** `type="date"` → `YYYY-MM-DD` → hiển thị PDF kiểu dd/mm/yyyy (không lệch múi giờ) */
function ymdInputToDdMmYyyy(ymd: string): string {
  const t = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '';
  const [y, m, d] = t.split('-');
  return `${d}/${m}/${y}`;
}

const PAYMENT_TERM_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '— Chọn hoặc gõ bên dưới —' },
  { value: '30% trước – 70% sau khi giao hàng', label: '30% trước – 70% sau khi giao hàng' },
  { value: 'Thanh toán sau 30 ngày kể từ ngày giao hàng', label: 'Thanh toán sau 30 ngày kể từ ngày giao hàng' },
  { value: 'Thanh toán ngay khi giao hàng', label: 'Thanh toán ngay khi giao hàng' },
  { value: 'LC tại sight', label: 'LC tại sight' },
  { value: '__custom__', label: 'Khác (ô tùy chỉnh)' },
];

const CURRENCY_OPTIONS = [
  { value: 'VND', label: 'VND' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'CNY', label: 'CNY' },
];

const RFQ_PDF_PANEL =
  'overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.03]';
const RFQ_PDF_INPUT =
  'w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
const RFQ_PDF_EDITABLE_ZONE =
  'rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 ring-1 ring-slate-900/[0.03] sm:p-5';

type IconTone = 'slate' | 'indigo' | 'violet' | 'emerald' | 'amber';

const HEADER_GLASS_SHELL: Record<IconTone, string> = {
  slate:
    'border-b border-slate-200/70 bg-gradient-to-r from-slate-100/95 via-slate-50/75 to-white/50 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85)]',
  indigo:
    'border-b border-indigo-200/60 bg-gradient-to-r from-indigo-100/95 via-indigo-50/80 to-white/45 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)]',
  violet:
    'border-b border-violet-200/60 bg-gradient-to-r from-violet-100/95 via-violet-50/80 to-white/45 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)]',
  emerald:
    'border-b border-emerald-200/60 bg-gradient-to-r from-emerald-100/95 via-emerald-50/80 to-white/45 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)]',
  amber:
    'border-b border-amber-200/60 bg-gradient-to-r from-amber-100/95 via-amber-50/80 to-white/45 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)]',
};

const HEADER_GLASS_GLOW: Record<IconTone, string> = {
  slate: 'bg-[radial-gradient(ellipse_80%_120%_at_0%_0%,rgba(100,116,139,0.12),transparent_55%)]',
  indigo: 'bg-[radial-gradient(ellipse_80%_120%_at_0%_0%,rgba(99,102,241,0.18),transparent_55%)]',
  violet: 'bg-[radial-gradient(ellipse_80%_120%_at_0%_0%,rgba(139,92,246,0.16),transparent_55%)]',
  emerald: 'bg-[radial-gradient(ellipse_80%_120%_at_0%_0%,rgba(16,185,129,0.14),transparent_55%)]',
  amber: 'bg-[radial-gradient(ellipse_80%_120%_at_0%_0%,rgba(245,158,11,0.14),transparent_55%)]',
};

const HEADER_ICON_GRADIENT: Record<IconTone, string> = {
  slate: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-md shadow-slate-500/30 ring-2 ring-white/70',
  indigo:
    'bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-md shadow-indigo-500/35 ring-2 ring-white/75',
  violet:
    'bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-md shadow-violet-500/35 ring-2 ring-white/75',
  emerald:
    'bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-md shadow-emerald-500/35 ring-2 ring-white/75',
  amber:
    'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/35 ring-2 ring-white/75',
};

function SectionHeader({
  icon,
  iconTone = 'indigo',
  title,
  description,
  locked,
}: {
  icon: LucideIcon;
  iconTone?: IconTone;
  title: string;
  description?: string;
  locked?: boolean;
}) {
  const Icon = icon;
  return (
    <div className={`relative overflow-hidden px-4 py-3.5 sm:px-5 ${HEADER_GLASS_SHELL[iconTone]}`}>
      <div className={`pointer-events-none absolute inset-0 ${HEADER_GLASS_GLOW[iconTone]}`} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/50 via-transparent to-transparent"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${HEADER_ICON_GRADIENT[iconTone]}`}
            aria-hidden
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
            {description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600/90">{description}</p>
            ) : null}
          </div>
        </div>
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 shadow-sm backdrop-blur-md">
            <Lock className="h-3 w-3 text-slate-500" aria-hidden />
            Khóa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-800 shadow-sm backdrop-blur-md">
            <Pencil className="h-3 w-3 text-indigo-600" aria-hidden />
            Có thể chỉnh
          </span>
        )}
      </div>
    </div>
  );
}

function SubSectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/80">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </span>
      <p className="text-xs font-semibold text-slate-800">{children}</p>
    </div>
  );
}

function LockedValue({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {Icon ? <Icon className="h-3 w-3 shrink-0 text-slate-400" strokeWidth={2} aria-hidden /> : null}
        <span>{label}</span>
      </p>
      <p className="rounded-xl border border-slate-200/90 bg-slate-50/90 px-3.5 py-2.5 text-sm font-medium leading-snug text-slate-900">
        {value || '—'}
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{hint}</p> : null}
    </div>
  );
}

function EditableLabel({
  children,
  htmlFor,
  icon: Icon,
}: {
  children: ReactNode;
  htmlFor?: string;
  icon?: LucideIcon;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700">
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} aria-hidden /> : null}
      {children}
    </label>
  );
}

export type RfqExportPdfModalProps = {
  open: boolean;
  rfqId: string | null;
  onClose: () => void;
};

export function RfqExportPdfModal({ open, rfqId, onClose }: RfqExportPdfModalProps) {
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['buyer-rfq-export-pdf', rfqId],
    queryFn: () => buyerService.getRFQById(rfqId!),
    enabled: open && !!rfqId,
    staleTime: 60_000,
  });

  /** Hạn nhận báo giá — date → dd/mm/yyyy trên PDF (mục 1) */
  const [quoteDeadline, setQuoteDeadline] = useState('');
  /** SO in trên PDF — mặc định từ PR; buyer có thể sửa / bổ sung khi hệ thống trống */
  const [pdfSalesOrderCode, setPdfSalesOrderCode] = useState('');
  const [currency, setCurrency] = useState('VND');
  const [paymentTermsSelect, setPaymentTermsSelect] = useState('');
  const [paymentTermsCustom, setPaymentTermsCustom] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [noteForNcc, setNoteForNcc] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  /** Email / SĐT hiển thị trên PDF — mặc định từ profile, buyer có thể sửa trước khi tải */
  const [pdfContactEmail, setPdfContactEmail] = useState('');
  const [pdfContactPhone, setPdfContactPhone] = useState('');
  const [pdfSupplierId, setPdfSupplierId] = useState('');

  const { data: suppliersCatalog, refetch: refetchSuppliersCatalog, isFetching: suppliersFetching } = useQuery({
    queryKey: [...SUPPLIERS_QUERY_KEY],
    queryFn: () => buyerService.getSuppliers(),
    enabled: open,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (!open) return;
    void queryClient.invalidateQueries({ queryKey: [...SUPPLIERS_QUERY_KEY] });
    void refetchSuppliersCatalog();
  }, [open, queryClient, refetchSuppliersCatalog]);

  const quotationSuppliers = useMemo((): RfqPdfSupplierOption[] => {
    const map = new Map<string, RfqPdfSupplierOption>();
    for (const q of data?.quotations || []) {
      const s = q?.supplier;
      if (s?.id && s?.name) {
        map.set(s.id, { id: s.id, name: String(s.name).trim(), code: s.code ?? null });
      }
    }
    return [...map.values()];
  }, [data?.quotations]);

  const supplierOptions = useMemo((): RfqPdfSupplierOption[] => {
    const map = new Map<string, RfqPdfSupplierOption>();
    for (const s of quotationSuppliers) map.set(s.id, s);
    for (const s of suppliersCatalog?.suppliers || []) {
      if (s?.id && s?.name && !map.has(s.id)) {
        map.set(s.id, { id: s.id, name: String(s.name).trim(), code: s.code ?? null });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [quotationSuppliers, suppliersCatalog?.suppliers]);

  const selectedSupplier = supplierOptions.find((s) => s.id === pdfSupplierId) ?? null;

  const locked = useMemo(() => {
    if (!data) return null;
    const pr = data.purchaseRequest;
    const req = pr?.requestor;
    const soCode = resolveSoCodeForRfqPdf(pr);
    const deliveryDeadline =
      formatDdMmYyyy(pr?.salesPO?.deliveryDeadline) ||
      formatDdMmYyyy(pr?.requiredDate) ||
      '—';
    const prRequiredDate = pr?.requiredDate as string | null | undefined;
    const prItems = pr?.items || [];

    const items: RfqPdfItemRow[] = prItems.map((it: any) => {
      const requestorDeliveryDate = it.desiredDeliveryDate || prRequiredDate;
      return {
        lineNo: it.lineNo,
        itemName: it.description || '',
        internalCode: it.partNo || '',
        specification: [it.spec, it.manufacturer].filter(Boolean).join(' / ') || '',
        unit: it.unit || '',
        qty: String(it.qty ?? ''),
        expectedDelivery: formatExpectedDeliveryDdMmYyyy(requestorDeliveryDate),
        note: it.remark || '',
      };
    });

    const expectedReceiptFromVendor = formatExpectedReceiptFromVendorDdMmYyyy(
      prItems,
      prRequiredDate
    );

    return {
      rfqNumber: data.rfqNumber,
      documentDate: formatDdMmYyyy(new Date().toISOString()),
      companyName: RFQ_PDF_COMPANY_LEGAL_NAME_VI,
      buyerName: currentUser?.fullName?.trim() || currentUser?.username || '—',
      salesOrderCode: soCode ? String(soCode) : '—',
      department: pr?.department || '—',
      requestedBy: req?.fullName?.trim() || req?.username || '—',
      deliveryDeadline,
      deliveryLocation: pr?.location || '—',
      expectedReceiptFromVendor,
      prCurrency: pr?.currency || 'VND',
      items,
    };
  }, [data, currentUser]);

  useEffect(() => {
    if (!open) {
      setPdfSupplierId('');
      setExportError(null);
      return;
    }
    if (!data) return;
    setExportError(null);
    setQuoteDeadline('');
    setPdfSalesOrderCode(resolveSoCodeForRfqPdf(data.purchaseRequest) || '');
    setPaymentTermsSelect('');
    setPaymentTermsCustom('');
    const loc = data.purchaseRequest?.location?.trim();
    setDeliveryTerms(loc ? `Giao hàng tại: ${loc}` : '');
    setNoteForNcc('');
    setPdfContactEmail((currentUser?.email || '').trim());
    setPdfContactPhone((currentUser?.phone || '').trim());
    setPdfSupplierId((prev) => {
      if (prev) return prev;
      if (quotationSuppliers.length === 1) return quotationSuppliers[0].id;
      return '';
    });
  }, [open, data?.id, currentUser?.email, currentUser?.phone, quotationSuppliers]);

  const emailSubjectPreview = locked
    ? `${locked.rfqNumber} – Quotation – ${selectedSupplier?.name?.trim() || '[Tên NCC]'}`
    : '';

  useEffect(() => {
    if (locked?.prCurrency) setCurrency(locked.prCurrency);
  }, [locked?.prCurrency]);

  const paymentTermsFinal =
    paymentTermsSelect === '__custom__'
      ? paymentTermsCustom.trim()
      : paymentTermsSelect || paymentTermsCustom.trim();

  const supplierRequired = supplierOptions.length > 0;
  const canPickSupplier = !supplierRequired || !!pdfSupplierId;
  const busy = generatingPdf || generatingExcel;

  const handleDownloadPdf = async () => {
    if (!locked) return;
    if (supplierRequired && !pdfSupplierId) {
      setExportError('Vui lòng chọn NCC trước khi tải file.');
      return;
    }
    setGeneratingPdf(true);
    setExportError(null);
    try {
      await downloadRfqPdf({
        rfqNumber: locked.rfqNumber,
        documentDate: locked.documentDate,
        companyName: locked.companyName,
        buyerName: locked.buyerName,
        buyerEmail: pdfContactEmail.trim() || '—',
        buyerPhone: pdfContactPhone.trim(),
        salesOrderCode: pdfSalesOrderCode.trim() || '—',
        department: locked.department,
        requestedBy: locked.requestedBy,
        deliveryDeadline: locked.deliveryDeadline,
        deliveryLocation: locked.deliveryLocation,
        expectedReceiptFromVendor: locked.expectedReceiptFromVendor,
        items: locked.items,
        currency: currency.trim() || 'VND',
        paymentTerms: paymentTermsFinal,
        deliveryTerms: deliveryTerms.trim(),
        responseDeadline: ymdInputToDdMmYyyy(quoteDeadline),
        responseEmail: pdfContactEmail.trim() || '—',
        noteForSupplier: noteForNcc.trim(),
        supplierName: selectedSupplier?.name?.trim() || '—',
        supplierCode: selectedSupplier?.code?.trim() || undefined,
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!rfqId || !pdfSupplierId) {
      setExportError('Vui lòng chọn NCC — tên NCC sẽ có trong tên file Excel.');
      return;
    }
    setGeneratingExcel(true);
    setExportError(null);
    try {
      await buyerService.downloadRFQQuotationExcel(rfqId, pdfSupplierId, {
        rfqNumber: locked?.rfqNumber ?? rfqId,
        supplierName: selectedSupplier?.name ?? 'NCC',
      });
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        (e instanceof Error ? e.message : 'Tải Excel thất bại');
      setExportError(msg);
    } finally {
      setGeneratingExcel(false);
    }
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="3xl"
      title="Tải file gửi NCC"
      subtitle="Chọn NCC, chỉnh điều kiện PDF nếu cần. Excel chỉ gồm bảng cột báo giá cho NCC điền."
      headerIcon={<FileDown className="h-5 w-5 text-indigo-600" strokeWidth={2} />}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-3 border-t border-slate-200/90 bg-[#F8FAFC] px-4 py-3.5 sm:px-5">
          <button type="button" onClick={onClose} disabled={busy} className={dashboardV3CtaLinkClass}>
            Hủy
          </button>
          <button
            type="button"
            disabled={busy || isLoading || !data || !rfqId || !canPickSupplier}
            onClick={() => void handleDownloadExcel()}
            className="inline-flex items-center gap-2 rounded-2xl border border-teal-200 bg-gradient-to-b from-teal-50 to-white px-5 py-2.5 text-sm font-semibold text-teal-800 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 disabled:pointer-events-none disabled:opacity-50"
          >
            {generatingExcel ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" strokeWidth={2} />
            )}
            Tải Excel
          </button>
          <button
            type="button"
            disabled={busy || isLoading || !data || !locked || !canPickSupplier}
            onClick={() => void handleDownloadPdf()}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 hover:shadow-lg disabled:pointer-events-none disabled:opacity-50"
          >
            {generatingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" strokeWidth={2} />
            )}
            Tải PDF
          </button>
        </div>
      }
    >
      {isLoading && (
        <div className="flex items-center gap-2 py-12 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          Đang tải chi tiết RFQ…
        </div>
      )}
      {isError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {(error as Error)?.message || 'Không tải được RFQ.'}
        </p>
      )}
      {exportError ? (
        <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {exportError}
        </p>
      ) : null}
      {!isLoading && data && locked && (
        <div className="space-y-5 text-sm">
          <div className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/80 px-4 py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_8px_28px_-14px_rgba(79,70,229,0.18)] ring-1 ring-indigo-200/40 backdrop-blur-xl sm:px-6">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_0%_-20%,rgba(99,102,241,0.18),transparent_55%)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_100%_120%,rgba(139,92,246,0.12),transparent_50%)]"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute right-8 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-indigo-300/15 blur-2xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/60 via-white/15 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.3] [background-image:linear-gradient(rgba(99,102,241,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.06)_1px,transparent_1px)] [background-size:22px_22px]"
              aria-hidden
            />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3.5">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25 ring-2 ring-white/90"
                  aria-hidden
                >
                  <FileText className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">
                    Tải file gửi NCC
                  </p>
                  <p className="mt-1 truncate font-mono text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                    {locked.rfqNumber}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/80 bg-white/60 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/50 backdrop-blur-sm">
                      <Hash className="h-3 w-3 text-indigo-600" strokeWidth={2} aria-hidden />
                      {data.purchaseRequest?.prNumber}
                    </span>
                    {typeof data.itemCount === 'number' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-100/90 bg-violet-50/70 px-2.5 py-1 text-xs font-medium text-violet-800 shadow-sm ring-1 ring-violet-100/80">
                        <Package className="h-3 w-3" strokeWidth={2} aria-hidden />
                        {data.itemCount} dòng hàng
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 sm:justify-end">
                <div className="flex items-center gap-3 rounded-xl border border-indigo-100/90 bg-white/75 px-3.5 py-2.5 shadow-sm ring-1 ring-white/80 backdrop-blur-md">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/80">
                    <CalendarClock className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </span>
                  <span className="text-left leading-tight">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Nhận hàng dự kiến
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-slate-800">
                      {locked.expectedReceiptFromVendor || '—'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <section className={RFQ_PDF_PANEL}>
            <SectionHeader
              icon={Building2}
              iconTone="slate"
              title="Nhà cung cấp (NCC)"
              description="Chọn NCC cho PDF, Excel mẫu báo giá và tiêu đề email."
            />
            <div className="space-y-3 p-4 sm:p-5">
              <EditableLabel htmlFor="rfq-pdf-supplier" icon={Building2}>
                Tên NCC trên PDF <span className="text-red-500">*</span>
              </EditableLabel>
              {supplierOptions.length === 0 ? (
                <p className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3.5 py-3 text-sm text-amber-950">
                  Chưa có NCC trong database. Mở <strong>Buyer Manager → Quản lý NCC</strong> một lần
                  (hệ thống đồng bộ danh sách vào DB), hoặc tạo/import NCC tại đó, rồi mở lại modal này.
                </p>
              ) : (
                <>
                <p className="mb-2 text-xs text-slate-500">
                  {suppliersFetching
                    ? 'Đang tải danh sách NCC…'
                    : `${supplierOptions.length} NCC trong database (cùng nguồn Quản lý NCC)`}
                </p>
                <CustomSelect
                  id="rfq-pdf-supplier"
                  value={pdfSupplierId}
                  onValueChange={setPdfSupplierId}
                  enableDropdownSearch
                  dropdownSearchPlaceholder="Tìm theo tên hoặc mã NCC..."
                  className={RFQ_PDF_INPUT}
                >
                  <option value="">-- Chọn nhà cung cấp --</option>
                  {supplierOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ''}
                    </option>
                  ))}
                </CustomSelect>
                </>
              )}
              {emailSubjectPreview ? (
                <p className="text-xs text-slate-500">
                  Tiêu đề email: <span className="font-medium text-slate-800">{emailSubjectPreview}</span>
                </p>
              ) : null}
              {selectedSupplier && locked ? (
                <p className="text-xs text-teal-800">
                  Excel: No, Item, Unit Price, Total Price, Brand, Origin, Lead Time, MOQ, Warranty, Note —{' '}
                  <span className="font-mono font-medium">
                    RFQ_{locked.rfqNumber}_{selectedSupplier.name.replace(/\s+/g, '_')}_bao_gia.xlsx
                  </span>
                </p>
              ) : null}
            </div>
          </section>

          <section className={RFQ_PDF_PANEL}>
            <SectionHeader
              icon={FileCheck2}
              iconTone="indigo"
              title="Thông tin chứng từ"
              description="Tự động từ hệ thống — không chỉnh sửa trên PDF."
              locked
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
              <LockedValue icon={Hash} label="RFQ No" value={locked.rfqNumber} />
              <LockedValue icon={Calendar} label="Ngày lập" value={locked.documentDate} />
              <LockedValue icon={Building2} label="Công ty" value={locked.companyName} />
              <LockedValue icon={User} label="Buyer" value={locked.buyerName} />
            </div>
            <div className={`mx-4 mb-5 sm:mx-5 ${RFQ_PDF_EDITABLE_ZONE}`}>
              <SubSectionTitle icon={Mail}>Liên hệ in trên PDF</SubSectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <EditableLabel htmlFor="rfq-pdf-email" icon={Mail}>
                    Email
                  </EditableLabel>
                  <input
                    id="rfq-pdf-email"
                    type="email"
                    className={RFQ_PDF_INPUT}
                    value={pdfContactEmail}
                    onChange={(e) => setPdfContactEmail(e.target.value)}
                    placeholder="Email hiển thị cho NCC"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <EditableLabel htmlFor="rfq-pdf-phone" icon={Phone}>
                    Điện thoại
                  </EditableLabel>
                  <input
                    id="rfq-pdf-phone"
                    type="tel"
                    className={RFQ_PDF_INPUT}
                    value={pdfContactPhone}
                    onChange={(e) => setPdfContactPhone(e.target.value)}
                    placeholder="Số điện thoại liên hệ"
                    autoComplete="tel"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className={RFQ_PDF_PANEL}>
            <SectionHeader
              icon={ClipboardList}
              iconTone="violet"
              title="Yêu cầu từ PR / SO"
              description="Dữ liệu trace từ PR; SO có thể bổ sung trước khi tải."
              locked
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <LockedValue icon={Building2} label="Phòng ban" value={locked.department} />
              <LockedValue icon={User} label="Người yêu cầu" value={locked.requestedBy} />
              <LockedValue
                icon={CalendarClock}
                label="Hạn giao (SO / PR)"
                value={locked.deliveryDeadline}
                hint="Tham chiếu — khác với Expected delivery từng dòng (+2 ngày)."
              />
              <LockedValue icon={MapPin} label="Địa điểm giao" value={locked.deliveryLocation} />
            </div>
            <div className={`mx-4 mb-5 sm:mx-5 ${RFQ_PDF_EDITABLE_ZONE}`}>
              <SubSectionTitle icon={Link2}>Sales Order (SO) — in trên PDF</SubSectionTitle>
              <input
                id="rfq-pdf-so"
                className={RFQ_PDF_INPUT}
                value={pdfSalesOrderCode}
                onChange={(e) => setPdfSalesOrderCode(e.target.value)}
                placeholder="Số SO / PO khách / mã dự án"
              />
              <p className="mt-2 text-xs text-slate-500">
                Gợi ý từ PR:{' '}
                <span className="font-medium text-slate-800">{locked.salesOrderCode}</span>
              </p>
            </div>
          </section>

          <section className={RFQ_PDF_PANEL}>
            <SectionHeader
              icon={Package}
              iconTone="emerald"
              title="Danh sách hàng"
              description="Expected delivery = ngày requestor trên dòng PR + 2 ngày trừ hao."
              locked
            />
            <div className="mx-4 mb-5 max-h-[min(280px,40vh)] overflow-auto rounded-xl border border-slate-200/90 sm:mx-5">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Item</th>
                    <th className="px-3 py-2.5">Mã nội bộ</th>
                    <th className="px-3 py-2.5">Spec</th>
                    <th className="px-3 py-2.5">ĐVT</th>
                    <th className="px-3 py-2.5">Qty</th>
                    <th className="px-3 py-2.5">Expected delivery</th>
                    <th className="px-3 py-2.5">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {locked.items.map((row, idx) => (
                    <tr
                      key={row.lineNo}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
                    >
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{row.lineNo}</td>
                      <td className="max-w-[160px] px-3 py-2.5 font-medium text-slate-900" title={row.itemName}>
                        {row.itemName}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{row.internalCode || '—'}</td>
                      <td className="max-w-[140px] px-3 py-2.5 text-slate-600" title={row.specification}>
                        {row.specification || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{row.unit || '—'}</td>
                      <td className="px-3 py-2.5 font-medium tabular-nums text-slate-900">{row.qty}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-indigo-900">
                        {row.expectedDelivery || '—'}
                      </td>
                      <td className="max-w-[120px] px-3 py-2.5 text-slate-600" title={row.note}>
                        {row.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={RFQ_PDF_PANEL}>
            <SectionHeader
              icon={Handshake}
              iconTone="amber"
              title="Điều kiện thương mại"
              description="Buyer nhập trước khi gửi PDF cho nhà cung cấp."
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <div>
                <EditableLabel icon={Coins}>Currency</EditableLabel>
                <CustomSelect className={RFQ_PDF_INPUT} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {CURRENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </CustomSelect>
              </div>
              <div>
                <EditableLabel icon={CreditCard}>Payment Terms</EditableLabel>
                <CustomSelect
                  className={RFQ_PDF_INPUT}
                  value={paymentTermsSelect}
                  onChange={(e) => setPaymentTermsSelect(e.target.value)}
                >
                  {PAYMENT_TERM_OPTIONS.map((o) => (
                    <option key={o.value || 'pt-empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </CustomSelect>
                {(paymentTermsSelect === '__custom__' || paymentTermsSelect === '') && (
                  <input
                    className={`${RFQ_PDF_INPUT} mt-2`}
                    placeholder={
                      paymentTermsSelect === '__custom__'
                        ? 'Nhập điều khoản thanh toán'
                        : 'Hoặc gõ trực tiếp điều khoản thanh toán'
                    }
                    value={paymentTermsCustom}
                    onChange={(e) => setPaymentTermsCustom(e.target.value)}
                  />
                )}
              </div>
              <div className="sm:col-span-2">
                <EditableLabel icon={Truck}>Delivery Terms</EditableLabel>
                <input
                  className={RFQ_PDF_INPUT}
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  placeholder="VD: Giao tại kho / Incoterms…"
                />
              </div>
              <LockedValue
                icon={CalendarClock}
                label="Ngày dự kiến nhận hàng từ NCC"
                value={locked.expectedReceiptFromVendor}
                hint="Ngày trễ nhất trong danh sách dòng (+ 2 ngày) — khóa theo PR."
              />
              <div>
                <EditableLabel htmlFor="rfq-quote-deadline" icon={Calendar}>
                  Hạn nhận báo giá
                </EditableLabel>
                <input
                  id="rfq-quote-deadline"
                  type="date"
                  className={RFQ_PDF_INPUT}
                  value={quoteDeadline}
                  onChange={(e) => setQuoteDeadline(e.target.value)}
                />
                <p className="mt-1.5 text-[11px] text-slate-500">Để trống → hiển thị &quot;—&quot; trên PDF.</p>
              </div>
              <div className="sm:col-span-2">
                <EditableLabel htmlFor="rfq-note-ncc" icon={MessageSquare}>
                  Ghi chú cho NCC
                </EditableLabel>
                <textarea
                  id="rfq-note-ncc"
                  className={`${RFQ_PDF_INPUT} min-h-[80px] resize-y`}
                  value={noteForNcc}
                  onChange={(e) => setNoteForNcc(e.target.value)}
                  placeholder="Yêu cầu bổ sung gửi nhà cung cấp…"
                  rows={3}
                />
              </div>
            </div>
          </section>
        </div>
      )}
    </AppModal>
  );
}
