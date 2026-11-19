import { ConsentInput, TERMS_VERSION } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import type { FastifyPluginAsync } from 'fastify';
import { HttpError } from '../../plugins/errors';
import { acceptCurrentTerms, hasAcceptedCurrentTerms } from './service';

/** Prefixo da conta do usuário logado. */
export const ACCOUNT_PATH = '/me';

/** A conta do usuário logado. Estas rotas funcionam mesmo sem o aceite dos termos atuais. */
export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.userId },
      select: { id: true, name: true, email: true },
    });
    return {
      ...user,
      termsVersion: TERMS_VERSION,
      consentRequired: !(await hasAcceptedCurrentTerms(req.userId)),
    };
  });

  /** Aceite dos termos de uso e da política de privacidade (RF-03). */
  app.post('/consents', async (req, reply) => {
    const { termsVersion } = ConsentInput.parse(req.body);
    // aceitar uma versão antiga não vale: o texto mostrado ao usuário precisa ser o atual
    if (termsVersion !== TERMS_VERSION) throw new HttpError(400, 'outdated_terms_version');
    const consent = await acceptCurrentTerms(req.userId, req.ip);
    return reply
      .code(201)
      .send({ termsVersion: consent.termsVersion, acceptedAt: consent.acceptedAt });
  });
};
