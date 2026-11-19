import {
  SourceBlockedError,
  SourceRateLimitedError,
  createPoliteFetch,
  getAdapter,
} from '@cv-pilot/adapters';
import { NormalizedJob, type WorkModel } from '@cv-pilot/contracts';
import { jobDedupeHash } from '@cv-pilot/core';
import { prisma, type Prisma } from '@cv-pilot/db';
import { enqueue, getRedis, type QueuePayloads } from '@cv-pilot/queue';
import { DelayedError, UnrecoverableError, type Job } from 'bullmq';
import { createHostThrottle } from '../host-throttle';
import { logger } from '../logger';

/** Espera quando o site responde 429 sem dizer quanto tempo (Retry-After). */
const DEFAULT_RETRY_AFTER_MS = 15 * 60_000;

/** Executa o adapter de um site para um perfil de busca e grava as vagas. */
export async function searchProcessor(job: Job<QueuePayloads['search']>, token?: string) {
  const { searchProfileId, sourceId } = job.data;
  const [profile, source] = await Promise.all([
    prisma.searchProfile.findUnique({ where: { id: searchProfileId } }),
    prisma.source.findUnique({ where: { id: sourceId } }),
  ]);
  if (!profile?.active || !source?.active) return { skipped: true };

  const adapter = getAdapter(sourceId);
  const ctx = {
    // o intervalo por host vale para todas as réplicas juntas (Redis), não por processo
    http: createPoliteFetch(
      createHostThrottle(
        getRedis(),
        Math.ceil(source.rateLimitMs / Math.max(source.rateLimitReqs, 1)),
      ),
    ),
    config: (source.config ?? {}) as Record<string, unknown>,
    log: (msg: string, data?: Record<string, unknown>) => logger.info({ sourceId, ...data }, msg),
    maxResults: 200,
  };

  let found = 0;
  try {
    for await (const raw of adapter.search(
      {
        keywords: profile.keywords,
        excludeKeywords: profile.excludeKeywords,
        workModels: profile.workModels as WorkModel[],
        location: profile.location,
      },
      ctx,
    )) {
      const parsed = NormalizedJob.safeParse(adapter.normalize(raw));
      if (!parsed.success) {
        logger.warn({ sourceId, issues: parsed.error.issues }, 'vaga inválida ignorada');
        continue;
      }
      const jobId = await upsertJob(parsed.data, raw);
      await enqueue(
        'match',
        { jobId, searchProfileId },
        { jobId: `match_${jobId}_${searchProfileId}` },
      );
      found++;
    }
    await prisma.source.update({
      where: { id: sourceId },
      data: { lastRunAt: new Date(), lastError: null },
    });
  } catch (err) {
    const blocked = err instanceof SourceBlockedError;
    await prisma.source.update({
      where: { id: sourceId },
      // bloqueio pausa a fonte inteira: o bot para até alguém reativar (RF-53)
      data: {
        lastRunAt: new Date(),
        lastError: (err as Error).message.slice(0, 500),
        ...(blocked ? { active: false } : {}),
      },
    });
    if (blocked) {
      logger.error({ sourceId, host: err.host }, 'fonte pausada: o site bloqueou o bot (403)');
      throw new UnrecoverableError(err.message);
    }
    if (err instanceof SourceRateLimitedError) {
      // adia este job pelo tempo que o site pediu, sem gastar tentativa
      await job.moveToDelayed(Date.now() + (err.retryAfterMs ?? DEFAULT_RETRY_AFTER_MS), token);
      throw new DelayedError();
    }
    throw err;
  }

  logger.info({ sourceId, searchProfileId, found }, 'busca concluída');
  return { found };
}

async function upsertJob(n: NormalizedJob, raw: unknown): Promise<string> {
  const dedupeHash = jobDedupeHash(n);
  const data = {
    title: n.title,
    company: n.company,
    location: n.location ?? null,
    workModel: n.workModel ?? null,
    seniority: n.seniority ?? null,
    contractType: n.contractType ?? null,
    salaryMin: n.salaryMin ?? null,
    salaryMax: n.salaryMax ?? null,
    description: n.description,
    applyEmail: n.applyEmail ?? null,
    publishedAt: n.publishedAt ?? null,
    active: true,
  };
  const record = await prisma.job.upsert({
    where: { dedupeHash },
    create: { dedupeHash, ...data },
    update: data,
    select: { id: true },
  });
  await prisma.jobSource.upsert({
    where: { sourceId_externalId: { sourceId: n.sourceId, externalId: n.externalId } },
    create: {
      jobId: record.id,
      sourceId: n.sourceId,
      externalId: n.externalId,
      url: n.url,
      raw: raw as Prisma.InputJsonValue,
    },
    update: { lastSeen: new Date(), url: n.url },
  });
  return record.id;
}
