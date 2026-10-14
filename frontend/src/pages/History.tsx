import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { getAllScanHistory, getScanDetail, getScanHosts } from '../api/scans';
import { getDevices, updateDevice } from '../api/devices';
import { ApiError } from '../errors/apiErrors';
import { CollapsibleDay } from '../components/CollapsibleDay';
import { ScanDetailModal } from '../components/ScanDetailModal';
import { ScanHistoryItem, type ScanEvents } from '../components/ScanHistoryItem';
import type { Host, ScanHistoryItem as ScanRecord } from '../types/scan.types';
import type { Device, DeviceUpdate } from '../types/device.types';
import { exportHistory } from '../utils/exportHistory';
import { calculateScanEvents, calculateScanEventsForHistory } from '../utils/scanEvents';
import { formatTime } from '../utils/format';

type ChangeFilter = 'all' | 'new' | 'absent' | 'returned';

interface DayGroup {
  key: string;
  title: string;
  scans: ScanRecord[];
}

type DayEntry =
  | { kind: 'scan'; scan: ScanRecord }
  | { kind: 'unchanged'; scans: ScanRecord[] };

const EMPTY_EVENTS: ScanEvents = {
  newDevices: [],
  absentDevices: [],
  returnedDevices: [],
  changedPorts: [],
};

function dateObjectKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDateKey(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown' : dateObjectKey(date);
}

function dayTitle(dateKey: string): string {
  if (dateKey === 'unknown') return 'Fecha no disponible';

  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const label = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);

  if (dateKey === dateObjectKey(today)) return `Hoy · ${label}`;
  if (dateKey === dateObjectKey(yesterday)) return `Ayer · ${label}`;
  return label;
}

function groupByDay(scans: ScanRecord[]): DayGroup[] {
  const groups = new Map<string, ScanRecord[]>();
  for (const scan of scans) {
    const key = localDateKey(scan.scanned_at);
    const group = groups.get(key);
    if (group) group.push(scan);
    else groups.set(key, [scan]);
  }

  return [...groups.entries()]
    .map(([key, groupScans]) => ({
      key,
      title: dayTitle(key),
      scans: [...groupScans].sort((a, b) => (
        new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime()
      )),
    }))
    .sort((a, b) => {
      if (a.key === 'unknown') return 1;
      if (b.key === 'unknown') return -1;
      return b.key.localeCompare(a.key);
    });
}

function hasChange(events: ScanEvents, filter: ChangeFilter): boolean {
  if (filter === 'new') return events.newDevices.length > 0;
  if (filter === 'absent') return events.absentDevices.length > 0;
  if (filter === 'returned') return events.returnedDevices.length > 0;
  return true;
}

function getDayEntries(scans: ScanRecord[], eventsByScanId: Record<number, ScanEvents>): DayEntry[] {
  const entries: DayEntry[] = [];
  let unchangedRun: ScanRecord[] = [];
  const flushUnchanged = () => {
    if (unchangedRun.length > 1) entries.push({ kind: 'unchanged', scans: unchangedRun });
    else if (unchangedRun.length === 1) entries.push({ kind: 'scan', scan: unchangedRun[0] });
    unchangedRun = [];
  };

  for (const scan of scans) {
    const events = eventsByScanId[scan.id] || EMPTY_EVENTS;
    const changed = events.newDevices.length
      + events.absentDevices.length
      + events.returnedDevices.length
      + events.changedPorts.length > 0;
    if (changed) {
      flushUnchanged();
      entries.push({ kind: 'scan', scan });
    } else {
      unchangedRun.push(scan);
    }
  }
  flushUnchanged();
  return entries;
}

function UnchangedScansRow({ scans, expanded, onToggle, onOpen }: {
  scans: ScanRecord[];
  expanded: boolean;
  onToggle: () => void;
  onOpen: (scan: ScanRecord) => void;
}) {
  const counts = new Set(scans.map((scan) => scan.total_hosts));
  const countLabel = counts.size === 1
    ? `${scans[0].total_hosts} ${scans[0].total_hosts === 1 ? 'dispositivo' : 'dispositivos'} en todos`
    : `${Math.min(...counts)}–${Math.max(...counts)} dispositivos`;

  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-4 text-left transition-colors hover:bg-surface-lighter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5"
      >
        {expanded
          ? <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
          : <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />}
        <span className="font-medium text-text">{scans.length} escaneos sin cambios</span>
        <span className="text-sm text-text-muted">
          {formatTime(scans[scans.length - 1].scanned_at)} - {formatTime(scans[0].scanned_at)} · {countLabel}
        </span>
        <span className="ml-auto text-sm font-medium text-primary">{expanded ? 'Ocultar' : 'Mostrar'}</span>
      </button>
      {expanded && scans.map((scan) => (
        <ScanHistoryItem key={scan.id} scan={scan} events={EMPTY_EVENTS} onOpen={onOpen} />
      ))}
    </div>
  );
}

