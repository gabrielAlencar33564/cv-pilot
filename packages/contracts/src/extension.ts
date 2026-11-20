import { z } from 'zod';
import { ProfileLinks } from './account';
import { CoverLetterStatus } from './cover-letter';

/**
 * Começo de todo token da extensão: deixa claro o que é se ele aparecer num log ou num
 * repositório, e a extensão recusa na hora um texto colado que não é token.
 */
export const EXTENSION_TOKEN_PREFIX = 'cvp_ext_';

/** Nome que o candidato dá à chave, para reconhecer o navegador ("Chrome do trabalho"). */
export const ExtensionTokenInput = z.object({ name: z.string().trim().min(2).max(60) });
export type ExtensionTokenInput = z.infer<typeof ExtensionTokenInput>;

/** Chave da extensão como a conta lista: o token em si só aparece uma vez, ao criar. */
export interface ExtensionTokenRow {
  id: string;
  name: string;
  /** começo do token, para reconhecer qual é */
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Dados do perfil base (RF-02) que a extensão usa para preencher formulários. */
export const ExtensionProfile = z.object({
  name: z.string().nullable(),
  email: z.string(),
  phone: z.string().nullable(),
  city: z.string().nullable(),
  links: ProfileLinks,
  salaryExpectation: z.number().nullable(),
  availability: z.string().nullable(),
});
export type ExtensionProfile = z.infer<typeof ExtensionProfile>;

/** Candidatura em "Ação necessária" com o que a extensão precisa para preencher o formulário. */
export const ExtensionApplication = z.object({
  id: z.string(),
  /** página da vaga no site de onde a candidatura saiu */
  url: z.string(),
  job: z.object({ title: z.string(), company: z.string() }),
  source: z.object({ displayName: z.string() }),
  coverLetter: z.string().nullable(),
  coverLetterStatus: CoverLetterStatus.nullable(),
  /** respostas padrão da regra de envio: pergunta → resposta */
  answers: z.record(z.string(), z.string()),
  resume: z.object({
    name: z.string(),
    version: z.number(),
    fileName: z.string(),
    mimeType: z.string(),
  }),
});
export type ExtensionApplication = z.infer<typeof ExtensionApplication>;

export const ExtensionApplicationList = z.array(ExtensionApplication);
