
export interface Host {
  ip: string;
  mac: string;
  vendor: string;
  hostname: string | null;
  status?: string;
}

export interface ScanResult {
  target: string;
  hosts: Host[];
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
}