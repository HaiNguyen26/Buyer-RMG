import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { setBranchManagerMockOutletActive } from '../mocks/branchManagerMockScope';
import { isBranchManagerMockEnvEnabled } from '../mocks/branchManagerDevMock';
import { useCurrentUser } from '../hooks/useAuth';
import { LayoutDashboard, ClipboardCheck, History, BarChart3, Bell, ShieldAlert } from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { StandardDashboardSidebar } from '../components/StandardDashboardSidebar';
import { useMobileDashboardNav, mainMarginForSidebar240 } from '../hooks/useMobileDashboardNav';
import {
    dashboardMainHorizontalBleedClass,
    dashboardMainScrollableOverviewWideXFlushTopClass,
    dashboardOutletWorkspaceFlexClass,
} from '../constants/dashboardLayout';

const BranchManagerDashboard = () => {
    const { data: user, isLoading } = useCurrentUser();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!isBranchManagerMockEnvEnabled()) return;
        setBranchManagerMockOutletActive(true);
        return () => setBranchManagerMockOutletActive(false);
    }, []);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { mobileNavOpen, toggleMobileNav, closeMobileNav } = useMobileDashboardNav();
    const contentScrollRef = useRef<HTMLDivElement>(null);

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
            title: 'Tổng quan',
            items: [
                { icon: LayoutDashboard, label: 'Tổng quan', path: '/dashboard/branch-manager' },
                { icon: BarChart3, label: 'Tổng quan chi nhánh', path: '/dashboard/branch-manager/branch-overview' },
            ],
        },
        {
            title: 'Duyệt PR',
            items: [
                { icon: ClipboardCheck, label: 'Duyệt PR', path: '/dashboard/branch-manager/pr-approval' },
                { icon: ShieldAlert, label: 'Duyệt ngoại lệ ngân sách', path: '/dashboard/branch-manager/budget-exception' },
                { icon: History, label: 'Lịch sử PR', path: '/dashboard/branch-manager/pr-history' },
            ],
        },
        {
            title: 'Thông báo',
            items: [
                { icon: Bell, label: 'Thông báo', path: '/dashboard/branch-manager/notifications' },
            ],
        },
    ];

    const isActive = (path: string) => {
        if (path === '/dashboard/branch-manager') {
            return location.pathname === '/dashboard/branch-manager';
        }
        return location.pathname.startsWith(path);
    };

    // Get page title based on route
    const getPageTitle = () => {
        if (location.pathname === '/dashboard/branch-manager') {
            return 'Tổng quan';
        } else if (location.pathname.includes('/pr-approval')) {
            return 'Duyệt PR';
        } else if (location.pathname.includes('/budget-exception')) {
            return 'Duyệt ngoại lệ ngân sách';
        } else if (location.pathname.includes('/pr-history')) {
            return 'Lịch sử PR';
        } else if (location.pathname.includes('/branch-overview')) {
            return 'Tổng quan chi nhánh';
        } else if (location.pathname.includes('/notifications')) {
            return 'Thông báo';
        }
        return 'Tổng quan';
    };

    const pathname = location.pathname;
    const isBranchManagerShellFillRoute =
        pathname === '/dashboard/branch-manager' ||
        pathname.startsWith('/dashboard/branch-manager/branch-overview');

    /** Một luồng cuộn trên main — nền canvas giống Trưởng phòng §layout-shell */
    const branchManagerMainScrollClass = [
        dashboardMainScrollableOverviewWideXFlushTopClass,
        'bg-[#f1f5f9]',
        isBranchManagerShellFillRoute ? 'pb-6 sm:pb-8 md:pb-10' : '',
    ]
        .filter(Boolean)
        .join(' ');

    const branchManagerOutletClass = isBranchManagerShellFillRoute
        ? [
              'dashboard-outlet flex h-full min-h-full min-w-0 flex-1 basis-0 flex-col overflow-x-clip',
              'dashboard-main-outlet max-w-none pb-3 sm:pb-4 md:pb-5',
              dashboardMainHorizontalBleedClass,
          ].join(' ')
        : dashboardOutletWorkspaceFlexClass;

    const getPageSubtitle = () => {
        if (location.pathname === '/dashboard/branch-manager') {
            return 'Hôm nay chi nhánh tôi cần duyệt những PR nào?';
        } else if (location.pathname.includes('/pr-approval')) {
            return 'Trung tâm duyệt PR của chi nhánh';
        } else if (location.pathname.includes('/budget-exception')) {
            return 'Điểm quyết định nghiệp vụ: Chấp nhận vượt ngân sách hoặc yêu cầu thương lượng lại';
        } else if (location.pathname.includes('/pr-history')) {
            return 'Theo dõi lịch sử PR của chi nhánh';
        } else if (location.pathname.includes('/branch-overview')) {
            return 'Nắm xu hướng nhu cầu mua của chi nhánh';
        } else if (location.pathname.includes('/notifications')) {
            return 'Nhận thông báo cần hành động';
        }
        return '';
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
                profileSecondaryText="Giám đốc Chi nhánh"
            />

            {/* Main: header ngoài vùng cuộn; main WideXFlushTop + outlet — đồng bộ Requestor / Dept Head */}
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
                        roleLabel="Giám đốc Chi nhánh"
                        scrollContainerRef={contentScrollRef}
                        onMobileNavToggle={toggleMobileNav}
                    />
                </div>

                <div ref={contentScrollRef} className={branchManagerMainScrollClass}>
                    <div key={location.pathname} className={branchManagerOutletClass}>
                        <Outlet />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BranchManagerDashboard;

