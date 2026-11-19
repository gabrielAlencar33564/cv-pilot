import { isMatchCandidate } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';
import type { QueuePayloads } from '@cv-pilot/queue';
import type { Job } from 'bullmq';
import { logger } from '../logger';
import { enqueueMatch } from '../match-queue';
import { PROFILE_SCORING_FIELDS, scoringJob, scoringProfile } from '../scoring-input';

/** Quantas vagas abertas, das mais recentes, um perfil novo compara de uma vez. */
const BACKFILL_MAX_JOBS = 2000;

/**
 * A ingestão só manda para o match as vagas novas ou alteradas. Um perfil novo, editado ou
 * reativado precisa também das vagas que já estavam no banco: este job faz essa comparação.
 */
export async function backfillProcessor(job: Job<QueuePayloads['backfill']>) {
  const profile = await prisma.searchProfile.findUnique({
    where: { id: job.data.searchProfileId },
    select: { ...PROFILE_SCORING_FIELDS, active: true, sourceIds: true },
  });
  if (!profile?.active || !profile.sourceIds.length) return { skipped: true };

  const jobs = await prisma.job.findMany({
    where: {
      active: true,
      sources: { some: { sourceId: { in: profile.sourceIds }, closedAt: null } },
    },
    orderBy: { updatedAt: 'desc' },
    take: BACKFILL_MAX_JOBS,
    select: {
      id: true,
      title: true,
      company: true,
      description: true,
      location: true,
      workModel: true,
      seniority: true,
      contractType: true,
      salaryMin: true,
      salaryMax: true,
    },
  });

  const scoringInput = scoringProfile(profile);
  let matches = 0;
  for (const vaga of jobs) {
    if (!isMatchCandidate(scoringJob(vaga), scoringInput)) continue;
    await enqueueMatch(vaga.id, profile.id);
    matches++;
  }
  logger.info({ searchProfileId: profile.id, scanned: jobs.length, matches }, 'backfill concluído');
  return { scanned: jobs.length, matches };
}
