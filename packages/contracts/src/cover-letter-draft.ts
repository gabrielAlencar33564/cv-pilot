// zod/v4: o mesmo schema pede a carta ao Claude (o helper do SDK só aceita v4) e valida a
// saída antes de gravar, como o ParsedResume.
import { z } from 'zod/v4';

/** Carta escrita pela IA (RF-54), antes de trocar `{{nome}}` pelo nome do candidato. */
export const CoverLetterDraft = z.object({
  body: z
    .string()
    .describe(
      'a carta completa em português do Brasil, em parágrafos separados por linha em branco, terminando com a despedida e {{nome}} na última linha',
    ),
});
export type CoverLetterDraft = z.infer<typeof CoverLetterDraft>;
