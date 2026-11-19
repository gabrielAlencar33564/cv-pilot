import type { ContractType } from '@cv-pilot/contracts';
import { load } from 'cheerio';
import { z } from 'zod';

/*
 * Vagas publicadas com schema.org `JobPosting` em JSON-LD, o formato que os buscadores leem.
 * Só os campos que o CV Pilot usa; o resto do bloco é ignorado.
 */

const Place = z.object({
  address: z
    .object({ addressLocality: z.string().optional(), addressRegion: z.string().optional() })
    .optional(),
});

const QuantitativeValue = z.object({
  value: z.number().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  unitText: z.string().optional(),
});

const JobPostingLd = z.object({
  title: z.string().trim().min(1),
  description: z.string().default(''),
  datePosted: z.string().optional(),
  employmentType: z.union([z.string(), z.array(z.string())]).optional(),
  hiringOrganization: z.object({ name: z.string().trim().min(1).optional() }).optional(),
  jobLocation: z.union([Place, z.array(Place)]).optional(),
  jobLocationType: z.string().optional(),
  baseSalary: z
    .object({
      currency: z.string().optional(),
      value: z.union([z.number(), QuantitativeValue]).optional(),
    })
    .optional(),
});
export type JobPostingLd = z.infer<typeof JobPostingLd>;

const isJobPosting = (node: unknown): boolean => {
  if (typeof node !== 'object' || node === null || !('@type' in node)) return false;
  const type = node['@type'];
  return type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
};

/** Os nós de um bloco JSON-LD: o objeto, a lista ou o `@graph`. */
function nodesOf(data: unknown): unknown[] {
  if (Array.isArray(data)) return data.flatMap(nodesOf);
  if (typeof data === 'object' && data !== null && '@graph' in data) return nodesOf(data['@graph']);
  return [data];
}

/** O primeiro `JobPosting` válido da página, ou null quando não há ou ele não tem título. */
export function findJobPosting(html: string): JobPostingLd | null {
  const $ = load(html);
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    let data: unknown;
    try {
      data = JSON.parse($(script).text());
    } catch {
      // bloco malformado: os outros da página ainda podem ter a vaga
      continue;
    }
    for (const node of nodesOf(data).filter(isJobPosting)) {
      const parsed = JobPostingLd.safeParse(node);
      if (parsed.success) return parsed.data;
    }
  }
  return null;
}

/** "Cidade - UF", do primeiro local da vaga. */
export function postingLocation(posting: JobPostingLd): string | null {
  const place = Array.isArray(posting.jobLocation) ? posting.jobLocation[0] : posting.jobLocation;
  const { addressLocality, addressRegion } = place?.address ?? {};
  return [addressLocality, addressRegion].filter(Boolean).join(' - ') || null;
}

/**
 * Tipo de contrato pelo `employmentType`, só quando ele é um e inequívoco. No Brasil os sites
 * publicam o PJ como CONTRACTOR; FULL_TIME e PART_TIME dizem a jornada, não o contrato.
 */
const EMPLOYMENT_TYPES: Record<string, ContractType> = {
  CONTRACTOR: 'pj',
  INTERN: 'internship',
  TEMPORARY: 'temporary',
};

export function postingContractType(posting: JobPostingLd): ContractType | null {
  const types = [posting.employmentType ?? []].flat();
  if (types.length !== 1) return null;
  return EMPLOYMENT_TYPES[types[0]?.toUpperCase() ?? ''] ?? null;
}

/** Faixa salarial mensal em reais; outra moeda ou outra unidade (hora, ano) fica de fora. */
export function postingMonthlySalary(posting: JobPostingLd): {
  min: number | null;
  max: number | null;
} {
  const salary = posting.baseSalary;
  const none = { min: null, max: null };
  if (!salary?.value || (salary.currency && salary.currency !== 'BRL')) return none;
  if (typeof salary.value === 'number') return { min: salary.value, max: salary.value };
  if (salary.value.unitText && salary.value.unitText.toUpperCase() !== 'MONTH') return none;
  const min = salary.value.minValue ?? salary.value.value ?? null;
  const max = salary.value.maxValue ?? salary.value.value ?? null;
  return { min, max };
}

/** Data de publicação, quando é uma data válida. */
export function postingDate(posting: JobPostingLd): Date | null {
  const date = posting.datePosted ? new Date(posting.datePosted) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}
