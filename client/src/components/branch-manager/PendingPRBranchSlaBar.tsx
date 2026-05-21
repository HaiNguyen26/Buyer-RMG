import { useMemo } from 'react';

/** SLA cửa sổ chờ GĐ chi nhánh (giờ) — chỉnh một chỗ nếu nghiệp vụ đổi. */
const BRANCH_APPROVAL_SLA_MS = 72 * 60 * 60 * 1000;

export type PendingPRBranchSlaBarProps = {
  createdAt: string;
  requiredDate?: string | null;
  lastApproval?: { createdAt?: string } | null;
  /** Hiển thị block (kết hợp step animation). */
  visible?: boolean;
  className?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function PendingPRBranchSlaBar({
  createdAt,
  requiredDate,
  lastApproval,
  visible = true,
  className = '',
}: PendingPRBranchSlaBarProps) {
  const computed = useMemo(() => {
    const startMs = lastApproval?.createdAt
      ? new Date(lastApproval.createdAt).getTime()
      : new Date(createdAt).getTime();
    const windowEndMs = startMs + BRANCH_APPROVAL_SLA_MS;
    const reqMs = requiredDate ? new Date(requiredDate).getTime() : NaN;
    const deadlineMs =
      Number.isFinite(reqMs) && reqMs > startMs ? Math.min(windowEndMs, reqMs) : windowEndMs;
    const now = Date.now();
    const elapsed = Math.max(0, now - startMs);
    const budget = Math.max(1, deadlineMs - startMs);
    const pctElapsed = clamp((elapsed / budget) * 100, 0, 100);
    const overdue = now > deadlineMs;
    const remainingMs = Math.max(0, deadlineMs - now);

    let tone: 'ok' | 'warn' | 'over' = 'ok';
    if (overdue) tone = 'over';
    else if (pctElapsed >= 70) tone = 'warn';

    const barGradient =
      tone === 'over'
        ? 'from-rose-600 via-red-500 to-orange-500'
        : tone === 'warn'
          ? 'from-amber-500 via-yellow-400 to-amber-600'
          : 'from-emerald-500 via-teal-400 to-green-600';

    const liquidClass = tone === 'over' ? 'animate-liquid-flow-fast' : 'animate-liquid-flow';

    let sublabel = '';
    if (overdue) {
      const oh = Math.floor((now - deadlineMs) / (60 * 60 * 1000));
      sublabel = oh >= 1 ? `Quá hạn ~${oh} giờ` : `Quá hạn < 1 giờ`;
    } else {
      const h = Math.floor(remainingMs / (60 * 60 * 1000));
      const m = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      sublabel = h >= 1 ? `Còn ~${h} giờ ${m} phút trong SLA` : `Còn ~${m} phút trong SLA`;
    }

    return { pctElapsed, overdue, barGradient, liquidClass, sublabel };
  }, [createdAt, requiredDate, lastApproval]);

  if (!visible) return null;

  const { pctElapsed, barGradient, liquidClass, sublabel } = computed;

  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm ring-1 ring-slate-900/5 ${className}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">SLA chờ duyệt chi nhánh</span>
        <span className="text-xs font-medium tabular-nums text-slate-600">{sublabel}</span>
      </div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
        <span>Đã trôi trong cửa sổ</span>
        <span className="font-semibold tabular-nums">{Math.round(pctElapsed)}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/90 shadow-inner ring-1 ring-slate-900/5">
        <div
          className={`relative h-full rounded-full bg-gradient-to-r ${barGradient} transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]`}
          style={{ width: `${pctElapsed}%` }}
          role="progressbar"
          aria-valuenow={Math.round(pctElapsed)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`absolute inset-0 ${liquidClass}`}
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.42), transparent)',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      </div>

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
          animation: liquid-flow-fast 1.6s linear infinite;
        }
      `}</style>
    </div>
  );
}
