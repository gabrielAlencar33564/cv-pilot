import {
  SourceBlockedError,
  SourceDisallowedError,
  SourceRateLimitedError,
  createPoliteFetch,
  getAdapter,
} from '@cv-pilot/adapters';
import { NormalizedJob, type SourceRunStatus } from '@cv-pilot/contracts';
import { isMatchCandidate, jobDedupeHash, mergeJob, type JobContent } from '@cv-pilot/core';
import { Prisma, clearJobEmbedding, prisma } from '@cv-pilot/db';
import { getRedis, type QueuePayloads } from '@cv-pilot/queue';
import { DelayedError, UnrecoverableError, type Job } from 'bullmq';
import { createHostThrottle } from '../host-throttle';
import { closeMissing } from '../job-expiration';
import { logger } from '../logger';
import { enqueueMatch } from '../match-queue';
import { createRobotsCache } from '../robots-cache';
import { PROFILE_SCORING_FIELDS, scoringJob, scoringProfile } from '../scoring-input';
import { errorMessage, recordSourceRun } from '../source-runs';

/** Espera quando o site responde 429 sem dizer quanto tempo (Retry-After). */
const DEFAULT_RETRY_AFTER_MS = 15 * 60_000;
/** Teto de vagas por board, palavra-chave ou listagem numa ingestão. */
const MAX_JOBS_PER_TARGET = 1000;
/** Como o alvo de uma fonte `feed` aparece no histórico de execuções do admin. */
const FEED_TARGET_LABEL = 'listagem completa';

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
 * Baixa um board do catálogo, uma palavra-chave ou a listagem inteira de uma fonte `feed`, uma
 * vez para todos os usuários, e grava as vagas. Cada vaga nova ou alterada vai para o match dos
 * perfis que podem se interessar por ela.
 */
export async function ingestProcessor(job: Job<QueuePayloads['ingest']>, token?: string) {
  const { sourceId } = job.data;
  const board =
    'careerBoardId' in job.data
      ? await prisma.careerBoard.findUnique({ where: { id: job.data.careerBoardId } })
      : null;
  if ('careerBoardId' in job.data && !board?.active) return { skipped: true };
  const feed = !('careerBoardId' in job.data) && !('keyword' in job.data);
  const target = board?.token ?? ('keyword' in job.data ? job.data.keyword : '');
  if (!feed && !target) return { skipped: true };

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
  const run = {
    sourceId,
    careerBoardId: board?.id ?? null,
    target: target || FEED_TARGET_LABEL,
    startedAt: fetchStartedAt,
  };

  let found = 0;
  let changed = 0;
  let matches = 0;
  try {
    for await (const listed of adapter.fetch(target, ctx)) {
      found++;
      // site com página por vaga: só baixa a página de quem a fonte ainda não tem aberto
      if (adapter.detail && (await touchOpenJobSource(sourceId, adapter.detail.idOf(listed)))) {
        continue;
      }
      const raw = adapter.detail ? await adapter.detail.fetch(listed, ctx) : listed;
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
    await recordSourceRun({
      ...run,
      status: runStatusOf(err),
      found,
      changed,
      matches,
      closed: 0,
      error: errorMessage(err),
    });
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

  // só um board ou uma listagem inteira prova que a vaga ausente fechou; e nunca uma lista
  // cortada no teto
  const listing = board ? { careerBoardId: board.id } : feed ? { sourceId } : null;
  const expired =
    listing && found < MAX_JOBS_PER_TARGET ? await closeMissing(listing, fetchStartedAt) : null;
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
  await recordSourceRun({
    ...run,
    status: 'success',
    found,
    changed,
    matches,
    closed: expired?.closedSources ?? 0,
  });

  logger.info(
    { sourceId, careerBoardId: board?.id, found, changed, matches, ...expired },
    'ingestão concluída',
  );
  return { found, changed, matches };
}

/** A vaga já está aberta nesta fonte: basta renovar o `lastSeen`, sem baixar a página dela. */
async function touchOpenJobSource(sourceId: string, externalId: string) {
  const { count } = await prisma.jobSource.updateMany({
    where: { sourceId, externalId, closedAt: null },
    data: { lastSeen: new Date() },
  });
  return count > 0;
}

/** Perfis ativos que usam a fonte: são os que podem receber o match das vagas dela. */
async function candidateProfiles(sourceId: string) {
  const profiles = await prisma.searchProfile.findMany({
    where: { active: true, sourceIds: { has: sourceId }, user: { deletedAt: null } },
    select: PROFILE_SCORING_FIELDS,
  });
  return profiles.map(scoringProfile);
}

/** Como a execução aparece no admin: bloqueio (403 ou robots.txt), limite de requisições ou erro. */
function runStatusOf(err: unknown): SourceRunStatus {
  if (err instanceof SourceBlockedError || err instanceof SourceDisallowedError) return 'blocked';
  if (err instanceof SourceRateLimitedError) return 'rate_limited';
  return 'failed';
}

async function recordFailure(sourceId: string, careerBoardId: string | null, err: unknown) {
  const lastError = errorMessage(err);
  const blocked = runStatusOf(err) === 'blocked';
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
  // o embedding e os requisitos vêm do título e da descrição: com o texto novo, o próximo
  // match gera os dois de novo
  const textChanged =
    existing !== null &&
    (existing.title !== merged.job.title || existing.description !== merged.job.description);
  if (existing && (merged.changed || !existing.active)) {
    await prisma.job.update({
      where: { id: jobId },
      data: { ...merged.job, active: true, ...(textChanged && { requirements: Prisma.DbNull }) },
    });
  }
  if (textChanged) await clearJobEmbedding(jobId);

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
