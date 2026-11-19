import {
  SourceBlockedError,
  SourceDisallowedError,
  SourceRateLimitedError,
  createPoliteFetch,
  getAdapter,
} from '@cv-pilot/adapters';
import { NormalizedJob } from '@cv-pilot/contracts';
import { isMatchCandidate, jobDedupeHash, mergeJob, type JobContent } from '@cv-pilot/core';
import { prisma, type Prisma } from '@cv-pilot/db';
import { getRedis, type QueuePayloads } from '@cv-pilot/queue';
import { DelayedError, UnrecoverableError, type Job } from 'bullmq';
import { createHostThrottle } from '../host-throttle';
import { closeMissingFromBoard } from '../job-expiration';
import { logger } from '../logger';
import { enqueueMatch } from '../match-queue';
import { createRobotsCache } from '../robots-cache';
import { PROFILE_SCORING_FIELDS, scoringJob, scoringProfile } from '../scoring-input';

/** Espera quando o site responde 429 sem dizer quanto tempo (Retry-After). */
const DEFAULT_RETRY_AFTER_MS = 15 * 60_000;
/** Teto de vagas por board ou palavra-chave numa ingestão. */
const MAX_JOBS_PER_TARGET = 1000;
const MAX_ERROR_LENGTH = 500;

const JOB_CONTENT_FIELDS = {
  title: true,
  company: true,
  location: true,
  workModel: true,
  seniority: true,
  contractType: true,
  salaryMin: true,
  salaryMax: true,
  description: true,
  applyEmail: true,
  publishedAt: true,
} as const;

/**
 * Baixa um board do catálogo ou uma palavra-chave, uma vez para todos os usuários, e grava as
 * vagas. Cada vaga nova ou alterada vai para o match dos perfis que podem se interessar por ela.
 */
export async function ingestProcessor(job: Job<QueuePayloads['ingest']>, token?: string) {
  const { sourceId } = job.data;
  const board =
    'careerBoardId' in job.data
      ? await prisma.careerBoard.findUnique({ where: { id: job.data.careerBoardId } })
      : null;
  if ('careerBoardId' in job.data && !board?.active) return { skipped: true };
  const target = board?.token ?? ('keyword' in job.data ? job.data.keyword : '');
  if (!target) return { skipped: true };

  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source?.active) return { skipped: true };

  const adapter = getAdapter(sourceId);
  const ctx = {
    // o intervalo por host e o robots.txt valem para todas as réplicas juntas (Redis)
    http: createPoliteFetch({
      throttle: createHostThrottle(
        getRedis(),
        Math.ceil(source.rateLimitMs / Math.max(source.rateLimitReqs, 1)),
      ),
      robots: createRobotsCache(getRedis()),
    }),
    log: (msg: string, data?: Record<string, unknown>) => logger.info({ sourceId, ...data }, msg),
    maxResults: MAX_JOBS_PER_TARGET,
  };
  const profiles = await candidateProfiles(sourceId);
  const fetchStartedAt = new Date();

  let found = 0;
  let changed = 0;
  let matches = 0;
  try {
    for await (const raw of adapter.fetch(target, ctx)) {
      found++;
      const parsed = NormalizedJob.safeParse(adapter.normalize(raw));
      if (!parsed.success) {
        logger.warn({ sourceId, issues: parsed.error.issues }, 'vaga inválida ignorada');
        continue;
      }
      const saved = await upsertJob(parsed.data, raw, board?.id ?? null);
      if (!saved.changed) continue;
      changed++;
      for (const profile of profiles) {
        if (!isMatchCandidate(saved.job, profile)) continue;
        await enqueueMatch(saved.jobId, profile.id);
        matches++;
      }
    }
  } catch (err) {
    await recordFailure(sourceId, board?.id ?? null, err);
    if (err instanceof SourceBlockedError) {
      logger.error({ sourceId, host: err.host }, 'fonte pausada: o site bloqueou o bot (403)');
      throw new UnrecoverableError(err.message);
    }
    if (err instanceof SourceDisallowedError) {
      logger.error(
        { sourceId, host: err.host, path: err.path },
        'fonte pausada: o robots.txt do site não permite o caminho',
      );
      throw new UnrecoverableError(err.message);
    }
    if (err instanceof SourceRateLimitedError) {
      // adia este job pelo tempo que o site pediu, sem gastar tentativa
      await job.moveToDelayed(Date.now() + (err.retryAfterMs ?? DEFAULT_RETRY_AFTER_MS), token);
      throw new DelayedError();
    }
    throw err;
  }

  // com a lista cortada no teto, a ausência de uma vaga não prova que ela fechou
  const expired =
    board && found < MAX_JOBS_PER_TARGET
      ? await closeMissingFromBoard(board.id, fetchStartedAt)
      : null;
  const now = new Date();
  await prisma.source.update({
    where: { id: sourceId },
    data: { lastRunAt: now, lastError: null },
  });
  if (board) {
    await prisma.careerBoard.update({
      where: { id: board.id },
      data: { lastFetchedAt: now, lastError: null },
    });
  }

  logger.info(
    { sourceId, careerBoardId: board?.id, found, changed, matches, ...expired },
    'ingestão concluída',
  );
  return { found, changed, matches };
}

