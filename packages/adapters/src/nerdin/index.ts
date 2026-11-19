import { load } from 'cheerio';
import {
  listedJobDetail,
  normalizeListedJob,
  paginateListing,
  squash,
  type ListedJob,
} from '../listed-job';
import type { JobSourceAdapter } from '../types';

/**
 * Nerdin: vagas de TI publicadas no próprio site. A listagem (`/vagas.php?pagina=N`) é lida
 * inteira a cada rodada e a página de cada vaga traz um JobPosting em JSON-LD. O robots.txt
 * libera as duas e bloqueia a candidatura. Ficha: docs/fontes/nerdin.md.
 */
const BASE = 'https://www.nerdin.com.br/';

const splitBullets = (text: string) => text.split('•').map(squash).filter(Boolean);

/** Os cards de uma página da listagem. */
export function parseNerdinListing(html: string): ListedJob[] {
  const $ = load(html);
  return $('div.vaga-card[data-href]')
    .toArray()
    .flatMap((element) => {
      const card = $(element);
      const href = card.attr('data-href') ?? '';
      const id = /-(\d+)\.php$/.exec(href)?.[1];
      if (!id) return [];
      // o título traz o selo "Nova" num span dentro do h3
      const title = squash(card.find('h3.vaga-titulo').clone().children().remove().end().text());
      return [
        {
          id,
          url: new URL(href, BASE).href,
          title,
          company: squash(card.find('.vaga-empresa-nome').text()) || null,
          location: splitBullets(card.find('.vaga-local-linha span').text()).join(' - ') || null,
          terms: splitBullets(card.find('p.vaga-resumo-linha').text()),
        },
      ];
    });
}

export const nerdinAdapter: JobSourceAdapter<ListedJob> = {
  id: 'nerdin',
  displayName: 'Nerdin',
  kind: 'html',
  fetchBy: 'feed',

  fetch: (_target, ctx) =>
    paginateListing((page) => `${BASE}vagas.php?pagina=${page}`, parseNerdinListing, ctx),

  detail: listedJobDetail,
  normalize: (raw) => normalizeListedJob('nerdin', raw),

  apply: {
    modes: ['assisted'],
    async submit() {
      // o robots.txt bloqueia /vaga_candidatura.php: só o candidato envia, pela extensão
      return { status: 'needs_action', reason: 'login', detail: 'Nerdin: envio assistido' };
    },
  },
};
