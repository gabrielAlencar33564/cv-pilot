import { createHash } from 'node:crypto';

const normalize = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(jr|junior|pl|pleno|sr|senior|i{1,3})\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Hash para identificar a mesma vaga publicada em fontes diferentes. */
export function jobDedupeHash(job: { company: string; title: string; location?: string | null }) {
  const key = [normalize(job.company), normalize(job.title), normalize(job.location)].join('|');
  return createHash('sha256').update(key).digest('hex');
}
