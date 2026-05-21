import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { setDeptHeadMockOutletActive } from '../mocks/deptHeadMockScope';
import { isDeptHeadMockEnvEnabled } from '../mocks/departmentHeadDevMock';
import { useCurrentUser } from '../hooks/useAuth';
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  Building2,
  Bell,
  User,
  FilePlus,
  Package,
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { StandardDashboardSidebar } from '../components/StandardDashboardSidebar';
import { useMobileDashboardNav, mainMarginForSidebar240 } from '../hooks/useMobileDashboardNav';
import {
  dashboardMainHorizontalBleedClass,
  dashboardMainOutletCompactClass,
  dashboardMainOutletFlushClass,
  dashboardMainScrollableOverviewWideXFlushTopClass,
  dashboardOutletWorkspaceFlexClass,
} from '../constants/dashboardLayout';
import { requestorMainShellPaddingClass } from '../constants/requestorLayout';

const DepartmentHeadDashboard = () => {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const { mobileNavOpen, toggleMobileNav, closeMobileNav } = useMobileDashboardNav();

  useEffect(() => {
    if (!isDeptHeadMockEnvEnabled()) return;
    setDeptHeadMockOutletActive(true);
    return () => setDeptHeadMockOutletActive(false);
  }, []);

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

  const menuGroups = [
    {
      title: 'Điều hướng cá nhân',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard cá nhân', path: '/dashboard/department-head' },
        { icon: ClipboardList, label: 'PR của tôi', path: '/dashboard/department-head/my-prs' },
        { icon: FilePlus, label: 'Tạo Phiếu yêu cầu (PR)', path: '/dashboard/department-head/my-prs/create' },
        { icon: Package, label: 'Theo dõi phiếu xuất kho', path: '/dashboard/department-head/stock-issues' },
      ],
    },
    {
      title: 'Phê duyệt phòng ban',
      items: [
        { icon: CheckSquare, label: 'Duyệt PR phòng ban', path: '/dashboard/department-head/pr-approval' },
      ],
    },
    {
      title: 'Trung tâm tổng quan',
      items: [
        { icon: Building2, label: 'Tổng quan PR phòng ban', path: '/dashboard/department-head/department-overview' },
      ],
    },
    {
      title: 'Tiện ích',
      items: [
        { icon: Bell, label: 'Thông báo', path: '/dashboard/department-head/notifications' },
        { icon: User, label: 'Hồ sơ cá nhân', path: '/dashboard/department-head/profile' },
      ],
    },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard/department-head') {
      return location.pathname === '/dashboard/department-head';
    }
    return location.pathname.startsWith(path);
  };

  const getPageTitle = () => {
    const p = location.pathname;
    if (p === '/dashboard/department-head') return 'Dashboard cá nhân';
    if (p.includes('/stock-issues')) return 'Phiếu xuất kho';
    if (p.includes('/my-prs/create')) return 'Tạo Phiếu yêu cầu (PR)';
    if (p.includes('/my-prs')) return 'PR của tôi';
    if (p.includes('/pr-approval')) return 'Duyệt PR phòng ban';
    if (p.includes('/department-overview')) return 'Tổng quan PR phòng ban';
    if (p.includes('/notifications')) return 'Thông báo';
    if (p.includes('/profile')) return 'Hồ sơ cá nhân';
    return 'Trưởng phòng';
  };

  const isDepartmentHeadPRForm =
    location.pathname.includes('/my-prs/create') ||
    /\/dashboard\/department-head\/my-prs\/[^/]+\/edit$/.test(location.pathname);

  const isDeptHeadStockIssues = location.pathname.startsWith('/dashboard/department-head/stock-issues');

  const getPageSubtitle = () => {
    const p = location.pathname;
    if (p === '/dashboard/department-head') return 'Tổng quan khi trưởng phòng là người yêu cầu';
    if (p.includes('/stock-issues')) return 'Dùng tồn kho — tách với PR mua hàng';
    if (p.includes('/my-prs')) return 'PR do bạn tạo và theo dõi';
    if (p.includes('/pr-approval')) return 'Duyệt PR thuộc phòng ban';
    if (p.includes('/department-overview')) return 'Toàn cảnh PR phòng ban';
    if (p.includes('/notifications')) return 'Thông báo hệ thống';
    if (p.includes('/profile')) return 'Thông tin tài khoản';
    return '';
  };

  /**
   * Header nằm NGOÀI vùng cuộn: shell 100dvh + chỉ khối dưới header có overflow-y-auto.
   * Outlet không flex-1 trên trang dài — scrollHeight đủ, tránh cắt đáy.
   */
  const isDeptHeadPersonalHome = location.pathname === '/dashboard/department-head';
  const isDeptHeadPrApprovalPage = location.pathname.startsWith('/dashboard/department-head/pr-approval');
  const isDeptHeadDepartmentOverviewPage = location.pathname.startsWith(
    '/dashboard/department-head/department-overview',
  );
  const isDeptHeadContentSizedOutlet =
    isDeptHeadPersonalHome || isDeptHeadPrApprovalPage || isDeptHeadDepartmentOverviewPage;

  /** Bảng rộng: cuộn ngang chỉ ở `departmentHeadMainScrollClass` (WideX); outlet không thêm `overflow-x-auto` (tránh scrollbar/góc vuông). */
  const isDeptHeadWideTableRoute = isDeptHeadPrApprovalPage || isDeptHeadDepartmentOverviewPage;

  /** Form PR: overflow-hidden + padding shell. Stock issues: nội dung cao được cuộn trên main (không khóa h-full + overflow-hidden trên outlet — sẽ cắt trang không tạo scroll). */
  const departmentHeadOutletClass = isDepartmentHeadPRForm
    ? `dashboard-outlet flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${dashboardMainOutletFlushClass}`
    : isDeptHeadStockIssues
      ? `dashboard-outlet flex w-full min-w-0 flex-col overflow-x-clip !min-h-full ${dashboardMainOutletCompactClass}`
      : isDeptHeadContentSizedOutlet
        ? [
            'dashboard-outlet flex h-full min-h-full min-w-0 flex-1 basis-0 flex-col',
            isDeptHeadWideTableRoute ? '' : 'overflow-x-clip',
            'dashboard-main-outlet max-w-none pb-3 sm:pb-4 md:pb-5',
            dashboardMainHorizontalBleedClass,
          ]
            .filter(Boolean)
            .join(' ')
        : dashboardOutletWorkspaceFlexClass;
  /** Chỉ một tầng `overflow-x-auto` (ở đây) — tránh đè trên `mainColumn` + `dashboard-outlet` (góc scrollbar vuông / nền lạ). */
  const departmentHeadMainScrollClass = isDepartmentHeadPRForm
    ? `flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f1f5f9] ${requestorMainShellPaddingClass}`
    : isDeptHeadStockIssues
      ? [
          'flex h-full min-h-0 min-w-0 w-full flex-1 flex-col basis-0',
          'overflow-y-auto overflow-x-hidden scrollbar-hide touch-pan-y bg-[#f1f5f9]',
        ].join(' ')
    : [
        dashboardMainScrollableOverviewWideXFlushTopClass,
        'bg-[#f1f5f9]',
        isDeptHeadPersonalHome ? 'pb-6 sm:pb-8 md:pb-10' : '',
      ]
        .filter(Boolean)
        .join(' ');

  const rootShellClass =
    'flex h-[100dvh] max-h-[100dvh] min-w-0 flex-col overflow-hidden bg-[#F8FAFC]';

  const mainColumnClass = [
    'flex min-h-0 min-w-0 flex-1 flex-col',
    'overflow-x-clip',
    mainMarginForSidebar240(sidebarCollapsed),
  ].join(' ');

  return (
    <div className={rootShellClass} style={{ minHeight: '100dvh' }}>
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

      {/* Main Content */}
      <div className={mainColumnClass}>
        <div className="shrink-0">
          <DashboardHeader
            title={getPageTitle()}
            subtitle={getPageSubtitle()}
            showSearch={true}
            showNotifications={true}
            showClock={true}
            roleLabel="Trưởng phòng"
            scrollContainerRef={contentScrollRef}
            onMobileNavToggle={toggleMobileNav}
          />
        </div>
        <div ref={contentScrollRef} className={departmentHeadMainScrollClass}>
          <div key={location.pathname} className={departmentHeadOutletClass}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentHeadDashboard;

