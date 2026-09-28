import { useEffect, useState, useMemo } from 'react';
import {
  getScanHistory,
  getScanDetail,
  getScanHosts,
} from '../api/scans';
import type {
  ScanHistoryItem,
  ScanResult,
  Host,
} from '../types/scan.types';
import { DeviceTable } from '../components/DeviceTable';
import { ApiError } from '../errors/apiErrors';

export function History() {
  const [historial, setHistorial] = useState<ScanHistoryItem[]>([]);
  const [detalle, setDetalle] = useState<ScanResult | null>(null);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  // ✅ Estados para búsqueda y filtros
  const [busqueda, setBusqueda] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState('');

  useEffect(() => {
    cargarHistorial();
  }, []);

  const cargarHistorial = async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await getScanHistory();
      setHistorial(datos);
    } catch (err) {
      // ✅ Manejo específico de errores
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudo cargar el historial');
      }
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const verDetalle = async (id: number) => {
    setErrorDetalle(null);
    try {
      const [detalleData, hostsData] = await Promise.all([
        getScanDetail(id),
        getScanHosts(id),
      ]);
      setDetalle(detalleData);
      setHosts(hostsData);
    } catch (err) {
      // ✅ Manejo específico de errores en el modal
      if (err instanceof ApiError) {
        setErrorDetalle(err.message);
      } else {
        setErrorDetalle('No se pudo cargar el detalle del escaneo');
      }
      console.error('Error cargando detalle:', err);
    }
  };

  const cerrarModal = () => {
    setDetalle(null);
    setHosts([]);
    setErrorDetalle(null);
  };

  // Filtrar historial según búsqueda y fecha
  
  const historialFiltrado = useMemo(() => {
    return historial.filter((item) => {
      const coincideBusqueda = item.target
        .toLowerCase()
        .includes(busqueda.toLowerCase());

      let coincideFecha = true;
      if (fechaFiltro) {
        const fechaItem = new Date(item.scanned_at).toISOString().split('T')[0];
        coincideFecha = fechaItem === fechaFiltro;
      }

      return coincideBusqueda && coincideFecha;
    });
  }, [historial, busqueda, fechaFiltro]);

  const limpiarFiltros = () => {
    setBusqueda('');
    setFechaFiltro('');
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Historial</h1>
        <p className="text-slate-400">Todos los escaneos realizados</p>
      </div>

      {/* Barra de filtros */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[250px]">
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
            placeholder="Buscar por objetivo..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <input
          type="date"
          value={fechaFiltro}
          onChange={(e) => setFechaFiltro(e.target.value)}
          className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
        />

        {(busqueda || fechaFiltro) && (
          <button
            onClick={limpiarFiltros}
            className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
          >
            Limpiar filtros
          </button>
        )}

        <span className="text-sm text-slate-400 ml-auto">
          Mostrando {historialFiltrado.length} de {historial.length}
        </span>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tabla */}
      {cargando ? (
        <div className="text-center py-16 text-slate-400">Cargando...</div>
      ) : historialFiltrado.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-slate-400 font-medium">
            {historial.length === 0
              ? 'No hay escaneos en el historial'
              : 'No se encontraron resultados para tu búsqueda'}
          </p>
          {historial.length > 0 && (
            <button
              onClick={limpiarFiltros}
              className="mt-4 text-sm text-blue-400 hover:text-blue-300"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">ID</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Objetivo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Dispositivos</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Duración</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Fecha</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {historialFiltrado.map((item) => (
                <tr key={item.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="py-3 px-4 font-mono text-blue-400">#{item.id}</td>
                  <td className="py-3 px-4 text-slate-200">{item.target}</td>
                  <td className="py-3 px-4 text-slate-200">{item.total_hosts}</td>
                  <td className="py-3 px-4 text-slate-400">
                    {item.duration_seconds?.toFixed(1)}s
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {item.scanned_at
                      ? new Date(item.scanned_at).toLocaleString()
                      : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => verDetalle(item.id)}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de detalle */}
      {detalle && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={cerrarModal}
        >
          <div
            className="bg-slate-800 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Detalle del escaneo
                </h2>
                <p className="text-sm text-slate-400 mt-1">{detalle.target}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {hosts.length} dispositivos · {detalle.duration_seconds?.toFixed(1)}s
                </p>
              </div>
              <button
                onClick={cerrarModal}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* ✅ Error dentro del modal */}
            {errorDetalle && (
              <div className="m-4 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
                {errorDetalle}
              </div>
            )}

            <div className="p-4">
              <DeviceTable hosts={hosts} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}