import type { Host, ScanHistoryItem } from '../types/scan.types';

export type HistoryExportFormat = 'csv' | 'json';

function csvValue(value: unknown): string {
  let text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function createCsv(history: ScanHistoryItem[], hostsByScanId: Record<number, Host[]>): string {
  const columns = [
    'scan_id', 'target', 'scanned_at', 'duration_seconds', 'total_hosts',
    'ip', 'hostname', 'mac', 'vendor', 'status', 'names', 'services',
    'open_ports', 'model', 'device_type', 'os_hint',
  ];
  const rows = history.flatMap((scan) => {
    const hosts = hostsByScanId[scan.id] || [];
    const scanFields = {
      scan_id: scan.id,
      target: scan.target,
      scanned_at: scan.scanned_at,
      duration_seconds: scan.duration_seconds,
      total_hosts: scan.total_hosts,
    };
    const scanHosts: Array<Host | null> = hosts.length > 0 ? hosts : [null];

    return scanHosts.map((host) => {
      const record = {
        ...scanFields,
        ip: host?.ip,
        hostname: host?.hostname,
        mac: host?.mac,
        vendor: host?.vendor,
        status: host?.status,
        names: host?.names,
        services: host?.services,
        open_ports: host?.open_ports,
        model: host?.model,
        device_type: host?.device_type,
        os_hint: host?.os_hint,
      };
      return columns.map((column) => csvValue(record[column as keyof typeof record])).join(',');
    });
  });

  return `\uFEFF${columns.join(',')}\r\n${rows.join('\r\n')}`;
}

export function exportHistory(
  history: ScanHistoryItem[],
  format: HistoryExportFormat,
  hostsByScanId: Record<number, Host[]> = {},
): void {
  const payload = format === 'json'
    ? JSON.stringify(history.map((scan) => ({ ...scan, hosts: hostsByScanId[scan.id] || [] })), null, 2)
    : createCsv(history, hostsByScanId);
  const mimeType = format === 'json' ? 'application/json' : 'text/csv;charset=utf-8';
  const blob = new Blob([payload], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `netguard-historial-${new Date().toISOString().slice(0, 10)}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
