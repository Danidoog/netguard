import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
  Zap,
} from 'lucide-react';
import {
  getActiveTasks,
  getScanTask,
  getSchedulerConfig,
  triggerBackgroundScan,
  updateSchedulerConfig,
} from '../api/scheduler';
import type { ScanTask, SchedulerConfig } from '../types/scheduler.types';
import { ApiError } from '../errors/apiErrors';
import { formatDateTime, formatRelativeTime } from '../utils/format';
import { invalidateCache } from '../api/cache';

const INTERVAL_OPTIONS = [
  { value: 15, label: 'Cada 15 minutos' },
  { value: 30, label: 'Cada 30 minutos' },
  { value: 60, label: 'Cada 1 hora' },
  { value: 240, label: 'Cada 4 horas' },
  { value: 720, label: 'Cada 12 horas' },
  { value: 1440, label: 'Una vez al día (24h)' },
];

export function Settings() {
  const [config, setConfig] = useState<SchedulerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [enabled, setEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [target, setTarget] = useState('');

  // Active background task state
  const [activeTask, setActiveTask] = useState<ScanTask | null>(null);
  const [launchingScan, setLaunchingScan] = useState(false);
  const pollIntervalRef = useRef<number | null>(null);

  const refreshConfig = async () => {
    try {
      const data = await getSchedulerConfig();
      setConfig(data);
      setEnabled(data.enabled);
      setIntervalMinutes(data.interval_minutes);
      setTarget(data.target || '');
    } catch {
      // silently ignore refresh error
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function initSettings() {
      try {
        const [configData, tasks] = await Promise.all([
          getSchedulerConfig(),
          getActiveTasks().catch(() => []),
        ]);
        if (cancelled) return;

        setConfig(configData);
        setEnabled(configData.enabled);
        setIntervalMinutes(configData.interval_minutes);
        setTarget(configData.target || '');

        const running = tasks.find((t) => t.status === 'pending' || t.status === 'running');
        if (running) {
          setActiveTask(running);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof ApiError ? err.message : 'No se pudo cargar la configuración.';
          setError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll active task until completion
  useEffect(() => {
    if (!activeTask || activeTask.status === 'completed' || activeTask.status === 'failed') {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const taskId = activeTask.id;
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const updated = await getScanTask(taskId);
        setActiveTask(updated);

        if (updated.status === 'completed') {
          invalidateCache('scan-history:');
          invalidateCache('devices');
          setSuccessMessage('¡Escaneo en segundo plano completado con éxito!');
          setTimeout(() => setSuccessMessage(null), 5000);
          void refreshConfig();
        } else if (updated.status === 'failed') {
          const errMsg = updated.error?.message || 'El escaneo en segundo plano falló.';
          setError(`Fallo en escaneo: ${errMsg}`);
        }
      } catch {
        // ignore polling failure
      }
    }, 2500);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [activeTask]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const updated = await updateSchedulerConfig({
        enabled,
        interval_minutes: intervalMinutes,
        target: target.trim() === '' ? null : target.trim(),
      });

      setConfig(updated);
      setSuccessMessage('Configuración guardada exitosamente.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al guardar la configuración.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    try {
      setSaving(true);
      setError(null);
      const updated = await updateSchedulerConfig({
        enabled: nextEnabled,
        interval_minutes: intervalMinutes,
        target: target.trim() === '' ? null : target.trim(),
      });
      setConfig(updated);
      setSuccessMessage(
        nextEnabled
          ? 'Escaneos de fondo activados correctamente.'
          : 'Escaneos de fondo desactivados.'
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setEnabled(!nextEnabled); // revertir en caso de error
      const msg = err instanceof ApiError ? err.message : 'Error al cambiar estado de escaneos de fondo.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerNow = async () => {
    try {
      setLaunchingScan(true);
      setError(null);
      setSuccessMessage(null);

      const task = await triggerBackgroundScan(target.trim() === '' ? null : target.trim());
      setActiveTask(task);
      setSuccessMessage('Tarea de escaneo en segundo plano iniciada.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo iniciar el escaneo de fondo.';
      setError(msg);
    } finally {
      setLaunchingScan(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-text-muted">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Cargando panel de configuración...</span>
        </div>
      </div>
    );
  }

  const isScanning = activeTask?.status === 'pending' || activeTask?.status === 'running';

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-8 py-6">
      {/* Encabezado */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary-light">
            <SettingsIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Configuración del Sistema</h1>
            <p className="text-sm text-text-muted">
              Gestiona los escaneos automatizados y los parámetros del servicio NetGuard.
            </p>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Banner de escaneo activo en segundo plano */}
      {isScanning && (
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary-light">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin shrink-0 text-primary-light" />
            <div>
              <p className="font-semibold text-text">
                Escaneo en segundo plano en ejecución...
              </p>
              <p className="text-xs text-text-muted">
                {activeTask?.target ? `Objetivo: ${activeTask.target}` : 'Descubriendo subred local'} · ID: {activeTask?.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary-light">
            {activeTask?.status === 'pending' ? 'En cola' : 'Escaneando'}
          </span>
        </div>
      )}

      {/* Tarjeta de Escaneos de Fondo */}
      <div className="rounded-xl border border-surface-border bg-surface-light p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-6 border-b border-surface-border pb-6 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary-light" />
              <h2 className="text-lg font-semibold text-text">Escaneo de Fondo (Segundo Plano)</h2>
            </div>
            <p className="text-sm text-text-muted">
              Descubrimiento automatizado y continuo de dispositivos sin necesidad de intervención manual.
            </p>
          </div>

          {/* Grupo de Botones de Activación */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Botón de acción directo para activar / desactivar */}
            <button
              type="button"
              disabled={saving}
              onClick={handleToggle}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                enabled
                  ? 'border border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400 focus:ring-red-500'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 focus:ring-emerald-600'
              } disabled:opacity-50`}
              title={enabled ? 'Pausar escaneos automáticos de fondo' : 'Activar escaneos automáticos de fondo'}
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : enabled ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span>{enabled ? 'Desactivar escaneos de fondo' : 'Activar escaneos de fondo'}</span>
            </button>

            {/* Interruptor tipo Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={enabled ? 'Desactivar escaneos de fondo' : 'Activar escaneos de fondo'}
              disabled={saving}
              onClick={handleToggle}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                enabled ? 'bg-primary' : 'bg-surface-lighter'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Formulario de opciones */}
        <form onSubmit={handleSave} className="mt-6 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Intervalo de escaneo */}
            <div className="space-y-2">
              <label htmlFor="interval-select" className="text-sm font-medium text-text">
                Frecuencia de escaneo
              </label>
              <select
                id="interval-select"
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                disabled={saving}
                className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-text transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-muted">
                Intervalo entre escaneos automáticos cuando el servicio está activo.
              </p>
            </div>

            {/* Red objetivo opcional */}
            <div className="space-y-2">
              <label htmlFor="target-input" className="text-sm font-medium text-text">
                Red Objetivo (opcional)
              </label>
              <div className="relative">
                <input
                  id="target-input"
                  type="text"
                  placeholder="Auto (detectar red local)"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <p className="text-xs text-text-muted">
                Dejar vacío para escanear automáticamente la subred local actual.
              </p>
            </div>
          </div>

          {/* Tarjeta de estado del programador */}
          <div className="grid gap-4 rounded-lg bg-surface p-4 sm:grid-cols-3">
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
                <Activity className="h-3.5 w-3.5" /> Estado del motor
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    enabled ? 'bg-emerald-500 animate-pulse' : 'bg-surface-border'
                  }`}
                />
                <p className="text-sm font-semibold text-text">
                  {enabled ? 'Escaneos periódicos activos' : 'Escaneos en pausa'}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
                <Calendar className="h-3.5 w-3.5" /> Último escaneo
              </span>
              <p className="text-sm font-semibold text-text">
                {config?.last_run_at ? formatRelativeTime(config.last_run_at) : 'Aún no ejecutado'}
              </p>
              {config?.last_run_at && (
                <p className="text-xs text-text-muted">{formatDateTime(config.last_run_at)}</p>
              )}
            </div>

            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
                <Clock className="h-3.5 w-3.5" /> Próximo escaneo
              </span>
              <p className="text-sm font-semibold text-text">
                {enabled && config?.next_run_at
                  ? formatRelativeTime(config.next_run_at)
                  : 'Desactivado'}
              </p>
              {enabled && config?.next_run_at && (
                <p className="text-xs text-text-muted">{formatDateTime(config.next_run_at)}</p>
              )}
            </div>
          </div>

          {/* Acciones del pie de formulario */}
          <div className="flex flex-col-reverse justify-between gap-3 pt-2 sm:flex-row sm:items-center">
            {/* Botón para disparar un escaneo en segundo plano bajo demanda */}
            <button
              type="button"
              disabled={launchingScan || isScanning}
              onClick={handleTriggerNow}
              className="flex items-center justify-center gap-2 rounded-lg border border-surface-border bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-lighter hover:text-text focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              title="Inicia un escaneo en segundo plano inmediatamente sin esperar al temporizador"
            >
              {launchingScan || isScanning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-primary-light" />
                  <span>Escaneo en curso...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>Ejecutar escaneo de fondo ahora</span>
                </>
              )}
            </button>

            {/* Botón de guardado de configuración */}
            <div className="flex justify-end gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50 shadow-sm"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Guardar cambios</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
