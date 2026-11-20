import { CoverLetterError, getAiProvider } from '@cv-pilot/ai';
import { ApplicationStatus, LetterTone, ParsedResume } from '@cv-pilot/contracts';
import { canEditCoverLetter, renderCoverLetter } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';
import type { QueuePayloads } from '@cv-pilot/queue';
import { UnrecoverableError, type Job } from 'bullmq';
import { isLastAttempt } from '../job-attempts';
import { logger } from '../logger';

/** O currículo ainda está sendo lido: erro temporário, o BullMQ tenta de novo com backoff. */
class ResumeNotParsedYetError extends Error {
  constructor() {
    super('o currículo da candidatura ainda está sendo lido');
    this.name = 'ResumeNotParsedYetError';
  }
}

/**
 * Escreve a carta da candidatura com a IA (RF-54), no tom da regra de envio. Só a vaga, os
 * dados extraídos do currículo e o tom vão para a IA; o nome entra depois, no `{{nome}}`.
 * Grava só se a carta ainda está `generating`: o candidato que editou antes vence a IA.
 */
export async function coverLetterProcessor(job: Job<QueuePayloads['cover-letter']>) {
  const { applicationId } = job.data;
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      status: true,
      coverLetterStatus: true,
      sendRuleId: true,
      job: { select: { title: true, company: true, description: true } },
      resumeVersion: { select: { parseStatus: true, parsed: true } },
      user: { select: { name: true } },
    },
  });
  if (!application) return { skipped: 'not_found' };
  if (application.coverLetterStatus !== 'generating') return { skipped: 'not_generating' };
  const status = ApplicationStatus.safeParse(application.status);
  if (!status.success || !canEditCoverLetter(status.data)) return { skipped: 'already_sent' };

  const { resumeVersion } = application;
  if (resumeVersion.parseStatus === 'pending') {
    if (isLastAttempt(job)) await markFailed(applicationId);
    throw new ResumeNotParsedYetError();
  }
  const resume = ParsedResume.safeParse(resumeVersion.parsed);
  if (!resume.success) {
    await markFailed(applicationId);
    throw new UnrecoverableError('currículo sem dados extraídos para a carta');
  }

  let writing;
  try {
    writing = await getAiProvider().writeCoverLetter({
      job: application.job,
      resume: resume.data,
      tone: await ruleTone(application.sendRuleId),
    });
  } catch (err) {
    if (err instanceof CoverLetterError) {
      await markFailed(applicationId);
      throw new UnrecoverableError(err.message);
    }
    if (isLastAttempt(job)) await markFailed(applicationId);
    throw err;
  }
  if (!writing) {
    // provedor sem cartas (noop): fica o modelo da regra, se houver, como se não houvesse IA
    await prisma.application.updateMany({
      where: { id: applicationId, coverLetterStatus: 'generating' },
      data: { coverLetterStatus: null },
    });
    return { skipped: 'provider_without_cover_letter' };
  }

  const coverLetter = renderCoverLetter(writing.body, {
    empresa: application.job.company,
    cargo: application.job.title,
    nome: application.user.name ?? '',
  });
  const { count } = await prisma.application.updateMany({
    where: { id: applicationId, coverLetterStatus: 'generating' },
    data: { coverLetter, coverLetterStatus: 'generated' },
  });
  logger.info({ applicationId, saved: count === 1, ...writing.usage }, 'carta escrita pela IA');
  return { saved: count === 1 };
}

/** Tom da regra que criou a candidatura; a regra pode ter sido apagada depois. */
async function ruleTone(sendRuleId: string | null): Promise<LetterTone> {
  const rule = sendRuleId
    ? await prisma.sendRule.findUnique({ where: { id: sendRuleId }, select: { tone: true } })
    : null;
  const tone = LetterTone.safeParse(rule?.tone);
  return tone.success ? tone.data : 'technical';
}

/** A candidatura segue com o modelo da regra, se houver; o candidato vê que a IA falhou. */
async function markFailed(applicationId: string) {
  await prisma.application.updateMany({
    where: { id: applicationId, coverLetterStatus: 'generating' },
    data: { coverLetterStatus: 'failed' },
  });
}
