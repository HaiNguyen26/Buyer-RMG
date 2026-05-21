import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  Copy,
  FileText,
  PieChart,
  Loader2,
  MessageSquareWarning,
  Moon,
  Package,
  ShieldCheck,
  Sun,
  Truck,
  X,
  type LucideIcon,
} from 'lucide-react';
import { poApprovalStatusLabel } from '../../constants/poApprovalQueueFilter';
import { PO_LINE_STATUS_LABELS } from '../../utils/poDetailUiStrings';
import { inferVatPercentFromLine } from '../../utils/quotationLine';

type TabKey = 'general' | 'items';

/** Typography & color tokens (Stripe-like hierarchy) */
const label =
  'mb-1 block text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500';
const labelKpi =
  'mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500';
const hint = 'text-[10px] font-medium text-slate-400 dark:text-slate-500';
type SectionTone = 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'sky';

const sectionToneStyles: Record<
  SectionTone,
  { icon: string; title: string; border: string; accent: string }
> = {
  indigo: {
    icon: 'bg-indigo-500/10 text-indigo-600 ring-indigo-500/15 dark:bg-indigo-500/20 dark:text-indigo-400 dark:ring-indigo-400/25',
    title: 'text-indigo-950 dark:text-indigo-100',
    border: 'border-indigo-100/90 dark:border-indigo-500/20',
    accent: 'from-indigo-500/40 to-transparent',
  },
  violet: {
    icon: 'bg-violet-500/10 text-violet-600 ring-violet-500/15 dark:bg-violet-500/20 dark:text-violet-400 dark:ring-violet-400/25',
    title: 'text-violet-950 dark:text-violet-100',
    border: 'border-violet-100/90 dark:border-violet-500/20',
    accent: 'from-violet-500/40 to-transparent',
  },
  emerald: {
    icon: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/15 dark:bg-emerald-500/20 dark:text-emerald-400 dark:ring-emerald-400/25',
    title: 'text-emerald-950 dark:text-emerald-100',
    border: 'border-emerald-100/90 dark:border-emerald-500/20',
    accent: 'from-emerald-500/40 to-transparent',
  },
  amber: {
    icon: 'bg-amber-500/10 text-amber-700 ring-amber-500/15 dark:bg-amber-500/20 dark:text-amber-400 dark:ring-amber-400/25',
    title: 'text-amber-950 dark:text-amber-100',
    border: 'border-amber-100/90 dark:border-amber-500/20',
    accent: 'from-amber-500/40 to-transparent',
  },
  rose: {
    icon: 'bg-rose-500/10 text-rose-600 ring-rose-500/15 dark:bg-rose-500/20 dark:text-rose-400 dark:ring-rose-400/25',
    title: 'text-rose-950 dark:text-rose-100',
    border: 'border-rose-100/90 dark:border-rose-500/20',
    accent: 'from-rose-500/40 to-transparent',
  },
  sky: {
    icon: 'bg-sky-500/10 text-sky-600 ring-sky-500/15 dark:bg-sky-500/20 dark:text-sky-400 dark:ring-sky-400/25',
    title: 'text-sky-950 dark:text-sky-100',
    border: 'border-sky-100/90 dark:border-sky-500/20',
    accent: 'from-sky-500/40 to-transparent',
  },
};

const kpiCellTone: Record<
  SectionTone,
  { panel: string; blob: string; blobSecondary: string; icon: string }
