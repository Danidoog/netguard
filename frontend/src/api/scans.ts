import type { Host, ScanResult, ScanHistoryItem } from '../types/scan.types';
import { ApiError, processErrorResponse } from '../errors/apiErrors';

const API_URL = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await processErrorResponse(response);
  }
  return response.json();
}

function wrapNetworkError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  throw new ApiError('No se pudo conectar con el servidor.', 'NETWORK_ERROR');
}

export async function createScan(): Promise<ScanResult> {
  try {
    const res = await fetch(`${API_URL}/scans`, { method: 'POST' });
    return await handleResponse<ScanResult>(res);
  } catch (error) {
    wrapNetworkError(error);
  }
}

export async function getScanHistory(): Promise<ScanHistoryItem[]> {
  try {
    const res = await fetch(`${API_URL}/scans`);
    return await handleResponse<ScanHistoryItem[]>(res);
  } catch (error) {
    wrapNetworkError(error);
  }
}

export async function getScanDetail(id: number): Promise<ScanResult> {
  try {
    const res = await fetch(`${API_URL}/scans/${id}`);
    return await handleResponse<ScanResult>(res);
  } catch (error) {
    wrapNetworkError(error);
  }
}

export async function getScanHosts(id: number): Promise<Host[]> {
  try {
    const res = await fetch(`${API_URL}/scans/${id}/hosts`);
    return await handleResponse<Host[]>(res);
  } catch (error) {
    wrapNetworkError(error);
  }
}