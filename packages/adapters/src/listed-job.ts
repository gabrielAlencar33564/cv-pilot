import type { NormalizedJob } from '@cv-pilot/contracts';
import { htmlToText } from './http';
import {
  findJobPosting,
  postingContractType,
  postingDate,
  postingLocation,
  postingMonthlySalary,
  type JobPostingLd,
} from './json-ld';
import { classifyListingTerms } from './listing-terms';
import type { AdapterContext } from './types';

/**
 * Vaga de um site com listagem paginada e uma página por vaga (Nerdin, ProgramaThor): o card
 * da listagem dá o id, o título e os termos; a página da vaga, o JSON-LD com o resto.
 */
export interface ListedJob {
  id: string;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  /** o que o card diz em texto: contrato, nível, modelo de trabalho */
  terms: string[];
  /** preenchido pelo `detail.fetch`; null quando a página não tem JobPosting */
  posting?: JobPostingLd | null;
}

/** As páginas desses sites são HTML; o fetch educado pede JSON por padrão. */
const HTML_REQUEST: RequestInit = { headers: { Accept: 'text/html' } };

/** Trava contra um laço sem fim se a paginação do site mudar. */
const MAX_PAGES = 100;

/** Espaços, quebras e recuos do HTML viram um espaço só. */
export const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Percorre a listagem página por página até uma página sem vagas novas: além da última, o site
 * devolve a lista vazia ou repete a anterior. Para no teto de vagas por execução.
 */
export async function* paginateListing(
  pageUrl: (page: number) => string,
  parse: (html: string) => ListedJob[],
  ctx: AdapterContext,
): AsyncGenerator<ListedJob> {
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await (await ctx.http(pageUrl(page), HTML_REQUEST)).text();
    const jobs = parse(html).filter((job) => !seen.has(job.id));
    if (!jobs.length) return;
    for (const job of jobs) {
      if (seen.size >= ctx.maxResults) return;
      seen.add(job.id);
      yield job;
    }
  }
}

/** O `detail` dos adapters de listagem: baixa a página da vaga e lê o JobPosting. */
export const listedJobDetail = {
  idOf: (listed: ListedJob) => listed.id,
  async fetch(listed: ListedJob, ctx: AdapterContext): Promise<ListedJob> {
    const html = await (await ctx.http(listed.url, HTML_REQUEST)).text();
    const posting = findJobPosting(html);
    if (!posting) ctx.log('página de vaga sem JobPosting', { url: listed.url });
    return { ...listed, posting };
  },
};

/**
 * Os sites põem o modelo no lugar da cidade ("Home Office - HO", "Remoto"). Esse local diz o
 * modelo de trabalho e não vira endereço.
 */
function splitPlace(location: string | null) {
  if (!location) return { location: null, workModel: null };
  const { workModel } = classifyListingTerms(location.split(/\s*[-•]\s*/));
  return workModel ? { location: null, workModel } : { location, workModel: null };
}

/**
 * Junta o card e o JSON-LD. O card vale para contrato, nível e modelo, que o site escreve
 * por extenso; o JSON-LD, para o texto, a empresa, o salário e a data.
 */
export function normalizeListedJob(sourceId: string, raw: ListedJob): NormalizedJob {
  const posting = raw.posting ?? null;
  const terms = classifyListingTerms(raw.terms);
  const salary = posting ? postingMonthlySalary(posting) : { min: null, max: null };
  const remoteByPosting = posting?.jobLocationType === 'TELECOMMUTE' ? 'remote' : null;
  const place = splitPlace((posting && postingLocation(posting)) ?? raw.location);
  return {
    sourceId,
    externalId: raw.id,
    url: raw.url,
    title: posting?.title ?? raw.title,
    company: posting?.hiringOrganization?.name ?? raw.company ?? 'Não informado',
    location: place.location,
    workModel: terms.workModel ?? place.workModel ?? remoteByPosting,
    seniority: terms.seniority,
    contractType: terms.contractType ?? (posting ? postingContractType(posting) : null),
    salaryMin: salary.min,
    salaryMax: salary.max,
    description: htmlToText(posting?.description ?? ''),
    publishedAt: posting ? postingDate(posting) : null,
  };
}
