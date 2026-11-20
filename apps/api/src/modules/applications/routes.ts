import { ApplicationStatus, ApplicationUpdateInput } from '@cv-pilot/contracts';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getApplicationMetrics } from './metrics';
import { listApplications, markFollowedUp, updateApplication } from './service';

const IdParam = z.object({ id: z.string() });

export const applicationRoutes: FastifyPluginAsync = async (app) => {
  /** Painel de candidaturas (kanban). */
  app.get('/', async (req) => {
    const { status } = z.object({ status: ApplicationStatus.optional() }).parse(req.query);
    return listApplications(req.userId, status);
  });

  /** Funil por currículo, por site e por currículo × site (RF-63). */
  app.get('/metrics', async (req) => getApplicationMetrics(req.userId));

  /** Mudança manual de status (só as transições permitidas) e anotações (RF-62). */
  app.patch('/:id', async (req) => {
    const { id } = IdParam.parse(req.params);
    return updateApplication(req.userId, id, ApplicationUpdateInput.parse(req.body));
  });

  /** O candidato cobrou a empresa por uma resposta. */
  app.post('/:id/follow-up', async (req) =>
    markFollowedUp(req.userId, IdParam.parse(req.params).id),
  );
};
