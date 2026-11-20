/** Marcas que os formulários põem nas perguntas e que não mudam o que se pergunta. */
const REQUIRED_MARKS = /\((obrigatorio|required|opcional|optional)\)/g;

/**
 * Chave do banco de respostas (ADR 0011): a mesma pergunta escrita com outro acento,
 * pontuação, asterisco de obrigatório ou maiúscula, em outro site, cai na mesma resposta.
 */
export function questionKey(question: string): string {
  return question
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(REQUIRED_MARKS, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
