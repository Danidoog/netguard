import type { Device, DeviceUpdate } from '../types/device.types';
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

export async function getDevices(): Promise<Device[]> {
  try {
    const res = await fetch(`${API_URL}/devices`);
    return await handleResponse<Device[]>(res);
  } catch (error) {
    wrapNetworkError(error);
  }
}

export async function updateDevice(
  mac: string,
  data: DeviceUpdate
): Promise<Device> {
  try {
    const res = await fetch(`${API_URL}/devices/${encodeURIComponent(mac)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await handleResponse<Device>(res);
  } catch (error) {
    wrapNetworkError(error);
  }
}