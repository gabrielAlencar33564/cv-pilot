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
 * ProgramaThor: vagas de tecnologia publicadas no próprio site. A listagem (`/jobs`,
 * `/jobs/page/N`) é lida inteira a cada rodada e a página de cada vaga traz um JobPosting em
 * JSON-LD. O robots.txt libera `/jobs` e bloqueia os perfis. Ficha: docs/fontes/programathor.md.
 */
const BASE = 'https://programathor.com.br';
/** No card, o local "Remoto" é o modelo de trabalho, não uma cidade. */
const REMOTE_LOCATION = /^remoto$/i;

const pageUrl = (page: number) => (page === 1 ? `${BASE}/jobs` : `${BASE}/jobs/page/${page}`);

/** Os cards de uma página da listagem. Cada dado do card vem num span com um ícone próprio. */
export function parseProgramaThorListing(html: string): ListedJob[] {
  const $ = load(html);
  return $('div.cell-list > a[href^="/jobs/"]')
    .toArray()
    .flatMap((element) => {
      const card = $(element);
      const href = card.attr('href') ?? '';
      const id = /^\/jobs\/(\d+)-/.exec(href)?.[1];
      if (!id) return [];
      const spans = card
        .find('.cell-list-content-icon span')
        .toArray()
        .map((s) => $(s));
      const byIcon = (icon: string) =>
        squash(spans.find((s) => s.find(`i.${icon}`).length)?.text() ?? '') || null;
      const location = byIcon('fa-map-marker-alt');
      return [
        {
          id,
          url: new URL(href, BASE).href,
          title: squash(card.find('h3').first().text()),
          company: byIcon('fa-briefcase'),
          location: location && !REMOTE_LOCATION.test(location) ? location : null,
          terms: spans.map((s) => squash(s.text())).filter(Boolean),
        },
      ];
    });
}

export const programathorAdapter: JobSourceAdapter<ListedJob> = {
  id: 'programathor',
  displayName: 'ProgramaThor',
  kind: 'html',
  fetchBy: 'feed',

  fetch: (_target, ctx) => paginateListing(pageUrl, parseProgramaThorListing, ctx),

  detail: listedJobDetail,
  normalize: (raw) => normalizeListedJob('programathor', raw),

  apply: {
    modes: ['assisted'],
    async submit() {
      // a candidatura exige a conta do candidato no site
      return { status: 'needs_action', reason: 'login', detail: 'ProgramaThor: envio assistido' };
    },
  },
};
