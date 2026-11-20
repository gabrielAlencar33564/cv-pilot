import type { ContractType, Seniority, WorkModel } from '@cv-pilot/contracts';

/*
 * Os cards das listagens dizem contrato, nível e modelo em texto ("PJ • Pleno • Híbrido").
 * Cada termo vira o valor do enum; termo desconhecido é ignorado, e dois valores diferentes
 * na mesma dimensão ("CLT, PJ") deixam a dimensão em branco: na dúvida, null.
 */

const plain = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const CONTRACTS: Record<string, ContractType> = {
  clt: 'clt',
  pj: 'pj',
  estagio: 'internship',
  temporario: 'temporary',
  freelance: 'freelance',
  freelancer: 'freelance',
};

const SENIORITIES: Record<string, Seniority> = {
  estagio: 'intern',
  junior: 'junior',
  jr: 'junior',
  pleno: 'mid',
  senior: 'senior',
  sr: 'senior',
  principal: 'lead',
};

const WORK_MODELS: Record<string, WorkModel> = {
  remoto: 'remote',
  'home office': 'remote',
  '100% remoto': 'remote',
  hibrido: 'hybrid',
  presencial: 'onsite',
};

/** O único valor encontrado, ou null se não houver nenhum ou houver mais de um. */
function single<T>(found: Set<T>): T | null {
  return found.size === 1 ? ([...found][0] ?? null) : null;
}

export function classifyListingTerms(terms: readonly string[]): {
  contractType: ContractType | null;
  seniority: Seniority | null;
  workModel: WorkModel | null;
} {
  // "CLT, PJ" são dois termos dentro de um
  const words = terms
    .flatMap((t) => t.split(','))
    .map(plain)
    .filter(Boolean);
  const pick = <T>(map: Record<string, T>) =>
    single(
      new Set(
        words.flatMap((w) => {
          const value = map[w];
          return value === undefined ? [] : [value];
        }),
      ),
    );
  return {
    contractType: pick(CONTRACTS),
    seniority: pick(SENIORITIES),
    workModel: pick(WORK_MODELS),
  };
}
