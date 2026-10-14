import { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  MessageCircle,
  RotateCcw,
  UserMinus,
  UserPlus,
  Undo2,
} from 'lucide-react';
import { DeviceDetailModal } from '../components/DeviceDetailModal';
import { ReviewCard } from '../components/ReviewCard';
import { ScanProgressOverlay } from '../components/ScanProgressOverlay';
import { createScan, getAllScanHistory } from '../api/scans';
import { getDevices, updateDevice } from '../api/devices';
import type { Device } from '../types/device.types';
import type { Host, ScanHistoryItem, ScanResult } from '../types/scan.types';
import { ApiError } from '../errors/apiErrors';
import { getNetworkHealth, isReallyNew } from '../utils/deviceHelpers';
import { Tooltip } from '../components/Tooltip';
import { calculateScanEvents } from '../utils/scanEvents';
import { formatRelativeTime } from '../utils/format';
import { getDeviceStats } from '../utils/deviceStats';
import type { BackendStatus } from '../hooks/useBackendStatus';
import { GlossaryInfo } from '../components/GlossaryInfo';

interface DashboardProps {
  onNavigate: (view: string) => void;
  isOnline: boolean;
  backendStatus: BackendStatus;
  onRecheckBackend: () => Promise<void>;
}

interface DashboardAlert {
  type: 'danger' | 'warning' | 'info';
  message: string;
  action?: {
    label: string;
    view: string;
  };
}

function asScanResult(scan: ScanHistoryItem): ScanResult {
  return {
    target: scan.target,
    hosts: scan.hosts || [],
    total_hosts: scan.total_hosts,
    duration_seconds: scan.duration_seconds,
    scanned_at: scan.scanned_at,
  };
}

