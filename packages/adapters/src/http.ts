const USER_AGENT = 'CVPilotBot/0.1 (+https://cvpilot.example/bot)';
const lastCallByHost = new Map<string, number>();

/**
 * Cria um fetch "educado": identifica o bot, aplica timeout e
 * respeita um intervalo mínimo entre chamadas ao mesmo host.
 */
export function createPoliteFetch(minIntervalMs = 1500, timeoutMs = 20_000) {
  return async function politeFetch(url: string, init: RequestInit = {}) {
    const host = new URL(url).host;
    const wait = (lastCallByHost.get(host) ?? 0) + minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallByHost.set(host, Date.now());

    const res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 429 || res.status === 403) {
      throw new Error(`Bloqueado por ${host} (HTTP ${res.status}). Não tentar burlar.`);
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

export const matchesKeywords = (text: string, keywords: readonly string[]) => {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
};