> = {
  indigo: {
    panel:
      'bg-gradient-to-br from-indigo-50/80 via-white to-indigo-50/20 dark:from-indigo-950/50 dark:via-slate-900 dark:to-slate-900',
    blob: 'bg-indigo-400/25 dark:bg-indigo-500/20',
    blobSecondary: 'bg-indigo-300/15 dark:bg-indigo-400/10',
    icon: sectionToneStyles.indigo.icon,
  },
  violet: {
    panel:
      'bg-gradient-to-br from-violet-50/80 via-white to-violet-50/15 dark:from-violet-950/45 dark:via-slate-900 dark:to-slate-900',
    blob: 'bg-violet-400/25 dark:bg-violet-500/20',
    blobSecondary: 'bg-violet-300/15 dark:bg-violet-400/10',
    icon: sectionToneStyles.violet.icon,
  },
  emerald: {
    panel:
      'bg-gradient-to-br from-emerald-50/70 via-white to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900',
    blob: 'bg-emerald-400/20 dark:bg-emerald-500/15',
    blobSecondary: 'bg-emerald-300/10',
    icon: sectionToneStyles.emerald.icon,
  },
  amber: {
    panel:
      'bg-gradient-to-br from-amber-50/70 via-white to-white dark:from-amber-950/35 dark:via-slate-900 dark:to-slate-900',
    blob: 'bg-amber-400/20',
    blobSecondary: 'bg-amber-300/10',
    icon: sectionToneStyles.amber.icon,
  },
  rose: {
    panel:
      'bg-gradient-to-br from-rose-50/70 via-white to-white dark:from-rose-950/35 dark:via-slate-900 dark:to-slate-900',
    blob: 'bg-rose-400/20',
    blobSecondary: 'bg-rose-300/10',
    icon: sectionToneStyles.rose.icon,
  },
  sky: {
    panel:
      'bg-gradient-to-br from-sky-50/80 via-white to-sky-50/15 dark:from-sky-950/45 dark:via-slate-900 dark:to-slate-900',
    blob: 'bg-sky-400/25 dark:bg-sky-500/20',
    blobSecondary: 'bg-sky-300/15 dark:bg-sky-400/10',
    icon: sectionToneStyles.sky.icon,
  },
};
const dataPrimary = 'font-semibold text-slate-900 dark:text-white';
const dataSecondary = 'font-semibold text-slate-700 dark:text-slate-300';
const dataHero = 'font-extrabold tracking-tight text-slate-900 dark:text-white';
const dataMono = 'font-semibold font-mono tracking-wider text-slate-900 dark:text-white';
const dataBank = 'font-black tracking-wider text-slate-900 dark:text-white';
const kpiHero = 'text-2xl font-black tracking-tight tabular-nums text-slate-900 dark:text-white';
const kpiMid = 'text-lg font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-white';
const linkAccent =
  'font-bold text-indigo-600 hover:underline dark:text-indigo-400';
const tabActive =
  'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400';
const tabIdle = 'border-transparent text-slate-400 hover:text-slate-500 dark:hover:text-slate-400';
const amberBadge =
  'inline-flex rounded-md border border-amber-500/15 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
const productTitle = 'block text-sm font-bold text-slate-900 dark:text-white';
const productSub = 'mt-0.5 block text-[11px] font-medium text-slate-400 dark:text-slate-500';
const tableHead =
  'border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-500';

function formatPaymentTermsDisplay(raw: string | null | undefined): string {
  if (!raw?.trim()) return '—';
  const text = raw.trim();
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean).join(' · ');
  } catch {
    /* plain */
  }
  return text;
}

function poLineSubtitle(item: {
  spec?: string | null;
  remark?: string | null;
  prItemCode?: string | null;
  unit?: string | null;
  lineStatus?: string;
}): string | null {
  const parts = [
    item.spec?.trim(),
    item.remark?.trim(),
    item.prItemCode?.trim() ? `Mã: ${item.prItemCode.trim()}` : null,
    item.unit?.trim() ? `ĐVT: ${item.unit.trim()}` : null,
    item.lineStatus != null
      ? PO_LINE_STATUS_LABELS.vi[item.lineStatus] ?? item.lineStatus
      : null,
  ].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(' · ') : null;
}

