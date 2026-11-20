import { JobRequirementsError, getAiProvider } from '@cv-pilot/ai';
import type { JobRequirements } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import type { QueuePayloads } from '@cv-pilot/queue';
import { UnrecoverableError, type Job } from 'bullmq';
import { logger } from '../logger';

/**
 * Extrai os requisitos de uma vaga (RF-41), uma vez por texto: vale para todos os usuários. Só
 * o título e a descrição da vaga vão para a IA. A comparação com cada currículo é feita depois,
 * sem IA, pelo `requirementsCheck` do core.
 */
export async function jobRequirementsProcessor(job: Job<QueuePayloads['job-requirements']>) {
  const { jobId } = job.data;
  const vaga = await prisma.job.findUnique({
    where: { id: jobId },
    select: { title: true, description: true, active: true, requirements: true },
  });
  if (!vaga?.active) return { skipped: 'inactive' };
  if (vaga.requirements !== null) return { skipped: 'already_extracted' };

  let extraction;
  try {
    extraction = await getAiProvider().extractJobRequirements(vaga);
  } catch (err) {
    // recusa ou saída inválida: repetir não resolve, e a vaga fica sem o "o que falta"
    if (err instanceof JobRequirementsError) throw new UnrecoverableError(err.message);
    throw err;
  }
  if (!extraction) return { skipped: 'provider_without_requirements' };

  const requirements: JobRequirements = { requirements: extraction.requirements };
  // só grava se o texto não mudou durante a extração; um texto novo já pediu outra
  const { count } = await prisma.job.updateMany({
    where: { id: jobId, title: vaga.title, description: vaga.description },
    data: { requirements },
  });
  logger.info(
    {
      jobId,
      requirements: extraction.requirements.length,
      saved: count === 1,
      ...extraction.usage,
    },
    'requisitos da vaga extraídos',
  );
  return { requirements: extraction.requirements.length, saved: count === 1 };
}
