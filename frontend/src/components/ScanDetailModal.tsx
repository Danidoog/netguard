import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Circle,
  Pencil,
  RotateCcw,
  Shield,
  ShieldCheck,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import type { Device, DeviceUpdate } from '../types/device.types';
import type { Host, ScanHistoryItem } from '../types/scan.types';
import {
  getDeviceIcon,
  getDeviceTypeLabel,
  getDisplayName,
  isReallyNew,
  normalizeMac,
} from '../utils/deviceHelpers';
import { formatDateTime, formatTime } from '../utils/format';
import { getAllScanHistory } from '../api/scans';
import type { ScanEvents } from './ScanHistoryItem';
import { DeviceDetailModal } from './DeviceDetailModal';
import { GlossaryInfo } from './GlossaryInfo';

interface ScanDetailModalProps {
  scan: ScanHistoryItem;
  hosts: Host[];
  events: ScanEvents;
  devices: Device[];
  onUpdateDevice: (mac: string, data: DeviceUpdate) => Promise<void>;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

interface ChangeLine {
  key: string;
  host: Host;
  action: string;
  kind: 'new' | 'absent' | 'returned' | 'ports' | 'ip';
  detail?: string;
}

function isUnknown(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLocaleLowerCase('es');
  return !normalized
    || ['—', 'no disponible', 'desconocido', 'tipo desconocido'].includes(normalized)
    || normalized.includes('mac privada')
    || normalized.includes('mac aleatoria');
}

function ChangeSummary({ count, label, tone }: {
  count: number;
  label: string;
  tone: 'primary' | 'muted' | 'success';
}) {
  const colors = {
    primary: 'border-primary/20 bg-primary/10 text-primary',
    muted: 'border-surface-border bg-surface-lighter text-text-muted',
    success: 'border-success/20 bg-success/10 text-success',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${count ? colors[tone] : 'border-surface-border bg-surface text-text-muted'}`}>
      <strong>{count}</strong>
      {label}
    </span>
  );
}

export function ScanDetailModal({
  scan,
  hosts,
  events,
  devices,
  onUpdateDevice,
  loading,
  error,
  onClose,
}: ScanDetailModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const initialFocusRef = useRef<HTMLElement | null>(null);
  const [detailHost, setDetailHost] = useState<Host | null>(null);
  const [editingMac, setEditingMac] = useState<string | null>(null);
  const [aliasValue, setAliasValue] = useState('');
  const [savingMac, setSavingMac] = useState<string | null>(null);
  const [trustedOverrides, setTrustedOverrides] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [allScans, setAllScans] = useState<ScanHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    initialFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();
    let cancelled = false;

    void getAllScanHistory()
      .then((scans) => {
        if (!cancelled) setAllScans(scans);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          console.error('No se pudo cargar el escaneo anterior:', cause);
          setHistoryError('No se pudo cargar la comparación con el escaneo anterior.');
        }
      });

    return () => {
      cancelled = true;
      initialFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (detailHost) setDetailHost(null);
        else onClose();
        return;
      }
      if (event.key !== 'Tab' || detailHost) return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailHost, onClose]);

  const scanContext = useMemo(() => {
    const chronological = [...allScans].sort((a, b) => (
      new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime() || a.id - b.id
    ));
    const index = chronological.findIndex((item) => item.id === scan.id);
    const previousScans = index > 0 ? chronological.slice(0, index) : [];
    const previousScan = previousScans[previousScans.length - 1];
    const previousHostsByMac = new Map<string, Host>();
    for (const priorScan of previousScans) {
      for (const host of priorScan.hosts || []) {
        previousHostsByMac.set(normalizeMac(host.mac), host);
      }
    }
    return { previousScan, previousHostsByMac };
  }, [allScans, scan.id]);

  const deviceByMac = useMemo(
    () => new Map(devices.map((device) => [normalizeMac(device.mac), device])),
    [devices],
  );
  const currentMacs = useMemo(() => new Set(hosts.map((host) => normalizeMac(host.mac))), [hosts]);
  const listedHosts = useMemo(() => {
    const combined = new Map(hosts.map((host) => [normalizeMac(host.mac), host]));
    for (const host of events.absentDevices) {
      const mac = normalizeMac(host.mac);
      if (!combined.has(mac)) combined.set(mac, host);
    }
    return [...combined.values()];
  }, [events.absentDevices, hosts]);
  const realNewDevices = useMemo(
    () => events.newDevices.filter((host) => {
      const device = deviceByMac.get(normalizeMac(host.mac));
      return device ? isReallyNew(device) : false;
    }),
    [deviceByMac, events.newDevices],
  );

  const changeLines = useMemo(() => {
    const lines: ChangeLine[] = [];
    const appendCategory = (
      categoryHosts: Host[],
      kind: ChangeLine['kind'],
      action: string,
    ) => {
      for (const host of categoryHosts) {
        const priorHost = scanContext.previousHostsByMac.get(normalizeMac(host.mac));
        const ipDetail = kind === 'absent'
          ? `Última IP: ${host.ip}`
          : priorHost
            ? priorHost.ip !== host.ip
              ? `Cambió de IP: ${priorHost.ip} → ${host.ip}`
              : 'misma IP que antes'
            : undefined;
        lines.push({
          key: `${kind}-${host.mac}`,
          host,
          action,
          kind,
          detail: ipDetail,
        });
      }
    };
    appendCategory(realNewDevices, 'new', 'nuevo');
    appendCategory(events.returnedDevices, 'returned', 'volvió');
    appendCategory(events.absentDevices, 'absent', 'ausente');
    for (const { host, previousPorts, currentPorts } of events.changedPorts) {
      lines.push({
        key: `ports-${host.mac}`,
        host,
        action: 'cambió sus puertos abiertos',
        kind: 'ports',
        detail: `${previousPorts.join(', ') || 'ninguno'} → ${currentPorts.join(', ') || 'ninguno'}`,
      });
    }
    for (const host of hosts) {
      const previousHost = scanContext.previousHostsByMac.get(normalizeMac(host.mac));
      if (!previousHost || previousHost.ip === host.ip) continue;
      const existingLine = lines.find((line) => normalizeMac(line.host.mac) === normalizeMac(host.mac));
      if (existingLine) {
        if (!existingLine.detail?.includes('Cambió de IP:')) {
          existingLine.detail = [existingLine.detail, `Cambió de IP: ${previousHost.ip} → ${host.ip}`]
            .filter(Boolean)
            .join(' · ');
        }
        continue;
      }
      lines.push({
        key: `ip-${host.mac}`,
        host,
        action: 'cambió de IP',
        kind: 'ip',
        detail: `${previousHost.ip} → ${host.ip}`,
      });
    }
    return lines;
  }, [events, hosts, realNewDevices, scanContext.previousHostsByMac]);

  const changeIcon = (kind: ChangeLine['kind']) => {
    if (kind === 'new') return <UserPlus className="h-4 w-4 text-primary" aria-hidden="true" />;
    if (kind === 'returned') return <RotateCcw className="h-4 w-4 text-success" aria-hidden="true" />;
    if (kind === 'absent') return <UserMinus className="h-4 w-4 text-text-muted" aria-hidden="true" />;
    return <Circle className="h-3 w-3 text-text-muted" aria-hidden="true" />;
  };

  const saveAlias = async (host: Host) => {
    setSavingMac(host.mac);
    setActionError(null);
    try {
      await onUpdateDevice(host.mac, { alias: aliasValue.trim() });
      setEditingMac(null);
      setAliasValue('');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'No se pudo guardar el alias.');
    } finally {
      setSavingMac(null);
    }
  };

  const toggleTrusted = async (device: Device, trusted: boolean) => {
    const mac = normalizeMac(device.mac);
    setTrustedOverrides((current) => ({ ...current, [mac]: trusted }));
    setSavingMac(device.mac);
    setActionError(null);
    try {
      await onUpdateDevice(device.mac, { trusted });
    } catch (cause) {
      setTrustedOverrides((current) => {
        const next = { ...current };
        delete next[mac];
        return next;
      });
      setActionError(cause instanceof Error ? cause.message : 'No se pudo actualizar la confianza.');
    } finally {
      setSavingMac(null);
    }
  };

  const openDevice = (host: Host) => setDetailHost(host);
  const changeCount = realNewDevices.length
    + events.returnedDevices.length
    + events.absentDevices.length
    + events.changedPorts.length
    + changeLines.filter((line) => line.kind === 'ip').length;

  const goToDevices = () => {
    document.querySelector<HTMLButtonElement>('button[aria-label="Dispositivos"]')?.click();
  };

  const typeSummary = (host: Host) => {
    const parts = [host.device_type, host.vendor]
      .filter((value) => !isUnknown(value))
      .map((value, index) => index === 0 ? getDeviceTypeLabel(value!) : value!.trim());
    return parts.join(' · ') || null;
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-5"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="scan-detail-title"
          className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-surface-border bg-surface-light shadow-2xl"
        >
          <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-surface-border bg-surface-light px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id="scan-detail-title" className="text-xl font-semibold text-text">Detalle del escaneo</h2>
              <p className="mt-1 text-sm text-text-muted">
                {formatDateTime(scan.scanned_at)} · {scan.duration_seconds.toFixed(1)} s ·{' '}
                <span className="font-mono text-text">{scan.target}</span>
              </p>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Cerrar detalle"
              className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-lighter hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className="space-y-6 p-5 sm:p-6">
            {(error || actionError || historyError) && (
              <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-danger-text">
                {actionError || error || historyError}
              </div>
            )}

            <section aria-label="Resumen del escaneo" className="flex flex-wrap items-center gap-2">
              <ChangeSummary count={hosts.length} label={hosts.length === 1 ? 'presente' : 'presentes'} tone="success" />
              <ChangeSummary count={events.returnedDevices.length} label={events.returnedDevices.length === 1 ? 'volvió' : 'volvieron'} tone="success" />
              <ChangeSummary count={realNewDevices.length} label={realNewDevices.length === 1 ? 'nuevo' : 'nuevos'} tone="primary" />
              <ChangeSummary count={events.absentDevices.length} label={events.absentDevices.length === 1 ? 'ausente' : 'ausentes'} tone="muted" />
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-text-muted">
                <GlossaryInfo termId="cambios-de-escaneo" />
                {scanContext.previousScan
                  ? `Comparado con el escaneo de las ${formatTime(scanContext.previousScan.scanned_at)}`
                  : 'Primer escaneo del historial'}
              </span>
            </section>

            {changeCount > 0 ? (
              <section aria-labelledby="scan-changes-title">
                <h3 id="scan-changes-title" className="mb-3 text-sm font-semibold text-text">Qué cambió</h3>
                <ul className="divide-y divide-surface-border rounded-xl border border-surface-border">
                  {changeLines.map((line) => {
                    const device = deviceByMac.get(normalizeMac(line.host.mac));
                    return (
                      <li key={line.key} className="flex min-w-0 items-start gap-3 px-3 py-3">
                        <span className="mt-0.5 shrink-0">{changeIcon(line.kind)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-text">
                            <span className="font-medium">
                              {getDisplayName({
                                alias: device?.alias,
                                last_hostname: line.host.hostname,
                                hostname: line.host.hostname,
                                ip: line.host.ip,
                              })}
                            </span>{' '}
                            {line.action}
                          </p>
                          {line.detail && <p className="mt-1 truncate font-mono text-xs text-text-muted">{line.detail}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : (
              <p className="rounded-lg bg-surface px-4 py-3 text-sm text-text-muted">
                Sin cambios respecto al escaneo anterior
              </p>
            )}

            <section aria-labelledby="scan-devices-title">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 id="scan-devices-title" className="flex items-center gap-2 text-sm font-semibold text-text">
                  Todos los dispositivos
                  <span className="text-xs font-normal text-text-muted">· {hosts.length} detectados</span>
                </h3>
                <span className="text-right text-xs text-text-muted">
                  Mostrando {Math.min(5, listedHosts.length)} de {listedHosts.length}
                  {events.absentDevices.length > 0 && (
                    <span className="block">{events.absentDevices.length} ausentes de referencia</span>
                  )}
                </span>
              </div>
              {loading ? (
                <p role="status" aria-live="polite" className="py-10 text-center text-sm text-text-muted">Cargando...</p>
              ) : hosts.length === 0 ? (
                <p className="py-10 text-center text-sm text-text-muted">No hay dispositivos en este escaneo.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-surface-border">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-surface/60">
                      <tr className="border-b border-surface-border">
                        <th scope="col" className="px-3 py-3 text-xs font-semibold text-text-muted">Dispositivo</th>
                        <th scope="col" className="px-3 py-3 text-xs font-semibold text-text-muted">IP</th>
                        <th scope="col" className="px-3 py-3 text-xs font-semibold text-text-muted">Estado</th>
                        <th scope="col" className="px-3 py-3 text-xs font-semibold text-text-muted">Confianza</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {listedHosts.slice(0, 5).map((host) => {
                        const mac = normalizeMac(host.mac);
                        const device = deviceByMac.get(mac);
                        const present = currentMacs.has(mac);
                        const isNew = realNewDevices.some((item) => normalizeMac(item.mac) === mac);
                        const returned = events.returnedDevices.some((item) => normalizeMac(item.mac) === mac);
                        const isTrusted = device
                          ? trustedOverrides[mac] ?? device.trusted
                          : false;
                        const Icon = getDeviceIcon(host.device_type);
                        const editing = editingMac === host.mac;
                        const busy = savingMac === host.mac;
                        const summary = typeSummary(host);
                        return (
                          <tr
                            key={mac}
                            tabIndex={0}
                            aria-label={`Ver ${getDisplayName({ alias: device?.alias, last_hostname: host.hostname, ip: host.ip })}`}
                            onClick={() => !editing && openDevice(host)}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget || editing) return;
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openDevice(host);
                              }
                            }}
                            className={`cursor-pointer align-middle transition-colors hover:bg-surface-lighter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${
                              isNew ? 'bg-primary/5' : returned ? 'bg-success/5' : ''
                            }`}
                          >
                            <td className="max-w-[20rem] px-3 py-3">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <Icon className="h-5 w-5 shrink-0 text-text-muted" aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                  {editing ? (
                                    <input
                                      autoFocus
                                      value={aliasValue}
                                      onChange={(event) => setAliasValue(event.target.value)}
                                      onClick={(event) => event.stopPropagation()}
                                      onKeyDown={(event) => {
                                        event.stopPropagation();
                                        if (event.key === 'Enter') void saveAlias(host);
                                        if (event.key === 'Escape') setEditingMac(null);
                                      }}
                                      aria-label="Alias del dispositivo"
                                      className="w-full rounded border border-surface-border bg-surface px-2 py-1 text-sm text-text"
                                    />
                                  ) : (
                                    <>
                                      <div className="flex min-w-0 items-center gap-1.5">
                                        <span className="truncate font-medium text-text" title={getDisplayName({
                                          alias: device?.alias,
                                          last_hostname: host.hostname,
                                          ip: host.ip,
                                        })}>
                                          {getDisplayName({ alias: device?.alias, last_hostname: host.hostname, ip: host.ip })}
                                        </span>
                                        {device && (
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setEditingMac(host.mac);
                                              setAliasValue(device.alias || '');
                                            }}
                                            aria-label={`Editar alias de ${getDisplayName({ alias: device.alias, last_hostname: host.hostname, ip: host.ip })}`}
                                            title="Editar alias"
                                            className="shrink-0 rounded p-1 text-text-muted hover:bg-surface-lighter hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                          >
                                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                          </button>
                                        )}
                                        {isNew && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Nuevo</span>}
                                        {returned && <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">Volvió</span>}
                                      </div>
                                      {summary && <p className="mt-0.5 truncate text-xs text-text-muted">{summary}</p>}
                                    </>
                                  )}
                                </div>
                                {editing && (
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button type="button" disabled={busy} onClick={(event) => { event.stopPropagation(); void saveAlias(host); }} className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50">Guardar</button>
                                    <button type="button" onClick={(event) => { event.stopPropagation(); setEditingMac(null); }} className="rounded px-2 py-1 text-xs text-text-muted hover:bg-surface-lighter">Cancelar</button>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-text">{host.ip}</td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-text">
                                <Circle className={`h-2.5 w-2.5 fill-current ${present ? 'text-success' : 'text-text-muted'}`} aria-hidden="true" />
                                {present ? 'Presente' : 'Ausente'}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              {device ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void toggleTrusted(device, !isTrusted);
                                  }}
                                  title={isTrusted ? 'Quitar confianza' : 'Marcar como confiable'}
                                  aria-label={`${isTrusted ? 'Quitar confianza al dispositivo' : 'Marcar como confiable el dispositivo'} ${device.last_ip || normalizeMac(device.mac)}`}
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
                                    {busy ? 'Guardando…' : isTrusted ? 'Quitar confianza' : 'Marcar confiable'}
                                  </span>
                                </button>
                              ) : (
                                <span className="whitespace-nowrap rounded-full border border-surface-border bg-surface-lighter px-2.5 py-1 text-xs text-text-muted">Sin verificar</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {listedHosts.length > 5 && (
                <div className="mt-3 text-right">
                  <button type="button" onClick={goToDevices} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-text">
                    Ver los {listedHosts.length} en Dispositivos
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>

      {detailHost && (
        <DeviceDetailModal
          host={detailHost}
          device={deviceByMac.get(detailHost.mac.toUpperCase())}
          scannedAt={scan.scanned_at}
          onClose={() => setDetailHost(null)}
        />
      )}
    </>
  );
}
