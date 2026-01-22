import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import {
    Menu,
    LayoutDashboard,
    ClipboardCheck,
    History,
    BarChart3,
    Bell,
    Search,
    User,
    X,
    ShieldAlert,
} from 'lucide-react';
import LogoRMG from '../assets/LogoRMG.png';
import DashboardHeader from '../components/DashboardHeader';

const BranchManagerDashboard = () => {
    const { data: user, isLoading } = useCurrentUser();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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
                { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard/branch-manager', active: true },
            ],
        },
        {
            title: 'Duyệt PR',
            items: [
                { icon: ClipboardCheck, label: 'PR Approval', path: '/dashboard/branch-manager/pr-approval', active: false },
                { icon: ShieldAlert, label: 'Budget Exception Approval', path: '/dashboard/branch-manager/budget-exception', active: false },
                { icon: History, label: 'PR History', path: '/dashboard/branch-manager/pr-history', active: false },
            ],
        },
        {
            title: 'Phân tích',
            items: [
                { icon: BarChart3, label: 'Branch Overview', path: '/dashboard/branch-manager/branch-overview', active: false },
            ],
        },
        {
            title: 'Thông báo',
            items: [
                { icon: Bell, label: 'Notifications', path: '/dashboard/branch-manager/notifications', active: false },
            ],
        },
    ];

    // Get page title based on route
    const getPageTitle = () => {
        if (location.pathname === '/dashboard/branch-manager') {
            return 'Dashboard';
        } else if (location.pathname.includes('/pr-approval')) {
            return 'PR Approval';
        } else if (location.pathname.includes('/budget-exception')) {
            return 'Budget Exception Approval';
        } else if (location.pathname.includes('/pr-history')) {
            return 'PR History';
        } else if (location.pathname.includes('/branch-overview')) {
            return 'Branch Overview';
        } else if (location.pathname.includes('/notifications')) {
            return 'Notifications';
        }
        return 'Dashboard';
    };

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
        <div className="h-screen flex flex-col bg-[#F1F5F9] overflow-hidden">
            {/* Sidebar - Fixed */}
            <aside
                className={`bg-[#0F172A] border-r border-slate-700/50 transition-all duration-300 ease-in-out fixed left-0 top-0 ${sidebarCollapsed ? 'w-20' : 'w-[240px]'
                    } flex flex-col h-screen overflow-hidden z-50`}
            >
                {/* Sticky Header với Search */}
                <div className="sticky top-0 z-10 bg-[#0F172A] border-b border-slate-700/50 p-4">
                    {!sidebarCollapsed && (
                        <div className="space-y-3">
                            {/* Logo và Title */}
                            <div className="flex flex-col items-center gap-2 mb-2">
                                <img
                                    src={LogoRMG}
                                    alt="RMG Logo"
                                    className="h-12 w-auto object-contain"
                                />
                                <h1 className="text-white font-bold text-lg">RMG Enterprise</h1>
                            </div>
                            {/* Search Bar */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6] text-white placeholder-slate-400 backdrop-blur-sm"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={() => setSidebarCollapsed(true)}
                                className="w-full flex items-center justify-center p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                                title="Thu gọn"
                            >
                                <X className="w-4 h-4 text-slate-300" />
                            </button>
                        </div>
                    )}
                    {sidebarCollapsed && (
                        <div className="flex justify-center">
                            <button
                                onClick={() => setSidebarCollapsed(false)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                title="Mở rộng"
                            >
                                <Menu className="w-5 h-5 text-white" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Navigation Menu - Independent Scroll */}
                <nav className="flex-1 overflow-y-auto py-4 px-3">
                    {menuGroups.map((group, groupIdx) => (
                        <div key={groupIdx} className={groupIdx > 0 ? 'mt-6' : ''}>
                            {!sidebarCollapsed && (
                                <h3 className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                                    {group.title}
                                </h3>
                            )}
                            <ul className="space-y-1">
                                {group.items.map((item, itemIdx) => {
                                    const isActive = location.pathname === item.path || (item.path === '/dashboard/branch-manager' && location.pathname === '/dashboard/branch-manager');
                                    return (
                                        <li key={itemIdx}>
                                            <button
                                                onClick={() => item.path && navigate(item.path)}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-soft transition-all duration-200 ease-in-out ${isActive
                                                        ? 'bg-[#3B82F6] text-white'
                                                        : 'text-slate-300 hover:bg-white/10 hover:text-white backdrop-blur-sm'
                                                    }`}
                                                title={sidebarCollapsed ? item.label : undefined}
                                            >
                                                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} strokeWidth={2} />
                                                {!sidebarCollapsed && (
                                                    <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                                                )}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Sidebar Footer */}
                <div className="border-t border-slate-700/50 p-4 bg-[#0F172A]">
                    <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                        <div className="w-10 h-10 bg-slate-700/50 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-slate-300" />
                        </div>
                        {!sidebarCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
                                <p className="text-xs text-slate-400 truncate">Giám đốc Chi nhánh</p>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div
                className={`flex-1 flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${sidebarCollapsed ? 'ml-20' : 'ml-[240px]'
                    }`}
                style={{ height: '100vh' }}
            >
                {/* Sticky Header */}
                <DashboardHeader
                    title={getPageTitle()}
                    subtitle={getPageSubtitle()}
                    showSearch={true}
                    showNotifications={true}
                    showClock={true}
                    roleLabel="Giám đốc Chi nhánh"
                />

                {/* Workspace - Main Content */}
                <main className={`flex-1 overflow-y-auto ${location.pathname.includes('/pr-approval') ? '' : 'p-6'}`}>
                    <div className={`max-w-full mx-auto ${location.pathname.includes('/pr-approval') ? 'h-full' : ''}`}>
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default BranchManagerDashboard;

