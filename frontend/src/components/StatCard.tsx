import type { ReactNode } from 'react';

type Accent = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent: Accent;
  subtitle?: string;
  tooltip?: string;
  progress?: { current: number; total: number };
  badge?: { text: string; accent: Accent };
  change?: { text: string; tone: 'up' | 'down' | 'neutral' };
}

const accentBox: Record<Accent, string> = {
  blue: 'bg-primary/10 text-primary border-primary/20',
  green: 'bg-success/10 text-success border-success/20',
  amber: 'bg-warning/10 text-warning border-warning/20',
  red: 'bg-danger/10 text-danger border-danger/20',
  purple: 'bg-primary/10 text-primary border-primary/20',
  slate: 'bg-muted/10 text-muted border-surface-border',
};

const accentBar: Record<Accent, string> = {
  blue: 'bg-primary',
  green: 'bg-success',
  amber: 'bg-warning',
  red: 'bg-danger',
  purple: 'bg-primary',
  slate: 'bg-muted',
};

const changeTone: Record<'up' | 'down' | 'neutral', string> = {
  up: 'text-success',
  down: 'text-danger',
  neutral: 'text-muted',
};

export function StatCard({
  label,
  value,
  icon,
  accent,
  subtitle,
  tooltip,
  progress,
  badge,
  change,
}: StatCardProps) {
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;

  return (
    <div className="group relative bg-surface-light border border-surface-border rounded-xl p-5 hover:border-muted/40 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${accentBox[accent]}`}>
          {icon}
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${accentBox[badge.accent]}`}
            >
              {badge.text}
            </span>
          )}
          {tooltip && (
            <span className="relative">
              <button
                type="button"
                className="text-muted hover:text-white transition-colors"
                aria-label={`Qué significa ${label}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
              <span
                role="tooltip"
                className="pointer-events-none absolute right-0 top-6 z-20 w-56 rounded-lg border border-surface-border bg-surface px-3 py-2 text-xs text-muted shadow-xl opacity-0 translate-y-1 group-hover:opacity-100 group-focus-within:opacity-100 transition-all"
              >
                {tooltip}
              </span>
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-muted font-medium">{label}</p>
      <p className="text-2xl font-bold text-white mt-1 tracking-tight">{value}</p>

      {progress && progress.total > 0 && (
        <div className="mt-3">
          <div className="h-1.5 bg-surface-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${accentBar[accent]}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 min-h-[1.25rem]">
        {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : <span />}
        {change && (
          <span className={`text-xs font-medium shrink-0 ${changeTone[change.tone]}`}>
            {change.text}
          </span>
        )}
      </div>
    </div>
  );
}
