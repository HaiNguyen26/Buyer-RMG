/**
 * Layout Warehouse — đồng bộ docs:
 * - layout-shell-viewport-wrapper.md §3 (workspace)
 * - page-content-spacing.md §3.4
 */
import {
  dashboardMainOutletFlushClass,
  dashboardPageContentInsetBottomWorkspaceClass,
  dashboardPageContentInsetXClass,
} from './dashboardLayout';
import { roleDashboardPageStackClass } from './roleDashboardLayout';

/** Outlet flush — bảng neo viewport (stock-issues). */
export const warehouseWorkspaceOutletFlushClass = dashboardMainOutletFlushClass;

/**
 * Shell trang workspace full viewport trong outlet flush.
 * Nền canvas #f1f5f9 — một lớp, không chồng slate-50.
 */
export const warehouseWorkspacePageShellClass =
  'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#f1f5f9]';

/** Shell trang danh sách — cuộn trên page (hero / filter / bảng), không cuộn cả viewport ngoài. */
export const warehouseWorkspacePageShellScrollClass =
  'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[#f1f5f9] touch-pan-y [scrollbar-width:thin]';

/**
 * Stack nội dung — inset X + pt + pb workspace + khoảng giữa khối (parity buyerPageContentClass).
 */
export const warehouseWorkspacePageContentClass = [
  'mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-1 flex-col min-w-0',
  dashboardPageContentInsetXClass,
  'pt-3 sm:pt-4',
  dashboardPageContentInsetBottomWorkspaceClass,
  roleDashboardPageStackClass,
].join(' ');

/** Stack khi page shell cuộn — không `flex-1`/`h-full` (cao theo nội dung). */
export const warehouseWorkspacePageContentScrollClass = [
  'mx-auto w-full max-w-[1800px] min-w-0',
  dashboardPageContentInsetXClass,
  'pt-3 sm:pt-4',
  dashboardPageContentInsetBottomWorkspaceClass,
  roleDashboardPageStackClass,
].join(' ');

/** Surface bảng cao cố định — không kéo flex-1. */
export const warehouseWorkspaceTableSurfaceFixedClass =
  'relative z-10 flex shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white ring-1 ring-slate-900/5 sm:rounded-[24px]';

/**
 * Vùng bảng — `flex-1 min-h-0` kéo cao còn lại viewport; **`overflow-visible`**
 * để bóng/bo góc card không bị cắt (doc layout-shell §6 — không `overflow-hidden` ở đây).
 */
export const warehouseWorkspaceTableRegionClass =
  'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-visible';

/** Vùng bảng cố định — không flex-1 (page shell cuộn). */
export const warehouseWorkspaceTableRegionFixedClass =
  'relative w-full min-w-0 shrink-0 overflow-visible';

/** Lớp ngoài: giữ halo shadow, không clip bo góc. */
export const warehouseWorkspaceTableOuterClass =
  'relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-visible rounded-2xl shadow-[0_24px_48px_-20px_rgba(15,23,42,0.36)] sm:rounded-[24px] sm:shadow-[0_20px_44px_-22px_rgba(15,23,42,0.42),0_10px_24px_-16px_rgba(15,23,42,0.28)]';

/** Card bảng cao cố định (không kéo flex-1) — dùng khi main page scroll. */
export const warehouseWorkspaceTableOuterFixedClass =
  'relative flex w-full min-w-0 shrink-0 flex-col overflow-visible rounded-2xl shadow-[0_24px_48px_-20px_rgba(15,23,42,0.36)] sm:rounded-[24px] sm:shadow-[0_20px_44px_-22px_rgba(15,23,42,0.42),0_10px_24px_-16px_rgba(15,23,42,0.28)]';

/** Số dòng body nhìn thấy trong khung bảng (hàng data = 4.5rem / 72px). */
export const warehouseStockIssuesTableVisibleRows = 1;

/** Chiều cao khung: thead ~2.75rem + N × 4.5rem (parity Incoming PO). */
export const warehouseStockIssuesTableViewportHeight = `calc(2.75rem + ${warehouseStockIssuesTableVisibleRows} * 4.5rem)`;

/** Lớp trong: bo góc + nền trắng + crop bảng (tránh vệt #f1f5f9 ở góc dưới). */
export const warehouseWorkspaceTableSurfaceClass =
  'relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white ring-1 ring-slate-900/5 sm:rounded-[24px]';

/** Scroller bảng — nền trắng khớp surface. */
export const warehouseWorkspaceTableScrollClass =
  'min-h-0 flex-1 overflow-auto bg-white [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent]';
