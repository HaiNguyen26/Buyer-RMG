/**
 * Sidebar styling utilities
 * Shared styles for all dashboard sidebars
 */

export const sidebarClasses = {
  container: 'sidebar-gradient border-r border-slate-700/30 transition-all duration-300 ease-in-out fixed left-0 top-0 flex flex-col h-screen overflow-hidden z-50',
  header: 'sticky top-0 z-10 sidebar-gradient border-b border-slate-700/30 p-4',
  logo: 'h-12 w-auto logo-neon',
  title: 'text-white font-black text-lg tracking-tight',
  nav: 'flex-1 overflow-y-auto py-4 px-3 scrollbar-hide',
  groupTitle: 'px-3 text-xs font-black text-slate-400 uppercase tracking-tight mb-3',
  navItem: 'nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-soft',
  navItemActive: 'active bg-[#3B82F6]/20 text-white',
  navItemInactive: 'text-slate-300 hover:bg-white/5 hover:text-white',
  navIcon: 'nav-icon w-5 h-5 flex-shrink-0',
  navLabel: 'text-sm font-medium flex-1 text-left tracking-tight',
  footer: 'border-t border-slate-700/30 p-4 sidebar-gradient',
  profileCard: 'profile-card-glass rounded-soft p-3 mb-3',
  profileAvatar: 'w-10 h-10 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2563EB] flex items-center justify-center text-white text-sm font-black shadow-lg',
  profileName: 'text-sm font-black text-white truncate tracking-tight',
  profileEmail: 'text-xs text-slate-400 truncate tracking-tight',
};
