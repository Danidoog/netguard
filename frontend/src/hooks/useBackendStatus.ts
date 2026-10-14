import { useCallback, useEffect, useRef, useState } from 'react';

export type BackendStatus = 'online' | 'offline' | 'checking';

export function useBackendStatus(checkInterval = 30_000) {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  const checkBackend = useCallback(async () => {
    if (controllerRef.current) return;

    const controller = new AbortController();
    controllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch('/api/scans?limit=1&offset=0', {
        method: 'GET',
        signal: controller.signal,
      });
      if (mountedRef.current) {
        setStatus(response.ok || response.status === 404 || response.status === 500 ? 'online' : 'offline');
      }
    } catch {
      if (mountedRef.current) setStatus('offline');
    } finally {
      window.clearTimeout(timeoutId);
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const initialCheckId = window.setTimeout(() => void checkBackend(), 0);
    const intervalId = window.setInterval(() => void checkBackend(), checkInterval);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialCheckId);
      window.clearInterval(intervalId);
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [checkBackend, checkInterval]);

  return { status, recheck: checkBackend };
}
