import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { History } from './pages/History';

function App() {
  const [activeView, setActiveView] = useState('dashboard');

  return (
    <div className="flex min-h-screen bg-slate-900">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 overflow-auto">
        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'history' && <History />}
        {activeView === 'analytics' && (
          <div className="p-8">
            <h1 className="text-3xl font-bold text-white mb-2">Estadísticas</h1>
            <p className="text-slate-400">Próximamente...</p>
          </div>
        )}
        {activeView === 'settings' && (
          <div className="p-8">
            <h1 className="text-3xl font-bold text-white mb-2">Configuración</h1>
            <p className="text-slate-400">Próximamente...</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;