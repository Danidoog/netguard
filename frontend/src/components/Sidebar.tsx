import { useEffect, useState } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  History,
  LayoutDashboard,
  Router,
  ShieldCheck,
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'devices', label: 'Dispositivos', Icon: Router },
  { id: 'history', label: 'Historial', Icon: History },
  { id: 'analytics', label: 'Estadísticas', Icon: BarChart3 },
  { id: 'help', label: 'Ayuda', Icon: HelpCircle },
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem('sidebarCollapsed') === 'true',
  );

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isCollapsed));
  }, [isCollapsed]);

  return (
    <aside className={`sidebar-transition flex min-h-screen shrink-0 flex-col border-r border-surface-border bg-surface-light ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      <div className={`flex min-h-[88px] items-center border-b border-surface-border p-4 ${
        isCollapsed ? 'flex-col justify-center gap-2' : 'justify-between'
      }`}>
        <div className={`flex min-w-0 items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-lighter text-primary-light">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-text">NetGuard</h1>
              <p className="text-xs text-text-muted">Network Scanner</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-lighter hover:text-text"
        >
          {isCollapsed
            ? <ChevronRight className="h-5 w-5" aria-hidden="true" />
            : <ChevronLeft className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      <nav className={`flex-1 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {!isCollapsed && (
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Principal
          </p>
        )}
        <ul className="space-y-1">
          {menuItems.map(({ id, label, Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onViewChange(id)}
                aria-current={activeView === id ? 'page' : undefined}
                aria-label={label}
                title={isCollapsed ? label : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeView === id
                    ? 'bg-primary/10 text-primary-text'
                    : 'text-text-muted hover:bg-surface-lighter hover:text-text'
                } ${isCollapsed ? 'justify-center' : ''}`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!isCollapsed && <span>{label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
