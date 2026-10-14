import { Info } from 'lucide-react';
import { HELP_TERMS } from '../constants/helpTerms';
import { Tooltip } from './Tooltip';

interface GlossaryInfoProps {
  termId: string;
  label?: string;
  className?: string;
}

export function GlossaryInfo({ termId, label, className = '' }: GlossaryInfoProps) {
  const term = HELP_TERMS.find((item) => item.id === termId);
  if (!term) return null;

  return (
    <a
      href={`/ayuda#${term.id}`}
      aria-label={`Más información: ${term.term}`}
      className={`inline-flex shrink-0 rounded-sm text-text-muted transition-colors hover:text-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      <Tooltip content={term.definition}>
        <span className="inline-flex cursor-pointer items-center gap-1.5">
          {label && <span>{label}</span>}
          <Info className="h-4 w-4" aria-hidden="true" />
        </span>
      </Tooltip>
    </a>
  );
}
