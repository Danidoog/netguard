import { useEffect, useState } from 'react';

interface ToastProps {
  message?: string;
  duration?: number;
}

export function Toast({ message = '✓ Copiado al portapapeles', duration = 2000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timer);
  }, [duration]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 right-4 z-50 rounded-lg border border-surface-border bg-surface-light px-4 py-3 text-sm text-text shadow-lg"
    >
      {message}
    </div>
  );
}
