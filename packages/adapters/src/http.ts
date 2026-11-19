const USER_AGENT = 'CVPilotBot/0.1 (+https://cvpilot.example/bot)';
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Espera a vez de chamar o host. O worker injeta um limite compartilhado entre as réplicas
 * (Redis): este pacote não importa a fila nem o banco.
 */
export type HostThrottle = (host: string) => Promise<void>;

/** O site recusou o bot (403). O bot para; nunca tenta contornar o bloqueio. */
export class SourceBlockedError extends Error {
  constructor(public readonly host: string) {
    super(`Bloqueado por ${host} (HTTP 403). Não tentar burlar.`);
    this.name = 'SourceBlockedError';
  }
}

/** O site pediu para esperar (429). `retryAfterMs` é null quando ele não diz quanto. */
export class SourceRateLimitedError extends Error {
  constructor(
    public readonly host: string,
    public readonly retryAfterMs: number | null,
  ) {
    super(`Limite de requisições de ${host} (HTTP 429)`);
    this.name = 'SourceRateLimitedError';
  }
}

/** `Retry-After` em segundos ou como data HTTP; null quando ausente ou inválido. */
export function parseRetryAfter(header: string | null, now: number): number | null {
  const value = header?.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

/**
 * Cria um fetch "educado": identifica o bot, aplica timeout e respeita a vez de cada host.
 * 403 e 429 viram erros tipados, para o worker pausar a fonte ou adiar o job.
 */
export function createPoliteFetch(throttle: HostThrottle, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return async function politeFetch(url: string, init: RequestInit = {}) {
    const host = new URL(url).host;
    await throttle(host);

    const res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 403) throw new SourceBlockedError(host);
    if (res.status === 429) {
      throw new SourceRateLimitedError(
        host,
        parseRetryAfter(res.headers.get('retry-after'), Date.now()),
      );
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
    return res;
  };
}

/** Remove tags HTML e decodifica entidades básicas. */
export function htmlToText(html: string): string {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