export function History() {
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>('all');
  const [selectedScan, setSelectedScan] = useState<ScanRecord | null>(null);
  const [detailHosts, setDetailHosts] = useState<Host[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [compareFromId, setCompareFromId] = useState('');
  const [compareToId, setCompareToId] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const scans = await getAllScanHistory();
        if (!cancelled) {
          setHistory(scans);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'No se pudo cargar el historial.');
          console.error('Error cargando el historial de escaneos:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDevices()
      .then((data) => {
        if (!cancelled) setDevices(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          console.error('No se pudo cargar el inventario para acciones del historial:', cause);
          setError((current) => current || 'El inventario no está disponible; las acciones de alias y confianza están deshabilitadas.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const eventsByScanId = useMemo(() => calculateScanEventsForHistory(history), [history]);
  const chronologicalHistory = useMemo(
    () => [...history].sort((a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime() || a.id - b.id),
    [history],
  );

  const latestFirst = [...chronologicalHistory].reverse();
  const effectiveCompareFromId = compareFromId || String(latestFirst[1]?.id ?? '');
  const effectiveCompareToId = compareToId || String(latestFirst[0]?.id ?? '');

  const comparison = useMemo(() => {
    const previous = history.find((scan) => String(scan.id) === effectiveCompareFromId);
    const current = history.find((scan) => String(scan.id) === effectiveCompareToId);
    if (!previous || !current || previous.id === current.id) return null;
    const priorScans = chronologicalHistory.filter(
      (scan) => new Date(scan.scanned_at).getTime() < new Date(previous.scanned_at).getTime(),
    );
    return {
      previous,
      current,
      events: calculateScanEvents(
        current.hosts || [],
        previous.hosts || [],
        priorScans.flatMap((scan) => scan.hosts || []),
      ),
    };
  }, [effectiveCompareFromId, effectiveCompareToId, history, chronologicalHistory]);
  const comparisonSummary = useMemo(() => {
    if (!comparison) return null;
    const parts: string[] = [];
    const labelHost = (host: Host) => {
      const alias = devices.find((device) => device.mac.toUpperCase() === host.mac.toUpperCase())?.alias;
      return alias?.trim() || host.hostname || host.ip;
    };
    const { events } = comparison;
    if (events.returnedDevices.length) {
      parts.push(`${events.returnedDevices.length} ${events.returnedDevices.length === 1 ? 'volvió' : 'volvieron'} · ${events.returnedDevices.map(labelHost).join(', ')}`);
    }
    if (events.newDevices.length) {
      parts.push(`${events.newDevices.length} ${events.newDevices.length === 1 ? 'nuevo' : 'nuevos'} · ${events.newDevices.map(labelHost).join(', ')}`);
    }
    if (events.absentDevices.length) {
      parts.push(`${events.absentDevices.length} ${events.absentDevices.length === 1 ? 'ausente' : 'ausentes'} · ${events.absentDevices.map(labelHost).join(', ')}`);
    }
    if (events.changedPorts.length) {
      parts.push(`${events.changedPorts.length} ${events.changedPorts.length === 1 ? 'cambio' : 'cambios'} de puertos`);
    }
    const previousByMac = new Map((comparison.previous.hosts || []).map((host) => [host.mac.toUpperCase(), host]));
    const changedIpHosts = (comparison.current.hosts || []).filter((host) => {
      const previous = previousByMac.get(host.mac.toUpperCase());
      return previous && previous.ip !== host.ip;
    });
    if (changedIpHosts.length) {
      parts.push(`${changedIpHosts.length} ${changedIpHosts.length === 1 ? 'cambio' : 'cambios'} de IP · ${changedIpHosts.map(labelHost).join(', ')}`);
    }
    return parts.length ? parts.join(' · ') : 'Sin nuevos, ausentes ni cambios de puertos.';
  }, [comparison, devices]);
  const dateOptions = useMemo(() => [...new Set(history.map((scan) => localDateKey(scan.scanned_at)))]
    .filter((key) => key !== 'unknown')
    .sort((a, b) => b.localeCompare(a)), [history]);

  const filteredGroups = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es');
    const filtered = history.filter((scan) => {
      const matchesSearch = !normalizedSearch
        || scan.target.toLocaleLowerCase('es').includes(normalizedSearch)
        || (scan.hosts || []).some((host) => {
          const alias = devices.find((device) => device.mac.toUpperCase() === host.mac.toUpperCase())?.alias;
          return [alias, host.hostname, host.ip, host.mac, host.vendor, ...host.names]
            .some((value) => value?.toLocaleLowerCase('es').includes(normalizedSearch));
        });
      const matchesDate = !dateFilter || localDateKey(scan.scanned_at) === dateFilter;
      const matchesChange = hasChange(
        eventsByScanId[scan.id] || { newDevices: [], absentDevices: [], returnedDevices: [], changedPorts: [] },
        changeFilter,
      );
      return matchesSearch && matchesDate && matchesChange;
    });
    return groupByDay(filtered);
  }, [history, search, dateFilter, changeFilter, eventsByScanId, devices]);

  const visibleCount = filteredGroups.reduce((count, group) => count + group.scans.length, 0);

  const openDetailFromList = (scan: ScanRecord) => void openDetail(scan);
  const toggleUnchangedRun = (scans: ScanRecord[]) => {
    const key = `${scans[0].id}:${scans[scans.length - 1].id}`;
    setExpandedRuns((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const allScans = await getAllScanHistory();
      exportHistory(allScans, format, Object.fromEntries(
        allScans.map((scan) => [scan.id, scan.hosts || []]),
      ));
      setExportMenuOpen(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'No se pudo exportar el historial.');
    }
  };

  const openDetail = async (scan: ScanRecord) => {
    setSelectedScan(scan);
    setDetailHosts(scan.hosts || []);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const [detail, hosts] = await Promise.all([
        getScanDetail(scan.id),
        getScanHosts(scan.id),
      ]);
      setSelectedScan((current) => current?.id === scan.id
        ? { ...current, ...detail, hosts }
        : current);
      setDetailHosts(hosts);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : 'No se pudo cargar el detalle del escaneo.');
      console.error(`Error cargando el escaneo ${scan.id}:`, err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedScan(null);
    setDetailHosts([]);
    setDetailLoading(false);
    setDetailError(null);
  };

  const handleDeviceUpdate = async (mac: string, data: DeviceUpdate) => {
    try {
      const updated = await updateDevice(mac, data);
      setDevices((current) => current.map((device) => device.mac.toUpperCase() === mac.toUpperCase()
        ? { ...device, ...updated }
        : device));
    } catch (cause) {
      console.error(`No se pudo actualizar el dispositivo ${mac}:`, cause);
      setDetailError(cause instanceof ApiError ? cause.message : 'No se pudo actualizar el dispositivo.');
      throw cause;
    }
  };

  const handleDeviceUpdateSafely = async (mac: string, data: DeviceUpdate) => {
    try {
      await handleDeviceUpdate(mac, data);
    } catch {
      // The modal displays the API error in its detail alert.
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDateFilter('');
    setChangeFilter('all');
  };

  return (
    <main className="min-h-screen bg-surface p-5 text-text sm:p-8">
      <div className="w-full">
        <header className="mb-7">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Historial</h1>
              <p className="mt-1 text-sm text-text-muted">
                {history.length} {history.length === 1 ? 'escaneo' : 'escaneos'}
              </p>
            </div>
          </div>

          <label className="relative block">
            <span className="sr-only">Buscar por dispositivo, alias, hostname, IP o MAC</span>
            <Search aria-hidden="true" className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por dispositivo (alias, hostname, IP o MAC)"
              className="w-full rounded-xl border border-surface-border bg-surface-light py-4 pl-12 pr-4 text-base text-text shadow-sm placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </header>

        <section aria-label="Filtros del historial" className="mb-6 flex flex-wrap items-center gap-3">
          <label className="text-sm text-text-muted">
            <span className="sr-only">Filtrar por fecha</span>
            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="rounded-lg border border-surface-border bg-surface-light px-3 py-2.5 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">Todas las fechas</option>
              {dateOptions.map((date) => (
                <option key={date} value={date}>{dayTitle(date)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-text-muted">
            <span className="sr-only">Filtrar por tipo de cambio</span>
            <select
              value={changeFilter}
              onChange={(event) => setChangeFilter(event.target.value as ChangeFilter)}
              className="rounded-lg border border-surface-border bg-surface-light px-3 py-2.5 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="all">Todos los cambios</option>
              <option value="new">Con dispositivos nuevos</option>
              <option value="absent">Con dispositivos ausentes</option>
              <option value="returned">Con dispositivos que volvieron</option>
            </select>
          </label>
          <div className="relative">
            <button
              type="button"
              aria-expanded={exportMenuOpen}
              aria-haspopup="menu"
              onClick={() => setExportMenuOpen((open) => !open)}
              disabled={history.length === 0}
              className="rounded-lg border border-primary/30 px-3 py-2.5 text-sm font-medium text-primary-light hover:bg-primary/10 disabled:opacity-50"
            >
              Exportar
            </button>
            {exportMenuOpen && (
              <div role="menu" aria-label="Formato de exportación" className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-surface-border bg-surface-light p-1 shadow-lg">
                <button type="button" role="menuitem" onClick={() => void handleExport('csv')} className="w-full rounded px-3 py-2 text-left text-sm text-text hover:bg-surface-lighter">CSV</button>
                <button type="button" role="menuitem" onClick={() => void handleExport('json')} className="w-full rounded px-3 py-2 text-left text-sm text-text hover:bg-surface-lighter">JSON</button>
              </div>
            )}
          </div>
          {(search || dateFilter || changeFilter !== 'all') && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg px-3 py-2.5 text-sm text-primary-light transition-colors hover:bg-surface-light hover:text-primary-text"
            >
              Limpiar filtros
            </button>
          )}
          {!loading && (
            <span className="ml-auto text-sm text-text-muted">
              {visibleCount} {visibleCount === 1 ? 'resultado' : 'resultados'} · {history.length} {history.length === 1 ? 'escaneo' : 'escaneos'}
            </span>
          )}
        </section>

        {chronologicalHistory.length >= 2 && (
          <section aria-label="Comparar escaneos" className="mb-6 rounded-xl border border-surface-border bg-surface-light p-5">
            <h2 className="mb-3 font-semibold text-text">Comparar escaneos</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-text-muted">
                Escaneo base
                <select value={effectiveCompareFromId} onChange={(event) => setCompareFromId(event.target.value)} className="mt-1 block w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-text">
                  {chronologicalHistory.map((scan) => <option key={scan.id} value={scan.id}>{new Date(scan.scanned_at).toLocaleString('es-ES')}</option>)}
                </select>
              </label>
              <label className="text-sm text-text-muted">
                Comparar con...
                <select value={effectiveCompareToId} onChange={(event) => setCompareToId(event.target.value)} className="mt-1 block w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-text">
                  {chronologicalHistory.map((scan) => <option key={scan.id} value={scan.id}>{new Date(scan.scanned_at).toLocaleString('es-ES')}</option>)}
                </select>
              </label>
            </div>
            {comparison ? (
              <p role="status" className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm text-text-muted">
                {comparisonSummary}
              </p>
            ) : <p role="status" className="mt-3 text-sm text-text-muted">Selecciona dos escaneos distintos para ver sus diferencias.</p>}
          </section>
        )}

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-danger-text">
            {error}
          </div>
        )}

        {loading ? (
          <div role="status" aria-live="polite" className="rounded-xl border border-surface-border bg-surface-light py-16 text-center text-text-muted">
            Cargando...
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-surface-border bg-surface-light py-16 text-center">
            <span aria-hidden="true" className="text-4xl">🌐</span>
            <p className="mt-3 font-medium text-text">No hay escaneos aún</p>
            <p className="mt-1 text-sm text-text-muted">Los escaneos completados aparecerán aquí.</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="rounded-xl border border-surface-border bg-surface-light py-16 text-center">
            <p className="font-medium text-text">No hay escaneos que coincidan</p>
            <p className="mt-1 text-sm text-text-muted">Prueba cambiando los filtros o el texto de búsqueda.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 text-sm font-medium text-primary-light hover:text-primary-text"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredGroups.map((group) => (
              <CollapsibleDay key={group.key} title={group.title} count={group.scans.length}>
                {getDayEntries(group.scans, eventsByScanId).map((entry) => {
                  if (entry.kind === 'scan') {
                    return (
                      <ScanHistoryItem
                        key={entry.scan.id}
                        scan={entry.scan}
                        events={eventsByScanId[entry.scan.id] || EMPTY_EVENTS}
                        onOpen={openDetailFromList}
                      />
                    );
                  }
                  const runKey = `${entry.scans[0].id}:${entry.scans[entry.scans.length - 1].id}`;
                  return (
                    <UnchangedScansRow
                      key={runKey}
                      scans={entry.scans}
                      expanded={Boolean(expandedRuns[runKey])}
                      onToggle={() => toggleUnchangedRun(entry.scans)}
                      onOpen={openDetailFromList}
                    />
                  );
                })}
              </CollapsibleDay>
            ))}
          </div>
        )}

      </div>

      {selectedScan && (
        <ScanDetailModal
          scan={selectedScan}
          hosts={detailHosts}
          events={eventsByScanId[selectedScan.id] || {
            newDevices: [],
            absentDevices: [],
            returnedDevices: [],
            changedPorts: [],
          }}
          devices={devices}
          onUpdateDevice={handleDeviceUpdateSafely}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
        />
      )}
    </main>
  );
}
