import {
  COVER_LETTER_VARIABLES,
  type ApplicationStatus,
  type CoverLetterStatus,
  type CoverLetterVariable,
} from '@cv-pilot/contracts';

// {{empresa}}, {{ Cargo }}...: aceita espaços e maiúsculas, que o candidato digita sem perceber
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Preenche um modelo de carta com os dados da vaga e do candidato.
 * Chaves que não são variáveis conhecidas ficam como estão, para o candidato ver o erro.
 */
export function renderCoverLetter(
  body: string,
  values: Record<CoverLetterVariable, string>,
): string {
  return body.replace(PLACEHOLDER, (placeholder, name: string) => {
    const variable = COVER_LETTER_VARIABLES.find((v) => v === name.toLowerCase());
    return variable ? values[variable] : placeholder;
  });
}

interface CoverLetterRule {
  generateCoverLetter: boolean;
  coverLetterTemplate: { body: string } | null;
}

/**
 * A carta com que a candidatura nasce. Com a IA ligada na regra (RF-54), ela começa como
 * `generating`, e o modelo preenchido, se houver, fica como reserva caso a IA falhe.
 */
export function initialCoverLetter(
  rule: CoverLetterRule,
  values: Record<CoverLetterVariable, string>,
): { coverLetter: string | null; coverLetterStatus: CoverLetterStatus | null } {
  const coverLetter = rule.coverLetterTemplate
    ? renderCoverLetter(rule.coverLetterTemplate.body, values)
    : null;
  return { coverLetter, coverLetterStatus: rule.generateCoverLetter ? 'generating' : null };
}

/** Depois do envio, a carta é o que a empresa recebeu: só muda enquanto a candidatura não saiu. */
const COVER_LETTER_EDITABLE: readonly ApplicationStatus[] = ['suggested', 'queued', 'needs_action'];

export function canEditCoverLetter(status: ApplicationStatus): boolean {
  return COVER_LETTER_EDITABLE.includes(status);
}
