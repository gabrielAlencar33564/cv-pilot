import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { AUTH_PATH, auth } from '../auth';
import { EXTENSION_PATH } from '../modules/extension/routes';
import { userIdFromAuthorization } from '../modules/extension-tokens/service';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

/** Rotas abertas: saúde do serviço e as próprias rotas de login. */
const PUBLIC_PATHS = ['/health', AUTH_PATH];

const underPath = (url: string, path: string) =>
  url === path || url.startsWith(`${path}/`) || url.startsWith(`${path}?`);

const isPublic = (url: string) => PUBLIC_PATHS.some((path) => underPath(url, path));

/**
 * Toda rota fora das abertas exige a sessão do login (cookie do Better Auth); sem ela, 401.
 * As rotas da extensão exigem o token da extensão e não aceitam o cookie: um token vazado
 * não alcança o resto da conta (ADR 0010).
 */
export const authPlugin = fp(async (app) => {
  app.decorateRequest('userId', '');

  app.addHook('onRequest', async (req: FastifyRequest, reply) => {
    if (isPublic(req.url)) return;

    if (underPath(req.url, EXTENSION_PATH)) {
      const userId = await userIdFromAuthorization(req.headers.authorization);
      if (!userId) return reply.code(401).send({ error: 'unauthorized' });
      req.userId = userId;
      return;
    }

    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return reply.code(401).send({ error: 'unauthorized' });
    req.userId = session.user.id;
  });
});
