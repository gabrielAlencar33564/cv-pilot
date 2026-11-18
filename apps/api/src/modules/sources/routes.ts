import { prisma } from '@cv-pilot/db';
import type { FastifyPluginAsync } from 'fastify';

export const sourceRoutes: FastifyPluginAsync = async (app) => {
  /** Sites de vagas disponíveis para busca e para regras de envio. */
  app.get('/', async () =>
    prisma.source.findMany({
      where: { active: true },
      select: { id: true, displayName: true, kind: true, applyModes: true },
      orderBy: { displayName: 'asc' },
    }),
  );
};
