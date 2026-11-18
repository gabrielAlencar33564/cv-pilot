import type { QueuePayloads } from '@cv-pilot/queue';
import type { Job } from 'bullmq';
import { logger } from '../logger';

/** TODO: enviar e-mail (SMTP transacional) com resumo diário ou alerta de ação necessária. */
export async function notifyProcessor(job: Job<QueuePayloads['notify']>) {
  logger.info({ userId: job.data.userId, kind: job.data.kind }, 'notificação (stub)');
  return { delivered: false };
}
