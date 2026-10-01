import type { Host, ScanHistoryItem } from '../types/scan.types';
import type { EventType, HistoryEvent } from '../types/history.types';

function hostKey(host: Host): string {
  return (host.mac || '').trim().toLowerCase();
}

function toDevice(host: Host): HistoryEvent['device'] {
  return {
    mac: host.mac || '—',
    ip: host.ip || null,
    hostname: host.hostname,
    vendor: host.vendor || null,
    trusted: host.trusted,
  };
}

export function buildHistoryEvents(scans: ScanHistoryItem[]): HistoryEvent[] {
  const chronological = [...scans].sort((a, b) => {
    const time = new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime();
    return time !== 0 ? time : a.id - b.id;
  });

  const events: HistoryEvent[] = [];
  const seenBeforePrev = new Set<string>();

  for (let i = 1; i < chronological.length; i++) {
    const prev = chronological[i - 1];
    const curr = chronological[i];
    const prevHosts = prev.hosts ?? [];
    const currHosts = curr.hosts ?? [];

    const prevMap = new Map<string, Host>();
    for (const host of prevHosts) {
      const key = hostKey(host);
      if (key) prevMap.set(key, host);
    }

    const currMap = new Map<string, Host>();
    for (const host of currHosts) {
      const key = hostKey(host);
      if (key) currMap.set(key, host);
    }

    for (const [key, host] of currMap) {
      if (!prevMap.has(key)) {
        const type: EventType = seenBeforePrev.has(key)
          ? 'cameback'
          : host.trusted === false
            ? 'new_untrusted'
            : 'new';
        events.push({
          id: `${curr.id}-${type}-${key}`,
          type,
          timestamp: curr.scanned_at,
          scanId: curr.id,
          device: toDevice(host),
        });
      }
    }

    for (const [key, host] of prevMap) {
      if (!currMap.has(key)) {
        events.push({
          id: `${curr.id}-absent-${key}`,
          type: 'absent',
          timestamp: curr.scanned_at,
          scanId: curr.id,
          device: toDevice(host),
        });
      }
    }

    for (const host of prevHosts) {
      const key = hostKey(host);
      if (key) seenBeforePrev.add(key);
    }
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}
