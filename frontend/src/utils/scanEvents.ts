import type { Host, ScanHistoryItem } from '../types/scan.types';

export interface ScanEvents {
  newDevices: Host[];
  absentDevices: Host[];
  returnedDevices: Host[];
  changedPorts: Array<{
    host: Host;
    previousPorts: number[];
    currentPorts: number[];
  }>;
}

function sortedPorts(host: Host): number[] {
  return [...(host.open_ports || [])].sort((a, b) => a - b);
}

export function calculateScanEvents(
  currentHosts: Host[],
  previousHosts?: Host[],
  previouslySeenHosts: Host[] = [],
): ScanEvents {
  const empty: ScanEvents = {
    newDevices: [],
    absentDevices: [],
    returnedDevices: [],
    changedPorts: [],
  };
  if (previousHosts === undefined) return empty;

  const previousByMac = new Map(previousHosts.map((host) => [host.mac.toUpperCase(), host]));
  const currentMacs = new Set(currentHosts.map((host) => host.mac.toUpperCase()));
  const previouslySeenMacs = new Set(previouslySeenHosts.map((host) => host.mac.toUpperCase()));
  const events: ScanEvents = {
    newDevices: [],
    absentDevices: previousHosts.filter((host) => !currentMacs.has(host.mac.toUpperCase())),
    returnedDevices: [],
    changedPorts: [],
  };

  for (const host of currentHosts) {
    const mac = host.mac.toUpperCase();
    const previous = previousByMac.get(mac);
    if (previous) {
      const previousPorts = sortedPorts(previous);
      const currentPorts = sortedPorts(host);
      if (JSON.stringify(previousPorts) !== JSON.stringify(currentPorts)) {
        events.changedPorts.push({ host, previousPorts, currentPorts });
      }
    } else if (previouslySeenMacs.has(mac)) {
      events.returnedDevices.push(host);
    } else {
      events.newDevices.push(host);
    }
  }
  return events;
}

export function calculateScanEventsForHistory(
  scans: ScanHistoryItem[],
): Record<number, ScanEvents> {
  const chronological = [...scans].sort(
    (a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime() || a.id - b.id,
  );
  const events: Record<number, ScanEvents> = {};
  const seenBeforePrevious = new Map<string, Host>();

  chronological.forEach((scan, index) => {
    const currentHosts = scan.hosts || [];
    const previousHosts = index > 0 ? chronological[index - 1].hosts || [] : undefined;
    events[scan.id] = calculateScanEvents(
      currentHosts,
      previousHosts,
      [...seenBeforePrevious.values()],
    );
    if (previousHosts) {
      for (const host of previousHosts) seenBeforePrevious.set(host.mac.toUpperCase(), host);
    }
  });
  return events;
}
