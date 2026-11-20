import { z } from 'zod';

/** Variáveis que um modelo de carta pode usar, escritas como `{{empresa}}`. */
export const COVER_LETTER_VARIABLES = ['empresa', 'cargo', 'nome'] as const;
export type CoverLetterVariable = (typeof COVER_LETTER_VARIABLES)[number];

/** Tamanho máximo de uma carta, escrita pelo candidato ou pela IA. */
export const COVER_LETTER_MAX_CHARS = 5000;

/** Modelo de carta de apresentação escrito pelo candidato (RF-22). */
export const CoverLetterTemplateInput = z.object({
  name: z.string().trim().min(2).max(80),
  body: z.string().trim().min(1).max(COVER_LETTER_MAX_CHARS),
});
export type CoverLetterTemplateInput = z.infer<typeof CoverLetterTemplateInput>;

/**
 * De onde veio a carta da candidatura (`Application.coverLetterStatus`): a IA escrevendo, escrita
 * pela IA, a IA falhou (fica o modelo, se houver) ou editada pelo candidato. Null quando é o
 * modelo preenchido, sem IA (RF-54).
 */
export const CoverLetterStatus = z.enum(['generating', 'generated', 'failed', 'edited']);
export type CoverLetterStatus = z.infer<typeof CoverLetterStatus>;
