// Tipos de errores del frontend
export type ErrorType =
  | 'NETWORK_ERROR'      // No se pudo conectar
  | 'NOT_FOUND'          // Recurso no encontrado (404)
  | 'SERVER_ERROR'       // Error del servidor (500)
  | 'TIMEOUT'            // Tiempo de espera agotado
  | 'VALIDATION_ERROR'   // Datos inválidos
  | 'UNKNOWN';           // Error desconocido

// Error personalizado de la API
export class ApiError extends Error {
  type: ErrorType;
  statusCode?: number;
  originalError?: unknown;

  constructor(
    message: string,
    type: ErrorType,
    statusCode?: number,
    originalError?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

// Convertir errores desconocidos a ApiError
export function handleApiError(error: unknown): ApiError {
  // Si ya es un ApiError, devolverlo
  if (error instanceof ApiError) {
    return error;
  }

  // Error de red (fetch falla)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new ApiError(
      'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.',
      'NETWORK_ERROR',
      undefined,
      error
    );
  }

  // Error HTTP (de fetch)
  if (error instanceof Response) {
    if (error.status === 404) {
      return new ApiError(
        'El recurso solicitado no fue encontrado.',
        'NOT_FOUND',
        404,
        error
      );
    }
    if (error.status >= 500) {
      return new ApiError(
        'El servidor tuvo un problema. Intenta de nuevo más tarde.',
        'SERVER_ERROR',
        error.status,
        error
      );
    }
    if (error.status === 400) {
      return new ApiError(
        'Los datos enviados no son válidos.',
        'VALIDATION_ERROR',
        400,
        error
      );
    }
  }

  // Error genérico
  return new ApiError(
    'Ocurrió un error inesperado. Intenta de nuevo.',
    'UNKNOWN',
    undefined,
    error
  );
}

// Mensajes de error por tipo
export const ERROR_MESSAGES: Record<ErrorType, string> = {
  NETWORK_ERROR: 'No se pudo conectar con el servidor.',
  NOT_FOUND: 'El recurso solicitado no existe.',
  SERVER_ERROR: 'Error en el servidor. Intenta más tarde.',
  TIMEOUT: 'La operación tardó demasiado.',
  VALIDATION_ERROR: 'Los datos no son válidos.',
  UNKNOWN: 'Ocurrió un error inesperado.',
};