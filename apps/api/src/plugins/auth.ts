import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { AUTH_PATH, auth } from '../auth';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

/** Rotas abertas: saúde do serviço e as próprias rotas de login. */
const PUBLIC_PATHS = ['/health', AUTH_PATH];

const isPublic = (url: string) =>
  PUBLIC_PATHS.some(
    (path) => url === path || url.startsWith(`${path}/`) || url.startsWith(`${path}?`),
  );

/** Toda rota fora das abertas exige a sessão do login (cookie do Better Auth); sem ela, 401. */
export const authPlugin = fp(async (app) => {
  app.decorateRequest('userId', '');

  app.addHook('onRequest', async (req: FastifyRequest, reply) => {
    if (isPublic(req.url)) return;

    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return reply.code(401).send({ error: 'unauthorized' });
    req.userId = session.user.id;
  });
});
