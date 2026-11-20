import { CreateCompanySuggestionInput } from '@cv-pilot/contracts';
import type { FastifyPluginAsync } from 'fastify';
import { listCompanySuggestions, suggestCompany } from './service';

export const companySuggestionRoutes: FastifyPluginAsync = async (app) => {
  /** As empresas que o usuário sugeriu e o que o detector achou em cada uma. */
  app.get('/', async (req) => listCompanySuggestions(req.userId));

  /** "Adicionar empresa": o detector roda no worker, e a lista mostra o resultado. */
  app.post('/', async (req, reply) => {
    const suggestion = await suggestCompany(
      req.userId,
      CreateCompanySuggestionInput.parse(req.body),
    );
    return reply.code(202).send(suggestion);
  });
};
