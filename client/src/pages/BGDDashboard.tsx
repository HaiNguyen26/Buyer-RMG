import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PieChart, 
  ShieldAlert, 
  Globe, 
  BarChart3, 
  Bell, 
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import DashboardHeader from '../components/DashboardHeader';

const BGDDashboard = () => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const menuGroups = [
    {
      title: 'Dashboard',
      items: [
        { icon: LayoutDashboard, label: 'Executive Dashboard', path: '/dashboard/bgd' },
      ],
    },
    {
      title: 'Overview & Analysis',
      items: [
        { icon: PieChart, label: 'Business Overview', path: '/dashboard/bgd/business-overview' },
        { icon: Globe, label: 'Strategic Supplier View', path: '/dashboard/bgd/strategic-suppliers' },
      ],
    },
    {
      title: 'Approval & Governance',
      items: [
        { icon: ShieldAlert, label: 'Exception Approval', path: '/dashboard/bgd/exception-approval' },
        { icon: Settings, label: 'Governance & Policy', path: '/dashboard/bgd/governance' },
      ],
    },
    {
      title: 'Reports & Alerts',
      items: [
        { icon: BarChart3, label: 'Executive Reports', path: '/dashboard/bgd/reports' },
        { icon: Bell, label: 'Critical Alerts', path: '/dashboard/bgd/alerts' },
      ],
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white transition-all duration-300 z-50 ${
          isSidebarExpanded ? 'w-[240px]' : 'w-20'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-slate-700/50 px-4">
          {isSidebarExpanded ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">BGD</span>
              </div>
              <div>
                <div className="text-sm font-semibold">Tổng Giám Đốc</div>
                <div className="text-xs text-slate-400">Executive View</div>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">BGD</span>
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className="absolute -right-3 top-20 w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center shadow-lg transition-colors z-10"
        >
          {isSidebarExpanded ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-6">
          {menuGroups.map((group, idx) => (
            <div key={idx}>
              {isSidebarExpanded && (
                <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {group.title}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                        active
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                          : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                      }`}
                      title={!isSidebarExpanded ? item.label : undefined}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 ${active ? '' : 'group-hover:scale-110 transition-transform'}`} />
                      {isSidebarExpanded && (
                        <span className="text-sm font-medium truncate">{item.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div
        className={`transition-all duration-300 ${
          isSidebarExpanded ? 'ml-[240px]' : 'ml-20'
        }`}
      >
        <DashboardHeader />
        <main className="pt-16">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default BGDDashboard;


