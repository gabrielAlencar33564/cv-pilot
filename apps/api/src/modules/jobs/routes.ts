import { JobListQuery, type Paginated } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import type { FastifyPluginAsync } from 'fastify';

export const jobRoutes: FastifyPluginAsync = async (app) => {
  /** Vagas compatíveis com os perfis de busca do usuário, ordenadas pela nota. */
  app.get('/', async (req) => {
    const q = JobListQuery.parse(req.query);
    const where = {
      dismissed: false,
      searchProfile: {
        userId: req.userId,
        ...(q.searchProfileId ? { id: q.searchProfileId } : {}),
      },
      ...(q.minScore !== undefined ? { score: { gte: q.minScore } } : {}),
      job: { active: true },
    };

    const [total, matches] = await Promise.all([
      prisma.jobMatch.count({ where }),
      prisma.jobMatch.findMany({
        where,
        orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          job: { include: { sources: { select: { sourceId: true, url: true } } } },
          searchProfile: { select: { id: true, name: true } },
        },
      }),
    ]);

    const result: Paginated<(typeof matches)[number]> = {
      items: matches,
      page: q.page,
      pageSize: q.pageSize,
      total,
    };
    return result;
  });
};
