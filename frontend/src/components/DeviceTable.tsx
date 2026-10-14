import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Shield, ShieldCheck } from 'lucide-react';
import type { Host } from '../types/scan.types';
import type { Device } from '../types/device.types';
import { cleanHostname } from '../utils/deviceHelpers';

interface DeviceTableProps {
  hosts?: Host[];
  onSelectHost?: (host: Host) => void;
  devices?: Device[];
  onToggleTrusted?: (mac: string, trusted: boolean) => Promise<void>;
}

type DeviceFilter = 'all' | 'present' | 'absent' | 'trusted' | 'unverified';
type SortColumn = 'ip' | 'mac' | 'vendor' | 'hostname' | 'device_type' | 'status' | 'trusted' | 'open_ports' | 'services';

const servicePorts: Record<string, number> = {
  chromecast: 8008,
  googlecast: 8008,
  dns: 53,
  http: 80,
  https: 443,
};

const portLabels: Record<number, string> = {
  53: 'DNS',
  80: 'HTTP',
  443: 'HTTPS',
  8008: 'Chromecast',
  8009: 'Chromecast',
};

function normalizeMac(mac: string): string {
  return mac.toUpperCase();
}

function getServicePort(service: string): number | undefined {
  const match = service.match(/(?:tcp|udp)\/(\d+)|(\d+)\/(?:tcp|udp)/i);
  if (match) return Number(match[1] || match[2]);
  const normalized = service.toLowerCase().replace(/^_/, '').split(/[._-]/)[0];
  return servicePorts[normalized];
}

function displayPort(port: number): string {
  return portLabels[port] ? `${port} ${portLabels[port]}` : String(port);
}

