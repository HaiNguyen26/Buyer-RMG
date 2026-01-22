import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../hooks/useAuth';
import { Plus, Search, Bell, ChevronDown, LogOut, User } from 'lucide-react';
import RealTimeClock from './RealTimeClock';

interface RequestorHeaderProps {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaPath?: string;
  ctaIcon?: React.ReactNode;
  showCTA?: boolean;
  showSearch?: boolean;
  showNotifications?: boolean;
}

const RequestorHeader = ({
  title,
  subtitle,
  ctaLabel = 'Tạo yêu cầu mới',
  ctaPath = '/dashboard/requestor/pr/create',
  ctaIcon,
  showCTA = true,
  showSearch = true,
  showNotifications = true,
}: RequestorHeaderProps) => {
  const navigate = useNavigate();
  const { data: user, isLoading } = useCurrentUser();
  const logout = useLogout();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      setIsScrolled(scrollTop > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotificationsDropdown(false);
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

  // Mock notification count - sẽ được thay thế bằng data thực tế
  const notificationCount = 3;

  return (
    <header 
      className={`sticky top-0 z-40 flex-shrink-0 border-b transition-all duration-300 ${
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
            <p className="text-sm text-slate-500 mt-0.5 font-normal">{subtitle || title}</p>
          </div>

          {/* Center: Global Search */}
          {showSearch && (
            <div className="flex-1 max-w-xl mx-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" strokeWidth={2} />
                <input
                  type="text"
                  placeholder="Tìm kiếm PR, Sales PO, dự án..."
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
            <RealTimeClock />

            {/* Notification Bell */}
            {showNotifications && (
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                  className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-soft-lg transition-colors"
                >
                  <Bell className="w-6 h-6" strokeWidth={2} />
                  {notificationCount > 0 && (
                    <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotificationsDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-soft-lg shadow-soft-lg border border-slate-200 overflow-hidden z-50">
                    <div className="p-4 border-b border-slate-200">
                      <h3 className="font-semibold text-slate-900">Thông báo</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {/* Notification items sẽ được thêm sau */}
                      <div className="p-4 text-center text-slate-500 text-sm">
                        Không có thông báo mới
                      </div>
                    </div>
                    <div className="p-3 border-t border-slate-200 bg-slate-50">
                      <button
                        onClick={() => {
                          navigate('/dashboard/requestor/notifications');
                          setShowNotificationsDropdown(false);
                        }}
                        className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Xem tất cả thông báo
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                        navigate('/dashboard/requestor/settings');
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

export default RequestorHeader;
