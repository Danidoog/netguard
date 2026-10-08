export interface Device {
  mac: string;
  alias: string | null;
  trusted: boolean;
  last_ip: string | null;
  last_hostname: string | null;
  vendor: string | null;
  device_type: string | null;
  os_hint: string | null;
  first_seen: string;
  last_seen: string;
  is_present: boolean;
  is_new: boolean;
}

export interface DeviceUpdate {
  alias?: string;
  trusted?: boolean;
}