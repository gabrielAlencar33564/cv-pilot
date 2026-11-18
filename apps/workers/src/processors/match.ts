import type { WorkModel } from '@cv-pilot/contracts';
import { resolveSendRule, ruleBasedScore } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';
import { enqueue, type QueuePayloads } from '@cv-pilot/queue';
import type { Job } from 'bullmq';

/**
 * Calcula a nota vaga × perfil e, se passar do mínimo, cria a candidatura
 * usando o currículo definido pela regra de envio do site.
 */
export async function matchProcessor(job: Job<QueuePayloads['match']>) {
  const { jobId, searchProfileId } = job.data;
  const [vaga, profile] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId }, include: { sources: true } }),
    prisma.searchProfile.findUnique({ where: { id: searchProfileId } }),
  ]);
  if (!vaga || !profile) return { skipped: true };

  // TODO: combinar com similaridade semântica (embeddings via @cv-pilot/ai + pgvector)
  const result = ruleBasedScore(
    { ...vaga, workModel: vaga.workModel as WorkModel | null },
    { ...profile, workModels: profile.workModels as WorkModel[] },
  );
  if (result.blocked) return result;

  await prisma.jobMatch.upsert({
    where: { jobId_searchProfileId: { jobId, searchProfileId } },
    create: { jobId, searchProfileId, score: result.score, reasons: result.reasons },
    update: { score: result.score, reasons: result.reasons },
  });

  if (result.score < profile.minScoreAutoApply) return result;

  // Escolhe a fonte (site) da vaga que o usuário selecionou no perfil
  const jobSource = vaga.sources.find((s) => profile.sourceIds.includes(s.sourceId));
  if (!jobSource) return result;

  const rules = await prisma.sendRule.findMany({ where: { userId: profile.userId } });
  const rule = resolveSendRule(rules, { sourceId: jobSource.sourceId, searchProfileId });
  if (!rule) return { ...result, note: 'sem regra de envio configurada' };

  const resumeVersion = await prisma.resumeVersion.findFirst({
    where: { resumeId: rule.resumeId },
    orderBy: { version: 'desc' },
  });
  if (!resumeVersion) return { ...result, note: 'currículo sem arquivo' };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sentToday = await prisma.application.count({
    where: { searchProfileId, status: { in: ['queued', 'sent'] }, updatedAt: { gte: startOfDay } },
  });
  const autoSend = !rule.reviewBeforeSend && sentToday < profile.dailyApplyLimit;

  const application = await prisma.application.upsert({
    where: { userId_jobId: { userId: profile.userId, jobId } },
    create: {
      userId: profile.userId,
      jobId,
      sourceId: jobSource.sourceId,
      searchProfileId,
      resumeVersionId: resumeVersion.id,
      sendRuleId: rule.id,
      mode: rule.mode,
      score: result.score,
      status: autoSend ? 'queued' : 'suggested',
      answers: rule.defaultAnswers ?? {},
    },
    update: {},
  });

  if (application.status === 'queued') {
    // intervalo aleatório entre envios (1 a 10 min) para não parecer spam
    const delay = 60_000 + Math.floor(Math.random() * 9 * 60_000);
    await enqueue('apply', { applicationId: application.id }, { jobId: `apply_${application.id}`, delay });
  }
  return { ...result, applicationId: application.id, status: application.status };
}
