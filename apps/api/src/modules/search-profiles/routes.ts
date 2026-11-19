import { SearchProfileInput } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../../plugins/errors';

const IdParam = z.object({ id: z.string() });

export const searchProfileRoutes: FastifyPluginAsync = async (app) => {
  const findOwned = async (id: string, userId: string) => {
    const profile = await prisma.searchProfile.findFirst({ where: { id, userId } });
    if (!profile) throw new HttpError(404, 'search_profile_not_found');
    return profile;
  };

  app.get('/', async (req) =>
    prisma.searchProfile.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    }),
  );

  app.get('/:id', async (req) => findOwned(IdParam.parse(req.params).id, req.userId));

  app.post('/', async (req, reply) => {
    const data = SearchProfileInput.parse(req.body);
    const created = await prisma.searchProfile.create({ data: { ...data, userId: req.userId } });
    return reply.code(201).send(created);
  });

  app.put('/:id', async (req) => {
    const { id } = IdParam.parse(req.params);
    await findOwned(id, req.userId);
    const data = SearchProfileInput.parse(req.body);
    // sem lastSearchedAt, o scheduler busca de novo e compara o perfil com as vagas do banco
    return prisma.searchProfile.update({ where: { id }, data: { ...data, lastSearchedAt: null } });
  });

  app.patch('/:id/active', async (req) => {
    const { id } = IdParam.parse(req.params);
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    await findOwned(id, req.userId);
    // reativado, o perfil perdeu as vagas da pausa: volta para a fila do backfill
    return prisma.searchProfile.update({
      where: { id },
      data: active ? { active, lastSearchedAt: null } : { active },
    });
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = IdParam.parse(req.params);
    await findOwned(id, req.userId);
    await prisma.searchProfile.delete({ where: { id } });
    return reply.code(204).send();
  });
};
