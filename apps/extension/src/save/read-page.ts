/** O que a extensão lê da página aberta para salvar a vaga (ADR 0011). */
export interface PageSnapshot {
  url: string;
  title: string;
  /** conteúdo dos `<script type="application/ld+json">`, onde os sites descrevem a vaga */
  jsonLd: string[];
  ogTitle: string | null;
  siteName: string | null;
  h1: string | null;
  metaDescription: string | null;
}

/**
 * Roda dentro da página (`chrome.scripting.executeScript({ func })`), que recebe só o texto da
 * função: nada aqui pode usar o que está fora dela.
 */
export function readPage(): PageSnapshot {
  const MAX_LD_BLOCKS = 20;
  const meta = (selector: string) =>
    document.querySelector<HTMLMetaElement>(selector)?.content.trim() || null;
  return {
    url: location.href,
    title: document.title,
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')]
      .slice(0, MAX_LD_BLOCKS)
      .map((script) => script.textContent ?? ''),
    ogTitle: meta('meta[property="og:title"]'),
    siteName: meta('meta[property="og:site_name"]'),
    h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim() || null,
    metaDescription: meta('meta[name="description"]'),
  };
}
