import { useEffect, useMemo, useState } from 'react';
import { getScanHistory, getScanHosts } from '../api/scans';
import { getDevices } from '../api/devices';
import type { Host, ScanHistoryItem } from '../types/scan.types';
import type { Device } from '../types/device.types';
import type { EventType, HistoryEvent } from '../types/history.types';
import { buildHistoryEvents } from '../utils/historyEvents';
import { ApiError } from '../errors/apiErrors';

type TypeFilter = 'all' | EventType;
type CardFilter = 'new' | 'new_untrusted' | 'absent';
type DateFilter = 'all' | 'today' | '7d' | '30d';

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Fecha desconocida';
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 45) return 'hace un momento';
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return hours === 1 ? 'hace 1h' : `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayLabel(iso: string): string {
  const day = startOfLocalDay(new Date(iso));
  const today = startOfLocalDay(new Date());
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff === 2) return 'Hace 2 días';
  return day.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function matchesSearch(event: HistoryEvent, query: string): boolean {
  if (!query) return true;
  const haystack = [
    event.device.mac,
    event.device.ip,
    event.device.hostname,
    event.device.vendor,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

const EVENT_META: Record<
  EventType,
  { icon: string; label: string; accent: string; badge: string }
> = {
  new: {
    icon: '🆕',
    label: 'Nuevo',
    accent: 'border-blue-500/30 bg-blue-500/5',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  new_untrusted: {
    icon: '⚠️',
    label: 'Nuevo',
    accent: 'border-amber-500/30 bg-amber-500/5',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  absent: {
    icon: '⚪',
    label: 'Ausente',
    accent: 'border-slate-600/40 bg-slate-700/20',
    badge: 'bg-slate-600/20 text-slate-300 border-slate-500/30',
  },
  cameback: {
    icon: '✅',
    label: 'Regresó',
    accent: 'border-emerald-500/30 bg-emerald-500/5',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
};

const TYPE_OPTIONS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'Todos los eventos' },
  { id: 'new', label: 'Nuevos' },
  { id: 'new_untrusted', label: 'No confiables' },
  { id: 'absent', label: 'Ausentes' },
];

const DATE_OPTIONS: { id: DateFilter; label: string }[] = [
  { id: 'all', label: 'Todas las fechas' },
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: 'Últimos 7 días' },
  { id: '30d', label: 'Últimos 30 días' },
];

export function History() {
  const [historial, setHistorial] = useState<ScanHistoryItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<TypeFilter>('all');
  const [fechaFiltro, setFechaFiltro] = useState<DateFilter>('all');

  useEffect(() => {
    let cancelled = false;

    const cargarHistorial = async () => {
      setCargando(true);
      setError(null);
      try {
        const datos = await getScanHistory();
        const escaneos = datos
          .slice()
          .sort((a, b) => {
            const time = new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime();
            return time !== 0 ? time : a.id - b.id;
          })
          .slice(-10);

        let hostsPorEscaneo: Host[][] = [];
        let dispositivos: Device[] = [];
        if (escaneos.length > 1) {
          [hostsPorEscaneo, dispositivos] = await Promise.all([
            Promise.all(escaneos.map((scan) => getScanHosts(scan.id))),
            getDevices(),
          ]);
        }

        const confianzaPorMac = new Map<string, boolean>(
          dispositivos.map((device): [string, boolean] => [
            device.mac.toLowerCase(),
            device.trusted,
          ])
        );
        const escaneosConHosts = escaneos.map((scan, index) => ({
          ...scan,
          hosts: (hostsPorEscaneo[index] ?? []).map((host) => ({
            ...host,
            trusted: confianzaPorMac.get(host.mac.toLowerCase()),
          })),
        }));

        if (!cancelled) setHistorial(escaneosConHosts);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('No se pudo cargar el historial');
        }
        console.error(err);
      } finally {
        if (!cancelled) setCargando(false);
      }
    };

    void cargarHistorial();
    return () => {
      cancelled = true;
    };
  }, []);

  const eventos = useMemo(() => buildHistoryEvents(historial), [historial]);

  const query = busqueda.trim().toLowerCase();
  const hayFiltros = query.length > 0 || tipoFiltro !== 'all' || fechaFiltro !== 'all';

  const eventosFiltrados = useMemo(() => {
    return eventos.filter((event) => {
      if (tipoFiltro !== 'all' && event.type !== tipoFiltro) return false;
      if (!matchesSearch(event, query)) return false;
      if (fechaFiltro !== 'all') {
        const local = new Date(event.timestamp);
        if (Number.isNaN(local.getTime())) return false;
        const now = new Date();
        if (fechaFiltro === 'today') {
          if (local < startOfLocalDay(now)) return false;
        } else {
          const days = fechaFiltro === '7d' ? 7 : 30;
          if (local.getTime() < now.getTime() - days * 86_400_000) return false;
        }
      }
      return true;
    });
  }, [eventos, tipoFiltro, query, fechaFiltro]);

  const grupos = useMemo(() => {
    const map = new Map<string, { key: string; label: string; events: HistoryEvent[] }>();
    for (const event of eventosFiltrados) {
      const key = dayKey(event.timestamp);
      const existing = map.get(key);
      if (existing) {
        existing.events.push(event);
      } else {
        map.set(key, { key, label: dayLabel(event.timestamp), events: [event] });
      }
    }
    return [...map.values()];
  }, [eventosFiltrados]);

  const counts = useMemo(
    () => ({
      new: eventos.filter((e) => e.type === 'new').length,
      new_untrusted: eventos.filter((e) => e.type === 'new_untrusted').length,
      absent: eventos.filter((e) => e.type === 'absent').length,
    }),
    [eventos]
  );

  const limpiarFiltros = () => {
    setBusqueda('');
    setTipoFiltro('all');
    setFechaFiltro('all');
  };

  const seleccionarTarjeta = (tipo: CardFilter) => {
    setTipoFiltro((prev) => (prev === tipo ? 'all' : tipo));
  };

  const cardClass = (tipo: CardFilter) =>
    `bg-slate-800 border rounded-xl p-5 text-left transition-colors ${
      tipoFiltro === tipo
        ? 'border-blue-500 ring-1 ring-blue-500/40'
        : 'border-slate-700 hover:border-slate-500'
    }`;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Historial</h1>
        <p className="text-slate-400">Eventos detectados en tus escaneos</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <button
          type="button"
          aria-pressed={tipoFiltro === 'new'}
          onClick={() => seleccionarTarjeta('new')}
          className={cardClass('new')}
        >
          <p className="text-sm text-slate-400 font-medium">🆕 Nuevos</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{counts.new}</p>
        </button>
        <button
          type="button"
          aria-pressed={tipoFiltro === 'new_untrusted'}
          onClick={() => seleccionarTarjeta('new_untrusted')}
          className={cardClass('new_untrusted')}
        >
          <p className="text-sm text-slate-400 font-medium">⚠️ No confiables</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{counts.new_untrusted}</p>
        </button>
        <button
          type="button"
          aria-pressed={tipoFiltro === 'absent'}
          onClick={() => seleccionarTarjeta('absent')}
          className={cardClass('absent')}
        >
          <p className="text-sm text-slate-400 font-medium">⚪ Ausentes</p>
          <p className="text-3xl font-bold text-slate-200 mt-1">{counts.absent}</p>
        </button>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por MAC, IP, hostname o fabricante..."
            aria-label="Buscar eventos por MAC, IP, hostname o fabricante"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value as TypeFilter)}
          className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={fechaFiltro}
          onChange={(e) => setFechaFiltro(e.target.value as DateFilter)}
          aria-label="Filtrar por fecha"
          className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
        >
          {DATE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        {hayFiltros && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
          >
            Limpiar filtros
          </button>
        )}

        <span className="text-sm text-slate-400 ml-auto">
          Mostrando {eventosFiltrados.length} de {eventos.length} eventos
        </span>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {error ? null : cargando ? (
        <div className="text-center py-16 text-slate-400">Cargando eventos...</div>
      ) : historial.length < 2 ? (
        <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
          <div className="w-16 h-16 bg-slate-700 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl">
            📭
          </div>
          <p className="text-slate-400 font-medium">No hay eventos</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Los cambios se detectan al comparar dos escaneos.
          </p>
        </div>
      ) : eventos.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
          <div className="w-16 h-16 bg-slate-700 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl">
            ✅
          </div>
          <p className="text-slate-400 font-medium">Sin cambios entre escaneos</p>
          <p className="text-sm text-slate-500 mt-1">
            No se detectaron dispositivos nuevos, ausentes o que hayan regresado.
          </p>
        </div>
      ) : eventosFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-slate-400 font-medium">No hay eventos para esos filtros</p>
          <button
            type="button"
            onClick={limpiarFiltros}
            className="mt-4 text-sm text-blue-400 hover:text-blue-300"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {grupos.map((grupo) => (
            <section key={grupo.key}>
              <div className="flex items-center gap-4 mb-4">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                  {grupo.label}
                </h2>
                <span className="text-xs text-slate-500">
                  {grupo.events.length} {grupo.events.length === 1 ? 'evento' : 'eventos'}
                </span>
                <div className="h-px flex-1 bg-slate-700" />
              </div>
              <div className="relative pl-6 border-l border-slate-700 space-y-4">
                {grupo.events.map((event) => {
                  const meta = EVENT_META[event.type];
                  const title = event.device.hostname || event.device.vendor || 'Dispositivo';
                  return (
                    <article
                      key={event.id}
                      className={`relative -ml-[1.65rem] pl-10 pr-4 py-4 rounded-xl border ${meta.accent}`}
                    >
                      <span className="absolute left-[0.35rem] top-5 w-7 h-7 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-sm">
                        {meta.icon}
                      </span>
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${meta.badge}`}
                          >
                            {meta.label}
                          </span>
                          {event.device.trusted === false && (
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20">
                              No confiable
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">{formatRelativeTime(event.timestamp)}</span>
                      </div>
                      <p className="text-white font-medium">{title}</p>
                      <p className="text-xs font-mono text-slate-400 mt-1">{event.device.mac}</p>
                      <p className="text-sm font-mono text-blue-400 mt-2">{event.device.ip || '—'}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
