import { useEffect, type ReactNode } from 'react';
import type { Device } from '../types/device.types';
import { getDeviceIcon } from '../utils/deviceIcon';

interface DeviceDetailModalProps {
  device: Device;
  onClose: () => void;
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6 py-3 border-b border-slate-700/60 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 shrink-0">{label}</span>
      <span className="text-sm text-slate-200 text-left sm:text-right break-all">{value}</span>
    </div>
  );
}

export function DeviceDetailModal({ device, onClose }: DeviceDetailModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-700 rounded-xl max-w-lg w-full max-h-[85vh] overflow-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="device-detail-title"
      >
        <div className="p-6 border-b border-slate-700 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getDeviceIcon(device.device_type, device.vendor)}</span>
            <div>
              <h2 id="device-detail-title" className="text-xl font-semibold text-white">
                {device.alias || device.last_hostname || device.last_ip || 'Dispositivo'}
              </h2>
              <p className="text-sm text-slate-400 mt-0.5 font-mono">{device.mac}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-2">
          <Row label="MAC" value={<span className="font-mono text-blue-400">{device.mac}</span>} />
          <Row label="IP" value={<span className="font-mono">{device.last_ip || '—'}</span>} />
          <Row label="Hostname" value={device.last_hostname || '—'} />
          <Row label="Fabricante" value={device.vendor || 'Desconocido'} />
          <Row label="Tipo" value={device.device_type || 'Desconocido'} />
          <Row label="Alias" value={device.alias || 'Sin alias'} />
          <Row
            label="Confiable"
            value={
              <span className={device.trusted ? 'text-emerald-400' : 'text-amber-400'}>
                {device.trusted ? 'Sí' : 'No'}
              </span>
            }
          />
          <Row label="Primera vez visto" value={formatDateTime(device.first_seen)} />
          <Row label="Última vez visto" value={formatDateTime(device.last_seen)} />
        </div>
      </div>
    </div>
  );
}
