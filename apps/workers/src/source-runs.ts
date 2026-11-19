import type { SourceRunStatus } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';

/** O admin olha as últimas 24 horas; um mês de histórico basta para investigar uma quebra. */
const RUN_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60_000;
const MAX_ERROR_LENGTH = 500;

/** Mensagem do erro, cortada para caber em `lastError` e `SourceRun.error`. */
export const errorMessage = (err: unknown) =>
  (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR_LENGTH);

interface SourceRunResult {
  sourceId: string;
  careerBoardId: string | null;
  target: string;
  status: SourceRunStatus;
  startedAt: Date;
  found: number;
  changed: number;
  matches: number;
  closed: number;
  error?: string | null;
}

/** Grava uma tentativa de ingestão (RF-80). Cada retentativa do job é uma execução a mais. */
export async function recordSourceRun(run: SourceRunResult) {
  await prisma.sourceRun.create({
    data: {
      ...run,
      error: run.error ?? null,
      durationMs: Date.now() - run.startedAt.getTime(),
    },
  });
}

/** Apaga as execuções com mais de `RUN_RETENTION_DAYS` dias. */
export async function pruneSourceRuns(now: Date) {
  const { count } = await prisma.sourceRun.deleteMany({
    where: { startedAt: { lt: new Date(now.getTime() - RUN_RETENTION_DAYS * DAY_MS) } },
  });
  return count;
}
