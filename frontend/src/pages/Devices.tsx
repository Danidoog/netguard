import { useEffect, useState } from 'react';
import { getDevices, updateDevice } from '../api/devices';
import type { Device, DeviceUpdate } from '../types/device.types';
import { DevicesTable } from '../components/DevicesTable';
import { ApiError } from '../errors/apiErrors';

export function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      console.error('Error actualizando dispositivo:', err);
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  };

  const total = devices.length;
  const nuevos = devices.filter((d) => d.is_new).length;
  const presentes = devices.filter((d) => d.is_present).length;
  const confiables = devices.filter((d) => d.trusted).length;

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-sm text-slate-400 font-medium">Total</p>
          <p className="text-3xl font-bold text-white mt-1">{total}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-sm text-slate-400 font-medium">Nuevos</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{nuevos}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-sm text-slate-400 font-medium">Presentes</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{presentes}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <p className="text-sm text-slate-400 font-medium">Confiables</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">{confiables}</p>
        </div>
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
            <DevicesTable devices={devices} onUpdate={handleUpdate} />
          )}
        </div>
      </div>
    </div>
  );
}