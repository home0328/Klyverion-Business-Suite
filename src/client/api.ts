// Token is kept strictly in JS memory (never stored in localStorage or sessionStorage)
let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code = 'API_ERROR', status = 500, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const res = await fetch(`/api/v1${path}`, {
    ...options,
    headers,
  });

  let json: { ok: boolean; data?: T; error?: { code?: string; message?: string; details?: unknown } };
  try {
    json = await res.json();
  } catch {
    throw new ApiError('Resposta inválida do servidor.', 'INVALID_JSON', res.status);
  }

  if (!res.ok || !json.ok) {
    throw new ApiError(
      json.error?.message || 'Erro ao comunicar com o Klyverion Core.',
      json.error?.code || 'REQUEST_FAILED',
      res.status,
      json.error?.details
    );
  }

  return json.data as T;
}
