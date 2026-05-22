import { useState, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import { LayoutDashboard, ShoppingCart, MapPin, Bell, Package } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { StandardDashboardSidebar } from '../components/StandardDashboardSidebar';
import { useMobileDashboardNav, mainMarginForSidebar240 } from '../hooks/useMobileDashboardNav';
import {
  dashboardMainOutletFlushClass,
  dashboardMainScrollChrome,
} from '../constants/dashboardLayout';
import { requestorMainShellPaddingClass } from '../constants/requestorLayout';

/**
 * Layout Requestor — cùng “khung xương” dashboard RMG (đồng bộ Branch / Dept Head):
 *
 * 1) Xương sống: `flex h-[100dvh] max-h-[100dvh] min-w-0 overflow-hidden` — một khối cao đúng viewport,
 *    không cuộn body lung tung; main `flex-1 min-h-0 min-w-0` chiếm phần còn lại sau sidebar.
 * 2) Sidebar mobile: `StandardDashboardSidebar` + `asideFixed240Motion` (fixed / translate / overlay).
 * 3) Bảng: token chung `src/constants/dataTableLayout.ts` (~7–8 dòng, cuộn, sticky thead, min-width ngang); từng module thêm `table-fixed`/colgroup nếu cần.
 * 4) Cuộn main: header `shrink-0`; vùng dưới — **cùng** `dashboardMainPaddingX` + `dashboardMainPaddingTopTight` + pb overview
 *    cho mọi route (`requestorMainShellPaddingClass`). Mặc định main `WideXFlushTop` + cuộn; PR/stock/form dùng `overflow-hidden`
 *    + outlet flush nhưng **không** bỏ padding shell — tránh lệch mép so với tổng quan.
 */

const RequestorDashboard = () => {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const { mobileNavOpen, toggleMobileNav, closeMobileNav } = useMobileDashboardNav();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Redirect if user is not Requestor
  if (user?.role !== 'REQUESTOR') {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-red-500">Từ chối truy cập</div>;
  }

  const menuGroups = [
    {
      title: 'Tổng quan',
      items: [
        { icon: LayoutDashboard, label: 'Tổng quan PR của tôi', path: '/dashboard/requestor' },
      ],
    },
    {
      title: 'Quản lý',
      items: [
        { icon: ShoppingCart, label: 'Yêu cầu mua hàng của tôi', path: '/dashboard/requestor/pr' },
        { icon: MapPin, label: 'Theo dõi trạng thái PR', path: '/dashboard/requestor/tracking' },
        { icon: Package, label: 'Theo dõi phiếu xuất kho', path: '/dashboard/requestor/stock-issues' },
      ],
    },
    {
      title: 'Thông báo',
      items: [
        { icon: Bell, label: 'Thông báo', path: '/dashboard/requestor/notifications' },
      ],
    },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard/requestor') {
      return location.pathname === '/dashboard/requestor';
    }
    return location.pathname.startsWith(path);
  };

  const isRequestorPRList = location.pathname === '/dashboard/requestor/pr';
  const isRequestorPRCreate = location.pathname === '/dashboard/requestor/pr/create';
  const isRequestorStockIssues = location.pathname.startsWith('/dashboard/requestor/stock-issues');
  const isRequestorPRTracking = location.pathname.startsWith('/dashboard/requestor/tracking');
  /** Danh sách PR / tạo PR / stock / theo dõi: outlet flush + trang con tự inset (giống MyPurchaseRequests). */
  const requestorMainInnerScrollLayout =
    isRequestorPRList ||
    isRequestorPRCreate ||
    isRequestorStockIssues ||
    isRequestorPRTracking;

  // Get page title based on route
  const getPageTitle = () => {
    if (location.pathname === '/dashboard/requestor') {
      return 'Tổng quan PR của tôi';
    } else if (location.pathname.includes('/stock-issues')) {
      if (location.pathname.includes('/create') || location.pathname.includes('/edit')) {
        return 'Tạo / sửa phiếu xuất kho';
      }
      return 'Phiếu xuất kho';
    } else if (location.pathname.includes('/pr')) {
      return 'Yêu cầu mua hàng của tôi';
    } else if (location.pathname.includes('/tracking')) {
      return 'Theo dõi trạng thái PR';
    } else if (location.pathname.includes('/notifications')) {
      return 'Thông báo';
    }
    return 'Tổng quan PR của tôi';
  };

  const getPageSubtitle = () => {
    if (location.pathname === '/dashboard/requestor') {
      return 'Bảng điều khiển người yêu cầu';
    } else if (location.pathname.includes('/stock-issues')) {
      return 'Dùng tồn kho — tách với PR mua hàng';
    } else if (location.pathname.includes('/pr')) {
      return 'Tạo và quản lý các PR của cá nhân';
    } else if (location.pathname.includes('/tracking')) {
      return 'PR đang bị chậm ở đâu – ai đang xử lý?';
    } else if (location.pathname.includes('/notifications')) {
      return 'Cập nhật các sự kiện ảnh hưởng đến PR';
    }
    return '';
  };

  const requestorMainScrollClass = [
    'h-full min-h-0 min-w-0 flex-1',
    dashboardMainScrollChrome,
    'bg-[#f1f5f9]',
  ].join(' ');

  const requestorMainUsesScroll =
    !requestorMainInnerScrollLayout ||
    isRequestorPRList ||
    isRequestorPRCreate ||
    isRequestorStockIssues ||
    isRequestorPRTracking;

  return (
    <div
      data-dashboard-shell
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
            roleLabel="Requestor"
            scrollContainerRef={requestorMainInnerScrollLayout ? undefined : contentScrollRef}
            onMobileNavToggle={toggleMobileNav}
          />
        </div>

        <div
          {...(requestorMainUsesScroll ? { 'data-dashboard-main-scroll': true as const } : {})}
          ref={requestorMainInnerScrollLayout ? undefined : contentScrollRef}
          className={
            requestorMainInnerScrollLayout
              ? isRequestorPRList ||
                isRequestorPRCreate ||
                isRequestorStockIssues ||
                isRequestorPRTracking
                ? requestorMainScrollClass
                : `flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f1f5f9] ${requestorMainShellPaddingClass}`
              : requestorMainScrollClass
          }
        >
          <div
            key={location.pathname}
            className={
              isRequestorPRCreate
                ? `dashboard-outlet flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${dashboardMainOutletFlushClass}`
                : isRequestorPRTracking
                  ? `dashboard-outlet flex h-full min-h-0 min-w-0 w-full flex-1 flex-col basis-0 overflow-hidden ${dashboardMainOutletFlushClass}`
                  : isRequestorPRList || isRequestorStockIssues
                    ? `dashboard-outlet flex h-full min-h-0 min-w-0 w-full flex-1 flex-col basis-0 overflow-hidden ${dashboardMainOutletFlushClass}`
                : 'dashboard-outlet flex h-full min-h-full w-full min-w-0 flex-1 self-stretch flex-col overflow-x-hidden'
            }
          >
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestorDashboard;

