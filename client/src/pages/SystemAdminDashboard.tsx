import { useState, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import {
    LayoutDashboard,
    Users,
    Settings,
    Building2,
    Upload,
    Bell,
    FileText,
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';
import { StandardDashboardSidebar } from '../components/StandardDashboardSidebar';
import { useMobileDashboardNav, mainMarginForSidebar240 } from '../hooks/useMobileDashboardNav';
import {
    dashboardMainHorizontalBleedClass,
    dashboardMainOutletClass,
    dashboardMainScrollableClass,
} from '../constants/dashboardLayout';

const SystemAdminDashboard = () => {
    const { data: user, isLoading } = useCurrentUser();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const mainContentRef = useRef<HTMLElement>(null);
    const contentScrollRef = useRef<HTMLDivElement>(null);
    const { mobileNavOpen, toggleMobileNav, closeMobileNav } = useMobileDashboardNav();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Đang tải...</p>
                </div>
            </div>
        );
    }

    const menuGroups = [
        {
            title: 'Tổng quan',
            items: [
                { icon: LayoutDashboard, label: 'Tổng quan hệ thống', path: '/dashboard/system-admin' },
            ],
        },
        {
            title: 'Quản trị',
            items: [
                { icon: Users, label: 'Quản lý người dùng', path: '/dashboard/system-admin/users' },
                { icon: FileText, label: 'Cấu hình duyệt', path: '/dashboard/system-admin/approval-config' },
                { icon: Building2, label: 'Tổ chức', path: '/dashboard/system-admin/organization' },
            ],
        },
        {
            title: 'Dữ liệu',
            items: [
                { icon: Upload, label: 'Trung tâm import', path: '/dashboard/system-admin/import' },
            ],
        },
        {
            title: 'Hệ thống',
            items: [
                { icon: Settings, label: 'Cài đặt hệ thống', path: '/dashboard/system-admin/settings' },
                { icon: Bell, label: 'Thông báo', path: '/dashboard/system-admin/notifications' },
            ],
        },
    ];

    const isActive = (path: string) => {
        if (path === '/dashboard/system-admin') {
            return location.pathname === '/dashboard/system-admin';
        }
        return location.pathname.startsWith(path);
    };

    const getPageTitle = () => {
        if (location.pathname === '/dashboard/system-admin') {
            return 'Tổng quan hệ thống';
        } else if (location.pathname.includes('/users')) {
            return 'Quản lý người dùng';
        } else if (location.pathname.includes('/approval-config')) {
            return 'Cấu hình duyệt';
        } else if (location.pathname.includes('/organization')) {
            return 'Quản lý tổ chức';
        } else if (location.pathname.includes('/import')) {
            return 'Trung tâm import';
        } else if (location.pathname.includes('/settings')) {
            return 'Cài đặt hệ thống';
        } else if (location.pathname.includes('/notifications')) {
            return 'Thông báo';
        }
        return 'Tổng quan hệ thống';
    };

    const getPageSubtitle = () => {
        if (location.pathname === '/dashboard/system-admin') {
            return 'Tình trạng hệ thống và cấu hình';
        } else if (location.pathname.includes('/users')) {
            return 'Quản lý nhân viên và phân quyền';
        } else if (location.pathname.includes('/approval-config')) {
            return 'Cấu hình luồng duyệt PR';
        } else if (location.pathname.includes('/organization')) {
            return 'Quản lý cấu trúc công ty';
        } else if (location.pathname.includes('/import')) {
            return 'Import dữ liệu từ Excel';
        }
        return 'Hệ thống quản trị';
    };

    return (
        <div
            className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#F1F5F9]"
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
                profileSecondaryText="System Admin"
            />

            <main ref={mainContentRef} className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${mainMarginForSidebar240(sidebarCollapsed)}`}>
                <DashboardHeader
                    title={getPageTitle()}
                    subtitle={getPageSubtitle()}
                    showSearch={true}
                    showNotifications={true}
                    showClock={true}
                    roleLabel="System Admin"
                    scrollContainerRef={contentScrollRef}
                    onMobileNavToggle={toggleMobileNav}
                />

                <div ref={contentScrollRef} className={`${dashboardMainScrollableClass} bg-[#F1F5F9]`}>
                    <div
                        key={location.pathname}
                        className={`dashboard-outlet flex min-h-0 min-w-0 flex-col ${dashboardMainOutletClass} ${dashboardMainHorizontalBleedClass}`}
                    >
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SystemAdminDashboard;
