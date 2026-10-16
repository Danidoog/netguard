import { lazy, Suspense, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ThemeToggle } from './components/ThemeToggle';
import type { ResolvedTheme, ThemePreference } from './components/ThemeToggle';
import { Dashboard } from './pages/Dashboard';
import { Devices } from './pages/Devices';
import { History } from './pages/History';
import { Help } from './pages/Help';
import { Settings } from './pages/Settings';
import { ErrorBoundary } from './errors/ErrorBoundary';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useBackendStatus } from './hooks/useBackendStatus';
import { StatusBanner } from './components/StatusBanner';

const Analytics = lazy(() => import('./pages/Analytics').then((module) => ({ default: module.Analytics })));

function getViewFromPath(pathname: string): string {
  if (pathname === '/ayuda') return 'help';
  if (pathname === '/configuracion' || pathname === '/settings') return 'settings';
  return 'dashboard';
}

function getPathFromView(view: string): string {
  if (view === 'help') return '/ayuda';
  if (view === 'settings') return '/configuracion';
  return '/';
}

function App() {
  const [activeView, setActiveView] = useState(() => (
    getViewFromPath(window.location.pathname)
  ));
  const { isOnline } = useNetworkStatus();
  const { status: backendStatus, recheck: recheckBackend } = useBackendStatus();
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem('netguard-theme');
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  });
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => (
    themePreference === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : themePreference
  ));

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const theme = themePreference === 'system'
        ? (mediaQuery.matches ? 'dark' : 'light')
        : themePreference;
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
      setResolvedTheme(theme);
    };

    applyTheme();
    localStorage.setItem('netguard-theme', themePreference);
    if (themePreference === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [themePreference]);

  useEffect(() => {
    const navigate = (view: string) => {
      setActiveView(view);
      window.history.pushState({ view }, '', getPathFromView(view));
    };
    const onViewNavigation = (event: Event) => {
      const { view } = (event as CustomEvent<{ view: string }>).detail;
      navigate(view);
    };
    const onPopState = (event: PopStateEvent) => {
      setActiveView(event.state?.view || getViewFromPath(window.location.pathname));
    };

    window.addEventListener('netguard:navigate-view', onViewNavigation);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('netguard:navigate-view', onViewNavigation);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-surface text-text">
        <Sidebar activeView={activeView} onViewChange={(view) => {
          setActiveView(view);
          window.history.pushState({ view }, '', getPathFromView(view));
        }} />
        <main className="relative flex-1 overflow-auto pb-20">
          <div className="px-8 pt-8">
            <StatusBanner isOnline={isOnline} backendStatus={backendStatus} />
          </div>
          <ThemeToggle
            preference={themePreference}
            resolvedTheme={resolvedTheme}
            onChange={setThemePreference}
          />
          {activeView === 'dashboard' && (
            <Dashboard
              onNavigate={setActiveView}
              isOnline={isOnline}
              backendStatus={backendStatus}
              onRecheckBackend={recheckBackend}
            />
          )}
          {activeView === 'devices' && <Devices onNavigate={setActiveView} />}
          {activeView === 'history' && <History />}
          <Suspense fallback={<div role="status" aria-live="polite" className="p-8 text-center text-text-muted">Cargando estadísticas...</div>}>
            {activeView === 'analytics' && <Analytics />}
          </Suspense>
          {activeView === 'settings' && <Settings />}
          {activeView === 'help' && <Help />}
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;