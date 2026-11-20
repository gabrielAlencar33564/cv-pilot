import type { JobRequirement, ParsedResume, ResumeParseFailure } from '@cv-pilot/contracts';

/** O currículo como chega ao provedor: PDF vai inteiro; DOCX chega já convertido em texto. */
export type ResumeDocument = { kind: 'pdf'; data: Uint8Array } | { kind: 'text'; text: string };

export interface ResumeExtraction {
  resume: ParsedResume;
  /** tokens gastos, para registrar o custo por tarefa */
  usage: { inputTokens: number; outputTokens: number };
}

export interface RequirementsExtraction {
  requirements: JobRequirement[];
  /** tokens gastos, para registrar o custo por tarefa */
  usage: { inputTokens: number; outputTokens: number };
}

/** Vagas e currículos são `document`; uma busca digitada seria `query`. */
export type EmbeddingInputType = 'document' | 'query';

export interface Embeddings {
  /** um vetor por texto, na ordem dos textos */
  vectors: number[][];
  /** tokens gastos, para registrar o custo por tarefa */
  usage: { totalTokens: number };
}

/**
 * Interface do provedor de IA. Processors e API nunca importam o SDK diretamente.
 * Cartas entram aqui quando tiverem quem as chame (Etapa 4).
 */
export interface AiProvider {
  parseResume(document: ResumeDocument): Promise<ResumeExtraction>;
  /**
   * Embeddings para a similaridade vaga × currículo (RF-40). `null` quando o provedor não gera
   * embeddings (o `noop`): o match segue só com as regras.
   */
  embed(texts: string[], inputType: EmbeddingInputType): Promise<Embeddings | null>;
  /**
   * Requisitos da vaga que dá para conferir no currículo (RF-41). Recebe só o texto da vaga,
   * nunca dado do candidato. `null` quando o provedor não extrai (o `noop`).
   */
  extractJobRequirements(job: {
    title: string;
    description: string;
  }): Promise<RequirementsExtraction | null>;
}

/** Falha definitiva dos embeddings: o provedor recusou o pedido ou devolveu algo inesperado. */
export class EmbeddingError extends Error {
  constructor(
    public readonly code: 'provider_rejected' | 'invalid_output',
    options?: ErrorOptions,
  ) {
    super(`embeddings falharam: ${code}`, options);
    this.name = 'EmbeddingError';
  }
}

/** Falha definitiva da extração de requisitos: repetir a mesma chamada não resolve. */
export class JobRequirementsError extends Error {
  constructor(
    public readonly code: 'refusal' | 'max_tokens' | 'invalid_output' | 'provider_rejected',
    options?: ErrorOptions,
  ) {
    super(`extração dos requisitos da vaga falhou: ${code}`, options);
    this.name = 'JobRequirementsError';
  }
}

/** Falha definitiva da extração: repetir a mesma chamada não resolve. */
export class ResumeParseError extends Error {
  constructor(
    public readonly code: ResumeParseFailure,
    options?: ErrorOptions,
  ) {
    super(`extração do currículo falhou: ${code}`, options);
    this.name = 'ResumeParseError';
  }
}
