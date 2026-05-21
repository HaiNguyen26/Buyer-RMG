/**
 * Layout Requestor — dong bo voi `requestor/DashboardHome` (tong quan PR).
 */

import {
  dashboardMainPaddingBottomOverviewClass,
  dashboardMainPaddingTopTightClass,
  dashboardMainPaddingXClass,
} from './dashboardLayout';

/**
 * Padding main duoi header — **trung** voi `dashboardMainScrollableOverviewWideXFlushTopClass`
 * (le trai/phai + khoang duoi header + day outlet). Dung tren shell Requestor cho **moi** route.
 */
export const requestorMainShellPaddingClass = [
  dashboardMainPaddingXClass,
  dashboardMainPaddingTopTightClass,
  dashboardMainPaddingBottomOverviewClass,
].join(' ');

/** Khoang doc giua hero / card / bang (khoi noi dung trong outlet; khong them px — shell da co). */
export const requestorPageStackClass = 'min-w-0 w-full space-y-4 sm:space-y-5 md:space-y-6';

/** Hop loc / noi dung phu — giong panel "Tong quan trang thai PR". */
export const requestorPanelCardClass =
  'rounded-2xl border border-slate-200/60 bg-white p-4 shadow-lg sm:p-5';

/** Vo bang danh sach + header xam — giong muc "PR dang hoat dong". */
export const requestorDataTableCardClass =
  'animate-fade-in-right bg-white rounded-xl shadow-md border border-slate-200/50 overflow-hidden';

/** Day tren card bang (tieu de + nut). */
export const requestorDataTableCardHeaderClass =
  'border-b border-slate-200 bg-[#F8FAFC] p-4 sm:p-6';
