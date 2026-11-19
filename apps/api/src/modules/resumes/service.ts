import { RESUME_FILE_TYPES, detectResumeFileType } from '@cv-pilot/core';
import { Prisma, prisma } from '@cv-pilot/db';
import { enqueue } from '@cv-pilot/queue';
import {
  deleteResumeFile,
  loadResumeFile,
  resumeStorageKey,
  storeResumeFile,
} from '@cv-pilot/storage';
import type { FastifyBaseLogger } from 'fastify';
import { HttpError } from '../../plugins/errors';

const MAX_FILE_NAME = 255;
const FALLBACK_FILE_NAME = 'curriculo';

export interface UploadedFile {
  fileName: string;
  content: Buffer;
}

/** Campos da versão que a API devolve. O `storageKey` nunca sai do servidor. */
export const versionSummary = {
  id: true,
  version: true,
  fileName: true,
  mimeType: true,
  parseStatus: true,
  parseError: true,
  createdAt: true,
} satisfies Prisma.ResumeVersionSelect;

export async function assertResumeOwned(userId: string, resumeId: string) {
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId },
    select: { id: true },
  });
  if (!resume) throw new HttpError(404, 'resume_not_found');
}

/**
 * Nova versão do currículo: valida pelo conteúdo, grava cifrado no S3, cria a `ResumeVersion`
 * e enfileira a extração. Quem chama já conferiu o dono (`assertResumeOwned`).
 */
export async function uploadResumeVersion(
  userId: string,
  resumeId: string,
  file: UploadedFile,
  log: FastifyBaseLogger,
) {
  const type = detectResumeFileType(file.content);
  if (!type) throw new HttpError(415, 'unsupported_file_type');
  const { mimeType, extension } = RESUME_FILE_TYPES[type];

  const latest = await prisma.resumeVersion.aggregate({
    where: { resumeId },
    _max: { version: true },
  });
  const version = (latest._max.version ?? 0) + 1;
  const storageKey = resumeStorageKey({ userId, resumeId, version, extension });

  await storeResumeFile(storageKey, file.content);
  let created;
  try {
    created = await prisma.resumeVersion.create({
      data: { resumeId, version, storageKey, fileName: cleanFileName(file.fileName), mimeType },
      select: versionSummary,
    });
  } catch (err) {
    await deleteResumeFile(storageKey).catch((cleanupErr: unknown) =>
      log.warn(
        { err: cleanupErr, storageKey },
        'arquivo órfão no storage: a versão não foi gravada',
      ),
    );
    // dois uploads simultâneos calcularam o mesmo número de versão
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new HttpError(409, 'resume_version_conflict');
    }
    throw err;
  }

  await enqueue(
    'resume-parse',
    { resumeVersionId: created.id },
    { jobId: `resume-parse_${created.id}` },
  );
  return created;
}

/** Só o nome, sem o caminho que alguns navegadores mandam junto. */
function cleanFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '').trim().slice(0, MAX_FILE_NAME);
  return base || FALLBACK_FILE_NAME;
}

/** Arquivo de uma versão, decifrado, só para o dono do currículo (exportação e pré-visualização). */
export async function loadOwnedResumeFile(userId: string, resumeId: string, versionId: string) {
  const version = await prisma.resumeVersion.findFirst({
    where: { id: versionId, resumeId, resume: { userId } },
    select: { storageKey: true, fileName: true, mimeType: true },
  });
  if (!version) throw new HttpError(404, 'resume_version_not_found');
  return { ...version, content: await loadResumeFile(version.storageKey) };
}

/**
 * `Content-Disposition` com o nome original: uma versão só ASCII para navegadores antigos e a
 * versão UTF-8 (RFC 5987) para nomes com acento.
 */
export function inlineDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
