import type { Job } from 'bullmq';

/**
 * Esta é a última tentativa do job: se falhar, o BullMQ não repete. Durante o processamento,
 * `attemptsMade` conta só as tentativas que já falharam.
 */
export function isLastAttempt(job: Pick<Job, 'attemptsMade' | 'opts'>) {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}
