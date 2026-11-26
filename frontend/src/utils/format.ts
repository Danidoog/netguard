function parseDate(iso: string): Date {
  if (!iso) return new Date(NaN);
  let normalized = iso.trim();
  // Si es formato SQL sin 'T' (YYYY-MM-DD HH:MM:SS), reemplazar el espacio por 'T'
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(normalized)) {
    normalized = normalized.replace(' ', 'T');
  }
  // Si no tiene sufijo de zona horaria (Z o +/-HH:MM), asumir UTC
  if (!normalized.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(normalized)) {
    if (normalized.includes('T')) {
      normalized += 'Z';
    }
  }
  return new Date(normalized);
}

export function formatRelativeTime(iso: string): string {
  const date = parseDate(iso);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';

  const diffMs = date.getTime() - Date.now();
  const absDiff = Math.abs(diffMs);

  // Si la diferencia es menor a 45 segundos
  if (absDiff < 45_000) {
    return diffMs > 0 ? 'En breve' : 'Ahora';
  }

  // Fechas futuras (ej. próximo escaneo)
  if (diffMs > 0) {
    const minutes = Math.round(diffMs / 60_000);
    if (minutes < 60) return `En ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `En ${hours} h`;
    const days = Math.round(hours / 24);
    if (days < 7) return `En ${days} d`;
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  }

  // Fechas pasadas (ej. último escaneo)
  const elapsedMs = -diffMs;
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} d`;
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

export function formatDateTime(iso: string): string {
  const date = parseDate(iso);
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
}

export function formatDate(iso: string): string {
  const date = parseDate(iso);
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatTime(iso: string): string {
  const date = parseDate(iso);
  return Number.isNaN(date.getTime())
    ? 'Hora no disponible'
    : date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
