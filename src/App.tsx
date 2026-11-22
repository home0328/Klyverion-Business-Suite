import React, { useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackageCheck,
  Settings,
  Shield,
  Sun,
  X,
} from 'lucide-react';
import { apiRequest, setAuthToken } from './client/api';
import { AppCenterView } from './client/components/AppCenterView';
import { ArchitectureBlueprintView } from './client/components/ArchitectureBlueprintView';
import { DashboardView } from './client/components/DashboardView';
import { SettingsAuditView } from './client/components/SettingsAuditView';
import { SetupAndLogin } from './client/components/SetupAndLogin';
import { UsersRbacView } from './client/components/UsersRbacView';
import type { AuthUser, NotificationItem } from './client/types';

type ActiveTab = 'dashboard' | 'app-center' | 'rbac' | 'architecture' | 'settings';

export default function App() {
  const [bootLoading, setBootLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [companyName, setCompanyName] = useState('Klyverion Business Suite');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Notifications popover
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const checkAuthStatus = async () => {
    setBootLoading(true);
    try {
      const status = await apiRequest<{ initialized: boolean; companyName: string }>('/auth/status');
      setInitialized(status.initialized);
      setCompanyName(status.companyName);
    } finally {
      setBootLoading(false);
    }
  };

  useEffect(() => {
    void checkAuthStatus();
  }, []);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const res = await apiRequest<{ notifications: NotificationItem[] }>('/notifications');
      setNotifications(res.notifications);
    } catch {
      // Ignore transient errors on background poll
    }
  };

  useEffect(() => {
    if (user) {
      void loadNotifications();
    }
  }, [user]);

  const handleMarkAllRead = async () => {
    await apiRequest('/notifications/read', { method: 'POST', body: JSON.stringify({}) });
    await loadNotifications();
  };

  const handleSignOut = () => {
    setAuthToken(null);
    setUser(null);
    setActiveTab('dashboard');
    void checkAuthStatus();
  };

  if (bootLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-sm">
        Inicializando Klyverion Business Suite...
      </div>
    );
  }

  if (!user) {
    return (
      <SetupAndLogin
        initialized={initialized}
        companyName={companyName}
        isDark={isDark}
        onToggleTheme={() => setIsDark((v) => !v)}
        onAuthenticated={(u) => {
          setUser(u);
          setInitialized(true);
        }}
      />
    );
  }

  const unreadCount = notifications.filter((n) => n.is_read === 0).length;

  const allNavItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    allowed: boolean;
  }> = [
    {
      id: 'dashboard',
      label: 'Painel Principal',
      icon: LayoutDashboard,
      allowed: user.roleSlug === 'superadmin' || user.permissions.includes('core.dashboard.view'),
    },
    {
      id: 'app-center',
      label: 'App Center',
      icon: PackageCheck,
      allowed: user.roleSlug === 'superadmin' || user.permissions.includes('core.modules.view'),
    },
    {
      id: 'rbac',
      label: 'Usuários & RBAC',
      icon: Shield,
      allowed: user.roleSlug === 'superadmin' || user.permissions.includes('core.users.view'),
    },
    {
      id: 'architecture',
      label: 'Arquitetura & PHP',
      icon: BookOpen,
      allowed: true,
    },
    {
      id: 'settings',
      label: 'Auditoria & Core',
      icon: Settings,
      allowed: true,
    },
  ];
  const navItems = allNavItems.filter((item) => item.allowed);

  const currentNavLabel = navItems.find((n) => n.id === activeTab)?.label ?? 'Painel Principal';

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-[width] duration-150 shrink-0 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          {!sidebarCollapsed && (
            <span className="font-display text-base font-bold tracking-tight whitespace-nowrap">
              Klyverion
            </span>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label="Expandir ou recolher menu lateral"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 ml-auto"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
            {!avatarError ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{user.name}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.roleName}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-10">
            <div className="h-14 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="font-display text-base font-bold">Klyverion</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg ${
                      active ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Top Header */}
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir navegação"
              className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              <span className="hidden sm:inline">Klyverion Business Suite</span>
              <span className="hidden sm:inline mx-2">/</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{currentNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 relative">
            <button
              type="button"
              onClick={() => setShowNotifs((s) => !s)}
              aria-label="Abrir central de notificações"
              className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums">{unreadCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDark((v) => !v)}
              aria-label="Alternar tema"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>

            {/* Notifications Popover */}
            {showNotifs && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold">Notificações do Núcleo</span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleMarkAllRead()}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Marcar lidas
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500 text-center">Nenhuma notificação registrada.</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`p-3.5 text-xs ${n.is_read === 0 ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}>
                        <div className="font-medium text-slate-900 dark:text-slate-100">{n.title}</div>
                        <div className="text-slate-600 dark:text-slate-400 mt-0.5">{n.message}</div>
                        <div className="font-mono text-[11px] text-slate-400 mt-1 tabular-nums">
                          {new Date(n.created_at).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Viewport */}
        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              user={user}
              onNavigate={(t) => setActiveTab(t)}
              onModulesChanged={() => void loadNotifications()}
            />
          )}
          {activeTab === 'app-center' && (
            <AppCenterView user={user} onModulesUpdated={() => void loadNotifications()} />
          )}
          {activeTab === 'rbac' && <UsersRbacView currentUser={user} />}
          {activeTab === 'architecture' && <ArchitectureBlueprintView />}
          {activeTab === 'settings' && (
            <SettingsAuditView
              user={user}
              isDark={isDark}
              onToggleTheme={() => setIsDark((v) => !v)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
