import { useState, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  AlertTriangle,
  UserCog,
  BarChart3,
  Settings,
  Building2,
  FileText,
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { StandardDashboardSidebar } from '../components/StandardDashboardSidebar';
import { useMobileDashboardNav, mainMarginForSidebar240 } from '../hooks/useMobileDashboardNav';
import {
  dashboardMainHorizontalBleedClass,
  dashboardMainOutletFlushClass,
  dashboardMainPaddingBottomOverviewClass,
  dashboardMainPaddingTopTightClass,
  dashboardMainPaddingXClass,
  dashboardOverviewOutletClass,
  dashboardOverviewScrollColumnClass,
  dashboardScrollEndSpacerClass,
} from '../constants/dashboardLayout';
import {
  buyerDashboardWorkspaceScrollBottomClass,
  buyerDashboardWorkspaceScrollRoundedBottomClass,
  buyerShellScrollCanvasClass,
} from '../constants/buyerLayout';

const BuyerManagerDashboard = () => {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const { mobileNavOpen, toggleMobileNav, closeMobileNav } = useMobileDashboardNav();

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

  if (user?.role !== 'BUYER_MANAGER' && user?.role !== 'SYSTEM_ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-red-600">
        Từ chối truy cập — chỉ tài khoản Trưởng phòng Mua hàng (BUYER_MANAGER).
      </div>
    );
  }

  const menuGroups = [
    {
      title: 'Tổng quan',
      items: [
        { icon: LayoutDashboard, label: 'Tổng quan mua hàng', path: '/dashboard/buyer-manager' },
      ],
    },
    {
      title: 'Quản lý',
      items: [
        { icon: Users, label: 'Quản lý đội Buyer', path: '/dashboard/buyer-manager/team-management' },
        { icon: Building2, label: 'Quản lý Vendor', path: '/dashboard/buyer-manager/vendor-management' },
        { icon: ClipboardCheck, label: 'Giám sát PR', path: '/dashboard/buyer-manager/pr-monitoring' },
        { icon: FileText, label: 'Duyệt PO', path: '/dashboard/buyer-manager/po-approval' },
        { icon: AlertTriangle, label: 'Ngoại lệ & rủi ro', path: '/dashboard/buyer-manager/exceptions' },
        { icon: UserCog, label: 'Quản lý người dùng & vai trò', path: '/dashboard/buyer-manager/user-management' },
      ],
    },
    {
      title: 'Phân tích',
      items: [
        { icon: BarChart3, label: 'Báo cáo & phân tích', path: '/dashboard/buyer-manager/reports' },
      ],
    },
    {
      title: 'Hệ thống',
      items: [
        { icon: Settings, label: 'Cấu hình hệ thống', path: '/dashboard/buyer-manager/system-config' },
      ],
    },
  ];

  const getPageTitle = () => {
    if (location.pathname === '/dashboard/buyer-manager') {
      return 'Tổng quan mua hàng';
    } else if (location.pathname.includes('/team-management')) {
      return 'Quản lý đội Buyer';
    } else if (location.pathname.includes('/vendor-management')) {
      return 'Quản lý Vendor';
    } else if (location.pathname.includes('/pr-monitoring')) {
      return 'Giám sát PR';
    } else if (location.pathname.includes('/po-approval')) {
      return 'Duyệt PO';
    } else if (location.pathname.includes('/exceptions')) {
      return 'Ngoại lệ & rủi ro';
    } else if (location.pathname.includes('/user-management')) {
      return 'Quản lý người dùng & vai trò';
    } else if (location.pathname.includes('/reports')) {
      return 'Báo cáo & phân tích';
    } else if (location.pathname.includes('/system-config')) {
      return 'Cấu hình hệ thống';
    }
    return 'Tổng quan mua hàng';
  };

  const getPageSubtitle = () => {
    if (location.pathname === '/dashboard/buyer-manager') {
      return 'Nhìn 1 màn hình là biết phòng mua đang thế nào';
    } else if (location.pathname.includes('/team-management')) {
      return 'Quản lý và theo dõi hiệu suất đội Buyer';
    } else if (location.pathname.includes('/vendor-management')) {
      return 'Quản lý nhà cung cấp, master data & hiệu suất';
    } else if (location.pathname.includes('/pr-monitoring')) {
      return 'Theo dõi PR toàn hệ thống (chỉ xem)';
    } else if (location.pathname.includes('/po-approval')) {
      return 'Duyệt hoặc từ chối PO do Buyer gửi lên';
    } else if (location.pathname.includes('/exceptions')) {
      return 'Cảnh báo sớm các rủi ro và ngoại lệ';
    } else if (location.pathname.includes('/user-management')) {
      return 'Quản lý người dùng và phân quyền';
    } else if (location.pathname.includes('/reports')) {
      return 'Báo cáo và phân tích hiệu suất';
    } else if (location.pathname.includes('/system-config')) {
      return 'Cấu hình hệ thống và SLA';
    }
    return '';
  };

  const isActive = (path: string) => {
    if (path === '/dashboard/buyer-manager') {
      return location.pathname === '/dashboard/buyer-manager';
    }
    return location.pathname.startsWith(path);
  };

  const isBuyerManagerOverviewHome = location.pathname === '/dashboard/buyer-manager';

  /** layout-shell-viewport-wrapper.md §2–§3 — một scroll trên main, outlet full chiều cao vùng cuộn */
  const buyerManagerMainScrollClass = [
    'flex min-h-0 min-w-0 flex-1 flex-col',
    'overflow-y-auto overflow-x-auto scrollbar-hide touch-pan-y',
    dashboardMainPaddingXClass,
    dashboardMainPaddingTopTightClass,
    isBuyerManagerOverviewHome
      ? dashboardMainPaddingBottomOverviewClass
      : buyerDashboardWorkspaceScrollBottomClass,
    isBuyerManagerOverviewHome ? 'bg-slate-50' : buyerShellScrollCanvasClass,
    !isBuyerManagerOverviewHome ? buyerDashboardWorkspaceScrollRoundedBottomClass : '',
  ]
    .filter(Boolean)
    .join(' ');

  const buyerManagerOutletClass = isBuyerManagerOverviewHome
    ? dashboardOverviewOutletClass
    : [
        'dashboard-outlet flex min-w-0 shrink-0 min-h-full self-stretch flex-col overflow-x-clip',
        dashboardMainOutletFlushClass,
        dashboardMainHorizontalBleedClass,
      ].join(' ');

  return (
    <div
      className="flex h-[100dvh] max-h-[100dvh] min-w-0 flex-col overflow-hidden bg-[#F8FAFC]"
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
        profileSecondaryText="Trưởng phòng Mua hàng"
      />

      {/* Main Content Area */}
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip ${mainMarginForSidebar240(sidebarCollapsed)}`}
      >
        <div className="shrink-0 min-w-0">
          <DashboardHeader
            title={getPageTitle()}
            subtitle={getPageSubtitle()}
            showSearch={true}
            showNotifications={true}
            showClock={true}
            roleLabel="Trưởng phòng Mua hàng"
            scrollContainerRef={contentScrollRef}
            onMobileNavToggle={toggleMobileNav}
          />
        </div>

        <div ref={contentScrollRef} className={buyerManagerMainScrollClass}>
          {isBuyerManagerOverviewHome ? (
            <div className={dashboardOverviewScrollColumnClass}>
              <div key={location.pathname} className={buyerManagerOutletClass}>
                <Outlet />
              </div>
            </div>
          ) : (
            <div key={location.pathname} className={buyerManagerOutletClass}>
              <Outlet />
            </div>
          )}
          <div aria-hidden className={dashboardScrollEndSpacerClass} />
        </div>
      </div>
    </div>
  );
};

export default BuyerManagerDashboard;
