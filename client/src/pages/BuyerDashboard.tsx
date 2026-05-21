import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Inbox,
  FileQuestion,
  DollarSign,
  BarChart3,
  Bell,
  Scale,
  ShoppingCart,
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { StandardDashboardSidebar } from '../components/StandardDashboardSidebar';
import {
  dashboardMainHorizontalBleedClass,
  dashboardMainOutletFlushClass,
  dashboardMainPaddingBottomOverviewClass,
  dashboardMainPaddingXClass,
  dashboardMainPaddingTopTightClass,
} from '../constants/dashboardLayout';
import {
  dashboardOverviewScrollColumnClass,
  dashboardScrollEndSpacerClass,
} from '../constants/dashboardLayout';
import {
  buyerDashboardMainScrollEndSpacerClass,
  buyerDashboardOverviewOutletClass,
  buyerDashboardWorkspaceScrollBottomClass,
  buyerDashboardWorkspaceScrollRoundedBottomClass,
  buyerShellScrollCanvasClass,
} from '../constants/buyerLayout';
import { dashboardV3PageBgClass } from '../components/dashboard/DashboardV3Chrome';
import { useMobileDashboardNav, mainMarginForSidebar240 } from '../hooks/useMobileDashboardNav';

const BuyerDashboard = () => {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { mobileNavOpen, toggleMobileNav, closeMobileNav } = useMobileDashboardNav();
  const contentScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }, [location.pathname, location.search]);

  if (isLoading) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${dashboardV3PageBgClass}`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Redirect if user is not Buyer
  if (user?.role !== 'BUYER') {
    return (
      <div className={`flex min-h-screen items-center justify-center ${dashboardV3PageBgClass} text-red-500`}>
        Từ chối truy cập
      </div>
    );
  }

  const menuGroups = [
    {
      title: 'Tổng quan',
      items: [
        { icon: LayoutDashboard, label: 'Tổng quan', path: '/dashboard/buyer' },
      ],
    },
    {
      title: 'Quản lý PR',
      items: [
        { icon: Inbox, label: 'PR được phân công', path: '/dashboard/buyer/assigned-prs' },
      ],
    },
    {
      title: 'RFQ & Báo giá',
      items: [
        { icon: FileQuestion, label: 'Quản lý RFQ', path: '/dashboard/buyer/rfq' },
        { icon: DollarSign, label: 'Quản lý báo giá', path: '/dashboard/buyer/quotation' },
        { icon: Scale, label: 'So sánh báo giá NCC', path: '/dashboard/buyer/price-comparison' },
      ],
    },
    {
      title: 'PO (Đơn hàng)',
      items: [
        { icon: ShoppingCart, label: 'PR chờ tạo PO', path: '/dashboard/buyer/po/prs-waiting' },
        { icon: Inbox, label: 'Danh sách PO', path: '/dashboard/buyer/po/list' },
      ],
    },
    {
      title: 'Tham chiếu',
      items: [
        { icon: BarChart3, label: 'Tham chiếu chi phí dự án', path: '/dashboard/buyer/project-cost' },
      ],
    },
    {
      title: 'Thông báo',
      items: [
        { icon: Bell, label: 'Thông báo', path: '/dashboard/buyer/notifications' },
      ],
    },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard/buyer') {
      return location.pathname === '/dashboard/buyer';
    }
    return location.pathname.startsWith(path);
  };

  // Get page title based on route
  const getPageTitle = () => {
    if (location.pathname === '/dashboard/buyer') {
      return 'Tổng quan';
    } else if (location.pathname.includes('/assigned-pr')) {
      return 'PR được phân công';
    } else if (location.pathname.includes('/rfq')) {
      return 'Quản lý RFQ';
    } else if (location.pathname.includes('/quotation')) {
      return 'Quản lý báo giá';
    } else if (location.pathname.includes('/price-comparison')) {
      return 'So sánh báo giá NCC';
    } else if (location.pathname.includes('/project-cost')) {
      return 'Tham chiếu chi phí dự án';
    } else if (location.pathname.includes('/notifications')) {
      return 'Thông báo';
    } else if (location.pathname.includes('/po/')) {
      if (location.pathname.includes('/po/prs-waiting')) return 'PR chờ tạo PO';
      if (location.pathname.includes('/po/list')) return 'Danh sách PO';
      if (location.pathname.includes('/po/create')) return 'Tạo PO';
      if (location.pathname.includes('/po/') && location.pathname.match(/\/po\/[a-z0-9-]+$/)) return 'Chi tiết PO';
      return 'PO';
    }
    return 'Tổng quan';
  };

  /** Một lớp `pb` trên scroll (+ stack trang); outlet `pb-0` — gutter đáy gần mép, không chồng dày. */
  const isBuyerOverviewHome = location.pathname === '/dashboard/buyer';
  const buyerMainScrollClass = [
    'flex min-h-0 min-w-0 flex-1 flex-col',
    'overflow-y-auto overflow-x-auto scrollbar-hide touch-pan-y',
    dashboardMainPaddingXClass,
    dashboardMainPaddingTopTightClass,
    isBuyerOverviewHome ? dashboardMainPaddingBottomOverviewClass : buyerDashboardWorkspaceScrollBottomClass,
    isBuyerOverviewHome ? dashboardV3PageBgClass : buyerShellScrollCanvasClass,
    !isBuyerOverviewHome ? buyerDashboardWorkspaceScrollRoundedBottomClass : '',
  ]
    .filter(Boolean)
    .join(' ');

  const buyerOutletClass = isBuyerOverviewHome
    ? buyerDashboardOverviewOutletClass
    : [
        'dashboard-outlet flex min-w-0 shrink-0 min-h-full self-stretch flex-col overflow-x-clip',
        dashboardMainOutletFlushClass,
        dashboardMainHorizontalBleedClass,
      ].join(' ');

  const getPageSubtitle = () => {
    if (location.pathname === '/dashboard/buyer') {
      return 'Trung tâm mua hàng';
    } else if (location.pathname.includes('/assigned-pr')) {
      return 'Danh sách PR được phân công';
    } else if (location.pathname.includes('/rfq')) {
      return 'Tạo và quản lý RFQ';
    } else if (location.pathname.includes('/quotation')) {
      return 'Lưu trữ và quản lý báo giá từ NCC';
    } else if (location.pathname.includes('/price-comparison')) {
      return 'So sánh đơn giá và tổng tiền giữa các báo giá (không hiển thị giá tham chiếu PR)';
    } else if (location.pathname.includes('/project-cost')) {
      return 'Tham chiếu ngân sách dự án (chỉ xem)';
    } else if (location.pathname.includes('/notifications')) {
      return 'Cập nhật thay đổi liên quan đến PR / RFQ';
    } else if (location.pathname.includes('/po/')) {
      if (location.pathname.includes('/po/prs-waiting')) return 'PR đã chọn NCC, sẵn sàng tạo đơn hàng';
      if (location.pathname.includes('/po/list')) return 'Xem và quản lý đơn hàng';
      if (location.pathname.includes('/po/create')) return 'Tạo đơn hàng từ PR';
      return 'Đơn hàng mua (Purchase Order)';
    }
    return '';
  };

  return (
    <div
      className={`flex h-[100dvh] max-h-[100dvh] min-w-0 flex-col overflow-hidden ${dashboardV3PageBgClass}`}
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
      />

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
            roleLabel="Buyer"
            scrollContainerRef={contentScrollRef}
            onMobileNavToggle={toggleMobileNav}
          />
        </div>

        <div ref={contentScrollRef} className={buyerMainScrollClass}>
          {isBuyerOverviewHome ? (
            <div className={dashboardOverviewScrollColumnClass}>
              <div key={location.pathname} className={buyerOutletClass}>
                <Outlet />
              </div>
            </div>
          ) : (
            <div key={location.pathname} className={buyerOutletClass}>
              <Outlet />
            </div>
          )}
          <div
            aria-hidden
            className={
              isBuyerOverviewHome ? dashboardScrollEndSpacerClass : buyerDashboardMainScrollEndSpacerClass
            }
          />
        </div>
      </div>
    </div>
  );
};

export default BuyerDashboard;


