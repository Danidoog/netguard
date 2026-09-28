import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  Area,
  AreaChart,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getScanHistory } from '../api/scans';
import type { ScanHistoryItem, Host } from '../types/scan.types';
import { ApiError } from '../errors/apiErrors';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export function Analytics() {
  const [historial, setHistorial] = useState<ScanHistoryItem[]>([]);
  const [fabricantes, setFabricantes] = useState<{ name: string; value: number; percentage: number }[]>([]);
  const [topDispositivos, setTopDispositivos] = useState<{ ip: string; apariciones: number }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await getScanHistory();
      setHistorial(datos as any);

      // Contar fabricantes
      const contadorVendors: Record<string, number> = {};
      // Contar apariciones de cada IP
      const contadorIPs: Record<string, number> = {};
      let totalHosts = 0;

      datos.forEach((scan: any) => {
        if (scan.hosts && Array.isArray(scan.hosts)) {
          scan.hosts.forEach((host: Host) => {
            const vendor = host.vendor || 'Desconocido';
            contadorVendors[vendor] = (contadorVendors[vendor] || 0) + 1;

            contadorIPs[host.ip] = (contadorIPs[host.ip] || 0) + 1;
            totalHosts++;
          });
        }
      });

      // Calcular porcentajes de fabricantes
      const fabricantesArray = Object.entries(contadorVendors)
        .map(([name, value]) => ({
          name,
          value,
          percentage: totalHosts > 0 ? (value / totalHosts) * 100 : 0,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      setFabricantes(fabricantesArray);

      // Top 5 dispositivos con más apariciones
      const topIPs = Object.entries(contadorIPs)
        .map(([ip, apariciones]) => ({ ip, apariciones }))
        .sort((a, b) => b.apariciones - a.apariciones)
        .slice(0, 5);

      setTopDispositivos(topIPs);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudieron cargar las estadísticas');
      }
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  // Ordenar por fecha real (cronológicamente)
  const escaneosOrdenados = [...historial].sort(
    (a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime()
  );

  // Escaneos por día
  const escaneosPorDia = escaneosOrdenados.reduce((acc: Record<string, number>, item) => {
    const fecha = new Date(item.scanned_at).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
    });
    acc[fecha] = (acc[fecha] || 0) + 1;
    return acc;
  }, {});

  const datosPorDia = Object.entries(escaneosPorDia).map(([fecha, cantidad]) => ({
    fecha,
    cantidad,
  }));

  // Dispositivos por escaneo (con fecha, hora y duración)
  const datosDispositivos = escaneosOrdenados.slice(-10).map((item) => {
    const fecha = new Date(item.scanned_at);
    return {
      id: `#${item.id}`,
      fecha: fecha.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
      }),
      hora: fecha.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      dispositivos: item.total_hosts,
      duracion: item.duration_seconds,
    };
  });

  // Estadísticas generales
  const totalEscaneos = historial.length;
  const totalDispositivos = historial.reduce((acc, item) => acc + item.total_hosts, 0);
  const duracionPromedio =
    historial.length > 0
      ? historial.reduce((acc, item) => acc + item.duration_seconds, 0) / historial.length
      : 0;
  const promedioDispositivos =
    historial.length > 0 ? totalDispositivos / historial.length : 0;
  const maxDispositivos = historial.length > 0
    ? Math.max(...historial.map((h) => h.total_hosts))
    : 0;
  const minDispositivos = historial.length > 0
    ? Math.min(...historial.map((h) => h.total_hosts))
    : 0;

  if (cargando) {
    return (
      <div className="p-8">
        <div className="text-center py-16 text-slate-400">Cargando estadísticas...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Estadísticas</h1>
        <p className="text-slate-400">Análisis de tus escaneos de red</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {historial.length === 0 ? (
        <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
          <p className="text-slate-400 font-medium">No hay datos para analizar</p>
          <p className="text-sm text-slate-500 mt-1">
            Realiza al menos un escaneo para ver las estadísticas
          </p>
        </div>
      ) : (
        <>
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400 font-medium">Total de escaneos</p>
                <span className="text-xs text-slate-500">histórico</span>
              </div>
              <p className="text-3xl font-bold text-white mt-1">{totalEscaneos}</p>
              <p className="text-xs text-slate-500 mt-1">
                {promedioDispositivos.toFixed(1)} dispositivos promedio
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400 font-medium">Dispositivos totales</p>
                <span className="text-xs text-slate-500">únicos + repetidos</span>
              </div>
              <p className="text-3xl font-bold text-white mt-1">{totalDispositivos}</p>
              <p className="text-xs text-slate-500 mt-1">
                Máx: {maxDispositivos} · Mín: {minDispositivos}
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400 font-medium">Promedio por escaneo</p>
                <span className="text-xs text-slate-500">dispositivos</span>
              </div>
              <p className="text-3xl font-bold text-white mt-1">
                {promedioDispositivos.toFixed(1)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Por cada escaneo realizado
              </p>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400 font-medium">Duración promedio</p>
                <span className="text-xs text-slate-500">por escaneo</span>
              </div>
              <p className="text-3xl font-bold text-white mt-1">
                {duracionPromedio.toFixed(1)}s
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Tiempo medio de escaneo
              </p>
            </div>
          </div>

          {/* Gráficos en grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Gráfico de barras: Escaneos por día */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Escaneos por día</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Cantidad de escaneos realizados cada día
                  </p>
                </div>
                <span className="text-xs bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20">
                  {datosPorDia.length} días
                </span>
              </div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={datosPorDia}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="fecha"
                      stroke="#94a3b8"
                      fontSize={12}
                      label={{
                        value: 'Fecha',
                        position: 'insideBottom',
                        offset: -5,
                        fill: '#64748b',
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      label={{
                        value: 'Escaneos',
                        angle: -90,
                        position: 'insideLeft',
                        fill: '#64748b',
                        fontSize: 11,
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        padding: '12px',
                      }}
                      formatter={(value: any) => [
                        `${value} ${value === 1 ? 'escaneo' : 'escaneos'}`,
                        'Cantidad',
                      ]}
                      labelFormatter={(label) => `📅 ${label}`}
                    />
                    <Bar dataKey="cantidad" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico de área: Dispositivos por escaneo */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Dispositivos por escaneo</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Últimos 10 escaneos · Promedio: {promedioDispositivos.toFixed(1)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
                    Máx: {maxDispositivos}
                  </span>
                  <span className="text-xs bg-red-500/10 text-red-400 px-3 py-1 rounded-full border border-red-500/20">
                    Mín: {minDispositivos}
                  </span>
                </div>
              </div>

              {/* Leyenda personalizada */}
              <div className="flex items-center gap-4 mb-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 bg-emerald-500" />
                  <span className="text-slate-400">Dispositivos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5 border-t-2 border-dashed border-amber-500" />
                  <span className="text-slate-400">Promedio ({promedioDispositivos.toFixed(1)})</span>
                </div>
              </div>

              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <AreaChart data={datosDispositivos}>
                    <defs>
                      <linearGradient id="colorDispositivos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />

                    <XAxis
                      dataKey="hora"
                      stroke="#94a3b8"
                      fontSize={11}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      label={{
                        value: 'Hora del escaneo',
                        position: 'insideBottom',
                        offset: -45,
                        fill: '#64748b',
                        fontSize: 11,
                      }}
                    />

                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      domain={[0, 'dataMax + 2']}
                      label={{
                        value: 'Dispositivos',
                        angle: -90,
                        position: 'insideLeft',
                        fill: '#64748b',
                        fontSize: 11,
                      }}
                    />

                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f1f5f9',
                        padding: '12px',
                      }}
                      formatter={(value: any) => [`${value} dispositivos`, 'Cantidad']}
                      labelFormatter={(_, payload) => {
                        if (payload && payload[0]) {
                          const data = payload[0].payload;
                          const diff = data.dispositivos - promedioDispositivos;
                          const diffText = diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
                          const diffColor = diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#94a3b8';
                          const diffIcon = diff > 0 ? '📈' : diff < 0 ? '📉' : '➡️';

                          return (
                            <div>
                              <div>📅 {data.fecha} · {data.hora}</div>
                              <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                                ⏱️ Duración: {data.duracion.toFixed(1)}s
                              </div>
                              <div style={{ color: diffColor, fontSize: '11px', marginTop: '4px' }}>
                                {diffIcon} vs promedio: {diffText}
                              </div>
                            </div>
                          );
                        }
                        return '';
                      }}
                    />

                    <ReferenceLine
                      y={promedioDispositivos}
                      stroke="#f59e0b"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                    />

                    <Area
                      type="monotone"
                      dataKey="dispositivos"
                      stroke="#10b981"
                      strokeWidth={3}
                      fill="url(#colorDispositivos)"
                      dot={{
                        fill: '#10b981',
                        r: 5,
                        strokeWidth: 2,
                        stroke: '#0f172a',
                      }}
                      activeDot={{
                        r: 8,
                        fill: '#10b981',
                        stroke: '#fff',
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Fabricantes con porcentajes */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Fabricantes más comunes</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Top 6 fabricantes encontrados en todos los escaneos
                </p>
              </div>
              <span className="text-xs bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full border border-purple-500/20">
                {fabricantes.length} fabricantes
              </span>
            </div>

            {fabricantes.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                No hay datos de fabricantes disponibles
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={fabricantes}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                        paddingAngle={2}
                      >
                        {fabricantes.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                        }}
                        formatter={(value: any, name: any, props: any) => [
                          `${value} dispositivos (${props.payload.percentage.toFixed(1)}%)`,
                          name,
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {fabricantes.map((f, i) => (
                    <div key={f.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="text-sm text-slate-300 truncate max-w-[200px]">
                            {f.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            {f.percentage.toFixed(1)}%
                          </span>
                          <span className="text-sm font-semibold text-white w-8 text-right">
                            {f.value}
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${f.percentage}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top dispositivos más vistos */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Dispositivos más vistos</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Dispositivos que aparecen con más frecuencia en los escaneos
                </p>
              </div>
              <span className="text-xs bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20">
                Top 5
              </span>
            </div>

            {topDispositivos.length === 0 ? (
              <p className="text-slate-500 text-center py-8">
                No hay dispositivos para mostrar
              </p>
            ) : (
              <div className="space-y-2">
                {topDispositivos.map((d, i) => (
                  <div
                    key={d.ip}
                    className="flex items-center gap-4 p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="text-sm font-bold text-slate-500 w-6">
                      #{i + 1}
                    </span>
                    <span className="font-mono text-sm text-blue-400 flex-1">
                      {d.ip}
                    </span>
                    <div className="flex-1 max-w-xs">
                      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                          style={{
                            width: `${(d.apariciones / topDispositivos[0].apariciones) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">
                      {d.apariciones} {d.apariciones === 1 ? 'vez' : 'veces'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}