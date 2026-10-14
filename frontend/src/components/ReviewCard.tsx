import { createElement, useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import type { Device } from '../types/device.types';
import {
  cleanHostname,
  getDeviceIcon,
  getDeviceTypeLabel,
  isReallyNew,
} from '../utils/deviceHelpers';

interface ReviewCardProps {
  devices: Device[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenDevice: (device: Device) => void;
  onMarkTrusted: (device: Device) => Promise<void>;
  onViewAll: () => void;
  onSectionRef: (element: HTMLElement | null) => void;
}

function getDeviceName(device: Device): string {
  if (device.alias?.trim()) return device.alias.trim();
  const hostname = cleanHostname(device.last_hostname);
  if (hostname !== '—') return hostname;
  if (device.vendor && /privada|aleatoria/i.test(device.vendor)) {
    return 'Dispositivo con MAC privada';
  }
  if (device.vendor && device.vendor.toLocaleLowerCase('es') !== 'desconocido') {
    return device.vendor;
  }
  return 'Dispositivo desconocido';
}

function getSubtitle(device: Device): string | null {
  const type = device.device_type ? getDeviceTypeLabel(device.device_type) : null;
  const vendor = device.vendor && device.vendor.toLocaleLowerCase('es') !== 'desconocido'
    ? device.vendor
    : null;
  return [type, vendor].filter(Boolean).join(' · ') || null;
}

export function ReviewCard({
  devices,
  loading,
  error,
  onRetry,
  onOpenDevice,
  onMarkTrusted,
  onViewAll,
  onSectionRef,
}: ReviewCardProps) {
  const [exitingDevices, setExitingDevices] = useState<Record<string, Device>>({});
  const [updatingMacs, setUpdatingMacs] = useState<string[]>([]);
  const unverifiedDevices = devices
    .filter((device) => !device.trusted)
    .sort((left, right) => {
      if (left.is_present !== right.is_present) return left.is_present ? -1 : 1;
      return new Date(right.last_seen).getTime() - new Date(left.last_seen).getTime();
    });
  const currentPage = unverifiedDevices.filter((device) => !exitingDevices[device.mac.toUpperCase()]);
  const visibleDevices = [
    ...currentPage.slice(0, Math.max(0, 5 - Object.keys(exitingDevices).length)),
    ...Object.values(exitingDevices),
  ].sort((left, right) => {
    if (left.is_present !== right.is_present) return left.is_present ? -1 : 1;
    return new Date(right.last_seen).getTime() - new Date(left.last_seen).getTime();
  });
  const count = unverifiedDevices.length;
  const presentCount = unverifiedDevices.filter((device) => device.is_present).length;
  const countLabel = presentCount === count
    ? `${count} ${count === 1 ? 'dispositivo' : 'dispositivos'} sin verificar`
    : `${presentCount} presentes sin verificar · ${count} en total`;

  const markTrusted = async (device: Device) => {
    const macKey = device.mac.toUpperCase();
    setExitingDevices((current) => ({ ...current, [macKey]: device }));
    setUpdatingMacs((current) => [...current, macKey]);
    try {
      await onMarkTrusted(device);
      window.setTimeout(() => {
        setExitingDevices((current) => {
          const remaining = { ...current };
          delete remaining[macKey];
          return remaining;
        });
      }, 220);
    } catch {
      setExitingDevices((current) => {
        const remaining = { ...current };
        delete remaining[macKey];
        return remaining;
      });
    } finally {
      setUpdatingMacs((current) => current.filter((mac) => mac !== macKey));
    }
  };

  return (
    <section
      ref={onSectionRef}
      aria-labelledby="review-card-title"
      className="mb-8 scroll-mt-6 rounded-xl border border-surface-border bg-surface-light p-5 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="review-card-title" className="text-lg font-semibold text-text">
            Requieren tu revisión
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {loading ? 'Cargando dispositivos sin verificar…' : countLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-primary-text hover:bg-surface-lighter focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          Ver todos <span aria-hidden="true">→</span>
        </button>
      </div>

      {loading ? (
        <div role="status" aria-label="Cargando dispositivos para revisar" className="space-y-2">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-20 animate-pulse rounded-lg bg-surface-lighter" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-surface-border p-4 text-sm text-text-muted" role="alert">
          <p>{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border border-surface-border px-3 py-1.5 font-medium text-text hover:bg-surface-lighter focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            Reintentar
          </button>
        </div>
      ) : count === 0 ? (
        <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg bg-surface/40 px-4 py-6 text-center">
          <CheckCircle2 className="h-6 w-6 text-primary-text" aria-hidden="true" />
          <p className="text-sm font-medium text-text">
            Todo verificado. Todos tus dispositivos están marcados como confiables.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {visibleDevices.map((device) => {
              const macKey = device.mac.toUpperCase();
              const isExiting = Boolean(exitingDevices[macKey]);
              const name = getDeviceName(device);
              const subtitle = getSubtitle(device);
              const Icon = getDeviceIcon(device.device_type);
              const updating = updatingMacs.includes(macKey);
              return (
                <li key={device.mac}>
                  <div
                    role="group"
                    aria-label={`${name}, ${device.is_present ? 'Presente' : 'Ausente'}`}
                    tabIndex={0}
                    onClick={() => onOpenDevice(device)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenDevice(device);
                      }
                    }}
                    className={`grid h-20 cursor-pointer grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg border border-surface-border px-3 transition-[opacity,background-color,border-color] duration-200 hover:border-primary/30 hover:bg-surface-lighter focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary lg:grid-cols-[40px_minmax(200px,1fr)_150px_120px_140px] ${
                      isExiting ? 'pointer-events-none opacity-0' : device.is_present ? '' : 'opacity-70'
                    }`}
                  >
                    {createElement(Icon, {
                      className: 'h-5 w-5 shrink-0 text-text-muted',
                      'aria-hidden': true,
                    })}
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-text">
                        <span className="truncate" title={name}>{name}</span>
                        {isReallyNew(device) && (
                          <span
                            title="Dispositivo visto por primera vez en las últimas 24 horas"
                            className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                          >
                            Nuevo
                          </span>
                        )}
                      </p>
                      <p className="hidden truncate text-xs text-text-muted lg:block" title={subtitle || undefined}>
                        {subtitle}
                      </p>
                      <div className="flex min-w-0 items-center gap-2 text-xs lg:hidden">
                        <span className="truncate font-mono text-text">{device.last_ip || '—'}</span>
                        <span className="shrink-0 text-text-muted">
                          <span className={`mr-1 inline-block h-2 w-2 rounded-full ${device.is_present ? 'bg-primary' : 'bg-text-muted'}`} />
                          {device.is_present ? 'Presente' : 'Ausente'}
                        </span>
                      </div>
                    </div>

                    <span className="hidden truncate font-mono text-sm text-text lg:block">
                      {device.last_ip || '—'}
                    </span>
                    <span className="hidden items-center gap-1.5 text-sm text-text lg:inline-flex">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${device.is_present ? 'bg-primary' : 'bg-text-muted'}`} />
                      {device.is_present ? 'Presente' : 'Ausente'}
                    </span>
                    <button
                      type="button"
                      data-mark-trusted
                      aria-label={`Marcar como confiable el dispositivo ${device.last_ip || device.mac}`}
                      disabled={updating || isExiting}
                      onClick={(event) => {
                        event.stopPropagation();
                        void markTrusted(device);
                      }}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-surface-border bg-surface-lighter px-2.5 text-xs font-medium text-text transition-colors hover:border-primary/40 hover:text-primary-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60 lg:px-3"
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">{updating ? 'Guardando…' : 'Marcar confiable'}</span>
                      <span className="sm:hidden">{updating ? '…' : 'Confiar'}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-surface-border pt-3 text-sm">
            <span className="text-text-muted">Mostrando {visibleDevices.length} de {count}</span>
            <button
              type="button"
              onClick={onViewAll}
              className="rounded-md px-2 py-1 font-medium text-primary-text hover:bg-surface-lighter focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Ver los {count} en Dispositivos <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
