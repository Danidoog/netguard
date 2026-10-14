import type { Device } from '../types/device.types';

export function getDeviceStats(devices: Device[]) {
  return {
    total: devices.length,
    present: devices.filter((device) => device.is_present).length,
    absent: devices.filter((device) => !device.is_present).length,
    new: devices.filter((device) => device.is_new).length,
    trusted: devices.filter((device) => device.trusted).length,
    untrusted: devices.filter((device) => !device.trusted).length,
  };
}
