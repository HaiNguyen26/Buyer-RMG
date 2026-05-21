/**
 * Layout module Buyer — same tokens as Requestor (`requestorLayout`).
 * `BuyerDashboard`: main scroll có `dashboardMainPaddingXClass`; outlet dùng bleed thì **`buyerPageContentClass` / `dashboardPageContentInsetXClass`** là lề ngang nội dung chuẩn (đồng bộ các role khác khi bleed). Trang con dùng `buyerPageStackClass` chỉ chồng stack dọc khi không cần thêm gutter (đa số dùng `buyerPageContentClass` đủ).
 *
 * Route pages: {@link buyerOutletPageRootClass} / {@link buyerOutletPageShellClass}; cuộn trên main (`BuyerDashboard`), không nhân đôi `overflow-y-auto` trên root.
 * Tổng quan: alias `dashboardOverview*` từ `dashboardLayout.ts` — doc `docs/design/layout-shell-viewport-wrapper.md` §2.
 *
 * Canvas vùng cuộn: `bg-[#f1f5f9]` (layout-shell-viewport-wrapper §1–3), không trùng nền sidebar `#F8FAFC`.
 * Module hai lớp bóng: §4 — {@link buyerModuleContainerClass} + {@link buyerModuleContentClass}.
 */
import {
  dashboardMainOutletClass,
  dashboardOverviewContentStackClass,
  dashboardOverviewOutletClass,
  dashboardOverviewPageShellClass,
  dashboardPageContentInsetBottomWorkspaceClass,
  dashboardPageContentInsetXClass,
} from './dashboardLayout';
import {
  departmentHeadDashboardDataRowInteractive,
  departmentHeadInteractiveTableClass,
  departmentHeadTableAccentRailClass,
  departmentHeadTableCellContentWrapClass,
  departmentHeadTableCellContentWrapFlexClass,
  departmentHeadTableDataRowClasses,
  departmentHeadTableFirstCellInnerClass,
  departmentHeadTableTbodyElevatedClass,
} from './departmentHeadLayout';

export const buyerInteractiveTableBodyClass = departmentHeadTableTbodyElevatedClass;

/**
 * Khung cuộn bảng Buyer — parity `department-head-table-scroll-viewport` (index.css `.buyer-workspace-table-scroll-viewport`):
 * clamp min/max theo ~10 × 72px + thead và ~56dvh, không ép 92vh.
 */
export const buyerWorkspaceTableViewportClass =
  'relative min-h-0 w-full buyer-workspace-table-scroll-viewport buyer-workspace-table-scroll-viewport--thin';

/** Bảng danh mục hàng RFQ — max ~10 dòng, co khi ít hơn (không min-height cố định). */
export const buyerRfqItemsTableViewportClass =
  'relative min-h-0 w-full buyer-rfq-items-table-viewport buyer-workspace-table-scroll-viewport--thin';

/** Nền bảng không vỡ hover (Enterprise data-table §1.1). */
export const buyerInteractiveTableClass = departmentHeadInteractiveTableClass;

/** Hàng chỉ đọc / hover viz — doc §2–§5 */
export function buyerTableDataRowVisual(index: number): string {
  return departmentHeadTableDataRowClasses(index, { h72: true });
}

/** Hover + vạch dọc + nội dung trượt nhẹ — không bo góc ô (chi tiết RFQ, v.v.). */
const buyerTableDocumentRowMotion = [
  'group relative z-0 h-[72px] transition-all duration-300 ease-out motion-reduce:transition-none',
  '[&>td]:transition-colors [&>td]:duration-300 [&>td]:ease-out',
  '[&>td]:border-b [&>td]:border-slate-200/90 last:[&>td]:border-b-0',
  'group-hover:[&>td]:bg-indigo-50/40',
  'group-hover:[&>td:first-child]:shadow-[-12px_0_28px_-12px_rgba(15,23,42,0.14)] group-hover:[&>td:last-child]:shadow-[12px_0_28px_-12px_rgba(15,23,42,0.14)]',
  'motion-reduce:group-hover:[&>td:first-child]:shadow-none motion-reduce:group-hover:[&>td:last-child]:shadow-none',
].join(' ');

export function buyerTableDocumentRowClass(index: number): string {
  const zebra = index % 2 === 1 ? '[&>td]:bg-[#FBFCFE]' : '[&>td]:bg-white';
  return [buyerTableDocumentRowMotion, zebra].join(' ');
}

/** Hàng có click (interactive); cố định cao ô ~72px giống chuẩn bảng workspace. */
export function buyerTableRowInteractive(index: number): string {
  return `${departmentHeadDashboardDataRowInteractive(index)} h-[72px]`;
}

export const buyerTableAccentRailClass = departmentHeadTableAccentRailClass;
export const buyerTableFirstCellInnerClass = departmentHeadTableFirstCellInnerClass;
export const buyerTableCellWrapClass = departmentHeadTableCellContentWrapClass;
export const buyerTableCellWrapFlexClass = departmentHeadTableCellContentWrapFlexClass;

