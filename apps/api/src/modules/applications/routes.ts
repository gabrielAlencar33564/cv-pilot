import { ApplicationStatus, ApplicationUpdateInput } from '@cv-pilot/contracts';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { listApplications, updateApplication } from './service';

export const applicationRoutes: FastifyPluginAsync = async (app) => {
  /** Painel de candidaturas (kanban). */
  app.get('/', async (req) => {
    const { status } = z.object({ status: ApplicationStatus.optional() }).parse(req.query);
    return listApplications(req.userId, status);
  });

  /** Mudança manual de status (só as transições permitidas) e anotações (RF-62). */
  app.patch('/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return updateApplication(req.userId, id, ApplicationUpdateInput.parse(req.body));
  });
};
