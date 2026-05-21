import { useState, useEffect, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  X,
  CheckCircle2,
  DollarSign,
  FileQuestion,
  Edit3,
  Building2,
  Clock3,
  ShieldCheck,
  Hash,
  Sparkles,
  ClipboardCheck,
  FileEdit,
  Send,
  Inbox,
  Scale,
  Archive,
  Eye,
  TimerOff,
  CircleDot,
} from 'lucide-react';
import { buyerService } from '../../services/buyerService';
import { useToast } from '../../contexts/ToastContext';
import { BuyerPageHero } from '../../components/BuyerPageHero';
import {
  buyerInteractiveTableClass,
  buyerInteractiveTableBodyClass,
  buyerOutletPageShellClass,
  buyerTableAccentRailClass,
  buyerTableCellWrapClass,
  buyerTableCellWrapFlexClass,
  buyerTableDataRowVisual,
  buyerTableFirstCellInnerClass,
  buyerTableRowInteractive,
  buyerWorkspacePageStackClass,
  buyerPanelCardClass,
  buyerDataTableCardClass,
  buyerDataTableCardHeaderClass,
  buyerWorkspaceTableViewportClass,
} from '../../constants/buyerLayout';
import {
  PAYMENT_TERMS_PERCENT_OPTIONS,
  WARRANTY_MONTHS_OPTIONS,
  LEAD_TIME_DAYS_OPTIONS,
  VAT_PERCENT_OPTIONS,
  DEFAULT_VAT_PERCENT,
} from '../../constants/quotationEvaluation';
import {
  validateQuotationCommercialFields,
  isQuotationCommercialComplete,
} from '../../utils/quotationCommercialValidation';
import CustomSelect from '../../components/CustomSelect';
import { VndIntegerInput } from '../../components/VndIntegerInput';
import { quotationLineAmounts, normalizeVatPercentString, roundQuotationQty } from '../../utils/quotationLine';

/** Badge trạng thái RFQ — icon + màu (parity RFQManagement) */
const RFQ_STATUS_ROW_UI: Record<string, { label: string; Icon: LucideIcon; className: string }> = {
  DRAFT: {
    label: 'Nháp',
    Icon: FileEdit,
    className:
      'bg-slate-100 text-slate-800 ring-slate-200/90 border-slate-200/80',
  },
  SENT: {
    label: 'Đã gửi',
    Icon: Send,
    className: 'bg-sky-50 text-sky-900 ring-sky-200/80 border-sky-200/70',
  },
  QUOTATION_RECEIVED: {
    label: 'Có báo giá',
    Icon: Inbox,
    className:
      'bg-violet-50 text-violet-900 ring-violet-200/75 border-violet-200/65',
  },
  READY_FOR_COMPARISON: {
    label: 'Chờ duyệt',
    Icon: Scale,
    className:
      'bg-emerald-50 text-emerald-900 ring-emerald-200/75 border-emerald-200/65',
  },
  CLOSED: {
    label: 'Đã đóng',
    Icon: Archive,
    className: 'bg-zinc-100 text-zinc-800 ring-zinc-200/80 border-zinc-200/70',
  },
  EXPIRED: {
    label: 'Hết hạn',
    Icon: TimerOff,
    className: 'bg-rose-50 text-rose-900 ring-rose-200/75 border-rose-200/65',
  },
};
const rfqStatusRowFallback: { Icon: LucideIcon; className: string } = {
  Icon: CircleDot,
  className: 'bg-slate-50 text-slate-700 ring-slate-200/80 border-slate-200/70',
};

const PR_STATUS_AFTER_AWARD = new Set([
  'SUPPLIER_SELECTED',
  'RFQ_COMPLETED',
  'PO_PENDING',
  'PO_IN_PROGRESS',
  'PO_ISSUED',
  'CLOSED',
  'BUDGET_EXCEPTION',
  'BUDGET_APPROVED',
]);

const AWARDED_STATUS_ROW_UI = {
  label: 'Đã chọn NCC',
  Icon: CheckCircle2,
  className: 'bg-emerald-100 text-emerald-900 ring-emerald-200/85 border-emerald-200/75',
} as const;

