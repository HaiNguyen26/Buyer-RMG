import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Ban, GitMerge, ShieldCheck } from 'lucide-react';

export const vendorDetailCanvasClass = 'bg-[#f8fafc]';

export const vendorDetailCardClass =
  'rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/[0.04]';

export const vendorDetailSectionTitleClass =
  'text-xs font-bold uppercase tracking-[0.14em] text-slate-500';

export const vendorDetailBtnPrimaryClass =
  'inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-600/20 transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

export const vendorDetailBtnSecondaryClass =
  'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2';

export const vendorDetailInputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

export function VendorDetailTabPanel({
  title,
  actions,
  children,
  className = '',
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article className={`${vendorDetailCardClass} p-4 sm:p-5 ${className}`}>
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {title ? <h3 className="text-base font-bold text-slate-900">{title}</h3> : <span />}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </article>
  );
}

export function VendorDetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={`${vendorDetailCardClass} p-4 sm:p-5`}>
      <h4 className={`${vendorDetailSectionTitleClass} mb-4`}>{title}</h4>
      {children}
    </section>
  );
}

export function VendorFieldLabel({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/90">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </span>
      {children}
    </p>
  );
}

export function VendorFieldValue({
  value,
  mono = false,
  emptyLabel = 'Chưa cập nhật',
}: {
  value?: string | null;
  mono?: boolean;
  emptyLabel?: string;
}) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return (
      <span className="flex min-h-[2.5rem] w-full items-center rounded-lg border border-dashed border-slate-200/90 bg-slate-50/90 px-3 py-2 text-sm italic text-slate-400">
        {emptyLabel}
      </span>
    );
  }
  return (
    <span className={`block text-sm font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>{trimmed}</span>
  );
}

export function VendorDetailQuickActions({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`} role="group" aria-label="Thao tác NCC">
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-emerald-100"
        title="Phê duyệt NCC"
      >
        <ShieldCheck className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100"
        title="Chặn NCC"
      >
        <Ban className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 transition hover:bg-slate-200"
        title="Gộp trùng lặp"
      >
        <GitMerge className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

export function VendorDetailTabs({
  tabs,
  activeId,
  onChange,
}: {
  tabs: { id: string; label: string; icon: LucideIcon }[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav
      className="border-b border-slate-200/80 bg-white px-4 py-1.5 sm:px-5"
      aria-label="Điều hướng chi tiết NCC"
    >
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeId === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                active
                  ? 'bg-white text-indigo-700 shadow-[0_2px_8px_-2px_rgba(79,70,229,0.25)] ring-1 ring-slate-200/90'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
