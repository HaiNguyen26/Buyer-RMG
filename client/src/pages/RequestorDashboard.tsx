import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../hooks/useAuth';
import {
  Menu,
  LayoutDashboard,
  ShoppingCart,
  MapPin,
  Search,
  User,
  X,
  Bell,
} from 'lucide-react';
import LogoRMG from '../assets/LogoRMG.png';
import DashboardHeader from '../components/DashboardHeader';

const RequestorDashboard = () => {
  const { data: user, isLoading } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-red-500">Access Denied</div>;
  }

  const menuGroups = [
    {
      title: 'Tổng quan',
      items: [
        { icon: LayoutDashboard, label: 'My PR Dashboard', path: '/dashboard/requestor' },
      ],
    },
    {
      title: 'Quản lý',
      items: [
        { icon: ShoppingCart, label: 'My Purchase Requests', path: '/dashboard/requestor/pr' },
        { icon: MapPin, label: 'PR Status Tracking', path: '/dashboard/requestor/tracking' },
      ],
    },
    {
      title: 'Thông báo',
      items: [
        { icon: Bell, label: 'Notifications', path: '/dashboard/requestor/notifications' },
      ],
    },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard/requestor') {
      return location.pathname === '/dashboard/requestor';
    }
    return location.pathname.startsWith(path);
  };

  // Get page title based on route
  const getPageTitle = () => {
    if (location.pathname === '/dashboard/requestor') {
      return 'My PR Dashboard';
    } else if (location.pathname.includes('/pr')) {
      return 'My Purchase Requests';
    } else if (location.pathname.includes('/tracking')) {
      return 'PR Status Tracking';
    } else if (location.pathname.includes('/notifications')) {
      return 'Notifications';
    }
    return 'My PR Dashboard';
  };

  const getPageSubtitle = () => {
    if (location.pathname === '/dashboard/requestor') {
      return 'Requestor Dashboard';
    } else if (location.pathname.includes('/pr')) {
      return 'Tạo và quản lý các PR của cá nhân';
    } else if (location.pathname.includes('/tracking')) {
      return 'PR đang bị chậm ở đâu – ai đang xử lý?';
    } else if (location.pathname.includes('/notifications')) {
      return 'Cập nhật các sự kiện ảnh hưởng đến PR';
    }
    return '';
  };

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] overflow-hidden" style={{ height: '100vh' }}>
      {/* Sidebar - Fixed */}
      <aside
        className={`bg-[#0F172A] border-r border-slate-700/50 transition-all duration-300 ease-in-out fixed left-0 top-0 ${
          sidebarCollapsed ? 'w-20' : 'w-[240px]'
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
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <li key={itemIdx}>
                      <button
                        onClick={() => navigate(item.path)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-soft transition-all duration-200 ease-in-out ${
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
                <p className="text-xs text-slate-400 truncate">{user?.role}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area - With margin for fixed sidebar */}
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'ml-20' : 'ml-[240px]'
        }`}
        style={{ height: '100vh', overflow: 'hidden' }}
      >
        {/* Sticky Header */}
        <DashboardHeader 
          title={getPageTitle()} 
          subtitle={getPageSubtitle()}
          showSearch={true}
          showNotifications={true}
          showClock={true}
          roleLabel="Requestor"
        />
        
        {/* Content - Allow scroll for non-dashboard pages */}
        <main className={`flex-1 ${location.pathname === '/dashboard/requestor' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className={location.pathname === '/dashboard/requestor' ? 'h-full overflow-y-auto' : 'p-6'}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default RequestorDashboard;

