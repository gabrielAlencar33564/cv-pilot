import { prisma } from './client';

/*
 * O Prisma Client não lê nem grava `vector(1024)`: as colunas `embedding` de Job e
 * ResumeVersion passam por SQL parametrizado aqui. A similaridade usa o cosseno do pgvector
 * (`<=>`), que não depende de os vetores virem normalizados.
 */

const toVector = (values: readonly number[]) => `[${values.join(',')}]`;

export async function saveJobEmbedding(jobId: string, vector: readonly number[]) {
  await prisma.$executeRaw`UPDATE "Job" SET embedding = ${toVector(vector)}::vector WHERE id = ${jobId}`;
}

/** O texto da vaga mudou: o vetor antigo não vale mais e é gerado de novo no próximo match. */
export async function clearJobEmbedding(jobId: string) {
  await prisma.$executeRaw`UPDATE "Job" SET embedding = NULL WHERE id = ${jobId}`;
}

export async function saveResumeVersionEmbedding(
  resumeVersionId: string,
  vector: readonly number[],
) {
  await prisma.$executeRaw`UPDATE "ResumeVersion" SET embedding = ${toVector(vector)}::vector WHERE id = ${resumeVersionId}`;
}

/** Quais dos dois lados já têm embedding. */
export async function embeddingPresence(jobId: string, resumeVersionId: string) {
  const [row] = await prisma.$queryRaw<{ job: boolean; resume: boolean }[]>`
    SELECT
      EXISTS (SELECT 1 FROM "Job" WHERE id = ${jobId} AND embedding IS NOT NULL) AS job,
      EXISTS (SELECT 1 FROM "ResumeVersion" WHERE id = ${resumeVersionId} AND embedding IS NOT NULL) AS resume`;
  return { job: row?.job ?? false, resume: row?.resume ?? false };
}

/** Similaridade de cosseno (-1 a 1) entre a vaga e o currículo, ou null se falta um vetor. */
export async function jobResumeSimilarity(
  jobId: string,
  resumeVersionId: string,
): Promise<number | null> {
  const [row] = await prisma.$queryRaw<{ similarity: number }[]>`
    SELECT 1 - (j.embedding <=> r.embedding) AS similarity
    FROM "Job" j, "ResumeVersion" r
    WHERE j.id = ${jobId} AND r.id = ${resumeVersionId}
      AND j.embedding IS NOT NULL AND r.embedding IS NOT NULL`;
  return row ? Number(row.similarity) : null;
}
