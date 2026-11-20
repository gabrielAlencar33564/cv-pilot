/** Cria um elemento com texto; o conteúdo vem da API ou da página e nunca vira HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = '',
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

/** Roda a ação de um botão, com ele ocupado enquanto ela não termina. */
export type RunAction = (button: HTMLButtonElement, action: () => Promise<void>) => Promise<void>;
