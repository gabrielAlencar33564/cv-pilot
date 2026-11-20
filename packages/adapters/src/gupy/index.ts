import type { ContractType, NormalizedJob, WorkModel } from '@cv-pilot/contracts';
import { htmlToText } from '../http';
import type { JobSourceAdapter } from '../types';

/**
 * Gupy: usa o endpoint público que o próprio portal (portal.gupy.io) consome.
 * Verificado em 2026-11-18. Antes de produção, confirmar os termos de uso.
 * Envio: somente modo assistido (o formulário exige login do candidato).
 */
export interface GupyRawJob {
  id: number;
  name: string;
  description?: string;
  careerPageName?: string;
  jobUrl: string;
  type?: string;
  workplaceType?: 'remote' | 'hybrid' | 'on-site';
  city?: string;
  state?: string;
  publishedDate?: string;
  applicationDeadline?: string;
}

const BASE = 'https://portal.gupy.io/api/job-search/jobs';
const PAGE_SIZE = 50;

const workModelMap: Record<string, WorkModel> = {
  remote: 'remote',
  hybrid: 'hybrid',
  'on-site': 'onsite',
};

const contractMap: Record<string, ContractType> = {
  vacancy_type_effective: 'clt',
  vacancy_legal_entity: 'pj',
  vacancy_type_internship: 'internship',
  vacancy_type_temporary: 'temporary',
  vacancy_type_freelancer: 'freelance',
};

export const gupyAdapter: JobSourceAdapter<GupyRawJob> = {
  id: 'gupy',
  displayName: 'Gupy',
  kind: 'api',

  fetchBy: 'keyword',

  async *fetch(keyword, ctx) {
    const seen = new Set<number>();
    let offset = 0;
    while (seen.size < ctx.maxResults) {
      const url = `${BASE}?jobName=${encodeURIComponent(keyword)}&limit=${PAGE_SIZE}&offset=${offset}`;
      const body = (await (await ctx.http(url)).json()) as {
        data?: GupyRawJob[];
        pagination?: { total?: number };
      };
      const page = body.data ?? [];
      for (const job of page) {
        if (seen.has(job.id) || seen.size >= ctx.maxResults) continue;
        seen.add(job.id);
        yield job;
      }
      offset += PAGE_SIZE;
      if (page.length < PAGE_SIZE || offset >= (body.pagination?.total ?? 0)) break;
    }
  },

  /** <empresa>.gupy.io: a busca por palavra-chave já lê as vagas de todas as empresas. */
  recognize(url) {
    return url.hostname === 'gupy.io' || url.hostname.endsWith('.gupy.io')
      ? { kind: 'covered' }
      : null;
  },

  normalize(raw): NormalizedJob {
    return {
      sourceId: 'gupy',
      externalId: String(raw.id),
      url: raw.jobUrl,
      title: raw.name,
      company: raw.careerPageName ?? 'Não informado',
      location: [raw.city, raw.state].filter(Boolean).join(' - ') || null,
      workModel: raw.workplaceType ? (workModelMap[raw.workplaceType] ?? null) : null,
      contractType: raw.type ? (contractMap[raw.type] ?? null) : null,
      description: htmlToText(raw.description ?? ''),
      publishedAt: raw.publishedDate ? new Date(raw.publishedDate) : null,
    };
  },

  apply: {
    modes: ['assisted'],
    async submit() {
      return {
        status: 'needs_action',
        reason: 'login',
        detail: 'Gupy: envio assistido pela extensão',
      };
    },
  },
};
