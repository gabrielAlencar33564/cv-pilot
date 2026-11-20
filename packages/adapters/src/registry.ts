import { greenhouseAdapter } from './greenhouse';
import { gupyAdapter } from './gupy';
import { leverAdapter } from './lever';
import { nerdinAdapter } from './nerdin';
import { programathorAdapter } from './programathor';
import { solidesAdapter } from './solides';
import { totvsAdapter } from './totvs';
import type { AtsRecognition, JobSourceAdapter } from './types';

/**
 * Registro de adapters. Para adicionar um site:
 * 1. crie src/<site>/index.ts implementando JobSourceAdapter
 * 2. adicione aqui
 * 3. cadastre a fonte (tabela Source) via seed ou admin
 */
const adapters: JobSourceAdapter<unknown>[] = [
  gupyAdapter,
  greenhouseAdapter,
  leverAdapter,
  nerdinAdapter,
  programathorAdapter,
  solidesAdapter,
  totvsAdapter,
];

const byId = new Map(adapters.map((a) => [a.id, a]));

export function getAdapter(id: string): JobSourceAdapter<unknown> {
  const adapter = byId.get(id);
  if (!adapter) throw new Error(`Adapter não registrado: ${id}`);
  return adapter;
}

/** Uma fonte reconhecida num endereço: a empresa (board) ou a fonte inteira (covered). */
export type AtsMatch = AtsRecognition & { sourceId: string };

/** Qual fonte, se alguma, o endereço é. Endereço inválido ou fora de http(s) não é nenhuma. */
export function recognizeAtsUrl(href: string): AtsMatch | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null; // texto que só parece um link, dentro de uma página
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  for (const adapter of adapters) {
    const recognition = adapter.recognize?.(url);
    if (recognition) return { ...recognition, sourceId: adapter.id };
  }
  return null;
}

/** Links absolutos em atributos, scripts e JSON (com as barras escapadas como "\/"). */
const ABSOLUTE_URL = /https?:\/\/[^\s"'<>()\\]+/g;
/** Teto de fontes distintas guardadas de uma página; o processor usa só a primeira. */
const MAX_MATCHES = 10;

/**
 * As fontes que uma página de carreiras usa: os links e embeds de ATS que aparecem no HTML,
 * sem repetir e na ordem em que aparecem.
 */
export function findAtsInHtml(html: string): AtsMatch[] {
  const found = new Map<string, AtsMatch>();
  for (const [href] of html.replaceAll('\\/', '/').matchAll(ABSOLUTE_URL)) {
    const match = recognizeAtsUrl(href.replaceAll('&amp;', '&'));
    if (!match) continue;
    const key = match.kind === 'board' ? `${match.sourceId}:${match.token}` : match.sourceId;
    if (!found.has(key)) found.set(key, match);
    if (found.size >= MAX_MATCHES) break;
  }
  return [...found.values()];
}
