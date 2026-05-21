import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  FileQuestion, Clock, AlertCircle, CheckCircle2, User, Building2,
  DollarSign, Calendar, Eye, Package, TrendingUp, AlertTriangle,
  Info, RefreshCw, Bell, ArrowUpCircle, UserCog, Timer, BarChart2,
  Zap, ChevronDown, ChevronUp,
  Send,
} from 'lucide-react';
import { buyerLeaderService } from '../../services/buyerLeaderService';
import { useToast } from '../../contexts/ToastContext';
import { AppModal } from '../../components/AppModal';
import { BuyerLeaderPageHero } from '../../components/BuyerLeaderPageHero';
import { buyerLeaderPageStackClass } from '../../constants/buyerLeaderLayout';

// ─── Formatters ──────────────────────────────────────────────────────────────
const fmt = (amount: number | null, currency = 'VND') => {
  if (!amount) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount);
};

const fmtShort = (amount: number | null) => {
  if (!amount) return '—';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(0)}M`;
  return `${(amount / 1_000).toFixed(0)}K`;
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface RFQData {
  id: string;
  rfqNumber: string;
  prNumber: string;
  prId: string;
  department: string | null;
  prStatus: string;
  status: string;
  buyer: { id: string; username: string; email: string };
  quotationsCount: number;
  quotations: Array<{ id: string; supplierName: string; totalAmount: number; status: string; receivedDate: string }>;
  sentDate: string | null;
  daysSinceSent: number | null;
  deadlineDate: string | null;
  daysLeft: number | null;
  daysOverdue: number;
  isOverdue: boolean;
  isWaitingQuotations: boolean;
  notes: string | null;
  itemCount?: number;
  hasOverBaseline?: boolean;
  prTotalAmount: number | null;
  prCurrency: string;
  daysPRtoRFQ: number | null;
  daysRFQtoSubmit: number | null;
  createdAt: string;
  updatedAt: string;
}

type RFQFilter = 'all' | 'draft_in_progress' | 'submitted' | 'overdue';

/** PR đã đi qua bước chọn NCC (không còn chờ duyệt tại màn RFQ monitoring). */
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

// ─── Value tier helper ────────────────────────────────────────────────────────
const getValueTier = (amount: number | null) => {
  if (!amount) return { label: '—', color: 'text-slate-400', bg: 'bg-slate-100' };
  if (amount >= 1_000_000_000) return { label: 'CAO', color: 'text-red-700', bg: 'bg-red-100' };
  if (amount >= 100_000_000)   return { label: 'VỪA', color: 'text-amber-700', bg: 'bg-amber-100' };
  return { label: 'THẤP', color: 'text-green-700', bg: 'bg-green-100' };
};

// ─── Deadline cell helper ─────────────────────────────────────────────────────
const DeadlineCell = ({ rfq }: { rfq: RFQData }) => {
  if (rfq.status === 'READY_FOR_COMPARISON' || rfq.status === 'CLOSED') {
    return <span className="text-xs text-slate-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" strokeWidth={2} />Hoàn thành</span>;
  }
  if (rfq.status === 'DRAFT') {
    return <span className="text-xs text-slate-400">Chưa gửi</span>;
  }
  if (rfq.isOverdue) {
    return (
      <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" strokeWidth={2} />
          Quá hạn {rfq.daysOverdue} ngày
        </span>
        <span className="text-[10px] text-red-400">{fmtDate(rfq.deadlineDate)}</span>
      </div>
    );
  }
  if (rfq.daysLeft !== null) {
    const isUrgent = rfq.daysLeft <= 2;
    return (
      <div className="flex flex-col gap-0.5">
        <span className={`text-xs font-semibold flex items-center gap-1 ${isUrgent ? 'text-amber-600' : 'text-slate-600'}`}>
          <Clock className="w-3.5 h-3.5" strokeWidth={2} />
          Còn {rfq.daysLeft} ngày
        </span>
        <span className="text-[10px] text-slate-400">{fmtDate(rfq.deadlineDate)}</span>
      </div>
    );
  }
  return <span className="text-xs text-slate-400">{fmtDate(rfq.deadlineDate)}</span>;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const RFQMonitoring = () => {
  const [filter, setFilter] = useState<RFQFilter>('all');
  const [selectedRFQ, setSelectedRFQ] = useState<RFQData | null>(null);
  const [showBuyerPerf, setShowBuyerPerf] = useState(true);
  const [escalateModal, setEscalateModal] = useState<RFQData | null>(null);
  const [escalateReason, setEscalateReason] = useState('');
  const { showSuccess, showError } = useToast();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['buyer-leader-rfq-monitoring', 'all'],
    queryFn: () => buyerLeaderService.getRFQMonitoring('all'),
    refetchInterval: 30000,
    staleTime: 0,
  });

  const remindMutation = useMutation({
    mutationFn: (rfqId: string) => buyerLeaderService.remindBuyerRFQ(rfqId),
    onSuccess: (_, rfqId) => {
      const rfq = allRFQs.find(r => r.id === rfqId);
      showSuccess(`Đã gửi nhắc nhở tới ${rfq?.buyer.username || 'Buyer'}`);
    },
    onError: () => showError('Không thể gửi nhắc nhở'),
  });

  const escalateMutation = useMutation({
    mutationFn: ({ rfqId, reason }: { rfqId: string; reason: string }) =>
      buyerLeaderService.escalateRFQ(rfqId, reason),
    onSuccess: () => {
      showSuccess('Đã escalate tới Buyer Manager');
      setEscalateModal(null);
      setEscalateReason('');
    },
    onError: () => showError('Không thể escalate'),
  });

  const allRFQs = (data?.rfqs || []) as RFQData[];

  // ── Filter ──────────────────────────────────────────────────────────────────
  const rfqs = useMemo(() => allRFQs.filter((rfq) => {
    if (filter === 'draft_in_progress') return rfq.status === 'DRAFT' || (rfq.status === 'SENT' && !rfq.isOverdue);
    if (filter === 'submitted') return rfq.status === 'READY_FOR_COMPARISON' || rfq.status === 'QUOTATION_RECEIVED';
    if (filter === 'overdue') return rfq.isOverdue;
    return true;
  }), [allRFQs, filter]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = allRFQs.length;
    const inProgress = allRFQs.filter(r => r.status === 'DRAFT' || (r.status === 'SENT' && !r.isOverdue)).length;
    const submitted = allRFQs.filter(r => r.status === 'READY_FOR_COMPARISON' || r.status === 'QUOTATION_RECEIVED').length;
    const overdue = allRFQs.filter(r => r.isOverdue).length;

    const donePRtoRFQ  = allRFQs.filter(r => r.daysPRtoRFQ !== null).map(r => r.daysPRtoRFQ as number);
    const doneRFQSubmit = allRFQs.filter(r => r.daysRFQtoSubmit !== null).map(r => r.daysRFQtoSubmit as number);
    const avgPRtoRFQ   = donePRtoRFQ.length  ? Math.round(donePRtoRFQ.reduce((a, b) => a + b, 0)  / donePRtoRFQ.length)  : null;
    const avgRFQSubmit = doneRFQSubmit.length ? Math.round(doneRFQSubmit.reduce((a, b) => a + b, 0) / doneRFQSubmit.length) : null;

    return { total, inProgress, submitted, overdue, avgPRtoRFQ, avgRFQSubmit };
  }, [allRFQs]);

  // ── Buyer Performance ────────────────────────────────────────────────────────
  const buyerPerf = useMemo(() => {
    const map: Record<string, { username: string; open: number; overdue: number; submitTimes: number[] }> = {};
    allRFQs.forEach(r => {
      const u = r.buyer.username;
      if (!map[u]) map[u] = { username: u, open: 0, overdue: 0, submitTimes: [] };
      if (r.status !== 'READY_FOR_COMPARISON' && r.status !== 'CLOSED') map[u].open++;
      if (r.isOverdue) map[u].overdue++;
      if (r.daysRFQtoSubmit !== null) map[u].submitTimes.push(r.daysRFQtoSubmit);
    });
    return Object.values(map).sort((a, b) => b.overdue - a.overdue || b.open - a.open);
  }, [allRFQs]);

  // ── RFQ status display ───────────────────────────────────────────────────────
  const getRFQStatus = (rfq: RFQData) => {
    if (PR_STATUS_AFTER_AWARD.has(rfq.prStatus)) {
      return { label: 'Đã chọn NCC', color: 'text-emerald-700', bg: 'bg-emerald-100' };
    }
    if (rfq.isOverdue) return { label: 'Quá hạn', color: 'text-red-700', bg: 'bg-red-100' };
    if (rfq.status === 'DRAFT') return { label: 'Nháp', color: 'text-slate-600', bg: 'bg-slate-100' };
    if (rfq.status === 'READY_FOR_COMPARISON' || rfq.status === 'QUOTATION_RECEIVED') return { label: 'Chờ duyệt', color: 'text-green-700', bg: 'bg-green-100' };
    return { label: 'Đang làm', color: 'text-blue-700', bg: 'bg-blue-100' };
  };

  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className={`w-full min-w-0 bg-gradient-to-b from-indigo-50/30 to-slate-50 ${buyerLeaderPageStackClass}`}>
      <div className="w-full min-w-0 animate-pulse space-y-4 px-2 py-3 sm:px-3 sm:py-4 md:px-4">
        <div className="h-16 bg-slate-200 rounded-2xl w-64" />
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-slate-200 rounded-xl" />)}</div>
        <div className="h-96 bg-slate-200 rounded-xl" />
      </div>
    </div>
  );

  if (error) return (
    <div className={`w-full min-w-0 ${buyerLeaderPageStackClass}`}>
      <div className="px-2 py-3 sm:px-3 sm:py-4 md:px-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700 font-medium">Lỗi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại'}</p>
        </div>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className={`w-full min-w-0 animate-fade-in-right fade-in-right-delay-0 ${buyerLeaderPageStackClass}`}
    >
      {/* Một luồng cuộn duy nhất: main dashboard (contentScrollRef) — không flex + overflow-y lồng */}
      <div className="space-y-4 px-2 pb-6 pt-3 sm:px-3 sm:pb-8 sm:pt-4 md:px-4">
      <BuyerLeaderPageHero
        kicker="Buyer Leader · RFQ"
        title="Giám sát RFQ"
        description="Hạn chót · giá trị · hiệu suất Buyer · thao tác"
        Icon={FileQuestion}
        tint="azure"
        regionLabel="Giám sát RFQ"
        rightSlot={
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/35 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} strokeWidth={2} />
            Làm mới
          </button>
        }
      />

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Tổng RFQ',       value: stats.total,      color: 'text-slate-900',    bg: 'from-slate-50 to-slate-100',   icon: FileQuestion, iconC: 'text-indigo-500' },
            { label: 'Đang làm',        value: stats.inProgress, color: 'text-blue-700',     bg: 'from-blue-50 to-cyan-50',      icon: Clock,         iconC: 'text-blue-500' },
            { label: 'Đã submit',       value: stats.submitted,  color: 'text-green-700',    bg: 'from-green-50 to-emerald-50',  icon: CheckCircle2,  iconC: 'text-green-500' },
            { label: 'Quá hạn',         value: stats.overdue,    color: 'text-red-700',      bg: 'from-red-50 to-rose-50',       icon: AlertCircle,   iconC: 'text-red-500', urgent: stats.overdue > 0 },
            { label: 'TB PR→RFQ',      value: stats.avgPRtoRFQ !== null ? `${stats.avgPRtoRFQ} ngày` : '—', color: 'text-amber-700', bg: 'from-amber-50 to-yellow-50', icon: Timer, iconC: 'text-amber-500' },
            { label: 'TB RFQ→Nộp',  value: stats.avgRFQSubmit !== null ? `${stats.avgRFQSubmit} ngày` : '—', color: 'text-purple-700', bg: 'from-purple-50 to-violet-50', icon: BarChart2, iconC: 'text-purple-500' },
          ].map((k) => (
            <div key={k.label} className={`bg-gradient-to-br ${k.bg} rounded-xl p-4 border ${k.urgent ? 'border-red-300 shadow-red-100 shadow-md' : 'border-slate-200/80'} hover:shadow-md transition-shadow`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500 font-medium">{k.label}</p>
                <k.icon className={`w-4 h-4 ${k.iconC}`} strokeWidth={2} />
              </div>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* ── Buyer Performance ── */}
        {buyerPerf.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
              onClick={() => setShowBuyerPerf(v => !v)}
            >
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-600" strokeWidth={2} />
                <span className="font-semibold text-slate-800 text-sm">Hiệu suất theo Buyer</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{buyerPerf.length} buyer</span>
              </div>
              {showBuyerPerf ? <ChevronUp className="w-4 h-4 text-slate-400" strokeWidth={2} /> : <ChevronDown className="w-4 h-4 text-slate-400" strokeWidth={2} />}
            </button>
            {showBuyerPerf && (
              <div className="overflow-x-auto border-t border-slate-100">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Người phụ trách', 'RFQ đang mở', 'Quá hạn', 'TB Thời gửi', 'Tình trạng'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {buyerPerf.map((b) => {
                      const avgSubmit = b.submitTimes.length
                        ? Math.round(b.submitTimes.reduce((a, c) => a + c, 0) / b.submitTimes.length)
                        : null;
                      const health = b.overdue > 0 ? 'red' : b.open > 3 ? 'amber' : 'green';
                      return (
                        <tr key={b.username} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold">
                                {b.username[0].toUpperCase()}
                              </div>
                              <span className="font-semibold text-slate-800">{b.username}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-bold text-slate-800">{b.open}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            {b.overdue > 0
                              ? <span className="flex items-center gap-1 text-red-600 font-bold"><AlertCircle className="w-3.5 h-3.5" strokeWidth={2} />{b.overdue}</span>
                              : <span className="text-slate-400">0</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            {avgSubmit !== null
                              ? <span className={`font-medium ${avgSubmit > 10 ? 'text-red-600' : avgSubmit > 5 ? 'text-amber-600' : 'text-green-600'}`}>{avgSubmit} ngày</span>
                              : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              health === 'red' ? 'bg-red-100 text-red-700' :
                              health === 'amber' ? 'bg-amber-100 text-amber-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {health === 'red' ? '⚠ Cần hỗ trợ' : health === 'amber' ? '⏳ Nhiều việc' : '✓ Ổn'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Filter Tabs ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-3">
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'all',              label: 'Tất cả',    count: stats.total },
              { key: 'draft_in_progress',label: 'Đang làm',  count: stats.inProgress },
              { key: 'submitted',        label: 'Đã submit', count: stats.submitted },
              { key: 'overdue',          label: 'Quá hạn',   count: stats.overdue },
            ] as Array<{ key: RFQFilter; label: string; count: number }>).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  filter === f.key
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs ${filter === f.key ? 'bg-white/25' : 'bg-slate-200'}`}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── RFQ Table ── */}
        {rfqs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
            <FileQuestion className="w-14 h-14 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-slate-500 font-medium">Không có RFQ nào</p>
          </div>
        ) : (
          <div className="bg-white rounded-[28px] border border-black/5 shadow-[0_8px_14px_-8px_rgba(0,0,0,0.15)] overflow-hidden">
            <div className="overflow-x-auto [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] [&::-webkit-scrollbar]:h-[6px] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 [&::-webkit-scrollbar-track]:bg-transparent">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200">
                    {['Mã RFQ', 'PR', 'Người phụ trách', 'Giá trị PR', 'Items / Báo giá', 'Trạng thái', 'Hạn chót', 'Cảnh báo', 'Thao tác'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rfqs.map((rfq) => {
                    const st = getRFQStatus(rfq);
                    const tier = getValueTier(rfq.prTotalAmount);
                    const warnings: string[] = [];
                    if (rfq.isOverdue) warnings.push('Quá hạn');
                    if (rfq.hasOverBaseline) warnings.push('Vượt baseline');
                    if (rfq.isWaitingQuotations) warnings.push(`${rfq.quotationsCount}/3 BG`);
                    if ((rfq.status === 'DRAFT' || (rfq.status === 'SENT' && rfq.daysSinceSent !== null && rfq.daysSinceSent > 5)) && !rfq.isOverdue)
                      warnings.push('Chưa submit');

                    return (
                      <tr key={rfq.id} className={`hover:bg-slate-50/60 transition-colors ${rfq.isOverdue ? 'bg-red-50/20' : ''}`}>
                        {/* RFQ Number */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-indigo-700 text-xs">{rfq.rfqNumber}</span>
                        </td>

                        {/* PR */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="text-xs font-medium text-slate-700">{rfq.prNumber}</div>
                          {rfq.department && <div className="text-[10px] text-slate-400">{rfq.department}</div>}
                        </td>

                        {/* Buyer */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                              {rfq.buyer.username[0].toUpperCase()}
                            </div>
                            <span className="text-xs font-medium text-slate-800">{rfq.buyer.username}</span>
                          </div>
                        </td>

                        {/* PR Value */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tier.bg} ${tier.color} w-fit`}>{tier.label}</span>
                            <span className="text-[10px] text-slate-500 font-medium">{fmtShort(rfq.prTotalAmount)}</span>
                          </div>
                        </td>

                        {/* Items / Quotations */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <Package className="w-3.5 h-3.5 text-slate-400" strokeWidth={2} />
                            <span>{rfq.itemCount || '—'}</span>
                            <span className="text-slate-300 mx-0.5">|</span>
                            <span className={`font-semibold ${rfq.quotationsCount >= 3 ? 'text-green-600' : rfq.quotationsCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                              {rfq.quotationsCount}/3
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.bg} ${st.color}`}>{st.label}</span>
                        </td>

                        {/* Deadline */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <DeadlineCell rfq={rfq} />
                        </td>

                        {/* Warnings */}
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-0.5">
                            {warnings.length === 0
                              ? <span className="text-xs text-slate-300">—</span>
                              : warnings.map((w, i) => (
                                <span key={i} className={`text-[10px] font-semibold flex items-center gap-1 ${
                                  w.includes('Quá hạn') || w.includes('baseline') ? 'text-red-600' :
                                  w.includes('submit') ? 'text-orange-600' : 'text-amber-600'
                                }`}>
                                  <AlertTriangle className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
                                  {w}
                                </span>
                              ))
                            }
                          </div>
                        </td>

                        {/* Quick Actions */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setSelectedRFQ(rfq)}
                              title="Xem chi tiết"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                            <button
                              onClick={() => remindMutation.mutate(rfq.id)}
                              disabled={remindMutation.isPending}
                              title="Nhắc nhở Buyer"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition-colors disabled:opacity-40"
                            >
                              <Bell className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                            <button
                              onClick={() => { setEscalateModal(rfq); setEscalateReason(''); }}
                              title="Escalate lên Buyer Manager"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                            >
                              <ArrowUpCircle className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                            <button
                              title="Reassign Buyer (sắp có)"
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-green-50 hover:text-green-600 transition-colors opacity-50 cursor-not-allowed"
                              disabled
                            >
                              <UserCog className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
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
      </div>

      {/* ── Modal chi tiết RFQ ── */}
      <AppModal
        open={!!selectedRFQ}
        onClose={() => setSelectedRFQ(null)}
        size="full"
        zIndexClass="z-[200]"
        description="Chi tiết giám sát RFQ"
        headerIcon={<FileQuestion className="h-5 w-5 text-indigo-600" strokeWidth={2} />}
        className="!rounded-[28px]"
        title={
          selectedRFQ ? (
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="font-semibold">{selectedRFQ.rfqNumber}</span>
              {(() => {
                const st = getRFQStatus(selectedRFQ);
                return (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm ${st.bg} ${st.color}`}>
                    {st.label}
                  </span>
                );
              })()}
            </span>
          ) : (
            ''
          )
        }
        subtitle={
          selectedRFQ ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
              <span>
                PR <span className="font-medium text-slate-700">{selectedRFQ.prNumber}</span>
              </span>
              <span className="hidden sm:inline text-slate-300" aria-hidden>
                ·
              </span>
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400" strokeWidth={2} />
                <span className="font-medium text-slate-700">{selectedRFQ.buyer.username}</span>
              </span>
              {selectedRFQ.department && (
                <>
                  <span className="hidden sm:inline text-slate-300" aria-hidden>
                    ·
                  </span>
                  <span>{selectedRFQ.department}</span>
                </>
              )}
            </span>
          ) : undefined
        }
        footer={
          selectedRFQ ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Gửi nhắc sẽ thông báo Buyer phụ trách RFQ trên luồng hệ thống.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => remindMutation.mutate(selectedRFQ.id)}
                  disabled={remindMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-200/95 bg-gradient-to-b from-amber-50 to-amber-100/70 px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-sm shadow-amber-200/40 transition hover:border-amber-300 hover:brightness-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Bell className="h-4 w-4 shrink-0" strokeWidth={2} />
                  Nhắc nhở Buyer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEscalateModal(selectedRFQ);
                    setSelectedRFQ(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-red-200/95 bg-gradient-to-b from-red-50 to-rose-50 px-4 py-2.5 text-sm font-semibold text-red-900 shadow-sm shadow-red-200/35 transition hover:border-red-300 hover:brightness-[1.02]"
                >
                  <ArrowUpCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
                  Escalate lên Manager
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {selectedRFQ ? (
          <div className="space-y-6">
            {/* Snapshot tiền + tier */}
            {(() => {
              const tier = getValueTier(selectedRFQ.prTotalAmount);
              return (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200/85 bg-gradient-to-br from-[#F8FAFC] via-white to-indigo-50/40 px-5 py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85)] ring-1 ring-indigo-100/50 sm:flex sm:items-center sm:justify-between sm:gap-6">
                  <span
                    className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400/70 via-indigo-500/50 to-transparent"
                    aria-hidden
                  />
                  <div className="relative min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Giá trị PR · giám sát</p>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                      <span className="break-all text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-[1.75rem]">
                        {fmt(selectedRFQ.prTotalAmount, selectedRFQ.prCurrency)}
                      </span>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border border-white/70 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide shadow-sm ring-2 ring-white/80 ${tier.bg} ${tier.color}`}
                      >
                        {tier.label}
                      </span>
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                      <span>Tóm gọn: {fmtShort(selectedRFQ.prTotalAmount)}</span>
                      <span className="hidden text-slate-300 sm:inline" aria-hidden>
                        ·
                      </span>
                      <span>Đơn vị: {selectedRFQ.prCurrency}</span>
                    </p>
                  </div>
                  <div className="relative mt-5 flex shrink-0 items-center gap-3 border-t border-slate-200/70 pt-4 sm:mt-0 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-bold text-indigo-700 shadow-inner shadow-slate-200/70 ring-2 ring-indigo-100">
                      {(selectedRFQ.buyer.username[0] || '?').toUpperCase()}
                    </div>
                    <div className="min-w-0 text-sm leading-snug">
                      <p className="truncate font-semibold text-slate-900">{selectedRFQ.buyer.username}</p>
                      <p className="mt-1 text-xs text-slate-500">{selectedRFQ.buyer.email || '—'}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div>
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Chỉ số nhanh</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  {
                    accent: 'from-emerald-500/14 to-transparent',
                    iconBg: 'bg-emerald-100 text-emerald-700 ring-emerald-200/80',
                    icon: Package,
                    label: 'Items / báo giá',
                    value: `${selectedRFQ.itemCount ?? '—'} / ${selectedRFQ.quotationsCount}`,
                    color: 'text-slate-900',
                  },
                  {
                    accent: 'from-rose-400/14 to-transparent',
                    iconBg: selectedRFQ.hasOverBaseline
                      ? 'bg-rose-100 text-rose-800 ring-rose-200/75'
                      : 'bg-green-100 text-green-800 ring-green-200/75',
                    icon: TrendingUp,
                    label: 'So với baseline',
                    value: selectedRFQ.hasOverBaseline ? 'Vượt' : 'Bình thường',
                    color: selectedRFQ.hasOverBaseline ? 'text-rose-700' : 'text-emerald-700',
                  },
                  {
                    accent: 'from-blue-400/14 to-transparent',
                    iconBg: 'bg-blue-100 text-blue-800 ring-blue-200/75',
                    icon: Calendar,
                    label: 'Hạn RFQ',
                    value: fmtDate(selectedRFQ.deadlineDate),
                    color:
                      selectedRFQ.isOverdue
                        ? 'text-red-700'
                        : selectedRFQ.daysLeft !== null && selectedRFQ.daysLeft <= 2
                          ? 'text-amber-700'
                          : 'text-slate-800',
                  },
                  {
                    accent: selectedRFQ.isOverdue
                      ? 'from-red-400/14 to-transparent'
                      : 'from-slate-400/10 to-transparent',
                    iconBg: selectedRFQ.isOverdue
                      ? 'bg-red-100 text-red-900 ring-red-200/75'
                      : 'bg-slate-100 text-slate-700 ring-slate-200/80',
                    icon: Clock,
                    label: selectedRFQ.isOverdue ? 'Trạng thái hạn' : 'Còn lại',
                    value: selectedRFQ.isOverdue
                      ? `Trễ ${selectedRFQ.daysOverdue} ngày`
                      : selectedRFQ.daysLeft !== null
                        ? `${selectedRFQ.daysLeft} ngày`
                        : '—',
                    color: selectedRFQ.isOverdue ? 'text-red-700' : 'text-slate-800',
                  },
                  {
                    accent: 'from-amber-400/14 to-transparent',
                    iconBg: 'bg-amber-100 text-amber-900 ring-amber-200/75',
                    icon: Timer,
                    label: 'PR → RFQ',
                    value: selectedRFQ.daysPRtoRFQ !== null ? `${selectedRFQ.daysPRtoRFQ} ngày` : '—',
                    color: 'text-slate-800',
                  },
                  {
                    accent: 'from-violet-400/14 to-transparent',
                    iconBg: 'bg-violet-100 text-violet-900 ring-violet-200/75',
                    icon: Zap,
                    label: 'RFQ → Nộp',
                    value:
                      selectedRFQ.daysRFQtoSubmit !== null ? `${selectedRFQ.daysRFQtoSubmit} ngày` : '—',
                    color: 'text-slate-800',
                  },
                  {
                    accent: 'from-sky-400/14 to-transparent',
                    iconBg: 'bg-sky-100 text-sky-900 ring-sky-200/75',
                    icon: Building2,
                    label: 'Phòng ban',
                    value: selectedRFQ.department || '—',
                    color: 'text-slate-800',
                  },
                  {
                    accent: 'from-teal-400/14 to-transparent',
                    iconBg: 'bg-teal-100 text-teal-900 ring-teal-200/75',
                    icon: Send,
                    label: 'Ngày gửi RFQ',
                    value: fmtDate(selectedRFQ.sentDate),
                    color: 'text-slate-800',
                  },
                ].map(({ icon: Icon, label, value, color, accent, iconBg }) => (
                  <div
                    key={label}
                    className={`relative overflow-hidden rounded-2xl border border-slate-200/85 bg-gradient-to-br ${accent} from-white to-slate-50/96 p-3.5 shadow-sm ring-1 ring-slate-200/35 transition hover:border-slate-300/95 hover:shadow-md`}
                  >
                    <div className="relative flex items-start gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-2 ring-white/80 ${iconBg}`}
                      >
                        <Icon className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {label}
                        </span>
                        <p className={`mt-1 text-sm font-semibold leading-snug tracking-tight ${color}`}>{value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-1 shadow-inner shadow-slate-200/40 ring-1 ring-slate-200/30">
              <div className="rounded-xl border border-slate-100/95 bg-gradient-to-br from-white to-slate-50/95 p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 shadow-lg shadow-slate-900/20 ring-2 ring-white/10">
                      <DollarSign className="h-5 w-5 text-amber-300" strokeWidth={2} />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight text-slate-900">Báo giá nhà cung cấp</h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Đơn hiển thị theo báo giá đã nhận và trạng thái hợp lệ
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold tabular-nums text-indigo-900 ring-1 ring-indigo-200/80">
                    {selectedRFQ.quotationsCount} báo giá
                  </span>
                </div>

                {selectedRFQ.quotations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/85 py-12 text-center">
                    <Building2 className="mb-3 h-11 w-11 text-slate-300" strokeWidth={1.25} />
                    <p className="font-medium text-slate-600">Chưa có báo giá</p>
                    <p className="mt-1 max-w-sm px-4 text-xs text-slate-500">
                      Khi Buyer nhập báo giá và đồng bộ, danh sách NCC và tổng tiền sẽ xuất hiện tại đây.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {selectedRFQ.quotations.map((q, idx) => {
                      const ql = (() => {
                        const s = (q.status || '').toUpperCase();
                        if (s === 'SELECTED') return { t: 'Được chọn', bg: 'bg-emerald-100 text-emerald-900 ring-emerald-200/80' };
                        if (s === 'VALID') return { t: 'Hợp lệ', bg: 'bg-sky-100 text-sky-900 ring-sky-200/80' };
                        if (s === 'PENDING') return { t: 'Chờ xử lý', bg: 'bg-amber-100 text-amber-900 ring-amber-200/80' };
                        return { t: q.status || '—', bg: 'bg-slate-100 text-slate-700 ring-slate-200/80' };
                      })();
                      return (
                        <li
                          key={q.id}
                          className="relative flex flex-col rounded-2xl border border-slate-200/80 bg-gradient-to-r from-white to-slate-50/92 p-4 pl-[15px] shadow-sm ring-1 ring-slate-200/35 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                        >
                          <span
                            className="absolute left-0 top-1/2 h-[calc(100%-1.25rem)] w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600"
                            aria-hidden
                          />
                          <div className="flex min-w-0 items-start gap-3 pl-2 sm:flex-1 sm:items-center">
                            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[11px] font-bold tabular-nums text-indigo-800 ring-2 ring-indigo-100/95 shadow-sm">
                              {(idx + 1).toString().padStart(2, '0')}
                            </span>
                            <div className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-900">{q.supplierName}</span>
                              <span
                                className={`mt-1.5 inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 shadow-sm ${ql.bg}`}
                              >
                                {ql.t}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 flex shrink-0 flex-col justify-end border-t border-slate-100 pt-3 text-right sm:mt-0 sm:border-t-0 sm:pt-0 sm:pl-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              Tổng báo giá
                            </span>
                            <span className="text-lg font-bold tabular-nums tracking-tight text-slate-900">
                              {fmt(q.totalAmount)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </AppModal>

      {/* ── Modal Escalate ── */}
      <AppModal
        open={!!escalateModal}
        onClose={() => setEscalateModal(null)}
        size="md"
        zIndexClass="z-[210]"
        description="Escalate RFQ lên Buyer Manager"
        headerIcon={<ArrowUpCircle className="h-[22px] w-[22px] text-red-600" strokeWidth={2.25} />}
        title="Escalate RFQ"
        subtitle={
          escalateModal ? (
            <span className="text-slate-600">
              <span className="font-medium text-slate-800">{escalateModal.rfqNumber}</span>
              <span className="mx-1.5 text-slate-300">·</span>
              Buyer {escalateModal.buyer.username}
            </span>
          ) : undefined
        }
        className="!rounded-[28px]"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[16rem] text-xs leading-relaxed text-slate-500">
              Buyer Manager nhận thông báo cùng bối cảnh RFQ và lý do bạn nhập (nếu có).
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEscalateModal(null)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/75 transition hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() =>
                  escalateModal &&
                  escalateMutation.mutate({ rfqId: escalateModal.id, reason: escalateReason })
                }
                disabled={escalateMutation.isPending || !escalateModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-b from-red-600 to-red-700 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(220,38,38,0.55)] transition hover:brightness-[1.05] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowUpCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
                {escalateMutation.isPending ? 'Đang gửi...' : 'Gửi escalate'}
              </button>
            </div>
          </div>
        }
      >
        {escalateModal ? (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-2xl border border-red-100/90 bg-gradient-to-br from-red-50/95 via-orange-50/40 to-white p-4 ring-1 ring-red-100/60 shadow-sm shadow-red-100/60">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 shadow-inner ring-1 ring-red-100">
                <AlertTriangle className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-sm font-semibold text-red-950">Chú ý</p>
                <p className="mt-1 text-xs leading-relaxed text-red-900/85">
                  Chỉ escalate khi đã cố nhắc Buyer hoặc rủi ro vượt SLA. Ghi ngắn lý do giúp Manager xử lý nhanh hơn.
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-200/85 bg-[#FBFCFE] px-4 py-3 ring-1 ring-slate-200/35">
              <span className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-gradient-to-b from-indigo-500 to-violet-600" aria-hidden />
              <p className="pl-3 font-mono text-xs font-semibold uppercase tracking-wide text-slate-500">RFQ</p>
              <p className="mt-1 pl-3 font-mono text-sm font-bold text-indigo-800">{escalateModal.rfqNumber}</p>
              <p className="mt-2 pl-3 text-xs text-slate-600">
                Giá PR:{' '}
                <span className="font-semibold text-slate-900">
                  {fmt(escalateModal.prTotalAmount, escalateModal.prCurrency)}
                </span>{' '}
                · Deadline: <span className="font-semibold">{fmtDate(escalateModal.deadlineDate)}</span>
              </p>
            </div>

            <div>
              <label className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">
                <span>Lý do escalate</span>
                <span className="text-xs font-normal text-slate-400">Tùy chọn</span>
              </label>
              <textarea
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                rows={4}
                placeholder="VD: RFQ đã quá hạn chờ báo giá sau 7 ngày — cần Buyer Manager hỗ trợ…"
                className="w-full resize-none rounded-2xl border border-slate-200/95 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 shadow-inner shadow-slate-200/40 ring-2 ring-transparent transition placeholder:text-slate-400 focus:border-red-400/90 focus:outline-none focus:ring-red-400/35"
              />
            </div>
          </div>
        ) : null}
      </AppModal>
    </div>
  );
};

export default RFQMonitoring;
