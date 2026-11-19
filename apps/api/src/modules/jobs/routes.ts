import { DismissJobInput, JobListQuery } from '@cv-pilot/contracts';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { applyToMatch, dismissMatch, getMatchDetail, listMatches } from './service';

/** As rotas recebem o id do match (vaga × perfil de busca), que é o que a lista mostra. */
const MatchParams = z.object({ id: z.string() });

export const jobRoutes: FastifyPluginAsync = async (app) => {
  /** Vagas compatíveis com os perfis de busca do usuário, ordenadas pela nota. */
  app.get('/', async (req) => listMatches(req.userId, JobListQuery.parse(req.query)));

  /** Detalhes da vaga e a pré-visualização do que vai ser enviado (RF-24, RF-41). */
  app.get('/:id', async (req) => getMatchDetail(req.userId, MatchParams.parse(req.params).id));

  /** Candidatar-se: entra na fila de envio, dentro do limite diário. */
  app.post('/:id/apply', async (req, reply) => {
    const application = await applyToMatch(req.userId, MatchParams.parse(req.params).id);
    return reply.code(201).send(application);
  });

  /** "Não tenho interesse" (RF-42). */
  app.post('/:id/dismiss', async (req, reply) => {
    await dismissMatch(
      req.userId,
      MatchParams.parse(req.params).id,
      DismissJobInput.parse(req.body),
    );
    return reply.code(204).send();
  });
};