const QuotationManagement = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const [prFilter, setPrFilter] = useState<string>('all');
  const [validityFilter, setValidityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedRFQId, setSelectedRFQId] = useState<string>('');
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  
  // Form fields for creating new quotation
  const [supplierId, setSupplierId] = useState<string>('');
  const [quotationNumber, setQuotationNumber] = useState<string>('');
  const [itemPrices, setItemPrices] = useState<Record<string, number | undefined>>({}); // prItemId -> đơn giá NCC (VND)
  const [itemVatPercents, setItemVatPercents] = useState<Record<string, string>>({}); // prItemId -> VAT %
  const [bulkVatPercent, setBulkVatPercent] = useState<string>(DEFAULT_VAT_PERCENT);
  const [leadTime, setLeadTime] = useState<string>('');
  const [paymentTerms, setPaymentTerms] = useState<string>('');
  const [warranty, setWarranty] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(true); // true = create new, false = upload to existing
  
  // Create new supplier modal
  const [showCreateSupplierModal, setShowCreateSupplierModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  const [newSupplierCode, setNewSupplierCode] = useState<string>('');
  const [newSupplierEmail, setNewSupplierEmail] = useState<string>('');
  const [newSupplierPhone, setNewSupplierPhone] = useState<string>('');
  
  // Expanded RFQs (tree view)
  const [expandedRFQs, setExpandedRFQs] = useState<Set<string>>(new Set());
  const [selectedQuotationForDetail, setSelectedQuotationForDetail] = useState<any>(null);
  const [showQuotationDetailModal, setShowQuotationDetailModal] = useState(false);
  
  // Submit RFQ confirmation modal
  const [showSubmitRFQModal, setShowSubmitRFQModal] = useState(false);
  const [rfqToSubmit, setRfqToSubmit] = useState<{ id: string; rfqNumber: string } | null>(null);

  // Fetch RFQs for dropdown
  const { data: rfqsData, isLoading: isLoadingRFQs, error: rfqsError } = useQuery({
    queryKey: ['buyer-rfqs', 'all'],
    queryFn: () => buyerService.getRFQs({ status: undefined }),
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const rfqsRows = rfqsData?.rfqs || [];

  // Fetch RFQ details (including quotations) when RFQ is selected
  const { data: rfqDetails, isLoading: isLoadingRFQDetails } = useQuery({
    queryKey: ['buyer-rfq-details', selectedRFQId],
    queryFn: () => buyerService.getRFQById(selectedRFQId),
    enabled: !!selectedRFQId && showUploadModal,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Get Suppliers (dùng buyerService để đồng bộ auth và baseURL)
  const {
    data: suppliersData,
    isLoading: isLoadingSuppliers,
    error: suppliersError,
    refetch: refetchSuppliers,
  } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => buyerService.getSuppliers(),
    enabled: showUploadModal,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (showUploadModal) void refetchSuppliers();
  }, [showUploadModal, refetchSuppliers]);

  const suppliers = Array.isArray(suppliersData?.suppliers) ? suppliersData.suppliers : [];

  // Reset form when modal closes or RFQ changes
  useEffect(() => {
    if (!showUploadModal) {
      setSupplierId('');
      setQuotationNumber('');
      setItemPrices({});
      setItemVatPercents({});
      setBulkVatPercent(DEFAULT_VAT_PERCENT);
      setLeadTime('');
      setPaymentTerms('');
      setWarranty('');
      setUploadFiles([]);
      setIsCreatingNew(true);
      setSelectedQuotationId('');
    }
  }, [showUploadModal]);

  // Reset item prices / VAT when RFQ changes
  useEffect(() => {
    if (!selectedRFQId || !rfqDetails?.purchaseRequest?.items) {
      setItemPrices({});
      setItemVatPercents({});
      return;
    }
    setItemPrices((prev) => {
      const next = { ...prev };
      rfqDetails.purchaseRequest.items.forEach((item: any) => {
        if (item.id && !(item.id in next)) next[item.id] = undefined;
      });
      return next;
    });
    setItemVatPercents((prev) => {
      const next = { ...prev };
      rfqDetails.purchaseRequest.items.forEach((item: any) => {
        if (item.id && !(item.id in next)) {
          next[item.id] = bulkVatPercent || DEFAULT_VAT_PERCENT;
        }
      });
      return next;
    });
  }, [selectedRFQId, rfqDetails?.purchaseRequest?.items, bulkVatPercent]);

  const getItemVatPercent = (itemId: string) =>
    normalizeVatPercentString(itemVatPercents[itemId] ?? bulkVatPercent);

  const applyBulkVatToAllItems = () => {
    if (!rfqDetails?.purchaseRequest?.items) return;
    setItemVatPercents((prev) => {
      const next = { ...prev };
      rfqDetails.purchaseRequest.items.forEach((item: any) => {
        if (item.id) next[item.id] = bulkVatPercent;
      });
      return next;
    });
  };

  const quotationTotalsPreview = useMemo(() => {
    if (!rfqDetails?.purchaseRequest?.items?.length) {
      return { grandTotal: 0, subtotal: 0, vatTotal: 0 };
    }
    let subtotal = 0;
    let vatTotal = 0;
    let grandTotal = 0;
    for (const item of rfqDetails.purchaseRequest.items) {
      const unitPrice = itemPrices[item.id] ?? 0;
      const vat = Number(normalizeVatPercentString(itemVatPercents[item.id] ?? bulkVatPercent));
      const qty = roundQuotationQty(Number(item.qty || 1));
      const line = quotationLineAmounts(qty, unitPrice, vat);
      subtotal += line.subtotal;
      vatTotal += line.vatAmount;
      grandTotal += line.total;
    }
    return { grandTotal, subtotal, vatTotal };
  }, [rfqDetails?.purchaseRequest?.items, itemPrices, itemVatPercents, bulkVatPercent]);

  /** Modal Gửi duyệt RFQ: overlay toàn màn + hộp thoại căn giữa (portal → body). */
  useEffect(() => {
    if (!showSubmitRFQModal) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const mains = document.querySelectorAll('main');
    const mainPrev: { el: HTMLElement; overflow: string; overscroll: string }[] = [];
    mains.forEach((node) => {
      const el = node as HTMLElement;
      mainPrev.push({
        el,
        overflow: el.style.overflow,
        overscroll: el.style.overscrollBehavior,
      });
      el.style.overflow = 'hidden';
      el.style.overscrollBehavior = 'none';
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSubmitRFQModal(false);
        setRfqToSubmit(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      mainPrev.forEach(({ el, overflow, overscroll }) => {
        el.style.overflow = overflow;
        el.style.overscrollBehavior = overscroll;
      });
      document.removeEventListener('keydown', onKey);
    };
  }, [showSubmitRFQModal]);

  useEffect(() => {
    if (selectedRFQId && rfqDetails) {
      // Auto-switch to upload mode if quotations exist
      if (rfqDetails.quotations && rfqDetails.quotations.length > 0) {
        setIsCreatingNew(false);
      } else {
        setIsCreatingNew(true);
      }
    }
  }, [selectedRFQId, rfqDetails]);

  const { data: quotationsData, isLoading, error: quotationsError } = useQuery({
    queryKey: ['buyer-quotations', prFilter, validityFilter],
    queryFn: async () => {
      return buyerService.getQuotations({ 
        status: validityFilter === 'all' ? undefined : validityFilter === 'valid' ? 'VALID' : 'INVALID'
      });
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
    enabled: true, // Enable to fetch quotations
  });

  const mergedQuotations =
    quotationsData?.quotations && quotationsData.quotations.length > 0
      ? quotationsData.quotations
      : [];

  const prStatusByRfqId = useMemo(() => {
    const map = new Map<string, string>();
    (rfqsRows ?? []).forEach((r: any) => {
      if (r?.id && r?.prStatus) map.set(String(r.id), String(r.prStatus));
    });
    return map;
  }, [rfqsRows]);

  // Calculate filteredQuotations BEFORE early return to ensure hooks are always called in same order
  const filteredQuotations = useMemo(() => {
    let filtered = mergedQuotations || [];

    // Filter by validity (status) - bao gồm cả PENDING khi filter 'all'
    if (validityFilter !== 'all') {
      filtered = filtered.filter((q: any) =>
        validityFilter === 'valid' ? q.status === 'VALID' : q.status === 'INVALID'
      );
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter((q: any) =>
        q.quotationNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.prNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.rfqNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [mergedQuotations, validityFilter, searchQuery]);

  // Group quotations by RFQ (RFQ là container)
  const quotationsByRFQ = useMemo(() => {
    const grouped: Record<string, {
      rfqId: string;
      rfqNumber: string;
      prNumber: string;
      rfqStatus: string; // Add RFQ status
      prStatus?: string;
      quotations: any[];
    }> = {};
    
    filteredQuotations.forEach((q: any) => {
      const key = q.rfqId || 'unknown';
      if (!grouped[key]) {
        grouped[key] = {
          rfqId: q.rfqId,
          rfqNumber: q.rfqNumber || 'N/A',
          prNumber: q.prNumber || 'N/A',
          rfqStatus: q.rfqStatus || 'DRAFT', // Get RFQ status from quotation
          prStatus: prStatusByRfqId.get(String(q.rfqId)) || q.prStatus,
          quotations: [],
        };
      }
      grouped[key].quotations.push(q);
    });
    
    return Object.values(grouped).sort((a, b) => 
      (b.rfqNumber || '').localeCompare(a.rfqNumber || '')
    );
  }, [filteredQuotations, prStatusByRfqId]);

  const quotationPageKpis = useMemo(() => {
    const rfqs = rfqsRows ?? [];
    const withQuotations = rfqs.filter((r: any) => (r.quotationsCount ?? 0) > 0).length;
    const canSubmitRfq = rfqs.filter(
      (r: any) =>
        (r.quotationsCount ?? 0) >= 1 &&
        r.status !== 'READY_FOR_COMPARISON' &&
        r.status !== 'CLOSED'
    ).length;
    return {
      rfqTotal: rfqs.length,
      withQuotations,
      quotationRows: filteredQuotations.length,
      canSubmitRfq,
    };
  }, [rfqsRows, filteredQuotations.length]);

  const toggleValidityMutation = useMutation({
    mutationFn: async ({ id, isValid }: { id: string; isValid: boolean }) => {
      // TODO: Replace with actual API call
      // return buyerService.toggleQuotationValidity(id, isValid);
      throw new Error('API not implemented yet');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-quotations'] });
    },
  });

  // Gửi duyệt RFQ - Buyer xác nhận đã nhập đủ báo giá, chuyển sang chờ Buyer Leader so sánh & chọn NCC
  const completeRFQMutation = useMutation({
    mutationFn: (rfqId: string) => buyerService.completeRFQ(rfqId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-rfqs'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-rfq-details'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-quotations'] });
      setShowSubmitRFQModal(false);
      setRfqToSubmit(null);
      showSuccess('RFQ đã được đánh dấu hoàn thành. Buyer Leader có thể so sánh báo giá.');
    },
    onError: (error: any) => {
      showError(error.response?.data?.error || 'Lỗi khi hoàn thành RFQ');
    },
  });

  // Create quotation mutation - buyer nhập giá từng item, không nhập tổng
  const createQuotationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRFQId) {
        throw new Error('Vui lòng chọn RFQ');
      }
      if (!supplierId) {
        throw new Error('Vui lòng chọn nhà cung cấp');
      }
      if (!rfqDetails || !rfqDetails.purchaseRequest?.items || rfqDetails.purchaseRequest.items.length === 0) {
        throw new Error('RFQ không có items');
      }

      const items = rfqDetails.purchaseRequest.items.map((item: any, index: number) => {
        const safeUnitPrice = Math.round(itemPrices[item.id] ?? 0);
        const qty = roundQuotationQty(Number(item.qty || 1));
        const vatPercent = Number(getItemVatPercent(item.id));
        return {
          purchaseRequestItemId: item.id,
          lineNo: item.lineNo || index + 1,
          description: item.description,
          qty,
          unit: item.unit,
          unitPrice: safeUnitPrice,
          vatPercent,
          notes: '',
        };
      });

      const missing = items.filter((i: { unitPrice: number }) => !i.unitPrice || i.unitPrice <= 0);
      if (missing.length > 0) {
        throw new Error('Vui lòng nhập đơn giá NCC cho tất cả các item (không nhập tổng)');
      }

      const commercialErr = validateQuotationCommercialFields(leadTime, paymentTerms, warranty);
      if (commercialErr) throw new Error(commercialErr);

      const totalAmount = items.reduce((sum: number, i: { qty: number; unitPrice: number; vatPercent: number }) => {
        const line = quotationLineAmounts(i.qty, i.unitPrice, i.vatPercent);
        return sum + line.total;
      }, 0);

      const quotationData = {
        rfqId: selectedRFQId,
        supplierId,
        quotationNumber: quotationNumber || undefined,
        totalAmount,
        currency: rfqDetails.purchaseRequest?.currency || 'VND',
        leadTime: parseInt(leadTime, 10),
        paymentTerms: `${paymentTerms}%`,
        warranty: `${warranty} tháng`,
        items,
      };

      return await buyerService.createQuotation(quotationData);
    },
    onSuccess: async (data) => {
      // After creating quotation, upload files if any
      if (uploadFiles.length > 0 && data?.id) {
        try {
          await buyerService.uploadQuotationAttachments(data.id, uploadFiles);
        } catch (uploadError: any) {
          console.error('File upload error:', uploadError);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['buyer-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-rfqs'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-rfq-details', selectedRFQId] });
      setShowUploadModal(false);
      showSuccess('Tạo báo giá thành công!');
    },
    onError: (error: any) => {
      console.error('Create quotation error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Tạo báo giá thất bại. Vui lòng thử lại.';
      showError(errorMessage);
    },
  });

  // Upload files to existing quotation mutation
  const uploadQuotationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRFQId) {
        throw new Error('Vui lòng chọn RFQ');
      }
      if (uploadFiles.length === 0) {
        throw new Error('Vui lòng chọn file để upload');
      }
      try {
        return await buyerService.uploadQuotationAttachmentsByRFQ(
          selectedRFQId, 
          uploadFiles, 
          selectedQuotationId || undefined
        );
      } catch (error: any) {
        console.error('Upload error:', error);
        const errorMessage = error.response?.data?.error || error.message || 'Upload báo giá thất bại. Vui lòng thử lại.';
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-rfqs'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-rfq-details', selectedRFQId] });
      setShowUploadModal(false);
      showSuccess('Upload báo giá thành công!');
    },
    onError: (error: any) => {
      console.error('Upload mutation error:', error);
      const errorMessage = error.message || 'Upload báo giá thất bại. Vui lòng thử lại.';
      showError(errorMessage);
    },
  });

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined || Number.isNaN(Number(price))) {
      return '—';
    }
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(Number(price));
  };

  const rfqList = useMemo(() => rfqsRows ?? [], [rfqsRows]);

  const toggleRFQ = (rfqId: string) => {
    setExpandedRFQs((prev) => {
      const next = new Set(prev);
      if (next.has(rfqId)) {
        next.delete(rfqId);
      } else {
        next.add(rfqId);
      }
      return next;
    });
  };

  const handleViewQuotationDetail = async (quotationId: string) => {
    try {
      const detail = await buyerService.getQuotationById(quotationId);
      setSelectedQuotationForDetail(detail);
      setShowQuotationDetailModal(true);
    } catch (error: any) {
      showError('Không thể tải chi tiết báo giá');
    }
  };

  return (
    <div className={`${buyerOutletPageShellClass} animate-fade-in-right fade-in-right-delay-0`}>
      <div className={buyerWorkspacePageStackClass}>
      <BuyerPageHero
        kicker="Buyer · Báo giá"
        title="Quản lý báo giá"
        description="Xem, tải lên và quản lý báo giá từ NCC theo RFQ — bố cục KPI + panel + bảng đồng bộ Tổng quan PR Requestor."
        Icon={DollarSign}
        tint="violet"
        regionLabel="Quản lý báo giá"
        rightSlot={
          <button
            type="button"
            onClick={() => {
              setSelectedRFQId('');
              setShowUploadModal(true);
            }}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-white/35 bg-white/15 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 sm:w-auto"
          >
            <Upload className="h-5 w-5" strokeWidth={2} />
            <span>Nhập báo giá</span>
          </button>
        }
      />

      {/* A. KPI — insight cards (modal design system: gradient + ornament + watermark) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="animate-fade-in-right relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 p-3.5 pb-6 text-white shadow-lg shadow-violet-500/25 ring-1 ring-white/15 fade-in-right-stagger-2">
          <div className="pointer-events-none absolute -right-2.5 -top-2.5 h-14 w-14 rounded-full bg-white/12" aria-hidden />
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-100">Tổng RFQ</p>
          <p className="mt-1 text-2xl font-black tabular-nums tracking-tight">{quotationPageKpis.rfqTotal}</p>
          <p className="mt-1 max-w-[12rem] text-[11px] leading-snug text-white/85">RFQ được giao trong phạm vi Buyer</p>
          <FileQuestion className="pointer-events-none absolute bottom-2 right-2 h-8 w-8 text-white/20" strokeWidth={1.35} aria-hidden />
        </div>
        <div className="animate-fade-in-right relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-3.5 pb-6 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/15 fade-in-right-stagger-3">
          <div className="pointer-events-none absolute -right-2.5 -top-2.5 h-14 w-14 rounded-full bg-white/12" aria-hidden />
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-50">Đã có báo giá</p>
          <p className="mt-1 text-2xl font-black tabular-nums tracking-tight">{quotationPageKpis.withQuotations}</p>
          <p className="mt-1 max-w-[12rem] text-[11px] leading-snug text-white/88">Ít nhất một báo giá NCC đã nhập</p>
          <CheckCircle className="pointer-events-none absolute bottom-2 right-2 h-8 w-8 text-white/20" strokeWidth={1.35} aria-hidden />
        </div>
        <div className="animate-fade-in-right relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 p-3.5 pb-6 text-white shadow-lg shadow-blue-500/22 ring-1 ring-white/15 fade-in-right-stagger-4">
          <div className="pointer-events-none absolute -right-2.5 -top-2.5 h-14 w-14 rounded-full bg-white/12" aria-hidden />
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-100">Dòng báo giá</p>
          <p className="mt-1 text-2xl font-black tabular-nums tracking-tight">{quotationPageKpis.quotationRows}</p>
          <p className="mt-1 max-w-[12rem] text-[11px] leading-snug text-white/88">Theo bộ lọc hợp lệ và ô tìm kiếm hiện tại</p>
          <FileText className="pointer-events-none absolute bottom-2 right-2 h-8 w-8 text-white/20" strokeWidth={1.35} aria-hidden />
        </div>
        <div className="animate-fade-in-right relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 p-3.5 pb-6 text-white shadow-lg shadow-amber-500/28 ring-1 ring-white/15 fade-in-right-stagger-5">
          <div className="pointer-events-none absolute -right-2.5 -top-2.5 h-14 w-14 rounded-full bg-white/12" aria-hidden />
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-50">Gửi duyệt</p>
          <p className="mt-1 text-2xl font-black tabular-nums tracking-tight">{quotationPageKpis.canSubmitRfq}</p>
          <p className="mt-1 max-w-[12rem] text-[11px] leading-snug text-white/92">Đủ báo giá và chưa gửi lên Buyer Leader</p>
          <Clock3 className="pointer-events-none absolute bottom-2 right-2 h-8 w-8 text-white/22" strokeWidth={1.35} aria-hidden />
        </div>
      </div>

      {/* B. Danh sách RFQ — panel + bảng token requestor */}
      <div
        className={`animate-fade-in-right fade-in-right-stagger-6 ${buyerPanelCardClass} border-violet-100/80 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.14),0_4px_18px_-6px_rgba(139,92,246,0.12)] ring-1 ring-violet-100/50`}
      >
        <div className="mb-4 flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30 ring-2 ring-white/80">
            <FileQuestion className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Danh sách RFQ</h2>
            <p className="mt-0.5 text-sm leading-snug text-slate-600">
              RFQ từ PR được phân công — bấm dòng để nhập báo giá (trừ RFQ đã gửi duyệt / đóng).
            </p>
          </div>
        </div>
        <div
          className={`${buyerDataTableCardClass} overflow-hidden border-violet-100/60 shadow-[0_8px_28px_-12px_rgba(15,23,42,0.12)] ring-1 ring-violet-50/80`}
        >
          <div
            className={`${buyerDataTableCardHeaderClass} border-violet-100/70 bg-gradient-to-r from-violet-50/95 via-white to-fuchsia-50/40`}
          >
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm ring-1 ring-violet-100/80">
                <ClipboardCheck className="h-4 w-4" strokeWidth={2} />
              </span>
              Chi tiết RFQ
            </h3>
          </div>
          <div>
            {isLoadingRFQs ? (
              <div className="px-4 py-12 text-center text-slate-500 sm:px-6">
                <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                <p>Đang tải danh sách RFQ...</p>
              </div>
            ) : rfqsError ? (
              <div className="px-4 py-8 text-center sm:px-6">
                <p className="font-medium text-red-600">Lỗi khi tải danh sách RFQ</p>
                <p className="mt-1 text-sm text-slate-500">
                  {rfqsError instanceof Error ? rfqsError.message : 'Unknown error'}
                </p>
              </div>
            ) : rfqList.length === 0 ? (
              <div className="px-4 py-12 text-center sm:px-6">
                <FileQuestion className="mx-auto mb-3 h-14 w-14 text-slate-300" strokeWidth={1.5} />
                <p className="font-medium text-slate-700">Chưa có RFQ nào</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  Tạo RFQ từ trang &quot;PR được phân công&quot; (chọn PR → Tạo RFQ). Sau đó RFQ sẽ hiện ở đây để bạn nhập báo giá.
                </p>
              </div>
            ) : (
              <div className="relative w-full min-w-0 overflow-x-auto [scrollbar-width:thin]">
                <table className={`${buyerInteractiveTableClass} w-full min-w-[720px] text-sm`}>
                  <thead className="sticky top-0 z-20 border-b border-violet-100/90 bg-gradient-to-r from-[#F5F3FF] via-white to-[#FAF5FF] shadow-[0_1px_0_0_rgba(139,92,246,0.1)]">
                    <tr>
                      <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-violet-950/90 sm:px-4 md:px-6">
                        <span className="inline-flex items-center gap-2">
                          <Hash className="h-4 w-4 shrink-0 text-violet-600" strokeWidth={2} />
                          Mã RFQ / PR
                        </span>
                      </th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-violet-950/90 sm:px-4 md:px-6">
                        <span className="inline-flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4 shrink-0 text-fuchsia-600" strokeWidth={2} />
                          Trạng thái
                        </span>
                      </th>
                      <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-violet-950/90 sm:px-4 md:px-6">
                        <span className="inline-flex items-center justify-center gap-2">
                          <Sparkles className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={2} />
                          Số báo giá
                        </span>
                      </th>
                      <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-violet-950/90 sm:px-4 md:px-6">
                        <span className="inline-flex items-center gap-2">
                          <Edit3 className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={2} />
                          Thao tác
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={buyerInteractiveTableBodyClass}>
                  {rfqList.map((rfq: any, rfqIdx: number) => {
                    const awardedDone = PR_STATUS_AFTER_AWARD.has(rfq.prStatus);
                    const preset = awardedDone ? AWARDED_STATUS_ROW_UI : RFQ_STATUS_ROW_UI[rfq.status];
                    const StatusIcon = preset?.Icon ?? rfqStatusRowFallback.Icon;
                    const statusLabel = preset?.label ?? (awardedDone ? 'Đã chọn NCC' : rfq.status);
                    const statusCls = preset?.className ?? rfqStatusRowFallback.className;
                    const isLocked = rfq.status === 'READY_FOR_COMPARISON' || rfq.status === 'CLOSED' || awardedDone;
                    return (
                      <tr
                        key={rfq.id}
                        onClick={() => {
                          if (isLocked) return;
                          setSelectedRFQId(rfq.id);
                          setShowUploadModal(true);
                        }}
                        className={[
                          'group',
                          isLocked
                            ? `${buyerTableDataRowVisual(rfqIdx)} cursor-not-allowed opacity-[0.93] [&>td]:!bg-slate-50/90`
                            : buyerTableRowInteractive(rfqIdx),
                        ].join(' ')}
                      >
                        <td className="relative px-3 py-3 sm:px-4 sm:py-4 md:px-6">
                          <div aria-hidden className={buyerTableAccentRailClass} />
                          <div className={`${buyerTableFirstCellInnerClass} ${buyerTableCellWrapClass}`}>
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-violet-100/90">
                                <Hash className="h-3.5 w-3.5" strokeWidth={2} />
                              </span>
                              <div className="min-w-0">
                                <div className="font-mono text-sm font-bold text-indigo-800">{rfq.rfqNumber}</div>
                                <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                                  <FileText className="h-3 w-3 shrink-0 text-slate-400" strokeWidth={2} />
                                  <span className="truncate">PR {rfq.prNumber}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 sm:px-4 sm:py-4 md:px-6">
                          <div className={buyerTableCellWrapClass}>
                            <span
                              className={`inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm ring-1 ${statusCls}`}
                            >
                              <StatusIcon className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} />
                              {statusLabel}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center sm:px-4 sm:py-4 md:px-6">
                          <div className={`${buyerTableCellWrapClass} flex justify-center`}>
                            {(() => {
                              const q = rfq.quotationsCount ?? 0;
                              const tone =
                                q >= 3
                                  ? 'border-emerald-200/90 bg-emerald-50 text-emerald-900 ring-emerald-100/85'
                                  : q > 0
                                    ? 'border-amber-200/90 bg-amber-50 text-amber-950 ring-amber-100/85'
                                    : 'border-slate-200/90 bg-slate-50 text-slate-500 ring-slate-100/80';
                              return (
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold tabular-nums shadow-sm ring-1 ${tone}`}
                                >
                                  <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-90" strokeWidth={2} />
                                  {q}
                                </span>
                              );
                            })()}
                          </div>
                        </td>
                        <td className="px-3 py-3 sm:px-4 sm:py-4 md:px-6" onClick={(e) => e.stopPropagation()}>
                          <div className={buyerTableCellWrapFlexClass}>
                          <button
                            type="button"
                            onClick={() => {
                              if (isLocked) return;
                              setSelectedRFQId(rfq.id);
                              setShowUploadModal(true);
                            }}
                            disabled={isLocked}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold shadow-sm ring-1 transition motion-safe:hover:-translate-y-0.5 ${
                              isLocked
                                ? 'cursor-not-allowed border border-slate-200/90 bg-slate-100 text-slate-400 ring-slate-100'
                                : 'border border-violet-200/95 bg-gradient-to-b from-white to-violet-50/95 text-violet-800 shadow-violet-200/40 ring-white/95 hover:border-violet-300 hover:shadow-md'
                            }`}
                          >
                            {isLocked ? (
                              <Eye className="h-3.5 w-3.5 shrink-0 opacity-70" strokeWidth={2} />
                            ) : (
                              <Edit3 className="h-3.5 w-3.5 shrink-0 text-violet-600" strokeWidth={2} />
                            )}
                            {isLocked ? 'Đã submit' : 'Nhập báo giá'}
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* C. Báo giá theo RFQ — panel + lọc + cây (token requestor) */}
      <div className={`animate-fade-in-right fade-in-right-stagger-6 ${buyerPanelCardClass}`}>
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <div className="rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 p-2">
              <DollarSign className="h-4 w-4 text-indigo-600" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                Danh sách báo giá ({quotationsByRFQ.length} RFQ, {filteredQuotations.length} báo giá)
              </h2>
              <p className="mt-0.5 text-sm leading-snug text-slate-600">
                Mỗi RFQ có thể có nhiều báo giá từ các NCC — lọc hợp lệ / tìm kiếm, mở nhóm để xem chi tiết.
              </p>
            </div>
          </div>
          {quotationsByRFQ.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setExpandedRFQs(new Set(quotationsByRFQ.map((g) => g.rfqId)));
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Mở tất cả
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpandedRFQs(new Set());
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Đóng tất cả
              </button>
            </div>
          )}
        </div>

        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full flex-1 md:max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-500" />
            <input
              type="text"
              placeholder="Tìm kiếm theo mã báo giá, PR, NCC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto md:shrink-0">
            <Filter className="h-5 w-5 shrink-0 text-violet-500" />
            <CustomSelect
              value={validityFilter}
              onChange={(e) => setValidityFilter(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 md:min-w-[12rem] md:flex-none md:px-4"
            >
              <option value="all">Tất cả</option>
              <option value="valid">Hợp lệ</option>
              <option value="invalid">Không hợp lệ</option>
            </CustomSelect>
          </div>
        </div>

        <div className={`min-w-0 ${buyerDataTableCardClass}`}>
          {quotationsError && (
            <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:mx-6">
              Lỗi khi tải danh sách báo giá:{' '}
              {quotationsError instanceof Error ? quotationsError.message : 'Unknown error'}
            </div>
          )}
          <div className={buyerDataTableCardHeaderClass}>
            <h3 className="text-base font-bold text-slate-900 sm:text-lg">Theo nhóm RFQ</h3>
          </div>
        <div className="divide-y divide-slate-100 pb-3 sm:pb-4">
          {isLoading ? (
            <div className="px-4 py-12 text-center text-slate-500 sm:px-6">
              <div className="inline-block w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p>Đang tải danh sách báo giá...</p>
            </div>
          ) : quotationsByRFQ.length > 0 ? (
            quotationsByRFQ.map((rfqGroup) => {
              const isExpanded = expandedRFQs.has(rfqGroup.rfqId);
              const quotationsCount = rfqGroup.quotations.length;
              const rfqStatus = rfqGroup.rfqStatus || 'DRAFT';
              const awardedDone = PR_STATUS_AFTER_AWARD.has(String(rfqGroup.prStatus || ''));

              return (
                <div key={rfqGroup.rfqId} className="transition-colors hover:bg-slate-50/50">
                  {/* RFQ Header (Container) */}
                  <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4 md:px-6">
                    <div
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                      onClick={() => toggleRFQ(rfqGroup.rfqId)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" strokeWidth={2} />
                      ) : (
                        <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" strokeWidth={2} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="text-sm font-bold text-slate-900 sm:text-base">{rfqGroup.rfqNumber}</h3>
                          <span className="text-xs text-slate-500 sm:text-sm">PR: {rfqGroup.prNumber}</span>
                          <span className="text-xs text-slate-600 sm:text-sm">
                            ({quotationsCount} {quotationsCount === 1 ? 'báo giá' : 'báo giá'})
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Submit RFQ Button */}
                    <div className="flex shrink-0 flex-wrap items-center gap-2 pl-8 sm:pl-0" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        // Cho phép submit nếu có >= 1 báo giá và RFQ chưa được submit
                        // Status có thể là DRAFT, SENT, hoặc QUOTATION_RECEIVED
                        const canSubmit =
                          !awardedDone &&
                          quotationsCount >= 1 &&
                          rfqStatus !== 'READY_FOR_COMPARISON' &&
                          rfqStatus !== 'CLOSED';
                        const isSubmitted = rfqStatus === 'READY_FOR_COMPARISON' || awardedDone;

                        if (canSubmit) {
                          return (
                            <button
                              onClick={() => {
                                setRfqToSubmit({ id: rfqGroup.rfqId, rfqNumber: rfqGroup.rfqNumber });
                                setShowSubmitRFQModal(true);
                              }}
                              disabled={completeRFQMutation.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-soft hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium shadow-sm"
                              title="Gửi duyệt RFQ"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
                              Gửi duyệt RFQ
                            </button>
                          );
                        }
                        if (isSubmitted) {
                          return (
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                                awardedDone
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                  : 'bg-green-100 text-green-700 border-green-200'
                              }`}
                            >
                              {awardedDone ? 'Đã chọn NCC' : '✓ Đã gửi duyệt'}
                            </span>
                          );
                        }
                        if (rfqStatus === 'CLOSED') {
                          return (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Đã chọn NCC
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  {/* Quotations List (Children) - Expandable */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/30">
                      <div className="px-3 py-2 sm:px-4 md:px-6">
                        <div className={buyerWorkspaceTableViewportClass}>
                          <table className={`${buyerInteractiveTableClass} w-full min-w-[900px] text-sm`}>
                            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">NCC</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Tổng báo giá</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Lead time</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Thanh toán</th>
                                <th
                                  className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase"
                                  title="Số item được chọn · Tổng tiền item thắng"
                                >
                                  Item thắng
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Trạng thái</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody className={buyerInteractiveTableBodyClass}>
                              {rfqGroup.quotations.map((quotation: any, idx: number) => {
                                const isRfqClosed = quotation.rfqStatus === 'CLOSED' || awardedDone;
                                const selectedCount = quotation.selectedItemCount ?? 0;
                                const selectedTotal = quotation.selectedItemsTotalAmount ?? 0;
                                const hasSelected =
                                  isRfqClosed && (selectedCount > 0 || quotation.status === 'SELECTED');

                                // Trạng thái:
                                // - Nếu RFQ đã đóng: Được chọn (X items) / Không được chọn
                                // - Nếu RFQ chưa đóng: dùng trạng thái VALID/INVALID/...
                                let statusLabel: string;
                                let statusClass: string;
                                if (isRfqClosed) {
                                  if (hasSelected) {
                                    statusLabel =
                                      selectedCount > 0
                                        ? `Được chọn (${selectedCount} items)`
                                        : 'Được chọn';
                                    statusClass = 'bg-green-50 text-green-700 border-green-200';
                                  } else {
                                    statusLabel = 'Không được chọn';
                                    statusClass = 'bg-slate-100 text-slate-600 border-slate-200';
                                  }
                                } else {
                                  if (quotation.status === 'VALID') {
                                    statusLabel = 'Hợp lệ';
                                    statusClass = 'bg-green-100 text-green-700 border-green-200';
                                  } else if (quotation.status === 'INVALID') {
                                    statusLabel = 'Không hợp lệ';
                                    statusClass = 'bg-red-100 text-red-700 border-red-200';
                                  } else {
                                    statusLabel = 'Chờ xử lý';
                                    statusClass = 'bg-slate-100 text-slate-700 border-slate-200';
                                  }
                                }

                                return (
                                  <tr key={quotation.id} className={`group ${buyerTableDataRowVisual(idx)}`}>
                                    <td className="relative px-4 py-3">
                                      <div aria-hidden className={buyerTableAccentRailClass} />
                                      <div className={`${buyerTableFirstCellInnerClass} ${buyerTableCellWrapClass}`}>
                                        <p className="font-medium text-slate-900">{quotation.supplier?.name || '-'}</p>
                                        <p className="text-xs text-slate-500">
                                          {quotation.supplier?.code && <>Mã NCC: {quotation.supplier.code} · </>}
                                          {quotation.quotationNumber && <>Báo giá: {quotation.quotationNumber}</>}
                                        </p>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <span className="text-sm font-bold text-slate-900">
                                        {formatPrice(quotation.totalAmount)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-600">
                                      {quotation.leadTime ? `${quotation.leadTime} ngày` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 max-w-xs">
                                      <p className="truncate" title={quotation.paymentTerms || '-'}>
                                        {quotation.paymentTerms || '-'}
                                      </p>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {isRfqClosed ? (
                                        <span className="inline-flex flex-col items-center gap-0.5">
                                          <span className="font-semibold text-slate-900">{selectedCount}</span>
                                          <span className="text-[11px] text-slate-600">
                                            {selectedCount > 0 ? formatPrice(selectedTotal) : '-'}
                                          </span>
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 text-xs">-</span>
                                      )}
                                    </td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewQuotationDetail(quotation.id);
                                      }}
                                      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusClass}`}
                                    >
                                      {hasSelected && <span className="w-2 h-2 rounded-full bg-green-500" aria-hidden />}
                                      {!hasSelected && isRfqClosed && (
                                        <span className="w-2 h-2 rounded-full bg-slate-400" aria-hidden />
                                      )}
                                      {statusLabel}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {['CREATED', 'SENT', 'CONFIRMED', 'PARTIAL_RECEIVED', 'FULLY_RECEIVED', 'APPROVED'].includes(
                                      quotation.poStatus ?? ''
                                    ) && quotation.poId ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(`/dashboard/buyer/po/${quotation.poId}`);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-soft text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                                        title="Xem PO và xuất PDF"
                                      >
                                        <FileText className="w-4 h-4" strokeWidth={2} />
                                        Xuất PO
                                      </button>
                                    ) : (
                                      <span className="text-slate-400 text-xs">—</span>
                                    )}
                                  </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex min-h-[11rem] flex-col items-center justify-center px-6 py-8 text-center sm:min-h-[12rem] sm:py-9">
              <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50 text-violet-300 ring-1 ring-violet-100">
                  <FileText className="h-9 w-9" strokeWidth={1.5} />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-semibold text-slate-800">Chưa có báo giá nào</p>
                  {quotationsData?.quotations && quotationsData.quotations.length === 0 ? (
                    <p className="text-sm leading-relaxed text-slate-500">
                      Bạn chưa tạo báo giá nào. Dùng nút <strong className="text-slate-700">«Nhập báo giá»</strong> phía trên hoặc bấm bên dưới để thêm báo giá từ NCC.
                    </p>
                  ) : (
                    <p className="text-sm leading-relaxed text-slate-500">
                      Không có báo giá nào khớp bộ lọc hoặc từ khóa. Thử đổi bộ lọc hoặc xóa ô tìm kiếm.
                    </p>
                  )}
                </div>
                {quotationsData?.quotations && quotationsData.quotations.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200/50 transition hover:from-violet-700 hover:to-indigo-700 sm:w-auto"
                  >
                    <Upload className="h-4 w-4 shrink-0" strokeWidth={2} />
                    Nhập báo giá
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
      </div>

      {/* Upload/Create Quotation Modal — render qua portal để overlay phủ full màn hình, trên header/layout */}
      {showUploadModal && createPortal(
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center overflow-y-auto bg-slate-900/55 px-4 py-6 backdrop-blur-sm modal-popup-overlay"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="modal-popup-panel w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_32px_64px_-12px_rgba(15,23,42,0.28)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200/80 bg-gradient-to-r from-indigo-50 via-violet-50 to-white px-6 py-5">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-500">Buyer · Quotation</p>
                <h3 className="mt-1 text-xl font-black text-slate-900">Nhập báo giá</h3>
                <p className="mt-1 text-sm text-slate-600">Chọn RFQ, chọn NCC và nhập đơn giá theo từng item.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="ml-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Chọn RFQ <span className="text-red-500">*</span></label>
                {isLoadingRFQs ? (
                  <div className="w-full px-4 py-2 border border-slate-300 rounded-soft bg-slate-50 text-slate-500 text-sm">
                    Đang tải danh sách RFQ...
                  </div>
                ) : rfqsError ? (
                  <div className="w-full px-4 py-2 border border-red-300 rounded-soft bg-red-50 text-red-700 text-sm">
                    Lỗi khi tải danh sách RFQ: {rfqsError instanceof Error ? rfqsError.message : 'Unknown error'}
                  </div>
                ) : (
                  <CustomSelect
                    value={selectedRFQId}
                    onChange={(e) => {
                      setSelectedRFQId(e.target.value);
                      setSelectedQuotationId('');
                    }}
                    className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  >
                    <option value="">-- Chọn RFQ --</option>
                    {(() => {
                      const selectable = (rfqsRows || []).filter(
                        (rfq: any) => rfq.status !== 'READY_FOR_COMPARISON' && rfq.status !== 'CLOSED'
                      );
                      if (selectable.length === 0) {
                        return (
                          <option value="" disabled>
                            Không còn RFQ nào có thể nhập báo giá (tất cả đã submit).
                          </option>
                        );
                      }
                      return selectable.map((rfq: any) => (
                        <option key={rfq.id} value={rfq.id}>
                          {rfq.rfqNumber} - {rfq.prNumber}
                        </option>
                      ));
                    })()}
                  </CustomSelect>
                )}
                {rfqsData?.rfqs && rfqsData.rfqs.length === 0 && !isLoadingRFQs && !rfqsError && rfqsRows.length === 0 && (
                  <p className="mt-2 text-sm text-amber-600">
                    ⚠️ Chưa có RFQ nào. Vui lòng tạo RFQ từ trang "PR được phân công" trước.
                  </p>
                )}
              </div>

              {selectedRFQId && (
                isLoadingRFQDetails ? (
                  <div className="p-4 text-center text-slate-500">
                    <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p>Đang tải thông tin RFQ...</p>
                  </div>
                ) : rfqDetails ? (
                  <>
                    {/* Mode Toggle */}
                    {rfqDetails.quotations && rfqDetails.quotations.length > 0 && (
                    <div className="flex gap-2 p-3 bg-slate-50 rounded-soft border border-slate-200">
                      <button
                        onClick={() => setIsCreatingNew(true)}
                        className={`flex-1 px-4 py-2 rounded-soft text-sm font-medium transition-colors ${
                          isCreatingNew
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Tạo báo giá mới
                      </button>
                      <button
                        onClick={() => setIsCreatingNew(false)}
                        className={`flex-1 px-4 py-2 rounded-soft text-sm font-medium transition-colors ${
                          !isCreatingNew
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Upload file cho báo giá có sẵn
                      </button>
                    </div>
                  )}

                  {isCreatingNew ? (
                    /* Create New Quotation Form */
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Nhà cung cấp <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <CustomSelect
                            value={supplierId}
                            onChange={(e) => setSupplierId(e.target.value)}
                            enableDropdownSearch
                            dropdownSearchPlaceholder="Tìm theo tên hoặc mã NCC..."
                            className="flex-1 px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                          >
                            <option value="">-- Chọn nhà cung cấp --</option>
                            {isLoadingSuppliers ? (
                              <option value="" disabled>Đang tải danh sách NCC...</option>
                            ) : suppliersError ? (
                              <option value="" disabled>Không tải được danh sách NCC. Thử tải lại trang.</option>
                            ) : suppliers.length === 0 ? (
                              <option value="" disabled>Chưa có NCC. Bấm &quot;Tạo mới&quot; để thêm.</option>
                            ) : (
                              suppliers.map((supplier: any) => (
                                <option key={supplier.id} value={supplier.id}>
                                  {supplier.name} {supplier.code ? `(${supplier.code})` : ''}
                                </option>
                              ))
                            )}
                          </CustomSelect>
                          <button
                            type="button"
                            onClick={() => setShowCreateSupplierModal(true)}
                            className="px-4 py-2 bg-green-600 text-white rounded-soft hover:bg-green-700 transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
                            title="Tạo nhà cung cấp mới"
                          >
                            <Plus className="w-4 h-4" />
                            Tạo mới
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Số báo giá
                        </label>
                        <input
                          type="text"
                          value={quotationNumber}
                          onChange={(e) => setQuotationNumber(e.target.value)}
                          placeholder="Tự động nếu để trống"
                          className="w-full max-w-xs px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Nhập đơn giá NCC từng item <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-slate-500 mb-2">
                          Nhập đơn giá chưa VAT. Chọn VAT 3%, 5%, 8% hoặc 10% cho từng dòng hoặc áp dụng cho tất cả.
                        </p>
                        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-soft border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                          <div className="min-w-[120px] flex-1">
                            <label className="mb-1 block text-xs font-medium text-slate-600">VAT cho tất cả dòng</label>
                            <CustomSelect
                              value={bulkVatPercent}
                              onChange={(e) => setBulkVatPercent(e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-soft text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                            >
                              {VAT_PERCENT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </CustomSelect>
                          </div>
                          <button
                            type="button"
                            onClick={applyBulkVatToAllItems}
                            className="rounded-soft border border-indigo-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50"
                          >
                            Áp dụng cho tất cả
                          </button>
                        </div>
                        <div className="border border-slate-200 rounded-soft overflow-hidden">
                          <div className={buyerWorkspaceTableViewportClass}>
                          <table className={`${buyerInteractiveTableClass} w-full min-w-[720px] text-sm`}>
                            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100">
                              <tr>
                                <th className="bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700">Item</th>
                                <th className="bg-slate-100 px-3 py-2 text-right font-semibold text-slate-700">Số lượng</th>
                                <th className="bg-slate-100 px-3 py-2 text-right font-semibold text-slate-700">Đơn giá (chưa VAT)</th>
                                <th className="bg-slate-100 px-3 py-2 text-center font-semibold text-slate-700 w-24">VAT</th>
                                <th className="bg-slate-100 px-3 py-2 text-right font-semibold text-slate-700">Thành tiền (có VAT)</th>
                              </tr>
                            </thead>
                            <tbody className={buyerInteractiveTableBodyClass}>
                              {rfqDetails.purchaseRequest.items.map((item: any, itemIdx: number) => {
                                const unitPriceNum = Math.round(itemPrices[item.id] ?? 0);
                                const qty = roundQuotationQty(Number(item.qty || 1));
                                const vat = Number(getItemVatPercent(item.id));
                                const line = quotationLineAmounts(qty, unitPriceNum, vat);
                                return (
                                  <tr key={item.id} className={`group ${buyerTableDataRowVisual(itemIdx)}`}>
                                    <td className="relative px-3 py-2 text-slate-800">
                                      <div aria-hidden className={buyerTableAccentRailClass} />
                                      <div className={`${buyerTableFirstCellInnerClass} ${buyerTableCellWrapClass}`}>
                                        {item.description}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-600">
                                      <div className={buyerTableCellWrapClass}>{qty}</div>
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className={buyerTableCellWrapClass}>
                                      <VndIntegerInput
                                        value={itemPrices[item.id]}
                                        onChange={(v) =>
                                          setItemPrices((p) => ({ ...p, [item.id]: v }))
                                        }
                                        placeholder="0"
                                        className="w-full px-2 py-1.5 border rounded text-right border-slate-300"
                                      />
                                      </div>
                                    </td>
                                    <td className="px-3 py-2">
                                      <CustomSelect
                                        value={getItemVatPercent(item.id)}
                                        onChange={(e) =>
                                          setItemVatPercents((p) => ({ ...p, [item.id]: e.target.value }))
                                        }
                                        className="w-full min-w-[4.5rem] px-2 py-1.5 border border-slate-300 rounded text-sm text-center"
                                      >
                                        {VAT_PERCENT_OPTIONS.map((opt) => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                      </CustomSelect>
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium text-slate-800">
                                      <div className={buyerTableCellWrapClass}>
                                        {unitPriceNum > 0 ? formatPrice(line.total) : '-'}
                                      </div>
                                      {unitPriceNum > 0 && line.vatAmount > 0 && (
                                        <div className="text-[10px] text-slate-500 mt-0.5">
                                          VAT {vat}%: {formatPrice(line.vatAmount)}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          </div>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-slate-600">
                          <div>
                            <strong>Tiền hàng (chưa VAT):</strong> {formatPrice(quotationTotalsPreview.subtotal)}
                          </div>
                          <div>
                            <strong>Tiền VAT:</strong> {formatPrice(quotationTotalsPreview.vatTotal)}
                          </div>
                          <div className="text-base font-semibold text-slate-900">
                            <strong>Tổng báo giá (có VAT):</strong> {formatPrice(quotationTotalsPreview.grandTotal)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Lead time (ngày) <span className="text-red-600">*</span>
                          </label>
                          <CustomSelect
                            value={leadTime}
                            onChange={(e) => setLeadTime(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                          >
                            {LEAD_TIME_DAYS_OPTIONS.map((opt) => (
                              <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
                            ))}
                          </CustomSelect>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Bảo hành (tháng) <span className="text-red-600">*</span>
                          </label>
                          <CustomSelect
                            value={warranty}
                            onChange={(e) => setWarranty(e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                          >
                            {WARRANTY_MONTHS_OPTIONS.map((opt) => (
                              <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
                            ))}
                          </CustomSelect>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Điều kiện thanh toán (%) <span className="text-red-600">*</span>
                        </label>
                        <CustomSelect
                          value={paymentTerms}
                          onChange={(e) => setPaymentTerms(e.target.value)}
                          required
                          className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        >
                          {PAYMENT_TERMS_PERCENT_OPTIONS.map((opt) => (
                            <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
                          ))}
                        </CustomSelect>
                        <p className="text-xs text-slate-500 mt-1">Tỷ lệ % làm tròn để hệ thống đánh giá NCC</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Upload file báo giá (PDF/Excel/Ảnh)
                        </label>
                        <input
                          type="file"
                          accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
                          multiple
                          onChange={(e) => {
                            if (e.target.files) {
                              setUploadFiles(Array.from(e.target.files));
                            }
                          }}
                          className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        />
                        {uploadFiles.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {uploadFiles.map((file, index) => (
                              <div key={index} className="text-xs text-slate-600">
                                • {file.name} ({(file.size / 1024).toFixed(2)} KB)
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Upload to Existing Quotation */
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Chọn báo giá
                        </label>
                        <CustomSelect
                          value={selectedQuotationId}
                          onChange={(e) => setSelectedQuotationId(e.target.value)}
                          className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        >
                          <option value="">-- Tự động chọn báo giá mới nhất --</option>
                          {rfqDetails.quotations.map((quotation: any) => (
                            <option key={quotation.id} value={quotation.id}>
                              {quotation.supplier?.name || 'NCC'} - {quotation.quotationNumber || 'Chưa có số báo giá'} ({formatPrice(quotation.totalAmount)})
                            </option>
                          ))}
                        </CustomSelect>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Upload file (PDF/Excel/Ảnh) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="file"
                          accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
                          multiple
                          onChange={(e) => {
                            if (e.target.files) {
                              setUploadFiles(Array.from(e.target.files));
                            }
                          }}
                          className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                        />
                        {uploadFiles.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {uploadFiles.map((file, index) => (
                              <div key={index} className="text-xs text-slate-600">
                                • {file.name} ({(file.size / 1024).toFixed(2)} KB)
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-rose-700">
                    <p>Không thể tải thông tin RFQ. Vui lòng thử lại.</p>
                  </div>
                )
              )}

              {selectedRFQId && rfqDetails && (
                <div className="sticky bottom-0 -mx-6 mt-2 flex gap-3 border-t border-slate-200 bg-white/95 px-6 pb-1 pt-4 backdrop-blur">
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                    }}
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                  {isCreatingNew ? (
                    <button
                      onClick={() => createQuotationMutation.mutate()}
                      disabled={
                        createQuotationMutation.isPending ||
                        !selectedRFQId ||
                        !supplierId ||
                        !rfqDetails?.purchaseRequest?.items?.length ||
                        !rfqDetails.purchaseRequest.items.every(
                          (item: any) => (itemPrices[item.id] ?? 0) > 0
                        ) ||
                        !isQuotationCommercialComplete(leadTime, paymentTerms, warranty)
                      }
                      className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {createQuotationMutation.isPending ? 'Đang tạo...' : 'Tạo báo giá'}
                    </button>
                  ) : (
                    <button
                      onClick={() => uploadQuotationMutation.mutate()}
                      disabled={
                        uploadQuotationMutation.isPending ||
                        !selectedRFQId ||
                        uploadFiles.length === 0
                      }
                      className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploadQuotationMutation.isPending ? 'Đang upload...' : 'Upload'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

              {selectedRFQId && rfqDetails && (!rfqDetails.purchaseRequest?.items || rfqDetails.purchaseRequest.items.length === 0) && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-soft text-amber-800">
                  <p className="font-medium">⚠️ RFQ này không có items.</p>
                  <p className="text-sm mt-1">Vui lòng kiểm tra lại RFQ hoặc tạo RFQ mới với items.</p>
                </div>
              )}

      {/* Create Supplier Modal — dùng portal + z cao hơn modal Nhập báo giá */}
      {showCreateSupplierModal && createPortal(
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[160] p-4 modal-popup-overlay"
          onClick={() => { setShowCreateSupplierModal(false); setNewSupplierName(''); setNewSupplierCode(''); setNewSupplierEmail(''); setNewSupplierPhone(''); }}
        >
          <div
            className="modal-popup-panel bg-white rounded-soft-lg shadow-soft-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-slate-900 mb-4">Tạo nhà cung cấp mới</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tên nhà cung cấp <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="Nhập tên nhà cung cấp"
                  className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Mã nhà cung cấp
                </label>
                <input
                  type="text"
                  value={newSupplierCode}
                  onChange={(e) => setNewSupplierCode(e.target.value)}
                  placeholder="Mã nhà cung cấp (tùy chọn)"
                  className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder="0123456789"
                  className="w-full px-4 py-2 border border-slate-300 rounded-soft focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setShowCreateSupplierModal(false);
                    setNewSupplierName('');
                    setNewSupplierCode('');
                    setNewSupplierEmail('');
                    setNewSupplierPhone('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-soft hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                    onClick={async () => {
                      if (!newSupplierName.trim()) {
                        showWarning('Vui lòng nhập tên nhà cung cấp');
                        return;
                      }
                      // Validate email if provided
                      if (newSupplierEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newSupplierEmail.trim())) {
                        showWarning('Email không hợp lệ. Vui lòng nhập email đúng định dạng hoặc để trống.');
                        return;
                      }
                      try {
                        const newSupplier = await buyerService.createSupplier({
                          name: newSupplierName.trim(),
                          code: newSupplierCode.trim() || undefined,
                          email: newSupplierEmail.trim() || undefined,
                          phone: newSupplierPhone.trim() || undefined,
                        });
                        await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
                        await refetchSuppliers();
                        setSupplierId(newSupplier.id);
                        // Close modal and reset form
                        setShowCreateSupplierModal(false);
                        setNewSupplierName('');
                        setNewSupplierCode('');
                        setNewSupplierEmail('');
                        setNewSupplierPhone('');
                        showSuccess('Đã tạo nhà cung cấp mới thành công!');
                      } catch (error: any) {
                        console.error('Create supplier error:', error);
                        const errorMessage = error.response?.data?.message || 
                                           error.response?.data?.error || 
                                           'Lỗi khi tạo nhà cung cấp';
                        if (error.response?.data?.details) {
                          const details = error.response.data.details;
                          const validationErrors = details.map((d: any) => {
                            if (d.path) return `${d.path.join('.')}: ${d.message || d.validation}`;
                            return d.message || d.validation;
                          }).join(', ');
                          showError(`${errorMessage}: ${validationErrors}`);
                        } else {
                          showError(errorMessage);
                        }
                      }
                    }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-soft hover:bg-green-700 transition-colors"
                >
                  Tạo mới
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Quotation Detail Modal */}
      {showQuotationDetailModal && selectedQuotationForDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-4 modal-popup-overlay"
          onClick={() => {
            setShowQuotationDetailModal(false);
            setSelectedQuotationForDetail(null);
          }}
        >
          <div
            className="modal-popup-panel relative w-full max-w-5xl my-auto max-h-[90vh] overflow-y-auto rounded-[32px] bg-white/90 shadow-2xl border border-slate-100 p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 mb-1">
                  Quotation Detail
                </p>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                  {selectedQuotationForDetail.supplier?.name || 'Nhà cung cấp'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  RFQ{' '}
                  <span className="font-semibold text-slate-800">
                    {selectedQuotationForDetail.rfqNumber || 'N/A'}
                  </span>
                  {' · '}
                  PR{' '}
                  <span className="font-semibold text-slate-800">
                    {selectedQuotationForDetail.prNumber || 'N/A'}
                  </span>
                </p>
              </div>
              <button
                onClick={() => {
                  setShowQuotationDetailModal(false);
                  setSelectedQuotationForDetail(null);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            <div className="space-y-6">
              {/* A. Thông tin NCC – card grid với icon */}
              <div className="rounded-3xl border border-slate-100 bg-slate-50/60 px-5 py-4 md:px-6 md:py-5">
                <h4 className="text-sm font-semibold text-slate-900 mb-4">
                  A. Thông tin nhà cung cấp
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="flex items-center gap-3 rounded-2xl bg-white shadow-sm border border-slate-100 px-3 py-3 hover:shadow-md hover:border-indigo-100 transition-all">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Nhà cung cấp
                      </p>
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {selectedQuotationForDetail.supplier?.name || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl bg-white shadow-sm border border-slate-100 px-3 py-3 hover:shadow-md hover:border-indigo-100 transition-all">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Điều kiện thanh toán
                      </p>
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {selectedQuotationForDetail.paymentTerms || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl bg-white shadow-sm border border-slate-100 px-3 py-3 hover:shadow-md hover:border-indigo-100 transition-all">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                      <Clock3 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Lead time
                      </p>
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {selectedQuotationForDetail.leadTime
                          ? `${selectedQuotationForDetail.leadTime} ngày`
                          : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl bg-white shadow-sm border border-slate-100 px-3 py-3 hover:shadow-md hover:border-indigo-100 transition-all">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Bảo hành
                      </p>
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {selectedQuotationForDetail.warranty || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* B. Bảng item chi tiết – bảng thoáng, hover row */}
              {selectedQuotationForDetail.items && selectedQuotationForDetail.items.length > 0 && (
                <div className="rounded-3xl border border-slate-100 bg-white px-5 py-4 md:px-6 md:py-5">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">
                    B. Chi tiết từng dòng hàng
                  </h4>
                  <div className={`rounded-2xl border border-slate-100 ${buyerWorkspaceTableViewportClass}`}>
                    <table className={`${buyerInteractiveTableClass} w-full min-w-[480px] text-sm`}>
                      <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm">
                        <tr>
                          <th className="bg-slate-50/95 px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            Item
                          </th>
                          <th className="bg-slate-50/95 px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            SL
                          </th>
                          <th className="bg-slate-50/95 px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            Đơn giá (chưa VAT)
                          </th>
                          <th className="bg-slate-50/95 px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            VAT
                          </th>
                          <th className="bg-slate-50/95 px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            Thành tiền (có VAT)
                          </th>
                          <th className="bg-slate-50/95 px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            Kết quả
                          </th>
                        </tr>
                      </thead>
                      <tbody className={buyerInteractiveTableBodyClass}>
                        {selectedQuotationForDetail.items.map((item: any, dIdx: number) => {
                          const selectedIds: string[] = selectedQuotationForDetail.selectedItemIds || [];
                          const isSelected =
                            item.purchaseRequestItemId && selectedIds.includes(item.purchaseRequestItemId);
                          return (
                            <tr key={item.id} className={`group ${buyerTableDataRowVisual(dIdx)}`}>
                              <td className="relative px-4 py-3 font-medium text-slate-900">
                                <div aria-hidden className={buyerTableAccentRailClass} />
                                <div className={`${buyerTableFirstCellInnerClass} ${buyerTableCellWrapClass}`}>
                                  {item.description || `Item ${item.lineNo}`}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap">
                                <div className={buyerTableCellWrapClass}>
                                  {item.qty} {item.unit || ''}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-slate-900 whitespace-nowrap">
                                <div className={buyerTableCellWrapClass}>{formatPrice(item.unitPrice)}</div>
                              </td>
                              <td className="px-4 py-3 text-center text-slate-700 whitespace-nowrap">
                                <div className={buyerTableCellWrapClass}>
                                  {item.vatPercent != null ? `${item.vatPercent}%` : '10%'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                                <div className={buyerTableCellWrapClass}>{formatPrice(item.totalPrice)}</div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className={buyerTableCellWrapClass}>
                                {isSelected ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden /> Được chọn
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                                    <span className="w-2 h-2 rounded-full bg-slate-400" aria-hidden /> Không chọn
                                  </span>
                                )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* C. Tổng hợp – dark card với gradient & glow */}
              <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-5 text-slate-50">
                <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-emerald-500/30 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-indigo-500/25 blur-3xl" />
                <div className="relative">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        C. Tổng hợp
                      </p>
                      <p className="mt-1 text-sm text-slate-300">
                        Tổng tiền báo giá từ NCC
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-900/40 border border-slate-700/60 px-4 py-3 max-w-md">
                    <p className="text-xs text-slate-400 mb-1">Tổng tiền báo giá</p>
                    <p className="text-xl font-semibold text-slate-50">
                      {formatPrice(selectedQuotationForDetail.totalAmount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedQuotationForDetail.riskNotes && (
                <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 px-4 py-3 flex gap-3">
                  <div className="mt-0.5">
                    <FileText className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-amber-900 mb-1">Ghi chú rủi ro</h4>
                    <p className="text-sm text-amber-800">{selectedQuotationForDetail.riskNotes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowQuotationDetailModal(false);
                  setSelectedQuotationForDetail(null);
                }}
                className="px-6 py-2 rounded-full bg-slate-900 text-slate-50 text-sm font-medium shadow-sm hover:bg-slate-800 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit RFQ — căn giữa + overlay toàn viewport (portal → body) */}
      {showSubmitRFQModal &&
        rfqToSubmit &&
        createPortal(
          <div className="fixed inset-0 z-[220] overflow-y-auto overscroll-none" role="presentation">
            <button
              type="button"
              aria-label="Đóng"
              className="app-modal-backdrop-enter fixed inset-0 z-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => {
                setShowSubmitRFQModal(false);
                setRfqToSubmit(null);
              }}
            />
            <div className="relative z-[1] flex min-h-[100dvh] items-center justify-center p-4 py-10 sm:p-6">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="submit-rfq-dialog-title"
                className="app-modal-panel-enter w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-green-50 to-slate-50 p-6">
                  <div className="min-w-0 pr-2">
                    <h3 id="submit-rfq-dialog-title" className="text-xl font-bold text-slate-900">
                      Gửi duyệt RFQ
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      RFQ:{' '}
                      <span className="font-semibold text-green-600">{rfqToSubmit.rfqNumber}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowSubmitRFQModal(false);
                      setRfqToSubmit(null);
                    }}
                    className="shrink-0 rounded-xl p-2 transition-colors hover:bg-slate-200"
                    type="button"
                    aria-label="Đóng"
                  >
                    <X className="h-5 w-5 text-slate-600" strokeWidth={2} />
                  </button>
                </div>

                <div className="p-6">
                  <p className="mb-3 text-slate-700">
                    Gửi RFQ này để Buyer Leader duyệt (so sánh báo giá và chọn NCC)?
                  </p>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="mb-2 text-sm font-medium text-amber-800">Lưu ý</p>
                    <ul className="list-inside list-disc space-y-1 text-sm text-amber-700">
                      <li>Sau khi gửi, Buyer không chỉnh sửa được nữa</li>
                      <li>Buyer Leader sẽ so sánh báo giá và chọn NCC</li>
                      <li>Hành động này không thể hoàn tác</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3 border-t border-slate-200 bg-slate-50 p-6">
                  <button
                    onClick={() => {
                      setShowSubmitRFQModal(false);
                      setRfqToSubmit(null);
                    }}
                    className="flex-1 rounded-soft border border-slate-300 px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-100"
                    type="button"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      if (rfqToSubmit) {
                        completeRFQMutation.mutate(rfqToSubmit.id);
                      }
                    }}
                    disabled={completeRFQMutation.isPending}
                    className="flex flex-1 items-center justify-center gap-2 rounded-soft bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                  >
                    {completeRFQMutation.isPending ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Đang xử lý...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                        <span>Gửi duyệt RFQ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default QuotationManagement;

