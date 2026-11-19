import { enqueue } from '@cv-pilot/queue';

/**
 * Janela do id do job de match. Dentro dela, a ingestão e o backfill que pedirem o mesmo par
 * vaga × perfil geram um job só; numa janela seguinte, uma vaga que mudou é avaliada de novo.
 * Igual à frequência mínima de um perfil de busca (60 min).
 */
const MATCH_WINDOW_MS = 60 * 60_000;

export function enqueueMatch(jobId: string, searchProfileId: string, now = Date.now()) {
  const window = Math.floor(now / MATCH_WINDOW_MS);
  return enqueue(
    'match',
    { jobId, searchProfileId },
    { jobId: `match_${jobId}_${searchProfileId}_${window}` },
  );
}
