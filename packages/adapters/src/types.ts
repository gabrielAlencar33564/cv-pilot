import type { ApplyMode, NormalizedJob, SearchProfileInput } from '@cv-pilot/contracts';

export type AdapterKind = 'api' | 'html' | 'browser';

/** Parâmetros de busca derivados de um perfil de busca. */
export type SearchQuery = Pick<
  SearchProfileInput,
  'keywords' | 'excludeKeywords' | 'workModels' | 'location' | 'seniorities'
>;

export interface AdapterContext {
  /** fetch com User-Agent identificado, timeout e intervalo mínimo por host */
  http: (url: string, init?: RequestInit) => Promise<Response>;
  /** configuração da fonte vinda do banco (Source.config) */
  config: Record<string, unknown>;
  log: (msg: string, data?: Record<string, unknown>) => void;
  /** limite de vagas por execução */
  maxResults: number;
}

export interface ApplyInput {
  job: NormalizedJob;
  candidate: { name: string; email: string; phone?: string | null };
  resume: { fileName: string; mimeType: string; content: Uint8Array };
  coverLetter?: string | null;
  answers: Record<string, string>;
}

export type ApplyResult =
  | { status: 'sent'; externalRef?: string }
  | { status: 'needs_action'; reason: 'captcha' | 'login' | 'unknown_question' | 'other'; detail?: string }
  | { status: 'failed'; error: string; retryable: boolean };

/** Contrato que todo site de vagas implementa. Adicionar site = novo adapter. */
export interface JobSourceAdapter<Raw = unknown> {
  id: string;
  displayName: string;
  kind: AdapterKind;

  search(query: SearchQuery, ctx: AdapterContext): AsyncIterable<Raw>;
  normalize(raw: Raw): NormalizedJob;
  isStillOpen?(job: NormalizedJob, ctx: AdapterContext): Promise<boolean>;

  apply?: {
    modes: ApplyMode[];
    submit(input: ApplyInput, ctx: AdapterContext): Promise<ApplyResult>;
  };
}
