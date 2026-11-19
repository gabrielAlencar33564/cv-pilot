import { prisma, type Prisma } from '@cv-pilot/db';
import { enqueue, type QueuePayloads } from '@cv-pilot/queue';
import type { Job } from 'bullmq';

/**
 * Envia a candidatura conforme o modo da regra:
 * - assisted: marca "needs_action" para a extensão do navegador concluir com o usuário
 * - email:    TODO enviar pela conta OAuth do candidato (Gmail/Outlook)
 * - api:      TODO chamar adapter.apply.submit com o arquivo do currículo (S3)
 * Nunca tenta burlar CAPTCHA/login: nesses casos também vira "needs_action".
 */
export async function applyProcessor(job: Job<QueuePayloads['apply']>) {
  const application = await prisma.application.findUnique({
    where: { id: job.data.applicationId },
  });
  if (!application || application.status !== 'queued') return { skipped: true };

  const log = (application.log as Prisma.JsonArray) ?? [];
  const event = (type: string, detail?: string) => ({ at: new Date().toISOString(), type, detail });

  let status: string;
  let entry;
  switch (application.mode) {
    case 'assisted':
      status = 'needs_action';
      entry = event('assisted_pending', 'Aguardando o candidato concluir pela extensão');
      break;
    case 'email':
    case 'api':
    default:
      status = 'needs_action';
      entry = event('not_implemented', `Modo ${application.mode} ainda não implementado`);
  }

  await prisma.application.update({
    where: { id: application.id },
    data: { status, log: [...log, entry] },
  });
  if (status === 'needs_action') {
    await enqueue(
      'notify',
      { kind: 'needs_action', applicationId: application.id },
      { jobId: `notify_needs_action_${application.id}` },
    );
  }
  return { status };
}
