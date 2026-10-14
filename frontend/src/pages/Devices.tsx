import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { getDevices, updateDevice } from '../api/devices';
import type { Device, DeviceUpdate } from '../types/device.types';
import { DevicesTable } from '../components/DevicesTable';
import { DeviceDetailModal } from '../components/DeviceDetailModal';
import { ApiError } from '../errors/apiErrors';
import { getAllScanHistory, getScanHosts } from '../api/scans';
import type { Host } from '../types/scan.types';
import { getDisplayName, isReallyNew, normalizeMac } from '../utils/deviceHelpers';
import { Tooltip } from '../components/Tooltip';
import { getDeviceStats } from '../utils/deviceStats';
import { GlossaryInfo } from '../components/GlossaryInfo';

type DeviceFilter = 'all' | 'new' | 'present' | 'absent' | 'trusted' | 'unverified';

interface DevicesProps {
  onNavigate?: (view: string) => void;
}

function deduplicateDevices(devices: Device[]): Device[] {
  const latestByMac = new Map<string, { device: Device; index: number }>();

  devices.forEach((device, index) => {
    const normalizedMac = normalizeMac(device.mac);
    const key = normalizedMac === '—' ? `${normalizedMac}-${index}` : normalizedMac;
    const current = latestByMac.get(key);
    const lastSeen = new Date(device.last_seen).getTime();
    const currentLastSeen = current ? new Date(current.device.last_seen).getTime() : Number.NEGATIVE_INFINITY;
    const comparableLastSeen = Number.isFinite(lastSeen) ? lastSeen : Number.NEGATIVE_INFINITY;
    const comparableCurrentLastSeen = Number.isFinite(currentLastSeen)
      ? currentLastSeen
      : Number.NEGATIVE_INFINITY;
    if (!current || comparableLastSeen > comparableCurrentLastSeen) {
      latestByMac.set(key, { device, index });
    }
  });

  return [...latestByMac.values()]
    .sort((left, right) => left.index - right.index)
    .map(({ device }) => device);
}

