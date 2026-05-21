import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Co giãn theo chiều ngang: không vượt quá (100vw − padding), vẫn giới hạn max của từng cỡ */
const SIZE_CLASS: Record<
  'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full' | 'wide',
  string
> = {
  sm: 'max-w-[min(100%,min(calc(100vw-1.5rem),24rem))]',
  md: 'max-w-[min(100%,min(calc(100vw-1.5rem),28rem))]',
  lg: 'max-w-[min(100%,min(calc(100vw-1.5rem),32rem))]',
  xl: 'max-w-[min(100%,min(calc(100vw-1.5rem),36rem))]',
  '2xl': 'max-w-[min(100%,min(calc(100vw-1.5rem),42rem))]',
  '3xl': 'max-w-[min(100%,min(calc(100vw-1.5rem),64rem))]',
  full: 'max-w-[min(100%,min(calc(100vw-1.5rem),72rem))]',
  wide: 'max-w-[min(100%,min(calc(100vw-1.5rem),96rem))]',
};

export type AppModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Tiêu đề thanh header (optional) */
  title?: ReactNode;
  /** Dòng phụ dưới tiêu đề (SaaS-style), hiển thị bình thường */
  subtitle?: ReactNode;
  /** Icon nhỏ bên trái tiêu đề (thường 20–24px) */
  headerIcon?: ReactNode;
  /** Mô tả cho aria-describedby */
  description?: string;
  size?: keyof typeof SIZE_CLASS;
  /** Đóng khi bấm vùng nền (default: true) */
  closeOnBackdropClick?: boolean;
  /** Đóng khi nhấn Escape (default: true) */
  closeOnEscape?: boolean;
  /** Nút X góc phải (default: true) */
  showCloseButton?: boolean;
  className?: string;
  /** Vùng chân modal (nút Hủy / Lưu, …) */
  footer?: ReactNode;
  /** lớp z-index Tailwind, mặc định phủ toàn layout dashboard */
  zIndexClass?: string;
  /** false: không giới hạn chiều cao panel / không cuộn vùng body (toàn bộ nội dung hiển thị) */
  contentScroll?: boolean;
};

/**
 * Modal dùng chung: portal → `document.body`, overlay mờ + blur toàn viewport,
 * animation khi mở, khóa scroll body, hỗ trợ Escape.
 */
export function AppModal({
  open,
  onClose,
  children,
  title,
  subtitle,
  headerIcon,
  description,
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = '',
  footer,
  zIndexClass = 'z-[200]',
  contentScroll = true,
}: AppModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    /** Dashboard cuộn trong <main>, không phải trên body — khóa để modal không “trôi” theo nền. */
    const mains = document.querySelectorAll('main');
    const mainPrev: { el: HTMLElement; overflow: string; overscroll: string }[] = [];
    mains.forEach((node) => {
      const el = node as HTMLElement;
      mainPrev.push({
        el,
        overflow: el.style.overflow,
        overscroll: el.style.overscrollBehavior,
      });
      el.style.overflow = 'hidden';
      el.style.overscrollBehavior = 'none';
    });

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      mainPrev.forEach(({ el, overflow, overscroll }) => {
        el.style.overflow = overflow;
        el.style.overscrollBehavior = overscroll;
      });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => panelRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  const hasHeader = title != null && title !== '' ? true : showCloseButton;

  const modalTree = (
    <div
      className={`fixed inset-0 h-[100dvh] max-h-[100dvh] overflow-hidden overscroll-none ${zIndexClass}`}
      role="presentation"
    >
      <style>{`@keyframes appModalZoomIn{from{opacity:0;transform:scale(0.94) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

      <div
        role="presentation"
        aria-hidden
        style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(15,23,42,0.6)' }}
        className={`fixed inset-0 ${closeOnBackdropClick ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={closeOnBackdropClick ? onClose : undefined}
      />

      <div
        className="relative z-[1] flex h-full min-h-0 w-full items-center justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-5 sm:pt-6 sm:pb-6 md:px-6"
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title != null && title !== '' ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          style={{
            boxShadow:
              '0 32px 64px -12px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.06) inset',
            animation: 'appModalZoomIn 0.22s cubic-bezier(0.16,1,0.3,1)',
          }}
          className={`relative my-4 flex w-full flex-col rounded-2xl border border-slate-200/80 bg-white outline-none sm:my-6 ${
            contentScroll
              ? 'max-h-[min(90dvh,calc(100dvh-max(env(safe-area-inset-top),0px)-max(env(safe-area-inset-bottom),0px)-2rem))] overflow-hidden'
              : 'max-h-none overflow-visible'
          } ${SIZE_CLASS[size]} ${className}`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
        {description ? (
          <p id={descriptionId} className="sr-only">
            {description}
          </p>
        ) : null}

        {hasHeader ? (
          <div className="relative shrink-0 border-b border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-white px-5 pb-5 pt-5 sm:px-6">
            {showCloseButton ? (
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30 sm:right-4 sm:top-4"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            ) : null}
            <div className="flex items-start gap-3.5 pr-10 sm:pr-12">
              {headerIcon ? (
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200/80"
                  aria-hidden
                >
                  {headerIcon}
                </div>
              ) : null}
              <div className="min-w-0 flex-1 pt-0.5">
                {title != null && title !== '' ? (
                  <h2 id={titleId} className="text-base font-semibold tracking-tight text-slate-900 sm:text-[1.0625rem]">
                    {title}
                  </h2>
                ) : null}
                {subtitle ? (
                  <p className="mt-1 break-words text-sm font-normal leading-relaxed text-slate-500">{subtitle}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div
          className={`modal-content flex-1 bg-white px-5 py-5 sm:px-6 ${
            contentScroll ? 'min-h-0 overflow-y-auto' : 'min-h-0 overflow-visible'
          }`}
        >
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-slate-200/80 bg-slate-50/90 px-5 py-4 sm:px-6">{footer}</div>
        ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(modalTree, document.body);
}

export default AppModal;
