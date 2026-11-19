/**
 * Um alvo da ingestão: o board de uma empresa, uma palavra-chave numa fonte com busca ou,
 * sem mais nada, a listagem inteira da fonte (`feed`).
 */
export type IngestTarget =
  | { sourceId: string; careerBoardId: string }
  | { sourceId: string; keyword: string }
  | { sourceId: string };

interface PlanSource {
  id: string;
  fetchBy: 'board' | 'keyword' | 'feed';
  /** ids dos boards ativos da fonte, quando ela busca por empresa */
  careerBoardIds: readonly string[];
}

interface PlanProfile {
  sourceIds: readonly string[];
  keywords: readonly string[];
}

/** "React  Native " e "react native" são a mesma consulta no site. */
const normalizeKeyword = (keyword: string) =>
  keyword.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

/**
 * O que baixar nesta rodada, a partir dos perfis cuja busca venceu. Cada board ou palavra-chave
 * entra uma vez só, por mais perfis que peçam: dez usuários buscando "react" geram uma consulta.
 * Fontes por empresa baixam todos os boards ativos; as de busca, as palavras-chave dos perfis;
 * as de `feed`, a listagem inteira, uma vez.
 */
export function planIngestion(
  profiles: readonly PlanProfile[],
  sources: readonly PlanSource[],
): IngestTarget[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const targets = new Map<string, IngestTarget>();

  for (const profile of profiles) {
    for (const sourceId of profile.sourceIds) {
      const source = byId.get(sourceId);
      if (!source) continue;
      if (source.fetchBy === 'feed') {
        targets.set(`${sourceId}|feed`, { sourceId });
        continue;
      }
      if (source.fetchBy === 'board') {
        for (const careerBoardId of source.careerBoardIds) {
          targets.set(`${sourceId}|board|${careerBoardId}`, { sourceId, careerBoardId });
        }
        continue;
      }
      for (const raw of profile.keywords) {
        const keyword = normalizeKeyword(raw);
        if (keyword) targets.set(`${sourceId}|keyword|${keyword}`, { sourceId, keyword });
      }
    }
  }
  return [...targets.values()];
}
