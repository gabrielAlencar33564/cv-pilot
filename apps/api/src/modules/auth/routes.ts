import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyPluginAsync } from 'fastify';
import { AUTH_PATH, AUTH_URL, auth } from '../../auth';

/**
 * Repassa `/auth/*` ao Better Auth. A URL é remontada a partir da `BETTER_AUTH_URL` porque,
 * em produção, o Caddy tira o `/api` do caminho antes de a requisição chegar aqui.
 */
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.route({
    method: ['GET', 'POST'],
    url: '/*',
    async handler(req, reply) {
      const url = `${AUTH_URL}${req.url.slice(AUTH_PATH.length)}`;
      const response = await auth.handler(
        new Request(url, {
          method: req.method,
          headers: fromNodeHeaders(req.headers),
          ...(req.body ? { body: JSON.stringify(req.body) } : {}),
        }),
      );
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      return reply.send(response.body ? await response.text() : null);
    },
  });
};
