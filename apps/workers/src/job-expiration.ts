import { prisma } from '@cv-pilot/db';

/**
 * Sem ser vista por tanto tempo, a vaga sai da fonte (RF-34). Vale para as fontes por
 * palavra-chave, em que a ausência numa busca não prova nada, e para boards e listagens que
 * pararam de ser lidos.
 */
const STALE_AFTER_DAYS = 14;
const DAY_MS = 24 * 60 * 60_000;

/** Onde a ingestão leu a lista completa: um board do catálogo ou a listagem de uma fonte `feed`. */
type FullListing = { careerBoardId: string } | { sourceId: string };

/** A vaga sem nenhuma fonte aberta deixa de aparecer para os usuários. */
async function deactivateJobsWithoutOpenSources(scope?: FullListing) {
  const { count } = await prisma.job.updateMany({
    where: {
      active: true,
      sources: { none: { closedAt: null } },
      ...(scope ? { AND: { sources: { some: scope } } } : {}),
    },
    data: { active: false },
  });
  return count;
}

/**
 * Fecha as vagas da listagem que não vieram na ingestão que começou em `fetchStartedAt`.
 * Só chame depois de ler a lista inteira: uma lista cortada fecharia vagas abertas.
 */
export async function closeMissing(scope: FullListing, fetchStartedAt: Date) {
  const { count: closedSources } = await prisma.jobSource.updateMany({
    where: { ...scope, closedAt: null, lastSeen: { lt: fetchStartedAt } },
    data: { closedAt: new Date() },
  });
  const closedJobs = closedSources ? await deactivateJobsWithoutOpenSources(scope) : 0;
  return { closedSources, closedJobs };
}

/** Fecha as fontes de vaga que ninguém vê há `STALE_AFTER_DAYS` dias. */
export async function expireStaleJobs(now: Date) {
  const { count: closedSources } = await prisma.jobSource.updateMany({
    where: {
      closedAt: null,
      lastSeen: { lt: new Date(now.getTime() - STALE_AFTER_DAYS * DAY_MS) },
    },
    data: { closedAt: now },
  });
  const closedJobs = closedSources ? await deactivateJobsWithoutOpenSources() : 0;
  return { closedSources, closedJobs };
}
