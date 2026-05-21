import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle,
  XCircle,
  MessageSquare,
  FileText,
  Calendar,
  User,
  Building2,
  DollarSign,
  Package,
  Search,
  Filter,
  X,
  Info,
  Hash,
  Warehouse,
  StickyNote,
  ListChecks,
  Scale,
  Check,
} from 'lucide-react';
import { getPendingPRs, approvePR, rejectPR, returnPR } from '../../services/departmentHeadService';
import { DepartmentPageHero } from '../../components/DepartmentPageHero';
import {
  departmentHeadListTableScrollClass,
  departmentHeadTableTbodyElevatedClass,
  departmentHeadTableDataRowClasses,
  departmentHeadInteractiveTableFixed880Class,
  departmentHeadTableAccentRailClass,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableCellContentWrapClass,
} from '../../constants/departmentHeadLayout';
import {
  saasTableRootClass,
  saasTableHeadCellClass,
  saasPrStatusBadgeClass,
} from '../../constants/saasDataTable';
import { getPRStatusLabel } from '../../constants/statusLabels';
import { formatIsoDateToDdMmYyyy } from '../../utils/dateDisplay';
import { AppModal } from '../../components/AppModal';
import { useToast } from '../../contexts/ToastContext';
import type { DepartmentItemDecisionPayload } from '../../services/departmentHeadService';
import {
  APPROVAL_QUEUE_DEFAULT,
  DEPARTMENT_HEAD_QUEUE_OPTIONS,
  approvalQueueEmptyHint,
  canDepartmentHeadActOnPr,
  type ApprovalQueueFilter,
} from '../../constants/approvalQueueFilter';

type DeptLineOutcome = 'APPROVED' | 'REJECTED' | 'ON_HOLD' | 'REVISION_REQUIRED';

/** Popup «Xử lý dòng»: map UI → outcome gửi API */
type RejectLinesModalAction = 'APPROVED' | 'REJECT_FINAL' | 'RETURN_REVISION' | 'ON_HOLD';

type RejectLinesDraftRow = { action: RejectLinesModalAction; note: string };

function outcomeToModalAction(o: DeptLineOutcome): RejectLinesModalAction {
  if (o === 'REJECTED') return 'REJECT_FINAL';
  if (o === 'REVISION_REQUIRED') return 'RETURN_REVISION';
  if (o === 'ON_HOLD') return 'ON_HOLD';
  return 'APPROVED';
}

function modalActionToOutcome(a: RejectLinesModalAction): DeptLineOutcome {
  if (a === 'REJECT_FINAL') return 'REJECTED';
  if (a === 'RETURN_REVISION') return 'REVISION_REQUIRED';
  if (a === 'ON_HOLD') return 'ON_HOLD';
  return 'APPROVED';
}

function needsMandatoryLineNoteForModal(a: RejectLinesModalAction): boolean {
  return a === 'REJECT_FINAL' || a === 'RETURN_REVISION';
}

function isNeedPurchaseItem(item: { status?: string }) {
  return String(item?.status || '').toUpperCase() === 'NEED_PURCHASE';
}

function lineAmountVnd(item: {
  amount?: unknown;
  qty?: unknown;
  unitPrice?: unknown;
  estimatedUnitPriceVnd?: unknown;
}): number {
  const raw = item.amount != null ? Number(item.amount) : NaN;
  if (Number.isFinite(raw) && raw > 0) return raw;
  const qty = Number(item.qty) || 0;
  const est = Number(item.estimatedUnitPriceVnd) || 0;
  const unit = Number(item.unitPrice) || 0;
  const u = est > 0 ? est : unit;
  return u > 0 && qty > 0 ? qty * u : 0;
}

