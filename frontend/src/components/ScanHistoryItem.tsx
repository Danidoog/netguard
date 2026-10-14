import {
  ArrowRight,
  ArrowUpRight,
  RotateCcw,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import type { ScanHistoryItem as ScanRecord } from '../types/scan.types';
import type { ScanEvents } from '../utils/scanEvents';
import { formatTime } from '../utils/format';
import { Tooltip } from './Tooltip';

export type { ScanEvents } from '../utils/scanEvents';

interface ScanHistoryItemProps {
  scan: ScanRecord;
  events: ScanEvents;
  onOpen: (scan: ScanRecord) => void;
}

function ChangeBadge({ icon: Icon, label, count, color, tooltip }: {
  icon: typeof UserPlus;
  label: string;
  count: number;
  color: 'primary' | 'muted' | 'success';
  tooltip: string;
}) {
  if (count === 0) return null;

  const colors = {
    primary: 'border-primary/20 bg-primary/10 text-primary',
    muted: 'border-surface-border bg-surface-lighter text-text-muted',
    success: 'border-success/20 bg-success/10 text-success',
  };

  return (
    <Tooltip content={tooltip}>
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${colors[color]}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {count} {label}
      </span>
    </Tooltip>
  );
}

export function ScanHistoryItem({ scan, events, onOpen }: ScanHistoryItemProps) {
  const changeCount = events.newDevices.length
    + events.returnedDevices.length
    - events.absentDevices.length;
  const hasChanges = events.newDevices.length
    + events.absentDevices.length
    + events.returnedDevices.length
    + events.changedPorts.length > 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(scan)}
      className="group flex w-full flex-col gap-3 px-4 py-4 text-left transition-colors hover:bg-surface-lighter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:flex-row sm:items-center sm:gap-5 sm:px-5"
      aria-label={`Ver detalle del escaneo de las ${formatTime(scan.scanned_at)}`}
    >
      <time dateTime={scan.scanned_at} className="w-16 shrink-0 font-mono text-sm font-semibold text-text">
        {formatTime(scan.scanned_at)}
      </time>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-text">
            {scan.total_hosts} {scan.total_hosts === 1 ? 'dispositivo' : 'dispositivos'}
          </span>
          {changeCount !== 0 && (
            <span className={`text-xs font-semibold ${changeCount > 0 ? 'text-success' : 'text-text-muted'}`}>
              ({changeCount > 0 ? '+' : ''}{changeCount})
            </span>
          )}
          <span className="text-xs text-text-muted">{scan.target}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ChangeBadge
            icon={UserPlus}
            label={events.newDevices.length === 1 ? 'nuevo' : 'nuevos'}
            count={events.newDevices.length}
            color="primary"
            tooltip="Dispositivos detectados por primera vez"
          />
          <ChangeBadge
            icon={UserMinus}
            label={events.absentDevices.length === 1 ? 'ausente' : 'ausentes'}
            count={events.absentDevices.length}
            color="muted"
            tooltip="Dispositivos que no aparecieron en este escaneo"
          />
          <ChangeBadge
            icon={RotateCcw}
            label={events.returnedDevices.length === 1 ? 'volvió' : 'volvieron'}
            count={events.returnedDevices.length}
            color="success"
            tooltip="Dispositivos que volvieron a aparecer"
          />
          {events.changedPorts.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-surface-border bg-surface-lighter px-2.5 py-1 text-xs font-medium text-text-muted">
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              {events.changedPorts.length} {events.changedPorts.length === 1 ? 'cambio de puertos' : 'cambios de puertos'}
            </span>
          )}
          {!hasChanges && (
            <span className="text-xs text-text-muted">Sin cambios</span>
          )}
        </div>
      </div>

      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors group-hover:text-primary-dark">
        Ver detalle
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">del escaneo</span>
      </span>
      <span className="shrink-0 text-xs text-text-muted">{scan.duration_seconds.toFixed(1)} s</span>
    </button>
  );
}
