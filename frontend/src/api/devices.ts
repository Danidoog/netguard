import type { Device, DeviceUpdate } from '../types/device.types';
import { NetworkError, ParseError, processErrorResponse } from '../errors/apiErrors';
import { getCached, invalidateCache } from './cache';

const API_URL = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await processErrorResponse(response);
  }
  try {
    return await response.json() as T;
  } catch (error) {
    throw new ParseError(error);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch (error) {
    throw new NetworkError(error);
  }
  return handleResponse<T>(response);
}

export function getDevices(): Promise<Device[]> {
  return getCached('devices', () => request<Device[]>('/devices'));
}

export async function updateDevice(
  mac: string,
  data: DeviceUpdate
): Promise<Device> {
  const updated = await request<Device>(`/devices/${encodeURIComponent(mac)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  invalidateCache('devices');
  return updated;
}