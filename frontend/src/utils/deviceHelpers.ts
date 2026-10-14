import type { Device } from '../types/device.types';
import {
  Camera,
  CircleHelp,
  Laptop,
  Printer,
  Router,
  Smartphone,
  Speaker,
  Tv,
  type LucideIcon,
} from 'lucide-react';
export { formatRelativeTime } from './format';

export type RiskLevel = 'low' | 'medium' | 'high';
export type NetworkHealthStatus = 'good' | 'medium' | 'poor' | 'unknown';

/**
 * Determina si un dispositivo es realmente nuevo: el backend lo marca como nuevo,
 * tiene fabricante identificable y se vio por primera vez en las últimas 24 horas.
 */
export function isReallyNew(device: {
  is_new: boolean;
  first_seen: string;
  vendor: string | null;
}): boolean {
  if (!device.is_new) return false;

  const vendor = (device.vendor || '').toLocaleLowerCase('es');
  if (
    vendor.includes('privada')
    || vendor.includes('aleatoria')
    || vendor.includes('no disponible')
    || vendor.includes('desconocido')
  ) {
    return false;
  }

  const firstSeen = new Date(device.first_seen).getTime();
  const hoursSinceFirstSeen = (Date.now() - firstSeen) / (1000 * 60 * 60);
  return Number.isFinite(firstSeen) && hoursSinceFirstSeen >= 0 && hoursSinceFirstSeen <= 24;
}

export interface NetworkHealth {
  status: NetworkHealthStatus;
  label: string;
  activeCount: number;
  trustedCount: number;
  untrustedCount: number;
  trustPercentage: number;
}

export function normalizeMac(mac: string | null | undefined): string {
  if (!mac?.trim()) return '—';

  const compactMac = mac.replace(/[:.\-\s]/g, '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(compactMac)) return mac;

  const octets = compactMac.match(/.{2}/g);
  if (!octets) return mac;
  return octets.join(':');
}

export function cleanHostname(hostname: string | null): string {
  if (!hostname) return '—';
  return hostname.replace(/\s*\[.*?\]\s*/g, '').trim() || '—';
}

export function getDisplayName(device: {
  alias?: string | null;
  last_hostname?: string | null;
  hostname?: string | null;
  last_ip?: string | null;
  ip?: string | null;
}): string {
  const hostname = cleanHostname(device.last_hostname || device.hostname || null);
  return device.alias?.trim()
    || (hostname !== '—' ? hostname : null)
    || device.last_ip
    || device.ip
    || 'Desconocido';
}

export function hasAlias(device: { alias?: string | null }): boolean {
  return Boolean(device.alias?.trim());
}

export function getDeviceIcon(deviceType: string | null): LucideIcon {
  if (deviceType) {
    const type = deviceType.toLowerCase();
    if (type.includes('router') || type.includes('gateway')) return Router;
    if (type.includes('phone') || type.includes('mobile') || type.includes('tablet')) return Smartphone;
    if (type.includes('computer') || type.includes('pc') || type.includes('laptop')) return Laptop;
    if (type.includes('printer')) return Printer;
    if (type.includes('tv') || type.includes('smart')) return Tv;
    if (type.includes('camera')) return Camera;
    if (type.includes('speaker') || type.includes('audio')) return Speaker;
  }
  return CircleHelp;
}

const PORT_SERVICE_LABELS: Record<number, string> = {
  22: 'SSH',
  53: 'DNS',
  80: 'HTTP',
  443: 'HTTPS',
  445: 'SMB',
  8008: 'Chromecast',
  8009: 'Chromecast',
};

const SERVICE_PORTS: Record<string, readonly number[]> = {
  chromecast: [8008, 8009],
  dns: [53],
  domain: [53],
  http: [80],
  https: [443],
  smb: [445],
  ssh: [22],
};

export function getPortServiceLabel(port: number): string | null {
  return PORT_SERVICE_LABELS[port] || null;
}

export function getServicesWithoutPorts(ports: readonly number[], services: readonly string[]): string[] {
  return services.filter((service) => {
    if (service.startsWith('_')) return true;
    const portMatch = service.match(/(?:tcp|udp)\/(\d+)|(\d+)\/(?:tcp|udp)/i);
    if (portMatch) return !ports.includes(Number(portMatch[1] || portMatch[2]));
    const servicePorts = SERVICE_PORTS[service.toLowerCase()];
    return !servicePorts || !servicePorts.some((port) => ports.includes(port));
  });
}

export function getDeviceTypeLabel(deviceType: string | null): string {
  if (!deviceType) return 'Tipo desconocido';
  return deviceType
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toLocaleUpperCase('es'));
}

export function getRiskLevel(devices: readonly Device[]): RiskLevel {
  const activeDevices = devices.filter((device) => device.is_present);
  const untrustedCount = activeDevices.filter((device) => !device.trusted).length;
  if (untrustedCount === 0) return 'low';
  if (untrustedCount >= 3 || untrustedCount / activeDevices.length >= 0.5) return 'high';
  return 'medium';
}

export function getNetworkHealth(devices: readonly Device[]): NetworkHealth {
  const activeDevices = devices.filter((device) => device.is_present);
  const trustedCount = activeDevices.filter((device) => device.trusted).length;
  const untrustedCount = activeDevices.length - trustedCount;
  const trustPercentage = activeDevices.length === 0
    ? 0
    : Math.round((trustedCount / activeDevices.length) * 100);

  if (activeDevices.length === 0) {
    return {
      status: 'unknown',
      label: 'Sin datos',
      activeCount: 0,
      trustedCount: 0,
      untrustedCount: 0,
      trustPercentage: 0,
    };
  }

  const status: NetworkHealthStatus = trustPercentage >= 80
    ? 'good'
    : trustPercentage >= 50 ? 'medium' : 'poor';

  return {
    status,
    label: status === 'good' ? 'Buena' : status === 'medium' ? 'Media' : 'Mala',
    activeCount: activeDevices.length,
    trustedCount,
    untrustedCount,
    trustPercentage,
  };
}
