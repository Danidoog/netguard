import { createElement, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  CircleHelp,
  Edit,
  Shield,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Device, DeviceUpdate } from '../types/device.types';
import {
  cleanHostname,
  formatRelativeTime,
  getDeviceIcon,
  getDeviceTypeLabel,
  isReallyNew,
  normalizeMac,
} from '../utils/deviceHelpers';
import { ConfirmDialog } from './ConfirmDialog';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { Toast } from './Toast';

interface DevicesTableProps {
  devices: Device[];
  onUpdate: (mac: string, data: DeviceUpdate) => Promise<void>;
  onSelectDevice: (device: Device) => void;
}

type SortColumn = 'device' | 'hostname' | 'ip' | 'status' | 'trusted';

export function DevicesTable({ devices, onUpdate, onSelectDevice }: DevicesTableProps) {
  const [editingMac, setEditingMac] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [updatingMac, setUpdatingMac] = useState<string | null>(null);
  const [optimisticTrusted, setOptimisticTrusted] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; mac: string } | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('device');
  const [sortAscending, setSortAscending] = useState(true);
  const { copiedValue, copy } = useCopyToClipboard();

  const copyValue = (value: string) => {
    void copy(value).catch((error: unknown) => {
      console.error('No se pudo copiar al portapapeles:', error);
    });
  };

  const startEdit = (device: Device) => {
    setEditingMac(device.mac);
    setEditValue(device.alias || '');
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingMac(null);
    setEditValue('');
    setSaveError(null);
  };

  const saveAlias = async (device: Device) => {
    setUpdatingMac(device.mac);
    setSaveError(null);
    try {
      await onUpdate(device.mac, { alias: editValue.trim() });
      cancelEdit();
    } catch (error) {
      console.error('Error guardando alias:', error);
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el alias');
    } finally {
      setUpdatingMac(null);
    }
  };

  const removeAlias = (mac: string) => {
    setConfirmDialog({ isOpen: true, mac });
  };

  const confirmRemoveAlias = async () => {
    if (!confirmDialog) return;
    const { mac } = confirmDialog;
    setConfirmDialog(null);
    setUpdatingMac(mac);
    setSaveError(null);
    try {
      await onUpdate(mac, { alias: '' });
    } catch (error) {
      console.error('Error quitando alias:', error);
      setSaveError(error instanceof Error ? error.message : 'No se pudo quitar el alias');
    } finally {
      setUpdatingMac(null);
    }
  };

  const toggleTrusted = async (device: Device) => {
    setUpdatingMac(device.mac);
    const trusted = !device.trusted;
    setOptimisticTrusted((current) => ({ ...current, [device.mac]: trusted }));
    try {
      await onUpdate(device.mac, { trusted });
      setOptimisticTrusted((current) => {
        const next = { ...current };
        delete next[device.mac];
        return next;
      });
    } catch (error) {
      setOptimisticTrusted((current) => {
        const next = { ...current };
        delete next[device.mac];
        return next;
      });
      console.error('Error actualizando confianza del dispositivo:', error);
    } finally {
      setUpdatingMac(null);
    }
  };

  const sortedDevices = useMemo(() => [...devices].sort((left, right) => {
    const values: Record<SortColumn, [string | number, string | number]> = {
      device: [left.alias?.trim() || cleanHostname(left.last_hostname), right.alias?.trim() || cleanHostname(right.last_hostname)],
      hostname: [cleanHostname(left.last_hostname), cleanHostname(right.last_hostname)],
      ip: [left.last_ip || '', right.last_ip || ''],
      status: [Number(left.is_present), Number(right.is_present)],
      trusted: [Number(left.trusted), Number(right.trusted)],
    };
    const [leftValue, rightValue] = values[sortColumn];
    const order = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), 'es', { numeric: true });
    return sortAscending ? order : -order;
  }), [devices, sortAscending, sortColumn]);

  const sortBy = (column: SortColumn) => {
    if (sortColumn === column) setSortAscending((ascending) => !ascending);
    else {
      setSortColumn(column);
      setSortAscending(true);
    }
  };

  const sortIcon = (column: SortColumn) => {
    if (column !== sortColumn) return <ArrowUpDown className="h-4 w-4" aria-hidden="true" />;
    return sortAscending
      ? <ArrowUp className="h-4 w-4" aria-hidden="true" />
      : <ArrowDown className="h-4 w-4" aria-hidden="true" />;
  };

  const header = (label: string, column: SortColumn, className = '') => (
    <th scope="col" aria-sort={column === sortColumn ? (sortAscending ? 'ascending' : 'descending') : 'none'} className={`px-3 py-3 text-left ${className}`}>
      <button
        type="button"
        onClick={() => sortBy(column)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text"
      >
        {label}
        {sortIcon(column)}
      </button>
    </th>
  );

  if (devices.length === 0) {
    return (
      <div className="py-16 text-center">
        <CircleHelp className="mx-auto mb-4 h-10 w-10 text-text-muted" aria-hidden="true" />
        <p className="font-medium text-text-muted">No hay dispositivos que coincidan</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-y-2 text-sm">
        <thead>
          <tr className="border-b border-surface-border">
            {header('Dispositivo', 'device', 'w-[44%] sm:w-[28%]')}
            {header('Hostname', 'hostname', 'hidden w-[15%] sm:table-cell')}
            {header('IP / MAC', 'ip', 'hidden w-[19%] sm:table-cell')}
            {header('Estado', 'status', 'w-[28%] sm:w-[18%]')}
            {header('Confianza', 'trusted', 'w-[28%] sm:w-[20%]')}
          </tr>
        </thead>
        <tbody>
          {sortedDevices.map((device) => {
            const isEditing = editingMac === device.mac;
            const isUpdating = updatingMac === device.mac;
            const isTrusted = optimisticTrusted[device.mac] ?? device.trusted;
            const normalizedMac = normalizeMac(device.mac);
            const hostname = cleanHostname(device.last_hostname);
            const alias = device.alias?.trim();
            const subtitle = device.vendor
              ? `${device.vendor} · ${getDeviceTypeLabel(device.device_type)}`
              : device.device_type
                ? getDeviceTypeLabel(device.device_type)
                : 'Sin datos';

            return (
              <tr
                key={device.mac}
                tabIndex={0}
                onClick={() => !isEditing && onSelectDevice(device)}
                onKeyDown={(event) => {
                  if (event.target instanceof HTMLElement && event.target.closest('button, input')) return;
                  if (!isEditing && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onSelectDevice(device);
                  }
                }}
                className={`group h-20 cursor-pointer align-middle transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                  device.is_present ? '' : 'opacity-70'
                }`}
                aria-label={`Abrir detalles de ${alias || (hostname !== '—' ? hostname : 'dispositivo sin alias')}`}
              >
                <td className="h-20 overflow-hidden rounded-l-lg border-y border-l border-surface-border bg-surface/40 px-3 py-2 align-middle transition-colors group-hover:bg-surface-lighter">
                  {isEditing ? (
                    <div data-alias-editor onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center gap-1 rounded-lg border border-surface-border bg-surface px-2 focus-within:border-primary">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void saveAlias(device);
                            }
                            if (event.key === 'Escape') cancelEdit();
                          }}
                          disabled={isUpdating}
                          aria-label="Alias del dispositivo"
                          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text outline-none"
                          placeholder="Escribe un alias"
                        />
                        <button
                          type="button"
                          onClick={() => void saveAlias(device)}
                          disabled={isUpdating}
                          aria-label="Guardar alias"
                          className="rounded p-1.5 text-primary-text hover:bg-primary/10 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isUpdating}
                          aria-label="Cancelar edición"
                          className="rounded p-1.5 text-text-muted hover:bg-surface-lighter disabled:opacity-50"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      {saveError && <p role="alert" className="mt-1 text-xs text-danger">{saveError}</p>}
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-start gap-2.5">
                      {createElement(getDeviceIcon(device.device_type), {
                        className: 'mt-0.5 h-5 w-5 shrink-0 text-text-muted',
                        'aria-hidden': true,
                      })}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span title={alias || 'Sin alias'} className={`truncate font-medium ${alias ? 'text-text' : 'italic text-text-muted'}`}>
                            {alias || 'Sin alias'}
                          </span>
                          {isReallyNew(device) && (
                            <span
                              title="Dispositivo visto por primera vez en las últimas 24 horas"
                              className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                            >
                              Nuevo
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              startEdit(device);
                            }}
                            aria-label="Editar alias"
                            className="shrink-0 text-text-muted opacity-100 transition-opacity hover:text-primary-text sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <Edit className="h-4 w-4" aria-hidden="true" />
                          </button>
                          {alias && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeAlias(device.mac);
                              }}
                              disabled={isUpdating}
                              aria-label="Quitar alias"
                              className="shrink-0 text-text-muted opacity-100 transition-opacity hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-text-muted" title={subtitle}>{subtitle}</p>
                      </div>
                    </div>
                  )}
                </td>

                <td className="hidden h-20 overflow-hidden border-y border-surface-border bg-surface/40 px-3 py-2 align-middle font-mono text-xs text-text-muted transition-colors group-hover:bg-surface-lighter sm:table-cell">
                  <span className="block truncate" title={hostname === '—' ? undefined : hostname}>
                    {hostname}
                  </span>
                </td>

                <td className="hidden h-20 overflow-hidden border-y border-surface-border bg-surface/40 px-3 py-2 align-middle transition-colors group-hover:bg-surface-lighter sm:table-cell">
                  <div className="group/ip flex min-w-0 items-center gap-1">
                    <span className="truncate font-mono text-sm text-text" title={device.last_ip || undefined}>{device.last_ip || '—'}</span>
                    {device.last_ip && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          copyValue(device.last_ip!);
                        }}
                        aria-label="Copiar IP"
                        className={`shrink-0 text-text-muted opacity-0 transition-opacity hover:text-primary-text group-hover/ip:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 ${
                          copiedValue === device.last_ip ? 'opacity-100 text-primary-text' : ''
                        }`}
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="group/mac mt-1 flex min-w-0 items-center gap-1">
                    <span className="truncate font-mono text-xs text-text-muted">{normalizedMac}</span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        copyValue(normalizedMac);
                      }}
                      aria-label="Copiar MAC"
                      className={`shrink-0 text-text-muted opacity-0 transition-opacity hover:text-primary-text group-hover/mac:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 ${
                        copiedValue === normalizedMac ? 'opacity-100 text-primary-text' : ''
                      }`}
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </td>

                <td className="h-20 overflow-hidden border-y border-surface-border bg-surface/40 px-3 py-2 align-middle transition-colors group-hover:bg-surface-lighter">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                    device.is_present
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                      : 'border-surface-border bg-surface-lighter text-text-muted'
                  }`}>
                    {device.is_present ? 'Presente' : 'Ausente'}
                  </span>
                  <p className="mt-1 text-xs text-text-muted">{formatRelativeTime(device.last_seen).toLocaleLowerCase('es')}</p>
                </td>

                <td className="h-20 overflow-hidden rounded-r-lg border-y border-r border-surface-border bg-surface/40 px-3 py-2 align-middle transition-colors group-hover:bg-surface-lighter">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleTrusted({ ...device, trusted: isTrusted });
                    }}
                    disabled={isUpdating}
                    title={isTrusted ? 'Quitar confianza' : 'Marcar como confiable'}
                    aria-label={`${isTrusted ? 'Quitar confianza al dispositivo' : 'Marcar como confiable el dispositivo'} ${device.last_ip || normalizedMac}`}
                    className={`inline-flex w-40 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60 ${
                      isTrusted
                        ? 'border-success/30 bg-success/10 text-success hover:bg-success/20'
                        : 'border-surface-border bg-surface-lighter text-text hover:bg-surface-light'
                    }`}
                  >
                    {isTrusted
                      ? <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                      : <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    <span className="truncate">
                      {isUpdating ? 'Guardando…' : isTrusted ? 'Quitar confianza' : 'Marcar confiable'}
                    </span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title="Quitar el alias"
          message="Se mostrará el hostname original en su lugar. Puedes volver a asignar un alias cuando quieras."
          confirmText="Quitar alias"
          cancelText="Cancelar"
          variant="danger"
          onConfirm={() => void confirmRemoveAlias()}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
      {copiedValue && <Toast key={copiedValue} />}
    </div>
  );
}
