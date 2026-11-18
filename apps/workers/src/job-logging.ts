import { withLogContext } from '@cv-pilot/logger';
import type { QueueName } from '@cv-pilot/queue';
import { UnrecoverableError, type Job, type Processor, type Worker } from 'bullmq';
import { logger } from './logger';

/**
 * Envolve o processor: toda linha de log emitida durante o job, inclusive pelos
 * adapters e pelo core, leva `queue`, `jobId` e `attempt`, e o fim do job registra
 * a duração e o resultado. As falhas são registradas pelo evento `failed`
 * (ver `logWorkerEvents`), que também cobre jobs travados.
 */
export function withJobContext(
  queue: QueueName,
  processor: Processor<unknown, unknown>,
): Processor<unknown, unknown> {
  return (job, token, signal) =>
    withLogContext({ queue, jobId: job.id, attempt: job.attemptsMade + 1 }, async () => {
      const startedAt = Date.now();
      // o payload só leva ids (regra da skill fila-worker), então pode ir para o log
      logger.debug({ data: job.data }, 'job iniciado');
      const result = await processor(job, token, signal);
      logger.info({ durationMs: Date.now() - startedAt, result }, 'job concluído');
      return result;
    });
}

/** Em qual tentativa o job falhou e se o BullMQ ainda vai tentar de novo. */
export function failureInfo(job: Pick<Job, 'attemptsMade' | 'opts'>, err: Error) {
  // no evento `failed`, attemptsMade já conta a tentativa que acabou de falhar
  const maxAttempts = job.opts.attempts ?? 1;
  const unrecoverable = err instanceof UnrecoverableError || err.name === 'UnrecoverableError';
  return {
    attempt: job.attemptsMade,
    maxAttempts,
    willRetry: !unrecoverable && job.attemptsMade < maxAttempts,
  };
}

/** Falhas de job (warn se vai repetir, error se não), jobs travados e erros do próprio worker. */
export function logWorkerEvents(worker: Worker, queue: QueueName) {
  worker.on('failed', (job, err) => {
    const info = job ? failureInfo(job, err) : { willRetry: false };
    const fields = {
      queue,
      jobId: job?.id,
      data: job?.data as unknown,
      durationMs: job?.processedOn ? Date.now() - job.processedOn : undefined,
      ...info,
      err,
    };
    if (info.willRetry) logger.warn(fields, 'job falhou; o BullMQ vai tentar de novo');
    else logger.error(fields, 'job falhou e não será repetido');
  });
  worker.on('stalled', (jobId) => logger.warn({ queue, jobId }, 'job travou e voltou para a fila'));
  // sem este listener, um erro de conexão com o Redis derruba o processo sem log útil
  worker.on('error', (err) => logger.error({ queue, err }, 'erro no worker'));
}
