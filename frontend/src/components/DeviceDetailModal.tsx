import { createElement, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Copy,
  X,
} from 'lucide-react';
import type { Device } from '../types/device.types';
import type { Host } from '../types/scan.types';
import {
  cleanHostname,
  formatRelativeTime,
  getDeviceIcon,
  getDeviceTypeLabel,
  getPortServiceLabel,
  getServicesWithoutPorts,
  normalizeMac,
} from '../utils/deviceHelpers';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { Toast } from './Toast';
import { formatDateTime } from '../utils/format';
import { GlossaryInfo } from './GlossaryInfo';

interface DeviceDetailModalProps {
  host: Host;
  device?: Device;
  scannedAt?: string;
  appearanceCount?: number;
  onClose: () => void;
  onSetAlias?: (device: Device, alias: string) => Promise<void>;
  onToggleTrusted?: (device: Device) => Promise<void>;
}

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className={`mt-1 break-words text-sm text-text ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}

export function DeviceDetailModal({
  host,
  device,
  scannedAt,
  appearanceCount,
  onClose,
}: DeviceDetailModalProps) {
  const [isTechnicalExpanded, setIsTechnicalExpanded] = useState(false);
  const { copiedValue, copy } = useCopyToClipboard();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const copyValue = (value: string) => {
    void copy(value).catch((error: unknown) => {
      console.error('No se pudo copiar al portapapeles:', error);
    });
  };

  const hostname = cleanHostname(device?.last_hostname || host.hostname);
  const displayName = device?.alias?.trim() || (hostname !== '—' ? hostname : 'Sin alias');
  const deviceType = host.device_type || device?.device_type || null;
  const vendor = host.vendor || device?.vendor || null;
  const model = host.model;
  const operatingSystem = host.os_hint || device?.os_hint || null;
  const openPorts = host.open_ports.length > 0 ? host.open_ports : (device?.open_ports || []);
  const services = host.services.length > 0 ? host.services : (device?.services || []);
  const extraServices = getServicesWithoutPorts(openPorts, services);
  const ip = host.ip || device?.last_ip || '—';
  const mac = normalizeMac(host.mac);
  const isPresent = device?.is_present ?? host.status === 'up';
  const lastSeen = device?.last_seen || scannedAt;
  const allInfo = [
    `Dispositivo: ${displayName}`,
    `Hostname: ${hostname}`,
    `Estado: ${isPresent ? 'Presente' : 'Ausente'}`,
    `Confianza: ${device ? (device.trusted ? 'Confiable' : 'Sin verificar') : 'No disponible'}`,
    `Fabricante: ${vendor || '—'}`,
    `Tipo: ${deviceType ? getDeviceTypeLabel(deviceType) : '—'}`,
    ...(model ? [`Modelo: ${model}`] : []),
    ...(operatingSystem ? [`Sistema operativo: ${operatingSystem}`] : []),
    `IP: ${ip}`,
    `MAC: ${mac}`,
    `Visto por primera vez: ${device?.first_seen ? formatDateTime(device.first_seen) : 'No disponible'}`,
    ...(appearanceCount !== undefined ? [`Escaneos en los que apareció: ${appearanceCount}`] : []),
    ...(device?.last_ip ? [`Última IP: ${device.last_ip}`] : []),
    ...(device?.last_hostname ? [`Último hostname: ${cleanHostname(device.last_hostname)}`] : []),
    ...(device ? [`Nuevo en inventario: ${device.is_new ? 'Sí' : 'No'}`] : []),
    ...(host.names.length > 0 ? [`Nombres alternativos: ${host.names.join(', ')}`] : []),
    `Puertos y servicios: ${openPorts.map((port) => `${port}${getPortServiceLabel(port) ? ` · ${getPortServiceLabel(port)}` : ''}`).join(', ') || '—'}`,
    `Otros servicios: ${extraServices.join(', ') || '—'}`,
  ].join('\n');

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        onCloseRef.current();
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-detail-title"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-surface-border bg-surface-light shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-surface-border bg-surface-light px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {createElement(getDeviceIcon(deviceType), {
              className: 'mt-1 h-6 w-6 shrink-0 text-text-muted',
              'aria-hidden': true,
            })}
            <div className="min-w-0">
              <h2 id="device-detail-title" className="truncate text-lg font-semibold text-text sm:text-xl">{displayName}</h2>
              <p className="mt-1 truncate font-mono text-xs text-text-muted sm:text-sm" title={hostname}>
                {hostname}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="shrink-0 rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-lighter hover:text-text"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-6 p-4 sm:p-6">
          <section className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
              isPresent
                ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'border-surface-border bg-surface-lighter text-text-muted'
            }`}>
              {isPresent ? 'Presente' : 'Ausente'}
              {lastSeen && ` · ${formatRelativeTime(lastSeen).toLocaleLowerCase('es')}`}
            </span>
            {device && (
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                device.trusted
                  ? 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-warning-text'
              }`}>
                {device.trusted
                  ? <Check className="h-4 w-4" aria-hidden="true" />
                  : <CircleAlert className="h-4 w-4" aria-hidden="true" />}
                {device.trusted ? 'Confiable' : 'Sin verificar'}
              </span>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyValue(allInfo)}
                className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-surface-lighter hover:text-text"
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                {copiedValue === allInfo ? 'Copiado' : 'Copiar todo'}
              </button>
            </div>
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
              Identidad
              <GlossaryInfo termId="fabricante" />
            </h3>
            <dl className="grid gap-4 rounded-xl border border-surface-border bg-surface/40 p-4 sm:grid-cols-2">
              {vendor && <DetailField label="Fabricante" value={vendor} />}
              {deviceType && <DetailField label="Tipo" value={getDeviceTypeLabel(deviceType)} />}
              {model && <DetailField label="Modelo" value={model} />}
              {operatingSystem && <DetailField label="Sistema operativo" value={operatingSystem} />}
              {!vendor && !deviceType && !model && !operatingSystem && (
                <p className="text-sm italic text-text-muted">Sin datos de identidad</p>
              )}
            </dl>
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
              Red
              <GlossaryInfo termId="ip" />
            </h3>
            <dl className="grid gap-4 rounded-xl border border-surface-border bg-surface/40 p-4 sm:grid-cols-2">
              <DetailField label="IP" value={ip} mono />
              <DetailField label="MAC" value={mac} mono />
              {device?.first_seen && <DetailField label="Visto por primera vez" value={formatDateTime(device.first_seen)} />}
              {appearanceCount !== undefined && (
                <DetailField
                  label="Escaneos en los que apareció"
                  value={`${appearanceCount} ${appearanceCount === 1 ? 'escaneo' : 'escaneos'}`}
                />
              )}
            </dl>
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text">
              Puertos y servicios
              <GlossaryInfo termId="puertos-abiertos" />
            </h3>
            <div className="flex flex-wrap gap-2">
              {openPorts.map((port) => {
                const serviceLabel = getPortServiceLabel(port);
                return (
                  <span key={port} className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1.5 font-mono text-xs font-medium text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                    {port}{serviceLabel && ` · ${serviceLabel}`}
                  </span>
                );
              })}
              {extraServices.map((service, index) => (
                <span key={`${service}-${index}`} className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-warning-text">
                  {service}
                </span>
              ))}
              {openPorts.length === 0 && extraServices.length === 0 && (
                <span className="text-sm text-text-muted">No se detectaron puertos ni servicios</span>
              )}
            </div>
          </section>

          <section className="border-t border-surface-border pt-4">
            <button
              type="button"
              aria-expanded={isTechnicalExpanded}
              onClick={() => setIsTechnicalExpanded((expanded) => !expanded)}
              className="flex w-full items-center gap-2 text-left text-sm font-semibold text-text hover:text-primary-text"
            >
              {isTechnicalExpanded
                ? <ChevronDown className="h-4 w-4" aria-hidden="true" />
                : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
              Datos técnicos del inventario
            </button>
            {isTechnicalExpanded && (
              <dl className="mt-3 grid gap-4 rounded-xl border border-surface-border bg-surface/40 p-4 sm:grid-cols-2">
                {device?.last_ip && <DetailField label="Última IP" value={device.last_ip} mono />}
                {device?.last_hostname && (
                  <DetailField label="Último hostname" value={cleanHostname(device.last_hostname)} mono />
                )}
                {device && <DetailField label="Nuevo en inventario" value={device.is_new ? 'Sí' : 'No'} />}
                {host.names.length > 0 && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-text-muted">Nombres alternativos</dt>
                    <dd className="mt-2 flex flex-wrap gap-2">
                      {host.names.map((name, index) => (
                        <span key={`${name}-${index}`} className="rounded-full border border-surface-border bg-surface-light px-3 py-1 text-xs text-text">
                          {name}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {(!device?.last_ip && !device?.last_hostname && !device && host.names.length === 0) && (
                  <p className="text-sm text-text-muted">No hay datos técnicos adicionales</p>
                )}
              </dl>
            )}
          </section>
        </div>
      </section>
      {copiedValue && <Toast key={copiedValue} />}
    </div>
  );
}
