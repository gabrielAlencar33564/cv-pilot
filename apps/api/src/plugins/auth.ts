import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

/** Usuário de desenvolvimento criado pelo seed. */
const DEV_USER_ID = 'dev-user';

/**
 * O bypass de login só liga com a flag explícita, e nunca em produção: um ambiente com
 * `NODE_ENV` esquecido não pode aceitar `x-dev-user-id` de qualquer um.
 */
export function devBypassEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.AUTH_DEV_BYPASS !== 'true') return false;
  if (env.NODE_ENV === 'production') {
    throw new Error('AUTH_DEV_BYPASS=true não é permitido com NODE_ENV=production');
  }
  return true;
}

/**
 * Autenticação. O login real chega na Etapa 2 (docs/melhorias.md).
 * Até lá, com AUTH_DEV_BYPASS=true, aceita o cabeçalho `x-dev-user-id` (padrão: o usuário do seed).
 * Sem a flag, toda rota fora de /health responde 401.
 */
export const authPlugin = fp(async (app) => {
  const bypass = devBypassEnabled();
  app.decorateRequest('userId', '');

  app.addHook('onRequest', async (req: FastifyRequest, reply) => {
    if (req.url.startsWith('/health')) return;

    if (bypass) {
      const devUser = req.headers['x-dev-user-id'];
      req.userId = typeof devUser === 'string' && devUser ? devUser : DEV_USER_ID;
      return;
    }
    return reply.code(401).send({ error: 'unauthorized' });
  });
});
