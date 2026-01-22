import { useState, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../hooks/useAuth';
import {
    Menu,
    LayoutDashboard,
    Users,
    Settings,
    Building2,
    Upload,
    Bell,
    Search,
    User,
    LogOut,
    X,
    FileText,
    Shield,
} from 'lucide-react';
import LogoRMG from '../assets/LogoRMG.png';
import DashboardHeader from '../components/DashboardHeader';

const SystemAdminDashboard = () => {
    const { data: user, isLoading } = useCurrentUser();
    const logout = useLogout();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const mainContentRef = useRef<HTMLElement>(null);

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
                { icon: LayoutDashboard, label: 'System Overview', path: '/dashboard/system-admin', active: true },
            ],
        },
        {
            title: 'Quản trị',
            items: [
                { icon: Users, label: 'User Management', path: '/dashboard/system-admin/users', active: false },
                { icon: FileText, label: 'Approval Config', path: '/dashboard/system-admin/approval-config', active: false },
                { icon: Building2, label: 'Organization', path: '/dashboard/system-admin/organization', active: false },
            ],
        },
        {
            title: 'Dữ liệu',
            items: [
                { icon: Upload, label: 'Import Center', path: '/dashboard/system-admin/import', active: false },
            ],
        },
        {
            title: 'Hệ thống',
            items: [
                { icon: Settings, label: 'System Settings', path: '/dashboard/system-admin/settings', active: false },
                { icon: Bell, label: 'Notifications', path: '/dashboard/system-admin/notifications', active: false },
            ],
        },
    ];

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Chào buổi sáng';
        if (hour < 18) return 'Chào buổi chiều';
        return 'Chào buổi tối';
    };

    const getPageTitle = () => {
        if (location.pathname === '/dashboard/system-admin') {
            return 'System Overview';
        } else if (location.pathname.includes('/users')) {
            return 'User Management';
        } else if (location.pathname.includes('/approval-config')) {
            return 'Approval Configuration';
        } else if (location.pathname.includes('/organization')) {
            return 'Organization Management';
        } else if (location.pathname.includes('/import')) {
            return 'Import Center';
        } else if (location.pathname.includes('/settings')) {
            return 'System Settings';
        } else if (location.pathname.includes('/notifications')) {
            return 'Notifications';
        }
        return 'System Overview';
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
        <div className="min-h-screen bg-[#F1F5F9] flex">
            {/* Sidebar */}
            <aside
                className={`bg-[#0F172A] text-white transition-all duration-300 flex flex-col ${
                    sidebarCollapsed ? 'w-16' : 'w-64'
                }`}
            >
                {/* Logo & Collapse */}
                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                    {!sidebarCollapsed && (
                        <div className="flex items-center gap-3">
                            <img src={LogoRMG} alt="RMG Logo" className="h-8 w-auto" />
                            <div>
                                <h2 className="text-sm font-bold text-white">System Admin</h2>
                                <p className="text-xs text-slate-400">Quản trị hệ thống</p>
                            </div>
                        </div>
                    )}
                    {sidebarCollapsed && (
                        <div className="w-full flex justify-center">
                            <Shield className="w-6 h-6 text-indigo-400" />
                        </div>
                    )}
                    {!sidebarCollapsed && (
                        <button
                            onClick={() => setSidebarCollapsed(true)}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                            title="Thu gọn"
                        >
                            <X className="w-4 h-4 text-slate-300" />
                        </button>
                    )}
                    {sidebarCollapsed && (
                        <button
                            onClick={() => setSidebarCollapsed(false)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title="Mở rộng"
                        >
                            <Menu className="w-5 h-5 text-white" />
                        </button>
                    )}
                </div>

                {/* Navigation Menu */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-6">
                    {menuGroups.map((group, groupIdx) => (
                        <div key={groupIdx}>
                            {!sidebarCollapsed && (
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
                                    {group.title}
                                </h3>
                            )}
                            <ul className="space-y-1">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = location.pathname === item.path || (item.path !== '/dashboard/system-admin' && location.pathname.startsWith(item.path));
                                    return (
                                        <li key={item.path}>
                                            <button
                                                onClick={() => navigate(item.path)}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                                                    isActive
                                                        ? 'bg-indigo-600 text-white shadow-lg'
                                                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                                }`}
                                                title={sidebarCollapsed ? item.label : undefined}
                                            >
                                                <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
                                                {!sidebarCollapsed && (
                                                    <span className="text-sm font-medium">{item.label}</span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* User Info & Logout */}
                <div className="p-4 border-t border-slate-700/50">
                    {!sidebarCollapsed && (
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                                <User className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{user?.username || 'Admin'}</p>
                                <p className="text-xs text-slate-400 truncate">System Admin</p>
                            </div>
                        </div>
                    )}
                    {sidebarCollapsed && (
                        <div className="flex justify-center mb-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                                <User className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => logout()}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white transition-all ${
                            sidebarCollapsed ? 'justify-center' : ''
                        }`}
                        title={sidebarCollapsed ? 'Đăng xuất' : undefined}
                    >
                        <LogOut className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
                        {!sidebarCollapsed && <span className="text-sm font-medium">Đăng xuất</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main ref={mainContentRef} className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <DashboardHeader />

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-6">
                        {/* Page Title */}
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-slate-900 mb-1">{getPageTitle()}</h1>
                            <p className="text-slate-600">{getPageSubtitle()}</p>
                        </div>

                        {/* Outlet for nested routes */}
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SystemAdminDashboard;







