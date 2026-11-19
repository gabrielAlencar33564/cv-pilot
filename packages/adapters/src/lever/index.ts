import type { NormalizedJob } from '@cv-pilot/contracts';
import type { JobSourceAdapter } from '../types';

/**
 * Lever: Postings API pública (api.lever.co/v0/postings/{empresa}).
 * Cada empresa (slug em jobs.lever.co/<empresa>) é um CareerBoard.
 */
export interface LeverRawJob {
  id: string;
  text: string;
  hostedUrl: string;
  categories?: { location?: string; commitment?: string; team?: string };
  descriptionPlain?: string;
  createdAt?: number;
  workplaceType?: 'remote' | 'hybrid' | 'onsite' | 'unspecified';
  _company: string;
}

export const leverAdapter: JobSourceAdapter<LeverRawJob> = {
  id: 'lever',
  displayName: 'Lever',
  kind: 'api',

  fetchBy: 'board',

  async *fetch(company, ctx) {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`;
    const jobs = (await (await ctx.http(url)).json()) as Omit<LeverRawJob, '_company'>[];
    for (const job of jobs.slice(0, ctx.maxResults)) {
      yield { ...job, _company: company };
    }
  },

  normalize(raw): NormalizedJob {
    const wm = raw.workplaceType;
    return {
      sourceId: 'lever',
      externalId: raw.id,
      url: raw.hostedUrl,
      title: raw.text,
      company: raw._company,
      location: raw.categories?.location ?? null,
      workModel: wm && wm !== 'unspecified' ? wm : null,
      description: raw.descriptionPlain ?? '',
      publishedAt: raw.createdAt ? new Date(raw.createdAt) : null,
    };
  },

  apply: {
    modes: ['assisted'],
    async submit() {
      return { status: 'needs_action', reason: 'other', detail: 'Lever: envio assistido' };
    },
  },
};
