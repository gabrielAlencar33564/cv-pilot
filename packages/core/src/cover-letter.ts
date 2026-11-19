import { COVER_LETTER_VARIABLES, type CoverLetterVariable } from '@cv-pilot/contracts';

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
