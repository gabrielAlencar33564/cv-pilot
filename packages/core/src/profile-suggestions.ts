import type { ParsedResume, ProfileSuggestion, Seniority } from '@cv-pilot/contracts';

/** Perfis sugeridos no máximo: o candidato completa os outros à mão. */
const MAX_SUGGESTIONS = 2;
/** Cada palavra-chave a mais dilui a nota das vagas (acertos / total), então poucas. */
const MAX_SKILL_KEYWORDS = 4;
const MAX_NAME_LENGTH = 80;

/** Anos de carreira a partir dos quais a senioridade sobe, quando o cargo não diz. */
const MID_FROM_YEARS = 3;
const SENIOR_FROM_YEARS = 6;
const MONTHS_PER_YEAR = 12;

/** O cargo que diz a senioridade vale mais que a conta de anos. A ordem importa. */
const SENIORITY_IN_ROLE: readonly [RegExp, Seniority][] = [
  [/\b(estagi[aá]ri[oa]|intern(ship)?)\b/i, 'intern'],
  [/\b(gerente|manager|head|coordenador[a]?)\b/i, 'manager'],
  [/\b(tech lead|lead|l[ií]der)\b/i, 'lead'],
  [/\b(s[eê]nior|sr)\b\.?/i, 'senior'],
  [/\b(pleno|mid)\b/i, 'mid'],
  [/\b(j[uú]nior|jr)\b\.?/i, 'junior'],
];

type Experience = ParsedResume['experiences'][number];

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

/** "2021-03" ou "2021" em meses desde o ano zero; null quando não há data legível. */
function toMonths(date: string | null): number | null {
  const match = date?.match(/^(\d{4})(?:-(\d{2}))?/);
  if (!match) return null;
  return Number(match[1]) * MONTHS_PER_YEAR + (match[2] ? Number(match[2]) - 1 : 0);
}

/** Fim do emprego atual (sem data de saída) e de uma data ilegível, para ordenar. */
const CURRENT_JOB = Number.MAX_SAFE_INTEGER;
const UNKNOWN_DATE = -1;

/** Emprego atual primeiro; depois, o que terminou mais tarde; no empate, o que começou depois. */
function byMostRecent(a: Experience, b: Experience): number {
  const endOf = (e: Experience) =>
    e.end === null ? CURRENT_JOB : (toMonths(e.end) ?? UNKNOWN_DATE);
  const startOf = (e: Experience) => toMonths(e.start) ?? UNKNOWN_DATE;
  return endOf(b) - endOf(a) || startOf(b) - startOf(a);
}

function careerYears(experiences: readonly Experience[], now: Date): number | null {
  const starts = experiences.map((e) => toMonths(e.start)).filter((m) => m !== null);
  if (!starts.length) return null;
  const nowMonths = now.getUTCFullYear() * MONTHS_PER_YEAR + now.getUTCMonth();
  return (nowMonths - Math.min(...starts)) / MONTHS_PER_YEAR;
}

function seniorityFromYears(years: number | null): Seniority[] {
  if (years === null) return [];
  if (years >= SENIOR_FROM_YEARS) return ['senior'];
  if (years >= MID_FROM_YEARS) return ['mid'];
  return ['junior'];
}

/** O cargo sem a senioridade ("Dev Front-end Pleno" → "Dev Front-end"), para casar mais vagas. */
function roleKeyword(role: string): string {
  const stripped = SENIORITY_IN_ROLE.reduce((text, [pattern]) => text.replace(pattern, ' '), role);
  const keyword = stripped
    .replace(/^[\s\-–|/]+|[\s\-–|/]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return keyword || role.trim();
}

/** Lista sem repetidos, ignorando maiúsculas e espaços. */
function unique(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  return terms.filter((term) => {
    const key = normalize(term);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Perfis de busca sugeridos a partir dos dados extraídos do currículo (onboarding).
 * Os cargos mais recentes viram nome e palavra-chave; as habilidades completam as palavras-chave;
 * a senioridade vem do cargo ou, se ele não disser, dos anos de carreira. Nada é inventado: tudo
 * sai do currículo, e o candidato revisa antes de salvar.
 */
export function suggestSearchProfiles(resume: ParsedResume, now: Date): ProfileSuggestion[] {
  const skills = unique(resume.skills).slice(0, MAX_SKILL_KEYWORDS);
  const yearsSeniority = seniorityFromYears(careerYears(resume.experiences, now));

  const recentRoles = unique(
    [...resume.experiences]
      .sort(byMostRecent)
      .map((e) => e.role.trim())
      .filter(Boolean),
  );
  const roles: string[] = [];
  for (const role of recentRoles) {
    if (roles.some((r) => normalize(roleKeyword(r)) === normalize(roleKeyword(role)))) continue;
    roles.push(role);
    if (roles.length === MAX_SUGGESTIONS) break;
  }

  if (!roles.length) {
    // sem experiência registrada (ex.: quem está começando): um perfil pelas habilidades
    if (!skills.length) return [];
    return [
      {
        name: `Vagas de ${skills.slice(0, 2).join(' e ')}`.slice(0, MAX_NAME_LENGTH),
        keywords: skills,
        seniorities: yearsSeniority,
      },
    ];
  }

  return roles.map((role) => {
    const fromRole = SENIORITY_IN_ROLE.find(([pattern]) => pattern.test(role))?.[1];
    return {
      name: role.slice(0, MAX_NAME_LENGTH),
      keywords: unique([roleKeyword(role), ...skills]),
      seniorities: fromRole ? [fromRole] : yearsSeniority,
    };
  });
}
