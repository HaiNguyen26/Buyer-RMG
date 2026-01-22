import { useState, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useAuth';
import {
  Menu,
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  Building2,
  Bell,
  User,
  Search,
  X,
  FilePlus,
  TrendingUp,
} from 'lucide-react';
import LogoRMG from '../assets/LogoRMG.png';
import DashboardHeader from '../components/DashboardHeader';

const DepartmentHeadDashboard = () => {
  const { data: user, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const mainContentRef = useRef<HTMLElement>(null);

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
      title: 'NHÓM A - KHI TRƯỞNG PHÒNG LÀ REQUESTOR',
      items: [
        { icon: LayoutDashboard, label: 'Dashboard cá nhân', path: '/dashboard/department-head' },
        { icon: ClipboardList, label: 'PR của tôi', path: '/dashboard/department-head/my-prs' },
        { icon: FilePlus, label: 'Tạo Phiếu yêu cầu (PR)', path: '/dashboard/department-head/my-prs/create' },
      ],
    },
    {
      title: 'NHÓM B - KHI TRƯỞNG PHÒNG LÀ NGƯỜI DUYỆT',
      items: [
        { icon: CheckSquare, label: 'Duyệt PR phòng ban', path: '/dashboard/department-head/pr-approval' },
        { icon: Building2, label: 'Tổng quan PR phòng ban', path: '/dashboard/department-head/department-overview' },
      ],
    },
    {
      title: 'NHÓM C - HỖ TRỢ',
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

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`bg-[#0F172A] border-r border-slate-700/50 transition-all duration-300 ease-in-out fixed left-0 top-0 ${
          sidebarCollapsed ? 'w-20' : 'w-[240px]'
        } flex flex-col h-screen overflow-hidden z-50`}
      >
        {/* Sidebar Header */}
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

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {menuGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="mb-6">
              {!sidebarCollapsed && (
                <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 px-2">
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
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                          active
                            ? 'bg-[#2563EB] text-white shadow-lg shadow-[#2563EB]/20'
                            : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                        } ${sidebarCollapsed ? 'justify-center' : ''}`}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
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
          {!sidebarCollapsed && user && (
            <div className="flex items-center gap-3 px-2 py-2 text-slate-300">
              <User className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.username}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
          )}
          {sidebarCollapsed && user && (
            <div className="flex justify-center">
              <User className="w-5 h-5 text-slate-300" />
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main
        ref={mainContentRef}
        className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'ml-20' : 'ml-[240px]'
        }`}
      >
        <DashboardHeader scrollContainerRef={mainContentRef} />
        <div className={`flex-1 ${location.pathname.includes('/create') || location.pathname.includes('/edit') ? 'overflow-y-auto' : 'overflow-hidden'} p-6`}>
          <div className={location.pathname.includes('/create') || location.pathname.includes('/edit') ? '' : 'h-full max-w-full mx-auto'}>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default DepartmentHeadDashboard;

