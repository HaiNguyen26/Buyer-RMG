/**
 * Layout chung cho m?i role dashboard (shell: <main> + outlet).
 * ??ng b? v?i Buyer: kh?ng tr?n ngang, safe-area, padding b??c theo breakpoint.
 */

/**
 * Outlet trong <main> cu?n: full chi?u ngang main (kh?ng max-w), kh?ng h-full ? tr?nh c?t ??y.
 */
const dashboardMainOutletCore =
  'dashboard-main-outlet min-h-0 w-full min-w-0 max-w-none mx-0 pb-6 sm:pb-8 md:pb-10';

export const dashboardMainOutletClass = dashboardMainOutletCore;

/** Outlet cu?n tr?n main ? ??y g?n h?n (vd. t?ng quan Requestor, tr?nh qu? xa m?p d??i) */
export const dashboardMainOutletCompactClass =
  'dashboard-main-outlet min-h-0 w-full min-w-0 max-w-none mx-0 pb-3 sm:pb-4 md:pb-5';

/** Outlet full k?ch th??c main ? kh?ng pb (trang c? footer c? ??nh / t? ch?a ??y) */
export const dashboardMainOutletFlushClass =
  'dashboard-main-outlet min-h-0 w-full min-w-0 max-w-none mx-0 pb-0';

/** Alias ? c?ng outlet full width (gi? import c?) */
export const dashboardMainOutletFullWidthClass = dashboardMainOutletCore;

/**
 * L? ngang main: t?i thi?u ? n?i dung g?n hai m?p v?ng main (v?n ch?a ch?t cho touch / scrollbar).
 */
export const dashboardMainPaddingXClass =
  'px-1 sm:px-1.5 md:px-2 lg:px-2.5 xl:px-3 2xl:px-3';

/**
 * ?m margin + width b? ??ng b?ng padding ngang main ? d?ng khi c?n n?n/header/footer tr?n s?t m?p main.
 * Gi? ??ng b? v?i b??c px trong dashboardMainPaddingXClass.
 */
export const dashboardMainHorizontalBleedClass =
  '-mx-1 w-[calc(100%+0.5rem)] sm:-mx-1.5 sm:w-[calc(100%+0.75rem)] md:-mx-2 md:w-[calc(100%+1rem)] lg:-mx-2.5 lg:w-[calc(100%+1.25rem)] xl:-mx-3 xl:w-[calc(100%+1.5rem)] 2xl:-mx-3 2xl:w-[calc(100%+1.5rem)]';

/**
 * Lề ngang nội dung chuẩn Buyer (`buyerPageContentClass`): `px-1 sm:px-1.5 md:px-3`.
 * Áp vào root trang hoặc “content stack” khi outlet dùng {@link dashboardMainHorizontalBleedClass} —
 * shell cuộn đã mở full ngang nên không còn px; **bắt buộc** inset này để khớp Buyer, tránh nội dung dính mép.
 * (Khác `dashboardMainPaddingXClass` trên shell: bước thêm lg/xl/2xl.)
 */
export const dashboardPageContentInsetXClass = 'px-1 sm:px-1.5 md:px-3';

/**
 * Đệm đáy **stack trang trong outlet** — trùng Buyer `buyerPageContentClass` (trang danh sách/workspace).
 * Dùng cùng {@link dashboardPageContentInsetXClass} khi shell/outlet bleed; tránh khối trắng cuối dính mép dưới viewport/home indicator.
 */
export const dashboardPageContentInsetBottomWorkspaceClass =
  'pb-[max(0.75rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] sm:pb-4 md:pb-5';

/**
 * Đệm đáy Tổng quan — nhẹ hơn workspace nhưng vẫn “thở” (page-content-spacing §2.3).
 * Cùng bậc với {@link dashboardMainPaddingBottomOverviewClass} để khối cuối không dính mép scroll.
 */
export const dashboardPageContentInsetBottomOverviewClass =
  'pb-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] sm:pb-4 md:pb-5';

/**
 * Khối “tách” sau `<Outlet>` trong main scroll (Buyer dùng tương đương + nền canvas).
 * Không gán `bg-*` — kế thừa nền shell (Buyer Manager `bg-slate-50`, Buyer `#f1f5f9`…).
 */
