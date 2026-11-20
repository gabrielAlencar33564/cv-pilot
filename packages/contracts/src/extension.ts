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

/**
 * Fonte das vagas que o candidato salva de qualquer site pela extensão (ADR 0011). Fica
 * inativa: nenhum bot busca nela, e ela não aparece na escolha de sites dos perfis.
 */
export const MANUAL_SOURCE_ID = 'manual';

/** Vaga lida da página aberta, conferida pelo candidato no popup antes de salvar. */
export const ExtensionSaveJobInput = z.object({
  url: z.string().trim().url().max(2000),
  title: z.string().trim().min(2).max(200),
  company: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).nullish(),
  description: z.string().max(20_000).default(''),
});
export type ExtensionSaveJobInput = z.infer<typeof ExtensionSaveJobInput>;

export const ExtensionSavedJob = z.object({
  applicationId: z.string(),
  /** false quando o candidato já tinha uma candidatura para esta vaga */
  created: z.boolean(),
});
export type ExtensionSavedJob = z.infer<typeof ExtensionSavedJob>;
