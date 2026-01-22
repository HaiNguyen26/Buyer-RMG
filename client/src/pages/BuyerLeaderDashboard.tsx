import { useState, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../hooks/useAuth';
import {
  Menu,
  LayoutDashboard,
  UserCheck,
  ClipboardList,
  Scale,
  CheckCircle,
  Bell,
  Search,
  X,
  User,
  AlertTriangle,
} from 'lucide-react';
import LogoRMG from '../assets/LogoRMG.png';
import DashboardHeader from '../components/DashboardHeader';

const BuyerLeaderDashboard = () => {
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
          <div className="w-12 h-12 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Redirect if user is not Buyer Leader
  if (user?.role !== 'BUYER_LEADER') {
    return <div className="min-h-screen flex items-center justify-center bg-[#F1F5F9] text-red-500">Access Denied</div>;
  }

  const menuGroups = [
    {
      title: 'Tổng quan',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard/buyer-leader' },
      ],
    },
    {
      title: 'Phân công PR',
      items: [
        { icon: ClipboardList, label: 'PR chờ phân công', path: '/dashboard/buyer-leader/pending-assignments' },
        { icon: UserCheck, label: 'Lịch sử phân công', path: '/dashboard/buyer-leader/assignments' },
      ],
    },
    {
      title: 'So sánh & Chọn NCC',
      items: [
        { icon: Scale, label: 'So sánh báo giá', path: '/dashboard/buyer-leader/compare-quotations' },
        { icon: CheckCircle, label: 'Chọn NCC', path: '/dashboard/buyer-leader/select-supplier' },
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
        { icon: Bell, label: 'Notifications', path: '/dashboard/buyer-leader/notifications' },
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
      return 'Dashboard';
    } else if (location.pathname.includes('/pending-assignments')) {
      return 'PR chờ phân công';
    } else if (location.pathname.includes('/assignments')) {
      return 'Lịch sử phân công';
    } else if (location.pathname.includes('/compare-quotations')) {
      return 'So sánh báo giá';
    } else if (location.pathname.includes('/select-supplier')) {
      return 'Chọn NCC';
    } else if (location.pathname.includes('/over-budget-prs')) {
      return 'PR Vượt ngân sách';
    } else if (location.pathname.includes('/notifications')) {
      return 'Notifications';
    }
    return 'Dashboard';
  };

  const getPageSubtitle = () => {
    if (location.pathname === '/dashboard/buyer-leader') {
      return 'Tổng quan công việc của Buyer Leader';
    } else if (location.pathname.includes('/pending-assignments')) {
      return 'Phân công PR đã được duyệt cho Buyer';
    } else if (location.pathname.includes('/assignments')) {
      return 'Xem lịch sử phân công PR';
    } else if (location.pathname.includes('/compare-quotations')) {
      return 'So sánh và đánh giá báo giá từ các NCC';
    } else if (location.pathname.includes('/select-supplier')) {
      return 'Chọn NCC cuối cùng cho PR';
    } else if (location.pathname.includes('/over-budget-prs')) {
      return 'Theo dõi PR vượt ngân sách trước khi lên GĐ CN';
    } else if (location.pathname.includes('/notifications')) {
      return 'Thông báo và cảnh báo';
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
                  const active = isActive(item.path);
                  return (
                    <li key={itemIdx}>
                      <button
                        onClick={() => item.path && navigate(item.path)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-soft transition-all duration-200 ease-in-out ${
                          active
                            ? 'bg-[#3B82F6] text-white'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white backdrop-blur-sm'
                        }`}
                        title={sidebarCollapsed ? item.label : undefined}
                      >
                        <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} strokeWidth={2} />
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

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300 ease-in-out ${
        sidebarCollapsed ? 'ml-20' : 'ml-[240px]'
      }`}>
        {/* Sticky Header */}
        <DashboardHeader 
          title={getPageTitle()} 
          subtitle={getPageSubtitle()}
          showSearch={true}
          showNotifications={true}
          showClock={true}
          roleLabel="Buyer Leader"
          scrollContainerRef={mainContentRef}
        />

        {/* Workspace - Main Content with Independent Scroll */}
        <main ref={mainContentRef} className="flex-1 overflow-hidden p-6">
          <div className="h-full max-w-full mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default BuyerLeaderDashboard;