export function DeviceTable({
  hosts,
  onSelectHost,
  devices = [],
  onToggleTrusted,
}: DeviceTableProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DeviceFilter>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('ip');
  const [sortAscending, setSortAscending] = useState(true);
  const [updatingMac, setUpdatingMac] = useState<string | null>(null);
  const [trustedOverrides, setTrustedOverrides] = useState<Record<string, boolean>>({});
  const [trustError, setTrustError] = useState<string | null>(null);
  const knownDevices = useMemo(
    () => new Map(devices.map((device) => [normalizeMac(device.mac), device])),
    [devices],
  );
  const allHosts = useMemo(() => {
    const scanHosts = hosts ?? [];
    const seenMacs = new Set(scanHosts.map((host) => normalizeMac(host.mac)));
    const offlineHosts = devices
      .filter((device) => !seenMacs.has(normalizeMac(device.mac)))
      .map((device): Host => ({
        ip: device.last_ip || '',
        hostname: device.last_hostname,
        mac: device.mac,
        vendor: device.vendor,
        status: device.is_present ? 'up' : 'down',
        names: [],
        services: device.services || [],
        open_ports: device.open_ports || [],
        model: null,
        device_type: device.device_type,
        os_hint: device.os_hint,
      }));
    return [...scanHosts, ...offlineHosts];
  }, [devices, hosts]);

  const filteredHosts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    const filtered = allHosts.filter((host) => {
      const device = knownDevices.get(normalizeMac(host.mac));
      const isPresent = host.status === 'up';
      const matchesFilter = filter === 'all'
        || (filter === 'present' && isPresent)
        || (filter === 'absent' && !isPresent)
        || (filter === 'trusted' && device?.trusted)
        || (filter === 'unverified' && !device?.trusted);
      const searchable = [
        host.ip,
        host.mac,
        host.hostname,
        host.vendor,
        device?.alias,
      ].filter(Boolean).join(' ').toLocaleLowerCase('es');
      return matchesFilter && (!query || searchable.includes(query));
    });

    return filtered.sort((left, right) => {
      const leftDevice = knownDevices.get(normalizeMac(left.mac));
      const rightDevice = knownDevices.get(normalizeMac(right.mac));
      const values: Record<SortColumn, [string | number, string | number]> = {
        ip: [left.ip, right.ip],
        mac: [left.mac, right.mac],
        vendor: [left.vendor || '', right.vendor || ''],
        hostname: [leftDevice?.alias || cleanHostname(left.hostname), rightDevice?.alias || cleanHostname(right.hostname)],
        device_type: [left.device_type || '', right.device_type || ''],
        status: [left.status, right.status],
        trusted: [Number(Boolean(leftDevice?.trusted)), Number(Boolean(rightDevice?.trusted))],
        open_ports: [left.open_ports.join(','), right.open_ports.join(',')],
        services: [left.services.join(','), right.services.join(',')],
      };
      const [leftValue, rightValue] = values[sortColumn];
      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), 'es', { numeric: true });
      return sortAscending ? comparison : -comparison;
    });
  }, [allHosts, filter, knownDevices, search, sortAscending, sortColumn]);

  const sortBy = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortAscending((ascending) => !ascending);
    } else {
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

  const toggleTrusted = async (device: Device, trusted: boolean) => {
    const mac = normalizeMac(device.mac);
    setUpdatingMac(mac);
    setTrustError(null);
    setTrustedOverrides((current) => ({ ...current, [mac]: trusted }));
    try {
      await onToggleTrusted?.(device.mac, trusted);
    } catch (cause) {
      setTrustedOverrides((current) => {
        const next = { ...current };
        delete next[mac];
        return next;
      });
      setTrustError(cause instanceof Error ? cause.message : 'No se pudo actualizar la confianza.');
      console.error(`No se pudo actualizar la confianza del dispositivo ${device.mac}:`, cause);
    } finally {
      setUpdatingMac(null);
    }
  };

  const header = (label: string, column: SortColumn) => (
    <th aria-sort={column === sortColumn ? (sortAscending ? 'ascending' : 'descending') : 'none'} className="px-3 py-3 text-left">
      <button
        type="button"
        onClick={() => sortBy(column)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text"
      >
        {label}
        {sortIcon(column)}
      </button>
    </th>
  );

  if (allHosts.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-text-muted">No se encontraron dispositivos</p>
      </div>
    );
  }

  return (
    <div>
      {trustError && (
        <p role="alert" className="mx-3 mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {trustError}
        </p>
      )}
      <div className="flex flex-col gap-3 px-3 pb-4 md:flex-row md:items-center md:justify-between">
        <label className="relative block min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <span className="sr-only">Buscar por IP, MAC, nombre o fabricante</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar IP, MAC, nombre o fabricante"
            className="w-full rounded-lg border border-surface-border bg-surface px-9 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Filtrar dispositivos">
          {([
            ['all', 'Todos'],
            ['present', 'Presentes'],
            ['absent', 'Ausentes'],
            ['trusted', 'Confiables'],
            ['unverified', 'Sin verificar'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === value
                  ? 'border-primary/40 bg-primary/10 text-primary-text'
                  : 'border-surface-border text-text-muted hover:bg-surface-lighter hover:text-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        {filteredHosts.length > 0 ? (
          <table className="w-full min-w-[1050px] text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {header('IP', 'ip')}
                {header('MAC', 'mac')}
                {header('Fabricante', 'vendor')}
                {header('Dispositivo', 'hostname')}
                {header('Tipo', 'device_type')}
                {header('Estado', 'status')}
                {header('Confianza', 'trusted')}
                {header('Puertos', 'open_ports')}
                {header('Servicios', 'services')}
                {onSelectHost && <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">Detalle</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filteredHosts.map((host) => {
                const device = knownDevices.get(normalizeMac(host.mac));
                const isTrusted = device
                  ? trustedOverrides[normalizeMac(device.mac)] ?? device.trusted
                  : false;
                const isPresent = host.status === 'up';
                const hostname = device?.alias?.trim() || cleanHostname(host.hostname);
                const visibleServices = host.services.filter((service) => {
                  const servicePort = getServicePort(service);
                  const associatedPorts = service.toLowerCase().includes('googlecast')
                    ? [8008, 8009]
                    : servicePort ? [servicePort] : [];
                  return !associatedPorts.some((port) => host.open_ports.includes(port));
                });
                const isUpdating = updatingMac === host.mac;

                return (
                  <tr key={host.mac || host.ip} className="transition-colors hover:bg-surface-lighter">
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-primary-text">{host.ip || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-text-muted">{host.mac || '—'}</td>
                    <td className="px-3 py-3 text-text">{host.vendor || 'Desconocido'}</td>
                    <td className={`px-3 py-3 ${hostname === '—' ? 'text-text-muted italic' : 'text-text'}`}>
                      {hostname === '—' ? 'Sin nombre' : hostname}
                    </td>
                    <td className="px-3 py-3 text-text">{host.device_type || '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full border px-2 py-1 text-xs font-medium ${
                        isPresent
                          ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'border-surface-border bg-surface-lighter text-text-muted'
                      }`}>
                        {isPresent ? 'Presente' : 'Ausente'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {device ? (
                        <button
                          type="button"
                          disabled={!onToggleTrusted || isUpdating}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!onToggleTrusted) return;
                            void toggleTrusted(device, !isTrusted);
                          }}
                          title={isTrusted ? 'Quitar confianza' : 'Marcar como confiable'}
                          aria-label={`${isTrusted ? 'Quitar confianza al dispositivo' : 'Marcar como confiable el dispositivo'} ${device.last_ip || device.mac}`}
                          className={`inline-flex w-40 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
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
                      ) : <span className="whitespace-nowrap text-xs text-text-muted">Sin verificar</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {host.open_ports.length > 0 ? host.open_ports.map((port) => (
                          <span key={port} className="whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                            {displayPort(port)}
                          </span>
                        )) : <span className="text-text-muted">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-56 flex-wrap gap-1">
                        {visibleServices.length > 0 ? visibleServices.map((service) => (
                          <span key={service} className="whitespace-nowrap rounded-full border border-amber-200 bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-warning-text">
                            {service}
                          </span>
                        )) : <span className="text-text-muted">—</span>}
                      </div>
                    </td>
                    {onSelectHost && (
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectHost(host)}
                          className="text-xs font-medium text-primary-light hover:text-primary-text"
                        >
                          Ver todos
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center text-sm text-text-muted">
            No hay dispositivos que coincidan con la búsqueda o los filtros.
          </div>
        )}
      </div>
    </div>
  );
}
