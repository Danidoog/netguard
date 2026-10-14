export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';

  const elapsedMs = Date.now() - date.getTime();
  if (elapsedMs < 60_000) return 'Ahora';
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} d`;
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString('es-ES');
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'Hora no disponible'
    : date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
