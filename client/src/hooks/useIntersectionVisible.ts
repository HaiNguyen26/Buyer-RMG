import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

export type UseIntersectionVisibleOptions = {
  threshold?: number | number[];
  rootMargin?: string;
  /** Khi scroll ra khỏi viewport cho phép lần vào sau bật lại reveal (generation). Mặc định false. */
  resetWhenOutOfView?: boolean;
  /**
   * Chỉ coi là “vào khung” để chạy reveal / generation khi `intersectionRatio` ≥ giá trị (0–1).
   * Tránh kích hoạt khi mới ló vài pixel mép. Sau khi đã đạt ngưỡng một lần, UI vẫn hiển thị
   * khi còn giao root (không tắt chỉ vì kéo xuống dưới ngưỡng). Mặc định 0 = như `isIntersecting`.
   */
  minIntersectionRatio?: number;
  /**
   * Gốc quan sát tùy chỉnh (ví dụ ref của `<main>` cuộn). Mặc định: tự tìm tổ tiên scroll gần nhất;
   * nếu không có thì dùng viewport (hành vi `null` của IntersectionObserver).
   */
  root?: Element | null;
};

const DEFAULT_THRESHOLD = 0.2;

/** Tổ tiên scroll gần nhất — IO với `root: null` thường sai lệch khi thực tế cuộn trong `main` overflow, không phải document. */
function getNearestScrollableAncestor(el: Element): Element | null {
  let p: Element | null = el.parentElement;
  while (p && p !== document.body) {
    const style = window.getComputedStyle(p);
    const oy = style.overflowY;
    const scrollableY =
      (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && p.scrollHeight > p.clientHeight + 1;
    if (scrollableY) {
      return p;
    }
    p = p.parentElement;
  }
  return null;
}

/**
 * Theo dõi khi một phần element (threshold) vào viewport (scroll main / page).
 * Dùng cùng `generation`: mỗi lần "reveal" hợp lệ có thể tăng để ép remount chart (React key trick).
 */
export function useIntersectionVisible(
  elementRef: RefObject<Element | null>,
  options: UseIntersectionVisibleOptions = {},
): { isIntersecting: boolean; generation: number } {
  const {
    threshold = DEFAULT_THRESHOLD,
    rootMargin = '0px 0px 14% 0px',
    resetWhenOutOfView = false,
    minIntersectionRatio = 0,
    root: rootOption,
  } = options;

  const [isIntersecting, setIsIntersecting] = useState(false);
  const [generation, setGeneration] = useState(0);
  const revealedForCycleRef = useRef(false);
  /** Đã đạt minIntersectionRatio ít nhất một lần kể từ lần còn giao root — giữ fade hiển thị khi vẫn ló trên màn */
  const passedMinWhileInViewRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    let rafId = 0;
    let attempts = 0;
    /** Khi parent return sớm (ví dụ isLoading), ref chưa gắn DOM ở lần effect đầu — cần thử lại frame sau. */
    const MAX_RAF_ATTEMPTS = 180;

    const attach = () => {
      if (cancelled) return;
      const el = elementRef.current;
      if (!el) {
        attempts += 1;
        if (attempts < MAX_RAF_ATTEMPTS) {
          rafId = requestAnimationFrame(attach);
        }
        return;
      }

      const resolvedRoot =
        rootOption !== undefined ? rootOption : getNearestScrollableAncestor(el);

      const minR = Math.min(1, Math.max(0, minIntersectionRatio));
      const thresholdSteps =
        minR > 0
          ? Array.from({ length: 21 }, (_, i) => Math.round((i / 20) * 100) / 100)
          : threshold;

      observer = new IntersectionObserver(
        ([entry]) => {
          const ratio = entry?.intersectionRatio ?? 0;
          const rawIntersecting = Boolean(entry?.isIntersecting);
          const passesMin = minR <= 0 || ratio >= minR;

          if (!rawIntersecting) {
            passedMinWhileInViewRef.current = false;
            setIsIntersecting(false);
            if (resetWhenOutOfView) {
              revealedForCycleRef.current = false;
            }
            return;
          }

          if (passesMin) {
            passedMinWhileInViewRef.current = true;
          }

          const uiVisible = minR <= 0 ? rawIntersecting : passedMinWhileInViewRef.current;

          if (passesMin && !revealedForCycleRef.current) {
            revealedForCycleRef.current = true;
            setGeneration((g) => g + 1);
          }

          setIsIntersecting(uiVisible);
        },
        {
          ...(resolvedRoot ? { root: resolvedRoot } : {}),
          rootMargin,
          threshold: thresholdSteps,
        },
      );

      observer.observe(el);
    };

    attach();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      passedMinWhileInViewRef.current = false;
    };
  }, [elementRef, threshold, rootMargin, resetWhenOutOfView, rootOption, minIntersectionRatio]);

  return { isIntersecting, generation };
}