const PRApproval = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailPrId, setDetailPrId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState<ApprovalQueueFilter>(APPROVAL_QUEUE_DEFAULT);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [modalComment, setModalComment] = useState('');
  const [lineOutcomes, setLineOutcomes] = useState<Record<string, DeptLineOutcome>>({});
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});
  /** Modal «Xử lý dòng»: quyết định theo dòng NEED_PURCHASE (duyệt / trả sửa / từ chối hẳn / tạm hoãn) */
  const [showRejectLinesModal, setShowRejectLinesModal] = useState(false);
  const [rejectLinesDraft, setRejectLinesDraft] = useState<Record<string, RejectLinesDraftRow>>({});
  const { showSuccess, showError } = useToast();

  const { data: prsData, isLoading, error } = useQuery({
    queryKey: ['department-head-pending-prs', queueFilter],
    queryFn: () => getPendingPRs({ queue: queueFilter }),
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const approvalPRs: any[] = useMemo(() => {
    let list: any[] = [];
    if (!prsData) return [];
    if (typeof prsData === 'string' && prsData.trim()) {
      try {
        const parsed = JSON.parse(prsData);
        list = parsed.prs || [];
      } catch (e) {
        console.error('Failed to parse prsData:', e);
        return [];
      }
    } else if (prsData.prs) {
      list = Array.isArray(prsData.prs) ? prsData.prs : [];
    } else if (Array.isArray(prsData)) {
      list = prsData;
    }
    return list;
  }, [prsData]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    approvalPRs.forEach((pr) => {
      if (pr.department && typeof pr.department === 'string') set.add(pr.department);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [approvalPRs]);

  const selectedPRData = approvalPRs.find((pr) => pr.id === detailPrId);

  const canActOnSelected = useMemo(
    () => canDepartmentHeadActOnPr(selectedPRData),
    [selectedPRData],
  );

  useEffect(() => {
    if (isLoading || approvalPRs.length === 0) return;
    const qp = searchParams.get('prId');
    const st = (location.state as { prId?: string } | null)?.prId;
    const raw = qp || st;
    if (!raw || !approvalPRs.some((pr) => pr.id === raw)) return;
    setDetailPrId(raw);
    navigate('.', { replace: true, state: {} });
    if (qp) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('prId');
          return next;
        },
        { replace: true },
      );
    }
  }, [isLoading, approvalPRs, location.pathname, location.search, location.state, navigate, searchParams, setSearchParams]);

  useEffect(() => {
    if (detailPrId && !approvalPRs.some((pr) => pr.id === detailPrId)) setDetailPrId(null);
  }, [detailPrId, approvalPRs]);

  const approveMutation = useMutation({
    mutationFn: (payload: { prId: string; itemDecisions?: DepartmentItemDecisionPayload[] }) =>
      approvePR(payload.prId, { itemDecisions: payload.itemDecisions }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-head-pending-prs'] });
      queryClient.invalidateQueries({ queryKey: ['department-head'] });
      setDetailPrId(null);
      showSuccess('Đã duyệt PR thành công.');
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error || err?.response?.data?.message || 'Duyệt PR thất bại.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ prId, comment }: { prId: string; comment: string }) => rejectPR(prId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-head-pending-prs'] });
      queryClient.invalidateQueries({ queryKey: ['department-head'] });
      setDetailPrId(null);
      setShowRejectModal(false);
      setShowRejectLinesModal(false);
      setModalComment('');
      showSuccess('Đã từ chối PR.');
    },
    onError: (err: any) => {
      showError(err?.response?.data?.error || err?.response?.data?.message || 'Từ chối PR thất bại.');
    },
  });

  const returnMutation = useMutation({
    mutationFn: ({ prId, comment }: { prId: string; comment: string }) => returnPR(prId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department-head-pending-prs'] });
      queryClient.invalidateQueries({ queryKey: ['department-head'] });
      setDetailPrId(null);
      setShowReturnModal(false);
      setModalComment('');
    },
  });

  const filteredPRs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return approvalPRs.filter((pr) => {
      if (departmentFilter !== 'all' && pr.department !== departmentFilter) return false;
      if (!q) return true;
      const blob = [
        pr.prNumber,
        pr.itemName,
        pr.requestor?.username,
        pr.department,
        pr.purpose,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [approvalPRs, searchQuery, departmentFilter]);

  const itemsRequiringDeptDecision = useMemo(() => {
    if (!selectedPRData?.items) return [];
    const list = selectedPRData.items as Array<any>;
    const st = String(selectedPRData.status || '');
    const initial = st === 'MANAGER_PENDING' || st === 'DEPARTMENT_HEAD_PENDING';
    return list.filter((it) => {
      if (!isNeedPurchaseItem(it)) return false;
      if (initial) return true;
      return (
        it.departmentItemOutcome === 'REVISION_REQUIRED' &&
        !!it.departmentRevisionSubmittedAt
      );
    });
  }, [selectedPRData]);

  const decidingItemIdSet = useMemo(
    () => new Set(itemsRequiringDeptDecision.map((x) => x.id)),
    [itemsRequiringDeptDecision]
  );

  useEffect(() => {
    if (!detailPrId || !selectedPRData?.items) return;
    const init: Record<string, DeptLineOutcome> = {};
    for (const it of itemsRequiringDeptDecision) {
      init[it.id] = 'APPROVED';
    }
    setLineOutcomes(init);
    setLineNotes({});
    setShowRejectLinesModal(false);
    setRejectLinesDraft({});
  }, [detailPrId, selectedPRData?.id, itemsRequiringDeptDecision]);

  const decisionTotals = useMemo(() => {
    const items = (selectedPRData?.items as any[]) || [];
    const decidingIds = new Set(itemsRequiringDeptDecision.map((x) => x.id));
    let sumAll = 0;
    let active = 0;
    let rejected = 0;
    let revision = 0;
    let onHold = 0;
    for (const it of items) {
      const amt = lineAmountVnd(it);
      sumAll += amt;
      let o: string;
      if (isNeedPurchaseItem(it)) {
        if (decidingIds.has(it.id)) {
          o = lineOutcomes[it.id] ?? 'APPROVED';
        } else {
          o = String((it as { departmentItemOutcome?: string | null }).departmentItemOutcome || 'APPROVED');
        }
      } else {
        o = 'APPROVED';
      }
      if (o === 'REJECTED') rejected += amt;
      else if (o === 'ON_HOLD') onHold += amt;
      else if (o === 'REVISION_REQUIRED') revision += amt;
      else active += amt;
    }
    const snapRaw = selectedPRData?.totalAmountSnapshot;
    const snap = snapRaw != null && snapRaw !== '' ? Number(snapRaw) : NaN;
    const original = Number.isFinite(snap) ? snap : sumAll;
    return { original, active, rejected, revision, onHold, sumAll };
  }, [selectedPRData, lineOutcomes, itemsRequiringDeptDecision]);

  const buildItemDecisions = (): DepartmentItemDecisionPayload[] => {
    const out: DepartmentItemDecisionPayload[] = [];
    for (const it of itemsRequiringDeptDecision) {
      const outcome = lineOutcomes[it.id] ?? 'APPROVED';
      const note = (lineNotes[it.id] || '').trim();
      const row: DepartmentItemDecisionPayload = { itemId: it.id, outcome };
      if (note) row.note = note;
      out.push(row);
    }
    return out;
  };

  const handleApproveWithDecisions = () => {
    if (!selectedPRData) return;
    const st = String(selectedPRData.status || '');
    const initialPending = st === 'MANAGER_PENDING' || st === 'DEPARTMENT_HEAD_PENDING';
    for (const it of itemsRequiringDeptDecision) {
      const o = lineOutcomes[it.id] ?? 'APPROVED';
      if ((o === 'REJECTED' || o === 'REVISION_REQUIRED') && !(lineNotes[it.id] || '').trim()) {
        showError(
          `Dòng "${(it as { description?: string }).description ?? it.id}" cần lý do khi từ chối hoặc yêu cầu chỉnh sửa.`
        );
        return;
      }
    }
    if (initialPending) {
      const anyApprovedNeed = itemsRequiringDeptDecision.some(
        (it) => (lineOutcomes[it.id] ?? 'APPROVED') === 'APPROVED'
      );
      if (itemsRequiringDeptDecision.length > 0 && !anyApprovedNeed) {
        showError(
          'Không còn dòng mua ngoài được duyệt — dùng «Xử lý dòng» để chọn từ chối hoàn toàn hoặc trả về sửa, hoặc «Từ chối toàn bộ PR» trong form đó.'
        );
        return;
      }
    }
    approveMutation.mutate({ prId: selectedPRData.id, itemDecisions: buildItemDecisions() });
  };

  const handleReturnClick = () => {
    setModalComment('');
    setShowReturnModal(true);
  };

  const openRejectLinesModal = () => {
    if (!selectedPRData?.items) return;
    const draft: Record<string, RejectLinesDraftRow> = {};
    for (const it of itemsRequiringDeptDecision) {
      const o = (lineOutcomes[it.id] ?? 'APPROVED') as DeptLineOutcome;
      draft[it.id] = {
        action: outcomeToModalAction(o),
        note: lineNotes[it.id] ?? '',
      };
    }
    setRejectLinesDraft(draft);
    setShowRejectLinesModal(true);
  };

  const handleRejectClick = () => {
    setModalComment('');
    if (itemsRequiringDeptDecision.length > 0) {
      openRejectLinesModal();
    } else {
      setShowRejectModal(true);
    }
  };

  const applyRejectLinesFromModal = () => {
    for (const it of itemsRequiringDeptDecision) {
      const d = rejectLinesDraft[it.id];
      if (d && needsMandatoryLineNoteForModal(d.action) && !d.note?.trim()) {
        showError(
          `Dòng "${(it as { description?: string }).description ?? it.id}" cần lý do khi từ chối hoàn toàn hoặc trả về chỉnh sửa.`
        );
        return;
      }
    }
    const nextOutcomes = { ...lineOutcomes };
    const nextNotes = { ...lineNotes };
    for (const it of itemsRequiringDeptDecision) {
      const d = rejectLinesDraft[it.id];
      if (!d) continue;
      const outcome = modalActionToOutcome(d.action);
      nextOutcomes[it.id] = outcome;
      const nt = (d.note || '').trim();
      if (outcome === 'REJECTED' || outcome === 'REVISION_REQUIRED') {
        nextNotes[it.id] = nt;
      } else if (outcome === 'ON_HOLD' && nt) {
        nextNotes[it.id] = nt;
      } else {
        delete nextNotes[it.id];
      }
    }
    setLineOutcomes(nextOutcomes);
    setLineNotes(nextNotes);
    setShowRejectLinesModal(false);
    showSuccess('Đã cập nhật quyết định theo dòng. Nhấn «Duyệt & chuyển tiếp» để gửi duyệt.');
  };

  const openFullPrRejectModal = () => {
    setShowRejectLinesModal(false);
    setModalComment('');
    setShowRejectModal(true);
  };

  const handleReturnSubmit = () => {
    if (detailPrId && modalComment.trim()) {
      returnMutation.mutate({ prId: detailPrId, comment: modalComment });
    }
  };

  const handleRejectSubmit = () => {
    if (detailPrId && modalComment.trim()) {
      rejectMutation.mutate({ prId: detailPrId, comment: modalComment });
    }
  };

  const pageShellClass = 'w-full min-h-full min-w-0 bg-[#f1f5f9]';
  const pageContentClass = 'mx-auto w-full max-w-none min-w-0 space-y-6 px-1 pt-3 pb-4 sm:px-1.5 sm:pt-4 sm:pb-5 md:px-3';
  const islandCard =
    'rounded-2xl border border-slate-200 bg-white ring-1 ring-slate-900/5 shadow-[0_16px_28px_-22px_rgba(15,23,42,0.35)]';

  const filterBarClass =
    'rounded-2xl border border-slate-200/60 bg-white/90 p-4 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/5 backdrop-blur-sm sm:p-5';

  if (isLoading) {
    return (
      <div className={pageShellClass}>
        <div className={`${pageContentClass} animate-pulse`}>
          <div className="h-[100px] rounded-3xl bg-slate-200/80 sm:h-[112px]" />
          <div className="h-24 rounded-2xl border border-slate-200 bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.2)] ring-1 ring-slate-900/5" />
          <div className="overflow-visible rounded-2xl shadow-[0_16px_30px_-20px_rgba(15,23,42,0.28)]">
            <div className={`${islandCard} overflow-hidden`}>
              <div className="h-72 bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={pageShellClass}>
        <div className={pageContentClass}>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 ring-1 ring-rose-100">
            <p className="font-semibold text-rose-900">Lỗi khi tải dữ liệu</p>
            <p className="mt-1 text-sm text-rose-700">
              {error instanceof Error ? error.message : 'Vui lòng thử lại sau'}
            </p>
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['department-head-pending-prs'] })}
              className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageShellClass}>
      <div className={pageContentClass}>
        <DepartmentPageHero
          kicker="Trưởng phòng · Phê duyệt"
          title="Duyệt PR phòng ban"
          description="Lọc nhanh, mở chi tiết từng PR và phê duyệt, trả hoặc từ chối trong cùng luồng làm việc."
          Icon={ClipboardCheck}
          tint="ocean"
          regionLabel="Duyệt PR phòng ban"
          rightSlot={
            <div className="rounded-xl border border-white/35 bg-white/15 px-4 py-2 text-center backdrop-blur-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">PR hiển thị</p>
              <p className="text-2xl font-bold tabular-nums text-white">{filteredPRs.length}</p>
              <p className="text-[11px] text-white/80">theo bộ lọc hiện tại</p>
            </div>
          }
        />

        <div className={filterBarClass}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative min-w-0 sm:col-span-2 lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo mã PR, mô tả, người yêu cầu, phòng ban…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-100/80 pl-10 pr-3 text-sm text-slate-900 outline-none ring-0 transition-colors placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                autoComplete="off"
              />
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Filter className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              <select
                value={queueFilter}
                onChange={(e) => {
                  setQueueFilter(e.target.value as ApprovalQueueFilter);
                  setDetailPrId(null);
                }}
                className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                aria-label="Lọc trạng thái PR"
              >
                {DEPARTMENT_HEAD_QUEUE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <Building2 className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
                aria-label="Lọc phòng ban"
              >
                <option value="all">Tất cả phòng ban</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-visible rounded-2xl shadow-[0_16px_30px_-20px_rgba(15,23,42,0.3)]">
          <div className={`${islandCard} overflow-hidden`}>
            <div className={departmentHeadListTableScrollClass}>
              <table className={`${departmentHeadInteractiveTableFixed880Class} ${saasTableRootClass} min-w-[1220px] whitespace-nowrap`}>
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[26%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <thead className="sticky top-0 z-20 border-b border-slate-200 bg-[#F8FAFC]/95 backdrop-blur-sm shadow-[inset_0_-1px_0_0_rgb(226_232_240)]">
                  <tr>
                    <th className={`px-4 py-3 text-left ${saasTableHeadCellClass}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-indigo-600" strokeWidth={2} />
                        Mã PR
                      </span>
                    </th>
                    <th className={`px-4 py-3 text-left ${saasTableHeadCellClass}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-violet-600" strokeWidth={2} />
                        Nội dung
                      </span>
                    </th>
                    <th className={`px-4 py-3 text-left ${saasTableHeadCellClass}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-cyan-600" strokeWidth={2} />
                        Người YC
                      </span>
                    </th>
                    <th className={`px-4 py-3 text-left ${saasTableHeadCellClass}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-600" strokeWidth={2} />
                        Phòng ban
                      </span>
                    </th>
                    <th className={`px-4 py-3 text-left ${saasTableHeadCellClass}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-amber-600" strokeWidth={2} />
                        Ngày cần
                      </span>
                    </th>
                    <th className={`px-4 py-3 text-right ${saasTableHeadCellClass}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />
                        Tổng tiền
                      </span>
                    </th>
                    <th className={`px-4 py-3 text-left ${saasTableHeadCellClass}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <ListChecks className="h-3.5 w-3.5 text-indigo-600" strokeWidth={2} />
                        Trạng thái
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className={departmentHeadTableTbodyElevatedClass}>
                  {filteredPRs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center">
                        <div className="mx-auto flex max-w-md flex-col items-center gap-2">
                          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                            <ClipboardCheck className="h-8 w-8" strokeWidth={1.5} />
                          </span>
                          <p className="font-semibold text-slate-700">
                            {approvalPRs.length === 0
                              ? 'Không có PR trong nhóm trạng thái này'
                              : 'Không có PR khớp bộ lọc'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {approvalPRs.length === 0
                              ? approvalQueueEmptyHint(queueFilter)
                              : 'Thử đổi từ khóa hoặc phòng ban.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPRs.map((pr, idx) => (
                      <tr
                        key={pr.id}
                        onClick={() => setDetailPrId(pr.id)}
                        className={`${departmentHeadTableDataRowClasses(idx, { h72: true })} cursor-pointer`}
                      >
                        <td className="relative px-4 py-2 align-middle whitespace-nowrap">
                          <div aria-hidden className={departmentHeadTableAccentRailClass} />
                          <div
                            className={`${departmentHeadTableFirstCellInnerClass} ${departmentHeadTableCellContentWrapClass}`}
                          >
                            <span className="block max-w-full truncate font-semibold text-slate-900">
                              {pr.prNumber}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 align-middle whitespace-nowrap">
                          <div className={departmentHeadTableCellContentWrapClass}>
                            <div className="flex items-center gap-2">
                              <p className="block max-w-full truncate text-sm text-slate-700">{pr.itemName || '—'}</p>
                              {(pr.itemCount ?? 0) > 1 ? (
                                <span className="inline-flex shrink-0 items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                  +{Math.max(0, (pr.itemCount ?? 0) - 1)} item
                                </span>
                              ) : null}
                              {(pr.itemCount ?? 0) > 1 ? (
                                <span className="hidden text-[11px] font-medium text-slate-500 xl:inline">
                                  Nhấn xem chi tiết
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2 align-middle text-sm text-slate-700 whitespace-nowrap">
                          <div className={departmentHeadTableCellContentWrapClass}>
                            <span className="inline-flex items-center rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-cyan-800">
                              {pr.requestor?.username ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 align-middle text-sm text-slate-600 whitespace-nowrap">
                          <div className={departmentHeadTableCellContentWrapClass}>
                            <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                              {pr.department ?? '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 align-middle text-sm text-slate-600 tabular-nums whitespace-nowrap">
                          <div className={departmentHeadTableCellContentWrapClass}>
                            <span>
                              {pr.requiredDate ? new Date(pr.requiredDate).toLocaleDateString('vi-VN') : '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 align-middle text-right text-sm tabular-nums whitespace-nowrap">
                          <div className={departmentHeadTableCellContentWrapClass}>
                            {pr.totalAmount ? (
                              <span className="font-bold text-slate-900">
                                {Number(pr.totalAmount).toLocaleString('vi-VN')}{' '}
                                <span className="font-medium text-slate-500">{pr.currency ?? ''}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 align-middle whitespace-nowrap">
                          <div className={departmentHeadTableCellContentWrapClass}>
                            <span className={saasPrStatusBadgeClass(pr.status)}>
                              {getPRStatusLabel(pr.status)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <AppModal
        open={!!detailPrId && !!selectedPRData}
        onClose={() => setDetailPrId(null)}
        title={
          selectedPRData ? (
            <>
              <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600">
                Trưởng phòng · PR chờ phê duyệt
              </span>
              <span className="mt-1 block font-mono text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                {selectedPRData.prNumber}
              </span>
            </>
          ) : (
            'Chi tiết PR'
          )
        }
        subtitle={
          selectedPRData ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className={saasPrStatusBadgeClass(selectedPRData.status)}>
                {getPRStatusLabel(selectedPRData.status)}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Building2 className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                {selectedPRData.department || '—'}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                Tạo{' '}
                {formatIsoDateToDdMmYyyy(
                  typeof selectedPRData.createdAt === 'string'
                    ? selectedPRData.createdAt
                    : new Date(selectedPRData.createdAt).toISOString(),
                ) || new Date(selectedPRData.createdAt).toLocaleDateString('vi-VN')}
              </span>
            </span>
          ) : undefined
        }
        size="wide"
        zIndexClass="z-[210]"
      >
        {selectedPRData ? (
          <div className="flex min-h-0 flex-col gap-6 md:flex-row md:items-stretch md:gap-0">
            <div className="min-w-0 flex-1 space-y-4 md:border-r md:border-slate-200/60 md:pr-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-md shadow-blue-500/20">
                  <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" aria-hidden />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100">Tổng đi tiếp (mua)</p>
                  <p className="mt-1 text-xl font-black tabular-nums leading-tight">
                    {`${decisionTotals.active.toLocaleString('vi-VN')} ${selectedPRData.currency || 'VND'}`}
                  </p>
                  <ul className="mt-2 space-y-0.5 text-[11px] leading-snug text-blue-100/95">
                    <li>
                      Gốc PR:{' '}
                      <span className="font-semibold text-white">
                        {decisionTotals.original.toLocaleString('vi-VN')}
                      </span>
                    </li>
                    {decisionTotals.rejected > 0 ? (
                      <li className="text-rose-200">
                        Từ chối: {decisionTotals.rejected.toLocaleString('vi-VN')}
                      </li>
                    ) : null}
                    {decisionTotals.revision > 0 ? (
                      <li className="text-amber-200">
                        Trả về sửa: {decisionTotals.revision.toLocaleString('vi-VN')}
                      </li>
                    ) : null}
                    {decisionTotals.onHold > 0 ? (
                      <li className="text-amber-200">
                        Tạm hoãn (cũ): {decisionTotals.onHold.toLocaleString('vi-VN')}
                      </li>
                    ) : null}
                  </ul>
                  <DollarSign
                    className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 text-white/20"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </div>
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-4 text-white shadow-md shadow-violet-500/20">
                  <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" aria-hidden />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-100">Mục đích</p>
                  <p
                    className="mt-1 line-clamp-3 text-sm font-semibold leading-snug"
                    title={selectedPRData.purpose || undefined}
                  >
                    {selectedPRData.purpose?.trim() ? selectedPRData.purpose : '—'}
                  </p>
                  <Info
                    className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 text-white/20"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </div>
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 p-4 text-white shadow-md shadow-amber-500/20">
                  <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" aria-hidden />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-100">Ngày cần nhận</p>
                  <p className="mt-1 text-lg font-black tabular-nums leading-tight">
                    {selectedPRData.requiredDate
                      ? formatIsoDateToDdMmYyyy(selectedPRData.requiredDate) ||
                        new Date(selectedPRData.requiredDate).toLocaleDateString('vi-VN')
                      : '—'}
                  </p>
                  <Calendar
                    className="pointer-events-none absolute bottom-3 right-3 h-6 w-6 text-white/20"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </div>
              </div>

              {selectedPRData.items && selectedPRData.items.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                    <Package className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                      Danh sách vật tư ({selectedPRData.items.length})
                    </h3>
                  </div>
                  <p className="border-b border-slate-50 px-4 py-2 text-[11px] text-slate-500">
                    Dòng <strong className="text-slate-700">mua ngoài</strong>: chọn quyết định bên dưới. Để xử lý hàng loạt
                    (duyệt / trả sửa / từ chối hẳn), dùng nút <strong className="text-slate-700">«Xử lý dòng»</strong> bên
                    phải — popup cho từng dòng mua ngoài. Dòng tách kho chuyển tiếp tự động.
                  </p>
                  <div className="max-h-[min(24rem,55vh)] overflow-auto [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
                    <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
                      <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50">
                        <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          <th className={`px-3 py-2.5 text-left ${saasTableHeadCellClass}`}>#</th>
                          <th className={`min-w-[10rem] px-3 py-2.5 text-left ${saasTableHeadCellClass}`}>Mô tả</th>
                          <th className={`px-3 py-2.5 text-right ${saasTableHeadCellClass}`}>SL</th>
                          <th className={`px-3 py-2.5 text-right ${saasTableHeadCellClass}`}>Đơn giá</th>
                          <th className={`px-3 py-2.5 text-right ${saasTableHeadCellClass}`}>Thành tiền</th>
                          <th className={`px-3 py-2.5 text-left ${saasTableHeadCellClass}`}>Quyết định</th>
                          <th className={`min-w-[8rem] px-3 py-2.5 text-left ${saasTableHeadCellClass}`}>
                            Lý do dòng
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedPRData.items.map((item: any, idx: number) => {
                          const need = isNeedPurchaseItem(item);
                          const rowDeciding = decidingItemIdSet.has(item.id);
                          const serverOutcome = String(item.departmentItemOutcome || '');
                          const outcome = rowDeciding
                            ? (lineOutcomes[item.id] ?? 'APPROVED')
                            : need
                              ? serverOutcome || 'APPROVED'
                              : 'APPROVED';
                          const deptOutcomeLabel = (o: string) => {
                            if (o === 'APPROVED') return 'Đã duyệt';
                            if (o === 'REJECTED') return 'Từ chối hẳn';
                            if (o === 'REVISION_REQUIRED') return 'Chờ chỉnh sửa';
                            if (o === 'ON_HOLD') return 'Tạm hoãn';
                            return o || '—';
                          };
                          return (
                            <tr key={item.id || idx} className={idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}>
                              <td className="px-3 py-2 text-xs tabular-nums text-slate-500">
                                {item.lineNo || idx + 1}
                              </td>
                              <td className="max-w-[min(14rem,50vw)] px-3 py-2 text-slate-800">
                                <span className="flex min-w-0 items-start gap-2">
                                  <Package
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500/80"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                  <span className="min-w-0">
                                    <span
                                      className="block break-words text-xs font-medium leading-snug"
                                      title={item.description}
                                    >
                                      {item.description ?? '—'}
                                    </span>
                                    {!need ? (
                                      <span className="mt-0.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                                        {String(item.status || '').toUpperCase() === 'FROM_STOCK'
                                          ? 'Tách kho'
                                          : String(item.status || '—')}
                                      </span>
                                    ) : null}
                                  </span>
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">
                                {item.qty} {item.unit || ''}
                              </td>
                              <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">
                                {item.unitPrice != null ? Number(item.unitPrice).toLocaleString('vi-VN') : '—'}
                              </td>
                              <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-emerald-700">
                                {item.amount != null ? Number(item.amount).toLocaleString('vi-VN') : '—'}
                              </td>
                              <td className="px-3 py-2 align-middle">
                                {rowDeciding ? (
                                  <select
                                    value={outcome as DeptLineOutcome}
                                    onChange={(e) => {
                                      const v = e.target.value as DeptLineOutcome;
                                      setLineOutcomes((prev) => ({ ...prev, [item.id]: v }));
                                    }}
                                    className="w-full min-w-[7.5rem] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800"
                                  >
                                    <option value="APPROVED">Duyệt</option>
                                    <option value="REVISION_REQUIRED">Trả về chỉnh sửa</option>
                                    <option value="ON_HOLD">Tạm hoãn</option>
                                    <option value="REJECTED">Từ chối hoàn toàn</option>
                                  </select>
                                ) : need ? (
                                  <span className="text-xs font-medium text-slate-600">
                                    {deptOutcomeLabel(outcome)}
                                  </span>
                                ) : (
                                  <span className="text-xs font-medium text-emerald-700">Đi tiếp</span>
                                )}
                              </td>
                              <td className="px-3 py-2 align-middle">
                                {rowDeciding && (outcome === 'REJECTED' || outcome === 'REVISION_REQUIRED') ? (
                                  <input
                                    type="text"
                                    value={lineNotes[item.id] ?? ''}
                                    onChange={(e) =>
                                      setLineNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                                    }
                                    placeholder="Bắt buộc khi từ chối / trả về sửa"
                                    className="w-full min-w-[7rem] rounded-lg border border-rose-200 bg-rose-50/50 px-2 py-1 text-xs text-slate-800 placeholder:text-rose-400"
                                  />
                                ) : rowDeciding ? (
                                  <input
                                    type="text"
                                    value={lineNotes[item.id] ?? ''}
                                    onChange={(e) =>
                                      setLineNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                                    }
                                    placeholder="Tuỳ chọn"
                                    className="w-full min-w-[7rem] rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                                  />
                                ) : need && item.departmentDecisionNote ? (
                                  <span className="text-xs text-slate-500" title={item.departmentDecisionNote}>
                                    {item.departmentDecisionNote}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-300">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {selectedPRData.notes?.trim() ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-slate-500" strokeWidth={2} aria-hidden />
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Ghi chú</p>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{selectedPRData.notes}</p>
                </div>
              ) : null}
            </div>

            <div className="flex w-full shrink-0 flex-col gap-4 border-t border-slate-200/70 bg-gradient-to-b from-slate-50 to-white pt-5 md:mt-0 md:w-72 md:border-l md:border-t-0 md:pl-6 md:pt-0">
              <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-800 text-white shadow-lg shadow-indigo-900/30">
                <div className="border-b border-indigo-700/50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-300">Thông tin chứng từ</p>
                </div>
                <dl className="divide-y divide-indigo-700/30 px-4 py-0 text-sm">
                  <div className="flex items-center justify-between gap-2 py-3">
                    <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                      <Building2 className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                      Phòng ban
                    </dt>
                    <dd className="font-semibold text-white">{selectedPRData.department || '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 py-3">
                    <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                      <User className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                      Người yêu cầu
                    </dt>
                    <dd
                      className="max-w-[10rem] truncate text-right font-semibold text-white"
                      title={selectedPRData.requestor?.username}
                    >
                      {selectedPRData.requestor?.username || '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 py-3">
                    <dt className="flex items-center gap-1.5 text-xs text-indigo-300">
                      <Calendar className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                      Ngày tạo
                    </dt>
                    <dd className="font-semibold tabular-nums text-white">
                      {formatIsoDateToDdMmYyyy(
                        typeof selectedPRData.createdAt === 'string'
                          ? selectedPRData.createdAt
                          : new Date(selectedPRData.createdAt).toISOString(),
                      ) || new Date(selectedPRData.createdAt).toLocaleDateString('vi-VN')}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 py-3">
                    <dt className="text-xs text-indigo-300">Trạng thái</dt>
                    <dd>
                      <span className="inline-flex max-w-full items-center truncate rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/20">
                        {getPRStatusLabel(selectedPRData.status)}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>

              {canActOnSelected ? (
              <div className="mt-auto flex flex-col gap-2 pb-1 md:pb-0">
              <button
                type="button"
                  onClick={handleApproveWithDecisions}
                disabled={approveMutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                  <CheckCircle className="h-4 w-4" strokeWidth={2} />
                  Duyệt & chuyển tiếp
              </button>
              <button
                type="button"
                onClick={handleReturnClick}
                disabled={returnMutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                  <MessageSquare className="h-4 w-4" strokeWidth={2} />
                Trả PR
              </button>
              <button
                type="button"
                onClick={handleRejectClick}
                disabled={rejectMutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                  <XCircle className="h-4 w-4" strokeWidth={2} />
                  Xử lý dòng
              </button>
            </div>
              ) : null}
                </div>
              </div>
        ) : null}
      </AppModal>

      {showRejectLinesModal && selectedPRData && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[420] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[1px] isolation-isolate">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-lines-title"
            className="flex h-[min(40rem,88dvh)] w-full max-w-[min(72rem,96vw)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_-12px_rgba(15,23,42,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 border-b border-slate-200 bg-gradient-to-r from-indigo-50/90 via-white to-slate-50 px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200/80">
                  <ListChecks className="h-6 w-6" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 id="reject-lines-title" className="text-lg font-bold tracking-tight text-slate-900">
                    Xử lý dòng mua ngoài
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    <span className="inline-flex items-center gap-1 font-medium text-indigo-700">
                      <Package className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
                      Mua ngoài
                    </span>
                    : chọn <strong className="font-medium text-slate-800">Trả về chỉnh sửa</strong> (requestor sửa rồi gửi
                    lại) hoặc <strong className="font-medium text-slate-800">Từ chối hoàn toàn</strong> (không mua
                    nữa). Các dòng khác chỉ xem.
                </p>
              </div>
                </div>
              </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 sm:px-5">
              {itemsRequiringDeptDecision.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRejectLinesDraft((prev) => {
                        const next = { ...prev };
                        for (const it of itemsRequiringDeptDecision) {
                          next[it.id] = { action: 'APPROVED', note: '' };
                        }
                        return next;
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm hover:bg-emerald-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} aria-hidden />
                    Đặt tất cả → Duyệt dòng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectLinesDraft((prev) => {
                        const next = { ...prev };
                        for (const it of itemsRequiringDeptDecision) {
                          next[it.id] = {
                            action: 'RETURN_REVISION',
                            note: prev[it.id]?.note ?? '',
                          };
                        }
                        return next;
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-50"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-amber-600" strokeWidth={2} aria-hidden />
                    Đặt tất cả → Trả về chỉnh sửa
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-500">Không có dòng mua ngoài trên PR này.</span>
              )}
              <button
                type="button"
                onClick={openFullPrRejectModal}
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 underline-offset-2 hover:text-rose-700 hover:underline"
              >
                <XCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                Từ chối toàn bộ PR (đóng chứng từ)…
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/40 px-3 py-3 sm:px-4">
              <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-inner [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]">
                <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-gradient-to-b from-slate-100 to-slate-50/95 shadow-[0_1px_0_0_rgb(226_232_240)]">
                    <tr className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                      <th scope="col" className="w-12 whitespace-nowrap px-3 py-3 text-center">
                        <span className="inline-flex items-center justify-center gap-1">
                          <Hash className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} aria-hidden />
                  </span>
                      </th>
                      <th scope="col" className="w-[8.5rem] whitespace-nowrap px-2 py-3">
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3.5 w-3.5 text-indigo-600" strokeWidth={2} aria-hidden />
                          Loại
                  </span>
                      </th>
                      <th scope="col" className="min-w-[10rem] px-2 py-3">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5 text-violet-600" strokeWidth={2} aria-hidden />
                          Mô tả
                        </span>
                      </th>
                      <th scope="col" className="w-24 whitespace-nowrap px-2 py-3 text-right">
                        <span className="inline-flex items-center justify-end gap-1">
                          <Scale className="h-3.5 w-3.5 text-cyan-600" strokeWidth={2} aria-hidden />
                          SL
                        </span>
                      </th>
                      <th scope="col" className="w-36 whitespace-nowrap px-2 py-3 text-right">
                        <span className="inline-flex items-center justify-end gap-1">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} aria-hidden />
                          Thành tiền
                        </span>
                      </th>
                      <th scope="col" className="min-w-[13rem] px-2 py-3 align-bottom">
                        <span className="inline-flex flex-col gap-0.5 text-left">
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <ListChecks className="h-3.5 w-3.5 text-indigo-600" strokeWidth={2} aria-hidden />
                            Quyết định
                          </span>
                          <span className="text-[10px] font-normal normal-case tracking-normal text-slate-500">
                            Duyệt / Trả sửa / Từ chối hẳn / Tạm hoãn
                          </span>
                        </span>
                      </th>
                      <th scope="col" className="min-w-[11rem] px-2 py-3">
                        <span className="inline-flex items-center gap-1">
                          <StickyNote className="h-3.5 w-3.5 text-amber-600" strokeWidth={2} aria-hidden />
                          Lý do
                        </span>
                      </th>
                      </tr>
                    </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(selectedPRData.items as any[]).map((item: any, idx: number) => {
                      const need = isNeedPurchaseItem(item);
                      const inDeciding = decidingItemIdSet.has(item.id);
                      const d = inDeciding
                        ? rejectLinesDraft[item.id] ?? { action: 'APPROVED' as RejectLinesModalAction, note: '' }
                        : null;
                      const fromStock = String(item.status || '').toUpperCase() === 'FROM_STOCK';
                      const rowHighlight =
                        inDeciding && d
                          ? d.action === 'REJECT_FINAL'
                            ? 'bg-rose-50/80'
                            : d.action === 'RETURN_REVISION'
                              ? 'bg-amber-50/75'
                              : d.action === 'ON_HOLD'
                                ? 'bg-slate-100/90'
                                : idx % 2 === 1
                                  ? 'bg-slate-50/50'
                                  : 'bg-white'
                          : idx % 2 === 1
                            ? 'bg-slate-50/50'
                            : 'bg-white';
                      const noteEnabled = inDeciding && d && d.action !== 'APPROVED';
                      const noteRequired = inDeciding && d && needsMandatoryLineNoteForModal(d.action);
                      return (
                        <tr key={item.id || idx} className={rowHighlight}>
                          <td className="px-3 py-2.5 text-center align-middle">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold tabular-nums text-slate-700 ring-1 ring-slate-200/80">
                              {item.lineNo ?? idx + 1}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 align-middle">
                            {need ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-800">
                                <Package className="h-3 w-3 text-indigo-600" strokeWidth={2} aria-hidden />
                                Mua ngoài
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                                <Warehouse className="h-3 w-3 text-amber-600" strokeWidth={2} aria-hidden />
                                {fromStock ? 'Tách kho' : String(item.status || '—')}
                              </span>
                            )}
                          </td>
                          <td className="max-w-[14rem] px-2 py-2.5 align-middle text-slate-900">
                            <span className="line-clamp-2 text-sm font-medium leading-snug" title={item.description}>
                              {item.description ?? '—'}
                              </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2.5 text-right align-middle text-sm tabular-nums text-slate-700">
                            {item.qty}{' '}
                            <span className="text-slate-500">{item.unit || ''}</span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2.5 text-right align-middle">
                            {item.amount != null ? (
                              <span className="inline-flex items-center justify-end gap-0.5 text-sm font-bold tabular-nums text-emerald-800">
                                <DollarSign className="h-3.5 w-3.5 text-emerald-600 opacity-80" strokeWidth={2} aria-hidden />
                                {Number(item.amount).toLocaleString('vi-VN')}
                                <span className="text-xs font-semibold text-emerald-700/80">
                                  {selectedPRData.currency || 'VND'}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2 align-top">
                            {inDeciding && d ? (
                              <fieldset className="min-w-0 space-y-1.5 border-0 p-0">
                                <legend className="sr-only">Quyết định dòng</legend>
                                {(
                                  [
                                    ['APPROVED', 'Duyệt dòng'],
                                    ['RETURN_REVISION', 'Trả về chỉnh sửa'],
                                    ['REJECT_FINAL', 'Từ chối hoàn toàn'],
                                    ['ON_HOLD', 'Tạm hoãn'],
                                  ] as const
                                ).map(([value, label]) => (
                                  <label
                                    key={value}
                                    className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 hover:bg-slate-50"
                                  >
                                    <input
                                      type="radio"
                                      name={`dept-line-outcome-${item.id}`}
                                      checked={d.action === value}
                                      onChange={() =>
                                        setRejectLinesDraft((prev) => ({
                                          ...prev,
                                          [item.id]: { action: value, note: prev[item.id]?.note ?? '' },
                                        }))
                                      }
                                      className="mt-0.5 h-3.5 w-3.5 shrink-0 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-[11px] font-medium leading-snug text-slate-800">{label}</span>
                                  </label>
                                ))}
                              </fieldset>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2 align-middle">
                            {inDeciding && d ? (
                              <textarea
                                value={d.note}
                                onChange={(e) =>
                                  setRejectLinesDraft((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      action: prev[item.id]?.action ?? 'APPROVED',
                                      note: e.target.value,
                                    },
                                  }))
                                }
                                disabled={!noteEnabled}
                                placeholder={
                                  !noteEnabled
                                    ? 'Chọn «Trả về chỉnh sửa», «Từ chối hoàn toàn» hoặc «Tạm hoãn» để nhập'
                                    : noteRequired
                                      ? 'Bắt buộc: lý do trả sửa hoặc từ chối…'
                                      : 'Tuỳ chọn (tạm hoãn)…'
                                }
                                rows={2}
                                className={`w-full min-h-[2.75rem] resize-y rounded-lg border px-2 py-1.5 text-xs leading-snug outline-none transition ${
                                  noteEnabled
                                    ? noteRequired
                                      ? 'border-amber-200 bg-amber-50/40 text-slate-900 placeholder:text-amber-600/70 focus:border-amber-400 focus:ring-2 focus:ring-amber-300/40'
                                      : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300/30'
                                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 placeholder:text-slate-400'
                                }`}
                              />
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                                Không áp dụng
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
              </div>

            <div className="shrink-0 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectLinesModal(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <X className="h-4 w-4 text-slate-500" strokeWidth={2} aria-hidden />
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={applyRejectLinesFromModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 hover:bg-indigo-700"
                >
                  <Check className="h-4 w-4 opacity-95" strokeWidth={2.5} aria-hidden />
                  Áp dụng quyết định dòng
                </button>
              </div>
              </div>
          </div>
        </div>,
            document.body,
          )
        : null}

      {showReturnModal && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[420] flex items-center justify-center bg-black/50 isolation-isolate">
          <div
            className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">Trả PR yêu cầu bổ sung</h3>
            <textarea
              value={modalComment}
              onChange={(e) => setModalComment(e.target.value)}
              placeholder="Nhập lý do trả PR..."
              className="mt-4 h-32 w-full resize-none rounded-lg border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowReturnModal(false);
                  setModalComment('');
                }}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleReturnSubmit}
                disabled={!modalComment.trim() || returnMutation.isPending}
                className="flex-1 rounded-lg bg-amber-600 py-2 font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {returnMutation.isPending ? 'Đang xử lý…' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}

      {showRejectModal && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[420] flex items-center justify-center bg-black/50 isolation-isolate">
          <div
            className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">Từ chối PR</h3>
            <textarea
              value={modalComment}
              onChange={(e) => setModalComment(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              className="mt-4 h-32 w-full resize-none rounded-lg border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setModalComment('');
                }}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={!modalComment.trim() || rejectMutation.isPending}
                className="flex-1 rounded-lg bg-rose-600 py-2 font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Đang xử lý…' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export default PRApproval;
