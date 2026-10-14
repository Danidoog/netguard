import type { BackendStatus } from '../hooks/useBackendStatus';

interface StatusBannerProps {
  isOnline: boolean;
  backendStatus: BackendStatus;
}

export function StatusBanner({ isOnline, backendStatus }: StatusBannerProps) {
  if (!isOnline) {
    return (
      <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4">
        <span className="text-2xl" aria-hidden="true">📡</span>
        <div className="flex-1">
          <h3 className="font-semibold text-danger-text">Sin conexión de red</h3>
          <p className="mt-1 text-sm text-text-muted">
            Conéctate a una red WiFi o Ethernet para poder escanear dispositivos.
          </p>
        </div>
      </div>
    );
  }

  if (backendStatus === 'offline') {
    return (
      <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4">
        <span className="text-2xl" aria-hidden="true">🔌</span>
        <div className="flex-1">
          <h3 className="font-semibold text-danger-text">Backend no disponible</h3>
          <p className="mt-1 text-sm text-text-muted">
            No se puede conectar con el servidor. Verifica que el backend esté corriendo en http://127.0.0.1:8000.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
