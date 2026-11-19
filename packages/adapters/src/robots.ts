/**
 * Leitura do robots.txt pela RFC 9309. O bot usa só o grupo do próprio nome (ou o `*`) e,
 * entre as regras que casam com o caminho, vale a mais específica.
 */

interface RobotsRule {
  allow: boolean;
  pattern: string;
}

interface Group {
  agents: string[];
  rules: RobotsRule[];
}

/** A RFC pede para ler ao menos 500 KiB; o que passar disso é ignorado. */
export const MAX_ROBOTS_BYTES = 500 * 1024;

function parseGroups(body: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let readingAgents = false;

  for (const rawLine of body.slice(0, MAX_ROBOTS_BYTES).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === 'user-agent') {
      // várias linhas de user-agent seguidas formam um grupo só
      if (!current || !readingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      readingAgents = true;
      continue;
    }
    if (field !== 'allow' && field !== 'disallow') continue;
    readingAgents = false;
    // regra antes de qualquer user-agent não pertence a grupo nenhum; Disallow vazio não proíbe nada
    if (!current || !value) continue;
    current.rules.push({ allow: field === 'allow', pattern: value });
  }
  return groups;
}

/**
 * As regras que valem para o bot: as de todos os grupos com o nome dele (sem diferenciar
 * maiúsculas), ou, se não houver, as dos grupos `*`. Sem nenhum dos dois, nada é proibido.
 */
export function rulesFor(body: string, productToken: string): RobotsRule[] {
  const groups = parseGroups(body);
  const token = productToken.toLowerCase();
  const own = groups.filter((g) => g.agents.includes(token));
  const chosen = own.length ? own : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

const escapeRegExp = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** `*` casa com qualquer sequência; `$` no fim prende o padrão ao fim do caminho. */
function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = new RegExp(
    `^${body.split('*').map(escapeRegExp).join('.*')}${anchored ? '$' : ''}`,
  );
  return regex.test(path);
}

/**
 * O caminho (com a query string) pode ser acessado? Vence a regra mais longa que casa; no
 * empate entre Allow e Disallow, vence o Allow, que é o menos restritivo. O próprio
 * /robots.txt é sempre permitido.
 */
export function isPathAllowed(rules: readonly RobotsRule[], path: string): boolean {
  if (path === '/robots.txt') return true;
  let best: RobotsRule | null = null;
  for (const rule of rules) {
    if (!matches(rule.pattern, path)) continue;
    const longer = !best || rule.pattern.length > best.pattern.length;
    const tieWithAllow = best && rule.pattern.length === best.pattern.length && rule.allow;
    if (longer || tieWithAllow) best = rule;
  }
  return best?.allow ?? true;
}
