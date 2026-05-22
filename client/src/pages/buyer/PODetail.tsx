import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Send,
  Loader2,
  FileText,
  FilePenLine,
  AlertCircle,
  MailCheck,
  BadgeCheck,
  Clock,
  CheckCircle,
  Printer,
  Wallet,
  PackageX,
} from 'lucide-react';
import { buyerService } from '../../services/buyerService';
import { useToast } from '../../contexts/ToastContext';
import { useState, useEffect, useRef, useMemo } from 'react';
import { downloadPurchaseOrderPdf } from '../../utils/poPdf';
import { PoDetailUnifiedSheet } from './PoDetailUnifiedSheet';
import type { PoDisplayLang } from '../../utils/poDisplayLang';
import { getStoredPoDisplayLang, setStoredPoDisplayLang } from '../../utils/poDisplayLang';
import { poDetailUi, PO_LINE_STATUS_LABELS, PO_STATUS_LABELS } from '../../utils/poDetailUiStrings';
import {
  isPoLineWarehouseShort,
  poShowsWarehouseShortfallUi,
} from '../../utils/poWarehouseShortfall';
import { inferVatPercentFromLine } from '../../utils/quotationLine';
import { PoLineCancelNote } from '../../components/po/PoLineCancelNote';
import {
  PoCanvasKpiCard,
  PoDocumentSheetHeader,
  daysUntilDelivery,
  poStatusKpiCopy,
} from './poDetailCanvasUi';
import { CreatePOContractModal } from '../../components/CreatePOContractModal';
import { AppModal } from '../../components/AppModal';
import { POSupplierConfirmModal } from '../../components/buyer/POSupplierConfirmModal';
import type { SupplierConfirmBody } from '../../services/buyerService';
import {
  buyerOutletPageShellClass,
  buyerOutletCenterMinHeightClass,
  buyerPageContentClass,
} from '../../constants/buyerLayout';

const fieldInputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

const fieldLabelClass = 'mb-1 block text-xs font-medium text-slate-500';

const sectionTitleClass = 'text-xs font-semibold uppercase tracking-wide text-slate-400';

const canvasClass =
  'rounded-2xl bg-white shadow-[0_4px_6px_-1px_rgba(15,23,42,0.1)] ring-1 ring-slate-200/50';

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'bg-slate-100/90 text-slate-800 ring-slate-200/80',
    SUBMITTED: 'bg-amber-50 text-amber-900 ring-amber-200/70',
    CANCEL_REQUESTED: 'bg-orange-50 text-orange-900 ring-orange-200/70',
    APPROVED: 'bg-emerald-50 text-emerald-900 ring-emerald-200/70',
    REJECTED: 'bg-rose-50 text-rose-900 ring-rose-200/70',
    ISSUED: 'bg-sky-50 text-sky-900 ring-sky-200/70',
    CREATED: 'bg-violet-50 text-violet-900 ring-violet-200/70',
    SENT: 'bg-sky-50 text-sky-900 ring-sky-200/70',
    CONFIRMED: 'bg-emerald-50 text-emerald-900 ring-emerald-200/70',
    PARTIAL_RECEIVED: 'bg-cyan-50 text-cyan-900 ring-cyan-200/70',
    FULLY_RECEIVED: 'bg-slate-100 text-slate-800 ring-slate-200/80',
    CANCELLED: 'bg-rose-50 text-rose-900 ring-rose-200/70',
    CLOSED: 'bg-slate-100 text-slate-700 ring-slate-200/70',
  };
  return map[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200/80';
}

const PO_LINE_ITEMS_ROWS_VISIBLE = 10;
// thead ~3rem + 10 rows x ~3.25rem (py-3 + text-sm)
const poLineItemsTableMaxHeight = `calc(3rem + ${PO_LINE_ITEMS_ROWS_VISIBLE} * 3.25rem)`;

function isPostLeaderApprovalStatus(status: string | undefined): boolean {
  if (!status) return false;
  return (
    status === 'CREATED' ||
    status === 'SENT' ||
    status === 'CONFIRMED' ||
    status === 'PARTIAL_RECEIVED' ||
    status === 'FULLY_RECEIVED' ||
    status === 'CLOSED' ||
    status === 'APPROVED' ||
    status === 'ISSUED'
  );
}