export function Devices({ onNavigate }: DevicesProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [hostsByMac, setHostsByMac] = useState<Record<string, Host>>({});
  const [appearancesByMac, setAppearancesByMac] = useState<Record<string, number>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portsError, setPortsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DeviceFilter>(() => {
    const requestedFilter = sessionStorage.getItem('netguard-devices-initial-filter');
    sessionStorage.removeItem('netguard-devices-initial-filter');
    return requestedFilter === 'unverified' ? 'unverified' : 'all';
  });
  const [selectedMac, setSelectedMac] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(
    () => localStorage.getItem('welcomeShownDevices') !== 'true',
  );

  useEffect(() => {
    if (showWelcome) localStorage.setItem('welcomeShownDevices', 'true');
  }, [showWelcome]);

  useEffect(() => {
    let cancelled = false;

    async function cargarDevices() {
      try {
        const data = deduplicateDevices(await getDevices());
        if (cancelled) return;
        let devicesWithPorts = data;
        try {
          const history = await getAllScanHistory();
          const latestScan = [...history].sort(
            (a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime(),
          )[0];
          const appearances = new Map<string, number>();
          history.forEach((scan) => {
            new Set((scan.hosts || []).map((host) => normalizeMac(host.mac))).forEach((mac) => {
              appearances.set(mac, (appearances.get(mac) || 0) + 1);
            });
          });
          if (!cancelled) {
            setAppearancesByMac(Object.fromEntries(appearances));
          }
          if (latestScan) {
            const hosts = await getScanHosts(latestScan.id);
            const hostsByMac = new Map(hosts.map((host) => [normalizeMac(host.mac), host]));
            if (!cancelled) {
              setHostsByMac(Object.fromEntries(
                hosts.map((host) => [normalizeMac(host.mac), host]),
              ));
            }
            devicesWithPorts = data.map((device) => ({
              ...device,
              open_ports: hostsByMac.get(normalizeMac(device.mac))?.open_ports,
              services: hostsByMac.get(normalizeMac(device.mac))?.services,
            }));
          }
        } catch (err) {
          console.error('No se pudieron cargar los puertos del último escaneo:', err);
          if (!cancelled) setPortsError('No se pudieron cargar los puertos del último escaneo.');
        }
        if (!cancelled) setDevices(devicesWithPorts);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('No se pudieron cargar los dispositivos');
        }
        console.error(err);
      } finally {
        if (!cancelled) setCargando(false);
      }
    }

    void cargarDevices();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdate = async (mac: string, data: DeviceUpdate) => {
    try {
      const updated = await updateDevice(mac, data);
      setDevices((prev) => prev.map((device) => (
        device.mac === mac
          ? { ...device, ...updated, open_ports: device.open_ports, services: device.services }
          : device
      )));
    } catch (err) {
      console.error('Error actualizando dispositivo:', err);
      if (err instanceof ApiError) {
        setError(err.message);
      }
      throw err;
    }
  };

  const selectedDevice = devices.find((device) => normalizeMac(device.mac) === normalizeMac(selectedMac)) || null;
  const selectedHost = selectedDevice
    ? hostsByMac[normalizeMac(selectedDevice.mac)] || {
      ip: selectedDevice.last_ip || '',
      hostname: selectedDevice.last_hostname,
      mac: selectedDevice.mac,
      vendor: selectedDevice.vendor,
      status: selectedDevice.is_present ? 'up' : 'down',
      names: [],
      services: selectedDevice.services || [],
      open_ports: selectedDevice.open_ports || [],
      model: null,
      device_type: selectedDevice.device_type,
      os_hint: selectedDevice.os_hint,
    }
    : null;

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return devices.filter((device) => {
      const matchesFilter = filter === 'all'
        || (filter === 'new' && isReallyNew(device))
        || (filter === 'present' && device.is_present)
        || (filter === 'absent' && !device.is_present)
        || (filter === 'trusted' && device.trusted)
        || (filter === 'unverified' && !device.trusted);
      const searchable = [
        getDisplayName(device),
        device.alias,
        device.last_hostname,
        device.last_ip,
        normalizeMac(device.mac),
        device.vendor,
      ].filter(Boolean).join(' ').toLocaleLowerCase('es');
      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [devices, filter, search]);

  const deviceStats = getDeviceStats(devices);
  const { total, present: presentes, absent: ausentes, trusted: confiables } = deviceStats;
  const nuevos = devices.filter(isReallyNew).length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-text">Dispositivos</h1>
        <p className="text-text-muted">Inventario de dispositivos detectados en la red</p>
      </div>

      {showWelcome && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-text">
          <div className="flex items-start gap-2">
            <GlossaryInfo termId="sin-verificar" className="mt-0.5" />
            <p>
              Bienvenido a NetGuard. Aquí puedes ver todos los dispositivos conectados a tu red.
              Haz clic en cualquier dispositivo para ver más detalles. ¿Necesitas ayuda?{' '}
              <button
                type="button"
                onClick={() => onNavigate?.('help')}
                className="font-semibold text-primary-text underline underline-offset-2 hover:text-primary-light"
              >
                Visita la sección Ayuda.
              </button>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWelcome(false)}
            aria-label="Cerrar mensaje de bienvenida"
            className="shrink-0 rounded p-1 text-text-muted hover:bg-surface-lighter hover:text-text"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-danger-text">
          {error}
        </div>
      )}
      {portsError && (
        <div role="alert" className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-warning-text">
          {portsError}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-surface-border bg-surface-light p-5">
          <div className="text-sm font-medium text-text-muted">
            <GlossaryInfo termId="inventario" label="Total" />
          </div>
          <p className="mt-1 text-3xl font-bold text-text">{total}</p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-light p-5">
          <div className="text-sm font-medium text-text-muted">
            <GlossaryInfo termId="nuevo" label="Nuevos" />
          </div>
          <p className="mt-1 text-3xl font-bold text-primary-text">{nuevos}</p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-light p-5">
          <div className="text-sm font-medium text-text-muted">
            <GlossaryInfo termId="presente" label="Presentes" />
          </div>
          <p className="mt-1 text-3xl font-bold text-primary-light">{presentes}</p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-light p-5">
          <div className="text-sm font-medium text-text-muted">
            <GlossaryInfo termId="ausente" label="Ausentes" />
          </div>
          <p className="mt-1 text-3xl font-bold text-text-muted">{ausentes}</p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-light p-5">
          <div className="text-sm font-medium text-text-muted">
            <GlossaryInfo termId="confiable" label="Confiables" />
          </div>
          <p className="mt-1 text-3xl font-bold text-primary-text">{confiables}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-surface-border bg-surface-light">
        <div className="border-b border-surface-border p-6">
          <h2 className="text-lg font-semibold text-text">Inventario</h2>
          <p className="mt-1 text-sm text-text-muted">
            {cargando ? 'Cargando...' : `${filteredDevices.length} de ${total} dispositivos`}
          </p>
          <div className="mt-5 flex flex-col gap-3 lg:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por alias, hostname, IP, MAC o fabricante"
              className="min-w-0 flex-1 rounded-lg border border-surface-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
            <div className="flex flex-wrap gap-2" aria-label="Filtrar dispositivos">
              {([
                ['all', 'Todos', 'Mostrar todos los dispositivos.'],
                ['new', 'Nuevos', 'Mostrar dispositivos vistos por primera vez en las últimas 24 horas y con fabricante identificado.'],
                ['present', 'Presentes', 'Mostrar solo dispositivos conectados en el escaneo reciente.'],
                ['absent', 'Ausentes', 'Mostrar dispositivos conocidos que no aparecieron en el último escaneo.'],
                ['trusted', 'Confiables', 'Mostrar solo dispositivos que marcaste como confiables.'],
                ['unverified', 'Sin verificar', 'Mostrar dispositivos que todavía no has marcado como confiables.'],
              ] as const).map(([value, label, tooltip]) => (
                <Tooltip key={value} content={tooltip}>
                  <button
                    type="button"
                    onClick={() => setFilter(value)}
                    aria-pressed={filter === value}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      filter === value
                        ? 'border-primary/40 bg-primary/10 text-primary-light'
                        : 'border-surface-border text-text-muted hover:bg-surface-lighter hover:text-text'
                    }`}
                  >
                    {label}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>
        </div>
        <div className="p-2">
          {cargando ? (
            <div role="status" aria-live="polite" className="py-16 text-center text-text-muted">Cargando...</div>
          ) : (
            <DevicesTable
              devices={filteredDevices}
              onUpdate={handleUpdate}
              onSelectDevice={(device) => setSelectedMac(device.mac)}
            />
          )}
        </div>
      </div>
      {selectedDevice && selectedHost && (
        <DeviceDetailModal
          host={selectedHost}
          device={selectedDevice}
          appearanceCount={appearancesByMac[selectedDevice.mac.toUpperCase()]}
          onClose={() => setSelectedMac(null)}
          onSetAlias={(device, alias) => handleUpdate(device.mac, { alias })}
          onToggleTrusted={(device) => handleUpdate(device.mac, { trusted: !device.trusted })}
        />
      )}
    </div>
  );
}