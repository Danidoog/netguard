// frontend/src/components/StatCard.tsx
import type { ReactNode } from 'react';

interface StatCardProps {
  label: ReactNode;
  value: string | number;
  change?: string;
  note?: string;
  icon?: string;
  color?: 'blue' | 'green' | 'purple' | 'amber';
}

const colorClasses = {
  blue: 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-primary/20 dark:bg-primary/10 dark:text-primary-light',
  green: 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400',
  purple: 'border-amber-200 bg-amber-100 text-amber-700 dark:border-secondary/20 dark:bg-secondary/10 dark:text-secondary-light',
  amber: 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400',
};

export function StatCard({ label, value, change, note, icon, color = 'blue' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-light p-5 transition-colors hover:border-primary/40">
      {(icon || change) && (
        <div className="mb-3 flex items-start justify-between">
          {icon && <div aria-hidden="true" className={`flex h-10 w-10 items-center justify-center rounded-lg border ${colorClasses[color]}`}>{icon}</div>}
          {change && <span className="text-xs text-text-muted">{change}</span>}
        </div>
      )}
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-text">{value}</p>
      {note && <p className="mt-1 text-xs text-text-muted">{note}</p>}
    </div>
  );
}