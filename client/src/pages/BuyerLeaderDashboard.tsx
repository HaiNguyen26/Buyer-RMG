import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import {
  LayoutDashboard,
  UserCheck,
  ClipboardList,
  Handshake,
  Bell,
  AlertTriangle,
  FileQuestion,
  Activity,
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { StandardDashboardSidebar } from '../components/StandardDashboardSidebar';
import { useMobileDashboardNav, mainMarginForSidebar240 } from '../hooks/useMobileDashboardNav';
import {
  dashboardMainOutletFlushClass,
  dashboardMainPaddingBottomOverviewClass,
  dashboardMainPaddingXClass,
  dashboardMainPaddingTopTightClass,
  dashboardOverviewScrollColumnClass,
} from '../constants/dashboardLayout';
import {
  buyerLeaderDashboardOverviewOutletClass,
  buyerLeaderDashboardScrollEndSpacerClass,
} from '../constants/buyerLeaderLayout';
import { dashboardV3PageBgClass } from '../components/dashboard/DashboardV3Chrome';

const BuyerLeaderDashboard = () => {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { mobileNavOpen, toggleMobileNav, closeMobileNav } = useMobileDashboardNav();
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const isBuyerLeaderOverviewHome =
    location.pathname === '/dashboard/buyer-leader' ||
    location.pathname === '/dashboard/buyer-leader/';

  useEffect(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }, [location.pathname, location.search]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Redirect if user is not Buyer Leader
  if (user?.role !== 'BUYER_LEADER') {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-red-500">Từ chối truy cập</div>;
  }

  const menuGroups = [
    {
      title: 'Tổng quan',
      items: [
        { icon: LayoutDashboard, label: 'Tổng quan', path: '/dashboard/buyer-leader' },
      ],
    },
    {
      title: 'Phân công PR',
      items: [
        { icon: ClipboardList, label: 'PR chờ phân công', path: '/dashboard/buyer-leader/pending-assignments' },
        { icon: UserCheck, label: 'Lịch sử phân công', path: '/dashboard/buyer-leader/assignments' },
        { icon: Activity, label: 'Theo dõi PR', path: '/dashboard/buyer-leader/pr-tracking' },
      ],
    },
    {
      title: 'RFQ & Báo giá',
      items: [
        { icon: FileQuestion, label: 'Giám sát RFQ', path: '/dashboard/buyer-leader/rfq-monitoring' },
        { icon: Handshake, label: 'Chọn NCC', path: '/dashboard/buyer-leader/compare-queue' },
      ],
    },
    {
      title: 'Giám sát',
      items: [
        { icon: AlertTriangle, label: 'PR Vượt ngân sách', path: '/dashboard/buyer-leader/over-budget-prs' },
      ],
    },
    {
      title: 'Thông báo',
      items: [
        { icon: Bell, label: 'Thông báo', path: '/dashboard/buyer-leader/notifications' },
      ],
    },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard/buyer-leader') {
      return location.pathname === '/dashboard/buyer-leader';
    }
    return location.pathname.startsWith(path);
  };

  // Get page title based on route
  const getPageTitle = () => {
    if (location.pathname === '/dashboard/buyer-leader') {
      return 'Tổng quan';
    } else if (location.pathname.includes('/pending-assignments')) {
      return 'PR chờ phân công';
    } else if (location.pathname.includes('/assignments')) {
      return 'Lịch sử phân công';
    } else if (location.pathname.includes('/pr-tracking')) {
      return 'Theo dõi PR';
    } else if (location.pathname.includes('/rfq-monitoring')) {
      return 'Giám sát RFQ';
    } else if (location.pathname.includes('/compare-queue')) {
      return 'Chọn NCC';
    } else if (location.pathname.includes('/select-supplier')) {
      return 'Chọn NCC (theo PR)';
    } else if (location.pathname.includes('/supplier/')) {
      return 'Hồ sơ nhà cung cấp';
    } else if (location.pathname.includes('/over-budget-prs')) {
      return 'PR vượt ngân sách';
    } else if (location.pathname.includes('/notifications')) {
      return 'Thông báo';
    }
    return 'Tổng quan';
  };

  const getPageSubtitle = () => {
    if (location.pathname === '/dashboard/buyer-leader') {
      return 'Trung tâm điều phối mua hàng';
    } else if (location.pathname.includes('/pending-assignments')) {
      return 'Phân công PR đã được duyệt cho Buyer';
    } else if (location.pathname.includes('/assignments')) {
      return 'Xem lịch sử phân công PR';
    } else if (location.pathname.includes('/pr-tracking')) {
      return 'Giám sát tiến độ theo từng item – Buyer, RFQ, trạng thái';
    } else if (location.pathname.includes('/rfq-monitoring')) {
      return 'RFQ đang mở, chờ đủ báo giá, quá hạn';
    } else if (location.pathname.includes('/compare-queue')) {
      return 'Từ đây mở danh sách RFQ hoặc workspace so sánh — trùng tên với màn chi tiết Chọn NCC đã có trước đây.';
    } else if (location.pathname.includes('/select-supplier')) {
      return 'Chọn báo giá và phê duyệt NCC khi đã đủ báo giá (URL có prId / rfqId)';
    } else if (location.pathname.includes('/compare-quotations')) {
      return 'So sánh báo giá, phân bổ và chọn nhà cung cấp';
    } else if (location.pathname.includes('/supplier/')) {
      return 'Thông tin chi tiết nhà cung cấp';
    } else if (location.pathname.includes('/over-budget-prs')) {
      return 'Theo dõi PR vượt ngân sách trước khi lên GĐ CN';
    } else if (location.pathname.includes('/notifications')) {
      return 'Thông báo và cảnh báo';
    }
    return '';
  };

  /** Workspace so sánh trao thầu — cần outlet không clip ngang để `position: sticky` cột phải hoạt động. */
  const isBuyerLeaderCompareAwardRoute = location.pathname.includes('/compare-quotations');

  /** Trang neo full viewport (bảng cuộn trong card) — không gồm workspace so sánh (nội dung dài, cuộn trên main). */
  const isBuyerLeaderWorkspaceFillRoute =
    location.pathname.includes('/pending-assignments') ||
    location.pathname.includes('/compare-queue') ||
    location.pathname.includes('/select-supplier');

  const buyerLeaderMainScrollClass = [
    'flex min-h-0 min-w-0 flex-1 flex-col',
    isBuyerLeaderWorkspaceFillRoute
      ? 'overflow-hidden pb-0'
      : 'overflow-y-auto overflow-x-auto scrollbar-hide touch-pan-y',
    dashboardMainPaddingXClass,
    dashboardMainPaddingTopTightClass,
    isBuyerLeaderOverviewHome
      ? dashboardMainPaddingBottomOverviewClass
      : isBuyerLeaderWorkspaceFillRoute
        ? 'pb-0'
        : 'pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+1rem))] sm:pb-10 md:pb-11',
    isBuyerLeaderOverviewHome ? dashboardV3PageBgClass : 'bg-slate-50',
  ]
    .filter(Boolean)
    .join(' ');

  const buyerLeaderOutletClass = isBuyerLeaderOverviewHome
    ? buyerLeaderDashboardOverviewOutletClass
    : isBuyerLeaderWorkspaceFillRoute
      ? [
          'dashboard-outlet flex min-h-0 min-w-0 h-full min-h-full w-full flex-1 flex-col self-stretch overflow-hidden overflow-x-clip',
          dashboardMainOutletFlushClass,
        ].join(' ')
      : isBuyerLeaderCompareAwardRoute
        ? [
            'dashboard-outlet flex min-w-0 w-full shrink-0 min-h-full flex-col',
            dashboardMainOutletFlushClass,
          ].join(' ')
        : [
            'dashboard-outlet flex min-w-0 w-full shrink-0 min-h-full flex-col overflow-x-clip',
            dashboardMainOutletFlushClass,
          ].join(' ');

  return (
    <div
      className="flex h-[100dvh] max-h-[100dvh] min-w-0 flex-col overflow-hidden bg-slate-50"
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
        className={[
          'flex min-h-0 min-w-0 flex-1 flex-col',
          isBuyerLeaderCompareAwardRoute ? 'overflow-x-visible' : 'overflow-x-clip',
          mainMarginForSidebar240(sidebarCollapsed),
        ].join(' ')}
      >
        <div className="shrink-0 min-w-0">
          <DashboardHeader
            title={getPageTitle()}
            subtitle={getPageSubtitle()}
            showSearch={true}
            showNotifications={true}
            showClock={true}
            roleLabel="Buyer Leader"
            scrollContainerRef={contentScrollRef}
            onMobileNavToggle={toggleMobileNav}
          />
        </div>

        <div ref={contentScrollRef} className={buyerLeaderMainScrollClass}>
          {isBuyerLeaderOverviewHome ? (
            <div className={dashboardOverviewScrollColumnClass}>
              <div key={location.pathname} className={buyerLeaderOutletClass}>
                <Outlet />
              </div>
              <div aria-hidden className={buyerLeaderDashboardScrollEndSpacerClass} />
            </div>
          ) : (
            <div key={location.pathname} className={buyerLeaderOutletClass}>
              <Outlet />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuyerLeaderDashboard;

