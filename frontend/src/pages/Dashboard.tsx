import { useState, useEffect } from 'react';
import { StatCard } from '../components/StatCard';
import { DeviceTable } from '../components/DeviceTable';
import { createScan, getScanHistory } from '../api/scans';
import type { ScanResult } from '../types/scan.types';
import { ApiError } from '../errors/apiErrors';

export function Dashboard() {
  const [resultado, setResultado] = useState<ScanResult | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargarUltimoEscaneo();
  }, []);

  const cargarUltimoEscaneo = async () => {
    try {
      const historial = await getScanHistory();
      if (historial.length > 0) {
        setResultado(historial[0] as any);
      }
    } catch (err) {
      console.error('Error cargando último escaneo:', err);
    }
  };

  const escanearRed = async () => {
    setCargando(true);
    setError(null);
    try {
      await createScan();
      const historial = await getScanHistory();
      if (historial.length > 0) {
        setResultado(historial[0] as any);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Ocurrió un error inesperado');
      }
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  const fabricantes = resultado?.hosts?.reduce((acc: Record<string, number>, host) => {
    const vendor = host.vendor || 'Desconocido';
    acc[vendor] = (acc[vendor] || 0) + 1;
    return acc;
  }, {}) || {};

  return (
    <div className="p-8">
      {/*  OVERLAY DE CARGA */}
      {cargando && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center max-w-sm shadow-2xl">
            {/* Spinner */}
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin" />
              <div className="absolute inset-2 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl">📡</span>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-white mb-2">
              Escaneando red...
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Esto puede tardar unos segundos. Por favor espera.
            </p>

            {/* Barra de progreso animada */}
            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden relative">
              <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full w-1/2 animate-progress" />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-slate-400">Vista general del escaneo de red</p>
        </div>
        <button
          onClick={escanearRed}
          disabled={cargando}
          className={`px-6 py-3 rounded-lg font-medium text-sm transition-all ${cargando
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
        >
          {cargando ? 'Escaneando...' : 'Iniciar escaneo'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tarjetas */}
      {resultado && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard label="Dispositivos" value={resultado.total_hosts} icon="📡" color="blue" />
          <StatCard label="Tiempo de escaneo" value={`${resultado.duration_seconds?.toFixed(1)}s`} icon="⏱️" color="green" />
          <StatCard label="Fabricantes únicos" value={Object.keys(fabricantes).length} icon="🏷️" color="purple" />
          <StatCard label="Objetivo" value={resultado.target} icon="🎯" color="amber" />
        </div>
      )}

      {/* Tabla */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Dispositivos encontrados</h2>
            <p className="text-sm text-slate-400 mt-1">
              {resultado ? `${resultado.total_hosts} dispositivos en la red` : 'Sin datos aún'}
            </p>
          </div>
          {resultado && (
            <span className="text-xs font-medium bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full border border-blue-500/20">
              {resultado.total_hosts} dispositivos
            </span>
          )}
        </div>
        <div className="p-2">
          {resultado ? (
            <DeviceTable hosts={resultado.hosts} />
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-700 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-slate-400 font-medium">No hay datos para mostrar</p>
              <p className="text-sm text-slate-500 mt-1">Inicia un escaneo para ver los dispositivos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}