import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  UserCheck, Calendar, User, X, FileText, Building2, DollarSign,
  Package, Info, RefreshCw, Clock, Layers, ChevronRight, Search,
  Filter, FileQuestion, CheckCircle2, AlertCircle, Eye, ClipboardList,
} from 'lucide-react';
import { buyerLeaderService } from '../../services/buyerLeaderService';
import { BuyerLeaderPageHero } from '../../components/BuyerLeaderPageHero';
import { buyerLeaderPageStackClass } from '../../constants/buyerLeaderLayout';

// ─── Formatters ─────────────────────────────────────────────────────────────
const fmt = (amount: number | null, currency = 'VND') => {
  if (!amount) return 'Chưa có';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount);
};

const fmtDate = (d: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));

const fmtDateShort = (d: string) =>
  new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));

const BUYER_LEADER_ASSIGNMENT_SLA_MS = 72 * 60 * 60 * 1000;

// ─── Status maps ─────────────────────────────────────────────────────────────
const PR_STATUS: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  ASSIGNED_TO_BUYER:  { label: 'Đã phân công',      color: 'text-blue-700',    bg: 'bg-blue-100',    dot: 'bg-blue-500' },
  RFQ_IN_PROGRESS:    { label: 'Đang hỏi giá',       color: 'text-indigo-700',  bg: 'bg-indigo-100',  dot: 'bg-indigo-500' },
  QUOTATION_RECEIVED: { label: 'Đã nhận báo giá',    color: 'text-purple-700',  bg: 'bg-purple-100',  dot: 'bg-purple-500' },
  SUPPLIER_SELECTED:  { label: 'Đã chọn NCC',        color: 'text-green-700',   bg: 'bg-green-100',   dot: 'bg-green-500' },
  BUDGET_EXCEPTION:   { label: 'Vượt ngân sách',     color: 'text-red-700',     bg: 'bg-red-100',     dot: 'bg-red-500' },
  BUDGET_APPROVED:    { label: 'Đã duyệt vượt NS',   color: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  BUDGET_REJECTED:    { label: 'Từ chối vượt NS',    color: 'text-rose-700',    bg: 'bg-rose-100',    dot: 'bg-rose-500' },
  COMPLETED:          { label: 'Hoàn thành',         color: 'text-teal-700',    bg: 'bg-teal-100',    dot: 'bg-teal-500' },
};

const RFQ_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:                { label: 'Nháp',               color: 'text-slate-600',   bg: 'bg-slate-100' },
  SENT:                 { label: 'Đã gửi NCC',         color: 'text-blue-700',    bg: 'bg-blue-100' },
  QUOTATION_RECEIVED:   { label: 'Đã nhận báo giá',   color: 'text-purple-700',  bg: 'bg-purple-100' },
  READY_FOR_COMPARISON: { label: 'Chờ duyệt',  color: 'text-green-700',   bg: 'bg-green-100' },
  CLOSED:               { label: 'Đã đóng',            color: 'text-slate-500',   bg: 'bg-slate-100' },
};

const prStatus  = (s: string) => PR_STATUS[s]  || { label: s, color: 'text-slate-700', bg: 'bg-slate-100', dot: 'bg-slate-400' };
const rfqStatus = (s: string) => RFQ_STATUS[s] || { label: s, color: 'text-slate-700', bg: 'bg-slate-100' };
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

