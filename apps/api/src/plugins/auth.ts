import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

/**
 * Autenticação.
 * TODO: validar o JWT emitido pelo Auth.js (web) e preencher request.userId.
 * Por enquanto, em desenvolvimento, aceita o cabeçalho `x-dev-user-id`
 * (usuário "dev-user" criado pelo seed). Em produção, recusa tudo.
 */
export const authPlugin = fp(async (app) => {
  app.decorateRequest('userId', '');

  app.addHook('onRequest', async (req: FastifyRequest, reply) => {
    if (req.url.startsWith('/health')) return;

    if (process.env.NODE_ENV !== 'production') {
      const devUser = req.headers['x-dev-user-id'];
      req.userId = typeof devUser === 'string' && devUser ? devUser : 'dev-user';
      return;
    }
    return reply.code(401).send({ error: 'unauthorized' });
  });
});
