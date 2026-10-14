import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, Router } from 'lucide-react';
import { getDevices } from '../api/devices';
import { getAllScanHistory } from '../api/scans';
import { ApiError } from '../errors/apiErrors';
import type { Device } from '../types/device.types';
import type { Host, ScanHistoryItem } from '../types/scan.types';
import { cleanHostname, getDeviceTypeLabel, getPortServiceLabel } from '../utils/deviceHelpers';
import { formatDateTime, formatRelativeTime } from '../utils/format';
import { GlossaryInfo } from '../components/GlossaryInfo';

const SENSITIVE_PORTS = new Set([21, 22, 23, 445, 3389]);
const SCANNER_MACS = new Set(['BBF270BEAB591C3D']);
const SCANNER_HOSTNAMES = new Set(['bbf270beab591c3d', 'host.docker.internal']);
const UNKNOWN_VALUES = new Set([
  'desconocido',
  'unknown',
  'no disponible',
  'no disponible (mac privada)',
  'no disponible (mac privada/aleatoria)',
  'tipo desconocido',
  'privada/aleatoria',
]);

interface UnstableDevice {
  mac: string;
  label: string;
  hasUserAlias: boolean;
  changes: number;
  lastChange: string;
  changePercentage: number;
}

interface ScanPoint {
  scannedAt: string;
  label: string;
  present: number;
}

interface CountEntry {
  name: string;
  value: number;
  percentage: number;
}

interface PortEntry {
  port: number;
  service: string;
  devices: number;
  sensitive: boolean;
}

function scanHosts(scan: ScanHistoryItem): Host[] {
  return Array.isArray(scan.hosts) ? scan.hosts : [];
}

function safeDate(value: string): number {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isUnknown(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLocaleLowerCase('es');
  return !normalized
    || UNKNOWN_VALUES.has(normalized)
    || normalized.includes('mac privada')
    || normalized.includes('mac aleatoria');
}

function isScanner(mac: string, hostname: string | null): boolean {
  return SCANNER_MACS.has(mac.replace(/[^a-z0-9]/gi, '').toUpperCase())
    || (hostname !== null && SCANNER_HOSTNAMES.has(cleanHostname(hostname).toLocaleLowerCase('es')));
}

function getDeviceLabel(device: Device | undefined, host: Host | undefined): { label: string; hasUserAlias: boolean } {
  if (device?.alias?.trim()) return { label: device.alias.trim(), hasUserAlias: true };
  const hostname = cleanHostname(device?.last_hostname || host?.hostname || null);
  if (hostname !== '—') return { label: hostname, hasUserAlias: false };
  const vendor = device?.vendor || host?.vendor;
  if (!isUnknown(vendor)) return { label: vendor!.trim(), hasUserAlias: false };
  return { label: 'Dispositivo desconocido', hasUserAlias: false };
}

function translateDeviceType(value: string | null | undefined): string {
  if (isUnknown(value)) return 'Tipo desconocido';
  const normalized = value!.trim().toLocaleLowerCase('es').replace(/[_-]+/g, ' ');
  const translations: Record<string, string> = {
    computer: 'Computador',
    desktop: 'Computador',
    laptop: 'Computador',
    pc: 'Computador',
    speaker: 'Parlante',
    tv: 'TV',
    phone: 'Teléfono',
    mobile: 'Teléfono',
    tablet: 'Tableta',
    router: 'Router',
    printer: 'Impresora',
    camera: 'Cámara',
  };
  return translations[normalized] || getDeviceTypeLabel(value!);
}

function getVendorName(value: string | null | undefined): string {
  return isUnknown(value) ? 'Sin identificar' : value!.trim();
}

function ChartTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload?: ScanPoint; value?: number }>;
}) {
  if (!active || !payload?.length || !payload[0].payload) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-surface-border bg-surface-light px-3 py-2 text-sm text-text shadow-lg">
      <p className="font-medium">{formatDateTime(point.scannedAt)}</p>
      <p className="mt-1 text-text-muted">{point.present} dispositivos presentes</p>
    </div>
  );
}

