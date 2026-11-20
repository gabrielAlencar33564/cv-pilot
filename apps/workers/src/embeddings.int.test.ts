import { randomUUID } from 'node:crypto';
import {
  clearJobEmbedding,
  embeddingPresence,
  jobResumeSimilarity,
  prisma,
  saveJobEmbedding,
  saveResumeVersionEmbedding,
} from '@cv-pilot/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DIMENSOES = 1024;
/** Vetor com 1 na posição dada e 0 no resto. */
const base = (posicao: number) =>
  Array.from({ length: DIMENSOES }, (_, i) => (i === posicao ? 1 : 0));

describe('embeddings no pgvector', () => {
  const userId = `teste-${randomUUID()}`;
  const jobId = randomUUID();
  let versaoId: string;

  beforeAll(async () => {
    await prisma.user.create({ data: { id: userId, email: `${userId}@teste.local` } });
    const resume = await prisma.resume.create({ data: { userId, name: 'CV de teste' } });
    versaoId = (
      await prisma.resumeVersion.create({
        data: {
          resumeId: resume.id,
          version: 1,
          storageKey: `${userId}/cv.pdf`,
          fileName: 'cv.pdf',
          mimeType: 'application/pdf',
        },
      })
    ).id;
    await prisma.job.create({
      data: { id: jobId, dedupeHash: jobId, title: 'Vaga', company: 'Empresa', description: '' },
    });
  });

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { id: jobId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('sem vetores, nada está presente e não há semelhança', async () => {
    await expect(embeddingPresence(jobId, versaoId)).resolves.toEqual({
      job: false,
      resume: false,
    });
    await expect(jobResumeSimilarity(jobId, versaoId)).resolves.toBeNull();
  });

  it('grava os dois vetores e mede o cosseno: iguais dão 1, perpendiculares dão 0', async () => {
    await saveJobEmbedding(jobId, base(0));
    await saveResumeVersionEmbedding(versaoId, base(0));

    await expect(embeddingPresence(jobId, versaoId)).resolves.toEqual({ job: true, resume: true });
    expect(await jobResumeSimilarity(jobId, versaoId)).toBeCloseTo(1);

    await saveResumeVersionEmbedding(versaoId, base(1));
    expect(await jobResumeSimilarity(jobId, versaoId)).toBeCloseTo(0);
  });

  it('o cosseno não depende do tamanho do vetor', async () => {
    await saveJobEmbedding(
      jobId,
      base(0).map((v) => v * 5),
    );
    await saveResumeVersionEmbedding(versaoId, base(0));

    expect(await jobResumeSimilarity(jobId, versaoId)).toBeCloseTo(1);
  });

  it('apagar o vetor da vaga tira a semelhança até ele ser gerado de novo', async () => {
    await clearJobEmbedding(jobId);

    await expect(embeddingPresence(jobId, versaoId)).resolves.toEqual({ job: false, resume: true });
    await expect(jobResumeSimilarity(jobId, versaoId)).resolves.toBeNull();
  });
});
