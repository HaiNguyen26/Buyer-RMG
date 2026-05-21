/**
 * Token layout V3 (Bento / #F8FAFC) — dùng chung dashboard role.
 */

/** Đảo nội dung: bo 28px, glass nhẹ, bóng ambient. */
export const dashboardV3IslandClass =
  'rounded-[28px] border border-slate-200/70 bg-white/85 p-6 shadow-[0_20px_25px_-5px_rgba(15,23,42,0.08)] backdrop-blur-[12px] md:p-8';

/**
 * Ghép sau {@link dashboardV3IslandClass} cho khối bảng / dữ liệu dày: nền trắng đặc, tắt blur —
 * tránh nền canvas (#F8FAFC) “lòi” ở góc bo do glass bán trong suốt.
 */
export const dashboardV3IslandOpaqueClass = '!bg-white backdrop-blur-none';

/** Nút / link CTA thứ cấp (indigo). */
export const dashboardV3CtaLinkClass =
  'inline-flex items-center gap-2 rounded-2xl border border-indigo-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-900 shadow-sm ring-1 ring-[#4F46E5]/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-50/90 hover:shadow-[0_12px_24px_-8px_rgba(79,70,229,0.18)]';

export const dashboardV3PageBgClass = 'bg-[#F8FAFC]';

export const dashboardV3StackYClass = 'space-y-6 md:space-y-8';

/** Header strip bảng V3 — nền cùng hệ với canvas (docs §6). */
export const dashboardV3TableHeaderStripClass = 'border-b-2 border-slate-200 bg-[#F8FAFC]';

/** Khối lỗi toàn trang / khối — rose, bo đảo (docs §5). */
export const dashboardV3ErrorCardClass =
  'rounded-[28px] border border-rose-200/90 bg-rose-50/95 p-6 shadow-[0_20px_25px_-5px_rgba(239,68,68,0.12)] md:p-8';

export function DashboardV3ShimmerBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-[28px] border border-slate-200/50 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}
