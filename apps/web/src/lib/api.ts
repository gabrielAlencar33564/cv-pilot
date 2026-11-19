import { CONSENT_PATH, LOGIN_PATH } from './routes';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** URL completa de uma rota da API, para links que o navegador abre direto (arquivos, exportação). */
export const apiUrl = (path: string) => `${API_URL}${path}`;

/** Código do erro: `error` nas rotas da API, `code` nas rotas de login (Better Auth). */
function errorCode(status: number, body: unknown): string {
  if (typeof body === 'object' && body) {
    if ('error' in body) return String(body.error);
    if ('code' in body) return String(body.code);
  }
  return `HTTP ${status}`;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(errorCode(status, body));
  }
}

/** Cliente HTTP da API. A sessão vai no cookie httpOnly do login (`credentials: 'include'`). */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      // com FormData (upload), o navegador define o Content-Type com o boundary
      ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => null);
  if (typeof window !== 'undefined') {
    // sessão expirada ou encerrada em outra aba: volta para a entrada
    if (res.status === 401 && !path.startsWith('/auth/')) window.location.assign(LOGIN_PATH);
    // os termos mudaram e ainda não foram aceitos (RF-03)
    if (res.status === 403 && errorCode(res.status, body) === 'consent_required') {
      window.location.assign(CONSENT_PATH);
    }
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