function navigateToDevices(): void {
  sessionStorage.setItem('netguard-devices-initial-filter', 'all');
  const devicesButton = document.querySelector<HTMLButtonElement>('button[aria-label="Dispositivos"]');
  if (!devicesButton) {
    console.error('No se encontró el control de navegación a Dispositivos.');
    return;
  }
  devicesButton.click();
}

function MetricCard({ label, value, note, children }: {
  label: string;
  value: string | number;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-surface-border bg-surface-light p-5">
      <h2 className="text-sm font-medium text-text-muted">{label}</h2>
      <p className="mt-1 truncate text-2xl font-bold text-text" title={String(value)}>{value}</p>
      {note && <p className="mt-1 text-xs text-text-muted">{note}</p>}
      {children}
    </article>
  );
}

function DistributionList({ title, rows, emptyText }: {
  title: string;
  rows: CountEntry[];
  emptyText: string;
}) {
  const maximum = Math.max(1, ...rows.map((row) => row.value));
  return (
    <article className="min-w-0 rounded-xl border border-surface-border bg-surface-light p-5">
      <h2 className="mb-4 font-semibold text-text">{title}</h2>
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.name} className="min-w-0">
              <div className="mb-1 flex min-w-0 items-baseline justify-between gap-3">
                <span className="truncate text-sm text-text" title={row.name}>{row.name}</span>
                <span className="shrink-0 text-right text-xs text-text-muted">
                  {row.value} {row.value === 1 ? 'dispositivo' : 'dispositivos'} ({row.percentage.toFixed(0)}%)
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`${row.name}: ${row.value} ${row.value === 1 ? 'dispositivo' : 'dispositivos'}`}
                aria-valuemin={0}
                aria-valuemax={maximum}
                aria-valuenow={row.value}
                className="h-2 overflow-hidden rounded-full bg-surface-lighter"
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${(row.value / maximum) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-text-muted">{emptyText}</p>
      )}
    </article>
  );
}

