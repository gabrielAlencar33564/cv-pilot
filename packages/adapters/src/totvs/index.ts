import { load } from 'cheerio';
import { boardFrom, firstPathSegment } from '../board-token';
import { SourceHttpError } from '../http';
import { listedJobDetail, normalizeListedJob, squash, type ListedJob } from '../listed-job';
import type { JobSourceAdapter } from '../types';

/**
 * TOTVS Atração de Talentos (o ATS por trás do portal Novo Trampo). Cada empresa tem uma
 * página com todas as vagas abertas (`/<empresa>`), e cada vaga, um JobPosting em JSON-LD. O
 * robots.txt não restringe nada para `*`. Ficha: docs/fontes/novotrampo.md.
 */
const HOST = 'atracaodetalentos.totvs.app';
const BASE = `https://${HOST}/`;

/** Os cards da página de uma empresa. O id da vaga só é único dentro da empresa. */
export function parseTotvsBoard(board: string, html: string): ListedJob[] {
  const $ = load(html);
  return $('.index__job-opportunities__grid__item[data-code]')
    .toArray()
    .flatMap((element) => {
      const card = $(element);
      const code = card.attr('data-code');
      const href = card.find('a.index__job-opportunity-name').attr('href');
      if (!code || !href) return [];
      const city = squash(card.attr('data-city-name') ?? '');
      const state = squash(card.attr('data-state-small-name') ?? '');
      return [
        {
          id: `${board}:${code}`,
          url: new URL(href, BASE).href,
          title: squash(card.attr('data-title') ?? card.find('a').text()),
          // o nome da empresa vem do JSON-LD da vaga
          company: null,
          location: [city, state].filter(Boolean).join(' - ') || null,
          terms: [],
        },
      ];
    });
}

export const totvsAdapter: JobSourceAdapter<ListedJob> = {
  id: 'totvs',
  displayName: 'TOTVS Atração de Talentos',
  kind: 'html',
  fetchBy: 'board',

  async *fetch(board, ctx) {
    const url = `${BASE}${encodeURIComponent(board)}`;
    const res = await ctx.http(url, { headers: { Accept: 'text/html' } });
    // empresa que não existe (ou saiu da TOTVS) redireciona para a home com ?status=404
    if (new URL(res.url || url).searchParams.get('status') === '404') {
      throw new SourceHttpError(404, url);
    }
    yield* parseTotvsBoard(board, await res.text()).slice(0, ctx.maxResults);
  },

  detail: listedJobDetail,
  normalize: (raw) => normalizeListedJob('totvs', raw),

  /** atracaodetalentos.totvs.app/<empresa>, inclusive o link de uma vaga dela. */
  recognize(url) {
    return url.hostname === HOST ? boardFrom(firstPathSegment(url)) : null;
  },

  apply: {
    modes: ['assisted'],
    async submit() {
      // a candidatura é na Central do Candidato da TOTVS, com a conta do candidato
      return { status: 'needs_action', reason: 'login', detail: 'TOTVS: envio assistido' };
    },
  },
};
