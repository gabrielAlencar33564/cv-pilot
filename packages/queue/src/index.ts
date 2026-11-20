import { Queue, type JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';

/** Nomes das filas. Workers escolhem quais consumir via WORKER_QUEUES. */
export const QUEUES = {
  scheduler: 'scheduler',
  ingest: 'ingest',
  backfill: 'backfill',
  match: 'match',
  apply: 'apply',
  notify: 'notify',
  resumeParse: 'resume-parse',
  jobRequirements: 'job-requirements',
  companyDetect: 'company-detect',
  coverLetter: 'cover-letter',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface QueuePayloads {
  scheduler: Record<string, never>;
  /**
   * um board do catálogo, uma palavra-chave ou (só `sourceId`) a listagem inteira da fonte,
   * baixados uma vez para todos os perfis
   */
  ingest:
    | { sourceId: string; careerBoardId: string }
    | { sourceId: string; keyword: string }
    | { sourceId: string };
  /** perfil novo, editado ou reativado: compara com as vagas que já estão no banco */
  backfill: { searchProfileId: string };
  match: { jobId: string; searchProfileId: string };
  apply: { applicationId: string };
  /** um alerta no app por evento; o processor recarrega o resto e confere se ainda vale */
  notify:
    | { kind: 'needs_action'; applicationId: string }
    | { kind: 'resume_parse_failed'; resumeVersionId: string }
    | { kind: 'new_jobs'; userId: string; day: string };
  'resume-parse': { resumeVersionId: string };
  /** extrai os requisitos da vaga uma vez, para o "o que falta" de todos os usuários */
  'job-requirements': { jobId: string };
  /** "Adicionar empresa": detecta o ATS da página de carreiras sugerida */
  'company-detect': { suggestionId: string };
  /** a carta da candidatura escrita pela IA (RF-54), quando a regra de envio pede */
  'cover-letter': { applicationId: string };
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

/** Intervalo aleatório antes de cada envio (1 a 10 min), para as candidaturas não saírem em rajada. */
const APPLY_MIN_DELAY_MS = 60_000;
const APPLY_DELAY_SPREAD_MS = 9 * 60_000;

/** Enfileira o envio de uma candidatura já reservada no limite diário. Idempotente pelo jobId. */
export async function enqueueApplication(applicationId: string) {
  const delay = APPLY_MIN_DELAY_MS + Math.floor(Math.random() * APPLY_DELAY_SPREAD_MS);
  return enqueue('apply', { applicationId }, { jobId: `apply_${applicationId}`, delay });
}

/** Pede a carta da IA para uma candidatura que nasceu com a carta `generating`. Idempotente. */
export async function enqueueCoverLetter(applicationId: string) {
  return enqueue('cover-letter', { applicationId }, { jobId: `cover_letter_${applicationId}` });
}

export { releaseDailySlot, reserveDailySlot } from './daily-limit';
