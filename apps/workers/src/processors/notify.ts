import type { NotificationContent } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import type { QueuePayloads } from '@cv-pilot/queue';
import type { Job } from 'bullmq';

/** Sem resumo anterior, o primeiro conta as vagas das últimas 24 horas. */
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

/** Resumo diário: quantas vagas novas apareceram desde o resumo anterior. Nada novo, nada sai. */
async function notifyNewJobs(userId: string, day: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { deletedAt: true } });
  if (!user || user.deletedAt) return { skipped: true };

  const previous = await prisma.notification.findFirst({
    where: { userId, kind: 'new_jobs' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const since = previous?.createdAt ?? new Date(Date.now() - FIRST_DIGEST_WINDOW_MS);
  const count = await prisma.jobMatch.count({
    where: { searchProfile: { userId }, dismissed: false, createdAt: { gt: since } },
  });
  if (count === 0) return { skipped: true, count };
  return save(userId, `new_jobs_${day}`, { kind: 'new_jobs', data: { count, day } });
}
