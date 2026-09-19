import React from 'react';
import {
  MessageSquare,
  Users,
  UserCheck,
  Sparkles,
  Phone,
  Search,
  Settings,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { User, TabType } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

interface NavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  currentUser: User;
  unreadChatsCount: number;
  pendingRequestsCount: number;
  missedCallsCount?: number;
  hasUnviewedStories: boolean;
  onOpenSearchModal: () => void;
  onOpenProfileModal: () => void;
  onOpenSettingsModal: () => void;
  isChatActiveOnMobile?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  unreadChatsCount,
  pendingRequestsCount,
  missedCallsCount,
  hasUnviewedStories,
  onOpenSearchModal,
  onOpenProfileModal,
  onOpenSettingsModal,
  isChatActiveOnMobile,
}) => {
  const { logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();

  const navItems: { id: TabType; label: string; icon: any; badge?: number; dot?: boolean }[] = [
    {
      id: 'chats',
      label: 'Chats',
      icon: MessageSquare,
      badge: unreadChatsCount,
    },
    {
      id: 'requests',
      label: 'Requests',
      icon: UserCheck,
      badge: pendingRequestsCount,
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: Users,
    },
    {
      id: 'stories',
      label: 'Status',
      icon: Sparkles,
      dot: hasUnviewedStories,
    },
    {
      id: 'calls',
      label: 'Calls',
      icon: Phone,
      badge: missedCallsCount,
    },
  ];

  return (
    <>
      {/* 1. Desktop & Tablet Vertical Sidebar (>= 768px) */}
      <aside className="hidden md:flex md:w-16 lg:w-20 bg-neutral-900 border-r border-neutral-800 flex-col items-center justify-between py-4 select-none shrink-0 z-30">
        {/* Top: Current User Profile Avatar & Search */}
        <div className="flex flex-col items-center gap-5">
          <button
            onClick={onOpenProfileModal}
            className="relative group p-1 rounded-2xl hover:bg-neutral-800 transition"
            title={`Profile: ${currentUser.displayName} (@${currentUser.username})`}
          >
            <img
              src={currentUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.username}`}
              alt={currentUser.displayName}
              className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-500/40 group-hover:ring-indigo-400 transition"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-neutral-900 rounded-full" />
          </button>

          {/* Search People Action */}
          <button
            onClick={onOpenSearchModal}
            className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition shadow-sm"
            title="Find Users & Send Contact Request"
          >
            <Search className="w-5 h-5 text-indigo-400" />
          </button>

          {/* Tab Icons */}
          <nav className="flex flex-col items-center gap-2">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative p-3 rounded-2xl transition flex flex-col items-center gap-1 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[9px] font-medium leading-none hidden lg:block">
                    {item.label}
                  </span>

                  {/* Badge counter */}
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-bold ring-2 ring-neutral-900 animate-pulse">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}

                  {/* Status unviewed story dot */}
                  {item.dot && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-400 rounded-full ring-2 ring-neutral-900" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions: Theme, Settings & Logout */}
        <div className="flex flex-col items-center gap-3">
          {/* Quick Dark/Light Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition cursor-pointer"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Settings / Themes Modal Opener */}
          <button
            onClick={onOpenSettingsModal}
            className="p-2.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className="p-2.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-xl transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* 2. Mobile Bottom Navigation Bar (< 768px) */}
      {!isChatActiveOnMobile && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-t border-neutral-200/80 dark:border-neutral-800 px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0.5rem))] flex items-center justify-around shadow-xl"
        >
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex-1 py-1 px-1 flex flex-col items-center justify-center min-h-[48px] rounded-xl transition active:scale-95 ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                }`}
              >
                <div
                  className={`relative p-1 px-2.5 rounded-full transition ${
                    isActive ? 'bg-indigo-50 dark:bg-indigo-950/80' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />

                  {/* Badge counter */}
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] text-center bg-rose-500 text-white rounded-full text-[10px] font-bold ring-2 ring-white dark:ring-neutral-900 animate-pulse">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}

                  {/* Status unviewed story dot */}
                  {item.dot && (
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-indigo-500 rounded-full ring-2 ring-white dark:ring-neutral-900" />
                  )}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 font-medium">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
};
