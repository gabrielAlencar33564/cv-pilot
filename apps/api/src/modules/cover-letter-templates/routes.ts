import { CoverLetterTemplateInput } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../../plugins/errors';

const IdParam = z.object({ id: z.string() });

/** Modelos de carta do candidato (RF-22), com as variáveis {{empresa}}, {{cargo}} e {{nome}}. */
export const coverLetterTemplateRoutes: FastifyPluginAsync = async (app) => {
  const assertOwned = async (id: string, userId: string) => {
    const template = await prisma.coverLetterTemplate.findFirst({ where: { id, userId } });
    if (!template) throw new HttpError(404, 'cover_letter_template_not_found');
  };

  app.get('/', async (req) =>
    prisma.coverLetterTemplate.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
    }),
  );

  app.post('/', async (req, reply) => {
    const data = CoverLetterTemplateInput.parse(req.body);
    const created = await prisma.coverLetterTemplate.create({
      data: { ...data, userId: req.userId },
    });
    return reply.code(201).send(created);
  });

  app.put('/:id', async (req) => {
    const { id } = IdParam.parse(req.params);
    await assertOwned(id, req.userId);
    const data = CoverLetterTemplateInput.parse(req.body);
    return prisma.coverLetterTemplate.update({ where: { id }, data });
  });

  // as regras que usavam o modelo ficam sem carta (onDelete: SetNull)
  app.delete('/:id', async (req, reply) => {
    const { id } = IdParam.parse(req.params);
    await assertOwned(id, req.userId);
    await prisma.coverLetterTemplate.delete({ where: { id } });
    return reply.code(204).send();
  });
};
