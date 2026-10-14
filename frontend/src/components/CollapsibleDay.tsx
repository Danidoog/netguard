import { useState, type ReactNode } from 'react';

interface CollapsibleDayProps {
  title: string;
  count: number;
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function CollapsibleDay({
  title,
  count,
  children,
  defaultExpanded = true,
}: CollapsibleDayProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = `day-content-${title.replace(/[^a-zA-Z0-9]+/g, '-')}`;

  return (
    <section className="overflow-hidden rounded-xl border border-surface-border bg-surface-light">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-lighter"
      >
        <span className="flex items-center gap-3">
          <span aria-hidden="true" className="w-4 text-xs text-text-muted">
            {expanded ? '▼' : '▶'}
          </span>
          <span className="text-sm font-semibold uppercase tracking-wide text-text-light">
            {title}
          </span>
        </span>
        <span className="rounded-full bg-surface-lighter px-2.5 py-1 text-xs font-medium text-text-light">
          {count} {count === 1 ? 'escaneo' : 'escaneos'}
        </span>
      </button>

      <div
        id={contentId}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="divide-y divide-surface-border border-t border-surface-border">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
