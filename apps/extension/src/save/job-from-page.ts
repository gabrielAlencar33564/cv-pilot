import type { ExtensionSaveJobInput } from '@cv-pilot/contracts';
import type { PageSnapshot } from './read-page';

const MAX_TITLE_CHARS = 200;
const MAX_DESCRIPTION_CHARS = 20_000;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

function parse(block: string): unknown {
  try {
    return JSON.parse(block);
  } catch {
    // JSON-LD quebrado é comum em sites de vaga: o bloco é só ignorado
    return null;
  }
}

/** Todos os objetos de um bloco JSON-LD: listas e `@graph` viram itens soltos. */
function nodesOf(value: unknown): Json[] {
  if (Array.isArray(value)) return value.flatMap(nodesOf);
  if (!isObject(value)) return [];
  return [value, ...nodesOf(value['@graph'])];
}

const isJobPosting = (node: Json) => {
  const type = node['@type'];
  return type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#39': "'",
  nbsp: ' ',
};

const decodeEntities = (value: string) =>
  value.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name] ?? '');

/** Tags que separam blocos de texto; as demais (`<b>`, `<a>`) somem sem deixar espaço. */
const BLOCK_TAG = /<\/?(br|p|div|li|ul|ol|h\d|tr|table|section)\b[^>]*>/gi;

/** A descrição do JSON-LD costuma vir em HTML: vira texto, com as quebras de parágrafo. */
function htmlToText(html: string): string {
  return decodeEntities(html.replace(BLOCK_TAG, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function companyOf(posting: Json): string {
  const org = posting.hiringOrganization;
  return decodeEntities(isObject(org) ? text(org.name) : text(org));
}

function locationOf(posting: Json): string | null {
  if (text(posting.jobLocationType) === 'TELECOMMUTE') return 'Remoto';
  const [place] = [posting.jobLocation].flat();
  const address = isObject(place) ? place.address : null;
  if (!isObject(address)) return null;
  const parts = [text(address.addressLocality), text(address.addressRegion)].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** O título da aba sem o nome do site ("Dev React | Acme" → "Dev React"). */
const titleWithoutSite = (title: string) => title.split(/\s+[|·–-]\s+/)[0]?.trim() ?? title;

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');

/**
 * A vaga da página, para o candidato conferir antes de salvar: do JSON-LD `JobPosting`, que
 * muitos sites de vaga publicam, ou, sem ele, do título da página e do nome do site.
 */
export function jobFromPage(page: PageSnapshot): ExtensionSaveJobInput & { structured: boolean } {
  const posting = page.jsonLd.map(parse).flatMap(nodesOf).find(isJobPosting);
  const fallbackTitle = page.h1 ?? page.ogTitle ?? titleWithoutSite(page.title);
  const title = (posting && decodeEntities(text(posting.title))) || fallbackTitle;
  const company = (posting && companyOf(posting)) || page.siteName || hostOf(page.url);
  const description = posting
    ? htmlToText(text(posting.description))
    : (page.metaDescription ?? '');

  return {
    url: page.url,
    title: title.slice(0, MAX_TITLE_CHARS),
    company: company.slice(0, MAX_TITLE_CHARS),
    location: posting ? locationOf(posting) : null,
    description: description.slice(0, MAX_DESCRIPTION_CHARS),
    structured: Boolean(posting),
  };
}
