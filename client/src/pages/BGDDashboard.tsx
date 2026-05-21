import { useState, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  PieChart,
  ShieldAlert,
  Globe,
  BarChart3,
  Bell,
  Settings,
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { StandardDashboardSidebar } from '../components/StandardDashboardSidebar';
import { useCurrentUser } from '../hooks/useAuth';
import { useMobileDashboardNav, mainMarginForSidebar240 } from '../hooks/useMobileDashboardNav';
import {
  dashboardMainHorizontalBleedClass,
  dashboardMainOutletClass,
  dashboardMainScrollableClass,
} from '../constants/dashboardLayout';

const BGDDashboard = () => {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const mainScrollRef = useRef<HTMLElement>(null);
  const { mobileNavOpen, toggleMobileNav, closeMobileNav } = useMobileDashboardNav();

  const menuGroups = [
    {
      title: 'Tổng quan',
      items: [{ icon: LayoutDashboard, label: 'Bảng điều khiển BGD', path: '/dashboard/bgd' }],
    },
    {
      title: 'Tổng quan & Phân tích',
      items: [
        { icon: PieChart, label: 'Tổng quan kinh doanh', path: '/dashboard/bgd/business-overview' },
        { icon: Globe, label: 'Nhà cung cấp chiến lược', path: '/dashboard/bgd/strategic-suppliers' },
      ],
    },
    {
      title: 'Duyệt & Quản trị',
      items: [
        { icon: ShieldAlert, label: 'Duyệt ngoại lệ', path: '/dashboard/bgd/exception-approval' },
        { icon: Settings, label: 'Quản trị & chính sách', path: '/dashboard/bgd/governance' },
      ],
    },
    {
      title: 'Báo cáo & Cảnh báo',
      items: [
        { icon: BarChart3, label: 'Báo cáo BGD', path: '/dashboard/bgd/reports' },
        { icon: Bell, label: 'Cảnh báo quan trọng', path: '/dashboard/bgd/alerts' },
      ],
    },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard/bgd') {
      return location.pathname === '/dashboard/bgd';
    }
    return location.pathname.startsWith(path);
  };

  const getPageTitle = () => {
    const p = location.pathname;
    if (p === '/dashboard/bgd') return 'Bảng điều khiển BGD';
    if (p.includes('/business-overview')) return 'Tổng quan kinh doanh';
    if (p.includes('/strategic-suppliers')) return 'Nhà cung cấp chiến lược';
    if (p.includes('/exception-approval')) return 'Duyệt ngoại lệ';
    if (p.includes('/governance')) return 'Quản trị & chính sách';
    if (p.includes('/reports')) return 'Báo cáo BGD';
    if (p.includes('/alerts')) return 'Cảnh báo quan trọng';
    return 'BGD';
  };

  const getPageSubtitle = () => {
    const p = location.pathname;
    if (p === '/dashboard/bgd') return 'Góc nhìn tổng giám đốc';
    if (p.includes('/business-overview')) return 'Kết quả và xu hướng kinh doanh';
    if (p.includes('/strategic-suppliers')) return 'Đối tác chiến lược';
    if (p.includes('/exception-approval')) return 'Quyết định ngoại lệ';
    if (p.includes('/governance')) return 'Chính sách và tuân thủ';
    if (p.includes('/reports')) return 'Báo cáo điều hành';
    if (p.includes('/alerts')) return 'Cảnh báo cần chú ý';
    return '';
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100"
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
        profileSecondaryText="Tổng Giám đốc"
      />

      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden ${mainMarginForSidebar240(sidebarCollapsed)}`}
      >
        <DashboardHeader
          title={getPageTitle()}
          subtitle={getPageSubtitle()}
          showSearch={true}
          showNotifications={true}
          showClock={true}
          roleLabel="BGD"
          scrollContainerRef={mainScrollRef}
          onMobileNavToggle={toggleMobileNav}
        />
        <main
          ref={mainScrollRef}
          className={`${dashboardMainScrollableClass} bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100`}
        >
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

export default BGDDashboard;