export function Dashboard({ onNavigate, isOnline, backendStatus, onRecheckBackend }: DashboardProps) {
  const [resultado, setResultado] = useState<ScanResult | null>(null);
  const [historial, setHistorial] = useState<ScanHistoryItem[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesLoadError, setDevicesLoadError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [startTime, setStartTime] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const activeScanRef = useRef(false);
  const cancelledScanRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reviewCardRef = useRef<HTMLElement | null>(null);
  const [selectedMac, setSelectedMac] = useState<string | null>(null);
  const [undoDevice, setUndoDevice] = useState<Device | null>(null);
  useEffect(() => {
    let cancelled = false;

    async function cargarDashboard() {
      try {
        const [scans, knownDevices] = await Promise.all([getAllScanHistory(), getDevices()]);
        if (cancelled) return;
        setHistorial(scans);
        setDevices(knownDevices);
        if (scans.length > 0) setResultado(asScanResult(scans[0]));
        setDevicesLoadError(null);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof ApiError ? err.message : 'No se pudo cargar el dashboard.';
          setError(message);
          setDevicesLoadError('No se pudieron cargar los dispositivos.');
          console.error('Error cargando el dashboard:', err);
        }
      } finally {
        if (!cancelled) setDevicesLoading(false);
      }
    }

    void cargarDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!undoDevice) return;
    const timer = window.setTimeout(() => setUndoDevice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [undoDevice]);

  useEffect(() => {
    if (!cargando) return;
    const intervalId = window.setInterval(() => {
      setProgreso((current) => {
        if (current >= 95) return 95;
        if (current < 60) return Math.min(60, current + 2);
        if (current < 85) return Math.min(85, current + 1);
        if (current < 90) return Math.min(90, current + 0.5);
        return Math.min(95, current + 0.2);
      });
    }, 500);
    return () => window.clearInterval(intervalId);
  }, [cargando]);

  const escanearRed = async () => {
    if (activeScanRef.current) return;
    activeScanRef.current = true;
    cancelledScanRef.current = false;
    setCargando(true);
    setProgreso(0);
    setStartTime(Date.now());
    setError(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const scan = await createScan({ signal: controller.signal });
      if (cancelledScanRef.current) return;
      setProgreso(100);
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      if (cancelledScanRef.current) return;
      setResultado(scan);
      await onRecheckBackend();
      const [scans, knownDevices] = await Promise.all([getAllScanHistory(), getDevices()]);
      setHistorial(scans);
      setDevices(knownDevices);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (err instanceof ApiError) {
        if (err.code === 'NETWORK_ERROR' || err.type === 'NETWORK_ERROR' || err.code === 'TIMEOUT') {
          setError('No se pudo conectar con el servidor. Verifica que el backend esté corriendo.');
        } else if (err.code === 'INVALID_TARGET') {
          setError('La red especificada no es válida. Verifica el formato (ej: 192.168.0.0/24).');
        } else if (err.code === 'SCAN_TIMEOUT') {
          setError('El escaneo tardó demasiado. Intenta escanear un rango más pequeño.');
        } else if (err.code === 'NMAP_NOT_FOUND') {
          setError('Nmap no está instalado en el servidor. Contacta al administrador.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Ocurrió un error inesperado');
      }
      console.error(err);
    } finally {
      activeScanRef.current = false;
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setCargando(false);
      setProgreso(0);
      setStartTime(undefined);
    }
  };

  const cancelScanDisplay = () => {
    cancelledScanRef.current = true;
    abortControllerRef.current?.abort();
    setCargando(false);
    setProgreso(0);
    setError(null);
    setStartTime(undefined);
  };

  const handleToggleTrusted = async (device: Device) => {
    try {
      const updated = await updateDevice(device.mac, { trusted: !device.trusted });
      setDevices((current) => current.map((device) => (
        device.mac.toUpperCase() === updated.mac.toUpperCase() ? { ...device, ...updated } : device
      )));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la confianza del dispositivo.');
      console.error('Error actualizando confianza del dispositivo:', err);
      throw err;
    }
  };

  const handleMarkTrusted = async (device: Device) => {
    setError(null);
    setDevices((current) => current.map((item) => (
      item.mac.toUpperCase() === device.mac.toUpperCase() ? { ...item, trusted: true } : item
    )));
    try {
      const updated = await updateDevice(device.mac, { trusted: true });
      setDevices((current) => current.map((item) => (
        item.mac.toUpperCase() === updated.mac.toUpperCase() ? { ...item, ...updated } : item
      )));
      setUndoDevice(device);
    } catch (err) {
      setDevices((current) => current.map((item) => (
        item.mac.toUpperCase() === device.mac.toUpperCase() ? { ...item, trusted: device.trusted } : item
      )));
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la confianza del dispositivo.');
      console.error('Error marcando el dispositivo como confiable:', err);
      throw err;
    }
  };

  const undoMarkTrusted = async () => {
    if (!undoDevice) return;
    const device = undoDevice;
    setUndoDevice(null);
    setDevices((current) => current.map((item) => (
      item.mac.toUpperCase() === device.mac.toUpperCase() ? { ...item, trusted: false } : item
    )));
    try {
      const updated = await updateDevice(device.mac, { trusted: false });
      setDevices((current) => current.map((item) => (
        item.mac.toUpperCase() === updated.mac.toUpperCase() ? { ...item, ...updated } : item
      )));
      setError(null);
    } catch (err) {
      setDevices((current) => current.map((item) => (
        item.mac.toUpperCase() === device.mac.toUpperCase() ? { ...item, trusted: true } : item
      )));
      setError(err instanceof ApiError ? err.message : 'No se pudo deshacer el cambio de confianza.');
      console.error('Error deshaciendo la confianza del dispositivo:', err);
    }
  };

  const handleRetryDevices = async () => {
    setDevicesLoading(true);
    setDevicesLoadError(null);
    try {
      setDevices(await getDevices());
      setError(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'No se pudieron cargar los dispositivos.';
      setDevicesLoadError(message);
      setError(message);
      console.error('Error reintentando la carga de dispositivos:', err);
    } finally {
      setDevicesLoading(false);
    }
  };

  const focusReviewCard = () => {
    reviewCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      reviewCardRef.current?.querySelector<HTMLButtonElement>('[data-mark-trusted]')?.focus();
    }, 350);
  };

  const navigateToUnverified = () => {
    sessionStorage.setItem('netguard-devices-initial-filter', 'unverified');
    onNavigate('devices');
  };

  const healthStats = getDeviceStats(devices.filter((device) => device.is_present));
  const health = getNetworkHealth(devices);
  const chronologicalHistory = [...historial].sort(
    (a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime(),
  );
  const latestScan = chronologicalHistory.at(-1);
  const previousScan = chronologicalHistory.at(-2);
  const changes = latestScan && previousScan
    ? calculateScanEvents(
      latestScan.hosts || [],
      previousScan.hosts || [],
      chronologicalHistory.slice(0, -2).flatMap((scan) => scan.hosts || []),
    )
    : { newDevices: [], absentDevices: [], returnedDevices: [], changedPorts: [] };
  const realNewChanges = changes.newDevices.filter((host) => {
    const device = devices.find((candidate) => candidate.mac.toUpperCase() === host.mac.toUpperCase());
    return device ? isReallyNew(device) : false;
  });
  const threatDevices = devices.filter((device) => isReallyNew(device) && !device.trusted);
  const alerts: DashboardAlert[] = threatDevices.length > 0
    ? [{
      type: 'danger',
      message: `${threatDevices.length} ${threatDevices.length === 1 ? 'dispositivo nuevo' : 'dispositivos nuevos'} detectado${threatDevices.length === 1 ? '' : 's'}`,
      action: { label: 'Revisar ahora', view: 'review' },
    }]
    : [];
  const healthStyles = {
    good: { label: 'Buena', dot: 'bg-primary' },
    medium: { label: 'En revisión', dot: 'bg-secondary' },
    poor: { label: 'En revisión', dot: 'bg-secondary' },
    unknown: { label: 'Sin datos', dot: 'bg-text-muted' },
  }[health.status];
  const unverifiedPercentage = 100 - health.trustPercentage;
  const selectedDevice = devices.find((device) => device.mac.toUpperCase() === selectedMac?.toUpperCase()) || null;
  const selectedHost: Host | null = selectedDevice
    ? latestScan?.hosts?.find((host) => host.mac.toUpperCase() === selectedDevice.mac.toUpperCase()) || {
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
  const appearancesByMac = new Map<string, number>();
  historial.forEach((scan) => {
    const appeared = new Set((scan.hosts || []).map((host) => host.mac.toUpperCase()));
    appeared.forEach((mac) => appearancesByMac.set(mac, (appearancesByMac.get(mac) || 0) + 1));
  });

  return (
    <div className="p-8">
      {cargando && (
        <ScanProgressOverlay
          progress={progreso}
          target={resultado?.target || historial[0]?.target || 'Red local'}
          startTime={startTime}
          onCancel={cancelScanDisplay}
        />
      )}

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-text">Dashboard</h1>
          <p className="text-text-muted">Vista general del escaneo de red</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
            backendStatus === 'online' ? 'text-primary-text' : 'text-text-muted'
          }`}>
            {backendStatus === 'online'
              ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              : <CircleAlert className="h-4 w-4" aria-hidden="true" />}
            Backend {backendStatus === 'checking' ? 'comprobando' : backendStatus === 'online' ? 'conectado' : 'no disponible'}
          </span>
          <Tooltip
            position="auto"
            content={
              !isOnline
                ? 'Conéctate a una red para escanear'
                : backendStatus !== 'online'
                  ? 'El backend no está disponible'
                  : cargando
                    ? 'Escaneando la red...'
                    : 'Iniciar un escaneo de la red actual'
            }
          >
            <button
              type="button"
              onClick={() => void escanearRed()}
              disabled={!isOnline || backendStatus !== 'online' || cargando}
              title={
                !isOnline
                  ? 'Conéctate a una red para escanear'
                  : backendStatus !== 'online'
                    ? 'Backend no disponible'
                    : cargando
                      ? 'Escaneando...'
                      : 'Iniciar escaneo'
              }
              className={`rounded-lg px-6 py-3 text-sm font-medium transition-all ${
                !isOnline || backendStatus !== 'online' || cargando
                  ? 'cursor-not-allowed bg-surface-lighter text-text-muted'
                  : 'bg-primary hover:bg-primary-dark text-text'
              }`}
            >
              {cargando ? 'Escaneando...' : 'Iniciar escaneo'}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-danger-text">
          {error}
        </div>
      )}

      {alerts.length > 0 && (
        <section aria-label="Alertas de red" className="mb-8 space-y-3">
          {alerts.map((alert) => {
            const styles: Record<string, string> = {
              danger: 'border-red-500/30 bg-red-500/10 text-danger-text',
              warning: 'border-amber-500/30 bg-amber-500/10 text-warning-text',
              info: 'border-cyan-500/30 bg-cyan-500/10 text-primary-light',
            };
            const Icon = alert.type === 'danger' ? CircleAlert : alert.type === 'warning' ? AlertTriangle : MessageCircle;
            return (
              <div key={alert.message} className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${styles[alert.type]}`}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{alert.message}</span>
                {alert.action && (
                  <button
                    type="button"
                    onClick={() => {
                      if (alert.action!.view === 'review') focusReviewCard();
                      else onNavigate(alert.action!.view);
                    }}
                    className="ml-auto inline-flex items-center gap-1 whitespace-nowrap font-semibold underline underline-offset-2 hover:no-underline"
                  >
                    {alert.action.label} <span aria-hidden="true">{alert.action.view === 'review' ? '↓' : '→'}</span>
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      <section className="mb-8 rounded-xl border border-surface-border bg-surface-light p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
              Salud de la red
              <GlossaryInfo termId="salud-de-la-red" />
            </h2>
            <p className="mt-1 text-sm text-text-muted">Confianza y disponibilidad de los dispositivos conectados</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface/40 px-3 py-1.5 text-sm font-semibold text-text">
            <span className={`h-2.5 w-2.5 rounded-full ${healthStyles.dot}`} />
            {healthStyles.label}
          </span>
        </div>
        <div
          role="img"
          aria-label={`${healthStats.trusted} confiables y ${healthStats.untrusted} sin verificar`}
          className="flex h-2 overflow-hidden rounded-full bg-surface-border"
        >
          <div
            className="h-full bg-success transition-[width] duration-500"
            style={{ width: `${health.trustPercentage}%` }}
            title={`${healthStats.trusted} confiables`}
          />
          <div
            className="h-full bg-secondary transition-[width] duration-500"
            style={{ width: `${unverifiedPercentage}%` }}
            title={`${healthStats.untrusted} sin verificar`}
          />
        </div>
        <p className="mt-3 text-sm text-text-muted">
          <strong className="text-lg font-bold text-primary">{health.trustPercentage}%</strong>
          <span> confiables · {healthStats.trusted} confiables · {healthStats.untrusted} sin verificar</span>
        </p>
      </section>

      <section className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-surface-border bg-surface-light p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
            Cambios desde el último escaneo
            <GlossaryInfo termId="cambios-de-escaneo" />
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            {realNewChanges.length > 0 && (
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="text-sm">
                  <strong className="text-primary">{realNewChanges.length}</strong>
                  <span className="ml-1 text-text-muted">{realNewChanges.length === 1 ? 'nuevo' : 'nuevos'}</span>
                </span>
              </div>
            )}
            {changes.absentDevices.length > 0 && (
              <div className="flex items-center gap-2">
                <UserMinus className="h-4 w-4 text-text-muted" aria-hidden="true" />
                <span className="text-sm">
                  <strong className="text-text">{changes.absentDevices.length}</strong>
                  <span className="ml-1 text-text-muted">{changes.absentDevices.length === 1 ? 'ausente' : 'ausentes'}</span>
                </span>
              </div>
            )}
            {changes.returnedDevices.length > 0 && (
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-success" aria-hidden="true" />
                <span className="text-sm">
                  <strong className="text-success">{changes.returnedDevices.length}</strong>
                  <span className="ml-1 text-text-muted">{changes.returnedDevices.length === 1 ? 'volvió' : 'volvieron'}</span>
                </span>
              </div>
            )}
            {realNewChanges.length === 0
              && changes.absentDevices.length === 0
              && changes.returnedDevices.length === 0 && (
                <span className="text-sm text-text-muted">Sin cambios desde el último escaneo</span>
              )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('history')}
          className="rounded-lg px-3 py-2 text-sm font-medium text-primary-light transition-colors hover:bg-surface-lighter"
        >
          Ver historial completo <span aria-hidden="true">→</span>
        </button>
      </section>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-surface-border bg-surface-light p-5">
          <div className="text-sm font-medium text-text-muted">
            <GlossaryInfo termId="ultimo-escaneo" label="Último escaneo" />
          </div>
          <p className="mt-2 text-xl font-semibold text-text">
            {resultado ? formatRelativeTime(resultado.scanned_at) : 'Sin escaneos'}
          </p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-light p-5">
          <div className="text-sm font-medium text-text-muted">
            <GlossaryInfo termId="red-escaneada" label="Red escaneada" />
          </div>
          <p className="mt-2 break-all font-mono text-lg font-semibold text-text">
            {resultado?.target || 'Sin datos'}
          </p>
        </div>
      </div>

      <ReviewCard
        devices={devices}
        loading={devicesLoading}
        error={devicesLoadError}
        onRetry={() => void handleRetryDevices()}
        onOpenDevice={(device) => setSelectedMac(device.mac)}
        onMarkTrusted={handleMarkTrusted}
        onViewAll={navigateToUnverified}
        onSectionRef={(element) => { reviewCardRef.current = element; }}
      />

      {selectedDevice && selectedHost && (
        <DeviceDetailModal
          host={selectedHost}
          device={selectedDevice}
          appearanceCount={appearancesByMac.get(selectedDevice.mac.toUpperCase())}
          onClose={() => setSelectedMac(null)}
          onSetAlias={async (device, alias) => {
            const updated = await updateDevice(device.mac, { alias });
            setDevices((current) => current.map((item) => (
              item.mac.toUpperCase() === updated.mac.toUpperCase() ? { ...item, ...updated } : item
            )));
          }}
          onToggleTrusted={handleToggleTrusted}
        />
      )}

      {undoDevice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border border-surface-border bg-surface-light px-4 py-3 text-sm text-text shadow-lg"
        >
          <span>Dispositivo marcado como confiable</span>
          <button
            type="button"
            onClick={() => void undoMarkTrusted()}
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary-text underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Deshacer
          </button>
        </div>
      )}
    </div>
  );
}