import {
  AdminListQuery,
  CareerBoardListQuery,
  CreateCareerBoardInput,
  UpdateCareerBoardInput,
  UpdateSourceInput,
  type Paginated,
  type SourceRunRow,
  type SourceRunStatus,
} from '@cv-pilot/contracts';
import { Prisma, prisma } from '@cv-pilot/db';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../../plugins/errors';
import { listAdminSources, listCareerBoards } from './service';

const IdParam = z.object({ id: z.string() });

/** Fontes, execuções e catálogo de empresas (RF-35, RF-80, RF-81). Só para ADMIN. */
export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/sources', async () => listAdminSources());

  /** Ligar e desligar uma fonte quebrada sem deploy, e ajustar o limite de requisições. */
  app.patch('/sources/:id', async (req) => {
    const { id } = IdParam.parse(req.params);
    const data = UpdateSourceInput.parse(req.body);
    const { count } = await prisma.source.updateMany({ where: { id }, data });
    if (!count) throw new HttpError(404, 'source_not_found');
    return { id, ...data };
  });

  app.get('/sources/:id/runs', async (req): Promise<Paginated<SourceRunRow>> => {
    const { id } = IdParam.parse(req.params);
    const { page, pageSize } = AdminListQuery.parse(req.query);
    const [runs, total] = await Promise.all([
      prisma.sourceRun.findMany({
        where: { sourceId: id },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          target: true,
          status: true,
          found: true,
          changed: true,
          matches: true,
          closed: true,
          error: true,
          startedAt: true,
          durationMs: true,
        },
      }),
      prisma.sourceRun.count({ where: { sourceId: id } }),
    ]);
    return {
      // o banco guarda o status como texto; só a ingestão grava, com os valores de SourceRunStatus
      items: runs.map((r) => ({
        ...r,
        status: r.status as SourceRunStatus,
        startedAt: r.startedAt.toISOString(),
      })),
      page,
      pageSize,
      total,
    };
  });

  app.get('/career-boards', async (req) => {
    const { sourceId, page, pageSize } = CareerBoardListQuery.parse(req.query);
    return listCareerBoards(sourceId, page, pageSize);
  });

  app.post('/career-boards', async (req, reply) => {
    const data = CreateCareerBoardInput.parse(req.body);
    const source = await prisma.source.findUnique({ where: { id: data.sourceId } });
    if (!source) throw new HttpError(400, 'source_not_found');
    try {
      const board = await prisma.careerBoard.create({
        data,
        select: { id: true, sourceId: true, token: true, active: true },
      });
      return reply.code(201).send(board);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new HttpError(409, 'career_board_exists');
      }
      throw err;
    }
  });

  app.patch('/career-boards/:id', async (req) => {
    const { id } = IdParam.parse(req.params);
    const data = UpdateCareerBoardInput.parse(req.body);
    const { count } = await prisma.careerBoard.updateMany({ where: { id }, data });
    if (!count) throw new HttpError(404, 'career_board_not_found');
    return { id, ...data };
  });
};
