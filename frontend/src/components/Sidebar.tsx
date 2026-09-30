// frontend/src/components/Sidebar.tsx
interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'devices', label: 'Dispositivos', icon: '📡' },
  { id: 'history', label: 'Historial', icon: '📜' },
  { id: 'analytics', label: 'Estadísticas', icon: '📈' },
  { id: 'settings', label: 'Configuración', icon: '⚙️' },
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">NetGuard</h1>
            <p className="text-xs text-slate-400">Network Scanner</p>
          </div>
        </div>
      </div>

      {/* Menú */}
      <nav className="flex-1 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">
          Principal
        </p>
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeView === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}