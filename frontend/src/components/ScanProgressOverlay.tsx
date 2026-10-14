import { useEffect, useState } from 'react';
import { CheckCircle, Radar, Search, LoaderCircle } from 'lucide-react';

interface ScanProgressOverlayProps {
  progress: number;
  target: string;
  onCancel?: () => void;
  devicesFound?: number;
  startTime?: number;
}

const stages = [
  { Icon: Radar, label: 'Escaneando la red...', threshold: 0 },
  { Icon: Search, label: 'Analizando dispositivos...', threshold: 40 },
  { Icon: CheckCircle, label: 'Finalizando...', threshold: 80 },
];

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  if (safeSeconds < 60) return `${safeSeconds}s`;
  return `${Math.floor(safeSeconds / 60)}m ${safeSeconds % 60}s`;
}

export function ScanProgressOverlay({
  progress,
  target,
  onCancel,
  startTime,
}: ScanProgressOverlayProps) {
  const [now, setNow] = useState(() => Date.now());
  const [waitingForServer, setWaitingForServer] = useState(false);
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  const elapsedSeconds = startTime ? (now - startTime) / 1000 : 0;
  const activeStageIndex = stages.reduce(
    (active, stage, index) => (normalizedProgress >= stage.threshold ? index : active),
    0,
  );
  const currentStage = stages[activeStageIndex];
  const circumference = 2 * Math.PI * 86;
  const dashOffset = circumference * (1 - normalizedProgress / 100);
  const showWaitingMessage = normalizedProgress >= 95
    && normalizedProgress < 100
    && waitingForServer;

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const shouldWait = normalizedProgress >= 95 && normalizedProgress < 100;
    const timeoutId = window.setTimeout(
      () => setWaitingForServer(shouldWait),
      shouldWait ? 5000 : 0,
    );
    return () => window.clearTimeout(timeoutId);
  }, [normalizedProgress]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Escaneo en progreso, ${Math.round(normalizedProgress)}%`}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-surface/95 p-4 backdrop-blur-md sm:p-6"
    >
      <section className="my-auto w-full max-w-md rounded-2xl border border-surface-border bg-surface-light p-5 shadow-2xl sm:p-8">
        <header className="mb-5 text-center">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary-text">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Escaneo en progreso
          </span>
          <h2 className="text-xl font-bold text-text">Escaneando red</h2>
          <p className="mt-1 break-all font-mono text-sm text-text-muted">{target}</p>
        </header>

        <div className="relative mx-auto mb-5 h-48 w-48 sm:h-[200px] sm:w-[200px]">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <linearGradient id="scan-progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--color-primary, #10b981)" />
                <stop offset="100%" stopColor="var(--color-secondary, #f59e0b)" />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="86" fill="none" stroke="var(--color-surface-lighter)" strokeWidth="12" />
            <circle
              cx="100"
              cy="100"
              r="86"
              fill="none"
              stroke="url(#scan-progress-gradient)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <currentStage.Icon className="h-8 w-8 text-primary-text" aria-hidden="true" />
            <span className="mt-2 text-3xl font-bold tabular-nums text-text">{Math.round(normalizedProgress)}%</span>
            <span className="mt-1 px-4 text-center text-xs text-text-muted">{currentStage.label}</span>
          </div>
        </div>

        <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="Etapas del escaneo">
          {stages.map(({ Icon, label }, index) => {
            const completed = index < activeStageIndex;
            const active = index === activeStageIndex;
            return (
              <li
                key={label}
                aria-current={active ? 'step' : undefined}
                className={`flex min-w-0 flex-col items-center gap-1 text-center ${
                  active || completed ? 'text-primary-text' : 'text-text-muted'
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  active ? 'bg-primary/15 ring-1 ring-primary/40' : completed ? 'bg-primary/10' : 'bg-surface-lighter'
                }`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="w-full text-[10px] leading-tight sm:text-xs">{label}</span>
              </li>
            );
          })}
        </ol>

        <div className="mb-5 text-center" aria-live="polite">
          {showWaitingMessage && (
            <p className="inline-flex items-center gap-2 text-sm text-text-muted">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Esperando respuesta del servidor...
            </p>
          )}
          {elapsedSeconds > 90 && (
            <p className="mt-2 text-sm text-warning-text">Tomando más tiempo del esperado</p>
          )}
        </div>

        <div
          role="progressbar"
          aria-label="Progreso del escaneo"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(normalizedProgress)}
          className="mb-5 h-2 overflow-hidden rounded-full bg-surface-lighter"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-500 ease-out"
            style={{ width: `${normalizedProgress}%` }}
          />
        </div>

        <div className="mb-5 rounded-xl border border-surface-border bg-surface/40 py-3 text-center">
          <p className="text-base font-semibold tabular-nums text-text">{formatDuration(elapsedSeconds)}</p>
          <p className="mt-1 text-xs text-text-muted">Tiempo transcurrido</p>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg border border-surface-border px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-lighter hover:text-text"
          >
            Cancelar escaneo
          </button>
        )}
      </section>
    </div>
  );
}
