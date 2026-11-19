import { prisma } from '@cv-pilot/db';
import multipart from '@fastify/multipart';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../../plugins/errors';
import {
  assertResumeOwned,
  uploadResumeVersion,
  versionSummary,
  type UploadedFile,
} from './service';

/** Limite do arquivo de currículo (skill lgpd-seguranca). */
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

const IdParam = z.object({ id: z.string() });

const ResumeInput = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).nullish(),
  tags: z.array(z.string().max(30)).max(10).default([]),
});

async function readUploadedFile(req: FastifyRequest): Promise<UploadedFile> {
  if (!req.isMultipart()) throw new HttpError(400, 'file_required');
  const file = await req.file();
  if (!file) throw new HttpError(400, 'file_required');
  try {
    return { fileName: file.filename, content: await file.toBuffer() };
  } catch (err) {
    if (err instanceof req.server.multipartErrors.RequestFileTooLargeError) {
      throw new HttpError(413, 'file_too_large');
    }
    throw err;
  }
}

export const resumeRoutes: FastifyPluginAsync = async (app) => {
  // só as rotas de currículo aceitam multipart: um arquivo por requisição, até 5 MB
  await app.register(multipart, { limits: { fileSize: MAX_RESUME_BYTES, files: 1 } });

  app.get('/', async (req) =>
    prisma.resume.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: { versions: { select: versionSummary, orderBy: { version: 'desc' } } },
    }),
  );

  app.post('/', async (req, reply) => {
    const data = ResumeInput.parse(req.body);
    return reply
      .code(201)
      .send(await prisma.resume.create({ data: { ...data, userId: req.userId } }));
  });

  /** Upload de PDF ou DOCX (multipart, campo `file`): gera uma nova versão do currículo. */
  app.post('/:id/versions', async (req, reply) => {
    const { id } = IdParam.parse(req.params);
    await assertResumeOwned(req.userId, id);
    const file = await readUploadedFile(req);
    return reply.code(201).send(await uploadResumeVersion(req.userId, id, file, req.log));
  });
};
