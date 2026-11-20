import { getAiProvider } from '@cv-pilot/ai';
import { ParsedResume } from '@cv-pilot/contracts';
import { jobEmbeddingText, resumeEmbeddingText, sharedSkills } from '@cv-pilot/core';
import {
  comparisonResumeVersion,
  embeddingPresence,
  jobResumeSimilarity,
  saveJobEmbedding,
  saveResumeVersionEmbedding,
} from '@cv-pilot/db';
import { logger } from './logger';

interface JobText {
  id: string;
  title: string;
  description: string;
}

const NO_COMPARISON = { similarity: null, sharedSkills: [] };

/**
 * Gera e grava o embedding que faltar, da vaga ou do currículo, numa chamada só. Cada vaga e
 * cada versão de currículo é embutida uma vez; a ingestão apaga o vetor da vaga quando o texto
 * dela muda. Devolve false quando o provedor não gera embeddings (o `noop`).
 */
async function ensureEmbeddings(job: JobText, resumeVersionId: string, resume: ParsedResume) {
  const present = await embeddingPresence(job.id, resumeVersionId);
  const missing = [
    ...(present.job
      ? []
      : [{ text: jobEmbeddingText(job), save: (v: number[]) => saveJobEmbedding(job.id, v) }]),
    ...(present.resume
      ? []
      : [
          {
            text: resumeEmbeddingText(resume),
            save: (v: number[]) => saveResumeVersionEmbedding(resumeVersionId, v),
          },
        ]),
  ];
  if (!missing.length) return true;

  const result = await getAiProvider().embed(
    missing.map((m) => m.text),
    'document',
  );
  if (!result) return false;
  for (const [i, item] of missing.entries()) {
    const vector = result.vectors[i];
    if (vector) await item.save(vector);
  }
  logger.info(
    { jobId: job.id, resumeVersionId, embedded: missing.length, tokens: result.usage.totalTokens },
    'embeddings gerados',
  );
  return true;
}

/**
 * Compara a vaga com o currículo do usuário (RF-40): semelhança entre os embeddings e
 * habilidades do currículo que aparecem na vaga. Sem currículo lido, não há comparação.
 */
export async function compareWithResume(
  job: JobText,
  userId: string,
  resumeId: string | null,
): Promise<{ similarity: number | null; sharedSkills: string[] }> {
  const version = await comparisonResumeVersion(userId, resumeId);
  const parsed = ParsedResume.safeParse(version?.parsed);
  if (!version || !parsed.success) return NO_COMPARISON;

  const skills = sharedSkills(job, parsed.data.skills);
  try {
    const ready = await ensureEmbeddings(job, version.id, parsed.data);
    return {
      similarity: ready ? await jobResumeSimilarity(job.id, version.id) : null,
      sharedSkills: skills,
    };
  } catch (err) {
    // sem a semelhança, o match ainda sai com a nota das regras; o vetor que faltou é gerado
    // no próximo match desta vaga ou deste currículo
    logger.warn(
      { err, jobId: job.id, resumeVersionId: version.id },
      'semelhança com o currículo indisponível',
    );
    return { similarity: null, sharedSkills: skills };
  }
}
