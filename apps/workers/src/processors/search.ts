import { createPoliteFetch, getAdapter } from '@cv-pilot/adapters';
import { NormalizedJob, type WorkModel } from '@cv-pilot/contracts';
import { jobDedupeHash } from '@cv-pilot/core';
import { prisma, type Prisma } from '@cv-pilot/db';
import { enqueue, type QueuePayloads } from '@cv-pilot/queue';
import type { Job } from 'bullmq';
import { logger } from '../logger';

/** Executa o adapter de um site para um perfil de busca e grava as vagas. */
export async function searchProcessor(job: Job<QueuePayloads['search']>) {
  const { searchProfileId, sourceId } = job.data;
  const [profile, source] = await Promise.all([
    prisma.searchProfile.findUnique({ where: { id: searchProfileId } }),
    prisma.source.findUnique({ where: { id: sourceId } }),
  ]);
  if (!profile?.active || !source?.active) return { skipped: true };

  const adapter = getAdapter(sourceId);
  const ctx = {
    http: createPoliteFetch(Math.ceil(source.rateLimitMs / Math.max(source.rateLimitReqs, 1))),
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
      await enqueue('match', { jobId, searchProfileId }, { jobId: `match_${jobId}_${searchProfileId}` });
      found++;
    }
    await prisma.source.update({ where: { id: sourceId }, data: { lastRunAt: new Date(), lastError: null } });
  } catch (err) {
    await prisma.source.update({
      where: { id: sourceId },
      data: { lastRunAt: new Date(), lastError: (err as Error).message.slice(0, 500) },
    });
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
    create: { jobId: record.id, sourceId: n.sourceId, externalId: n.externalId, url: n.url, raw: raw as Prisma.InputJsonValue },
    update: { lastSeen: new Date(), url: n.url },
  });
  return record.id;
}
