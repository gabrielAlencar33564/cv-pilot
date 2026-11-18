import { z } from 'zod';

export const Seniority = z.enum(['intern', 'junior', 'mid', 'senior', 'lead', 'manager']);
export const WorkModel = z.enum(['remote', 'hybrid', 'onsite']);
export const ContractType = z.enum(['clt', 'pj', 'internship', 'temporary', 'freelance']);
export const ApplyMode = z.enum(['api', 'email', 'assisted']);
export const LetterTone = z.enum(['technical', 'humanized', 'formal', 'direct']);
export const ApplicationStatus = z.enum([
  'suggested',
  'queued',
  'needs_action',
  'sent',
  'in_process',
  'interview',
  'offer',
  'rejected',
  'no_response',
  'failed',
]);

export type Seniority = z.infer<typeof Seniority>;
export type WorkModel = z.infer<typeof WorkModel>;
export type ContractType = z.infer<typeof ContractType>;
export type ApplyMode = z.infer<typeof ApplyMode>;
export type LetterTone = z.infer<typeof LetterTone>;
export type ApplicationStatus = z.infer<typeof ApplicationStatus>;
