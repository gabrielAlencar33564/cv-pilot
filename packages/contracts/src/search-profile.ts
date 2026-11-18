import { z } from 'zod';
import { ContractType, Seniority, WorkModel } from './enums';

/** "O que estou buscando": um usuário pode ter vários perfis de busca. */
export const SearchProfileInput = z.object({
  name: z.string().min(2).max(80),
  keywords: z.array(z.string().min(1)).min(1),
  excludeKeywords: z.array(z.string().min(1)).default([]),
  seniorities: z.array(Seniority).default([]),
  workModels: z.array(WorkModel).default([]),
  contractTypes: z.array(ContractType).default([]),
  location: z.string().max(120).nullish(),
  radiusKm: z.number().int().positive().max(500).nullish(),
  salaryMin: z.number().int().nonnegative().nullish(),
  salaryMax: z.number().int().nonnegative().nullish(),
  companyBlacklist: z.array(z.string()).default([]),
  /** ids das fontes (sites) onde buscar, ex.: ["gupy", "greenhouse"] */
  sourceIds: z.array(z.string()).min(1),
  /** intervalo entre buscas, em minutos */
  frequencyMinutes: z.number().int().min(60).max(10_080).default(360),
  dailyApplyLimit: z.number().int().min(0).max(100).default(10),
  /** nota mínima (0-100) para envio automático */
  minScoreAutoApply: z.number().int().min(0).max(100).default(75),
  active: z.boolean().default(true),
});

export type SearchProfileInput = z.input<typeof SearchProfileInput>;
