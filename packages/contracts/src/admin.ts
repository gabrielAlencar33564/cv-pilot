import { z } from 'zod';

/** Resultado de uma execução de ingestão (`SourceRun.status`). */
export const SourceRunStatus = z.enum(['success', 'failed', 'blocked', 'rate_limited']);
export type SourceRunStatus = z.infer<typeof SourceRunStatus>;

/** Saúde de uma fonte nas últimas 24 horas (RF-80). */
export const SourceHealth = z.enum(['healthy', 'degraded', 'failing', 'idle', 'paused']);
export type SourceHealth = z.infer<typeof SourceHealth>;

/** Ligar ou desligar uma fonte e ajustar o limite de requisições dela (RF-35, RF-81). */
export const UpdateSourceInput = z
  .object({
    active: z.boolean(),
    rateLimitReqs: z.number().int().min(1).max(600),
    rateLimitMs: z.number().int().min(1000).max(3_600_000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'nada para alterar' });
export type UpdateSourceInput = z.input<typeof UpdateSourceInput>;

/** Empresa nova no catálogo de uma fonte que busca por empresa (Greenhouse, Lever). */
export const CreateCareerBoardInput = z.object({
  sourceId: z.string().min(1),
  /** slug da empresa no ATS: o que vem depois de boards.greenhouse.io/ ou jobs.lever.co/ */
  token: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._-]{0,99}$/, 'use só letras, números, ponto, hífen e sublinhado'),
});
export type CreateCareerBoardInput = z.input<typeof CreateCareerBoardInput>;

export const UpdateCareerBoardInput = z.object({ active: z.boolean() });
export type UpdateCareerBoardInput = z.input<typeof UpdateCareerBoardInput>;

export const AdminListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const CareerBoardListQuery = AdminListQuery.extend({ sourceId: z.string().min(1) });

/** Linha da tabela de fontes no admin. */
export interface AdminSourceRow {
  id: string;
  displayName: string;
  kind: string;
  active: boolean;
  rateLimitReqs: number;
  rateLimitMs: number;
  lastRunAt: string | null;
  lastError: string | null;
  health: SourceHealth;
  /** últimas 24 horas */
  runs24h: number;
  failures24h: number;
  found24h: number;
  /** vagas da fonte que continuam abertas */
  openJobs: number;
  careerBoards: number;
}

export interface SourceRunRow {
  id: string;
  target: string;
  status: SourceRunStatus;
  found: number;
  changed: number;
  matches: number;
  closed: number;
  error: string | null;
  startedAt: string;
  durationMs: number;
}

export interface CareerBoardRow {
  id: string;
  sourceId: string;
  token: string;
  active: boolean;
  lastFetchedAt: string | null;
  lastError: string | null;
  openJobs: number;
}