/** Nền main scroll — đồng bộ Branch / Requestor / doc layout-shell. */
export const buyerShellScrollCanvasClass = 'bg-[#f1f5f9]';

/**
 * Đệm đáy sau `<Outlet>` — workspace Buyer (`#f1f5f9` khớp scroll).
 * **Tổng quan** dùng {@link dashboardScrollEndSpacerClass} (không `bg-*`) — kế thừa `#F8FAFC` trên scroll.
 */
export const buyerDashboardMainScrollEndSpacerClass = [
  buyerShellScrollCanvasClass,
  'pointer-events-none w-full min-w-0 shrink-0 select-none',
  'min-h-[max(0.5rem,calc(env(safe-area-inset-bottom,0px)*0.35))]',
  'sm:min-h-3',
].join(' ');

/**
 * Khung trang con Buyer — **không** `min-h-full`: cao theo nội dung để `padding-bottom` trên vùng cuộn main
 * luôn còn chỗ (tránh dính mép giống `department-head/DashboardHome`).
 */
export const buyerOutletPageRootClass = 'flex w-full min-w-0 min-h-0 flex-col';

/**
 * Stack nội dung — parity `department-head/PRApproval` `pageContentClass` + safe-area đáy.
 * Gutter đáy chính nằm trên **main scroll** (`BuyerDashboard`); stack chỉ cần pb nội bộ rõ ràng.
 */
export const buyerPageContentClass = [
  `mx-auto min-h-0 w-full max-w-none min-w-0 space-y-6 ${dashboardPageContentInsetXClass} pt-3 sm:pt-4`,
  dashboardPageContentInsetBottomWorkspaceClass,
].join(' ');

/** Tổng quan — alias token chung {@link dashboardOverviewContentStackClass}. */
export const buyerDashboardOverviewStackClass = dashboardOverviewContentStackClass;

/** Tổng quan Buyer — stack gọn hơn mặc định V3 (`space-y` một bước). */
export const buyerDashboardOverviewStackCompactClass =
  'space-y-4 sm:space-y-5';

/** Tổng quan — alias {@link dashboardOverviewPageShellClass}. */
export const buyerDashboardOverviewPageShellClass = dashboardOverviewPageShellClass;

/** Tổng quan — alias {@link dashboardOverviewOutletClass}. */
export const buyerDashboardOverviewOutletClass = dashboardOverviewOutletClass;

/** Đảo module KPI / PO — giảm padding & bo góc so với {@link dashboardV3IslandClass}. */
export const buyerDashboardIslandCompactClass =
  '!rounded-[22px] !p-4 shadow-[0_14px_22px_-8px_rgba(15,23,42,0.08)] md:!p-5';

/**
 * Đảo Tầng 1 — một lớp bóng ambient (dashboard-v3 §3); KPI con dùng `StatCard` `embedded`.
 * Import `dashboardV3IslandClass` + `dashboardV3IslandOpaqueClass` từ DashboardV3Chrome khi ghép.
 */
export const buyerDashboardKpiIslandPaddingClass = '!rounded-[24px] !p-4 md:!p-5';

/** Lưới KPI trong đảo Tầng 1 — gap gọn, không lồng thẻ trắng. */
export const buyerDashboardKpiGridClass = 'grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-2.5';

/** CTA phụ trên Tổng quan — bo `rounded-xl` đồng bộ đảo KPI (không pill). */
export const buyerDashboardOverviewCtaClass =
  'inline-flex items-center gap-2 rounded-xl border border-indigo-200/90 bg-white px-3.5 py-2 text-sm font-semibold text-indigo-900 shadow-sm ring-1 ring-[#4F46E5]/10 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-50/90 hover:shadow-[0_12px_24px_-8px_rgba(79,70,229,0.18)]';

/** Chiều cao khung danh sách 4 ô — bản compact (~4–5 dòng nhìn thấy). */
export const buyerOverviewPanelViewportHeightCompactClass =
  'h-[26rem] max-h-[min(46dvh,54svh)] w-full shrink-0 overflow-x-hidden';

const buyerOverviewPanelInnerScrollCompactCommon = `${buyerOverviewPanelViewportHeightCompactClass} min-h-0 overflow-y-auto [-webkit-overflow-scrolling:touch] scrollbar-hide touch-pan-y`;

export const buyerOverviewPanelScrollDenseCompactClass = `${buyerOverviewPanelInnerScrollCompactCommon} rounded-xl`;

export const buyerOverviewPanelScrollCardsCompactClass = buyerOverviewPanelInnerScrollCompactCommon;

export const buyerOverviewPanelEmptyAreaCompactClass = `${buyerOverviewPanelViewportHeightCompactClass} flex flex-none flex-col items-center justify-center overflow-hidden`;

