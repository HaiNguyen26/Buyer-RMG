import { useState, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import { LayoutDashboard, FileText, ShoppingCart, User } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { StandardDashboardSidebar } from '../components/StandardDashboardSidebar';
import { useMobileDashboardNav, mainMarginForSidebar240 } from '../hooks/useMobileDashboardNav';
import {
  dashboardMainHorizontalBleedClass,
  dashboardMainOutletClass,
  dashboardMainScrollableClass,
} from '../constants/dashboardLayout';

const SalesDashboard = () => {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const mainScrollRef = useRef<HTMLElement>(null);
  const { mobileNavOpen, toggleMobileNav, closeMobileNav } = useMobileDashboardNav();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (user?.role !== 'SALES') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-red-500">
        Từ chối truy cập
      </div>
    );
  }

  const menuGroups = [
    {
      title: 'Tổng quan',
      items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard/sales' }],
    },
    {
      title: 'Sales',
      items: [{ icon: FileText, label: 'Sales Orders', path: '/dashboard/sales/orders' }],
    },
    {
      title: 'Mua hàng',
      items: [{ icon: ShoppingCart, label: 'PR (view only)', path: '/dashboard/sales/pr' }],
    },
    {
      title: 'Khác',
      items: [{ icon: User, label: 'Profile', path: '/dashboard/sales/profile' }],
    },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard/sales') return location.pathname === '/dashboard/sales';
    if (path === '/dashboard/sales/orders') {
      return (
        location.pathname.startsWith('/dashboard/sales/orders') ||
        location.pathname.startsWith('/dashboard/sales/customer-po')
      );
    }
    return location.pathname.startsWith(path);
  };

  const getPageTitle = () => {
    if (location.pathname === '/dashboard/sales') return 'Dashboard';
    if (location.pathname.includes('/orders/create')) return 'Tạo Sales Order';
    if (location.pathname.match(/\/orders\/[^/]+$/)) return 'Chi tiết SO';
    if (location.pathname.includes('/orders') || location.pathname.includes('/customer-po'))
      return 'Sales Orders';
    if (location.pathname.includes('/pr')) return 'PR (xem)';
    if (location.pathname.includes('/profile')) return 'Profile';
    return 'Sales';
  };

  const getPageSubtitle = () => {
    if (location.pathname.includes('/orders') || location.pathname.includes('/customer-po'))
      return 'SO — theo dõi dự án, PR và chi phí';
    if (location.pathname.includes('/pr')) return 'Xem tiến độ mua hàng';
    return 'Tổng quan dự án';
  };

  return (
    <div
      className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-50"
      style={{ minHeight: '100dvh' }}
    >
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[55] bg-slate-900/50 backdrop-blur-[1px] md:hidden"
          onClick={closeMobileNav}
          aria-label="Đóng menu"
        />
      ) : null}
      <StandardDashboardSidebar
        menuGroups={menuGroups}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        mobileNavOpen={mobileNavOpen}
        user={user}
        isActive={isActive}
        navigate={navigate}
        profileSecondaryText="Sales"
      />

      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden ${mainMarginForSidebar240(sidebarCollapsed)}`}
      >
        <DashboardHeader
          title={getPageTitle()}
          subtitle={getPageSubtitle()}
          showSearch={false}
          showNotifications={true}
          showClock={true}
          roleLabel="Sales"
          scrollContainerRef={mainScrollRef}
          onMobileNavToggle={toggleMobileNav}
        />
        <main ref={mainScrollRef} className={`${dashboardMainScrollableClass} bg-slate-50`}>
          <div
            key={location.pathname}
            className={`dashboard-outlet flex min-h-0 min-w-0 flex-col ${dashboardMainOutletClass} ${dashboardMainHorizontalBleedClass}`}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default SalesDashboard;
