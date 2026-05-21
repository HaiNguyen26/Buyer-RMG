/**
 * Cong thuc bang danh sach (dashboard / modal):
 *
 * Mau list + filter + bám mép đáy viewport (Buyer Leader — Chọn NCC):
 * Shell/Surface theo cong thuc cu: `h-[clamp(15rem,calc(100dvh_-_9rem),56rem)]` + `shell overflow-hidden`,
 * surface `rounded-3xl` + `border-slate-200/70` + `shadow-[0_12px_28px_-18px_rgba(15,23,42,0.32)]`; lớp con `flex-1 min-h-0 overflow-y/x-auto`.
 * Chi tiết: docs/design/dashboard-v3-design-philosophy.md §8.9
 *
 * 1) Gioi han ~7-8 dong: boc bang trong khung co max-height (~55-60px/hang => ~450-500px),
 *    `overflow-y-auto` tren wrapper chua ca thead+tbody de cuon noi bo.
 * 2) `thead th` (hoac `thead`) dung `sticky top-0` + nen + z-index de luon thay cot khi cuon doc.
 * 3) Responsive ngang: wrapper ngoai `overflow-x-auto`, `table` `min-w-[800px]` (hoac table-fixed + colgroup tuy module).
 * 4) O du lieu: `whitespace-nowrap` khi can hang dong deu (chu y ellipsis/tooltip neu can).
 *
 * Hai lop (khuyen dung khi vua dai vua rong):
 * - Ngoai: {@link dataTableOuterScrollXClass}
 * - Trong: {@link dataTableInnerScrollYWindowClass}
 *
 * Mot lop (don gian): {@link dataTableScrollWindowSingleClass}
 */

/** Uoc ~px moi hang (padding + text) — tham chieu khi tinh max-height. */
export const DATA_TABLE_APPROX_ROW_PX = 56;

/** ~7-8 hang: tran 500px nhung khong qua cao tren man thap (28rem ~ 448px). */
export const dataTableBodyMaxHeightClass = 'max-h-[min(28rem,500px)]';

/** Wrapper ngoai: cuon ngang an toan, khong tran layout flex. */
export const dataTableOuterScrollXClass =
  'min-w-0 w-full max-w-full overflow-x-auto [-webkit-overflow-scrolling:touch]';

/** Wrapper trong: gioi chieu cao + cuon doc (sticky thead tinh theo khung nay). */
export const dataTableInnerScrollYWindowClass = [
  dataTableBodyMaxHeightClass,
  'overflow-y-auto [-webkit-overflow-scrolling:touch] scrollbar-hide',
].join(' ');

/** Bang giu do rong toi thieu tren mobile — cuon ngang thay vi bop cot. */
export const dataTableWideMinWidthClass = 'w-full min-w-[800px] border-collapse';

/** O can hang dong deu / chong xuong dong (ket hop tooltip neu noi dung dai). */
export const dataTableCellNowrapClass = 'whitespace-nowrap';

/** Tieu de cot khi cuon doc (them border-b neu can tach ro). */
export const dataTableStickyHeaderCellClass =
  'sticky top-0 z-10 bg-white shadow-[inset_0_-1px_0_0_rgb(226_232_240)]';

/**
 * Don lop: max-height + overflow x + y (tuong duong "khung cua so" trong mot div).
 * Dung khi khong tach lop ngoai/trong; thead sticky van hoat dong.
 */
export const dataTableScrollWindowSingleClass = [
  'min-w-0 w-full max-w-full',
  dataTableBodyMaxHeightClass,
  'overflow-x-auto overflow-y-auto [-webkit-overflow-scrolling:touch] scrollbar-hide',
].join(' ');

