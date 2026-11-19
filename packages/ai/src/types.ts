import type { ParsedResume, ResumeParseFailure } from '@cv-pilot/contracts';

/** O currículo como chega ao provedor: PDF vai inteiro; DOCX chega já convertido em texto. */
export type ResumeDocument = { kind: 'pdf'; data: Uint8Array } | { kind: 'text'; text: string };

export interface ResumeExtraction {
  resume: ParsedResume;
  /** tokens gastos, para registrar o custo por tarefa */
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * Interface do provedor de IA. Processors e API nunca importam o SDK diretamente.
 * Cartas e embeddings entram aqui quando tiverem quem os chame (Etapas 3 e 4).
 */
export interface AiProvider {
  parseResume(document: ResumeDocument): Promise<ResumeExtraction>;
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
