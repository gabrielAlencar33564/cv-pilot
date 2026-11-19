import { ResumeParseError, getAiProvider, type ResumeDocument } from '@cv-pilot/ai';
import type { ResumeParseFailure } from '@cv-pilot/contracts';
import { RESUME_FILE_TYPES } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';
import { enqueue, type QueuePayloads } from '@cv-pilot/queue';
import { loadResumeFile } from '@cv-pilot/storage';
import { UnrecoverableError, type Job } from 'bullmq';
import mammoth from 'mammoth';
import { logger } from '../logger';

/**
 * Extrai os dados estruturados de uma versão de currículo, uma única vez por versão.
 * Falha definitiva (recusa, saída inválida, arquivo ilegível) marca a versão como `failed`
 * e não repete; erro temporário repete e só marca `failed` na última tentativa.
 */
export async function resumeParseProcessor(job: Job<QueuePayloads['resume-parse']>) {
  const { resumeVersionId } = job.data;
  const version = await prisma.resumeVersion.findUnique({
    where: { id: resumeVersionId },
    select: { storageKey: true, mimeType: true, parseStatus: true },
  });
  if (!version) return { skipped: 'not_found' };
  if (version.parseStatus === 'parsed') return { skipped: 'already_parsed' };

  try {
    const content = await loadResumeFile(version.storageKey);
    const { resume, usage } = await getAiProvider().parseResume(
      await toResumeDocument(version.mimeType, content),
    );
    await prisma.resumeVersion.update({
      where: { id: resumeVersionId },
      data: { parsed: resume, parseStatus: 'parsed', parseError: null, parsedAt: new Date() },
    });
    logger.info({ resumeVersionId, ...usage }, 'currículo extraído');
    return { skills: resume.skills.length };
  } catch (err) {
    if (err instanceof ResumeParseError) {
      await markFailed(resumeVersionId, err.code);
      throw new UnrecoverableError(err.message);
    }
    if (isLastAttempt(job)) await markFailed(resumeVersionId, 'retries_exhausted');
    throw err;
  }
}

async function toResumeDocument(mimeType: string, content: Buffer): Promise<ResumeDocument> {
  if (mimeType === RESUME_FILE_TYPES.pdf.mimeType) return { kind: 'pdf', data: content };
  if (mimeType === RESUME_FILE_TYPES.docx.mimeType) {
    return { kind: 'text', text: await docxToText(content) };
  }
  throw new ResumeParseError('unreadable_file');
}

async function docxToText(content: Buffer): Promise<string> {
  let text: string;
  try {
    ({ value: text } = await mammoth.extractRawText({ buffer: content }));
  } catch (err) {
    throw new ResumeParseError('unreadable_file', { cause: err });
  }
  if (!text.trim()) throw new ResumeParseError('unreadable_file');
  return text;
}

/** Marca a versão como falha e avisa o candidato pelos alertas do app. */
async function markFailed(resumeVersionId: string, code: ResumeParseFailure) {
  await prisma.resumeVersion.update({
    where: { id: resumeVersionId },
    data: { parseStatus: 'failed', parseError: code },
  });
  await enqueue(
    'notify',
    { kind: 'resume_parse_failed', resumeVersionId },
    { jobId: `notify_resume_parse_failed_${resumeVersionId}` },
  );
}

/** Durante o processamento, attemptsMade conta só as tentativas que já falharam. */
function isLastAttempt(job: Pick<Job, 'attemptsMade' | 'opts'>) {
  return job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
}
