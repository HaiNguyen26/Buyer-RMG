/**
 * Layout nội dung Giám đốc chi nhánh — cùng token với Requestor (`requestorLayout`).
 * Page root/content: đồng bộ Department Head + layout shell (một scroll main, nền #f1f5f9).
 */

export const branchManagerPageRootClass = 'w-full min-h-full min-w-0 bg-[#f1f5f9]';

export const branchManagerPageContentClass =
  'mx-auto w-full max-w-none min-w-0 space-y-6 px-1 pt-3 pb-3 sm:px-1.5 sm:pt-4 sm:pb-4 md:px-3';

/** Đảo KPI chỉ số chủ chốt — `embedded` trong một island (dashboard-v3 §4). */
export const branchManagerKpiIslandPaddingClass = '!rounded-[24px] !p-4 md:!p-5';

export const branchManagerKpiGridClass =
  'grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5 xl:grid-cols-4 xl:gap-2.5';

export {
  requestorMainShellPaddingClass as branchManagerMainShellPaddingClass,
  requestorPageStackClass as branchManagerPageStackClass,
  requestorPanelCardClass as branchManagerPanelCardClass,
  requestorDataTableCardClass as branchManagerDataTableCardClass,
  requestorDataTableCardHeaderClass as branchManagerDataTableCardHeaderClass,
} from './requestorLayout';
