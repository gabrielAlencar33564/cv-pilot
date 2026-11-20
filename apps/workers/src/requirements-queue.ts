import { enqueue } from '@cv-pilot/queue';
import { createHash } from 'node:crypto';

/**
 * Pede a extração dos requisitos da vaga. O id do job leva um hash do texto: o mesmo texto
 * gera um job só (inclusive um que falhou de vez), e um texto novo gera outro.
 */
export function enqueueJobRequirements(job: { id: string; title: string; description: string }) {
  const contentHash = createHash('sha256')
    .update(`${job.title}\n${job.description}`)
    .digest('hex')
    .slice(0, 16);
  return enqueue(
    'job-requirements',
    { jobId: job.id },
    { jobId: `requirements_${job.id}_${contentHash}` },
  );
}
