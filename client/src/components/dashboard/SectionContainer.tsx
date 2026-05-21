import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type SectionContainerProps = {
  title: string;
  description?: string;
  Icon?: LucideIcon;
  eyebrow?: string;
  /** Lưới con — ví dụ `grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4` */
  gridClassName?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Khung mục dashboard — khoảng trắng + tiêu đề indigo (hệ thống), lưới con tùy chọn.
 */
export function SectionContainer({
  title,
  description,
  Icon,
  eyebrow,
  gridClassName,
  children,
  className = '',
}: SectionContainerProps) {
  const body = gridClassName ? <div className={gridClassName}>{children}</div> : children;

  return (
    <section className={`min-w-0 space-y-4 ${className}`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
        {Icon ? (
          <div className="shrink-0 rounded-lg bg-indigo-50 p-2 ring-1 ring-indigo-100/80">
            <Icon className="h-5 w-5 text-indigo-600" strokeWidth={2} aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>
          ) : null}
          <h2 className="text-base font-semibold tracking-tight text-indigo-950 sm:text-lg">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-snug text-slate-600">{description}</p> : null}
        </div>
      </div>
      {body}
    </section>
  );
}
