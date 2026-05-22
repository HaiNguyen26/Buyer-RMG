import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import {
    LayoutDashboard,
    ClipboardCheck,
    Handshake,
    TrendingUp,
    BarChart3,
    Settings,
    Bell,
    Radar,
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { StandardDashboardSidebar } from '../components/StandardDashboardSidebar';
import { useMobileDashboardNav, mainMarginForSidebar240 } from '../hooks/useMobileDashboardNav';
import {
  dashboardMainWorkspaceRegionClass,
  dashboardOutletWorkspaceFlexClass,
} from '../constants/dashboardLayout';

const BuyerManageDashboard = () => {
    const { data: user, isLoading } = useCurrentUser();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const { mobileNavOpen, toggleMobileNav, closeMobileNav } = useMobileDashboardNav();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9]">
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
                { icon: LayoutDashboard, label: 'Bảng điều khiển BGD', path: '/dashboard/buyer-manage' },
            ],
        },
        {
            title: 'Giám sát',
            items: [
                {
                    icon: Radar,
                    label: 'Giám sát mua hàng',
                    path: '/dashboard/buyer-manage/procurement-monitoring',
                },
                { icon: ClipboardCheck, label: 'Tổng quan PR', path: '/dashboard/buyer-manage/pr-overview' },
                { icon: Handshake, label: 'Tổng quan NCC', path: '/dashboard/buyer-manage/supplier-overview' },
                { icon: TrendingUp, label: 'Hiệu suất Buyer', path: '/dashboard/buyer-manage/buyer-performance' },
            ],
        },
        {
            title: 'Phân tích',
            items: [
                { icon: BarChart3, label: 'Báo cáo', path: '/dashboard/buyer-manage/reports' },
            ],
        },
        {
            title: 'Hệ thống',
            items: [
                { icon: Settings, label: 'Cấu hình hệ thống', path: '/dashboard/buyer-manage/system-config' },
                { icon: Bell, label: 'Thông báo', path: '/dashboard/buyer-manage/notifications' },
            ],
        },
    ];

    const isActive = (path: string) => {
        if (path === '/dashboard/buyer-manage') {
            return location.pathname === '/dashboard/buyer-manage';
        }
        return location.pathname.startsWith(path);
    };

    // Get page title based on route
    const getPageTitle = () => {
        if (location.pathname === '/dashboard/buyer-manage') {
            return 'Bảng điều khiển BGD';
        } else if (location.pathname.includes('/procurement-monitoring')) {
            return 'Giám sát mua hàng';
        } else if (location.pathname.includes('/pr-overview')) {
            return 'Tổng quan PR';
        } else if (location.pathname.includes('/supplier-overview')) {
            return 'Tổng quan NCC';
        } else if (location.pathname.includes('/buyer-performance')) {
            return 'Hiệu suất Buyer';
        } else if (location.pathname.includes('/reports')) {
            return 'Báo cáo';
        } else if (location.pathname.includes('/system-config')) {
            return 'Cấu hình hệ thống';
        } else if (location.pathname.includes('/notifications')) {
            return 'Thông báo';
        }
        return 'Bảng điều khiển BGD';
    };

    const getPageSubtitle = () => {
        if (location.pathname === '/dashboard/buyer-manage') {
            return 'Tình hình mua hàng & chi phí của công ty đang như thế nào?';
        } else if (location.pathname.includes('/procurement-monitoring')) {
            return 'Theo dõi PR/PO toàn công ty — trung tâm vận hành';
        } else if (location.pathname.includes('/pr-overview')) {
            return 'Giám sát toàn bộ PR trong hệ thống';
        } else if (location.pathname.includes('/supplier-overview')) {
            return 'Theo dõi tình hình sử dụng NCC';
        } else if (location.pathname.includes('/buyer-performance')) {
            return 'Đánh giá hiệu quả làm việc của đội Buyer';
        } else if (location.pathname.includes('/reports')) {
            return 'Phân tích và báo cáo cho lãnh đạo cấp cao';
        } else if (location.pathname.includes('/system-config')) {
            return 'Thiết lập các quy tắc vận hành hệ thống';
        } else if (location.pathname.includes('/notifications')) {
            return 'Nhận cảnh báo quan trọng';
        }
        return '';
    };

    return (
        <div
            className="flex min-h-[100dvh] flex-col overflow-hidden bg-[#F1F5F9]"
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
                profileSecondaryText="Ban Giám đốc Mua hàng"
            />

            {/* Main Content Area */}
            <div
                className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden ${mainMarginForSidebar240(sidebarCollapsed)}`}
            >
                <div className="shrink-0">
                <DashboardHeader
                    title={getPageTitle()}
                    subtitle={getPageSubtitle()}
                    showSearch={true}
                    showNotifications={true}
                    showClock={true}
                    roleLabel="Trưởng phòng Mua hàng"
                    onMobileNavToggle={toggleMobileNav}
                />
                </div>

                <div className={`${dashboardMainWorkspaceRegionClass} bg-slate-50`}>
                    <div key={location.pathname} className={dashboardOutletWorkspaceFlexClass}>
                        <Outlet />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuyerManageDashboard;
