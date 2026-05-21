import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';
import { Menu, Search, X } from 'lucide-react';
import LogoRMG from '../assets/LogoRMG.png';
import { asideFixed240Motion } from '../hooks/useMobileDashboardNav';
import { CreatePRConfirmModal } from './CreatePRConfirmModal';
import { isCreatePRNavigationPath } from '../utils/createPrNavigation';

export type StandardSidebarMenuItem = {
  icon: LucideIcon;
  label: string;
  path: string;
};

export type StandardSidebarMenuGroup = {
  title: string;
  items: StandardSidebarMenuItem[];
};

type UserLite = {
  username: string;
  role?: string;
};

export type StandardDashboardSidebarProps = {
  menuGroups: StandardSidebarMenuGroup[];
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  mobileNavOpen: boolean;
  user: UserLite | null | undefined;
  isActive: (path: string) => boolean;
  navigate: NavigateFunction;
  /** Dòng phụ dưới username (mặc định: role, gạch dưới → khoảng trắng) */
  profileSecondaryText?: string;
};

/**
 * Sidebar chuẩn RMG (đồng bộ Requestor): gradient, logo, ô tìm, nhóm menu, thẻ user.
 * Phiên bản compact — chữ và padding nhỏ hơn một bậc.
 */
export function StandardDashboardSidebar({
  menuGroups,
  sidebarCollapsed,
  setSidebarCollapsed,
  searchQuery,
  setSearchQuery,
  mobileNavOpen,
  user,
  isActive,
  navigate,
  profileSecondaryText,
}: StandardDashboardSidebarProps) {
  const [createPrConfirmPath, setCreatePrConfirmPath] = useState<string | null>(null);
  const secondary =
    profileSecondaryText ??
    (user?.role ? user.role.replace(/_/g, ' ') : '');

  return (
    <aside
      className={`sidebar-gradient border-r border-slate-700/30 ${asideFixed240Motion(mobileNavOpen, sidebarCollapsed)}`}
    >
      <div className="sticky top-0 z-10 border-b border-slate-700/30 sidebar-gradient px-3 py-2.5">
        {!sidebarCollapsed && (
          <div className="space-y-2">
            <div className="mb-1 flex flex-col items-center gap-1.5">
              <img
                src={LogoRMG}
                alt="RMG Logo"
                className="h-10 w-auto object-contain logo-neon"
              />
              <h1 className="text-center text-sm font-black tracking-tight text-white">
                RMG Enterprise
              </h1>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 py-1.5 pl-9 pr-8 text-xs text-white placeholder-slate-400 backdrop-blur-sm focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label="Xóa tìm kiếm"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        )}
        {sidebarCollapsed ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
              title="Mở rộng"
            >
              <Menu className="h-5 w-5 text-white" strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 scrollbar-hide">
        {menuGroups.map((group, groupIdx) => (
          <div key={group.title + groupIdx} className={groupIdx > 0 ? 'mt-5' : ''}>
            {!sidebarCollapsed ? (
              <h3 className="mb-2 px-2 text-[10px] font-black uppercase tracking-tight text-slate-400">
                {group.title}
              </h3>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item, itemIdx) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <li key={item.path + itemIdx}>
                    <button
                      type="button"
                      onClick={() => {
                        if (isCreatePRNavigationPath(item.path)) {
                          setCreatePrConfirmPath(item.path);
                        } else {
                          navigate(item.path);
                        }
                      }}
                      className={`nav-item flex w-full items-center gap-2.5 rounded-soft px-2.5 py-2 ${
                        active
                          ? 'active bg-[#3B82F6]/20 text-white'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon
                        className={`nav-icon h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`}
                        strokeWidth={2}
                      />
                      {!sidebarCollapsed ? (
                        <span className="flex-1 text-left text-xs font-medium tracking-tight">
                          {item.label}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-700/30 p-3 sidebar-gradient">
        {!sidebarCollapsed && user ? (
          <div className="profile-card-glass rounded-soft mb-0 p-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-xs font-black text-white shadow-md">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black tracking-tight text-white">
                  {user.username}
                </p>
                {secondary ? (
                  <p className="truncate text-[10px] tracking-tight text-slate-400">{secondary}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {sidebarCollapsed && user ? (
          <div className="flex justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2563EB] text-xs font-black text-white shadow-md">
              {user.username.charAt(0).toUpperCase()}
            </div>
          </div>
        ) : null}
      </div>

      <CreatePRConfirmModal
        open={createPrConfirmPath != null}
        onClose={() => setCreatePrConfirmPath(null)}
        onConfirm={() => {
          if (createPrConfirmPath) navigate(createPrConfirmPath);
          setCreatePrConfirmPath(null);
        }}
      />
    </aside>
  );
}
