import type { NormalizedJob } from '@cv-pilot/contracts';
import { boardFrom, firstPathSegment } from '../board-token';
import { htmlToText } from '../http';
import type { JobSourceAdapter } from '../types';

/**
 * Greenhouse: Job Board API pública (boards-api.greenhouse.io).
 * A busca é por empresa: cada board token ("nubank", "gitlab") é um CareerBoard.
 */
export interface GreenhouseRawJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  content?: string;
  updated_at?: string;
  company_name?: string;
  _board: string;
}

export const greenhouseAdapter: JobSourceAdapter<GreenhouseRawJob> = {
  id: 'greenhouse',
  displayName: 'Greenhouse',
  kind: 'api',

  fetchBy: 'board',

  async *fetch(board, ctx) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`;
    const body = (await (await ctx.http(url)).json()) as {
      jobs?: Omit<GreenhouseRawJob, '_board'>[];
    };
    for (const job of (body.jobs ?? []).slice(0, ctx.maxResults)) {
      yield { ...job, _board: board };
    }
  },

  /**
   * boards.greenhouse.io/<token>, job-boards.greenhouse.io/<token>, o embed
   * (boards.greenhouse.io/embed/job_board?for=<token>) e a própria API. Os boards da região
   * europeia (*.eu.greenhouse.io) ficam de fora: a API que o adapter lê é outra.
   */
  recognize(url) {
    if (url.hostname === 'boards-api.greenhouse.io') {
      return boardFrom(/^\/v1\/boards\/([^/]+)/.exec(url.pathname)?.[1]);
    }
    if (url.hostname !== 'boards.greenhouse.io' && url.hostname !== 'job-boards.greenhouse.io') {
      return null;
    }
    if (url.pathname.startsWith('/embed/')) return boardFrom(url.searchParams.get('for'));
    return boardFrom(firstPathSegment(url));
  },

  normalize(raw): NormalizedJob {
    const location = raw.location?.name ?? null;
    return {
      sourceId: 'greenhouse',
      externalId: `${raw._board}:${raw.id}`,
      url: raw.absolute_url,
      title: raw.title,
      company: raw.company_name ?? raw._board,
      location,
      workModel: location && /remote|remoto/i.test(location) ? 'remote' : null,
      description: htmlToText(raw.content ?? ''),
      publishedAt: raw.updated_at ? new Date(raw.updated_at) : null,
    };
  },

  // TODO: envio via API (POST /v1/boards/{board}/jobs/{id}) exige chave da empresa;
  // por padrão usamos o modo assistido.
  apply: {
    modes: ['assisted'],
    async submit() {
      return { status: 'needs_action', reason: 'other', detail: 'Greenhouse: envio assistido' };
    },
  },
};