export const dashboardScrollEndSpacerClass = [
  'pointer-events-none w-full min-w-0 shrink-0 select-none',
  'min-h-[max(0.75rem,calc(env(safe-area-inset-bottom,0px)*0.35))]',
  'sm:min-h-4',
].join(' ');

export const dashboardMainPaddingTopClass = 'pt-3 sm:pt-4';

/** Nho hon {@link dashboardMainPaddingTopClass}: cach header mot khoang nho, van gon hon overview day du. */
export const dashboardMainPaddingTopTightClass = 'pt-2 sm:pt-2.5';

/** Kho?ng c?ch d?c nh? gi?a DashboardHeader v? v?ng main cu?n (c?t flex). */
export const dashboardMainColumnGapClass = 'gap-1.5 sm:gap-2';

/**
 * ??y v?ng main cu?n: lu?n c? kho?ng nh? t?ch n?i dung kh?i m?p d??i + safe-area.
 * (B? pb-20 qu? l?n khi kh?ng c? bottom bar c? ??nh.)
 */
export const dashboardMainPaddingBottomClass =
  'pb-[max(2rem,calc(env(safe-area-inset-bottom,0px)+1.25rem))] sm:pb-7 md:pb-8 lg:pb-9 xl:pb-10';

/**
 * Th?m v?o root trang con (form d?i, n?t cu?i) ? tr?nh d?nh m?p d??i viewport / home indicator.
 */
export const dashboardPageContentBottomClass =
  'pb-[max(3.5rem,calc(env(safe-area-inset-bottom,0px)+2rem))] sm:pb-12 md:pb-16';

/** Main full-height (kh?ng cu?n ngo?i): v?n ch?a ??y, tr?nh n?i dung d?nh m?p */
export const dashboardMainPaddingBottomCompactClass =
  'pb-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.75rem))] sm:pb-4 md:pb-5';

/** ??y main g?n ? trang t?ng quan (vd. Requestor) tr?nh qu? xa m?p d??i viewport */
export const dashboardMainPaddingBottomOverviewClass =
  'pb-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] sm:pb-4 md:pb-5';

export const dashboardMainScrollChrome =
  'overflow-y-auto overflow-x-clip scrollbar-hide touch-pan-y';

/**
 * Main c? cu?n ? h?u h?t trang con.
 * Kh?ng d?ng flex-col tr?n <main>: tr?nh flex min-height + overflow c?t n?i dung ??y (m?i role).
 */
export const dashboardMainScrollableClass = [
  'min-h-0 min-w-0 flex-1',
  dashboardMainScrollChrome,
  dashboardMainPaddingXClass,
  dashboardMainPaddingTopClass,
  dashboardMainPaddingBottomClass,
].join(' ');

/** Gi?ng main cu?n chu?n nh?ng padding ??y nh? h?n (t?ng quan) */
export const dashboardMainScrollableOverviewClass = [
  'min-h-0 min-w-0 flex-1',
  dashboardMainScrollChrome,
  dashboardMainPaddingXClass,
  dashboardMainPaddingTopClass,
  dashboardMainPaddingBottomOverviewClass,
].join(' ');

/**
 * Nh? {@link dashboardMainScrollableOverviewClass} nh?ng `overflow-x-auto` (b?ng r?ng).
 * Kh?ng th?m `flex flex-col` tr?n main ? tr?nh n?i dung con `h-full`/`flex-1` t?o cu?n trong kh?i thay v? cu?n main.
 */
export const dashboardMainScrollableOverviewWideXClass = [
  'min-h-0 min-w-0 flex-1',
  'overflow-y-auto overflow-x-auto scrollbar-hide touch-pan-y',
  dashboardMainPaddingXClass,
  dashboardMainPaddingTopClass,
  dashboardMainPaddingBottomOverviewClass,
].join(' ');

/**
 * Same as dashboardMainScrollableOverviewWideXClass but {@link dashboardMainPaddingTopTightClass} on the scroll shell
 * (small gap under header; avoids large pt + flex gap showing parent background).
 */
export const dashboardMainScrollableOverviewWideXFlushTopClass = [
  'min-h-0 min-w-0 flex-1',
  'overflow-y-auto overflow-x-auto scrollbar-hide touch-pan-y',
  dashboardMainPaddingXClass,
  dashboardMainPaddingTopTightClass,
  dashboardMainPaddingBottomOverviewClass,
].join(' ');

