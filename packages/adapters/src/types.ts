import type { ApplyMode, NormalizedJob } from '@cv-pilot/contracts';

export type AdapterKind = 'api' | 'html' | 'browser';

/**
 * Como a ingestão percorre a fonte: pelo board de cada empresa do catálogo (`CareerBoard`),
 * por palavra-chave, quando o site tem busca própria, ou pela listagem inteira (`feed`),
 * quando o site é pequeno o bastante para ser lido de uma vez.
 */
export type FetchBy = 'board' | 'keyword' | 'feed';

export type AtsRecognition = { kind: 'board'; token: string } | { kind: 'covered' };

export interface AdapterContext {
  /** fetch com User-Agent identificado, timeout e intervalo mínimo por host */
  http: (url: string, init?: RequestInit) => Promise<Response>;
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
  | {
      status: 'needs_action';
      reason: 'captcha' | 'login' | 'unknown_question' | 'other';
      detail?: string;
    }
  | { status: 'failed'; error: string; retryable: boolean };

/** Contrato que todo site de vagas implementa. Adicionar site = novo adapter. */
export interface JobSourceAdapter<Raw = unknown> {
  id: string;
  displayName: string;
  kind: AdapterKind;

  fetchBy: FetchBy;
  /**
   * Todas as vagas de um alvo, sem filtrar pelo perfil (o match filtra depois): o token do
   * board quando `fetchBy` é 'board', a palavra-chave quando é 'keyword', e vazio no 'feed'.
   */
  fetch(target: string, ctx: AdapterContext): AsyncIterable<Raw>;
  /**
   * Para sites cuja listagem não traz a vaga inteira. A ingestão só pede a página da vaga
   * quando a fonte ainda não a tem aberta; das conhecidas, só renova o `lastSeen`. Assim a
   * leitura de hora em hora não baixa de novo centenas de páginas que não mudaram.
   */
  detail?: {
    /** o `externalId` da vaga, já na listagem */
    idOf(listed: Raw): string;
    fetch(listed: Raw, ctx: AdapterContext): Promise<Raw>;
  };
  normalize(raw: Raw): NormalizedJob;
  /**
   * Reconhece um endereço desta fonte, para o "Adicionar empresa": o token da empresa nas
   * fontes por board, ou `covered` quando a fonte já é lida inteira (por palavra-chave ou feed)
   * e a empresa não precisa entrar no catálogo. `null` se o endereço não é desta fonte.
   */
  recognize?(url: URL): AtsRecognition | null;
  isStillOpen?(job: NormalizedJob, ctx: AdapterContext): Promise<boolean>;

  apply?: {
    modes: ApplyMode[];
    submit(input: ApplyInput, ctx: AdapterContext): Promise<ApplyResult>;
  };
}
