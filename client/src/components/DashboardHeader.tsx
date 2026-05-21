import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../hooks/useAuth';
import { Search, ChevronDown, User, LogOut, Command, Sparkles, Building2, Menu } from 'lucide-react';
import RealTimeClock from './RealTimeClock';
import NotificationBell from './NotificationBell';

interface DashboardHeaderProps {
  /** Tiêu đề khu vực (trang con); bỏ trống thì chỉ hiện lời chào + workspace */
  title?: string;
  subtitle?: string;
  showSearch?: boolean;
  showNotifications?: boolean;
  showClock?: boolean;
  roleLabel?: string; // Label cho role (ví dụ: "Trưởng phòng Mua hàng")
  scrollContainerRef?: React.RefObject<HTMLElement>; // Ref của scroll container (main element)
  /** &lt; md: mở drawer sidebar (dashboard truyền toggle) */
  onMobileNavToggle?: () => void;
}

const DashboardHeader = ({
  title = '',
  subtitle,
  showSearch = true,
  showNotifications = true,
  showClock = true,
  roleLabel,
  scrollContainerRef,
  onMobileNavToggle,
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

  const displayTitle = title.trim() || null;
  const contextLine =
    subtitle || roleLabel || (!displayTitle ? 'Nền tảng mua hàng & quản trị RMG' : '');

  return (
    <header
      className={`sticky top-0 z-50 flex-shrink-0 border-b border-slate-600/50 bg-slate-800 transition-shadow duration-300 ${
        isScrolled
          ? 'shadow-[0_10px_28px_-10px_rgba(15,23,42,0.35),0_4px_12px_-4px_rgba(15,23,42,0.2)]'
          : 'shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]'
      }`}
    >
      {/* Header tối vừa (slate-700/800), không đen đặc; overflow-visible cho popover */}
      <div className="relative overflow-visible bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_85%_at_50%_-35%,rgba(125,211,252,0.12),transparent_58%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 opacity-80"
          aria-hidden
        />

        <div className="relative px-3 py-2 sm:px-5 sm:py-2.5 md:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
            {/* Trái: workspace + user */}
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              {onMobileNavToggle ? (
                <button
                  type="button"
                  onClick={onMobileNavToggle}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white shadow-sm transition-colors hover:bg-white/15 md:hidden"
                  aria-label="Mở menu điều hướng"
                >
                  <Menu className="h-5 w-5" strokeWidth={2.5} />
                </button>
              ) : null}
              <div className="relative hidden h-11 w-11 shrink-0 sm:flex md:h-12 md:w-12">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 opacity-40 blur-md" />
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-gradient-to-br from-sky-500 to-indigo-700 text-white shadow-md shadow-slate-900/25 ring-2 ring-white/15">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
                  <Sparkles className="absolute right-0.5 top-0.5 h-2.5 w-2.5 text-white/70" strokeWidth={2} />
                  <span className="relative z-10 text-base font-black tracking-tight md:text-lg">
                    {isLoading ? '…' : (user?.username?.charAt(0) || 'U').toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-100">
                    <Building2 className="h-2.5 w-2.5 text-sky-300" strokeWidth={2.5} />
                    RMG
                  </span>
                  <span className="hidden h-1 w-1 rounded-full bg-slate-500 sm:inline" aria-hidden />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                    {getGreeting()}
                  </span>
                </div>
                <h1 className="truncate text-base font-black tracking-tight text-white sm:text-lg md:text-xl">
                  {isLoading ? '…' : user?.fullName?.trim() || user?.username || 'User'}
                </h1>
                {displayTitle ? (
                  <div className="mt-0.5 min-w-0 space-y-0.5">
                    <p className="truncate text-xs font-semibold text-slate-100">{displayTitle}</p>
                    {subtitle ? (
                      <p className="truncate text-[11px] font-medium text-slate-300">{subtitle}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-300 sm:text-xs">{contextLine}</p>
                )}
              </div>
            </div>

            {/* Giữa: tìm kiếm */}
            {showSearch && (
              <div className="order-last w-full transition-all duration-300 lg:order-none lg:mx-3 lg:max-w-md lg:flex-1">
                <div className="group/search relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                    <Search
                      className="h-3.5 w-3.5 text-slate-400 transition-colors group-focus-within/search:text-sky-300"
                      strokeWidth={2.5}
                    />
                  </div>
                  <input
                    type="search"
                    placeholder="Tìm kiếm nhanh trong hệ thống…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full rounded-lg border border-slate-500/50 bg-slate-600/35 py-1.5 pl-9 pr-12 text-xs text-white outline-none transition-all placeholder:text-slate-400 hover:border-slate-400/50 hover:bg-slate-600/45 focus:border-sky-400/80 focus:bg-slate-600/50 focus:ring-2 focus:ring-sky-400/20 sm:py-2 sm:pl-10 sm:pr-14 sm:text-sm"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <kbd className="hidden items-center gap-0.5 rounded border border-slate-500/60 bg-slate-600/50 px-1.5 py-0.5 font-sans text-slate-300 shadow-inner sm:inline-flex">
                      <Command className="h-3 w-3" strokeWidth={2} />
                      <span className="text-[10px] font-semibold">K</span>
                    </kbd>
                  </div>
                </div>
              </div>
            )}

            {/* Phải: đồng hồ, chuông, menu — z-index để popover nổi trên đồng hồ (stacking) */}
            <div className="relative flex shrink-0 items-center justify-end gap-1.5 sm:gap-2.5">
              {showClock && (
                <div className="relative z-0 hidden xl:block">
                  <RealTimeClock />
                </div>
              )}

              {showNotifications && user?.role && (
                <>
                  <div className="relative z-0 hidden h-7 w-px shrink-0 bg-slate-500/50 sm:block" aria-hidden />
                  <div className="relative z-20 flex items-center rounded-lg border border-white/15 bg-white/10 px-0.5 py-0.5">
                    <NotificationBell role={user.role} toolbarOnDark />
                  </div>
                </>
              )}

              <div className="relative z-0 hidden h-7 w-px shrink-0 bg-slate-500/50 sm:block" aria-hidden />

              <div className="relative z-20" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 py-0.5 pl-0.5 pr-1.5 transition-all hover:border-white/20 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-sky-400/35 sm:gap-2 sm:py-1 sm:pl-1 sm:pr-2"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-700 text-xs font-bold text-white shadow-inner ring-2 ring-white/25 sm:h-9 sm:w-9 sm:text-sm">
                    {isLoading ? '…' : (user?.username?.charAt(0) || 'U').toUpperCase()}
                  </div>
                  <div className="hidden min-w-0 flex-col items-start md:flex">
                    <span className="max-w-[6.5rem] truncate text-xs font-bold text-slate-100">
                      {user?.username || 'User'}
                    </span>
                    {user?.role && (
                      <span className="max-w-[6.5rem] truncate text-[9px] font-medium uppercase tracking-wide text-slate-400">
                        {user.role.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-300 ${showDropdown ? '-rotate-180' : ''}`}
                    strokeWidth={3}
                  />
                </button>

                {showDropdown && (
                  <div className="popover-popup-enter absolute right-0 z-[200] mt-3 w-72 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/[0.04]">
                    <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xl font-black text-white shadow-lg ring-4 ring-blue-100/80">
                          {(user?.username?.charAt(0) || 'U').toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-black text-slate-900">{user?.username || 'User'}</p>
                          <p className="mt-0.5 truncate text-sm text-slate-500">{user?.email || ''}</p>
                          <span className="mt-2 inline-block rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                            {user?.role || ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-0.5 p-2">
                      <button
                        type="button"
                        onClick={() => {
                          const settingsPath =
                            user?.role === 'REQUESTOR'
                              ? '/dashboard/requestor/settings'
                              : '/dashboard/buyer-manage/settings';
                          navigate(settingsPath);
                          setShowDropdown(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-blue-600"
                      >
                        <User className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                        <span>Thông tin tài khoản</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setShowDropdown(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
