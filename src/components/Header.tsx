import React, { useEffect, useRef } from 'react';
import { KovaAvatar } from './KovaAvatar';
import { ViewMode } from '../types';
import { Bell, Sparkles, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  onOpenAddExpense: () => void;
  onToggleNotification: () => void;
  notificationActive: boolean;
  userName?: string;
  onLogout?: () => void;
}

const TABS: Array<{ view: ViewMode; label: string; icon?: boolean }> = [
  { view: 'chat', label: 'Chat' },
  { view: 'log', label: 'Log' },
  { view: 'grow', label: 'Grow', icon: true },
];

// Chat / Log / Grow switcher. On phones it gets its own full-width row with bigger tap targets
// (KOVA-083); from the "sm" breakpoint up it sits in the top bar as before.
const ViewTabs: React.FC<{ currentView: ViewMode; onSelectView: (v: ViewMode) => void; compact: boolean }> = ({
  currentView,
  onSelectView,
  compact,
}) => (
  <nav
    aria-label="Main"
    className={`flex items-center gap-1 bg-[#1A1A1C]/90 p-1 rounded-full border border-[#2C2C2E]/80 backdrop-blur-md shadow-lg ${compact ? '' : 'w-full'}`}
  >
    {TABS.map((tab) => {
      const active = currentView === tab.view;
      return (
        <button
          key={tab.view}
          type="button"
          onClick={() => onSelectView(tab.view)}
          aria-current={active ? 'page' : undefined}
          className={`rounded-full font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${
            compact ? 'px-3 py-1.5 text-xs' : 'flex-1 py-2 text-sm'
          } ${active ? 'bg-white text-black font-semibold shadow-sm' : 'text-[#8A8A8E] hover:text-white'}`}
        >
          {tab.icon && <Sparkles className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
          <span>{tab.label}</span>
        </button>
      );
    })}
  </nav>
);

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  onToggleNotification,
  notificationActive,
  userName,
}) => {
  const { userProfile } = useAuth();
  const effectiveUserName = userName !== undefined ? userName : userProfile?.firstName;
  const showTabs = currentView === 'chat' || currentView === 'log' || currentView === 'grow' || currentView === 'settings' || currentView === 'letter';

  // Screens size themselves to the space under the header (.h-app / .min-h-app in index.css).
  // The header is taller on phones (tabs get their own row), so measure it instead of assuming 60px.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--app-header-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    publish();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--app-header-h');
    };
  }, []);

  return (
    <header ref={headerRef} className="sticky top-0 z-40 w-full bg-black/85 backdrop-blur-xl border-b border-[#2C2C2E]/60 px-3 sm:px-4 pt-safe transition-all">
      <div className="flex items-center justify-between gap-2 py-2.5 sm:py-3">
        {/* Left: Kova brand */}
        <button
          type="button"
          className="flex items-center gap-2.5 sm:gap-3 min-w-0 text-left cursor-pointer group"
          onClick={() => onSelectView('chat')}
        >
          <span className="sm:hidden shrink-0">
            <KovaAvatar size="sm" isPulsing={true} />
          </span>
          <span className="hidden sm:inline-flex shrink-0">
            <KovaAvatar size="md" isPulsing={true} />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white group-hover:text-white/90 transition-colors">Kova</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] inline-block shadow-[0_0_6px_#30D158]" />
            </span>
            <span className="block text-[11px] sm:text-xs text-[#8A8A8E] font-normal tracking-tight truncate max-w-[9rem] sm:max-w-[14rem]">
              {effectiveUserName ? `companion for ${effectiveUserName}` : 'here since this morning'}
            </span>
          </span>
        </button>

        {/* Right: tabs (tablet/desktop), settings, notifications */}
        <div className="flex items-center gap-2 shrink-0">
          {showTabs && (
            <div className="hidden sm:block">
              <ViewTabs currentView={currentView} onSelectView={onSelectView} compact />
            </div>
          )}

          <button
            type="button"
            onClick={() => onSelectView('settings')}
            className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center transition-all shrink-0 ${
              currentView === 'settings'
                ? 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                : 'bg-[#1A1A1C] text-[#8A8A8E] border-[#2C2C2E] hover:text-white hover:border-white/30'
            }`}
            title="Settings & Account"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleNotification}
            className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all shrink-0 relative ${
              notificationActive
                ? 'bg-white text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.4)]'
                : 'bg-[#1A1A1C] text-[#8A8A8E] border-[#2C2C2E] hover:text-white'
            }`}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {notificationActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-black" />
            )}
          </button>
        </div>
      </div>

      {/* Phones: tabs on their own row, full width */}
      {showTabs && (
        <div className="sm:hidden pb-2.5">
          <ViewTabs currentView={currentView} onSelectView={onSelectView} compact={false} />
        </div>
      )}
    </header>
  );
};
