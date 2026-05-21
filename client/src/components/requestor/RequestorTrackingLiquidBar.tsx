type RequestorTrackingLiquidBarProps = {
  label: string;
  sublabel?: string | null;
  percent: number;
  tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'slate' | 'indigo';
  fastFlow?: boolean;
  pulseWhenLow?: boolean;
};

const TONE_GRADIENT: Record<RequestorTrackingLiquidBarProps['tone'], string> = {
  emerald: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-green-600',
  amber: 'bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500',
  rose: 'bg-gradient-to-r from-rose-500 via-red-500 to-pink-600',
  blue: 'bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-500',
  slate: 'bg-gradient-to-r from-slate-400 via-slate-300 to-slate-500',
  indigo: 'bg-gradient-to-r from-indigo-500 via-violet-400 to-purple-500',
};

export function RequestorTrackingLiquidBar({
  label,
  sublabel,
  percent,
  tone,
  fastFlow = false,
  pulseWhenLow = false,
}: RequestorTrackingLiquidBarProps) {
  const width = percent > 0 ? Math.max(2, Math.min(100, percent)) : 0;
  const showLiquid = width > 0 && tone !== 'slate';
  const liquidClass = fastFlow ? 'animate-liquid-flow-fast' : 'animate-liquid-flow';

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-medium text-slate-600">{label}</span>
        {sublabel ? (
          <span className="truncate text-right font-semibold text-slate-700">{sublabel}</span>
        ) : null}
      </div>
      <div
        className={`h-2 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner ${
          pulseWhenLow && width > 0 && width < 50 ? 'animate-pulse' : ''
        }`}
      >
        <div
          className={`relative h-full transition-all duration-700 ease-out ${TONE_GRADIENT[tone]}`}
          style={{ width: `${width}%` }}
        >
          {showLiquid ? (
            <div
              className={`absolute inset-0 ${liquidClass}`}
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
                backgroundSize: '200% 100%',
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
