/**
 * Layout nội dung Trưởng phòng — cùng token với Requestor (`requestorLayout`).
 */

import type { UseIntersectionVisibleOptions } from '../hooks/useIntersectionVisible';

/** Reveal + animation chart khi ~40% card trong vùng cuộn — đồng bộ policy Requestor dashboard. */
export const departmentHeadChartIntersectionOptions: UseIntersectionVisibleOptions = {
  rootMargin: '0px',
  resetWhenOutOfView: true,
  minIntersectionRatio: 0.4,
};

export {
  requestorMainShellPaddingClass as departmentHeadMainShellPaddingClass,
  requestorPageStackClass as departmentHeadPageStackClass,
  requestorPanelCardClass as departmentHeadPanelCardClass,
  requestorDataTableCardClass as departmentHeadDataTableCardClass,
  requestorDataTableCardHeaderClass as departmentHeadDataTableCardHeaderClass,
} from './requestorLayout';

/** Đảo KPI chỉ số nhanh — `embedded` trong một island (dashboard-v3 §4). */
export const departmentHeadKpiIslandPaddingClass = '!rounded-[24px] !p-4 md:!p-5';

/** KPI vai trò duyệt PR — 3 cột desktop. */
export const departmentHeadKpiGridManagerClass =
  'grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5';

/** KPI vai trò Requestor — 2 cột. */
export const departmentHeadKpiGridRequestorClass =
  'grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5';

/** Khung cuộn ~6 dòng; thead sticky trên viewport cuộn. */
export const departmentHeadListTableScrollClass = 'department-head-table-scroll-viewport scrollbar-hide';

export const departmentHeadTableScrollViewportThinBars =
  'department-head-table-scroll-viewport department-head-table-scroll-viewport--scrollbars-thin';

export const departmentHeadTableTbodyElevatedClass = 'isolate bg-white';

export const departmentHeadInteractiveTableClass =
  'w-full min-w-[800px] border-separate border-spacing-0';

export const departmentHeadInteractiveTableFixed880Class =
  'w-full min-w-[880px] table-fixed border-separate border-spacing-0';

/** Vạch chỉ báo ô đầu — absolute trong <td> đầu, không đẩy layout. */
export const departmentHeadTableAccentRailClass = [
  'pointer-events-none absolute inset-y-2 left-0 z-[1] w-[3px] rounded-r-full bg-indigo-600',
  'origin-center opacity-0 scale-y-50',
  'transition-all duration-300 ease-out',
  'motion-reduce:transition-none motion-reduce:scale-y-100 motion-reduce:opacity-0 motion-reduce:group-hover:opacity-0',
  'group-hover:opacity-100 group-hover:scale-y-100',
].join(' ');

export const departmentHeadTableFirstCellInnerClass = 'relative z-0 min-w-0';

/** Luôn bọc nội dung trong ô — transform trên block + ease-out, group-hover translate-x trên cha <tr.group>. */
export const departmentHeadTableCellContentWrapClass =
  'block min-w-0 transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:transform-none group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0';

/** Ô chứa flex (hàng nút / icon); vẫn trượt ngang nhẹ như các ô khác. */
export const departmentHeadTableCellContentWrapFlexClass =
  'flex min-h-0 min-w-0 flex-wrap items-center gap-1 transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:transform-none group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0';

/**
 * Nút thao tác: vào nhẹ từ dưới + focus trong hàng vẫn hiện (a11y).
 * Kết hợp với wrap flex và justify-end trên ô thao tác.
 */
export const departmentHeadTableActionClusterClass =
  'flex gap-1 opacity-0 translate-y-1 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none';

/** Nền + bo góc + shadow mép ô đầu/cuối khi hover cả <tr>; translate-x chỉ đặt trên wrapper trong từng <td>. */
const departmentHeadRowGroupMotionShared = [
  'group relative z-0 transition-all duration-300 ease-out motion-reduce:transition-none',
  '[&>td]:transition-colors [&>td]:duration-300 [&>td]:ease-out',
  '[&>td]:border-b [&>td]:border-slate-200/90 last:[&>td]:border-b-0',
  '[&>td:first-child]:rounded-l-2xl [&>td:last-child]:rounded-r-2xl',
  'group-hover:[&>td]:bg-indigo-50/40',
  'group-hover:[&>td:first-child]:shadow-[-12px_0_28px_-12px_rgba(15,23,42,0.14)] group-hover:[&>td:last-child]:shadow-[12px_0_28px_-12px_rgba(15,23,42,0.14)]',
  'motion-reduce:group-hover:[&>td:first-child]:shadow-none motion-reduce:group-hover:[&>td:last-child]:shadow-none',
].join(' ');

export function departmentHeadTableDataRowClasses(
  rowIndex: number,
  opts?: { h72?: boolean },
): string {
  const zebra = rowIndex % 2 === 1 ? '[&>td]:bg-[#FBFCFE]' : '[&>td]:bg-white';
  return [departmentHeadRowGroupMotionShared, zebra, opts?.h72 ? 'h-[72px]' : ''].filter(Boolean).join(' ');
}

export function departmentHeadDashboardDataRowInteractive(rowIndex: number): string {
  const zebra = rowIndex % 2 === 1 ? '[&>td]:bg-[#FBFCFE]' : '[&>td]:bg-white';
  return [departmentHeadRowGroupMotionShared, 'cursor-pointer', zebra].join(' ');
}
