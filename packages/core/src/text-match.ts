/**
 * Quebra o texto em termos minúsculos e sem acentos. Mantém `+`, `#` e `.` dentro do termo
 * (c++, c#, node.js, .net) e tira o ponto final de frase ("React." → "react").
 */
export function tokenize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((token) => token.replace(/\.+$/, ''))
    .filter(Boolean);
}

/** O termo (uma ou mais palavras) aparece inteiro e na ordem: "java" não casa com "javascript". */
export function containsTerm(tokens: readonly string[], term: string): boolean {
  const wanted = tokenize(term);
  if (!wanted.length) return false;
  for (let start = 0; start + wanted.length <= tokens.length; start++) {
    if (wanted.every((word, i) => tokens[start + i] === word)) return true;
  }
  return false;
}
