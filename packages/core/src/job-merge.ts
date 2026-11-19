import type { NormalizedJob } from '@cv-pilot/contracts';

/** Campos da vaga que vêm das fontes e ficam guardados em `Job`. */
export interface JobContent {
  title: string;
  company: string;
  location: string | null;
  workModel: NonNullable<NormalizedJob['workModel']> | null;
  seniority: NonNullable<NormalizedJob['seniority']> | null;
  contractType: NonNullable<NormalizedJob['contractType']> | null;
  salaryMin: number | null;
  salaryMax: number | null;
  description: string;
  applyEmail: string | null;
  publishedAt: Date | null;
}

type Incoming = Pick<NormalizedJob, keyof JobContent>;

const sameValue = (a: unknown, b: unknown) =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;

/**
 * Junta o que já sabemos da vaga com o que uma fonte trouxe agora. A mesma vaga aparece em
 * vários sites, e um deles pode trazer menos dados: um campo vazio não apaga o que outro site
 * informou, e a descrição mais completa fica. Diz também se algo mudou, para o match rodar
 * de novo só quando vale a pena.
 */
export function mergeJob(
  existing: JobContent | null,
  incoming: Incoming,
): { job: JobContent; changed: boolean } {
  /** campo vazio na fonte nova mantém o que já sabíamos */
  const keep = <K extends keyof Incoming>(field: K) =>
    incoming[field] ?? existing?.[field] ?? null;
  const job: JobContent = {
    title: incoming.title,
    company: incoming.company,
    description: incoming.description,
    location: keep('location'),
    workModel: keep('workModel'),
    seniority: keep('seniority'),
    contractType: keep('contractType'),
    salaryMin: keep('salaryMin'),
    salaryMax: keep('salaryMax'),
    applyEmail: keep('applyEmail'),
    publishedAt: keep('publishedAt'),
  };
  if (!existing) return { job, changed: true };

  if (existing.description.length > job.description.length) job.description = existing.description;
  // Object.keys devolve string[]; as chaves são as de JobContent, montado logo acima
  const changed = (Object.keys(job) as (keyof JobContent)[]).some(
    (field) => !sameValue(job[field], existing[field]),
  );
  return { job, changed };
}
