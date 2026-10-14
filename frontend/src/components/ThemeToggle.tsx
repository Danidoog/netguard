import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeToggleProps {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  onChange: (preference: ThemePreference) => void;
}

const options: { value: ThemePreference; label: string; icon: string }[] = [
  { value: 'light', label: 'Claro', icon: '☀️' },
  { value: 'dark', label: 'Oscuro', icon: '🌙' },
  { value: 'system', label: 'Sistema', icon: '💻' },
];

export function ThemeToggle({ preference, resolvedTheme, onChange }: ThemeToggleProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  const currentIcon = resolvedTheme === 'dark' ? '🌙' : '☀️';

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Cambiar tema"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-surface-border bg-surface-light text-lg shadow-lg transition-colors hover:bg-surface-lighter"
      >
        {currentIcon}
      </button>
      {isOpen && (
        <div
          role="menu"
          aria-label="Preferencia de tema"
          className="absolute bottom-12 right-0 w-40 rounded-xl border border-surface-border bg-surface-light p-1.5 shadow-xl"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={preference === option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                preference === option.value
                  ? 'bg-primary/10 text-primary-text'
                  : 'text-text hover:bg-surface-lighter'
              }`}
            >
              <span aria-hidden="true">{option.icon}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
