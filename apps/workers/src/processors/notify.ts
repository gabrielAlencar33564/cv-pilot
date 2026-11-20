import type { NotificationContent } from '@cv-pilot/contracts';
import { followUpSentCutoff } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';
import type { QueuePayloads } from '@cv-pilot/queue';
import type { Job } from 'bullmq';

/** Sem resumo anterior, o primeiro conta o que aconteceu nas últimas 24 horas. */
const FIRST_DIGEST_WINDOW_MS = 24 * 3600_000;

/**
 * Grava um alerta no app (RF-70/71), no lugar do e-mail por enquanto. Cada alerta tem uma
 * chave própria: rodar o mesmo job de novo não duplica nada.
 */
export async function notifyProcessor(job: Job<QueuePayloads['notify']>) {
  const payload = job.data;
  switch (payload.kind) {
    case 'needs_action':
      return notifyNeedsAction(payload.applicationId);
    case 'resume_parse_failed':
      return notifyResumeParseFailed(payload.resumeVersionId);
    case 'new_jobs':
      return notifyNewJobs(payload.userId, payload.day);
    case 'follow_ups':
      return notifyFollowUps(payload.userId, payload.day);
  }
}

async function save(userId: string, dedupeKey: string, content: NotificationContent) {
  await prisma.notification.upsert({
    where: { userId_dedupeKey: { userId, dedupeKey } },
    create: { userId, dedupeKey, ...content },
    update: {},
  });
  return { notified: content.kind };
}

async function notifyNeedsAction(applicationId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { userId: true, status: true },
  });
  // o candidato já resolveu (ou apagou) antes do alerta sair
  if (application?.status !== 'needs_action') return { skipped: true };
  return save(application.userId, `needs_action_${applicationId}`, {
    kind: 'needs_action',
    data: { applicationId },
  });
}

async function notifyResumeParseFailed(resumeVersionId: string) {
  const version = await prisma.resumeVersion.findUnique({
    where: { id: resumeVersionId },
    select: { parseStatus: true, resumeId: true, resume: { select: { userId: true } } },
  });
  if (version?.parseStatus !== 'failed') return { skipped: true };
  return save(version.resume.userId, `resume_parse_failed_${resumeVersionId}`, {
    kind: 'resume_parse_failed',
    data: { resumeId: version.resumeId, resumeVersionId },
  });
}

async function isActiveUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { deletedAt: true } });
  return Boolean(user && !user.deletedAt);
}

/** Desde quando o resumo diário conta: o último alerta do mesmo tipo ou as últimas 24 horas. */
async function digestSince(userId: string, kind: NotificationContent['kind']) {
  const previous = await prisma.notification.findFirst({
    where: { userId, kind },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return previous?.createdAt ?? new Date(Date.now() - FIRST_DIGEST_WINDOW_MS);
}

/** Resumo diário: quantas vagas novas apareceram desde o resumo anterior. Nada novo, nada sai. */
async function notifyNewJobs(userId: string, day: string) {
  if (!(await isActiveUser(userId))) return { skipped: true };

  const since = await digestSince(userId, 'new_jobs');
  const count = await prisma.jobMatch.count({
    where: { searchProfile: { userId }, dismissed: false, createdAt: { gt: since } },
  });
  if (count === 0) return { skipped: true, count };
  return save(userId, `new_jobs_${day}`, { kind: 'new_jobs', data: { count, day } });
}

/**
 * Resumo diário dos follow-ups: quantas candidaturas paradas em "Enviada" chegaram ao prazo de
 * cobrar a empresa desde o resumo anterior. Cada uma entra numa contagem só.
 */
async function notifyFollowUps(userId: string, day: string) {
  if (!(await isActiveUser(userId))) return { skipped: true };

  const since = await digestSince(userId, 'follow_ups_due');
  const count = await prisma.application.count({
    where: {
      userId,
      status: 'sent',
      followedUpAt: null,
      sentAt: { gt: followUpSentCutoff(since), lte: followUpSentCutoff(new Date()) },
    },
  });
  if (count === 0) return { skipped: true, count };
  return save(userId, `follow_ups_due_${day}`, { kind: 'follow_ups_due', data: { count, day } });
}