const PODetail = () => {
  const { poId } = useParams<{ poId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const isEditRoute = location.pathname.endsWith('/edit');
  const [editMode, setEditMode] = useState(isEditRoute);
  const [lang, setLang] = useState<PoDisplayLang>(() => getStoredPoDisplayLang());
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [supplierConfirmOpen, setSupplierConfirmOpen] = useState(false);
  const [supplierConfirmMode, setSupplierConfirmMode] = useState<'initial' | 'update'>('initial');
  const [cancelReasonDraft, setCancelReasonDraft] = useState('');
  const [cancelLineSelection, setCancelLineSelection] = useState<Record<string, boolean>>({});
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    setStoredPoDisplayLang(lang);
  }, [lang]);

  const t = poDetailUi(lang);

  const [form, setForm] = useState<{
    paymentTerms?: string;
    deliveryAddress?: string;
    incoterms?: string;
    projectCode?: string;
    deliveryDate?: string;
    note?: string;
    supplierName?: string;
    supplierAddress?: string;
    supplierTaxCode?: string;
    supplierPhone?: string;
    supplierBankName?: string;
    supplierBankAccount?: string;
  }>({});

  const { data: po, isLoading, error } = useQuery({
    queryKey: ['buyer-po-detail', poId],
    queryFn: () => buyerService.getPODetail(poId!),
    enabled: !!poId,
  });

  const shortfallLineIds = useMemo(() => {
    const items = (po?.items ?? []) as Array<{
      id: string;
      qty: number;
      confirmedQty?: number | null;
      qtyReceived?: number;
      lineStatus?: string;
    }>;
    return items.filter((it) => isPoLineWarehouseShort(it)).map((it) => it.id);
  }, [po?.items]);

  const highlightWarehouseShortQty = poShowsWarehouseShortfallUi(po?.status, shortfallLineIds);

  const cancelRequestedIdSet = useMemo(
    () => new Set<string>((po as { cancelRequestedPoItemIds?: string[] } | undefined)?.cancelRequestedPoItemIds ?? []),
    [(po as { cancelRequestedPoItemIds?: string[] } | undefined)?.cancelRequestedPoItemIds]
  );

  const poHasLineCancelHistory = useMemo(
    () =>
      (po?.items ?? []).some(
        (it: { lineStatus?: string; lineCancelReason?: string | null }) =>
          String(it.lineStatus ?? '') === 'CANCELLED' || Boolean(it.lineCancelReason?.trim())
      ),
    [po?.items]
  );

  const poVatSummary = useMemo(() => {
    const items = (po?.items ?? []) as Array<{
      qty: number;
      unitPrice: number;
      amount: number;
      vatPercent?: number | null;
    }>;
    let subtotalExVat = 0;
    let totalWithVat = 0;
    for (const item of items) {
      const qty = Number(item.qty) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const amount = Number(item.amount) || 0;
      subtotalExVat += Math.round(qty * unitPrice);
      totalWithVat += amount;
    }
    return {
      subtotalExVat,
      vatTotal: totalWithVat - subtotalExVat,
      totalWithVat,
      hasVat: totalWithVat > subtotalExVat + 0.5,
    };
  }, [po?.items]);

  useEffect(() => {
    if (!po) return;
    setForm((prev) => ({
      ...prev,
      supplierTaxCode: prev.supplierTaxCode ?? po.supplier?.taxCode ?? '',
      supplierBankName: prev.supplierBankName ?? po.supplier?.bankName ?? '',
      supplierBankAccount: prev.supplierBankAccount ?? po.supplier?.bankAccount ?? '',
      supplierName: prev.supplierName ?? po.supplier?.name ?? '',
      supplierAddress: prev.supplierAddress ?? po.supplier?.address ?? '',
      supplierPhone: prev.supplierPhone ?? po.supplier?.phone ?? '',
    }));
  }, [
    po?.id,
    po?.supplier?.taxCode,
    po?.supplier?.bankName,
    po?.supplier?.bankAccount,
    po?.supplier?.name,
    po?.supplier?.address,
    po?.supplier?.phone,
  ]);

  const openCancelLineModal = (preselectLineId?: string) => {
    setCancelReasonDraft('');
    const init: Record<string, boolean> = {};
    for (const id of shortfallLineIds) {
      init[id] = preselectLineId ? id === preselectLineId : true;
    }
    setCancelLineSelection(init);
    setCancelModalOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: (payload: typeof form) => buyerService.updatePODraft(poId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-po-detail', poId] });
      setEditMode(false);
      if (location.pathname.endsWith('/edit')) navigate(`/dashboard/buyer/po/${poId}`);
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error || err?.response?.data?.message || 'Cập nhật thất bại');
    },
  });

  const submitMutation = useMutation({
    mutationFn: (payload?: { supplierTaxCode?: string }) => buyerService.submitPO(poId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-po-detail', poId] });
      queryClient.invalidateQueries({ queryKey: ['buyer-po-list'] });
      showSuccess(poDetailUi(langRef.current).toastSubmitOk);
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error || err?.response?.data?.message || 'Gửi duyệt thất bại');
    },
  });

  const markSentMutation = useMutation({
    mutationFn: () => buyerService.markPOSent(poId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-po-detail', poId] });
      queryClient.invalidateQueries({ queryKey: ['buyer-po-list'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-incoming-pos'] });
      showSuccess(poDetailUi(langRef.current).toastMarkSentOk);
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error || err?.response?.data?.message || 'Thao tác thất bại');
    },
  });

  const markConfirmedMutation = useMutation({
    mutationFn: (body: SupplierConfirmBody) => buyerService.markPOConfirmed(poId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-po-detail', poId] });
      queryClient.invalidateQueries({ queryKey: ['buyer-po-list'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-incoming-pos'] });
      showSuccess(poDetailUi(langRef.current).toastMarkConfirmedOk);
      setSupplierConfirmOpen(false);
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error || err?.response?.data?.message || 'Thao tác thất bại');
    },
  });

  const updateSupplierConfirmMutation = useMutation({
    mutationFn: (body: SupplierConfirmBody) => buyerService.updateSupplierConfirmation(poId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-po-detail', poId] });
      queryClient.invalidateQueries({ queryKey: ['buyer-po-list'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-incoming-pos'] });
      showSuccess(poDetailUi(langRef.current).toastUpdateSupplierConfirmOk);
      setSupplierConfirmOpen(false);
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error || err?.response?.data?.message || 'Thao tác thất bại');
    },
  });
  const requestCancelMutation = useMutation({
    mutationFn: (payload: { reason: string; poItemIds?: string[] }) =>
      buyerService.requestCancelPO(poId!, payload.reason, payload.poItemIds),
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['buyer-po-detail', poId] });
      queryClient.invalidateQueries({ queryKey: ['buyer-po-list'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-incoming-pos'] });
      queryClient.invalidateQueries({ queryKey: ['requestor-pr-tracking'] });
      showSuccess(data?.message ?? poDetailUi(langRef.current).toastCancelRequestedOk);
      setCancelModalOpen(false);
      setCancelReasonDraft('');
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error || err?.response?.data?.message || 'Gửi yêu cầu hủy thất bại');
    },
  });

  const isPostLeader = isPostLeaderApprovalStatus(po?.status);
  const canMarkSent = po?.status === 'CREATED' || po?.status === 'APPROVED';
  const canMarkConfirmed = po?.status === 'SENT' || po?.status === 'ISSUED';
  const canUpdateSupplierConfirm =
    po?.status === 'CONFIRMED' || po?.status === 'PARTIAL_RECEIVED';
  const supplierConfirmPending =
    markConfirmedMutation.isPending || updateSupplierConfirmMutation.isPending;
  const canRequestCancel =
    po?.status === 'CREATED' ||
    po?.status === 'SENT' ||
    po?.status === 'CONFIRMED' ||
    po?.status === 'PARTIAL_RECEIVED';
  const canCancelLineItems =
    canRequestCancel && po?.status !== 'CANCEL_REQUESTED' && shortfallLineIds.length > 0;
  const lineStatusLabels = PO_LINE_STATUS_LABELS[lang];

  if (!poId) return null;
  if (isLoading) {
    return (
      <div className={`${buyerOutletPageShellClass} ${buyerOutletCenterMinHeightClass} flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-slate-100/50 to-[#f1f5f9]`}>
        <Loader2 className="h-9 w-9 animate-spin text-indigo-500" strokeWidth={2} />
        <p className="text-sm font-medium text-slate-500">{t.loading}</p>
      </div>
    );
  }
  if (error || !po) {
    return (
      <div className={`${buyerOutletPageShellClass} ${buyerPageContentClass}`}>
        <div className="rounded-2xl border border-rose-200/90 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <AlertCircle className="h-5 w-5" strokeWidth={2} />
            </div>
            <div>
              <p className="font-semibold text-rose-900">{t.errorTitle}</p>
              <p className="mt-1 text-sm text-rose-800/80">{t.errorSubtitle}</p>
              <button
                type="button"
                onClick={() => navigate('/dashboard/buyer/po/list')}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                {t.backToList}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const canEdit = po.status === 'DRAFT' || po.status === 'REJECTED';
  const canSubmit = po.status === 'DRAFT';
  const numLocale = lang === 'vi' ? 'vi-VN' : 'en-US';
  const dateLocale = lang === 'vi' ? 'vi-VN' : 'en-GB';
  const deliveryKpi = daysUntilDelivery(po.deliveryDate);
  const statusKpi = poStatusKpiCopy(po.status, lang);
  const orderDateSource = po.createdAt ?? po.submittedAt ?? null;
  const orderDateDisplay = orderDateSource
    ? new Date(orderDateSource).toLocaleDateString(dateLocale)
    : '—';

  const handleSave = () => {
    const payload = {
      paymentTerms: form.paymentTerms ?? po.paymentTerms,
      deliveryAddress: form.deliveryAddress ?? po.deliveryAddress,
      incoterms: form.incoterms ?? po.incoterms,
      projectCode: form.projectCode ?? po.projectCode,
      deliveryDate: form.deliveryDate ?? (po.deliveryDate ? po.deliveryDate.slice(0, 10) : undefined),
      note: form.note ?? po.note,
      supplierName: form.supplierName,
      supplierAddress: form.supplierAddress,
      supplierTaxCode: form.supplierTaxCode,
      supplierPhone: form.supplierPhone,
      supplierBankName: form.supplierBankName,
      supplierBankAccount: form.supplierBankAccount,
    };
    updateMutation.mutate(payload);
  };

  const btnSecondary =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50';
  const btnPrintNavy =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-900';
  const btnPrimary =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';
  const btnSubmit =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-orange-500/25 transition-all hover:from-amber-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div
      className={`${buyerOutletPageShellClass} animate-fade-in-right fade-in-right-delay-0 ${buyerPageContentClass} bg-slate-100/80`}
    >
      <button
        type="button"
        onClick={() => navigate('/dashboard/buyer/po/list')}
        className="group print:hidden inline-flex items-center gap-2 self-start rounded-full border border-slate-200/90 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all hover:border-violet-200 hover:text-violet-700"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={2} />
        {t.backToList}
      </button>

      <header className="rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:px-5 sm:py-5 print:hidden">
        <nav className="text-xs text-slate-500" aria-label="Breadcrumb">
          <span>{lang === 'vi' ? 'Buyer · Đơn đặt hàng' : 'Buyer · Purchase orders'}</span>
          <span className="mx-1.5 text-slate-300" aria-hidden>
            ›
          </span>
          <span className="font-bold text-slate-800">{po.prCode ?? po.poNumber}</span>
        </nav>

        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-indigo-950 sm:text-[1.75rem]">
              {lang === 'vi' ? 'Chi tiết đơn đặt hàng' : 'Purchase order detail'}
            </h1>
            <span
              className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusBadgeClass(po.status)}`}
            >
              {PO_STATUS_LABELS[lang][po.status] ?? po.status}
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.languageLabel}>
              <span className="text-xs font-medium text-slate-500">{t.languageLabel}</span>
              <div className="inline-flex shrink-0 rounded-full border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setLang('vi')}
                  aria-pressed={lang === 'vi'}
                  title="Tiếng Việt"
                  className={`min-w-[2.5rem] rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                    lang === 'vi' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  VI
                </button>
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  aria-pressed={lang === 'en'}
                  title="English"
                  className={`min-w-[2.5rem] rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                    lang === 'en' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canEdit && !editMode && (
                <button type="button" onClick={() => setEditMode(true)} className={btnSecondary}>
                  <FilePenLine className="h-4 w-4 text-slate-500" strokeWidth={2} />
                  {t.edit}
                </button>
              )}
              {canEdit && editMode && (
                <>
                  <button type="button" onClick={handleSave} disabled={updateMutation.isPending} className={btnPrimary}>
                    {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(false);
                      setForm({});
                    }}
                    className={btnSecondary}
                  >
                    {t.cancel}
                  </button>
                </>
              )}
              {canSubmit && !editMode && (
                <button
                  type="button"
                  onClick={() => {
                    const tax = (form.supplierTaxCode ?? po.supplier?.taxCode ?? '').trim();
                    if (!tax) {
                      showError(
                        lang === 'vi'
                          ? 'Vui lòng nhập MST nhà cung cấp (Chỉnh sửa → MST) trước khi gửi duyệt.'
                          : 'Enter supplier tax ID (Edit → Tax code) before submitting for approval.'
                      );
                      return;
                    }
                    submitMutation.mutate({ supplierTaxCode: tax });
                  }}
                  disabled={submitMutation.isPending}
                  className={btnSubmit}
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" strokeWidth={2} />
                  )}
                  {t.submitApproval}
                </button>
              )}
              {isPostLeader && (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await downloadPurchaseOrderPdf({
                          poNumber: po.poNumber,
                          prCode: po.prCode,
                          currency: po.currency,
                          totalAmount: Number(po.totalAmount),
                          paymentTerms: po.paymentTerms,
                          deliveryAddress: po.deliveryAddress,
                          incoterms: po.incoterms,
                          projectCode: po.projectCode,
                          deliveryDate: po.deliveryDate,
                          note: po.note,
                          approvedAt: (po as any).approvedAt,
                          supplier: po.supplier,
                          items: po.items,
                          locale: lang,
                        });
                        showSuccess(poDetailUi(langRef.current).toastPdfOk);
                      } catch (e: any) {
                        showError(e?.message || 'Không tạo được PDF');
                      }
                    }}
                    className={btnPrintNavy}
                  >
                    <Printer className="h-4 w-4" strokeWidth={2} />
                    {lang === 'vi' ? 'In bản đẹp / PDF' : 'Print / PDF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsContractModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200/80 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-900 transition-colors hover:bg-indigo-100"
                  >
                    <FileText className="h-4 w-4" strokeWidth={2} />
                    Tạo hợp đồng
                  </button>
                </>
              )}
              {canMarkSent && !editMode && (
                <button
                  type="button"
                  disabled={markSentMutation.isPending}
                  onClick={() => markSentMutation.mutate()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-900 transition-colors hover:bg-sky-100 disabled:opacity-50"
                >
                  {markSentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" strokeWidth={2} />}
                  {t.markSent}
                </button>
              )}
              {canMarkConfirmed && !editMode && (
                <button
                  type="button"
                  disabled={supplierConfirmPending}
                  onClick={() => {
                    setSupplierConfirmMode('initial');
                    setSupplierConfirmOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                >
                  {supplierConfirmPending && supplierConfirmMode === 'initial' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" strokeWidth={2} />
                  )}
                  {t.markConfirmed}
                </button>
              )}
              {canUpdateSupplierConfirm && !editMode && (
                <button
                  type="button"
                  disabled={supplierConfirmPending}
                  onClick={() => {
                    setSupplierConfirmMode('update');
                    setSupplierConfirmOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-semibold text-teal-900 transition-colors hover:bg-teal-100 disabled:opacity-50"
                >
                  {supplierConfirmPending && supplierConfirmMode === 'update' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" strokeWidth={2} />
                  )}
                  {t.updateSupplierConfirm}
                </button>
              )}
              {canCancelLineItems && !editMode && (
                <button
                  type="button"
                  disabled={requestCancelMutation.isPending}
                  onClick={() => openCancelLineModal()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-900 transition-colors hover:bg-rose-100 disabled:opacity-50"
                >
                  {requestCancelMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PackageX className="h-4 w-4" strokeWidth={2} />
                  )}
                  {t.requestCancelLine}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 print:hidden">
        <PoCanvasKpiCard
          icon={Wallet}
          variant="violet"
          label={lang === 'vi' ? 'Tổng giá trị PO' : 'Total PO value'}
          value={
            <>
              <span className="text-violet-800">
                {Number(po.totalAmount ?? 0).toLocaleString(numLocale)}
              </span>
              <span className="text-sm font-bold text-slate-600">
                {' '}
                {po.currency === 'VND' || !po.currency ? 'đ' : po.currency}
              </span>
            </>
          }
        />
        <PoCanvasKpiCard
          icon={Clock}
          variant="orange"
          label={lang === 'vi' ? 'Hạn giao hàng dự kiến' : 'Expected delivery'}
          value={
            deliveryKpi.dateStr ? (
              <>
                <span className="text-slate-900">{deliveryKpi.dateStr}</span>
                {deliveryKpi.daysLeft != null ? (
                  <span className="ml-1 text-sm font-bold text-orange-600">
                    ({lang === 'vi' ? `Còn ${deliveryKpi.daysLeft} ngày` : `${deliveryKpi.daysLeft} days left`})
                  </span>
                ) : null}
              </>
            ) : (
              '—'
            )
          }
        />
        <PoCanvasKpiCard
          icon={CheckCircle}
          variant="emerald"
          label={lang === 'vi' ? 'Trạng thái phê duyệt' : 'Approval status'}
          value={statusKpi.text}
          valueClass={statusKpi.valueClass}
        />
      </div>

      <article className={`${canvasClass} overflow-hidden print:shadow-none`}>
        <PoDocumentSheetHeader
          lang={lang}
          poNumber={po.poNumber}
          prValue={po.prCode ?? '—'}
          buyer={po.buyer ?? ''}
          orderDate={orderDateDisplay}
        />

        {po.cancelRequestReason && (
          <div className="border-b border-rose-100 px-6 py-4 text-sm text-rose-900 sm:px-8">
            <p className="font-semibold">{t.cancelReasonLabel}</p>
            <p className="mt-1 whitespace-pre-wrap">{po.cancelRequestReason}</p>
          </div>
        )}

        <PoDetailUnifiedSheet
          lang={lang}
          t={t}
          po={po}
          form={form}
          setForm={setForm}
          canEdit={canEdit}
          editMode={editMode}
          dateLocale={dateLocale}
          numLocale={numLocale}
          totalLabel={t.metaTotal}
        />

        {po.rejectReason && (
          <div className="flex gap-2 border-t border-rose-100 px-6 py-5 text-sm text-rose-800 sm:px-8">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" strokeWidth={2} />
            <div>
              <span className="font-semibold text-rose-900">{t.rejectPrefix} </span>
              {po.rejectReason}
            </div>
          </div>
        )}

        {po.status === 'CANCEL_REQUESTED' ? (
          <div className="mx-6 mt-6 rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 sm:mx-8">
            <p className="text-sm font-semibold text-amber-950">{t.cancelPendingBannerTitle}</p>
            <p className="mt-1 text-sm text-amber-900/90">{t.cancelPendingBannerBody}</p>
            {(po as { cancelRequestReason?: string | null }).cancelRequestReason ? (
              <p className="mt-2 text-sm text-amber-950">
                <span className="font-medium">{t.cancelReasonLabel}:</span>{' '}
                {(po as { cancelRequestReason?: string | null }).cancelRequestReason}
              </p>
            ) : null}
          </div>
        ) : null}

        {canCancelLineItems && (po.status === 'PARTIAL_RECEIVED' || shortfallLineIds.length > 0) ? (
          <div className="mx-6 mt-4 rounded-xl border border-cyan-200/90 bg-cyan-50/80 px-4 py-3 sm:mx-8">
            <p className="text-sm font-semibold text-cyan-950">{t.partialReceiveBannerTitle}</p>
            <p className="mt-1 text-sm leading-relaxed text-cyan-900/90">{t.partialReceiveBannerBody}</p>
            {po.prCode ? (
              <p className="mt-2 text-xs font-medium text-cyan-800/90">
                {t.metaPr}: <span className="font-mono">{po.prCode}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Line items */}
        <section className="border-t border-slate-100 px-6 py-6 sm:px-8">
          <h2 className={sectionTitleClass}>{t.lineItemsSection}</h2>
          <div className="mt-4 overflow-x-auto">
              <div
                className={
                  (po.items?.length ?? 0) > PO_LINE_ITEMS_ROWS_VISIBLE
                    ? 'min-h-0 overflow-y-auto [scrollbar-width:thin]'
                    : undefined
                }
                style={
                  (po.items?.length ?? 0) > PO_LINE_ITEMS_ROWS_VISIBLE
                    ? { maxHeight: poLineItemsTableMaxHeight }
                    : undefined
                }
              >
                <div className="min-w-[960px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-slate-200 bg-slate-50/95">
                    {[
                      [t.thLine, 'left'],
                      [t.thPrItem, 'left'],
                      [t.thDesc, 'left'],
                      [t.thQty, 'right'],
                      [t.thConfirmedQty, 'right'],
                      [t.thEta, 'left'],
                      [t.thReceived, 'right'],
                      [t.thRemaining, 'right'],
                      [t.thUnit, 'left'],
                      [t.thUnitPrice, 'right'],
                      [t.thVat, 'center'],
                      [t.thAmount, 'right'],
                      ...(isPostLeader ? ([[t.colLineStatus, 'left']] as const) : []),
                      ...(canCancelLineItems ? ([[t.thActions, 'center']] as const) : []),
                    ].map(([h, align]) => (
                      <th
                        key={h as string}
                        className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 ${
                          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                  {(po.items ?? []).map((item: any, rowIndex: number) => {
                    const vatPct =
                      item.vatPercent != null
                        ? Number(item.vatPercent)
                        : inferVatPercentFromLine(
                            Number(item.qty),
                            Number(item.unitPrice),
                            Number(item.amount)
                          );
                    const lineShort =
                      highlightWarehouseShortQty && shortfallLineIds.includes(item.id);
                    const lineEligible = lineShort;
                    const linePendingCancel = cancelRequestedIdSet.has(item.id);
                    const lineStatusKey = String(item.lineStatus ?? 'OPEN');
                    const qtyRemaining = Number(item.qtyRemaining ?? 0);
                    return (
                    <tr key={item.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-4 py-3 text-slate-600">{rowIndex + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{item.prItemCode ?? '—'}</td>
                      <td className="max-w-xs px-4 py-3 text-slate-700">
                        <div>{item.description}</div>
                        {lineStatusKey === 'CANCELLED' ||
                        item.lineCancelReason ||
                        linePendingCancel ? (
                          <PoLineCancelNote
                            orderedQty={Number(item.qty)}
                            receivedQty={Number(item.qtyReceived ?? 0)}
                            cancelledQty={
                              item.cancelledRemainingQty != null
                                ? Number(item.cancelledRemainingQty)
                                : Math.max(
                                    0,
                                    Number(item.qty) - Number(item.qtyReceived ?? 0)
                                  )
                            }
                            reason={
                              item.lineCancelReason ??
                              (linePendingCancel
                                ? (po as { cancelRequestReason?: string }).cancelRequestReason
                                : null)
                            }
                            pending={linePendingCancel}
                            unit={item.unit}
                          />
                        ) : poHasLineCancelHistory &&
                          Number(item.qtyReceived ?? 0) + 1e-9 >= Number(item.qty) ? (
                          <PoLineCancelNote
                            orderedQty={Number(item.qty)}
                            receivedQty={Number(item.qtyReceived ?? 0)}
                            unit={item.unit}
                          />
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-800">{item.qty}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-800">
                        {item.confirmedQty != null ? item.confirmedQty : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.expectedDeliveryDate
                          ? new Date(item.expectedDeliveryDate.slice(0, 10)).toLocaleDateString(dateLocale)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{item.qtyReceived ?? 0}</td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums ${
                          lineShort && qtyRemaining > 0
                            ? 'font-semibold text-rose-700'
                            : 'text-slate-800'
                        }`}
                      >
                        {qtyRemaining}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.unit}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {item.unitPrice != null ? Number(item.unitPrice).toLocaleString(numLocale) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-slate-600">
                        {vatPct != null ? `${vatPct}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                        {item.amount != null ? Number(item.amount).toLocaleString(numLocale) : '—'}
                      </td>
                      {isPostLeader ? (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                              {lineStatusLabels[lineStatusKey] ?? lineStatusKey}
                            </span>
                            {linePendingCancel ? (
                              <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                                {t.lineCancelPendingBadge}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                      {canCancelLineItems ? (
                        <td className="px-4 py-3 text-center">
                          {lineEligible ? (
                            <button
                              type="button"
                              disabled={requestCancelMutation.isPending}
                              onClick={() => openCancelLineModal(item.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
                            >
                              <PackageX className="h-3.5 w-3.5" strokeWidth={2} />
                              {t.cancelLineRowAction}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                    );
                  })}
                    </tbody>
                  </table>
                </div>
              </div>
          {(po.items?.length ?? 0) > PO_LINE_ITEMS_ROWS_VISIBLE ? (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Hiển thị tối đa {PO_LINE_ITEMS_ROWS_VISIBLE} dòng trong một khung — còn {(po.items?.length ?? 0) - PO_LINE_ITEMS_ROWS_VISIBLE} dòng · cuộn
              trong bảng để xem tiếp.
            </p>
          ) : null}
          </div>
        </section>

        <section className="border-t border-slate-100 px-6 py-6 sm:px-8">
          <h2 className={sectionTitleClass}>{t.totalsSection}</h2>
          <div className="mt-3 max-w-md space-y-2 text-sm text-slate-700">
            {poVatSummary.hasVat ? (
              <>
                <div className="flex justify-between gap-4">
                  <span>{t.subtotalExVat}</span>
                  <span className="tabular-nums font-medium text-slate-900">
                    {poVatSummary.subtotalExVat.toLocaleString(numLocale)} {po.currency ?? 'VND'}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{t.vatTotal}</span>
                  <span className="tabular-nums font-medium text-slate-900">
                    {poVatSummary.vatTotal.toLocaleString(numLocale)} {po.currency ?? 'VND'}
                  </span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 font-semibold text-slate-900">
              <span>{t.grandTotal}</span>
              <span className="tabular-nums">
                {Number(po.totalAmount ?? 0).toLocaleString(numLocale)} {po.currency ?? 'VND'}
              </span>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-slate-500">{t.amountsIncludeVatNote}</p>
          <p className="mt-4 text-xs text-slate-400">
            {t.approvalLine}{' '}
            <span className="font-medium text-slate-700">
              {(po as any).approvedByUsername ?? (isPostLeaderApprovalStatus(po.status) ? t.approvedFallback : '—')}
            </span>
          </p>
        </section>

        {po.attachments?.length > 0 && (
          <section className="border-t border-slate-100 px-6 py-6 sm:px-8">
            <h2 className={sectionTitleClass}>{t.attachments}</h2>
            <ul className="mt-3 space-y-1.5">
              {po.attachments.map((a: any) => (
                <li key={a.id}>
                  <a
                    href={a.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-indigo-600 underline decoration-indigo-600/30 underline-offset-2 transition-colors hover:text-indigo-700 hover:decoration-indigo-600"
                  >
                    {a.fileName}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      <CreatePOContractModal
        open={isContractModalOpen}
        onClose={() => setIsContractModalOpen(false)}
        po={po as any}
      />
      <AppModal
        open={cancelModalOpen}
        onClose={() => {
          if (!requestCancelMutation.isPending) setCancelModalOpen(false);
        }}
        title={t.cancelModalTitle}
        size="lg"
        zIndexClass="z-[220]"
        footer={
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              disabled={requestCancelMutation.isPending}
              onClick={() => setCancelModalOpen(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {t.cancelModalClose}
            </button>
            <button
              type="button"
              disabled={requestCancelMutation.isPending}
              onClick={() => {
                const reason = cancelReasonDraft.trim();
                if (!reason) {
                  showError(lang === 'vi' ? 'Nhập lý do hủy.' : 'Enter a cancellation reason.');
                  return;
                }
                const picked = shortfallLineIds.filter((id) => cancelLineSelection[id]);
                if (shortfallLineIds.length > 0 && picked.length === 0) {
                  showError(
                    lang === 'vi'
                      ? 'Chọn ít nhất một dòng còn thiếu so với đã nhận kho.'
                      : 'Select at least one line that still has a remaining balance.'
                  );
                  return;
                }
                requestCancelMutation.mutate({
                  reason,
                  poItemIds: picked,
                });
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {requestCancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {t.cancelModalSubmit}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">{t.cancelModalSelectHint}</p>
        <p className="mt-2 text-sm text-slate-600">{t.cancelWarning}</p>
        {shortfallLineIds.length > 0 ? (
          <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 p-3">
            {shortfallLineIds.map((id) => {
              const row = (po.items ?? []).find((x: { id: string }) => x.id === id) as
                | { lineNo: number; description: string; qty: number; qtyReceived?: number; qtyRemaining?: number }
                | undefined;
              if (!row) return null;
              const rem =
                row.qtyRemaining ?? Math.max(0, Number(row.qty) - (Number(row.qtyReceived) ?? 0));
              return (
                <li key={id} className="flex items-start gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={!!cancelLineSelection[id]}
                    onChange={(e) =>
                      setCancelLineSelection((m) => ({ ...m, [id]: e.target.checked }))
                    }
                  />
                  <span>
                    <span className="font-medium">{row.lineNo}.</span> {row.description}{' '}
                    <span className="text-slate-500">
                      ({lang === 'vi' ? 'còn' : 'rem.'} {rem})
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        <label className="mt-4 block text-xs font-medium text-slate-500">{t.cancelModalReason}</label>
        <textarea
          value={cancelReasonDraft}
          onChange={(e) => setCancelReasonDraft(e.target.value)}
          rows={4}
          className={`${fieldInputClass} mt-1 resize-y`}
          placeholder={t.cancelReasonPlaceholder}
        />
      </AppModal>
      <POSupplierConfirmModal
        open={supplierConfirmOpen}
        onClose={() => {
          if (!supplierConfirmPending) setSupplierConfirmOpen(false);
        }}
        mode={supplierConfirmMode}
        items={(po.items ?? []).map((it: any) => ({
          id: it.id,
          lineNo: it.lineNo,
          description: it.description,
          qty: Number(it.qty),
          confirmedQty: it.confirmedQty,
          expectedDeliveryDate: it.expectedDeliveryDate,
        }))}
        defaultDeliveryDate={po.deliveryDate}
        lang={lang}
        t={t}
        isPending={supplierConfirmPending}
        onSubmit={(body) => {
          if (supplierConfirmMode === 'update') {
            updateSupplierConfirmMutation.mutate(body);
          } else {
            markConfirmedMutation.mutate(body);
          }
        }}
      />
    </div>
  );
};

export default PODetail;
