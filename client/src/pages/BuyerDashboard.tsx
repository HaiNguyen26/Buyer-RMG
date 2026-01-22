import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../hooks/useAuth';
import {
  Menu,
  LayoutDashboard,
  Inbox,
  FileQuestion,
  DollarSign,
  BarChart3,
  Bell,
  Search,
  LogOut,
  X,
  User,
  AlertTriangle,
  Scale,
} from 'lucide-react';
import LogoRMG from '../assets/LogoRMG.png';
import DashboardHeader from '../components/DashboardHeader';

const BuyerDashboard = () => {
  const { data: user, isLoading } = useCurrentUser();
  const logout = useLogout();
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

  // Redirect if user is not Buyer
  if (user?.role !== 'BUYER') {
    return <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9] text-red-500">Access Denied</div>;
  }

  const menuGroups = [
    {
      title: 'Tổng quan',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard/buyer' },
      ],
    },
    {
      title: 'Quản lý PR',
      items: [
        { icon: Inbox, label: 'Assigned PR', path: '/dashboard/buyer/assigned-pr' },
      ],
    },
    {
      title: 'RFQ & Báo giá',
      items: [
        { icon: FileQuestion, label: 'RFQ Management', path: '/dashboard/buyer/rfq' },
        { icon: DollarSign, label: 'Quotation Management', path: '/dashboard/buyer/quotation' },
        { icon: Scale, label: 'Price Comparison (PR vs RFQ)', path: '/dashboard/buyer/price-comparison' },
      ],
    },
    {
      title: 'Cảnh báo',
      items: [
        { icon: AlertTriangle, label: 'Over Budget Alerts', path: '/dashboard/buyer/over-budget' },
      ],
    },
    {
      title: 'Tham chiếu',
      items: [
        { icon: BarChart3, label: 'Project Cost Reference', path: '/dashboard/buyer/project-cost' },
      ],
    },
    {
      title: 'Thông báo',
      items: [
        { icon: Bell, label: 'Notifications', path: '/dashboard/buyer/notifications' },
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
      return 'Dashboard';
    } else if (location.pathname.includes('/assigned-pr')) {
      return 'Assigned PR';
    } else if (location.pathname.includes('/rfq')) {
      return 'RFQ Management';
    } else if (location.pathname.includes('/quotation')) {
      return 'Quotation Management';
    } else if (location.pathname.includes('/project-cost')) {
      return 'Project Cost Reference';
    } else if (location.pathname.includes('/notifications')) {
      return 'Notifications';
    }
    return 'Dashboard';
  };

  const getPageSubtitle = () => {
    if (location.pathname === '/dashboard/buyer') {
      return 'Tổng quan công việc Buyer';
    } else if (location.pathname.includes('/assigned-pr')) {
      return 'Danh sách PR được phân công';
    } else if (location.pathname.includes('/rfq')) {
      return 'Tạo và quản lý RFQ';
    } else if (location.pathname.includes('/quotation')) {
      return 'Lưu trữ và quản lý báo giá từ NCC';
    } else if (location.pathname.includes('/price-comparison')) {
      return 'So sánh giá PR (Requestor) với giá báo NCC - Highlight phần vượt';
    } else if (location.pathname.includes('/over-budget')) {
      return 'Danh sách PR: Giá mua > Giá PR - Tránh mua khi chưa có xác nhận';
    } else if (location.pathname.includes('/project-cost')) {
      return 'Tham chiếu ngân sách dự án (View Only)';
    } else if (location.pathname.includes('/notifications')) {
      return 'Cập nhật thay đổi liên quan đến PR / RFQ';
    }
    return '';
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9]">
      {/* Sidebar - Fixed */}
      <aside
        className={`bg-[#0F172A] border-r border-slate-700/50 transition-all duration-300 ease-in-out fixed left-0 top-0 ${
          sidebarCollapsed ? 'w-20' : 'w-[240px]'
        } flex flex-col h-screen overflow-hidden z-50`}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-[#0F172A] border-b border-slate-700/50 p-4">
          {!sidebarCollapsed && (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2 mb-4">
                <img 
                  src={LogoRMG} 
                  alt="RMG Logo" 
                  className="h-12 w-auto"
                />
                <h1 className="text-white font-bold text-lg">RMG Enterprise</h1>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-800/50 border border-slate-700 rounded-soft focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6] text-white placeholder-slate-400 backdrop-blur-sm"
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
            </div>
          )}
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="w-full flex items-center justify-center p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-soft transition-colors"
              title="Mở rộng"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Menu - Independent Scroll */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
          {menuGroups.map((group, groupIdx) => (
            <div key={groupIdx} className={groupIdx > 0 ? 'mt-6' : ''}>
              {!sidebarCollapsed && (
                <h2 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {group.title}
                </h2>
              )}
              <div className="space-y-1">
                {group.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <button
                      key={itemIdx}
                      onClick={() => navigate(item.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-soft transition-all duration-200 ${
                        active
                          ? 'bg-[#3B82F6] text-white'
                          : 'text-slate-300 hover:bg-white/10 hover:text-white backdrop-blur-sm'
                      }`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} strokeWidth={2} />
                      {!sidebarCollapsed && (
                        <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-700/50 p-4 bg-[#0F172A]">
          {!sidebarCollapsed && user && (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-[#3B82F6] flex items-center justify-center text-white text-sm font-semibold">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.username}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            {!sidebarCollapsed && (
              <>
                <button
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white rounded-soft transition-colors"
                  title="Thông báo"
                >
                  <Bell className="w-4 h-4" />
                  <span>Thông báo</span>
                </button>
                <button
                  onClick={logout}
                  className="flex items-center justify-center px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white rounded-soft transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
            {sidebarCollapsed && (
              <>
                <button
                  className="flex-1 flex items-center justify-center p-2 text-slate-300 hover:bg-white/10 hover:text-white rounded-soft transition-colors"
                  title="Thông báo"
                >
                  <Bell className="w-4 h-4" />
                </button>
                <button
                  onClick={logout}
                  className="flex items-center justify-center p-2 text-slate-300 hover:bg-white/10 hover:text-white rounded-soft transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  className="flex items-center justify-center p-2 text-slate-300 hover:bg-white/10 hover:text-white rounded-soft transition-colors"
                  title="Mở rộng"
                >
                  <Menu className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area - With margin for fixed sidebar */}
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'ml-20' : 'ml-[240px]'
        }`}
        style={{ minHeight: '100vh' }}
      >
        {/* Sticky Header */}
        <DashboardHeader 
          title={getPageTitle()} 
          subtitle={getPageSubtitle()}
          showSearch={true}
          showNotifications={true}
          showClock={true}
          roleLabel="Buyer"
        />
        
        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default BuyerDashboard;


