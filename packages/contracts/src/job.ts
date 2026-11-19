import { z } from 'zod';
import { ContractType, Seniority, WorkModel } from './enums';

/** Vaga no formato único interno (após a normalização feita pelo adapter). */
export const NormalizedJob = z.object({
  sourceId: z.string(),
  externalId: z.string(),
  url: z.string().url(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullish(),
  workModel: WorkModel.nullish(),
  seniority: Seniority.nullish(),
  contractType: ContractType.nullish(),
  salaryMin: z.number().nullish(),
  salaryMax: z.number().nullish(),
  description: z.string().default(''),
  publishedAt: z.coerce.date().nullish(),
  /** e-mail para candidatura, quando a vaga pede envio por e-mail */
  applyEmail: z.string().email().nullish(),
});

export type NormalizedJob = z.infer<typeof NormalizedJob>;

export const JobListQuery = z.object({
  searchProfileId: z.string().optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type JobListQuery = z.infer<typeof JobListQuery>;

/** Por que o usuário não quer a vaga (RF-42). Alimenta os filtros do perfil. */
export const DismissReason = z.enum([
  'not_interested',
  'salary',
  'location',
  'seniority',
  'company',
  'other',
]);
export type DismissReason = z.infer<typeof DismissReason>;

export const DismissJobInput = z.object({
  reason: DismissReason,
  /** põe a empresa na lista de exclusão do perfil, para as próximas vagas dela não aparecerem */
  blockCompany: z.boolean().default(false),
});
export type DismissJobInput = z.input<typeof DismissJobInput>;
