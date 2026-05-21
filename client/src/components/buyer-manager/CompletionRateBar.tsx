export type CompletionRateBarProps = {
  /** 0–100 */
  percent: number;
  numeratorLabel: string;
  denominatorLabel: string;
  className?: string;
};

/** Thanh tiến độ tối — tỷ lệ hoàn thành PR → PO. */
export function CompletionRateBar({
  percent,
  numeratorLabel,
  denominatorLabel,
  className = '',
}: CompletionRateBarProps) {
  const safe = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return (
    <div
      className={`rounded-[28px] border border-slate-800/80 bg-slate-900 p-6 text-white shadow-[0_20px_25px_-5px_rgba(15,23,42,0.25),inset_0_1px_0_0_rgba(255,255,255,0.06)] ring-1 ring-indigo-500/15 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_32px_-8px_rgba(15,23,42,0.35)] md:p-8 ${className}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Hiệu suất hoàn thành</p>
      <p className="mt-2 text-lg font-bold text-white">PR đã chuyển thành PO</p>
      <p className="mt-4 text-4xl font-black tabular-nums tracking-tight text-white md:text-[2.5rem]">
        {safe.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
        <span className="ml-1 text-2xl font-bold text-slate-400">%</span>
      </p>
      <p className="mt-3 text-xs font-medium leading-relaxed text-slate-400">
        {numeratorLabel} / {denominatorLabel}
      </p>
      <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800/90 ring-1 ring-white/5 shadow-inner">
        <div
          className="relative h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-green-600 transition-[width] duration-700 ease-out"
          style={{ width: `${safe}%` }}
          role="progressbar"
          aria-valuenow={Math.round(safe)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {/* Liquid Flow Animation */}
          <div
            className="absolute inset-0 animate-liquid-flow"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              backgroundSize: '200% 100%',
            }}
          />
          
          {/* Micro Bubbles */}
          {safe > 20 && (
            <>
              <div 
                className="absolute left-[15%] top-0.5 h-1 w-1 animate-pulse rounded-full bg-white/40" 
                style={{ animationDuration: '2.2s' }} 
              />
              <div 
                className="absolute left-[45%] top-1 h-0.5 w-0.5 animate-pulse rounded-full bg-white/30" 
                style={{ animationDuration: '2.8s' }} 
              />
              <div 
                className="absolute left-[75%] top-0.5 h-1 w-1 animate-pulse rounded-full bg-white/35" 
                style={{ animationDuration: '3.1s' }} 
              />
            </>
          )}
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
      `}</style>
    </div>
  );
}
