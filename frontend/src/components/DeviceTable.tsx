import type { Host } from '../types/scan.types';

interface DeviceTableProps {
  hosts?: Host[];
}

export function DeviceTable({ hosts }: DeviceTableProps) {
  if (!hosts || !Array.isArray(hosts) || hosts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No se encontraron dispositivos</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">IP</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">MAC</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fabricante</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Hostname</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {hosts.map((host, i) => (
            <tr key={i} className="hover:bg-slate-700/30 transition-colors">
              <td className="py-3 px-4 font-mono text-sm text-blue-400">{host.ip || '—'}</td>
              <td className="py-3 px-4 font-mono text-xs text-slate-400">{host.mac || '—'}</td>
              <td className="py-3 px-4 text-slate-200 text-sm">{host.vendor || 'Desconocido'}</td>
              <td className="py-3 px-4 text-slate-400 text-sm">{host.hostname || '—'}</td>
              <td className="py-3 px-4">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${host.status === 'up'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-600/20 text-slate-400'
                  }`}>
                  {host.status === 'up' ? 'Activo' : 'Inactivo'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}