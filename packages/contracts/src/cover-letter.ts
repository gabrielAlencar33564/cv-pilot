import { z } from 'zod';

/** Variáveis que um modelo de carta pode usar, escritas como `{{empresa}}`. */
export const COVER_LETTER_VARIABLES = ['empresa', 'cargo', 'nome'] as const;
export type CoverLetterVariable = (typeof COVER_LETTER_VARIABLES)[number];

/** Modelo de carta de apresentação escrito pelo candidato (RF-22). */
export const CoverLetterTemplateInput = z.object({
  name: z.string().trim().min(2).max(80),
  body: z.string().trim().min(1).max(5000),
});
export type CoverLetterTemplateInput = z.infer<typeof CoverLetterTemplateInput>;
