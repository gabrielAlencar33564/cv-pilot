import type { NormalizedJob } from '@cv-pilot/contracts';
import { z } from 'zod';
import { htmlToText } from '../http';
import { classifyListingTerms } from '../listing-terms';
import type { AdapterContext, JobSourceAdapter } from '../types';
import { callMcpTool } from './mcp';

/**
 * Solides Vagas, pelo servidor MCP público e oficial da própria Solides (sem login, só leitura).
 * A busca é por palavra-chave e traz a descrição cortada; o `detalhar_vaga` traz a descrição
 * inteira, e a ingestão só o chama para as vagas novas. Ficha: docs/fontes/solides.md.
 */
const MCP_ENDPOINT = 'https://mcp.solides.com.br/ats/candidate';
/** O máximo que o `buscar_vagas` aceita por página. */
const PAGE_SIZE = 50;
/** Trava contra um laço sem fim se a paginação do servidor mudar. */
const MAX_PAGES = 20;

const SolidesJob = z.object({
  id: z.string().min(1),
  titulo: z.string().trim().min(1),
  empresa: z.string().nullish(),
  local: z.string().nullish(),
  modalidade: z.string().nullish(),
  senioridade: z.string().nullish(),
  contrato: z.string().nullish(),
  salario: z.string().nullish(),
  publicado_em: z.string().nullish(),
  link_candidatura: z.string().url(),
  descricao: z.string().nullish(),
});
export type SolidesRawJob = z.infer<typeof SolidesJob>;

const SearchResult = z.object({
  total_paginas: z.number().int().nonnegative(),
  vagas: z.array(z.unknown()),
});

const DetailResult = z.object({ descricao: z.string().nullish() });

/** Uma página do `buscar_vagas`. Vaga fora do formato é pulada, sem derrubar a busca. */
async function searchPage(keyword: string, page: number, ctx: AdapterContext) {
  const text = await callMcpTool(MCP_ENDPOINT, ctx, 'buscar_vagas', {
    title: keyword,
    page,
    take: PAGE_SIZE,
  });
  const result = SearchResult.parse(JSON.parse(text));
  const jobs = result.vagas.flatMap((raw) => {
    const job = SolidesJob.safeParse(raw);
    if (!job.success) ctx.log('vaga da Solides fora do formato', { issues: job.error.issues });
    return job.success ? [job.data] : [];
  });
  return { jobs, totalPages: result.total_paginas };
}

/** "Uberlândia/MG" → "Uberlândia - MG", como as outras fontes. */
function location(local: string | null | undefined): string | null {
  const text = local?.trim();
  if (!text) return null;
  const match = /^(.+)\/([A-Z]{2})$/.exec(text);
  return match ? `${match[1]?.trim()} - ${match[2]}` : text;
}

/**
 * "Até R$ 3000", "A partir de R$ 2000", "R$ 3000 a R$ 4000" ou "Não informado". O valor vem com
 * ponto decimal ("R$ 4186.8"); com vírgula, é o formato brasileiro ("R$ 4.186,80").
 */
function parseSalary(text: string | null | undefined): {
  min: number | null;
  max: number | null;
} {
  const values = [...(text ?? '').matchAll(/R\$\s*([\d.,]+)/g)].map(([, raw = '']) =>
    Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw),
  );
  const [first, second] = values.filter((v) => Number.isFinite(v) && v > 0);
  if (first === undefined) return { min: null, max: null };
  if (second !== undefined) return { min: first, max: second };
  if (/^\s*at[eé]/i.test(text ?? '')) return { min: null, max: first };
  if (/a partir/i.test(text ?? '')) return { min: first, max: null };
  return { min: first, max: first };
}

function publishedAt(date: string | null | undefined): Date | null {
  const parsed = date ? new Date(`${date}T00:00:00-03:00`) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
}

export const solidesAdapter: JobSourceAdapter<SolidesRawJob> = {
  id: 'solides',
  displayName: 'Solides Vagas',
  kind: 'api',
  fetchBy: 'keyword',

  async *fetch(keyword, ctx) {
    const seen = new Set<string>();
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { jobs, totalPages } = await searchPage(keyword, page, ctx);
      for (const job of jobs) {
        if (seen.size >= ctx.maxResults) return;
        if (seen.has(job.id)) continue;
        seen.add(job.id);
        yield job;
      }
      if (page >= totalPages || !jobs.length) return;
    }
  },

  detail: {
    idOf: (listed) => listed.id,
    /** A descrição inteira. O link da busca fica: o do detalhe veio quebrado no teste. */
    async fetch(listed, ctx) {
      const text = await callMcpTool(MCP_ENDPOINT, ctx, 'detalhar_vaga', { id: listed.id });
      const detail = DetailResult.safeParse(JSON.parse(text));
      if (!detail.success || !detail.data.descricao) return listed;
      return { ...listed, descricao: detail.data.descricao };
    },
  },

  normalize(raw): NormalizedJob {
    const terms = classifyListingTerms(
      [raw.contrato, raw.senioridade, raw.modalidade].filter((t): t is string => Boolean(t)),
    );
    const salary = parseSalary(raw.salario);
    return {
      sourceId: 'solides',
      externalId: raw.id,
      url: raw.link_candidatura,
      title: raw.titulo,
      company: raw.empresa?.trim() || 'Não informado',
      location: location(raw.local),
      workModel: terms.workModel,
      seniority: terms.seniority,
      contractType: terms.contractType,
      salaryMin: salary.min,
      salaryMax: salary.max,
      description: htmlToText(raw.descricao ?? ''),
      publishedAt: publishedAt(raw.publicado_em),
    };
  },

  /** vagas.solides.com.br e <empresa>.vagas.solides.com.br: a busca já lê todas as empresas. */
  recognize(url) {
    const host = url.hostname;
    return host === 'vagas.solides.com.br' || host.endsWith('.vagas.solides.com.br')
      ? { kind: 'covered' }
      : null;
  },

  apply: {
    modes: ['assisted'],
    async submit() {
      // a candidatura é no portal da Solides, com a conta do candidato
      return { status: 'needs_action', reason: 'login', detail: 'Solides: envio assistido' };
    },
  },
};