export function Analytics() {
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [scans, knownDevices] = await Promise.all([getAllScanHistory(), getDevices()]);
        if (!cancelled) {
          setHistory(scans);
          setDevices(knownDevices);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : 'No se pudieron cargar las estadísticas.');
          console.error('Error cargando estadísticas:', cause);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const analytics = useMemo(() => {
    const chronological = [...history].sort((a, b) => safeDate(a.scanned_at) - safeDate(b.scanned_at));
    const latestHosts = chronological.length ? scanHosts(chronological[chronological.length - 1]) : [];
    const latestHostByMac = new Map(latestHosts.map((host) => [host.mac.toUpperCase(), host]));
    const hostsByMac = new Map<string, Host[]>();
    for (const scan of chronological) {
      for (const host of scanHosts(scan)) {
        const mac = host.mac.toUpperCase();
        const historyForDevice = hostsByMac.get(mac) || [];
        historyForDevice.push(host);
        hostsByMac.set(mac, historyForDevice);
      }
    }

    const devicesByMac = new Map<string, Device>();
    for (const device of devices) devicesByMac.set(device.mac.toUpperCase(), device);
    for (const [mac, hosts] of hostsByMac) {
      if (devicesByMac.has(mac)) continue;
      const host = hosts[hosts.length - 1];
      devicesByMac.set(mac, {
        mac: host.mac,
        alias: null,
        trusted: false,
        last_ip: host.ip,
        last_hostname: host.hostname,
        vendor: host.vendor,
        device_type: host.device_type,
        os_hint: host.os_hint,
        first_seen: '',
        last_seen: '',
        is_present: latestHostByMac.has(mac),
        is_new: false,
        open_ports: host.open_ports,
        services: host.services,
      });
    }

    const vendors = new Map<string, Set<string>>();
    const types = new Map<string, Set<string>>();
    const portDevices = new Map<number, Set<string>>();
    for (const [mac, device] of devicesByMac) {
      const latestHost = latestHostByMac.get(mac);
      const representativeHost = latestHost || hostsByMac.get(mac)?.at(-1);
      if (isScanner(mac, device.last_hostname || representativeHost?.hostname || null)) continue;
      const vendor = getVendorName(device.vendor || representativeHost?.vendor);
      const type = translateDeviceType(device.device_type || representativeHost?.device_type);
      const vendorMacs = vendors.get(vendor) || new Set<string>();
      vendorMacs.add(mac);
      vendors.set(vendor, vendorMacs);
      const typeMacs = types.get(type) || new Set<string>();
      typeMacs.add(mac);
      types.set(type, typeMacs);

      const devicePorts = new Set<number>([
        ...(device.open_ports || []),
        ...(device.services || []).map((service) => {
          const match = service.match(/(?:tcp|udp)\/(\d+)|(\d+)\/(?:tcp|udp)/i);
          return match ? Number(match[1] || match[2]) : 0;
        }),
        ...(representativeHost?.open_ports || []),
      ]);
      devicePorts.delete(0);
      for (const port of devicePorts) {
        const macs = portDevices.get(port) || new Set<string>();
        macs.add(mac);
        portDevices.set(port, macs);
      }
    }

    const deviceCount = devices.length;
    const countEntries = (items: Map<string, Set<string>>): CountEntry[] => [...items.entries()]
      .map(([name, macs]) => ({
        name,
        value: macs.size,
        percentage: deviceCount ? (macs.size / deviceCount) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'es'));
    const vendorData = countEntries(vendors).slice(0, 8);
    const typeData = countEntries(types).slice(0, 8);

    const unstable: UnstableDevice[] = [];
    for (let index = 1; index < chronological.length; index += 1) {
      const previous = new Set(scanHosts(chronological[index - 1]).map((host) => host.mac.toUpperCase()));
      const current = new Set(scanHosts(chronological[index]).map((host) => host.mac.toUpperCase()));
      for (const mac of new Set([...previous, ...current])) {
        if (previous.has(mac) === current.has(mac)) continue;
        const latestHost = hostsByMac.get(mac)?.at(-1);
        const device = devicesByMac.get(mac);
        if (isScanner(mac, device?.last_hostname || latestHost?.hostname || null)) continue;
        const existing = unstable.find((item) => item.mac === mac);
        if (existing) {
          existing.changes += 1;
          existing.lastChange = chronological[index].scanned_at;
        } else {
          const { label, hasUserAlias } = getDeviceLabel(device, latestHost);
          unstable.push({
            mac,
            label,
            hasUserAlias,
            changes: 1,
            lastChange: chronological[index].scanned_at,
            changePercentage: 0,
          });
        }
      }
    }
    const transitionCount = Math.max(1, chronological.length - 1);
    unstable.forEach((device) => {
      device.changePercentage = Math.round((device.changes / transitionCount) * 100);
    });
    unstable.sort((a, b) => b.changes - a.changes || safeDate(b.lastChange) - safeDate(a.lastChange));

    const scanPresence: ScanPoint[] = chronological.map((scan) => {
      const date = new Date(scan.scanned_at);
      const presentMacs = new Set(
        scanHosts(scan)
          .filter((host) => {
            const mac = host.mac.toUpperCase();
            return !isScanner(mac, devicesByMac.get(mac)?.last_hostname || host.hostname || null);
          })
          .map((host) => host.mac.toUpperCase()),
      );
      return {
        scannedAt: scan.scanned_at,
        label: Number.isNaN(date.getTime())
          ? 'Sin fecha'
          : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        present: presentMacs.size,
      };
    });

    const openPortCounts: PortEntry[] = [...portDevices.entries()]
      .map(([port, macs]) => ({
        port,
        service: getPortServiceLabel(port)
          || ({ 21: 'FTP', 23: 'Telnet', 3389: 'RDP' }[port] ?? 'Servicio no identificado'),
        devices: macs.size,
        sensitive: SENSITIVE_PORTS.has(port),
      }))
      .sort((a, b) => b.devices - a.devices || a.port - b.port)
      .slice(0, 10);

    const durations = chronological
      .map((scan) => scan.duration_seconds)
      .filter((duration) => Number.isFinite(duration) && duration >= 0);
    const averageDuration = durations.length
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      : 0;
    const aliasCount = devices.filter((device) => Boolean(device.alias?.trim())).length;
    const trustedCount = devices.filter((device) => device.trusted).length;
    const presentCount = devices.filter((device) => device.is_present).length;
    const unstableCount = unstable.length;

    return {
      chronological,
      scanPresence,
      vendors: vendorData,
      types: typeData,
      openPortCounts,
      unstable: unstable.slice(0, 8),
      scans: chronological.length,
      averageDuration,
      fastestDuration: durations.length ? Math.min(...durations) : 0,
      slowestDuration: durations.length ? Math.max(...durations) : 0,
      deviceCount,
      aliasCount,
      trustedCount,
      presentCount,
      absentCount: devices.filter((device) => !device.is_present).length,
      unstableCount,
    };
  }, [history, devices]);

  if (loading) {
    return <div role="status" aria-live="polite" className="p-8 text-center text-text-muted">Cargando estadísticas...</div>;
  }

  const verifiedPercentage = analytics.deviceCount
    ? Math.round((analytics.trustedCount / analytics.deviceCount) * 100)
    : 0;
  const aliasPercentage = analytics.deviceCount
    ? Math.round((analytics.aliasCount / analytics.deviceCount) * 100)
    : 0;
  const instabilityPercentage = analytics.deviceCount > 0
    ? Math.round((analytics.unstableCount / analytics.deviceCount) * 100)
    : 0;

  return (
    <main className="min-h-screen w-full bg-surface p-5 text-text sm:p-8">
      <header className="mb-7">
        <h1 className="text-3xl font-bold">Estadísticas</h1>
        <p className="mt-1 text-sm text-text-muted">Identidad, actividad y estabilidad de la red</p>
      </header>

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger-text">
          {error}
        </div>
      )}

      <section aria-label="Resumen de la red" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Dispositivos"
          value={analytics.deviceCount}
          note={`en el inventario conocido · Presentes ahora: ${analytics.presentCount} · Ausentes: ${analytics.absentCount}`}
        />
        <MetricCard label="Verificados" value={`${analytics.trustedCount} de ${analytics.deviceCount}`}>
          <div
            role="progressbar"
            aria-label={`Dispositivos verificados: ${verifiedPercentage}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={verifiedPercentage}
            className="mt-3 h-2 overflow-hidden rounded-full bg-surface-lighter"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${verifiedPercentage}%` }} />
          </div>
        </MetricCard>
        <MetricCard label="Total de escaneos" value={analytics.scans} />
        <MetricCard
          label="Duración promedio"
          value={`${analytics.averageDuration.toFixed(1)} s`}
          note={analytics.scans
            ? `Más rápido: ${analytics.fastestDuration} s · Más lento: ${analytics.slowestDuration} s`
            : 'Sin escaneos para calcular duración'}
        />
      </section>

      {!analytics.scans && (
        <div className="mb-6 rounded-xl border border-surface-border bg-surface-light p-4 text-sm text-text-muted">
          Aún no hay escaneos guardados. Las estadísticas del inventario están disponibles.
        </div>
      )}

      <section className="mb-6 rounded-xl border border-surface-border bg-surface-light p-5">
        <div className="mb-4 flex items-start gap-2">
          <div>
            <h2 className="font-semibold text-text">Dispositivos presentes por escaneo</h2>
            <p className="mt-1 text-xs text-text-muted">Cantidad de direcciones MAC únicas detectadas en cada escaneo</p>
          </div>
          <GlossaryInfo termId="mac" className="mt-0.5" />
        </div>
        {analytics.scanPresence.length ? (
          <div className="h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.scanPresence} margin={{ top: 8, right: 20, bottom: 18, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-border)" />
                <XAxis
                  dataKey="label"
                  stroke="var(--color-text-muted)"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Fecha del escaneo', position: 'insideBottom', offset: -10, fill: 'var(--color-text-muted)', fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--color-text-muted)"
                  tick={{ fontSize: 11 }}
                  width={42}
                  label={{ value: 'Dispositivos presentes', angle: -90, position: 'insideLeft', fill: 'var(--color-text-muted)', fontSize: 12 }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="present"
                  name="Dispositivos presentes"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--color-primary)' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-text-muted">Realiza un escaneo para ver la evolución de los dispositivos presentes.</p>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-surface-border bg-surface-light p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-text">Dispositivos inestables</h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
              Cambios de presencia entre escaneos consecutivos
              <GlossaryInfo termId="inestable" />
            </p>
          </div>
          <span className="rounded-full border border-secondary/40 bg-secondary/15 px-3 py-1 text-xs font-semibold text-text">
            {instabilityPercentage}% del inventario
          </span>
        </div>
        {analytics.unstable.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs text-text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Dispositivo</th>
                  <th scope="col" className="px-3 py-2 font-medium">Cambios de presencia</th>
                  <th scope="col" className="px-3 py-2 font-medium">Último cambio</th>
                </tr>
              </thead>
              <tbody>
                {analytics.unstable.map((item) => (
                  <tr key={item.mac} className="border-b border-surface-border/60 last:border-0">
                    <td className={`max-w-[22rem] truncate px-3 py-3 ${item.hasUserAlias ? 'text-text' : 'text-text-muted'}`} title={`${item.label} · ${item.mac}`}>
                      {item.label}
                      {isScanner(item.mac, item.label) && ' (escáner)'}
                    </td>
                    <td className="px-3 py-3 text-text">
                      Apareció y desapareció {item.changes} {item.changes === 1 ? 'vez' : 'veces'}
                    </td>
                    <td className="px-3 py-3 text-text-muted" title={formatDateTime(item.lastChange)}>
                      {formatRelativeTime(item.lastChange).toLocaleLowerCase('es')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg bg-surface px-4 py-8 text-center text-sm text-text-muted">
            Se necesitan al menos dos escaneos para detectar cambios de presencia.
          </p>
        )}
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-2">
        <DistributionList
          title="Fabricantes"
          rows={analytics.vendors}
          emptyText="No hay fabricantes disponibles."
        />
        <DistributionList
          title="Tipos de dispositivo"
          rows={analytics.types}
          emptyText="No hay tipos identificados."
        />
      </section>

      <section className="mb-6 rounded-xl border border-surface-border bg-surface-light p-5">
        <div className="mb-4">
          <h2 className="font-semibold text-text">Puertos abiertos</h2>
          <p className="mt-1 text-xs text-text-muted">Cantidad de dispositivos únicos que han anunciado cada puerto</p>
        </div>
        {analytics.openPortCounts.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {analytics.openPortCounts.map((item) => (
              <li key={item.port} className="flex min-w-0 items-center gap-3 rounded-lg bg-surface px-3 py-3">
                <Router className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm text-text">
                  <span className="font-mono">{item.port}</span>
                  <span> · {item.service}</span>
                </span>
                {item.sensitive && (
                  <span className="shrink-0 rounded-full border border-danger/40 bg-danger/10 px-2 py-1 text-xs font-medium text-danger-text">
                    Sensible
                  </span>
                )}
                <span className="shrink-0 text-xs text-text-muted">
                  {item.devices} {item.devices === 1 ? 'dispositivo' : 'dispositivos'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-text-muted">No se detectaron puertos abiertos.</p>
        )}
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-light p-5">
        <div className="mb-4">
          <h2 className="font-semibold text-text">Cobertura de revisión</h2>
          <p className="mt-1 text-xs text-text-muted">Avance de la identificación manual y verificación del inventario</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-text">Alias puestos</span>
              <span className="text-text-muted">{analytics.aliasCount}/{analytics.deviceCount}</span>
            </div>
            <div
              role="progressbar"
              aria-label={`Dispositivos con alias: ${aliasPercentage}%`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={aliasPercentage}
              className="h-2 overflow-hidden rounded-full bg-surface-lighter"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${aliasPercentage}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-text">Dispositivos verificados</span>
              <span className="text-text-muted">{analytics.trustedCount}/{analytics.deviceCount}</span>
            </div>
            <div
              role="progressbar"
              aria-label={`Dispositivos verificados: ${verifiedPercentage}%`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={verifiedPercentage}
              className="h-2 overflow-hidden rounded-full bg-surface-lighter"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${verifiedPercentage}%` }} />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={navigateToDevices}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-surface-border bg-surface-lighter px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Poner alias <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
    </main>
  );
}
