import type { NormalizedJob, SearchProfileInput } from '@cv-pilot/contracts';

export interface ScoreResult {
  score: number;
  reasons: string[];
  blocked: boolean;
}

/** Peso das palavras-chave encontradas na vaga; o restante vem do cargo no título. */
const KEYWORDS_WEIGHT = 70;
const TITLE_WEIGHT = 30;
const MAX_SCORE = 100;

/**
 * Quebra o texto em termos minúsculos e sem acentos. Mantém `+`, `#` e `.` dentro do termo
 * (c++, c#, node.js, .net) e tira o ponto final de frase ("React." → "react").
 */
function tokenize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((token) => token.replace(/\.+$/, ''))
    .filter(Boolean);
}

/** O termo (uma ou mais palavras) aparece inteiro e na ordem: "java" não casa com "javascript". */
function containsTerm(tokens: readonly string[], term: string): boolean {
  const wanted = tokenize(term);
  if (!wanted.length) return false;
  for (let start = 0; start + wanted.length <= tokens.length; start++) {
    if (wanted.every((word, i) => tokens[start + i] === word)) return true;
  }
  return false;
}

type JobFields = Pick<
  NormalizedJob,
  | 'title'
  | 'company'
  | 'description'
  | 'workModel'
  | 'location'
  | 'seniority'
  | 'contractType'
  | 'salaryMin'
  | 'salaryMax'
>;

type ProfileFields = Pick<
  SearchProfileInput,
  | 'keywords'
  | 'excludeKeywords'
  | 'workModels'
  | 'companyBlacklist'
  | 'seniorities'
  | 'contractTypes'
  | 'salaryMin'
  | 'salaryMax'
  | 'location'
>;

/** Motivo do bloqueio pela primeira regra rígida que a vaga não cumpre, ou null. */
function hardRuleViolation(job: JobFields, profile: ProfileFields, text: string[]): string | null {
  const company = tokenize(job.company);
  if (profile.companyBlacklist?.some((c) => containsTerm(company, c))) {
    return 'Empresa na lista de exclusão';
  }
  const excluded = profile.excludeKeywords?.find((k) => containsTerm(text, k));
  if (excluded) return `Contém termo excluído: ${excluded}`;

  // campo desconhecido na vaga não bloqueia: só o que a vaga declara contradiz o perfil
  if (profile.workModels?.length && job.workModel && !profile.workModels.includes(job.workModel)) {
    return 'Modelo de trabalho diferente';
  }
  if (
    profile.seniorities?.length &&
    job.seniority &&
    !profile.seniorities.includes(job.seniority)
  ) {
    return 'Senioridade diferente';
  }
  if (
    profile.contractTypes?.length &&
    job.contractType &&
    !profile.contractTypes.includes(job.contractType)
  ) {
    return 'Tipo de contrato diferente';
  }
  if (profile.salaryMin != null && job.salaryMax != null && job.salaryMax < profile.salaryMin) {
    return 'Salário abaixo do mínimo do perfil';
  }
  if (profile.salaryMax != null && job.salaryMin != null && job.salaryMin > profile.salaryMax) {
    return 'Salário acima da faixa do perfil';
  }
  if (
    profile.location &&
    job.workModel !== 'remote' &&
    job.location &&
    !containsTerm(tokenize(job.location), profile.location)
  ) {
    return 'Fora da localização do perfil';
  }
  return null;
}

/**
 * Nota por regras rígidas (0-100). A similaridade semântica (embeddings)
 * será combinada a esta nota no processor de match.
 */
export function ruleBasedScore(job: JobFields, profile: ProfileFields): ScoreResult {
  const text = tokenize(`${job.title}\n${job.description}`);
  const violation = hardRuleViolation(job, profile, text);
  if (violation) return { score: 0, reasons: [violation], blocked: true };

  const reasons: string[] = [];
  const hits = profile.keywords.filter((k) => containsTerm(text, k));
  const title = tokenize(job.title);
  const titleHit = profile.keywords.some((k) => containsTerm(title, k));
  if (hits.length) reasons.push(`Palavras-chave: ${hits.join(', ')}`);
  if (titleHit) reasons.push('Cargo compatível com o título');

  const score = Math.min(
    MAX_SCORE,
    Math.round(
      (hits.length / profile.keywords.length) * KEYWORDS_WEIGHT + (titleHit ? TITLE_WEIGHT : 0),
    ),
  );
  return { score, reasons, blocked: false };
}
