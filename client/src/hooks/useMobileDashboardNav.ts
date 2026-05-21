import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Drawer sidebar trên &lt; md: mở bằng nút menu trên header, đóng khi đổi route hoặc bấm backdrop.
 */
export function useMobileDashboardNav() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);
  return {
    mobileNavOpen,
    setMobileNavOpen,
    toggleMobileNav: () => setMobileNavOpen((o) => !o),
    closeMobileNav: () => setMobileNavOpen(false),
  };
}

/** Sidebar cố định 240px / thu 80px — khớp hầu hết dashboard RMG */
export function asideFixed240Motion(mobileNavOpen: boolean, sidebarCollapsed: boolean): string {
  const w = sidebarCollapsed
    ? 'w-20'
    : 'w-[min(280px,90vw)] md:w-[240px]';
  return [
    'fixed left-0 top-0 z-[60] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden transition-all duration-300 ease-in-out md:z-50 md:translate-x-0',
    mobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
    w,
  ].join(' ');
}

export function mainMarginForSidebar240(sidebarCollapsed: boolean): string {
  return `ml-0 min-w-0 flex-1 transition-[margin] duration-300 ease-in-out ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-[240px]'}`;
}

/**
 * System Admin: sidebar w-16 / w-64, desktop in-flow; mobile fixed drawer.
 */
export function asideSystemAdminMotion(mobileNavOpen: boolean, sidebarCollapsed: boolean): string {
  const w = sidebarCollapsed ? 'w-16' : 'w-[min(280px,90vw)] md:w-64';
  return [
    'sidebar-gradient text-white flex flex-col overflow-hidden transition-all duration-300 ease-in-out',
    'fixed left-0 top-0 z-[60] h-[100dvh] max-h-[100dvh] flex-shrink-0 shadow-2xl md:relative md:left-auto md:top-auto md:z-auto md:h-auto md:max-h-none md:shadow-none',
    mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    w,
  ].join(' ');
}
