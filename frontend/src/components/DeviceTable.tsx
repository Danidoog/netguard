import type { Host } from '../types/scan.types';

interface DeviceTableProps {
  hosts?: Host[];
}

//  Detección inteligente de tipo + ícono
function getDeviceInfo(
  vendor: string | null,
  hostname: string | null,
  ip: string | null
): { icon: string; label: string } {
  const combined = `${vendor || ''} ${hostname || ''}`.toLowerCase();
/** [CALIDAD] ISO/IEC 25010 · Usabilidad: tipos e íconos de dispositivo para lectura rápida */
  // Router / Gateway (usualmente .1)
  if (
    combined.includes('router') ||
    combined.includes('gateway') ||
    combined.includes('tp-link') ||
    combined.includes('netgear') ||
    combined.includes('cisco') ||
    combined.includes('maxlinear') ||
    combined.includes('arcadyan') ||
    (ip && ip.endsWith('.1'))
  ) {
    return { icon: '🌐', label: 'Router' };
  }

  // Smartphone
  if (
    combined.includes('phone') ||
    combined.includes('mobile') ||
    combined.includes('xiaomi') ||
    combined.includes('samsung') ||
    combined.includes('iphone') ||
    combined.includes('huawei') ||
    combined.includes('android')
  ) {
    return { icon: '📱', label: 'Celular' };
  }

  // Computadora / Laptop
  if (
    combined.includes('desktop') ||
    combined.includes('laptop') ||
    combined.includes('notebook') ||
    combined.includes('computer') ||
    combined.includes('pc-') ||
    combined.includes('intel') ||
    combined.includes('dell') ||
    combined.includes('hp-') ||
    combined.includes('lenovo') ||
    combined.includes('asus') ||
    combined.includes('acer')
  ) {
    return { icon: '💻', label: 'Computadora' };
  }

  // Tablet
  if (combined.includes('tablet') || combined.includes('ipad')) {
    return { icon: '📱', label: 'Tablet' };
  }

  // Impresora
  if (
    combined.includes('printer') ||
    combined.includes('canon') ||
    combined.includes('epson') ||
    combined.includes('brother')
  ) {
    return { icon: '🖨️', label: 'Impresora' };
  }

  // Smart TV
  if (
    combined.includes('tv') ||
    combined.includes('smart-tv') ||
    combined.includes('sony') ||
    combined.includes('philips') ||
    combined.includes('lg-')
  ) {
    return { icon: '📺', label: 'Smart TV' };
  }

  // MAC privada/aleatoria
  if (combined.includes('privada') || combined.includes('aleatoria')) {
    return { icon: '❓', label: 'Desconocido' };
  }

  // Por defecto
  return { icon: '📟', label: 'Dispositivo' };
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
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Dispositivo</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">IP</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">MAC</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Fabricante</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Hostname</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {hosts.map((host, i) => {
            const info = getDeviceInfo(host.vendor, host.hostname, host.ip);
            return (
              <tr key={i} className="hover:bg-slate-700/30 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{info.icon}</span>
                    <span className="text-xs text-slate-400 font-medium">{info.label}</span>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono text-sm text-blue-400">{host.ip || '—'}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-400">{host.mac || '—'}</td>
                <td className="py-3 px-4 text-slate-200 text-sm">{host.vendor || 'Desconocido'}</td>
                <td className="py-3 px-4 text-slate-400 text-sm">
                  {host.hostname || <span className="text-slate-600 italic">No disponible</span>}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    host.status === 'up'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-600/20 text-slate-400'
                  }`}>
                    {host.status === 'up' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}