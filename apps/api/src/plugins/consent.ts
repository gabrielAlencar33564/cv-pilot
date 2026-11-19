import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { ACCOUNT_PATH } from '../modules/account/routes';
import { hasAcceptedCurrentTerms } from '../modules/account/service';

/** A conta do usuário (ver, aceitar os termos, exportar e excluir) não depende do aceite. */
const isAccountRoute = (url: string) => {
  const path = url.split('?')[0] ?? url;
  return path === ACCOUNT_PATH || path.startsWith(`${ACCOUNT_PATH}/`);
};

/**
 * Sem o aceite da versão atual dos termos (RF-03), o usuário logado só usa a própria conta:
 * as demais rotas respondem 403 `consent_required`. Roda depois do `authPlugin`.
 */
export const consentPlugin = fp(async (app) => {
  app.addHook('onRequest', async (req: FastifyRequest, reply) => {
    // rota aberta: o authPlugin não identificou ninguém
    if (!req.userId || isAccountRoute(req.url)) return;
    if (!(await hasAcceptedCurrentTerms(req.userId))) {
      return reply.code(403).send({ error: 'consent_required' });
    }
  });
});
