import { Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { MiniSparkline } from './MiniSparkline';

export function sparklineTrendPct(points: number[]): number {
  if (points.length < 2) return 0;
  const first = points[0] || 0;
  const last = points[points.length - 1] || 0;
  if (first === 0) return last > 0 ? 100 : 0;
  return Math.round(((last - first) / first) * 100);
}

type KpiSparklineTrendProps = {
  points: number[];
  strokeClassName: string;
  periodLabel?: string;
};

/** Xu hướng NCC / workload — sparkline SVG + % so với kỳ trước. */
export function KpiSparklineTrend({
  points,
  strokeClassName,
  periodLabel = 'vs 6 tuần trước',
}: KpiSparklineTrendProps) {
  const pct = sparklineTrendPct(points);
  const up = pct >= 0;

  return (
    <div className="flex flex-col items-end gap-1.5" aria-label={`Xu hướng ${up ? 'tăng' : 'giảm'} ${Math.abs(pct)} phần trăm`}>
      <MiniSparkline points={points} strokeClassName={strokeClassName} width={120} height={40} />
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-bold tabular-nums ${
          up ? 'text-emerald-700' : 'text-rose-700'
        }`}
      >
        {up ? (
          <TrendingUp className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
        )}
        {up ? '+' : ''}
        {pct}% <span className="font-semibold text-slate-500">{periodLabel}</span>
      </span>
    </div>
  );
}

export type ThresholdLevel = 'safe' | 'caution' | 'critical';

export function thresholdLevelFromOverload(
  overloadedCount: number,
  totalBuyers: number,
): ThresholdLevel {
  if (overloadedCount <= 0 || totalBuyers <= 0) return 'safe';
  const share = overloadedCount / totalBuyers;
  if (share >= 0.35 || overloadedCount >= 3) return 'critical';
  if (share >= 0.15 || overloadedCount >= 1) return 'caution';
  return 'safe';
}

type ThresholdAlertMeterProps = {
  level: ThresholdLevel;
  overloadedCount: number;
  thresholdPr: number;
};

/** Thước 3 vùng Xanh — Vàng — Đỏ; vị trí kim theo mức quá tải thực tế. */
export function ThresholdAlertMeter({ level, overloadedCount, thresholdPr }: ThresholdAlertMeterProps) {
  const markerLeft =
    level === 'safe' ? '12%' : level === 'caution' ? '50%' : '88%';

  const statusLabel =
    level === 'safe'
      ? 'Vùng an toàn'
      : level === 'caution'
        ? 'Cần theo dõi'
        : 'Vượt định mức';

  return (
    <div className="w-full max-w-[148px]" role="img" aria-label={`${statusLabel}: ${overloadedCount} buyer quá tải`}>
      <div className="relative h-2.5 overflow-hidden rounded-full ring-1 ring-slate-200/80">
        <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-emerald-400 to-emerald-500" />
        <div className="absolute inset-y-0 left-1/3 w-1/3 bg-gradient-to-r from-amber-400 to-amber-500" />
        <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-r from-rose-500 to-red-600" />
        <div
          className="absolute top-1/2 z-[1] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-800 shadow-md ring-1 ring-slate-300/80"
          style={{ left: markerLeft }}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-right text-[10px] font-semibold leading-tight text-slate-600">
        {overloadedCount === 0 ? (
          <span className="text-emerald-700">{statusLabel}</span>
        ) : (
          <>
            <span className={level === 'critical' ? 'text-rose-700' : 'text-amber-800'}>{statusLabel}</span>
            <span className="block text-slate-500">&gt;{thresholdPr} PR đang xử lý</span>
          </>
        )}
      </p>
    </div>
  );
}

type SlaResolutionClockProps = {
  avgHours: number;
  slaHours: number;
  openIssues: number;
};

/** Thời gian xử lý TB so với SLA quy định — không dùng biểu đồ dốc giả. */
export function SlaResolutionClock({ avgHours, slaHours, openIssues }: SlaResolutionClockProps) {
  const fasterPct = slaHours > 0 ? Math.round(((slaHours - avgHours) / slaHours) * 100) : 0;
  const withinSla = avgHours <= slaHours;

  return (
    <div
      className="flex w-full max-w-[148px] flex-col items-end gap-1"
      role="img"
      aria-label={`Thời gian xử lý trung bình ${avgHours} giờ`}
    >
      <div className="flex items-center gap-2 rounded-xl border border-orange-200/80 bg-orange-50/90 px-2.5 py-2 ring-1 ring-white/60">
        <Clock className="h-5 w-5 shrink-0 text-orange-600" strokeWidth={2} aria-hidden />
        <div className="text-right">
          <p className="text-lg font-black tabular-nums leading-none text-orange-950">
            {avgHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
            <span className="ml-0.5 text-xs font-bold text-orange-700">giờ</span>
          </p>
        </div>
      </div>
      <p className="text-right text-[10px] font-semibold leading-snug text-slate-600">
        {openIssues === 0 ? (
          <>
            <span className="text-emerald-700">Không có NCC rủi ro mở</span>
            <span className="mt-0.5 block">
              {withinSla && fasterPct > 0
                ? `Nhanh hơn ${fasterPct}% so với SLA ${slaHours}h`
                : `SLA mục tiêu: ${slaHours}h`}
            </span>
          </>
        ) : (
          <span className="text-orange-800">{openIssues} NCC cần theo dõi</span>
        )}
      </p>
    </div>
  );
}

export type TeamMemberSlot = {
  id: string;
  label: string;
  status: 'idle' | 'normal' | 'overload';
};

type TeamAllocationGridProps = {
  members: TeamMemberSlot[];
  assignablePct: number;
};

/** Ma trận chấm: xanh = sẵn sàng, xám = bận, đỏ = quá tải. */
export function TeamAllocationGrid({ members, assignablePct }: TeamAllocationGridProps) {
  const visible = members.slice(0, 12);
  const overflow = members.length - visible.length;

  return (
    <div className="w-full max-w-[148px]" role="img" aria-label="Phân bổ tải buyer trong đội">
      <div className="flex flex-wrap justify-end gap-1.5">
        {visible.map((m) => (
          <span
            key={m.id}
            title={`${m.label}: ${
              m.status === 'idle' ? 'Còn capacity' : m.status === 'overload' ? 'Quá tải' : 'Đang xử lý'
            }`}
            className={`h-3 w-3 rounded-full ring-2 ring-white ${
              m.status === 'idle'
                ? 'bg-emerald-500 shadow-sm shadow-emerald-500/40'
                : m.status === 'overload'
                  ? 'bg-rose-500 shadow-sm shadow-rose-500/35'
                  : 'bg-slate-300'
            }`}
          />
        ))}
        {overflow > 0 ? (
          <span className="flex h-3 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-200 px-1 text-[9px] font-bold text-slate-600">
            +{overflow}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] font-semibold text-sky-800">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        <span>Sẵn sàng</span>
        <span className="text-slate-400">·</span>
        <span className="inline-block h-2 w-2 rounded-full bg-slate-300" aria-hidden />
        <span>Bận</span>
      </div>
      <p className="mt-1 text-right text-[10px] font-bold tabular-nums text-sky-700">
        ~{assignablePct}% room phân thêm
      </p>
    </div>
  );
}

export function mapBuyersToTeamSlots(
  performance: Array<{ name: string; prsHandled: number }>,
  idleTh: number,
  overloadTh: number,
): TeamMemberSlot[] {
  return performance.map((b, i) => {
    let status: TeamMemberSlot['status'] = 'normal';
    if (b.prsHandled >= overloadTh) status = 'overload';
    else if (b.prsHandled < idleTh) status = 'idle';
    return {
      id: `${b.name}-${i}`,
      label: b.name,
      status,
    };
  });
}