/**
 * Workspace under header: flex-1 + min-h-0 flex column; main vertical scroll; overview padding + compact outlet.
 */
export const dashboardMainWorkspaceRegionClass = [
  'min-h-0 min-w-0 flex-1 flex flex-col',
  dashboardMainScrollChrome,
  dashboardMainPaddingXClass,
  dashboardMainPaddingTopClass,
  dashboardMainPaddingBottomOverviewClass,
].join(' ');

/**
 * Bọc outlet + nội dung trong main scroll (Tổng quan) — `flex-1` + `min-h-full` để canvas phủ viewport khi nội dung ngắn;
 * vẫn cao theo nội dung khi dài (cuộn trên main). **Không** `h-full` / `basis-0`.
 */
export const dashboardOverviewScrollColumnClass =
  'flex min-h-full min-w-0 w-full flex-1 flex-col';

/**
 * **Trang Tổng quan / dashboard home (mọi role)** — outlet trong {@link dashboardOverviewScrollColumnClass}.
 * Doc: `docs/design/layout-shell-viewport-wrapper.md` §2.
 */
export const dashboardOverviewOutletClass = [
  'dashboard-outlet flex min-h-full min-w-0 w-full shrink-0 flex-col self-stretch overflow-x-clip',
  'dashboard-main-outlet max-w-none mx-0 min-h-full w-full min-w-0 pb-0',
  dashboardMainHorizontalBleedClass,
].join(' ');

/**
 * Root route — chỉ `min-h-full` (layout-shell §2.2); **không** `flex-1` / `h-full` trên page.
 */
export const dashboardOverviewPageShellClass =
  'flex min-h-full min-w-0 w-full flex-col';

/**
 * Stack nội dung Tổng quan — inset X + đệm đáy overview (+ `space-y-6`).
 * Role có thể thêm class compact (`space-y-4`) trên cùng node.
 */
export const dashboardOverviewContentStackClass = [
  `mx-auto min-h-0 w-full max-w-none min-w-0 space-y-6 ${dashboardPageContentInsetXClass} pt-3 sm:pt-4`,
  dashboardPageContentInsetBottomOverviewClass,
].join(' ');

/**
 * Outlet bọc `<Outlet />` trong workspace:
 * - `flex-1` + `min-h-0` căng theo chiều cao flex column của scroll shell.
 * - {@link dashboardMainHorizontalBleedClass} khử `dashboardMainPaddingXClass` trên **cùng** scroll shell
 *   → full bề ngang vùng main (tránh khe hai bên); `pb` compact giữ gutter đáy.
 *
 * Chỉ dùng bleed khi shell cuộn có đúng bộ padding ngang đó — không ghép bleed với scroll không có `px`.
 */
export const dashboardOutletWorkspaceFlexClass = [
  'dashboard-outlet flex min-h-0 min-w-0 flex-1 self-stretch flex-col overflow-x-clip',
  'dashboard-main-outlet max-w-none pb-3 sm:pb-4 md:pb-5',
  dashboardMainHorizontalBleedClass,
].join(' ');

/**
 * V?ng cu?n cho b?ng danh s?ch (vd. Branch Manager): chi?u cao b?m viewport (~7?8 d?ng),
 * m?n nh? th?p h?n, m?n l?n cao h?n; nhi?u d?ng h?n th? ch? cu?n trong khung.
 */
export const dashboardViewportDataTableScrollClass = [
  // Fill ph?n cao c?n l?i c?a viewport; d?m b?o mobile kh?ng b? h?t chi?u d?c
  'min-h-[clamp(17.5rem,38dvh,27rem)] min-w-0 w-full max-w-full flex-1 h-full',
  'overflow-y-auto overflow-x-auto [-webkit-overflow-scrolling:touch] scrollbar-hide',
].join(' ');

/** B?ng trong modal / khung h?p ? v?n theo viewport nh?ng tr?n th?p h?n */
export const dashboardViewportDataTableScrollCompactClass = [
  'min-h-[clamp(12rem,30dvh,18rem)] min-w-0 w-full max-w-full',
  'overflow-y-auto overflow-x-auto [-webkit-overflow-scrolling:touch] scrollbar-hide',
].join(' ');

