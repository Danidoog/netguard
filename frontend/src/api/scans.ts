import type { Host, ScanDetail, ScanResult, ScanHistoryItem } from '../types/scan.types';
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
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    throw new NetworkError(error);
  }
  return handleResponse<T>(response);
}

export async function createScan(options?: { signal?: AbortSignal }): Promise<ScanResult> {
  const result = await request<ScanResult>('/scans', {
    method: 'POST',
    signal: options?.signal,
  });
  invalidateCache('scan-history:');
  invalidateCache('devices');
  return result;
}

export function getScanHistory(limit = 10, offset = 0): Promise<ScanHistoryItem[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const safeOffset = Math.max(0, Math.floor(offset));
  const key = `scan-history:${safeLimit}:${safeOffset}`;
  return getCached(key, () => request<ScanHistoryItem[]>(
    `/scans?limit=${safeLimit}&offset=${safeOffset}`,
  ));
}

export async function getAllScanHistory(): Promise<ScanHistoryItem[]> {
  const pageSize = 100;
  const scans: ScanHistoryItem[] = [];
  let offset = 0;
  let page: ScanHistoryItem[];
  do {
    page = await getScanHistory(pageSize, offset);
    scans.push(...page);
    offset += page.length;
  } while (page.length === pageSize);
  return scans;
}

export async function getScanDetail(id: number): Promise<ScanDetail> {
  return request<ScanDetail>(`/scans/${id}`);
}

export async function getScanHosts(id: number): Promise<Host[]> {
  return request<Host[]>(`/scans/${id}/hosts`);
}