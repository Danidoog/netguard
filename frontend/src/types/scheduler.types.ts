export interface SchedulerConfig {
  enabled: boolean;
  interval_minutes: number;
  target: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  updated_at: string | null;
  scheduler_running: boolean;
}

export interface SchedulerConfigUpdate {
  enabled?: boolean;
  interval_minutes?: number;
  target?: string | null;
}

export interface ScanTask {
  id: string;
  target: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  scan_id: number | null;
  result: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
}

