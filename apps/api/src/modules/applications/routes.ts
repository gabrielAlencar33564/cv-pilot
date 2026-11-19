import { ApplicationStatus } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../../plugins/errors';

export const applicationRoutes: FastifyPluginAsync = async (app) => {
  /** Painel de candidaturas (kanban). */
  app.get('/', async (req) => {
    const { status } = z.object({ status: ApplicationStatus.optional() }).parse(req.query);
    return prisma.application.findMany({
      where: { userId: req.userId, ...(status ? { status } : {}) },
      orderBy: { updatedAt: 'desc' },
      include: {
        job: { select: { title: true, company: true } },
        source: { select: { displayName: true } },
        resumeVersion: { select: { version: true, resume: { select: { name: true } } } },
      },
    });
  });

  /** Atualização manual de status/observações pelo candidato. */
  app.patch('/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = z
      .object({ status: ApplicationStatus.optional(), notes: z.string().max(5000).optional() })
      .parse(req.body);
    const { count } = await prisma.application.updateMany({
      where: { id, userId: req.userId },
      data,
    });
    if (!count) throw new HttpError(404, 'application_not_found');
    return prisma.application.findUnique({ where: { id } });
  });
};
