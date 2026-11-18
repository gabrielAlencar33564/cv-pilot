import { z } from 'zod';
import { ApplyMode, LetterTone } from './enums';

/**
 * Regra de envio: qual currículo, carta e tom usar.
 * Escopo opcional por site (sourceId) e/ou perfil de busca (searchProfileId).
 * Precedência: perfil+site > site > perfil > padrão da conta.
 */
export const SendRuleInput = z.object({
  sourceId: z.string().nullish(),
  searchProfileId: z.string().nullish(),
  resumeId: z.string(),
  coverLetterTemplateId: z.string().nullish(),
  generateCoverLetter: z.boolean().default(false),
  tone: LetterTone.default('technical'),
  mode: ApplyMode.default('assisted'),
  reviewBeforeSend: z.boolean().default(true),
  /** respostas padrão para perguntas frequentes dos formulários */
  defaultAnswers: z.record(z.string(), z.string()).default({}),
});

export type SendRuleInput = z.input<typeof SendRuleInput>;
