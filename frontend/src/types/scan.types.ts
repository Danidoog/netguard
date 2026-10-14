
export interface Host {
  ip: string;
  hostname: string | null;
  mac: string;
  vendor: string | null;
  status: string;
  names: string[];
  services: string[];
  open_ports: number[];
  model: string | null;
  device_type: string | null;
  os_hint: string | null;
}

export interface ScanResult {
  target: string;
  hosts: Host[];
  total_hosts: number;
  duration_seconds: number;
  scanned_at: string;
}

export interface ScanDetail {
  id: number;
  target: string;
  total_hosts: number;
  duration_seconds: number;
  scanned_at: string;
}

export interface ScanHistoryItem {
  id: number;
  target: string;
  total_hosts: number;
  duration_seconds: number;
  scanned_at: string;
  hosts: Host[];
}