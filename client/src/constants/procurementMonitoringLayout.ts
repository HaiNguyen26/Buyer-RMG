/** Layout Giám sát Procurement — đồng bộ dashboard V3 + branch/department shell. */

export const procurementMonitorPageRootClass = 'w-full min-w-0 bg-[#f1f5f9]';

export const procurementMonitorPageContentClass =
  'mx-auto w-full max-w-none min-w-0 space-y-5 px-1 pt-3 pb-4 sm:px-1.5 sm:pt-4 sm:pb-5 md:px-3';

/** Bảng chính — padding gọn hơn island mặc định */
export const procurementMonitorTableIslandClass =
  '!rounded-[24px] !p-4 md:!p-5';

export const procurementMonitorModuleClass =
  'rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-[0_14px_36px_-12px_rgba(15,23,42,0.12),0_4px_16px_-6px_rgba(15,23,42,0.07)] ring-1 ring-slate-900/[0.045] md:p-5';

export const procurementMonitorKpiIslandPaddingClass = '!rounded-[24px] !p-4 md:!p-5';

/** 5 KPI vận hành — gộp chỉ số, không pipeline */
export const procurementMonitorKpiGridClass =
  'grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-5 lg:gap-2.5';

/** Vùng bảng — nền + viền (chiều cao gắn theo số dòng ở component) */
export const procurementMonitorTableFrameClass =
  'overflow-x-auto overscroll-contain rounded-xl border border-slate-100 bg-white shadow-[inset_0_1px_0_0_rgba(248,250,252,1)] [-webkit-overflow-scrolling:touch] scrollbar-hide';

/** ≥7 dòng: giới hạn chiều cao, cuộn nội bộ */
export const procurementMonitorTableScrollClass =
  `${procurementMonitorTableFrameClass} max-h-[min(20rem,36dvh)] overflow-y-auto touch-pan-y`;

export const procurementMonitorTableHeadStickyClass =
  'sticky top-0 z-10 border-b border-slate-200 bg-[#F8FAFC] shadow-[0_1px_0_0_rgba(226,232,240,1)]';