const buildSlaSnapshot = (assignedAt: string) => {
  const startMs = Number(new Date(assignedAt));
  if (!Number.isFinite(startMs)) {
    return {
      progress: 0,
      toneCard: 'border-slate-200 bg-slate-50/80',
      toneText: 'text-slate-700',
      toneLabel: 'text-slate-500',
      barGradient: 'from-slate-400 via-slate-300 to-slate-500',
      liquidClass: 'animate-liquid-flow',
      hint: 'Không xác định SLA',
    };
  }

  const now = Date.now();
  const endMs = startMs + BUYER_LEADER_ASSIGNMENT_SLA_MS;
  const elapsed = Math.max(0, now - startMs);
  const progress = Math.min(100, Math.max(0, (elapsed / BUYER_LEADER_ASSIGNMENT_SLA_MS) * 100));
  const remain = endMs - now;
  const overdue = remain <= 0;
  const remainHours = Math.floor(Math.abs(remain) / (60 * 60 * 1000));
  const remainMinutes = Math.floor((Math.abs(remain) % (60 * 60 * 1000)) / (60 * 1000));

  if (overdue) {
    return {
      progress: 100,
      toneCard: 'border-rose-200 bg-rose-50/80',
      toneText: 'text-rose-700',
      toneLabel: 'text-rose-500',
      barGradient: 'from-rose-500 via-red-500 to-pink-600',
      liquidClass: 'animate-liquid-flow-fast',
      hint: `Quá SLA ${remainHours} giờ ${remainMinutes} phút`,
    };
  }

  if (progress >= 75) {
    return {
      progress,
      toneCard: 'border-amber-200 bg-amber-50/80',
      toneText: 'text-amber-700',
      toneLabel: 'text-amber-600',
      barGradient: 'from-amber-500 via-yellow-400 to-orange-500',
      liquidClass: 'animate-liquid-flow',
      hint: `Còn ${remainHours} giờ ${remainMinutes} phút`,
    };
  }

  return {
    progress,
    toneCard: 'border-indigo-200 bg-indigo-50/80',
    toneText: 'text-indigo-700',
    toneLabel: 'text-indigo-600',
    barGradient: 'from-indigo-500 via-cyan-400 to-blue-600',
    liquidClass: 'animate-liquid-flow',
    hint: `Còn ${remainHours} giờ ${remainMinutes} phút`,
  };
};

