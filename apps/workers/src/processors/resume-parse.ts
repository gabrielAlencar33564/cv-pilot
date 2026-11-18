import { getAiProvider } from '@cv-pilot/ai';
import { prisma, type Prisma } from '@cv-pilot/db';
import type { QueuePayloads } from '@cv-pilot/queue';
import type { Job } from 'bullmq';

/**
 * Extrai os dados estruturados de uma versão de currículo.
 * TODO: baixar o arquivo do S3 (storageKey) e converter PDF/DOCX em texto.
 */
export async function resumeParseProcessor(job: Job<QueuePayloads['resume-parse']>) {
  const version = await prisma.resumeVersion.findUnique({ where: { id: job.data.resumeVersionId } });
  if (!version) return { skipped: true };

  const text = ''; // TODO: texto extraído do arquivo
  const parsed = await getAiProvider().parseResume(text);
  await prisma.resumeVersion.update({
    where: { id: version.id },
    data: { parsed: parsed as unknown as Prisma.InputJsonValue },
  });
  return { skills: parsed.skills.length };
}
