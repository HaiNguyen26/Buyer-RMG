/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Clock,
  DollarSign,
  GitCompareArrows,
  LayoutGrid,
  NotebookPen,
  Radar,
  Save,
  ShieldCheck,
  Sparkles,
  Tag,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { buyerLeaderService } from '../../services/buyerLeaderService';
import { useToast } from '../../contexts/ToastContext';
import CustomSelect from '../../components/CustomSelect';
import { AwardAllocationSummary } from './award/AwardAllocationSummary';
import { AwardSuggestionsPanel } from './award/AwardSuggestionsPanel';
import { AwardCompareItemCards } from './award/AwardCompareItemCards';

type SelectionMap = Record<string, string>;

const currency = (amount?: number | null, code = 'VND') =>
  amount == null
    ? '—'
    : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: code }).format(amount);

/** Gợi ý triệu/tỷ VND cho panel recommendation. */
const currencyCompactVi = (amount: number) => {
  if (!Number.isFinite(amount)) return '—';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${(amount / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỉ`;
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr`;
  return currency(amount);
};

/** Lựa chọn thuần “giá thấp nhất từng dòng” — dùng cho đề xuất hệ thống. */
const buildLowestCostSelectionMap = (prItems: any[], normalizedQuotations: any[]): SelectionMap => {
  const next: SelectionMap = {};
  prItems.forEach((item: any) => {
    const allCandidates = normalizedQuotations
      .map((q: any) => ({
        q,
        line: q.items.find((x: any) => x.purchaseRequestItemId === item.id),
      }))
      .filter((x: any) => x.line);
    if (!allCandidates.length) return;
    const min = allCandidates.reduce((acc: any, curr: any) =>
      Number(curr.line.unitPrice) < Number(acc.line.unitPrice) ? curr : acc
    );
    next[item.id] = min.q.id;
  });
  return next;
};

/** 2 chữ viết tắt từ tên NCC — hiển thị trực quan khi tên dài. */
const vendorNameInitials = (name: string) => {
  const t = name.trim();
  if (!t) return '—';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? '';
    const b = parts[parts.length - 1]?.[0] ?? '';
    return (a + b).toUpperCase() || t.slice(0, 2).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
};

const awardSplitFromSelectionMap = (
  prItems: any[],
  normalizedQuotations: any[],
  map: SelectionMap
) => {
  let totalAward = 0;
  const splitRaw: Record<string, { vendorId: string; vendorName: string; amount: number; items: number }> = {};
  prItems.forEach((item: any) => {
    const selectedQuotationId = map[item.id];
    if (!selectedQuotationId) return;
    const q = normalizedQuotations.find((x: any) => x.id === selectedQuotationId);
    const line = q?.items.find((x: any) => x.purchaseRequestItemId === item.id);
    if (!q || !line) return;
    totalAward += Number(line.totalPrice || 0);
    if (!splitRaw[q.supplier.id]) {
      splitRaw[q.supplier.id] = {
        vendorId: q.supplier.id,
        vendorName: q.supplier.name,
        amount: 0,
        items: 0,
      };
    }
    splitRaw[q.supplier.id].amount += Number(line.totalPrice || 0);
    splitRaw[q.supplier.id].items += 1;
  });
  const split = Object.values(splitRaw)
    .map((v) => ({
      ...v,
      pct: totalAward > 0 ? (v.amount / totalAward) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  return { totalAwardCost: totalAward, splitByVendor: split };
};

type AwardMetricTone = 'indigo' | 'emerald' | 'sky' | 'amber' | 'violet' | 'rose';

/** Theo V3 bento + StatCard accent: nền wash nhẹ theo tone, không phải khối trắng phẳng. */
const AWARD_METRIC_TONE: Record<
  AwardMetricTone,
  { well: string; icon: string; surface: string; surfaceHover: string }
> = {
  indigo: {
    well: 'bg-gradient-to-br from-indigo-500/25 via-indigo-500/14 to-violet-600/12 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)] ring-1 ring-indigo-400/40',
    icon: 'text-indigo-700',
    surface:
      'border-indigo-200/65 bg-gradient-to-br from-indigo-50/95 via-white to-violet-50/45 shadow-[0_14px_30px_-16px_rgba(79,70,229,0.16),inset_0_1px_0_0_rgba(255,255,255,0.92)] ring-1 ring-indigo-500/[0.07]',
    surfaceHover:
      'hover:border-indigo-300/80 hover:shadow-[0_20px_42px_-18px_rgba(79,70,229,0.24)]',
  },
  emerald: {
    well: 'bg-gradient-to-br from-emerald-500/25 via-teal-400/14 to-emerald-600/12 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.58)] ring-1 ring-emerald-400/42',
    icon: 'text-emerald-700',
    surface:
      'border-emerald-200/60 bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/40 shadow-[0_14px_30px_-16px_rgba(16,185,129,0.14),inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-emerald-500/[0.08]',
    surfaceHover:
      'hover:border-emerald-300/75 hover:shadow-[0_20px_42px_-18px_rgba(16,185,129,0.2)]',
  },
  sky: {
    well: 'bg-gradient-to-br from-sky-500/26 via-cyan-400/14 to-sky-600/12 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.58)] ring-1 ring-sky-400/40',
    icon: 'text-sky-700',
    surface:
      'border-sky-200/65 bg-gradient-to-br from-sky-50/95 via-white to-cyan-50/42 shadow-[0_14px_30px_-16px_rgba(14,165,233,0.15),inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-sky-500/[0.07]',
    surfaceHover: 'hover:border-sky-300/78 hover:shadow-[0_20px_42px_-18px_rgba(14,165,233,0.2)]',
  },
  amber: {
    well: 'bg-gradient-to-br from-amber-400/28 via-amber-500/16 to-orange-500/12 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.55)] ring-1 ring-amber-400/45',
    icon: 'text-amber-800',
    surface:
      'border-amber-200/70 bg-gradient-to-br from-amber-50/95 via-white to-orange-50/38 shadow-[0_14px_30px_-16px_rgba(245,158,11,0.16),inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-amber-500/[0.08]',
    surfaceHover:
      'hover:border-amber-300/80 hover:shadow-[0_20px_42px_-18px_rgba(245,158,11,0.22)]',
  },
  violet: {
    well: 'bg-gradient-to-br from-violet-500/24 via-fuchsia-400/14 to-violet-700/12 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.58)] ring-1 ring-violet-400/42',
    icon: 'text-violet-700',
    surface:
      'border-violet-200/65 bg-gradient-to-br from-violet-50/95 via-white to-fuchsia-50/40 shadow-[0_14px_30px_-16px_rgba(139,92,246,0.15),inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-violet-500/[0.07]',
    surfaceHover:
      'hover:border-violet-300/78 hover:shadow-[0_20px_42px_-18px_rgba(139,92,246,0.22)]',
  },
  rose: {
    well: 'bg-gradient-to-br from-rose-500/26 via-red-400/14 to-rose-600/12 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.58)] ring-1 ring-rose-400/42',
    icon: 'text-rose-700',
    surface:
      'border-rose-200/70 bg-gradient-to-br from-rose-50/95 via-white to-red-50/38 shadow-[0_14px_30px_-16px_rgba(244,63,94,0.16),inset_0_1px_0_0_rgba(255,255,255,0.9)] ring-1 ring-rose-500/[0.08]',
    surfaceHover:
      'hover:border-rose-300/80 hover:shadow-[0_20px_42px_-18px_rgba(244,63,94,0.22)]',
  },
};

/** KPI dòng so sánh/trao thầu — layout gọn như cũ, icon+màu gradient theo workspace. */
const AwardWorkspaceMetricTile = ({
  label,
  value,
  icon,
  tone,
  className = '',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: AwardMetricTone;
  className?: string;
}) => {
  const t = AWARD_METRIC_TONE[tone];
  return (
    <div
      className={[
        'group relative flex h-full min-h-[5.75rem] flex-col justify-between overflow-hidden rounded-2xl border p-3.5',
        t.surface,
        t.surfaceHover,
        'transition-all duration-300 ease-out hover:-translate-y-0.5',
        'motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none',
        'sm:p-4',
        'before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/25 before:to-transparent before:opacity-90',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="relative z-[1] flex items-start gap-2.5 sm:gap-3">
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${t.well}`}
        >
          <span className={`[&_svg]:h-[1.15rem] [&_svg]:w-[1.15rem] sm:[&_svg]:h-5 sm:[&_svg]:w-5 ${t.icon}`}>
            {icon}
          </span>
        </span>
        <p className="min-w-0 pt-0.5 text-[10px] font-bold uppercase leading-snug tracking-[0.14em] text-slate-500 sm:text-[11px]">
          {label}
        </p>
      </div>
      <p className="relative z-[1] mt-3 text-[0.9375rem] font-black tabular-nums leading-snug text-slate-900 sm:text-lg">
        {value}
      </p>
    </div>
  );
};

const parseLead = (leadTime: string | number | null | undefined) => {
  if (leadTime == null) return 999;
  if (typeof leadTime === 'number') return leadTime;
  const n = parseInt(String(leadTime).replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 999;
};

const useAnimatedNumber = (value: number, duration = 450) => {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const from = display;
    const diff = value - from;
    if (!Number.isFinite(diff) || diff === 0) {
      setDisplay(value);
      return;
    }
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t * (2 - t);
      setDisplay(from + diff * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return display;
};

const TAB_LINKS = [
  { key: 'compare', label: 'So sánh', to: 'compare', icon: GitCompareArrows, activeClass: 'from-sky-500 to-indigo-600' },
  {
    key: 'allocation',
    label: 'Phân bổ trao thầu',
    to: 'allocation',
    icon: LayoutGrid,
    activeClass: 'from-cyan-500 to-teal-600',
  },
  { key: 'exceptions', label: 'Ngoại lệ', to: 'exceptions', icon: Radar, activeClass: 'from-amber-500 to-rose-600' },
  {
    key: 'history',
    label: 'Lịch sử nhà cung cấp',
    to: 'history',
    icon: NotebookPen,
    activeClass: 'from-violet-500 to-purple-600',
  },
] as const;

export interface CompareAwardContextShape {
  rfq: any;
  quotations: any[];
  prItems: any[];
  selectedItems: SelectionMap;
  setSelectedItems: React.Dispatch<React.SetStateAction<SelectionMap>>;
  justification: string;
  setJustification: React.Dispatch<React.SetStateAction<string>>;
  approvalMode: boolean;
  selectedCount: number;
  exceptions: Array<{
    itemId: string;
    itemName: string;
    issue: string;
    action: string;
    severity: 'warning' | 'critical';
  }>;
  totalAwardCost: number;
  lowestPossibleCost: number;
  rfqValue: number;
  splitByVendor: Array<{ vendorId: string; vendorName: string; amount: number; items: number; pct: number }>;
  optimizeAward: (mode: 'lowest_cost' | 'cost_plus_leadtime') => void;
}

const CompareAwardWorkspace = () => {
  const { rfqId } = useParams<{ rfqId: string }>();
  const navigate = useNavigate();
  const { showSuccess, showWarning, showError } = useToast();
  const [selectedItems, setSelectedItems] = useState<SelectionMap>({});
  const [justification, setJustification] = useState('');
  const [approvalMode, setApprovalMode] = useState(false);
  /** Chọn 1 NCC phủ toàn bộ dòng (không chia nhiều NCC). */
  const [singleVendorSupplierId, setSingleVendorSupplierId] = useState('');
  const [optimizeMode, setOptimizeMode] = useState<'lowest_cost' | 'cost_plus_leadtime'>('lowest_cost');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['buyer-leader-compare-award-workspace', rfqId],
    queryFn: () => buyerLeaderService.compareQuotations(rfqId || ''),
    enabled: !!rfqId,
  });

  const rfq = data?.rfq;
  const quotations = data?.quotations || [];
  const prItems = rfq?.prItems || [];

  const normalizedQuotations = useMemo(
    () =>
      quotations.map((q: any) => ({
        ...q,
        leadDays: parseLead(q.leadTime),
      })),
    [quotations]
  );

  /** Báo giá đơn giá thấp nhất từng dòng — lưu cả totalPrice (đã VAT) để cộng cùng cơ sở với chi phí trao thầu. */
  const lowestByItem = useMemo(() => {
    const map: Record<string, { quotationId: string; unitPrice: number; totalPrice: number }> = {};
    prItems.forEach((item: any) => {
      normalizedQuotations.forEach((q: any) => {
        const line = q.items.find((x: any) => x.purchaseRequestItemId === item.id);
        if (!line) return;
        const unitPrice = Number(line.unitPrice || 0);
        const totalPrice = Number(line.totalPrice || 0);
        if (!map[item.id] || unitPrice < map[item.id].unitPrice) {
          map[item.id] = { quotationId: q.id, unitPrice, totalPrice };
        }
      });
    });
    return map;
  }, [normalizedQuotations, prItems]);

  const selectedCount = useMemo(
    () => Object.values(selectedItems).filter(Boolean).length,
    [selectedItems]
  );

  const totals = useMemo(() => {
    let totalAward = 0;
    let lowestPossible = 0;
    prItems.forEach((item: any) => {
      const selectedQuotationId = selectedItems[item.id];
      if (selectedQuotationId) {
        const q = normalizedQuotations.find((x: any) => x.id === selectedQuotationId);
        const line = q?.items.find((x: any) => x.purchaseRequestItemId === item.id);
        if (line) totalAward += Number(line.totalPrice || 0);
      }
      const lowest = lowestByItem[item.id];
      if (lowest) lowestPossible += Number(lowest.totalPrice || 0);
    });

    const splitRaw: Record<string, { vendorId: string; vendorName: string; amount: number; items: number }> = {};
    prItems.forEach((item: any) => {
      const selectedQuotationId = selectedItems[item.id];
      if (!selectedQuotationId) return;
      const q = normalizedQuotations.find((x: any) => x.id === selectedQuotationId);
      const line = q?.items.find((x: any) => x.purchaseRequestItemId === item.id);
      if (!q || !line) return;
      if (!splitRaw[q.supplier.id]) {
        splitRaw[q.supplier.id] = {
          vendorId: q.supplier.id,
          vendorName: q.supplier.name,
          amount: 0,
          items: 0,
        };
      }
      splitRaw[q.supplier.id].amount += Number(line.totalPrice || 0);
      splitRaw[q.supplier.id].items += 1;
    });
    const split = Object.values(splitRaw)
      .map((v) => ({
        ...v,
        pct: totalAward > 0 ? (v.amount / totalAward) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const rfqValue = Number(rfq?.baselineTotal || rfq?.prTotalAmount || 0);
    return {
      totalAwardCost: totalAward,
      lowestPossibleCost: lowestPossible,
      rfqValue,
      splitByVendor: split,
      /** Tiết kiệm so với giá trị RFQ / ngân sách đề xuất (dương = rẻ hơn baseline). */
      savingsVsRfq: totalAward > 0 && rfqValue > 0 ? rfqValue - totalAward : 0,
      /** Chênh lệch so với mix NCC rẻ nhất từng dòng (âm = trao thầu đắt hơn tối ưu). */
      savingsVsOptimal: totalAward > 0 ? lowestPossible - totalAward : 0,
    };
  }, [prItems, selectedItems, normalizedQuotations, lowestByItem, rfq]);

  const exceptions = useMemo(() => {
    return prItems
      .map((item: any) => {
        const selectedQuotationId = selectedItems[item.id];
        if (!selectedQuotationId) {
          return {
            itemId: item.id,
            itemName: item.description,
            issue: 'Chưa chọn nhà cung cấp',
            action: 'Cần chọn NCC cho dòng trước khi phê duyệt',
            severity: 'critical' as const,
          };
        }
        const lowest = lowestByItem[item.id];
        const selectedQ = normalizedQuotations.find((q: any) => q.id === selectedQuotationId);
        const selectedLine = selectedQ?.items.find((x: any) => x.purchaseRequestItemId === item.id);
        if (!selectedLine || !lowest) return null;
        if (lowest.quotationId !== selectedQuotationId) {
          return {
            itemId: item.id,
            itemName: item.description,
            issue: 'Không chọn báo giá đơn giá thấp nhất',
            action: 'Giải thích trong mục Lý do phê duyệt (vì sao không chọn rẻ nhất)',
            severity: 'warning' as const,
          };
        }
        if (selectedQ?.leadDays > 20) {
          return {
            itemId: item.id,
            itemName: item.description,
            issue: 'Rủi ro lead time (> 20 ngày)',
            action: 'Rà soát lại thời gian giao / lý do chọn NCC này',
            severity: 'warning' as const,
          };
        }
        return null;
      })
      .filter(Boolean) as CompareAwardContextShape['exceptions'];
  }, [lowestByItem, normalizedQuotations, prItems, selectedItems]);

  /** Đề xuất hệ thống: chi phí tổng tối thiểu theo đơn giá từng dòng (không mutate lựa chọn). */
  const systemRecommendation = useMemo(() => {
    const selections = buildLowestCostSelectionMap(prItems, normalizedQuotations);
    const { totalAwardCost, splitByVendor } = awardSplitFromSelectionMap(
      prItems,
      normalizedQuotations,
      selections
    );
    const uncovered = prItems.filter((item: any) => !selections[item.id]).length;
    const hasPreferred = normalizedQuotations.some((q: any) => Number(q?.supplier?.rating) >= 4);
    const assignedLineCount = splitByVendor.reduce((s, v) => s + v.items, 0);
    return {
      selections,
      expectedCost: totalAwardCost,
      splitByVendor,
      uncovered,
      hasPreferred,
      assignedLineCount,
    };
  }, [prItems, normalizedQuotations]);

  /** NCC có ít nhất một báo giá trong RFQ — để gán cả PR cho một NCC. */
  const awardSuppliersDistinct = useMemo(() => {
    const seen = new Map<string, string>();
    normalizedQuotations.forEach((q: any) => {
      const id = q?.supplier?.id;
      const name = q?.supplier?.name;
      if (typeof id === 'string' && id && typeof name === 'string' && name && !seen.has(id)) {
        seen.set(id, name);
      }
    });
    return Array.from(seen, ([supplierId, name]) => ({ supplierId, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'vi')
    );
  }, [normalizedQuotations]);

  const singleVendorSelectOptions = useMemo(
    () =>
      awardSuppliersDistinct.map((s) => ({
        value: s.supplierId,
        label: s.name,
      })),
    [awardSuppliersDistinct]
  );

  /** Số liệu nhanh Buyer Leader hay xem — tách khỏi danh sách exceptions đầy đủ. */
  const exceptionQuickStats = useMemo(() => {
    let notLowestPrice = 0;
    const leadRiskVendorIds = new Set<string>();
    let unassigned = 0;
    prItems.forEach((item: any) => {
      const sel = selectedItems[item.id];
      if (!sel) {
        unassigned += 1;
        return;
      }
      const lowest = lowestByItem[item.id];
      if (lowest && lowest.quotationId !== sel) notLowestPrice += 1;
      const selectedQ = normalizedQuotations.find((q: any) => q.id === sel);
      if (selectedQ && Number(selectedQ.leadDays) > 20) {
        leadRiskVendorIds.add(selectedQ.supplier?.id || selectedQ.id);
      }
    });
    return {
      notLowestPrice,
      vendorLeadTimeRisk: leadRiskVendorIds.size,
      unassigned,
    };
  }, [lowestByItem, normalizedQuotations, prItems, selectedItems]);

  const optimizeMutation = useMutation({
    mutationFn: (mode: 'lowest_cost' | 'cost_plus_leadtime') =>
      buyerLeaderService.optimizeAwardStrategy({
        rfqId: rfqId || '',
        mode,
        selections: selectedItems,
      }),
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      buyerLeaderService.approveAwardDecision({
        rfqId: rfqId || '',
        selections: selectedItems,
        justification: justification.trim() || undefined,
      }),
    onSuccess: () => {
      showSuccess('Buyer Leader đã duyệt. Buyer có thể tiến hành tạo PO.');
      setApprovalMode(true);
    },
    onError: (e: any) => showError(e?.response?.data?.error || 'Duyệt thất bại'),
  });

  const optimizeAward = (mode: 'lowest_cost' | 'cost_plus_leadtime') => {
    const next: SelectionMap = {};
    prItems.forEach((item: any) => {
      const allCandidates = normalizedQuotations
        .map((q: any) => ({
          q,
          line: q.items.find((x: any) => x.purchaseRequestItemId === item.id),
        }))
        .filter((x: any) => x.line);
      if (!allCandidates.length) return;

      if (mode === 'lowest_cost') {
        const min = allCandidates.reduce((acc: any, curr: any) =>
          Number(curr.line.unitPrice) < Number(acc.line.unitPrice) ? curr : acc
        );
        next[item.id] = min.q.id;
      } else {
        const scored = allCandidates.map((x: any) => {
          const price = Number(x.line.unitPrice || 0);
          const lead = Number(x.q.leadDays || 999);
          return {
            qid: x.q.id,
            score: price * 0.75 + lead * 0.25,
          };
        });
        const minScore = scored.reduce((acc: any, curr: any) => (curr.score < acc.score ? curr : acc));
        next[item.id] = minScore.qid;
      }
    });
    setSelectedItems(next);
    optimizeMutation.mutate(mode);
    showSuccess(mode === 'lowest_cost' ? 'Đã áp dụng trao thầu chi phí thấp nhất' : 'Đã tối ưu chi phí + lead time');
  };

  /** Gán mọi dòng có báo giá sang NCC chỉ định (một quotation / dòng — ưu tiên đơn giá thấp nếu NCC có nhiều báo giá). */
  const assignSingleSupplierToAllLines = (supplierId: string) => {
    if (!supplierId || approvalMode) return;
    const next: SelectionMap = {};
    let covered = 0;
    let missing = 0;
    prItems.forEach((item: any) => {
      const withLine = normalizedQuotations.filter(
        (q: any) =>
          q?.supplier?.id === supplierId &&
          Array.isArray(q.items) &&
          q.items.some((l: any) => l.purchaseRequestItemId === item.id)
      );
      if (!withLine.length) {
        missing += 1;
        return;
      }
      const chosen = withLine.reduce((bestQ: any, q: any) => {
        const line = q.items.find((l: any) => l.purchaseRequestItemId === item.id);
        const bestLine = bestQ.items.find((l: any) => l.purchaseRequestItemId === item.id);
        return Number(line.unitPrice) < Number(bestLine.unitPrice) ? q : bestQ;
      }, withLine[0]);
      next[item.id] = chosen.id;
      covered += 1;
    });
    setSelectedItems(next);
    if (covered === 0) {
      showWarning('NCC này không có báo giá cho dòng nào trên PR.');
      return;
    }
    if (missing > 0) {
      showWarning(
        `Đã gán ${covered} dòng cho 1 NCC. ${missing} dòng không có báo giá từ NCC này — cần chọn NCC khác hoặc bổ sung báo giá.`
      );
    } else {
      showSuccess(`Đã gán toàn bộ ${covered} dòng cho một NCC (không chia nhiều nhà cung cấp).`);
    }
  };

  const validation = useMemo(() => {
    const allAwarded = prItems.length > 0 && prItems.every((item: any) => Boolean(selectedItems[item.id]));
    const noDuplicate = prItems.every((item: any) => {
      const selected = selectedItems[item.id];
      if (!selected) return true;
      const count = Object.entries(selectedItems).filter(([id, qid]) => id === item.id && qid === selected).length;
      return count <= 1;
    });
    const hasJustification = justification.trim().length >= 1;
    return { allAwarded, noDuplicate, hasJustification };
  }, [justification, prItems, selectedItems]);

  const animatedRfqValue = useAnimatedNumber(totals.rfqValue);
  const animatedLowest = useAnimatedNumber(totals.lowestPossibleCost);
  const animatedAward = useAnimatedNumber(totals.totalAwardCost);
  const hasRfqCompare = totals.rfqValue > 0 && totals.totalAwardCost > 0;
  const isOverVsRfq = hasRfqCompare && totals.savingsVsRfq < 0;
  const animatedRfqDeltaAbs = useAnimatedNumber(Math.abs(totals.savingsVsRfq));

  if (isLoading) {
    return <div className="flex min-h-[42vh] items-center justify-center text-slate-500">Đang tải không gian trao thầu...</div>;
  }
  if (isError || !rfq) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        {(error as any)?.message || 'Không tải được dữ liệu RFQ để award.'}
      </div>
    );
  }

  const context: CompareAwardContextShape = {
    rfq,
    quotations: normalizedQuotations,
    prItems,
    selectedItems,
    setSelectedItems,
    justification,
    setJustification,
    approvalMode,
    selectedCount,
    exceptions,
    totalAwardCost: totals.totalAwardCost,
    lowestPossibleCost: totals.lowestPossibleCost,
    rfqValue: totals.rfqValue,
    splitByVendor: totals.splitByVendor,
    optimizeAward,
  };

  const awardSuggestionsProps = {
    currency,
    currencyCompactVi,
    vendorNameInitials,
    systemRecommendation,
    baselineRfqValue: totals.rfqValue,
    approvalMode,
    optimizeAward,
  };

  const sidebarSavings = Math.max(0, totals.savingsVsRfq);
  const sidebarSavingsPct =
    totals.rfqValue > 0 && sidebarSavings > 0 ? (sidebarSavings / totals.rfqValue) * 100 : 0;

  const pickOptimizeMode = (mode: 'lowest_cost' | 'cost_plus_leadtime') => {
    setOptimizeMode(mode);
    if (!approvalMode) optimizeAward(mode);
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 px-2 pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+1rem))] pt-1 sm:px-3 sm:pb-10 lg:px-4">
      <section className="relative z-0 shrink-0 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white p-4 ring-1 ring-slate-950/[0.04] sm:p-5 md:p-6 lg:drop-shadow-[0_18px_40px_rgba(15,23,42,0.1)]">
        <div
          className="pointer-events-none absolute -bottom-28 left-[12%] z-0 h-44 w-[min(520px,80vw)] rounded-full bg-indigo-500/[0.07] blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 -top-16 z-0 h-48 w-48 rounded-full bg-gradient-to-bl from-violet-400/[0.14] via-indigo-400/[0.08] to-transparent blur-3xl"
          aria-hidden
        />

        <div className="relative z-10">
          <header className="border-b border-slate-100/95 pb-3 sm:pb-3.5 md:pb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Sourcing project</p>
            <p className="mt-1 truncate font-mono text-xs font-semibold text-indigo-700 sm:text-[0.8125rem]">
              {rfq?.rfqNumber}
            </p>
            <h1 className="mt-2 text-lg font-black tracking-tight text-slate-900 sm:text-xl lg:text-[1.4rem]">
              Quotation Comparison &amp; Awarding
            </h1>
            <p className="mt-1.5 max-w-3xl text-xs leading-snug text-slate-600 sm:text-[13px] sm:leading-relaxed">
              Đối chiếu báo giá và phân bổ NCC — đề xuất tối ưu và tab điều hướng nằm trên; bảng và khung phụ xếp một cột.
            </p>
          </header>

          <div className="mt-3.5 grid grid-cols-2 items-stretch gap-3 sm:mt-4 sm:gap-3.5 lg:mt-4 lg:grid-cols-5 lg:gap-3.5">
            <AwardWorkspaceMetricTile
              label="Giá trị đề xuất (PR)"
              value={currency(animatedRfqValue)}
              tone="indigo"
              icon={<Target strokeWidth={2.35} />}
            />
            <AwardWorkspaceMetricTile
              label="Chi phí thấp nhất khả thi"
              value={currency(animatedLowest)}
              tone="emerald"
              icon={<TrendingDown strokeWidth={2.35} />}
            />
            <AwardWorkspaceMetricTile
              label="Chi phí trao thầu hiện tại"
              value={currency(animatedAward)}
              tone="sky"
              icon={<DollarSign strokeWidth={2.35} />}
            />
            <AwardWorkspaceMetricTile
              label={isOverVsRfq ? 'Vượt' : 'Tiết kiệm'}
              value={hasRfqCompare ? currency(animatedRfqDeltaAbs) : '—'}
              tone={isOverVsRfq ? 'rose' : 'amber'}
              icon={
                isOverVsRfq ? (
                  <TrendingUp strokeWidth={2.35} />
                ) : (
                  <Sparkles strokeWidth={2.35} />
                )
              }
            />
            <AwardWorkspaceMetricTile
              label="Số NCC được chọn"
              value={`${totals.splitByVendor.length}`}
              tone="violet"
              icon={<Users strokeWidth={2.35} />}
              className="col-span-2 lg:col-span-1"
            />
          </div>
        </div>
      </section>

      <nav className="flex flex-wrap items-center gap-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50/95 via-white to-indigo-50/30 p-1.5 ring-1 ring-slate-950/[0.03]">
        {TAB_LINKS.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.key}
              to={tab.to}
              className={({ isActive }) =>
                [
                  'group relative inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all duration-200',
                  isActive
                    ? `bg-gradient-to-r ${tab.activeClass} text-white shadow-md shadow-slate-400/25 ring-2 ring-white/50`
                    : 'text-slate-600 hover:bg-white/90 hover:text-slate-900 hover:shadow-sm',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                      isActive ? 'bg-white/20 text-white backdrop-blur-[2px]' : 'bg-slate-200/70 text-slate-600 group-hover:bg-indigo-100/80 group-hover:text-indigo-700',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span className="hidden min-[420px]:inline">{tab.label}</span>
                  <span className="min-[420px]:hidden">{tab.label.split(' ')[0]}</span>
                  {tab.key === 'exceptions' && exceptions.length > 0 && (
                    <span
                      className={
                        isActive
                          ? 'rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-black text-white ring-1 ring-white/40'
                          : 'rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm'
                      }
                    >
                      {exceptions.length}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_288px] lg:gap-4">
        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Đề xuất tối ưu chi phí" className="min-w-0 shrink-0">
          <AwardSuggestionsPanel {...awardSuggestionsProps} />
        </section>

        <div className="flex min-h-[min(28rem,55vh)] min-w-0 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 ring-1 ring-indigo-100/50 lg:drop-shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
          <Outlet context={context} />
        </div>
        </div>

        <aside className="w-full min-w-0 self-start lg:sticky lg:top-3 lg:z-30 lg:isolate">
          <div className="flex flex-col gap-2.5 pb-2">
            <AwardAllocationSummary
              compact
              vendors={totals.splitByVendor}
              formatCurrency={(amt) => currency(amt)}
              savingsAmount={sidebarSavings}
              savingsPct={sidebarSavingsPct}
            />

            {(exceptionQuickStats.notLowestPrice > 0 ||
              exceptionQuickStats.vendorLeadTimeRisk > 0 ||
              exceptionQuickStats.unassigned > 0) ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-2 text-[11px] font-semibold text-amber-950">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">
                    {exceptionQuickStats.unassigned > 0
                      ? `${exceptionQuickStats.unassigned} dòng chưa chọn`
                      : `${exceptionQuickStats.notLowestPrice + exceptionQuickStats.vendorLeadTimeRisk} cảnh báo`}
                  </span>
                </span>
                <NavLink
                  to="exceptions"
                  className="shrink-0 font-bold text-amber-800 underline-offset-2 hover:underline"
                >
                  Chi tiết
                </NavLink>
              </div>
            ) : null}

            <div className="rounded-xl drop-shadow-[0_16px_40px_-12px_rgba(15,23,42,0.28)]">
              <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white ring-1 ring-slate-200/80">
              <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/20 ring-1 ring-emerald-400/35">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.35} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.1em] text-emerald-400">
                    Quyết định phê duyệt
                  </p>
                  <p className="text-[10px] leading-snug text-slate-400">Nhập lý do trước khi duyệt</p>
                </div>
              </div>

              <div className="space-y-2.5 p-2.5 pb-3">
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Gán nhanh một NCC cho cả PR
                </p>
                <div className="flex gap-1.5">
                  <CustomSelect
                    value={singleVendorSupplierId}
                    onValueChange={setSingleVendorSupplierId}
                    options={singleVendorSelectOptions}
                    placeholder="Chọn NCC…"
                    disabled={approvalMode || awardSuppliersDistinct.length === 0}
                    enableDropdownSearch
                    dropdownSearchPlaceholder="Lọc tên NCC…"
                    className="min-w-0 flex-1 !rounded-lg !border-slate-200 !py-2 !text-xs !shadow-sm focus:!border-emerald-500 focus:!ring-emerald-500/20"
                    dropdownClassName="!rounded-xl !shadow-lg"
                  />
                  <button
                    type="button"
                    disabled={approvalMode || !singleVendorSupplierId}
                    onClick={() => assignSingleSupplierToAllLines(singleVendorSupplierId)}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-45"
                    title="Gán toàn bộ dòng đã có báo giá của NCC đã chọn"
                  >
                    <BadgeCheck className="h-4 w-4" aria-hidden />
                    Áp dụng
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Tiêu chí ưu tiên đề xuất
                </p>
                <div
                  className="grid grid-cols-2 gap-1.5"
                  role="radiogroup"
                  aria-label="Tiêu chí ưu tiên đề xuất"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={optimizeMode === 'lowest_cost'}
                    disabled={approvalMode}
                    onClick={() => pickOptimizeMode('lowest_cost')}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-1.5 py-1.5 text-[10px] font-bold leading-tight transition ${
                      optimizeMode === 'lowest_cost'
                        ? 'border-violet-500 bg-violet-50 text-violet-900 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Tag className="h-4 w-4" aria-hidden />
                    Giá thấp nhất
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={optimizeMode === 'cost_plus_leadtime'}
                    disabled={approvalMode}
                    onClick={() => pickOptimizeMode('cost_plus_leadtime')}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-1.5 py-1.5 text-[10px] font-bold leading-tight transition ${
                      optimizeMode === 'cost_plus_leadtime'
                        ? 'border-violet-500 bg-violet-50 text-violet-900 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Clock className="h-4 w-4" aria-hidden />
                    Chi phí + Leadtime
                  </button>
                </div>

                <label className="mt-3 flex text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  Lý do phê duyệt
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  disabled={approvalMode}
                  rows={3}
                  placeholder="Đã áp dụng phương án tối ưu…"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-2 text-xs leading-snug text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:bg-slate-100"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Check validation={validation.allAwarded} label="đủ dòng" />
                <Check validation={validation.hasJustification} label="có lý do" />
                <Check validation={validation.noDuplicate} label="không trùng" />
              </div>

              <div className="space-y-2">
                {!approvalMode ? (
                  <>
                    <button
                      type="button"
                      className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-105 disabled:opacity-55"
                      disabled={!validation.allAwarded || approveMutation.isPending}
                      onClick={() => approveMutation.mutate()}
                    >
                      <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                      Phê duyệt trao thầu
                    </button>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        className="flex min-h-[36px] items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        onClick={() => showSuccess('Đã lưu nháp local')}
                      >
                        <Save className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                        Lưu nháp
                      </button>
                      <button
                        type="button"
                        className="flex min-h-[36px] items-center justify-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-2 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-50"
                        onClick={() => navigate('/dashboard/buyer-leader/compare-queue')}
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden />
                        Trả yêu cầu
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-emerald-200/80 bg-emerald-50 px-3 py-2.5 text-sm font-medium leading-snug text-emerald-900">
                    Đã duyệt. Buyer sẽ tạo PO ở bước sau.
                  </div>
                )}
              </div>
              </div>
            </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const Check = ({ validation, label }: { validation: boolean; label: string }) => (
  <span
    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
      validation ? 'bg-emerald-100/90 text-emerald-900 ring-1 ring-emerald-200/70' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200/80'
    }`}
  >
    <CheckCircle2
      className={`h-3.5 w-3.5 shrink-0 ${validation ? 'text-emerald-600' : 'text-slate-400'}`}
      strokeWidth={2.5}
      aria-hidden
    />
    {label}
  </span>
);

const EXCEPTIONS_TABLE_ROWS_VISIBLE = 10;
const exceptionsTableMaxHeight = `calc(2.5rem + ${EXCEPTIONS_TABLE_ROWS_VISIBLE} * 3.25rem)`;

export const CompareAwardTabCompare = () => {
  const { prItems, quotations, selectedItems, setSelectedItems, approvalMode } =
    useOutletContext<CompareAwardContextShape>();
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(
    () =>
      prItems.filter((item: any) =>
        item.description?.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [prItems, search]
  );

  return (
    <AwardCompareItemCards
      items={filteredItems}
      quotations={quotations}
      selectedItems={selectedItems}
      setSelectedItems={setSelectedItems}
      approvalMode={approvalMode}
      currency={currency}
      parseLead={parseLead}
      search={search}
      onSearchChange={setSearch}
    />
  );
};

export const CompareAwardTabAllocation = () => {
  const { splitByVendor, prItems, selectedItems, setSelectedItems, approvalMode } =
    useOutletContext<CompareAwardContextShape>();
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);

  const itemByVendor = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    prItems.forEach((item: any) => {
      const qid = selectedItems[item.id];
      if (!qid) return;
      if (!grouped[qid]) grouped[qid] = [];
      grouped[qid].push(item);
    });
    return grouped;
  }, [prItems, selectedItems]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {splitByVendor.map((v) => (
        <div
          key={v.vendorId}
          className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (!draggingItemId || approvalMode) return;
            setSelectedItems((prev) => ({ ...prev, [draggingItemId]: v.vendorId }));
            setDraggingItemId(null);
          }}
        >
          <h3 className="font-bold text-slate-900">{v.vendorName}</h3>
          <p className="text-xs text-slate-500">Tạm tính: {currency(v.amount)}</p>
          <div className="mt-2 space-y-2">
            {(itemByVendor[v.vendorId] || []).map((item) => (
              <div
                key={item.id}
                draggable={!approvalMode}
                onDragStart={() => setDraggingItemId(item.id)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                {item.description}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const CompareAwardTabExceptions = () => {
  const { exceptions } = useOutletContext<CompareAwardContextShape>();
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm ring-1 ring-slate-950/[0.04]">
      <div
        className="min-h-0 overflow-auto [scrollbar-width:thin]"
        style={{ maxHeight: exceptionsTableMaxHeight }}
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Dòng hàng</th>
              <th className="px-3 py-2 text-left">Vấn đề</th>
              <th className="px-3 py-2 text-left">Hành động đề xuất</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {exceptions.map((x) => (
              <tr key={x.itemId}>
                <td className="px-3 py-2 font-medium text-slate-900">{x.itemName}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      x.severity === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {x.issue}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">{x.action}</td>
              </tr>
            ))}
            {exceptions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-sm text-slate-500">
                  Không có ngoại lệ.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const CompareAwardTabVendorHistory = () => {
  const { splitByVendor } = useOutletContext<CompareAwardContextShape>();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {splitByVendor.map((v) => (
        <div key={v.vendorId} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <h3 className="font-bold text-slate-900">{v.vendorName}</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4" aria-hidden />
              Giao đúng hạn: 93%
            </li>
            <li className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" aria-hidden />
              PO gần nhất: ~1,2 tr / dòng
            </li>
            <li className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Rủi ro chất lượng: Thấp
            </li>
          </ul>
        </div>
      ))}
    </div>
  );
};

export default CompareAwardWorkspace;
