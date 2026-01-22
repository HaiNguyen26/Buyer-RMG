import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../hooks/useAuth';
import { Search, Bell, ChevronDown, LogOut, User } from 'lucide-react';
import RealTimeClock from './RealTimeClock';
import NotificationBell from './NotificationBell';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  showSearch?: boolean;
  showNotifications?: boolean;
  showClock?: boolean;
  roleLabel?: string; // Label cho role (ví dụ: "Trưởng phòng Mua hàng", "Sales Manager")
  scrollContainerRef?: React.RefObject<HTMLElement>; // Ref của scroll container (main element)
}

const DashboardHeader = ({
  title,
  subtitle,
  showSearch = true,
  showNotifications = true,
  showClock = true,
  roleLabel,
  scrollContainerRef,
}: DashboardHeaderProps) => {
  const navigate = useNavigate();
  const { data: user, isLoading } = useCurrentUser();
  const logout = useLogout();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle scroll effect - listen to both window scroll and main content scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setIsScrolled(scrollTop > 10);
    };

    // Handle main content scroll if ref is provided
    const handleMainScroll = () => {
      if (scrollContainerRef?.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        setIsScrolled(scrollTop > 10);
      }
    };

    // If scrollContainerRef is provided, listen to that element's scroll
    if (scrollContainerRef?.current) {
      scrollContainerRef.current.addEventListener('scroll', handleMainScroll);
      // Also check initial scroll position
      handleMainScroll();
    } else {
      // Otherwise, listen to window scroll
      window.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      if (scrollContainerRef?.current) {
        scrollContainerRef.current.removeEventListener('scroll', handleMainScroll);
      } else {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, [scrollContainerRef]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };


  return (
    <header 
      className={`sticky top-0 z-50 flex-shrink-0 border-b transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-lg border-slate-200/80 shadow-soft-md' 
          : 'bg-white/80 backdrop-blur-md border-slate-200/50 shadow-soft'
      }`}
    >
      <div className="px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Title */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">
              {getGreeting()}, {isLoading ? '...' : user?.username || 'User'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5 font-normal">
              {subtitle || roleLabel || title}
            </p>
          </div>

          {/* Center: Global Search */}
          {showSearch && (
            <div className="flex-1 max-w-xl mx-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" strokeWidth={2} />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-soft-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 text-slate-900 placeholder-slate-400 transition-all"
                />
              </div>
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Real-Time Clock */}
            {showClock && <RealTimeClock />}

            {/* Notification Bell */}
            {showNotifications && user?.role && (
              <NotificationBell role={user.role} />
            )}

            {/* Avatar & Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-3 px-3 py-2 hover:bg-slate-100 rounded-soft-lg transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white font-semibold">
                  {isLoading ? '...' : user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-slate-900">{user?.username || 'User'}</p>
                  <p className="text-xs text-slate-500">{user?.email || ''}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} strokeWidth={2} />
              </button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-soft-lg shadow-soft-lg border border-slate-200 overflow-hidden z-50">
                  <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center text-white font-semibold">
                        {user?.username?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{user?.username || 'User'}</p>
                        <p className="text-xs text-slate-500">{user?.email || ''}</p>
                        <p className="text-xs text-slate-400 mt-1">{user?.role || ''}</p>
                      </div>
                    </div>
                  </div>
                  <div className="py-2">
                    <button
                      onClick={() => {
                        // Navigate to settings based on role
                        const settingsPath = user?.role === 'SALES' 
                          ? '/dashboard/sales/settings'
                          : user?.role === 'REQUESTOR'
                          ? '/dashboard/requestor/settings'
                          : '/dashboard/buyer-manage/settings';
                        navigate(settingsPath);
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <User className="w-4 h-4" strokeWidth={2} />
                      <span>Thông tin tài khoản</span>
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" strokeWidth={2} />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;



