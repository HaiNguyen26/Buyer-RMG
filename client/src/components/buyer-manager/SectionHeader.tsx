import type { LucideIcon } from 'lucide-react';

export type SectionHeaderProps = {
  Icon: LucideIcon;
  title: string;
  /** Progressive disclosure — ví dụ “Tầng 1 · Cốt lõi” (V3 dashboard). */
  eyebrow?: string;
  description?: string;
  className?: string;
  /**
   * true: mô tả luôn full width phía dưới (cột hẹp / grid 1–3 — tránh cắt chữ).
   * false: từ `md` trở lên xếp ngang với tiêu đề (viền trái).
   */
  stackDescription?: boolean;
};

/** Tiêu đề mục lớn — đồng bộ hierarchy (indigo / slate). */
export function SectionHeader({
  Icon,
  title,
  eyebrow,
  description,
  className = '',
  stackDescription = false,
}: SectionHeaderProps) {
  const descClass = stackDescription
    ? 'min-w-0 w-full max-w-full text-sm leading-relaxed text-slate-600 break-words [overflow-wrap:anywhere]'
    : 'min-w-0 flex-1 text-sm leading-relaxed text-slate-600 break-words [overflow-wrap:anywhere] md:ml-1 md:border-l md:border-slate-200 md:pl-4';

  if (stackDescription) {
    return (
      <div className={`flex min-w-0 flex-col gap-2.5 ${className}`}>
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="shrink-0 rounded-xl bg-[#4F46E5]/10 p-2 ring-1 ring-[#4F46E5]/15">
            <Icon className="h-5 w-5 text-indigo-600" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{eyebrow}</p>
            ) : null}
            <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">{title}</h2>
          </div>
        </div>
        {description ? <p className={descClass}>{description}</p> : null}
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 flex-col gap-2 md:flex-row md:items-start md:gap-3 ${className}`}>
      <div className="flex min-w-0 shrink-0 flex-col gap-1 md:flex-row md:items-center md:gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-[#4F46E5]/10 p-2 ring-1 ring-[#4F46E5]/15">
            <Icon className="h-5 w-5 text-indigo-600" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{eyebrow}</p>
            ) : null}
            <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">{title}</h2>
          </div>
        </div>
      </div>
      {description ? <p className={descClass}>{description}</p> : null}
    </div>
  );
}
