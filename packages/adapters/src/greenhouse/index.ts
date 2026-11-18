import type { NormalizedJob } from '@cv-pilot/contracts';
import { htmlToText, matchesKeywords } from '../http';
import type { JobSourceAdapter } from '../types';

/**
 * Greenhouse: Job Board API pública (boards-api.greenhouse.io).
 * A busca é por empresa: os "board tokens" ficam em Source.config.boards.
 * Ex.: { "boards": ["nubank", "quintoandar"] }
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

  async *search(query, ctx) {
    const boards = Array.isArray(ctx.config.boards) ? (ctx.config.boards as string[]) : [];
    if (!boards.length) ctx.log('Greenhouse sem boards configurados em Source.config.boards');

    let count = 0;
    for (const board of boards) {
      const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`;
      const body = (await (await ctx.http(url)).json()) as { jobs?: Omit<GreenhouseRawJob, '_board'>[] };
      for (const job of body.jobs ?? []) {
        if (!matchesKeywords(job.title, query.keywords)) continue;
        yield { ...job, _board: board };
        if (++count >= ctx.maxResults) return;
      }
    }
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
