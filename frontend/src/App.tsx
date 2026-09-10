import { useState } from 'react';

interface Host {
  ip: string;
  mac: string;
  vendor: string;
  hostname: string;
}

interface ScanResult {
  target: string;
  hosts: Host[];
  total_hosts: number;
  duration_seconds: number;
  scanned_at: string;
}

function App() {
  const [resultado, setResultado] = useState<ScanResult | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const escanearRed = async () => {
    setCargando(true);
    setError(null);
    setResultado(null);

    try {
      const respuesta = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!respuesta.ok) throw new Error(`Error: ${respuesta.status}`);
      const datos: ScanResult = await respuesta.json();
      setResultado(datos);
    } catch (err) {
      setError('No se pudo conectar con el servidor');
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  // Calcular estadísticas
  const fabricantes = resultado?.hosts?.reduce((acc: Record<string, number>, host) => {
    const vendor = host.vendor || 'Desconocido';
    acc[vendor] = (acc[vendor] || 0) + 1;
    return acc;
  }, {});

  const totalHosts = resultado?.hosts?.length || 0;
  const fabricantesUnicos = Object.keys(fabricantes || {}).length;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-blue-600">🔍</span> NetGuard
        </h1>
        <p className="text-gray-500 mt-1 mb-6">Escáner de red — detecta dispositivos activos</p>

        <button
          onClick={escanearRed}
          disabled={cargando}
          className={`px-6 py-3 rounded-lg text-white font-medium transition-all ${
            cargando
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
          }`}
        >
          {cargando ? '⏳ Escaneando...' : '🚀 Escanear red'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            ❌ {error}
          </div>
        )}

        {resultado && (
          <div className="mt-6">
            {/* 📊 RESUMEN / ANÁLISIS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-600 font-medium">Dispositivos</p>
                <p className="text-2xl font-bold text-blue-800">{totalHosts}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <p className="text-sm text-green-600 font-medium">Tiempo</p>
                <p className="text-2xl font-bold text-green-800">{resultado.duration_seconds?.toFixed(1)}s</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                <p className="text-sm text-purple-600 font-medium">Fabricantes únicos</p>
                <p className="text-2xl font-bold text-purple-800">{fabricantesUnicos}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                <p className="text-sm text-yellow-600 font-medium">Objetivo</p>
                <p className="text-sm font-bold text-yellow-800 truncate">{resultado.target}</p>
              </div>
            </div>

            {/* 📋 TABLA DE DISPOSITIVOS */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-700">📡 Dispositivos encontrados</h2>
                <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                  {totalHosts} dispositivos
                </span>
              </div>

              {resultado.hosts && resultado.hosts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700">
                        <th className="p-3 text-left border-b">IP</th>
                        <th className="p-3 text-left border-b">MAC</th>
                        <th className="p-3 text-left border-b">Fabricante</th>
                        <th className="p-3 text-left border-b">Hostname</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.hosts.map((host, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50 transition">
                          <td className="p-3 font-mono text-sm">{host.ip}</td>
                          <td className="p-3 font-mono text-xs text-gray-600">{host.mac}</td>
                          <td className="p-3">{host.vendor || 'Desconocido'}</td>
                          <td className="p-3 text-gray-500">{host.hostname || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-6">No se encontraron dispositivos.</p>
              )}
            </div>

            {/* 📊 ANÁLISIS POR FABRICANTE */}
            {fabricantes && Object.keys(fabricantes).length > 0 && (
              <div className="mt-6 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">🏷️ Fabricantes detectados</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(fabricantes).map(([vendor, count]) => (
                    <span
                      key={vendor}
                      className="bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-700"
                    >
                      {vendor}: {count}
                    </span>
                  ))}
                </div>

                {/* Barras visuales */}
                <div className="mt-4 space-y-1">
                  {Object.entries(fabricantes).map(([vendor, count]) => (
                    <div key={vendor} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-32 truncate">{vendor}</span>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{
                            width: `${(count / totalHosts) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detalles extra */}
            <div className="mt-4 text-xs text-gray-400 border-t pt-3 flex flex-wrap gap-4">
              <span>🎯 Objetivo: {resultado.target || 'N/A'}</span>
              <span>⏱️ {resultado.duration_seconds?.toFixed(2) || '0'}s</span>
              <span>📅 {resultado.scanned_at ? new Date(resultado.scanned_at).toLocaleString() : '—'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;