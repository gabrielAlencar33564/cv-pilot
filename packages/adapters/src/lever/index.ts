import type { NormalizedJob } from '@cv-pilot/contracts';
import { matchesKeywords } from '../http';
import type { JobSourceAdapter } from '../types';

/**
 * Lever: Postings API pública (api.lever.co/v0/postings/{empresa}).
 * Empresas configuradas em Source.config.companies.
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

  async *search(query, ctx) {
    const companies = Array.isArray(ctx.config.companies) ? (ctx.config.companies as string[]) : [];
    if (!companies.length) ctx.log('Lever sem empresas configuradas em Source.config.companies');

    let count = 0;
    for (const company of companies) {
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`;
      const jobs = (await (await ctx.http(url)).json()) as Omit<LeverRawJob, '_company'>[];
      for (const job of jobs) {
        if (!matchesKeywords(job.text, query.keywords)) continue;
        yield { ...job, _company: company };
        if (++count >= ctx.maxResults) return;
      }
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
