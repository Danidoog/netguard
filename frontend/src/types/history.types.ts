export type EventType = 'new' | 'new_untrusted' | 'absent' | 'cameback';

export interface HistoryEventDevice {
  mac: string;
  ip: string | null;
  hostname: string | null;
  vendor: string | null;
  trusted?: boolean;
}

export interface HistoryEvent {
  id: string;
  type: EventType;
  timestamp: string;
  scanId: number;
  device: HistoryEventDevice;
}
