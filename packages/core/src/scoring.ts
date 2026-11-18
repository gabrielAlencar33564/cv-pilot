import type { NormalizedJob, SearchProfileInput } from '@cv-pilot/contracts';

export interface ScoreResult {
  score: number;
  reasons: string[];
  blocked: boolean;
}

const has = (text: string, term: string) => text.toLowerCase().includes(term.toLowerCase());

/**
 * Nota por regras rígidas (0-100). A similaridade semântica (embeddings)
 * será combinada a esta nota no processor de match.
 */
export function ruleBasedScore(
  job: Pick<NormalizedJob, 'title' | 'company' | 'description' | 'workModel'>,
  profile: Pick<
    SearchProfileInput,
    'keywords' | 'excludeKeywords' | 'workModels' | 'companyBlacklist'
  >,
): ScoreResult {
  const text = `${job.title}\n${job.description}`;
  const reasons: string[] = [];

  if (profile.companyBlacklist?.some((c) => has(job.company, c))) {
    return { score: 0, reasons: ['Empresa na lista de exclusão'], blocked: true };
  }
  const excluded = profile.excludeKeywords?.find((k) => has(text, k));
  if (excluded) {
    return { score: 0, reasons: [`Contém termo excluído: ${excluded}`], blocked: true };
  }
  if (profile.workModels?.length && job.workModel && !profile.workModels.includes(job.workModel)) {
    return { score: 0, reasons: ['Modelo de trabalho diferente'], blocked: true };
  }

  const hits = profile.keywords.filter((k) => has(text, k));
  const titleHit = profile.keywords.some((k) => has(job.title, k));
  if (hits.length) reasons.push(`Palavras-chave: ${hits.join(', ')}`);
  if (titleHit) reasons.push('Cargo compatível com o título');

  const score = Math.min(
    100,
    Math.round((hits.length / profile.keywords.length) * 70 + (titleHit ? 30 : 0)),
  );
  return { score, reasons, blocked: false };
}
