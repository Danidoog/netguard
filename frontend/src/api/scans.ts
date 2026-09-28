import type { Host, ScanResult, ScanHistoryItem } from '../types/scan.types';
import { ApiError, handleApiError } from '../errors/apiErrors';
const API_URL = '/api';

// Helper para manejar respuestas
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Lanzar error con la respuesta para que handleApiError lo procese
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.detail || `Error ${response.status}`,
      response.status === 404 ? 'NOT_FOUND' : 
      response.status >= 500 ? 'SERVER_ERROR' : 
      response.status === 400 ? 'VALIDATION_ERROR' : 'UNKNOWN',
      response.status
    );
  }
  return response.json();
}

// Escanear red (POST)
export async function createScan(): Promise<ScanResult> {
  try {
    const res = await fetch(`${API_URL}/scans`, { method: 'POST' });
    return await handleResponse<ScanResult>(res);
  } catch (error) {
    throw handleApiError(error);
  }
}

// Obtener historial (GET)
export async function getScanHistory(): Promise<ScanHistoryItem[]> {
  try {
    const res = await fetch(`${API_URL}/scans`);
    return await handleResponse<ScanHistoryItem[]>(res);
  } catch (error) {
    throw handleApiError(error);
  }
}

// Obtener detalle de un escaneo (GET)
export async function getScanDetail(id: number): Promise<ScanResult> {
  try {
    const res = await fetch(`${API_URL}/scans/${id}`);
    return await handleResponse<ScanResult>(res);
  } catch (error) {
    throw handleApiError(error);
  }
}

//  NUEVO: Obtener hosts de un escaneo
export async function getScanHosts(id: number): Promise<Host[]> {
  try {
    const res = await fetch(`${API_URL}/scans/${id}/hosts`);
    return await handleResponse<Host[]>(res);
  } catch (error) {
    throw handleApiError(error);
  }
}