import { ExtensionTokenInput } from '@cv-pilot/contracts';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createExtensionToken, deleteExtensionToken, listExtensionTokens } from './service';

const IdParam = z.object({ id: z.string() });

/** Chaves da extensão do navegador (ADR 0010). Gerenciadas pelo site, com a sessão do login. */
export const extensionTokenRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => listExtensionTokens(req.userId));

  app.post('/', async (req, reply) => {
    const { name } = ExtensionTokenInput.parse(req.body);
    const created = await createExtensionToken(req.userId, name);
    return reply.code(201).header('cache-control', 'no-store').send(created);
  });

  /** Desconecta o navegador: a extensão que usava a chave passa a receber 401. */
  app.delete('/:id', async (req, reply) => {
    await deleteExtensionToken(req.userId, IdParam.parse(req.params).id);
    return reply.code(204).send();
  });
};
