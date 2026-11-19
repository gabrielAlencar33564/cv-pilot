// zod/v4 (incluído no zod 3.25): o helper de saída estruturada do SDK da Anthropic só aceita
// schemas v4, e assim o mesmo schema serve para pedir a extração e para validar o resultado.
import { z } from 'zod/v4';

const dateOrNull = z
  .string()
  .nullable()
  .describe('AAAA-MM quando o mês aparece, AAAA quando só há o ano; null se não houver');

/** Dados extraídos de um currículo. O candidato revisa e corrige na tela (RF-21). */
export const ParsedResume = z.object({
  summary: z.string().nullable().describe('resumo profissional como está no currículo, ou null'),
  skills: z.array(z.string()).describe('habilidades e tecnologias citadas'),
  experiences: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      start: dateOrNull,
      end: dateOrNull.describe('null quando é o emprego atual ou não há data'),
      description: z.string().nullable(),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      course: z.string(),
      end: dateOrNull,
    }),
  ),
  languages: z.array(z.object({ name: z.string(), level: z.string().nullable() })),
});
export type ParsedResume = z.infer<typeof ParsedResume>;

/** Estado da extração de uma versão de currículo (`ResumeVersion.parseStatus`). */
export const ResumeParseStatus = z.enum(['pending', 'parsed', 'failed']);
export type ResumeParseStatus = z.infer<typeof ResumeParseStatus>;

/** Por que a extração falhou (`ResumeVersion.parseError`). Nunca guarda conteúdo do currículo. */
export const ResumeParseFailure = z.enum([
  'refusal',
  'max_tokens',
  'invalid_output',
  'provider_rejected',
  'unreadable_file',
  /** erro temporário (IA, storage, rede) que continuou depois de todas as tentativas */
  'retries_exhausted',
]);
export type ResumeParseFailure = z.infer<typeof ResumeParseFailure>;
