import { createHash } from 'node:crypto';

/**
 * A senioridade fica na chave, em forma canônica: "Dev Jr" e "Dev Sr" são vagas diferentes,
 * mas "Dev Jr." e "Dev Júnior" são a mesma. Níveis numerados (I, II, III) ficam como estão.
 */
const SENIORITY_SYNONYMS: [RegExp, string][] = [
  [/\b(jr|junior)\b/g, 'junior'],
  [/\b(pl|pleno)\b/g, 'pleno'],
  [/\b(sr|senior)\b/g, 'senior'],
];

const normalize = (value: string | null | undefined) => {
  let text = (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  for (const [pattern, canonical] of SENIORITY_SYNONYMS) text = text.replace(pattern, canonical);
  return text;
};

/** Hash para identificar a mesma vaga publicada em fontes diferentes. */
export function jobDedupeHash(job: { company: string; title: string; location?: string | null }) {
  const key = [normalize(job.company), normalize(job.title), normalize(job.location)].join('|');
  return createHash('sha256').update(key).digest('hex');
}