/** Perfis ativos que usam a fonte: são os que podem receber o match das vagas dela. */
async function candidateProfiles(sourceId: string) {
  const profiles = await prisma.searchProfile.findMany({
    where: { active: true, sourceIds: { has: sourceId }, user: { deletedAt: null } },
    select: PROFILE_SCORING_FIELDS,
  });
  return profiles.map(scoringProfile);
}

async function recordFailure(sourceId: string, careerBoardId: string | null, err: unknown) {
  const lastError = (err as Error).message.slice(0, MAX_ERROR_LENGTH);
  const blocked = err instanceof SourceBlockedError || err instanceof SourceDisallowedError;
  await prisma.source.update({
    where: { id: sourceId },
    // bloqueio (403 ou robots.txt) pausa a fonte inteira: o bot para até alguém reativar (RF-53)
    data: { lastRunAt: new Date(), lastError, ...(blocked ? { active: false } : {}) },
  });
  if (careerBoardId) {
    await prisma.careerBoard.update({ where: { id: careerBoardId }, data: { lastError } });
  }
}

/**
 * Grava a vaga juntando com o que outras fontes já trouxeram. Conta como mudança a vaga nova,
 * o conteúdo alterado, a fonte nova da mesma vaga e a vaga que reapareceu depois de fechar:
 * em todos esses casos algum perfil pode passar a casar com ela.
 */
async function upsertJob(
  n: NormalizedJob,
  raw: unknown,
  careerBoardId: string | null,
): Promise<{ jobId: string; job: JobContent; changed: boolean }> {
  const dedupeHash = jobDedupeHash(n);
  const existing = await prisma.job.findUnique({
    where: { dedupeHash },
    select: { id: true, active: true, ...JOB_CONTENT_FIELDS },
  });
  const merged = mergeJob(existing ? scoringJob(existing) : null, n);

  const jobId = existing
    ? existing.id
    : (await prisma.job.create({ data: { dedupeHash, ...merged.job }, select: { id: true } })).id;
  if (existing && (merged.changed || !existing.active)) {
    await prisma.job.update({ where: { id: jobId }, data: { ...merged.job, active: true } });
  }

  const key = { sourceId_externalId: { sourceId: n.sourceId, externalId: n.externalId } };
  const previous = await prisma.jobSource.findUnique({ where: key, select: { closedAt: true } });
  await prisma.jobSource.upsert({
    where: key,
    create: {
      jobId,
      sourceId: n.sourceId,
      externalId: n.externalId,
      url: n.url,
      careerBoardId,
      raw: raw as Prisma.InputJsonValue,
    },
    update: { lastSeen: new Date(), url: n.url, careerBoardId, closedAt: null },
  });

  const reopened = previous?.closedAt != null || existing?.active === false;
  return { jobId, job: merged.job, changed: merged.changed || !previous || reopened };
}
