import type { ContractType, Seniority, WorkModel } from '@cv-pilot/contracts';
import type { Job, SearchProfile } from '@cv-pilot/db';

/*
 * O banco guarda os enums como texto; os valores são os mesmos de contracts/enums.ts,
 * gravados só depois de validados pelo Zod (API e adapters). Daí os casts.
 */

type JobForScoring = Pick<
  Job,
  | 'title'
  | 'company'
  | 'description'
  | 'location'
  | 'workModel'
  | 'seniority'
  | 'contractType'
  | 'salaryMin'
  | 'salaryMax'
>;

type ProfileForScoring = Pick<
  SearchProfile,
  | 'keywords'
  | 'excludeKeywords'
  | 'workModels'
  | 'seniorities'
  | 'contractTypes'
  | 'companyBlacklist'
  | 'salaryMin'
  | 'salaryMax'
  | 'location'
>;

export const scoringJob = <J extends JobForScoring>(job: J) => ({
  ...job,
  workModel: job.workModel as WorkModel | null,
  seniority: job.seniority as Seniority | null,
  contractType: job.contractType as ContractType | null,
});

export const scoringProfile = <P extends ProfileForScoring>(profile: P) => ({
  ...profile,
  workModels: profile.workModels as WorkModel[],
  seniorities: profile.seniorities as Seniority[],
  contractTypes: profile.contractTypes as ContractType[],
});

/** Campos do perfil que a nota usa, para carregar só o necessário. */
export const PROFILE_SCORING_FIELDS = {
  id: true,
  keywords: true,
  excludeKeywords: true,
  workModels: true,
  seniorities: true,
  contractTypes: true,
  companyBlacklist: true,
  salaryMin: true,
  salaryMax: true,
  location: true,
} as const;
