import { Queue, type JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';

/** Nomes das filas. Workers escolhem quais consumir via WORKER_QUEUES. */
export const QUEUES = {
  scheduler: 'scheduler',
  search: 'search',
  match: 'match',
  apply: 'apply',
  notify: 'notify',
  resumeParse: 'resume-parse',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface QueuePayloads {
  scheduler: Record<string, never>;
  search: { searchProfileId: string; sourceId: string };
  match: { jobId: string; searchProfileId: string };
  apply: { applicationId: string };
  notify: { userId: string; kind: 'digest' | 'needs_action'; data?: Record<string, unknown> };
  'resume-parse': { resumeVersionId: string };
}

const defaultJobOptions: JobsOptions = {
  attempts: 4,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

let connection: Redis | undefined;

// Sem fallback: um endereço padrão esconderia um .env faltando e apontaria para o Redis errado.
function redisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL não definida: configure no .env (em dev, redis://localhost:6380)');
  }
  return url;
}

export function getRedis(): Redis {
  connection ??= new Redis(redisUrl(), {
    maxRetriesPerRequest: null, // exigido pelo BullMQ
  });
  return connection;
}

const queues = new Map<QueueName, Queue>();

export function getQueue<N extends QueueName>(name: N): Queue<QueuePayloads[N]> {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: getRedis(), defaultJobOptions });
    queues.set(name, q);
  }
  return q as Queue<QueuePayloads[N]>;
}

export async function enqueue<N extends QueueName>(
  name: N,
  data: QueuePayloads[N],
  opts?: JobsOptions,
) {
  // cast necessário: o BullMQ tipa o nome do job a partir do payload genérico
  const queue = getQueue(name) as unknown as Queue;
  return queue.add(name, data, opts);
}
