import { useState, useRef } from 'react';
import { useMobileDashboardNav, mainMarginForSidebar240 } from '../hooks/useMobileDashboardNav';
import { useWarehouseRealtime } from '../hooks/useWarehouseRealtime';
import {
  dashboardMainScrollableOverviewWideXFlushTopClass,
  dashboardOutletWorkspaceFlexClass,
} from '../constants/dashboardLayout';
import {
  warehouseWorkspaceOutletFlushClass,
} from '../constants/warehouseLayout';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import { LayoutDashboard, Package, User, ClipboardList, Truck, History } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { StandardDashboardSidebar } from '../components/StandardDashboardSidebar';

/**
 * Shell giống Requestor: 100dvh, main cuộn với padding token; lưới tồn / PO chờ nhận / phiếu xuất dùng outlet flush + padding shell.
 */
const WarehouseDashboard = () => {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const { mobileNavOpen, toggleMobileNav, closeMobileNav } = useMobileDashboardNav();

  useWarehouseRealtime(user?.role === 'WAREHOUSE' || user?.role === 'SYSTEM_ADMIN');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (user?.role !== 'WAREHOUSE' && user?.role !== 'SYSTEM_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-red-500">
        Từ chối truy cập
      </div>
    );
  }

  const menuGroups = [
    {
      title: 'Menu',
      items: [
        { icon: LayoutDashboard, label: 'Trang chủ', path: '/dashboard/warehouse' },
        { icon: Truck, label: 'PO chờ nhận', path: '/dashboard/warehouse/incoming' },
        { icon: History, label: 'Lịch sử nhập kho', path: '/dashboard/warehouse/grn-history' },
        { icon: ClipboardList, label: 'Phiếu xuất kho', path: '/dashboard/warehouse/stock-issues' },
        { icon: Package, label: 'Quản lý tồn kho', path: '/dashboard/warehouse/inventory' },
        { icon: User, label: 'Hồ sơ', path: '/dashboard/warehouse/profile' },
      ],
    },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard/warehouse') {
      return (
        location.pathname === '/dashboard/warehouse' || location.pathname === '/dashboard/warehouse/'
      );
    }
    return location.pathname.startsWith(path);
  };

  const getPageTitle = () => {
    if (/\/incoming\/[^/]+\/grn\/?$/.test(location.pathname)) return 'Phiếu nhập kho';
    if (location.pathname.includes('/incoming')) return 'PO chờ nhận · Incoming';
    if (location.pathname.includes('/grn-history')) return 'Lịch sử nhập kho';
    if (location.pathname.includes('/stock-issues')) return 'Phiếu xuất kho';
    if (location.pathname.includes('/inventory')) return 'Inventory Management';
    if (location.pathname.includes('/profile')) return 'Profile';
    return 'Warehouse Dashboard';
  };

  const isGrnReceiveForm = /\/incoming\/[^/]+\/grn\/?$/.test(location.pathname);

  /** Workspace full viewport — PO chờ nhận / GRN form / lịch sử / phiếu xuất. */
  const isWarehouseWorkspaceViewport =
    isGrnReceiveForm ||
    location.pathname.includes('/stock-issues') ||
    location.pathname.includes('/incoming') ||
    location.pathname.includes('/grn-history');

  const getPageSubtitle = () => {
    if (/\/incoming\/[^/]+\/grn\/?$/.test(location.pathname)) {
      return 'Nhập số lượng, ngày nhận và xác nhận — tạo GRN, cập nhật tồn và PO.';
    }
    if (location.pathname.includes('/incoming')) return 'Incoming queue — PO còn việc nhận, tiến độ Received.';
    if (location.pathname.includes('/grn-history')) return 'Phiếu đã nhận — tra cứu GRN, PO, NCC và trạng thái nhận.';
    if (location.pathname.includes('/stock-issues')) return 'Duyệt / xuất phiếu — gắn tồn và giữ chỗ.';
    if (location.pathname.includes('/inventory')) return 'Lưới tồn kho theo vật tư và kho — không quản giá/NCC tại đây.';
    if (location.pathname.includes('/profile')) return 'Thông tin tài khoản.';
    return 'Theo dõi tồn kho theo vật tư và kho — không quản lý giá và nhà cung cấp tại đây';
  };

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
        profileSecondaryText="Phòng kho"
      />

      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip ${mainMarginForSidebar240(sidebarCollapsed)}`}
      >
        <div className="shrink-0 min-w-0">
          <DashboardHeader
            title={getPageTitle()}
            subtitle={getPageSubtitle()}
            showSearch={false}
            showNotifications={true}
            showClock={true}
            roleLabel="Kho"
            scrollContainerRef={contentScrollRef}
            onMobileNavToggle={toggleMobileNav}
          />
        </div>

        <div
          ref={contentScrollRef}
          className={
            isWarehouseWorkspaceViewport
              ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f1f5f9]'
              : `${dashboardMainScrollableOverviewWideXFlushTopClass} bg-slate-50`
          }
        >
          <div
            key={location.pathname}
            className={
              isWarehouseWorkspaceViewport
                ? `dashboard-outlet flex h-full min-h-0 min-w-0 w-full flex-1 flex-col basis-0 overflow-hidden ${warehouseWorkspaceOutletFlushClass}`
                : dashboardOutletWorkspaceFlexClass
            }
          >
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarehouseDashboard;
