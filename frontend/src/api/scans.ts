import type { Host, ScanResult, ScanHistoryItem } from '../types/scan.types';

const API_URL = '/api';

// Escanear red (POST)
export async function createScan(): Promise<ScanResult> {
  const res = await fetch(`${API_URL}/scans`, { method: 'POST' });
  if (!res.ok) throw new Error(`Error: ${res.status}`);
  return res.json();
}

// Obtener historial (GET)
export async function getScanHistory(): Promise<ScanHistoryItem[]> {
  const res = await fetch(`${API_URL}/scans`);
  if (!res.ok) throw new Error(`Error: ${res.status}`);
  return res.json();
}

// Obtener detalle de un escaneo (GET)
export async function getScanDetail(id: number): Promise<ScanResult> {
  const res = await fetch(`${API_URL}/scans/${id}`);
  if (!res.ok) throw new Error(`Error: ${res.status}`);
  return res.json();
}

//  NUEVO: Obtener hosts de un escaneo
export async function getScanHosts(id: number): Promise<Host[]> {
  const res = await fetch(`${API_URL}/scans/${id}/hosts`);
  if (!res.ok) throw new Error(`Error: ${res.status}`);
  return res.json();
}