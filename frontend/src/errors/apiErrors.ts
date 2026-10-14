export type ErrorType =
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN';

export class ApiError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode?: number;
  public readonly code?: string;
  public readonly originalError?: unknown;

  constructor(
    message: string,
    type: ErrorType,
    statusCode?: number,
    code?: string,
    originalError?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.statusCode = statusCode;
    this.code = code;
    this.originalError = originalError;
  }
}

export class NetworkError extends ApiError {
  constructor(originalError?: unknown) {
    super(
      'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.',
      'NETWORK_ERROR',
      undefined,
      undefined,
      originalError,
    );
    this.name = 'NetworkError';
  }
}

export class ParseError extends ApiError {
  constructor(originalError?: unknown) {
    super('El servidor devolvió una respuesta inválida.', 'PARSE_ERROR', undefined, undefined, originalError);
    this.name = 'ParseError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function extractErrorMessage(data: unknown): { message: string; code?: string } {
  if (!isRecord(data)) return { message: '' };
  const error = data.error;
  if (isRecord(error)) {
    const message = stringValue(error.message);
    if (message) return { message, code: stringValue(error.code) };
  }
  const detail = data.detail;
  if (typeof detail === 'string') return { message: detail };
  if (Array.isArray(detail) && detail.length > 0 && isRecord(detail[0])) {
    const message = stringValue(detail[0].msg);
    if (message) return { message };
  }
  return { message: stringValue(data.message) || '' };
}

export async function processErrorResponse(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    const text = await response.text();
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { message: text.substring(0, 200) };
    }
  } catch {
    body = {};
  }

  const { message, code } = extractErrorMessage(body);
  let type: ErrorType = 'UNKNOWN';
  let fallbackMessage: string;

  switch (response.status) {
    case 400:
      type = 'VALIDATION_ERROR';
      fallbackMessage = 'Los datos enviados no son válidos.';
      break;
    case 404:
      type = 'NOT_FOUND';
      fallbackMessage = 'El recurso solicitado no existe.';
      break;
    case 502:
    case 503:
    case 504:
      type = 'SERVER_ERROR';
      fallbackMessage = 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.';
      break;
    default:
      if (response.status >= 500) {
        type = 'SERVER_ERROR';
        fallbackMessage = 'El servidor tuvo un problema. Intenta más tarde.';
      } else {
        fallbackMessage = 'Ocurrió un error inesperado.';
      }
  }

  const finalMessage = message && message !== 'Bad Gateway' ? message : fallbackMessage;
  return new ApiError(finalMessage, type, response.status, code);
}
