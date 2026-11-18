import { prisma } from '@cv-pilot/db';
import { QUEUES, getQueue, getRedis, type QueueName } from '@cv-pilot/queue';
import { Worker, type Processor } from 'bullmq';
import { logger } from './logger';
import { applyProcessor } from './processors/apply';
import { matchProcessor } from './processors/match';
import { notifyProcessor } from './processors/notify';
import { resumeParseProcessor } from './processors/resume-parse';
import { searchProcessor } from './processors/search';
import { schedulerTick } from './scheduler/tick';

const processors: Record<QueueName, Processor> = {
  scheduler: schedulerTick,
  search: searchProcessor,
  match: matchProcessor,
  apply: applyProcessor,
  notify: notifyProcessor,
  'resume-parse': resumeParseProcessor,
};

/** WORKER_QUEUES=search,match → esta réplica consome só essas filas. Vazio = todas. */
const selected = (process.env.WORKER_QUEUES ?? '')
  .split(',')
  .map((q) => q.trim())
  .filter(Boolean) as QueueName[];
const queues = selected.length ? selected : (Object.values(QUEUES) as QueueName[]);
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 2);

const workers = queues.map((name) => {
  const processor = processors[name];
  if (!processor) throw new Error(`Fila desconhecida em WORKER_QUEUES: ${name}`);
  const worker = new Worker(name, processor, {
    connection: getRedis(),
    concurrency: name === 'scheduler' ? 1 : concurrency,
  });
  worker.on('failed', (job, err) =>
    logger.error({ queue: name, jobId: job?.id, err: err.message }, 'job falhou'),
  );
  return worker;
});

// O agendamento é idempotente: várias réplicas podem registrar o mesmo scheduler.
if (queues.includes('scheduler')) {
  await getQueue('scheduler').upsertJobScheduler(
    'scheduler-tick',
    { every: 5 * 60_000 },
    { name: 'tick' },
  );
}

logger.info({ queues, concurrency }, 'workers iniciados');

async function shutdown() {
  logger.info('encerrando workers...');
  await Promise.all(workers.map((w) => w.close()));
  await prisma.$disconnect();
  await getRedis().quit();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
