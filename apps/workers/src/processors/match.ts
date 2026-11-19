import type { ContractType, Seniority, WorkModel } from '@cv-pilot/contracts';
import { dailyBucket, renderCoverLetter, resolveSendRule, ruleBasedScore } from '@cv-pilot/core';
import { Prisma, prisma } from '@cv-pilot/db';
import {
  enqueueApplication,
  getRedis,
  releaseDailySlot,
  reserveDailySlot,
  type QueuePayloads,
} from '@cv-pilot/queue';
import type { Job } from 'bullmq';

/**
 * Calcula a nota vaga × perfil e, se passar do mínimo, cria a candidatura
 * usando o currículo definido pela regra de envio do site.
 */
export async function matchProcessor(job: Job<QueuePayloads['match']>) {
  const { jobId, searchProfileId } = job.data;
  const [vaga, profile] = await Promise.all([
    prisma.job.findUnique({ where: { id: jobId }, include: { sources: true } }),
    prisma.searchProfile.findUnique({
      where: { id: searchProfileId },
      include: { user: { select: { timezone: true, name: true } } },
    }),
  ]);
  if (!vaga || !profile) return { skipped: true };

  // TODO: combinar com similaridade semântica (embeddings via @cv-pilot/ai + pgvector)
  // o banco guarda os enums como texto; os valores são os mesmos de contracts/enums.ts
  const result = ruleBasedScore(
    {
      ...vaga,
      workModel: vaga.workModel as WorkModel | null,
      seniority: vaga.seniority as Seniority | null,
      contractType: vaga.contractType as ContractType | null,
    },
    {
      ...profile,
      workModels: profile.workModels as WorkModel[],
      seniorities: profile.seniorities as Seniority[],
      contractTypes: profile.contractTypes as ContractType[],
    },
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

  const rules = await prisma.sendRule.findMany({
    where: { userId: profile.userId },
    include: { coverLetterTemplate: { select: { body: true } } },
  });
  const rule = resolveSendRule(rules, { sourceId: jobSource.sourceId, searchProfileId });
  if (!rule) return { ...result, note: 'sem regra de envio configurada' };

  const resumeVersion = await prisma.resumeVersion.findFirst({
    where: { resumeId: rule.resumeId },
    orderBy: { version: 'desc' },
  });
  if (!resumeVersion) return { ...result, note: 'currículo sem arquivo' };

  const existing = await prisma.application.findUnique({
    where: { userId_jobId: { userId: profile.userId, jobId } },
    select: { id: true, status: true },
  });
  if (existing) return { ...result, applicationId: existing.id, status: existing.status };

  // a vaga no limite diário é reservada antes de criar: a contagem não depende do status depois
  const slot = {
    userId: profile.userId,
    sourceId: jobSource.sourceId,
    day: dailyBucket(new Date(), profile.user.timezone),
  };
  const autoSend =
    !rule.reviewBeforeSend && (await reserveDailySlot(getRedis(), slot, profile.dailyApplyLimit));

  let application;
  try {
    application = await prisma.application.create({
      data: {
        userId: profile.userId,
        jobId,
        sourceId: jobSource.sourceId,
        searchProfileId,
        resumeVersionId: resumeVersion.id,
        sendRuleId: rule.id,
        mode: rule.mode,
        score: result.score,
        status: autoSend ? 'queued' : 'suggested',
        coverLetter: rule.coverLetterTemplate
          ? renderCoverLetter(rule.coverLetterTemplate.body, {
              empresa: vaga.company,
              cargo: vaga.title,
              nome: profile.user.name ?? '',
            })
          : null,
        answers: rule.defaultAnswers ?? {},
      },
      select: { id: true, status: true },
    });
  } catch (err) {
    if (autoSend) await releaseDailySlot(getRedis(), slot);
    // outro match (de outro perfil do mesmo usuário) criou a candidatura entre a checagem e o create
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ...result, note: 'candidatura já existe' };
    }
    throw err;
  }

  if (application.status === 'queued') await enqueueApplication(application.id);
  return { ...result, applicationId: application.id, status: application.status };
}
