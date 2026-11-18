import { prisma } from '@cv-pilot/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const ResumeInput = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).nullish(),
  tags: z.array(z.string().max(30)).max(10).default([]),
});

export const resumeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) =>
    prisma.resume.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: { versions: { select: { id: true, version: true, fileName: true, createdAt: true }, orderBy: { version: 'desc' } } },
    }),
  );

  /** Cria o currículo (metadados). TODO: upload do arquivo (multipart → S3) gera ResumeVersion. */
  app.post('/', async (req, reply) => {
    const data = ResumeInput.parse(req.body);
    return reply.code(201).send(await prisma.resume.create({ data: { ...data, userId: req.userId } }));
  });
};
