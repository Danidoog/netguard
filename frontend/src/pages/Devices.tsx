import { useEffect, useMemo, useState } from 'react';
import { getDevices, updateDevice } from '../api/devices';
import type { Device, DeviceUpdate } from '../types/device.types';
import { DevicesTable } from '../components/DevicesTable';
import { DeviceDetailModal } from '../components/DeviceDetailModal';
import { ApiError } from '../errors/apiErrors';

type StatusFilter = 'all' | 'new' | 'known' | 'absent' | 'trusted' | 'present';

const STATUS_CHIPS: { id: Exclude<StatusFilter, 'present'>; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'new', label: 'Nuevos' },
  { id: 'known', label: 'Conocidos' },
  { id: 'absent', label: 'Ausentes' },
  { id: 'trusted', label: 'Confiables' },
];

function matchesSearch(device: Device, query: string): boolean {
  if (!query) return true;
  const haystack = [
    device.mac,
    device.last_ip,
    device.alias,
    device.vendor,
    device.last_hostname,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function matchesStatus(device: Device, filter: StatusFilter): boolean {
  switch (filter) {
    case 'new':
      return device.is_new;
    case 'known':
      return device.is_present && !device.is_new;
    case 'absent':
      return !device.is_present;
    case 'trusted':
      return device.trusted;
    case 'present':
      return device.is_present;
    default:
      return true;
  }
}

export function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<StatusFilter>('all');
  const [seleccionado, setSeleccionado] = useState<Device | null>(null);

  useEffect(() => {
    cargarDevices();
  }, []);

  const cargarDevices = async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await getDevices();
      setDevices(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudieron cargar los dispositivos');
      }
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const handleUpdate = async (mac: string, data: DeviceUpdate) => {
    try {
      const updated = await updateDevice(mac, data);
      setDevices((prev) => prev.map((d) => (d.mac === mac ? updated : d)));
      setSeleccionado((prev) => (prev?.mac === mac ? updated : prev));
    } catch (err) {
      console.error('Error actualizando dispositivo:', err);
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  };

  const query = busqueda.trim().toLowerCase();
  const hayFiltros = query.length > 0 || filtro !== 'all';

  const filtrados = useMemo(
    () => devices.filter((d) => matchesStatus(d, filtro) && matchesSearch(d, query)),
    [devices, filtro, query]
  );

  const total = devices.length;
  const nuevos = devices.filter((d) => d.is_new).length;
  const presentes = devices.filter((d) => d.is_present).length;
  const confiables = devices.filter((d) => d.trusted).length;

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltro('all');
  };

  const cardClass = (active: boolean) =>
    `bg-slate-800 border rounded-xl p-5 text-left transition-all ${
      active
        ? 'border-blue-500 ring-1 ring-blue-500/40'
        : 'border-slate-700 hover:border-slate-500'
    }`;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dispositivos</h1>
        <p className="text-slate-400">Inventario de dispositivos detectados en la red</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <button type="button" onClick={() => setFiltro('all')} className={cardClass(filtro === 'all')}>
          <p className="text-sm text-slate-400 font-medium">Total</p>
          <p className="text-3xl font-bold text-white mt-1">{total}</p>
        </button>
        <button type="button" onClick={() => setFiltro('new')} className={cardClass(filtro === 'new')}>
          <p className="text-sm text-slate-400 font-medium">Nuevos</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{nuevos}</p>
        </button>
        <button
          type="button"
          onClick={() => setFiltro('present')}
          className={cardClass(filtro === 'present')}
        >
          <p className="text-sm text-slate-400 font-medium">Presentes</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{presentes}</p>
        </button>
        <button
          type="button"
          onClick={() => setFiltro('trusted')}
          className={cardClass(filtro === 'trusted')}
        >
          <p className="text-sm text-slate-400 font-medium">Confiables</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">{confiables}</p>
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
            placeholder="Buscar por MAC, IP, alias, fabricante o hostname..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFiltro(chip.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filtro === chip.id
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

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
          Mostrando {filtrados.length} de {total} dispositivos
        </span>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Inventario</h2>
          <p className="text-sm text-slate-400 mt-1">
            {cargando ? 'Cargando...' : `${total} dispositivos registrados`}
          </p>
        </div>
        <div className="p-2">
          {cargando ? (
            <div className="text-center py-16 text-slate-400">Cargando...</div>
          ) : (
            <DevicesTable
              devices={filtrados}
              onUpdate={handleUpdate}
              onRowClick={setSeleccionado}
              emptyMessage={
                devices.length === 0 ? undefined : 'Ningún dispositivo coincide con los filtros'
              }
            />
          )}
        </div>
      </div>

      {seleccionado && (
        <DeviceDetailModal device={seleccionado} onClose={() => setSeleccionado(null)} />
      )}
    </div>
  );
}
