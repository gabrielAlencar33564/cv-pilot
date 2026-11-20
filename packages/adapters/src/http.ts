import { MAX_ROBOTS_BYTES, isPathAllowed, rulesFor } from './robots';

/** Nome do bot no User-Agent; é por ele que o robots.txt de cada site escolhe as regras. */
const BOT_TOKEN = 'CVPilotBot';
const USER_AGENT = `${BOT_TOKEN}/0.1 (+https://cvpilot.example/bot)`;
const DEFAULT_TIMEOUT_MS = 20_000;
/** O mesmo teto de redirecionamentos que a RFC 9309 pede para o robots.txt. */
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Espera a vez de chamar o host. O worker injeta um limite compartilhado entre as réplicas
 * (Redis): este pacote não importa a fila nem o banco.
 */
export type HostThrottle = (host: string) => Promise<void>;

/**
 * Guarda o robots.txt de cada origem (esquema + host + porta). O worker injeta um cache
 * compartilhado entre as réplicas (Redis), para o arquivo não ser baixado a cada job.
 * `''` quer dizer que o site não tem robots.txt (4xx): nada é proibido.
 */
export interface RobotsCache {
  get(origin: string): Promise<string | null>;
  set(origin: string, body: string): Promise<void>;
}

/** O site recusou o bot (403). O bot para; nunca tenta contornar o bloqueio. */
export class SourceBlockedError extends Error {
  constructor(public readonly host: string) {
    super(`Bloqueado por ${host} (HTTP 403). Não tentar burlar.`);
    this.name = 'SourceBlockedError';
  }
}

/** O robots.txt do site não permite o caminho. O bot para, como num 403 (RNF-06). */
export class SourceDisallowedError extends Error {
  constructor(
    public readonly host: string,
    public readonly path: string,
  ) {
    super(`O robots.txt de ${host} não permite ${path}`);
    this.name = 'SourceDisallowedError';
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

/** Outra resposta HTTP de erro. Sobe para o BullMQ repetir; o status permite tratar um 404. */
export class SourceHttpError extends Error {
  constructor(
    public readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} em ${url}`);
    this.name = 'SourceHttpError';
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

interface PoliteFetchOptions {
  throttle: HostThrottle;
  robots: RobotsCache;
  timeoutMs?: number;
  /**
   * Para endereços que vêm do usuário: roda antes de cada requisição, inclusive do robots.txt
   * e de cada redirecionamento, que passam a ser seguidos aqui, um por um, em vez de pelo fetch.
   */
  guard?: (url: URL) => Promise<void>;
}

/**
 * Cria um fetch "educado": confere o robots.txt, identifica o bot, aplica timeout e respeita a
 * vez de cada host. 403 e 429 viram erros tipados, para o worker pausar a fonte ou adiar o job.
 */
export function createPoliteFetch({
  throttle,
  robots,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  guard,
}: PoliteFetchOptions) {
  async function request(url: URL, init: RequestInit, accept: string) {
    await guard?.(url);
    await throttle(url.host);
    const res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, Accept: accept, ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
      ...(guard && { redirect: 'manual' as const }),
    });
    if (res.status === 429) {
      throw new SourceRateLimitedError(
        url.host,
        parseRetryAfter(res.headers.get('retry-after'), Date.now()),
      );
    }
    return res;
  }

  /** Com a guarda, o próximo endereço de um redirecionamento; sem ela, o fetch já seguiu. */
  function redirectTarget(res: Response, from: URL, hops: number): URL | null {
    const location = res.headers.get('location');
    if (!guard || !REDIRECT_STATUSES.has(res.status) || !location) return null;
    if (hops >= MAX_REDIRECTS) throw new Error(`redirecionamentos demais a partir de ${from.host}`);
    return new URL(location, from);
  }

  /**
   * RFC 9309: 4xx quer dizer que não há regras; 5xx ou falha de rede, que o site está
   * inacessível, e aí nada é acessado. O erro sobe e o BullMQ tenta de novo mais tarde.
   */
  async function loadRules(origin: URL) {
    const cached = await robots.get(origin.origin);
    if (cached !== null) return rulesFor(cached, BOT_TOKEN);

    let url = new URL('/robots.txt', origin);
    let res = await request(url, {}, 'text/plain');
    for (let hops = 0, next = redirectTarget(res, url, hops); next;) {
      url = next;
      res = await request(url, {}, 'text/plain');
      next = redirectTarget(res, url, ++hops);
    }
    if (res.status >= 500) {
      throw new Error(`robots.txt de ${origin.host} indisponível (HTTP ${res.status})`);
    }
    const body = res.ok ? (await res.text()).slice(0, MAX_ROBOTS_BYTES) : '';
    await robots.set(origin.origin, body);
    return rulesFor(body, BOT_TOKEN);
  }

  // um job pede várias páginas do mesmo site: o robots.txt é lido uma vez por instância.
  // Uma falha aqui encerra o job, e o próximo cria outra instância.
  const rulesByOrigin = new Map<string, ReturnType<typeof loadRules>>();
  function rulesOf(url: URL) {
    let rules = rulesByOrigin.get(url.origin);
    if (!rules) {
      rules = loadRules(url);
      rulesByOrigin.set(url.origin, rules);
    }
    return rules;
  }

  async function fetchAllowed(url: URL, init: RequestInit, hops: number): Promise<Response> {
    const path = url.pathname + url.search;
    if (!isPathAllowed(await rulesOf(url), path)) throw new SourceDisallowedError(url.host, path);

    const res = await request(url, init, 'application/json');
    // cada destino de um redirecionamento passa de novo pelo robots.txt dele
    const next = redirectTarget(res, url, hops);
    if (next) return fetchAllowed(next, init, hops + 1);
    if (res.status === 403) throw new SourceBlockedError(url.host);
    if (!res.ok) throw new SourceHttpError(res.status, url.href);
    return res;
  }

  return function politeFetch(href: string, init: RequestInit = {}) {
    return fetchAllowed(new URL(href), init, 0);
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
