import { useEffect, useState } from 'react';
import { useMatchMedia } from './useMatchMedia';

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

/**
 * Đếm từ 0 → `end` trong `durationMs` (số nguyên, làm tròn).
 * `prefers-reduced-motion`: nhảy thẳng tới `end`.
 */
export function useCountUp(end: number, durationMs: number = 1000) {
  const target = Number.isFinite(end) ? Math.max(0, Math.round(end)) : 0;
  const reduceMotion = useMatchMedia('(prefers-reduced-motion: reduce)');
  const [value, setValue] = useState(() => (reduceMotion ? target : 0));

  useEffect(() => {
    if (reduceMotion) {
      setValue(target);
      return;
    }

    let cancelled = false;
    let raf = 0;
    const startVal = 0;
    const t0 = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - t0;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      const next = Math.round(startVal + (target - startVal) * eased);
      setValue(next);
      if (t < 1 && !cancelled) raf = requestAnimationFrame(tick);
    };

    setValue(0);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [target, durationMs, reduceMotion]);

  return value;
}
