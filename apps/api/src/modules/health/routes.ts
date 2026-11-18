import { prisma } from '@cv-pilot/db';
import { getRedis } from '@cv-pilot/queue';
import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/health/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await getRedis().ping();
      return { status: 'ready' };
    } catch (err) {
      return reply.code(503).send({ status: 'unavailable', error: (err as Error).message });
    }
  });
};
