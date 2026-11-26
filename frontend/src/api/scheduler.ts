import type { SchedulerConfig, SchedulerConfigUpdate } from '../types/scheduler.types';
import { NetworkError, ParseError, processErrorResponse } from '../errors/apiErrors';

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

export async function getSchedulerConfig(): Promise<SchedulerConfig> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/config/scheduler`);
  } catch (error) {
    throw new NetworkError(error);
  }
  return handleResponse<SchedulerConfig>(response);
}

export async function updateSchedulerConfig(
  data: SchedulerConfigUpdate
): Promise<SchedulerConfig> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/config/scheduler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw new NetworkError(error);
  }
  return handleResponse<SchedulerConfig>(response);
}

export async function triggerBackgroundScan(target?: string | null): Promise<import('../types/scheduler.types').ScanTask> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/tasks/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: target || null }),
    });
  } catch (error) {
    throw new NetworkError(error);
  }
  return handleResponse<import('../types/scheduler.types').ScanTask>(response);
}

export async function getScanTask(taskId: string): Promise<import('../types/scheduler.types').ScanTask> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/tasks/${taskId}`);
  } catch (error) {
    throw new NetworkError(error);
  }
  return handleResponse<import('../types/scheduler.types').ScanTask>(response);
}

export async function getActiveTasks(): Promise<import('../types/scheduler.types').ScanTask[]> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/tasks?limit=10`);
  } catch (error) {
    throw new NetworkError(error);
  }
  return handleResponse<import('../types/scheduler.types').ScanTask[]>(response);
}