// ─── Main Component ──────────────────────────────────────────────────────────
const AssignmentsHistory = () => {
  // Filters
  const [searchPR,    setSearchPR]    = useState('');
  const [filterBuyer, setFilterBuyer] = useState('');
  const [filterStatus,setFilterStatus]= useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');

  // Modal
  const [selectedPRId,     setSelectedPRId]     = useState<string | null>(null);
  const [selectedAssign,   setSelectedAssign]   = useState<any | null>(null);
  const [activeTab,        setActiveTab]        = useState<'assignments' | 'rfqs'>('assignments');
  const [isModalOpen,      setIsModalOpen]      = useState(false);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['buyer-leader-assignments'],
    queryFn: () => buyerLeaderService.getAssignments(),
    staleTime: 0,
  });

  const { data: prDetailsData, isLoading: isLoadingPRDetails } = useQuery({
    queryKey: ['buyer-leader-pr-details', selectedPRId],
    queryFn: () => buyerLeaderService.getPRDetails(selectedPRId!),
    enabled: !!selectedPRId && isModalOpen,
    retry: 1,
  });

  const { data: rfqsData, isLoading: isLoadingRFQs } = useQuery({
    queryKey: ['buyer-leader-pr-rfqs', selectedPRId],
    queryFn: () => buyerLeaderService.getPRRFQs(selectedPRId!),
    enabled: !!selectedPRId && isModalOpen && activeTab === 'rfqs',
    staleTime: 0,
  });

  const assignments: any[] = data?.assignments || [];

  // ── Group by PR ────────────────────────────────────────────────────────────
  const groupedByPR = useMemo(() => {
    const map: Record<string, {
      prId: string;
      prNumber: string;
      prStatus: string;
      assignedAt: string;
      buyers: any[];
      prTotalItems: number;
      totalAssignedItems: number;
    }> = {};
    assignments.forEach((a) => {
      if (!map[a.prId]) {
        map[a.prId] = {
          prId: a.prId,
          prNumber: a.prNumber,
          prStatus: a.prStatus,
          assignedAt: a.createdAt,
          buyers: [],
          prTotalItems: Number(a.prTotalItems || 0),
          totalAssignedItems: 0,
        };
      }
      map[a.prId].buyers.push(a);
      map[a.prId].prTotalItems = Math.max(map[a.prId].prTotalItems, Number(a.prTotalItems || 0));
      map[a.prId].totalAssignedItems += Number(a.assignedItemCount || 0);
      // Keep earliest date as assignedAt
      if (a.createdAt < map[a.prId].assignedAt) map[a.prId].assignedAt = a.createdAt;
    });
    return Object.values(map).sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  }, [assignments]);

  // ── All buyers list for filter dropdown ────────────────────────────────────
  const allBuyers = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; username: string }[] = [];
    assignments.forEach((a) => {
      if (a.buyer?.username && !seen.has(a.buyer.username)) {
        seen.add(a.buyer.username);
        list.push({ id: a.buyer.username, username: a.buyer.username });
      }
    });
    return list.sort((a, b) => a.username.localeCompare(b.username));
  }, [assignments]);

  // ── Filtered PR groups ─────────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    return groupedByPR.filter((g) => {
      // Search PR number
      if (searchPR && !g.prNumber.toLowerCase().includes(searchPR.toLowerCase())) return false;
      // Filter by buyer
      if (filterBuyer && !g.buyers.some((b) => b.buyer?.username === filterBuyer)) return false;
      // Filter by status
      if (filterStatus && g.prStatus !== filterStatus) return false;
      // Date range
      if (dateFrom && g.assignedAt < dateFrom) return false;
      if (dateTo   && g.assignedAt > dateTo + 'T23:59:59') return false;
      return true;
    });
  }, [groupedByPR, searchPR, filterBuyer, filterStatus, dateFrom, dateTo]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const openModal = (group: any, tab: 'assignments' | 'rfqs' = 'assignments') => {
    setSelectedPRId(group.prId);
    setSelectedAssign(group);
    setActiveTab(tab);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPRId(null);
    setSelectedAssign(null);
  };

  const hasFilters = searchPR || filterBuyer || filterStatus || dateFrom || dateTo;

  // ── Render helpers ─────────────────────────────────────────────────────────
  const RFQStatusBadge = ({ s, prStatus }: { s: string; prStatus?: string }) => {
    const st =
      prStatus && PR_STATUS_AFTER_AWARD.has(prStatus)
        ? { label: 'Đã chọn NCC', color: 'text-emerald-700', bg: 'bg-emerald-100' }
        : rfqStatus(s);
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.bg} ${st.color}`}>{st.label}</span>;
  };

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-slate-200 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col p-6">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-800 font-medium">Lỗi khi tải dữ liệu</p>
          <p className="text-red-600 text-sm mt-1">{error instanceof Error ? error.message : 'Vui lòng thử lại sau'}</p>
          <button onClick={() => refetch()} className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-medium transition-colors">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // ── Main Render ────────────────────────────────────────────────────────────
  return (
    <div
      className={`min-h-full w-full min-w-0 ${buyerLeaderPageStackClass}`}
      style={{ backgroundColor: 'transparent' }}
    >

      <div className="mb-3 flex-shrink-0 space-y-3 px-2 pt-3 sm:px-3 sm:pt-4 md:px-4">
        <BuyerLeaderPageHero
          kicker="Buyer Leader · Lịch sử"
          title="Lịch sử phân công & giám sát RFQ"
          description="Theo dõi phân công PR và tiến trình RFQ của từng Buyer"
          Icon={Layers}
          tint="graphite"
          regionLabel="Lịch sử phân công"
          rightSlot={
            <>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/15 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} strokeWidth={2} />
                <span className="hidden sm:inline">Làm mới</span>
              </button>
              <div className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 backdrop-blur-sm">
                <UserCheck className="h-5 w-5 text-white" strokeWidth={2} />
                <span className="font-semibold text-white">{filteredGroups.length} PR</span>
              </div>
            </>
          }
        />

        <div className="rounded-2xl border border-slate-200/50 bg-white/90 p-5 shadow-soft-md backdrop-blur-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Search PR */}
            <div className="relative lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2} />
              <input
                type="text"
                placeholder="Tìm mã PR..."
                value={searchPR}
                onChange={(e) => setSearchPR(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
              />
            </div>

            {/* Buyer filter */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2} />
              <select
                value={filterBuyer}
                onChange={(e) => setFilterBuyer(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white appearance-none"
              >
                <option value="">Tất cả Buyer</option>
                {allBuyers.map((b) => (
                  <option key={b.id} value={b.id}>{b.username}</option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2} />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white appearance-none"
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(PR_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2} />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
              />
            </div>

            {/* Date to */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2} />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
              />
            </div>
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => { setSearchPR(''); setFilterBuyer(''); setFilterStatus(''); setDateFrom(''); setDateTo(''); }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} /> Xóa bộ lọc
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── PR List (card blocks like Requestor PR tracking) ── */}
      <div className="px-2 pt-4 pb-10 sm:px-3 md:px-4">
        {filteredGroups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-slate-500 font-medium">{hasFilters ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có phân công nào'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGroups.map((group) => {
              const st = prStatus(group.prStatus);
              const fullCount = group.buyers.filter((b: any) => b.scope === 'FULL').length;
              const partialCount = group.buyers.length - fullCount;
              const sla = buildSlaSnapshot(group.assignedAt);
              return (
                <article
                  key={group.prId}
                  className="group rounded-2xl border border-slate-200/70 bg-white shadow-[0_8px_22px_-16px_rgba(15,23,42,0.28)] ring-1 ring-transparent transition-all duration-300 ease-out motion-safe:hover:-translate-y-1 hover:border-blue-200/75 hover:shadow-[0_22px_38px_-20px_rgba(37,99,235,0.38)] hover:ring-blue-100/90"
                >
                  <div className="rounded-t-2xl border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Purchase Request</p>
                        <h3 className="truncate font-mono text-lg font-black tracking-tight text-slate-900">
                          {group.prNumber}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.bg} ${st.color}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="h-3 w-3" strokeWidth={2} />
                            {fmtDateShort(group.assignedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                        <UserCheck className="h-4 w-4" strokeWidth={2} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Buyer</p>
                        <p className="mt-1 text-lg font-black text-slate-900">{group.buyers.length}</p>
                      </div>
                      <div className="rounded-xl border border-teal-200 bg-teal-50 p-2.5 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-600">Toàn bộ</p>
                        <p className="mt-1 text-lg font-black text-teal-700">{fullCount}</p>
                      </div>
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-2.5 text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">Một phần</p>
                        <p className="mt-1 text-lg font-black text-orange-700">{partialCount}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-2.5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                        Tổng item đã phân công
                      </p>
                      <p className="mt-1 text-lg font-black text-blue-700">
                        {group.totalAssignedItems}
                        {group.prTotalItems > 0 && (
                          <span className="ml-1 text-sm font-bold text-blue-500">/ {group.prTotalItems}</span>
                        )}
                      </p>
                    </div>

                    <div className={`rounded-xl border p-3 ${sla.toneCard}`}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${sla.toneLabel}`}>SLA theo dõi Buyer Leader</p>
                        <span className={`text-xs font-black tabular-nums ${sla.toneText}`}>{Math.round(sla.progress)}%</span>
                      </div>
                      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200/90 shadow-inner ring-1 ring-slate-900/5">
                        <div
                          className={`relative h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out ${sla.barGradient}`}
                          style={{ width: `${sla.progress}%` }}
                        >
                          {sla.progress > 20 ? (
                            <>
                              <div
                                className={`pointer-events-none absolute inset-0 ${sla.liquidClass}`}
                                style={{
                                  background:
                                    'linear-gradient(90deg, transparent, rgba(255,255,255,0.38), transparent)',
                                  backgroundSize: '200% 100%',
                                }}
                              />
                              <span className="pointer-events-none absolute left-[18%] top-[2px] h-1 w-1 animate-pulse rounded-full bg-white/35" style={{ animationDuration: '2.2s' }} />
                              <span className="pointer-events-none absolute left-[46%] top-[6px] h-1 w-1 animate-pulse rounded-full bg-white/30" style={{ animationDuration: '2.8s' }} />
                              <span className="pointer-events-none absolute left-[74%] top-[3px] h-1.5 w-1.5 animate-pulse rounded-full bg-white/35" style={{ animationDuration: '3.1s' }} />
                            </>
                          ) : null}
                        </div>
                      </div>
                      <p className={`mt-2 text-xs font-medium ${sla.toneText}`}>{sla.hint}</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Danh sách Buyer</p>
                      <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
                        {group.buyers.map((a: any) => (
                          <div key={a.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">
                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white">
                              {(a.buyer?.username || '?')[0].toUpperCase()}
                            </div>
                            <span className="max-w-[110px] truncate text-xs font-semibold text-slate-700">{a.buyer?.username || 'N/A'}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${a.scope === 'FULL' ? 'bg-teal-100 text-teal-700' : 'bg-orange-100 text-orange-700'}`}>
                              {a.scope === 'FULL' ? 'FULL' : 'PART'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => openModal(group, 'assignments')}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                      >
                        <ClipboardList className="h-3.5 w-3.5" strokeWidth={2} />
                        Xem phân công
                      </button>
                      <button
                        onClick={() => openModal(group, 'rfqs')}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                      >
                        <FileQuestion className="h-3.5 w-3.5" strokeWidth={2} />
                        Lịch sử RFQ
                        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Modal: render qua portal để overlay phủ hết viewport (trên/dưới) ── */}
      {isModalOpen && selectedAssign && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm min-h-screen min-w-full modal-popup-overlay"
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignments-modal-title"
        >
          <div className="modal-popup-panel bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden m-4" onClick={(e) => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50">
              <div>
                <h2 id="assignments-modal-title" className="text-xl font-bold text-slate-900">{selectedAssign.prNumber}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {(() => { const st = prStatus(selectedAssign.prStatus); return (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.bg} ${st.color}`}>{st.label}</span>
                  ); })()}
                  <span className="text-xs text-slate-400">{fmtDateShort(selectedAssign.assignedAt)}</span>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-600" strokeWidth={2} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 flex border-b border-slate-200 bg-white px-6">
              {([
                { key: 'assignments', icon: ClipboardList, label: 'Phân công' },
                { key: 'rfqs',        icon: FileQuestion,  label: 'Lịch sử RFQ' },
              ] as const).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === key
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={2} />
                  {label}
                </button>
              ))}
            </div>

            {/* Modal body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6">

              {/* ── Tab: Phân công ── */}
              {activeTab === 'assignments' && (
                <div className="space-y-4">
                  {isLoadingPRDetails ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* PR meta — insight cards (modal design system: gradient + ornament + watermark) */}
                      {prDetailsData && (
                        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 p-3.5 text-white shadow-md shadow-slate-700/25 ring-1 ring-white/10">
                            <div className="pointer-events-none absolute -right-2.5 -top-2.5 h-12 w-12 rounded-full bg-white/10" aria-hidden />
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-200">Phòng ban</p>
                            <p className="mt-1 truncate text-base font-black leading-tight tracking-tight">{prDetailsData.department || 'N/A'}</p>
                            <Building2 className="pointer-events-none absolute bottom-2.5 right-2.5 h-6 w-6 text-white/20" strokeWidth={1.5} aria-hidden />
                          </div>
                          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 p-3.5 text-white shadow-md shadow-violet-500/20 ring-1 ring-white/10">
                            <div className="pointer-events-none absolute -right-2.5 -top-2.5 h-12 w-12 rounded-full bg-white/10" aria-hidden />
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-100">Người yêu cầu</p>
                            <p className="mt-1 truncate text-base font-black leading-tight tracking-tight" title={prDetailsData.requestor?.username || ''}>
                              {prDetailsData.requestor?.username || 'N/A'}
                            </p>
                            <User className="pointer-events-none absolute bottom-2.5 right-2.5 h-6 w-6 text-white/20" strokeWidth={1.5} aria-hidden />
                          </div>
                          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 p-3.5 text-white shadow-md shadow-amber-500/25 ring-1 ring-white/10">
                            <div className="pointer-events-none absolute -right-2.5 -top-2.5 h-12 w-12 rounded-full bg-white/10" aria-hidden />
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-orange-100">Ngày cần</p>
                            <p className="mt-1 text-base font-black tabular-nums leading-tight">
                              {prDetailsData.requiredDate ? fmtDateShort(prDetailsData.requiredDate) : 'N/A'}
                            </p>
                            <Calendar className="pointer-events-none absolute bottom-2.5 right-2.5 h-6 w-6 text-white/20" strokeWidth={1.5} aria-hidden />
                          </div>
                          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-3.5 text-white shadow-md shadow-blue-500/20 ring-1 ring-white/10">
                            <div className="pointer-events-none absolute -right-2.5 -top-2.5 h-12 w-12 rounded-full bg-white/10" aria-hidden />
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-100">Tổng tiền</p>
                            <p className="mt-1 text-base font-black tabular-nums leading-tight sm:text-lg">{fmt(prDetailsData.totalAmount, prDetailsData.currency)}</p>
                            <DollarSign className="pointer-events-none absolute bottom-2.5 right-2.5 h-6 w-6 text-white/20" strokeWidth={1.5} aria-hidden />
                          </div>
                        </div>
                      )}

                      {/* Assignments table */}
                      <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-2">
                        <UserCheck className="w-4 h-4 text-blue-600" strokeWidth={2} />
                        Danh sách phân công ({selectedAssign.buyers.length} buyer)
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Buyer</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Phạm vi</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Items được giao</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Ghi chú</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Ngày phân công</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {selectedAssign.buyers.map((a: any) => {
                              const items = a.assignedItemIds || [];
                              const assignedItems = prDetailsData?.items
                                ? (a.scope === 'PARTIAL' && items.length > 0
                                    ? prDetailsData.items.filter((it: any) => items.includes(it.id))
                                    : prDetailsData.items)
                                : [];
                              return (
                                <tr key={a.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                        {(a.buyer?.username || '?')[0].toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="font-semibold text-slate-900">{a.buyer?.username || 'N/A'}</p>
                                        <p className="text-xs text-slate-400">{a.buyer?.email || ''}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.scope === 'FULL' ? 'bg-teal-100 text-teal-700' : 'bg-orange-100 text-orange-700'}`}>
                                      {a.scope === 'FULL' ? (
                                        <span className="flex items-center gap-1"><Layers className="w-3 h-3" strokeWidth={2} />Toàn bộ</span>
                                      ) : (
                                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" strokeWidth={2} />Một phần</span>
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    {assignedItems.length > 0 ? (
                                      <div className="space-y-1 max-w-xs">
                                        {assignedItems.map((it: any) => (
                                          <div key={it.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                                            <Package className="w-3 h-3 text-slate-400 flex-shrink-0" strokeWidth={2} />
                                            <span className="truncate">{it.description}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-xs">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-slate-500">{a.note || '—'}</td>
                                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(a.createdAt)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Tab: RFQ History ── */}
              {activeTab === 'rfqs' && (
                <div>
                  {isLoadingRFQs ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-3">
                        <FileQuestion className="w-4 h-4 text-indigo-600" strokeWidth={2} />
                        Lịch sử RFQ của PR này ({rfqsData?.rfqs?.length || 0} RFQ)
                      </h3>
                      {(!rfqsData?.rfqs || rfqsData.rfqs.length === 0) ? (
                        <div className="text-center py-12">
                          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
                          <p className="text-slate-500">Chưa có RFQ nào được tạo</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-sm">
                            <thead className="bg-indigo-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Mã RFQ</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Người phụ trách</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Số báo giá</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Trạng thái</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Thời gian tạo</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Cập nhật</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {rfqsData.rfqs.map((rfq: any) => {
                                const st = rfqStatus(rfq.status);
                                return (
                                  <tr key={rfq.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                      <span className="font-mono font-semibold text-indigo-700 text-xs">{rfq.rfqNumber}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                          {(rfq.buyer?.username || '?')[0].toUpperCase()}
                                        </div>
                                        <span className="font-medium text-slate-800">{rfq.buyer?.username || 'N/A'}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${rfq.quotationCount > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {rfq.quotationCount}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <RFQStatusBadge s={rfq.status} prStatus={rfq.prStatus} />
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(rfq.createdAt)}</td>
                                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(rfq.updatedAt)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Quotations breakdown */}
                      {rfqsData?.rfqs?.some((r: any) => r.quotationCount > 0) && (
                        <div className="mt-6">
                          <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <Eye className="w-4 h-4 text-slate-500" strokeWidth={2} />
                            Chi tiết báo giá theo RFQ
                          </h4>
                          <div className="space-y-3">
                            {rfqsData.rfqs.filter((r: any) => r.quotationCount > 0).map((rfq: any) => (
                              <div key={rfq.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="px-4 py-2 bg-slate-50 flex items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-indigo-700">{rfq.rfqNumber}</span>
                                  <span className="text-xs text-slate-400">·</span>
                                  <span className="text-xs text-slate-500">{rfq.buyer?.username}</span>
                                  <RFQStatusBadge s={rfq.status} prStatus={rfq.prStatus} />
                                </div>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                      <th className="px-4 py-2 text-left text-slate-500 font-medium">Mã báo giá</th>
                                      <th className="px-4 py-2 text-left text-slate-500 font-medium">Nhà cung cấp</th>
                                      <th className="px-4 py-2 text-right text-slate-500 font-medium">Tổng tiền</th>
                                      <th className="px-4 py-2 text-left text-slate-500 font-medium">Ngày tạo</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {rfq.quotations.map((q: any) => (
                                      <tr key={q.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-2 font-medium text-slate-700">{q.quotationNumber || '—'}</td>
                                        <td className="px-4 py-2 text-slate-600">{q.supplier?.name || '—'}</td>
                                        <td className="px-4 py-2 text-right font-semibold text-slate-800">{q.totalAmount ? fmt(q.totalAmount) : '—'}</td>
                                        <td className="px-4 py-2 text-slate-400">{fmtDateShort(q.createdAt)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex-shrink-0 flex justify-end px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button onClick={closeModal} className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-medium text-sm transition-colors">
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes liquid-flow {
          from { transform: translateX(-200%); }
          to { transform: translateX(300%); }
        }
        .animate-liquid-flow {
          animation: liquid-flow 3s linear infinite;
        }
        @keyframes liquid-flow-fast {
          from { transform: translateX(-200%); }
          to { transform: translateX(300%); }
        }
        .animate-liquid-flow-fast {
          animation: liquid-flow-fast 1.8s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default AssignmentsHistory;
