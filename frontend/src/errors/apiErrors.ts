// src/errors/apiErrors.ts

export type ErrorType =
  | 'NETWORK_ERROR'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

export class ApiError extends Error {
  type: ErrorType;
  statusCode?: number;
  code?: string;
  originalError?: unknown;

  constructor(
    message: string,
    type: ErrorType,
    statusCode?: number,
    code?: string,
    originalError?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.statusCode = statusCode;
    this.code = code;
    this.originalError = originalError;
  }
}

//  Extrae el mensaje del error del backend
function extractErrorMessage(data: any): { message: string; code?: string } {
  // Formato NetGuardError: { error: { code, message } }
  if (data?.error?.message) {
    return { message: data.error.message, code: data.error.code };
  }
  // Formato FastAPI: { detail: "..." }
  if (data?.detail) {
    if (typeof data.detail === 'string') return { message: data.detail };
    if (Array.isArray(data.detail) && data.detail[0]?.msg) {
      return { message: data.detail[0].msg };
    }
  }
  // Formato simple: { message: "..." }
  if (data?.message) return { message: data.message };
  return { message: '' };
}

export function handleApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new ApiError(
      'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.',
      'NETWORK_ERROR',
      undefined, undefined, error
    );
  }
  return new ApiError('Ocurrió un error inesperado.', 'UNKNOWN', undefined, undefined, error);
}

// ✅ Procesa la respuesta de error del backend
export async function processErrorResponse(response: Response): Promise<ApiError> {
  let data: any = {};
  try {
    const text = await response.text();
    // Intentar parsear como JSON
    try {
      data = JSON.parse(text);
    } catch {
      // No es JSON, es HTML o texto plano
      data = { message: text.substring(0, 200) };
    }
  } catch {
    data = {};
  }

  const { message, code } = extractErrorMessage(data);

  // ✅ Mensajes amigables según status HTTP
  let type: ErrorType = 'UNKNOWN';
  let friendlyMessage = '';

  switch (response.status) {
    case 400:
      type = 'VALIDATION_ERROR';
      friendlyMessage = 'Los datos enviados no son válidos.';
      break;
    case 404:
      type = 'NOT_FOUND';
      friendlyMessage = 'El recurso solicitado no existe.';
      break;
    case 502:
    case 503:
    case 504:
      type = 'SERVER_ERROR';
      friendlyMessage = 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.';
      break;
    default:
      if (response.status >= 500) {
        type = 'SERVER_ERROR';
        friendlyMessage = 'El servidor tuvo un problema. Intenta más tarde.';
      } else {
        friendlyMessage = 'Ocurrió un error inesperado.';
      }
  }

  // ✅ Si el backend envió un mensaje específico, usarlo. Si no, usar el amigable.
  const finalMessage = message && message !== 'Bad Gateway' ? message : friendlyMessage;

  return new ApiError(
    finalMessage,
    type,
    response.status,
    code
  );
}

export const ERROR_MESSAGES: Record<ErrorType, string> = {
  NETWORK_ERROR: 'No se pudo conectar con el servidor.',
  NOT_FOUND: 'El recurso solicitado no existe.',
  SERVER_ERROR: 'Error en el servidor. Intenta más tarde.',
  TIMEOUT: 'La operación tardó demasiado.',
  VALIDATION_ERROR: 'Los datos no son válidos.',
  UNKNOWN: 'Ocurrió un error inesperado.',
};