function KpiMetricCell({
  tone,
  icon: Icon,
  label,
  children,
  footer,
  className = '',
}: {
  tone: SectionTone;
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const s = kpiCellTone[tone];
  return (
    <div
      className={`relative overflow-hidden border-b border-slate-100/80 px-5 py-3 last:border-b-0 md:border-b-0 md:border-r md:py-3.5 dark:border-slate-800/60 md:last:border-r-0 ${s.panel} ${className}`}
    >
      <div
        className={`pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl ${s.blob}`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute -bottom-4 left-1/3 h-14 w-14 rounded-full blur-xl ${s.blobSecondary}`}
        aria-hidden
      />
      <svg
        className="pointer-events-none absolute right-2.5 top-2.5 h-11 w-11 text-slate-200/35 dark:text-slate-700/25"
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden
      >
        <circle cx="48" cy="16" r="12" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 48 Q32 8 56 48" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      </svg>

      <div className="relative z-10 flex gap-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${s.icon}`}
        >
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <span className={labelKpi}>{label}</span>
          <div className="mt-0.5">{children}</div>
          {footer ? <div className="mt-1">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  children,
  icon: Icon,
  tone = 'indigo',
}: {
  children: ReactNode;
  icon: LucideIcon;
  tone?: SectionTone;
}) {
  const s = sectionToneStyles[tone];
  return (
    <div className={`relative flex items-center gap-2.5 border-b pb-2 ${s.border}`}>
      <div
        className={`pointer-events-none absolute bottom-0 left-0 h-px w-24 bg-gradient-to-r ${s.accent}`}
        aria-hidden
      />
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${s.icon}`}
      >
        <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} aria-hidden />
      </div>
      <span className={`text-sm font-bold uppercase tracking-wider ${s.title}`}>{children}</span>
    </div>
  );
}

function Field({ label: labelText, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className={label}>{labelText}</span>
      {children}
    </div>
  );
}

function CopyField({
  text,
  fieldKey,
  copiedField,
  onCopy,
}: {
  text: string;
  fieldKey: string;
  copiedField: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(text, fieldKey)}
      className="rounded p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-slate-800"
      aria-label="Sao chép"
    >
      {copiedField === fieldKey ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
      )}
    </button>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  if (status === 'CANCEL_REQUESTED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/15 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden />
        {label}
      </span>
    );
  }
  const pulse = status === 'SUBMITTED' || status === 'SENT';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
      <span
        className={`h-1.5 w-1.5 rounded-full bg-emerald-500 ${pulse ? 'animate-pulse' : ''}`}
        aria-hidden
      />
      {label}
    </span>
  );
}

export type POApprovalReviewDetail = {
  id: string;
  poNumber: string;
  prCode?: string;
  prId?: string;
  status: string;
  canAct?: boolean;
  buyer?: string;
  totalAmount?: number;
  currency?: string;
  prBudget?: number | null;
  createdAt?: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectReason?: string | null;
  cancelRequestReason?: string | null;
  paymentTerms?: string | null;
  incoterms?: string | null;
  deliveryDate?: string | null;
  deliveryAddress?: string | null;
  projectCode?: string | null;
  note?: string | null;
  supplier?: {
    name?: string;
    address?: string;
    taxCode?: string;
    phone?: string;
    bankName?: string;
    bankAccount?: string;
  } | null;
  items?: Array<{
    id: string;
    lineNo: number;
    description: string;
    qty: number;
    unit?: string | null;
    qtyReceived?: number;
    qtyRemaining?: number;
    lineStatus?: string;
    unitPrice?: number;
    amount?: number;
    vatPercent?: number | null;
    prItemCode?: string | null;
    spec?: string | null;
    remark?: string | null;
  }>;
};

type POApprovalReviewModalProps = {
  detail: POApprovalReviewDetail | undefined;
  loading: boolean;
  canAct?: boolean;
  rejectReason: string;
  onRejectReasonChange: (v: string) => void;
  onClose: () => void;
  onReject: () => void;
  onApprove: () => void;
  rejectPending: boolean;
  approvePending: boolean;
};

export function POApprovalReviewModal({
  detail,
  loading,
  canAct = true,
  rejectReason,
  onRejectReasonChange,
  onClose,
  onReject,
  onApprove,
  rejectPending,
  approvePending,
}: POApprovalReviewModalProps) {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState<TabKey>('general');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldName: string) => {
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
      },
      () => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setCopiedField(fieldName);
          setTimeout(() => setCopiedField(null), 2000);
        } catch {
          /* ignore */
        }
        document.body.removeChild(textArea);
      }
    );
  };

  const statusLabel = detail?.status
    ? poApprovalStatusLabel(detail.status)
    : '—';
  const isCancelFlow = detail?.status === 'CANCEL_REQUESTED';
  const itemCount = detail?.items?.length ?? 0;
  const currency = detail?.currency ?? 'VND';

  const submittedDisplay = useMemo(() => {
    const iso = detail?.submittedAt ?? detail?.createdAt ?? null;
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const time = d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const date = d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `${time} — ${date}`;
  }, [detail?.submittedAt, detail?.createdAt]);

  const budgetPct = useMemo(() => {
    if (detail?.totalAmount == null || detail?.prBudget == null || detail.prBudget <= 0) return null;
    return Math.min(100, (Number(detail.totalAmount) / Number(detail.prBudget)) * 100);
  }, [detail?.totalAmount, detail?.prBudget]);

  const vatSummary = useMemo(() => {
    const items = detail?.items ?? [];
    let subtotalExVat = 0;
    let totalWithVat = 0;
    const vatRates = new Set<number>();
    for (const item of items) {
      subtotalExVat += Math.round((Number(item.qty) || 0) * (Number(item.unitPrice) || 0));
      totalWithVat += Number(item.amount) || 0;
      const pct =
        item.vatPercent != null
          ? Number(item.vatPercent)
          : inferVatPercentFromLine(
              Number(item.qty),
              Number(item.unitPrice),
              Number(item.amount)
            );
      if (pct != null) vatRates.add(pct);
    }
    const vatLabel =
      vatRates.size === 1 ? `Thuế GTGT (${[...vatRates][0]}%)` : 'Thuế GTGT';
    return { subtotalExVat, vatTotal: totalWithVat - subtotalExVat, totalWithVat, vatLabel };
  }, [detail?.items]);

  return (
    <div
      className={`modal-popup-panel relative z-10 ${dark ? 'dark' : ''} flex max-h-[min(90dvh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.06)] transition-all duration-300 dark:border-slate-800/80 dark:bg-slate-900 dark:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header — gradient 1 tông + lưới nhẹ, tách khỏi body trắng */}
      <header className="relative shrink-0 overflow-hidden border-b border-slate-100 dark:border-slate-800/60">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-200/90 via-indigo-100/50 to-white dark:from-indigo-950/80 dark:via-indigo-950/45 dark:to-slate-900"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-indigo-300/25 via-transparent to-violet-200/20 dark:from-indigo-600/20 dark:to-violet-900/15"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.1)_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,rgba(129,140,248,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(129,140,248,0.12)_1px,transparent_1px)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl dark:bg-indigo-500/25"
          aria-hidden
        />

        <div className="relative z-10 flex items-center justify-between px-6 py-4">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Phê duyệt Purchase Order
              </span>
              {detail ? <StatusBadge status={detail.status} label={statusLabel} /> : null}
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {detail?.poNumber ?? 'Chi tiết PO'}
              </h1>
              {detail?.poNumber ? (
                <button
                  type="button"
                  onClick={() => handleCopy(detail.poNumber, 'poId')}
                  className="rounded-lg border border-white/60 bg-white/50 p-1 text-slate-400 shadow-sm transition hover:text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/50 dark:hover:text-slate-200"
                  title="Sao chép mã PO"
                >
                  {copiedField === 'poId' ? (
                    <Check className="h-4 w-4 text-emerald-500" strokeWidth={2} />
                  ) : (
                    <Copy className="h-4 w-4" strokeWidth={2} />
                  )}
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              className="rounded-xl border border-white/60 bg-white/60 p-2 text-slate-400 shadow-sm backdrop-blur-sm transition hover:text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/60 dark:hover:text-slate-300"
              aria-label={dark ? 'Chế độ sáng' : 'Chế độ tối'}
            >
              {dark ? (
                <Sun className="h-[18px] w-[18px] text-amber-500" strokeWidth={2} />
              ) : (
                <Moon className="h-[18px] w-[18px] text-indigo-600" strokeWidth={2} />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/60 bg-white/60 p-2 text-slate-400 shadow-sm backdrop-blur-sm transition hover:text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/60 dark:hover:text-slate-300"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-slate-900">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className={`text-sm ${dataSecondary}`}>Đang tải chi tiết PO…</p>
          </div>
        ) : !detail ? (
          <div className="flex flex-col items-center py-24 text-center">
            <AlertTriangle className="h-9 w-9 text-amber-500" />
            <p className="mt-3 text-sm font-medium">Không tải được chi tiết PO</p>
          </div>
        ) : (
          <>
            {/* KPI banner — icon + gradient + hình trừu tượng */}
            <div className="grid grid-cols-1 border-b border-slate-100 md:grid-cols-3 dark:border-slate-800/60">
              <KpiMetricCell
                tone="indigo"
                icon={CircleDollarSign}
                label="Tổng giá trị PO"
                footer={<p className={hint}>Đã gồm VAT (từ báo giá)</p>}
              >
                <div className="flex items-baseline gap-1.5">
                  <span className={kpiHero}>
                    {detail.totalAmount != null
                      ? Number(detail.totalAmount).toLocaleString('vi-VN')
                      : '—'}
                  </span>
                  {detail.totalAmount != null ? (
                    <span className="text-xs font-bold text-indigo-600/70 dark:text-indigo-400/80">
                      {currency}
                    </span>
                  ) : null}
                </div>
              </KpiMetricCell>

              <KpiMetricCell
                tone="violet"
                icon={PieChart}
                label="Ngân sách PR liên kết"
                footer={
                  budgetPct != null ? (
                    <div className="max-w-[180px]">
                      <div className="h-1 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950/80">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
                          style={{ width: `${budgetPct}%` }}
                        />
                      </div>
                      <p className={`mt-1 ${hint}`}>
                        PO chiếm {budgetPct.toFixed(1)}% ngân sách PR
                      </p>
                    </div>
                  ) : null
                }
              >
                <div className="flex items-baseline gap-1.5">
                  <span className={kpiMid}>
                    {detail.prBudget != null
                      ? Number(detail.prBudget).toLocaleString('vi-VN')
                      : '—'}
                  </span>
                  {detail.prBudget != null ? (
                    <span className="text-[10px] font-bold text-violet-600/70 dark:text-violet-400/80">
                      VND
                    </span>
                  ) : null}
                </div>
              </KpiMetricCell>

              <KpiMetricCell tone="sky" icon={CalendarClock} label="Ngày gửi duyệt">
                <span className={`block text-[13px] ${dataPrimary}`}>{submittedDisplay}</span>
              </KpiMetricCell>
            </div>

            {isCancelFlow ? (
              <div className="border-b border-rose-100 bg-rose-50/80 px-6 py-3 dark:border-rose-900/40 dark:bg-rose-950/40">
                <p className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                  Yêu cầu hủy PO
                </p>
                <p className={`mt-2 whitespace-pre-wrap text-sm ${dataSecondary}`}>
                  {detail.cancelRequestReason || '—'}
                </p>
              </div>
            ) : null}

            {/* Tabs */}
            <div
              className="flex gap-5 border-b border-slate-100 bg-white px-6 dark:border-slate-800/60 dark:bg-slate-900"
              role="tablist"
            >
              {(
                [
                  { key: 'general' as const, label: 'Thông tin chung' },
                  { key: 'items' as const, label: 'Sản phẩm & Dịch vụ', count: itemCount },
                ] as const
              ).map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.key)}
                    className={`relative flex items-center gap-1.5 border-b-2 py-2.5 text-xs font-bold transition-all sm:text-sm ${
                      active ? tabActive : tabIdle
                    }`}
                  >
                    {t.label}
                    {'count' in t && t.count > 0 ? (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                        {t.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="space-y-5 bg-white p-6 dark:bg-slate-900">
              {tab === 'general' ? (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <SectionHeader icon={FileText} tone="indigo">
                      Thông tin chính PO
                    </SectionHeader>
                    <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                      <Field label="Mã PO">
                        <span className={`text-sm ${dataPrimary} font-mono tracking-tight`}>
                          {detail.poNumber}
                        </span>
                      </Field>
                      <Field label="Mã PR liên kết">
                        {detail.prCode ? (
                          <div className="flex items-center gap-1.5">
                            <Link
                              to="/dashboard/buyer-manager/pr-monitoring"
                              className={`flex items-center gap-0.5 ${linkAccent}`}
                            >
                              {detail.prCode}
                              <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
                            </Link>
                            <CopyField
                              text={detail.prCode}
                              fieldKey="prId"
                              copiedField={copiedField}
                              onCopy={handleCopy}
                            />
                          </div>
                        ) : (
                          <span className={dataPrimary}>—</span>
                        )}
                      </Field>
                      <Field label="Người đề xuất (Buyer)">
                        <span className={dataPrimary}>{detail.buyer ?? '—'}</span>
                      </Field>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <SectionHeader icon={Building2} tone="violet">
                      Nhà cung cấp & Thụ hưởng
                    </SectionHeader>
                    <div className="space-y-4 text-sm">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="md:col-span-2">
                          <span className={label}>Đơn vị thụ hưởng</span>
                          <p className={`text-base ${dataHero}`}>{detail.supplier?.name ?? '—'}</p>
                        </div>
                        <Field label="Mã số thuế">
                          <span
                            className={`inline-block rounded border border-slate-100 bg-slate-50 px-2 py-0.5 text-sm ${dataMono} dark:border-slate-800/50 dark:bg-slate-800`}
                          >
                            {detail.supplier?.taxCode ?? '—'}
                          </span>
                        </Field>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <Field label="Địa chỉ">
                          <p className={dataSecondary}>{detail.supplier?.address ?? '—'}</p>
                        </Field>
                        <Field label="Điện thoại liên hệ">
                          <span className={dataPrimary}>{detail.supplier?.phone ?? '—'}</span>
                        </Field>
                        <Field label="Số tài khoản nhận tiền">
                          <div className="flex items-center gap-1.5">
                            <span className={dataBank}>{detail.supplier?.bankAccount ?? '—'}</span>
                            {detail.supplier?.bankAccount ? (
                              <CopyField
                                text={detail.supplier.bankAccount}
                                fieldKey="bankAccount"
                                copiedField={copiedField}
                                onCopy={handleCopy}
                              />
                            ) : null}
                          </div>
                        </Field>
                      </div>
                      <div className="pt-2">
                        <span className={label}>Ngân hàng giao dịch</span>
                        <p className={dataSecondary}>{detail.supplier?.bankName ?? '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <SectionHeader icon={Truck} tone="emerald">
                      Vận chuyển & Thanh toán
                    </SectionHeader>
                    <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                      <Field label="Điều khoản thanh toán">
                        <span className={amberBadge}>
                          {formatPaymentTermsDisplay(detail.paymentTerms)}
                        </span>
                      </Field>
                      <Field label="Incoterms">
                        <span className={dataPrimary}>{detail.incoterms?.trim() || '—'}</span>
                      </Field>
                      <Field label="Hạn bàn giao mong muốn">
                        <span className={dataPrimary}>
                          {detail.deliveryDate
                            ? new Date(detail.deliveryDate).toLocaleDateString('vi-VN')
                            : '—'}
                        </span>
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Địa điểm giao nhận hàng">
                          <p className={dataSecondary}>{detail.deliveryAddress ?? '—'}</p>
                        </Field>
                      </div>
                      <Field label="Mã dự án (Project)">
                        {detail.projectCode?.trim() ? (
                          <span className={dataPrimary}>{detail.projectCode}</span>
                        ) : (
                          <span className="text-sm font-medium italic text-slate-400 dark:text-slate-500">
                            Không liên kết dự án
                          </span>
                        )}
                      </Field>
                      {detail.note ? (
                        <div className="sm:col-span-3">
                          <Field label="Ghi chú">
                            <p className={dataSecondary}>{detail.note}</p>
                          </Field>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {(canAct || detail.rejectReason?.trim()) && (
                    <div className="space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800/40">
                      <SectionHeader icon={MessageSquareWarning} tone="rose">
                        {canAct ? 'Lý do từ chối' : 'Ghi chú / lý do'}
                      </SectionHeader>
                      {canAct ? (
                        <>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Bắt buộc khi bấm Từ chối
                          </p>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => onRejectReasonChange(e.target.value)}
                            placeholder="Nhập lý do từ chối PO…"
                            rows={3}
                            className="w-full resize-none rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white"
                          />
                        </>
                      ) : (
                        <p className={`text-sm ${dataSecondary}`}>
                          {detail.rejectReason?.trim() ||
                            (detail.status === 'REJECTED' ? '—' : 'Không có ghi chú')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <SectionHeader icon={Package} tone="sky">
                    Danh sách sản phẩm & dịch vụ
                  </SectionHeader>
                  <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className={tableHead}>
                          <th className="w-12 px-4 py-3 text-center">STT</th>
                          <th className="px-4 py-3">Mô tả sản phẩm & dịch vụ</th>
                          <th className="w-16 px-4 py-3 text-right">SL</th>
                          <th className="w-32 px-4 py-3 text-right">Đơn giá</th>
                          <th className="w-40 px-4 py-3 text-right">Thành tiền (VND)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
                        {(detail.items ?? []).map((item, idx) => {
                          const lineNo = item.lineNo ?? idx + 1;
                          const unitPrice = Number(item.unitPrice) || 0;
                          const subtitle = poLineSubtitle(item);
                          return (
                            <tr
                              key={item.id}
                              className="transition-all hover:bg-slate-50/30 dark:hover:bg-slate-800/20"
                            >
                              <td className="px-4 py-3 text-center text-sm font-bold text-slate-400 dark:text-slate-500">
                                {String(lineNo).padStart(2, '0')}
                              </td>
                              <td className="px-4 py-3">
                                <span className={productTitle}>
                                  {item.description?.trim() || '—'}
                                </span>
                                {subtitle ? <span className={productSub}>{subtitle}</span> : null}
                              </td>
                              <td className={`px-4 py-3 text-right ${dataPrimary}`}>{item.qty}</td>
                              <td className={`px-4 py-3 text-right tabular-nums ${dataSecondary}`}>
                                {unitPrice.toLocaleString('vi-VN')}
                              </td>
                              <td
                                className={`px-4 py-3 text-right text-sm font-extrabold tabular-nums text-slate-900 dark:text-white`}
                              >
                                {Number(item.amount).toLocaleString('vi-VN')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2">
                    <div className="w-full space-y-2.5 text-xs sm:w-80">
                      <div className="flex justify-between text-slate-400 dark:text-slate-500">
                        <span className="font-medium">Giá trị hàng hóa (chưa thuế):</span>
                        <span className={`tabular-nums ${dataPrimary}`}>
                          {vatSummary.subtotalExVat.toLocaleString('vi-VN')} VND
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span className="font-medium">{vatSummary.vatLabel}:</span>
                        <span className={`tabular-nums ${dataPrimary}`}>
                          {vatSummary.vatTotal.toLocaleString('vi-VN')} VND
                        </span>
                      </div>
                      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          Tổng thanh toán PO:
                        </span>
                        <span className="text-xl font-black tracking-tight tabular-nums text-indigo-600 dark:text-indigo-400">
                          {vatSummary.totalWithVat.toLocaleString('vi-VN')} VND
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {detail ? (
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-500" strokeWidth={2} />
            <span>Mã hóa bảo mật cấp cao</span>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white sm:text-sm"
            >
              Hủy
            </button>
            {canAct ? (
              <>
                <button
                  type="button"
                  onClick={onReject}
                  disabled={!rejectReason.trim() || rejectPending}
                  className="rounded-xl border border-red-100 bg-red-500/5 px-4 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-500 hover:text-white disabled:opacity-40 dark:border-red-900/40 sm:text-sm"
                >
                  {rejectPending ? (
                    <Loader2 className="inline h-4 w-4 animate-spin" />
                  ) : (
                    isCancelFlow ? 'Từ chối hủy' : 'Từ chối'
                  )}
                </button>
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={approvePending}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/10 transition hover:from-indigo-600 hover:to-indigo-700 hover:shadow-indigo-500/20 disabled:opacity-50 sm:text-sm"
                >
                  {approvePending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {isCancelFlow ? 'Duyệt hủy PO' : 'Phê duyệt PO'}
                      <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </>
            ) : null}
          </div>
        </footer>
      ) : null}
    </div>
  );
};
