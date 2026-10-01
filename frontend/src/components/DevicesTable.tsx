import { useState } from 'react';
import type { Device, DeviceUpdate } from '../types/device.types';
import { getDeviceIcon } from '../utils/deviceIcon';

interface DevicesTableProps {
  devices: Device[];
  onUpdate: (mac: string, data: DeviceUpdate) => Promise<void>;
  onRowClick?: (device: Device) => void;
  emptyMessage?: string;
}

// ✅ Badges de estado mejorados con indicadores visuales
function getStatusBadge(device: Device) {
  // Nuevo
  if (device.is_new) {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        Nuevo
      </span>
    );
  }

  // Ausente
  if (!device.is_present) {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-600/20 text-slate-400 border border-slate-600/30 inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        Ausente
      </span>
    );
  }

  // Confiable
  if (device.trusted) {
    return (
      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Confiable
      </span>
    );
  }

  // Presente pero no confiable
  return (
    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      No confiable
    </span>
  );
}

// ✅ Formatear tiempo "hace X"
function formatRelativeTime(dateString: string): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHour < 24) return `Hace ${diffHour}h`;
  if (diffDay < 7) return `Hace ${diffDay}d`;
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

export function DevicesTable({
  devices,
  onUpdate,
  onRowClick,
  emptyMessage,
}: DevicesTableProps) {
  const [editingMac, setEditingMac] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [updatingMac, setUpdatingMac] = useState<string | null>(null);
  const [copiedMac, setCopiedMac] = useState<string | null>(null);

  if (!devices || devices.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-slate-700 rounded-full mx-auto mb-4 flex items-center justify-center">
          <span className="text-2xl">📟</span>
        </div>
        <p className="text-slate-400 font-medium">
          {emptyMessage || 'No hay dispositivos'}
        </p>
        <p className="text-sm text-slate-500 mt-1">
          {emptyMessage
            ? 'Prueba otro filtro o limpia la búsqueda'
            : 'Los dispositivos aparecerán cuando hagas un escaneo'}
        </p>
      </div>
    );
  }

  const startEdit = (device: Device) => {
    setEditingMac(device.mac);
    setEditValue(device.alias || '');
  };

  const cancelEdit = () => {
    setEditingMac(null);
    setEditValue('');
  };

  const saveAlias = async (mac: string) => {
    setUpdatingMac(mac);
    try {
      await onUpdate(mac, { alias: editValue });
      setEditingMac(null);
      setEditValue('');
    } finally {
      setUpdatingMac(null);
    }
  };

  const toggleTrusted = async (device: Device) => {
    setUpdatingMac(device.mac);
    try {
      await onUpdate(device.mac, { trusted: !device.trusted });
    } finally {
      setUpdatingMac(null);
    }
  };

  const copyMac = async (mac: string) => {
    try {
      await navigator.clipboard.writeText(mac);
      setCopiedMac(mac);
      setTimeout(() => setCopiedMac(null), 2000);
    } catch (err) {
      console.error('Error copiando MAC:', err);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Dispositivo</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Alias</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">IP</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Fabricante</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Estado</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Última vez</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Confiable</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {devices.map((device) => (
            <tr
              key={device.mac}
              className={`hover:bg-slate-700/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={() => {
                if (editingMac === device.mac) return;
                onRowClick?.(device);
              }}
            >
              {/* Tipo con ícono + MAC */}
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl" title={device.device_type || 'Dispositivo'}>
                    {getDeviceIcon(device.device_type, device.vendor)}
                  </span>
                  <div className="flex flex-col">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyMac(device.mac);
                      }}
                      className="font-mono text-xs text-slate-400 hover:text-blue-400 transition-colors text-left"
                      title="Copiar MAC"
                    >
                      {copiedMac === device.mac ? '✓ Copiado' : device.mac}
                    </button>
                    <span className="text-xs text-slate-600">
                      {device.device_type || 'Tipo desconocido'}
                    </span>
                  </div>
                </div>
              </td>

              {/* Alias editable */}
              <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                {editingMac === device.mac ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="Alias..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveAlias(device.mac);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                ) : (
                  <span className="text-slate-200">
                    {device.alias || <span className="text-slate-500 italic">Sin alias</span>}
                  </span>
                )}
              </td>

              {/* IP */}
              <td className="py-3 px-4 font-mono text-xs text-blue-400">
                {device.last_ip || '—'}
              </td>

              {/* Fabricante */}
              <td className="py-3 px-4 text-slate-300 text-sm">
                {device.vendor || 'Desconocido'}
              </td>

              {/* Estado */}
              <td className="py-3 px-4">{getStatusBadge(device)}</td>

              {/* Última vez visto */}
              <td className="py-3 px-4 text-xs text-slate-400">
                {formatRelativeTime(device.last_seen)}
              </td>

              {/* Confiable toggle */}
              <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleTrusted(device)}
                  disabled={updatingMac === device.mac}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
                    device.trusted
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-slate-700/30 text-slate-400 border-slate-600/30 hover:border-emerald-500/30 hover:text-emerald-400'
                  } ${updatingMac === device.mac ? 'opacity-50 cursor-wait' : ''}`}
                >
                  {device.trusted ? '✓ Confiable' : 'Marcar confiable'}
                </button>
              </td>

              {/* Acciones */}
              <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                {editingMac === device.mac ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveAlias(device.mac)}
                      disabled={updatingMac === device.mac}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-xs text-slate-500 hover:text-slate-400 font-medium"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(device)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                  >
                    Editar alias
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}