/** Căn giữa loading/error khi outlet không còn `h-full` từ dashboard shell. */
export const buyerOutletCenterMinHeightClass =
  'min-h-[calc(100dvh-7.75rem-env(safe-area-inset-bottom,0px))]';

/** Workspace list — cùng công thức Department Head (một gutter nhỏ so với vùng cuộn viewport). */
export const buyerWorkspacePageStackClass = buyerPageContentClass;

/** Ô filter phía trên bảng — bóng tĩnh, không hover:shadow-xl. */
export const buyerWorkspaceFiltersCardClass =
  'rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm';

/** Vỏ bảng / danh sách — không lồng `module-container module-content`. */
export const buyerWorkspaceDataCardClass =
  'flex w-full min-w-0 flex-col overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_20px_25px_-5px_rgba(15,23,42,0.08)] mb-1 sm:mb-1.5';

/**
 * Đáy vùng cuộn main Buyer (trang workspace / bảng) — rõ hơn padding-bottom overview trên main scroll
 * để luôn thấy một dải canvas dưới thẻ data (DepartmentHead wide list: pb nội trang + bo góc scroll).
 */
export const buyerDashboardWorkspaceScrollBottomClass =
  'pb-[max(1rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] sm:pb-4 md:pb-5';

/** Bo mép dưới vùng cuộn — parity `DepartmentHeadDashboard` `isDeptHeadWideTableRoute`. */
export const buyerDashboardWorkspaceScrollRoundedBottomClass = 'rounded-b-[28px]';

/** Thanh tiêu đề khối bảng — cùng bước px với card bảng Department Head. */
export const buyerWorkspaceTableTitleBarClass =
  'flex-none border-b border-slate-100 bg-slate-50/95 px-4 py-3 sm:px-6 sm:py-3.5';

/** Vỏ ngoài module: `overflow-visible` + bóng halo (doc §4). */
export const buyerModuleContainerClass =
  'mb-2 flex w-full min-w-0 flex-col overflow-visible rounded-[24px] shadow-[0_20px_44px_-22px_rgba(15,23,42,0.42),0_10px_24px_-16px_rgba(15,23,42,0.28)] sm:mb-3';

/** Lớp trong: bo, viền, nền trắng — bóng do lớp ngoài. */
export const buyerModuleContentClass =
  'relative z-10 flex w-full min-w-0 flex-col overflow-visible rounded-[24px] border border-slate-200 bg-white ring-1 ring-slate-900/5';

/** Root + nền canvas trong outlet (không dùng #F8FAFC — tránh vệt khác màu với vùng cuộn). */
export const buyerOutletPageShellClass = `${buyerOutletPageRootClass} ${buyerShellScrollCanvasClass}`;

export const buyerMainOutletClass = dashboardMainOutletClass;

export {
  requestorMainShellPaddingClass as buyerMainShellPaddingClass,
  requestorPageStackClass as buyerPageStackClass,
  /** Legacy alias — same string as {@link buyerPageStackClass} */
  requestorPageStackClass as buyerPageStack,
  requestorPanelCardClass as buyerPanelCardClass,
  requestorDataTableCardClass as buyerDataTableCardClass,
  requestorDataTableCardHeaderClass as buyerDataTableCardHeaderClass,
} from './requestorLayout';

/** Minimal width-only wrapper */
export const buyerPageSimple = 'w-full min-w-0';

export const buyerStateCenter = 'flex min-h-[min(50vh,24rem)] w-full items-center justify-center px-2';

/**
 * Chiều cao giống nhau cho khung danh sách 4 ô (~5–6 dòng/item nhìn thấy).
 * Không dùng flex-1 theo chiều dọc — tránh ô kéo dài hết danh sách.
 */
/** Hai lớp tách — tránh JIT bỏ qua `min()` lồng nhau; vẫn giới ~5–6 item. */
export const buyerOverviewPanelViewportHeightClass =
  'h-[36rem] max-h-[min(54dvh,62svh)] w-full shrink-0 overflow-x-hidden';

const buyerOverviewPanelInnerScrollCommon =
  `${buyerOverviewPanelViewportHeightClass} min-h-0 overflow-y-auto [-webkit-overflow-scrolling:touch] scrollbar-hide touch-pan-y`;

/** Danh sách sọc (PR được phân công). */
export const buyerOverviewPanelScrollDenseClass = `${buyerOverviewPanelInnerScrollCommon} rounded-xl`;

/** Cột mini-card (deadline, RFQ, trả về). */
export const buyerOverviewPanelScrollCardsClass = `${buyerOverviewPanelInnerScrollCommon}`;

/** Vùng trống đồng cao với khung có danh sách (không scroll). */
export const buyerOverviewPanelEmptyAreaClass = `${buyerOverviewPanelViewportHeightClass} flex flex-none flex-col items-center justify-center overflow-hidden`;
