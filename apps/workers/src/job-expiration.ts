import { prisma } from '@cv-pilot/db';

/**
 * Sem ser vista por tanto tempo, a vaga sai da fonte (RF-34). Vale para as fontes por
 * palavra-chave, em que a ausência numa busca não prova nada, e para boards que pararam de
 * ser baixados.
 */
const STALE_AFTER_DAYS = 14;
const DAY_MS = 24 * 60 * 60_000;

/** A vaga sem nenhuma fonte aberta deixa de aparecer para os usuários. */
async function deactivateJobsWithoutOpenSources(scope: { careerBoardId?: string } = {}) {
  const { count } = await prisma.job.updateMany({
    where: {
      active: true,
      sources: { none: { closedAt: null } },
      ...(scope.careerBoardId ? { AND: { sources: { some: scope } } } : {}),
    },
    data: { active: false },
  });
  return count;
}

/**
 * Fecha as vagas do board que não vieram na ingestão que começou em `fetchStartedAt`.
 * Só chame depois de baixar o board inteiro: uma lista cortada fecharia vagas abertas.
 */
export async function closeMissingFromBoard(careerBoardId: string, fetchStartedAt: Date) {
  const { count: closedSources } = await prisma.jobSource.updateMany({
    where: { careerBoardId, closedAt: null, lastSeen: { lt: fetchStartedAt } },
    data: { closedAt: new Date() },
  });
  const closedJobs = closedSources ? await deactivateJobsWithoutOpenSources({ careerBoardId }) : 0;
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
