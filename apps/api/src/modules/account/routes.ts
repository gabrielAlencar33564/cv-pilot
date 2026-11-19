import { AccountProfileInput, ConsentInput, TERMS_VERSION } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import type { FastifyPluginAsync } from 'fastify';
import { HttpError } from '../../plugins/errors';
import {
  acceptCurrentTerms,
  currentTermsAcceptedAt,
  exportUserData,
  readProfileLinks,
} from './service';

/** Prefixo da conta do usuário logado. */
export const ACCOUNT_PATH = '/me';

const profileSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  city: true,
  links: true,
  salaryExpectation: true,
  availability: true,
} as const;

/**
 * A conta do usuário logado (RF-02, RF-03 e RF-04). Estas rotas funcionam mesmo sem o aceite
 * dos termos atuais. A exclusão da conta fica no login: `POST /auth/delete-user`, com a senha.
 */
export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => {
    const { links, ...user } = await prisma.user.findUniqueOrThrow({
      where: { id: req.userId },
      select: profileSelect,
    });
    const termsAcceptedAt = await currentTermsAcceptedAt(req.userId);
    return {
      ...user,
      links: readProfileLinks(links),
      termsVersion: TERMS_VERSION,
      termsAcceptedAt,
      consentRequired: termsAcceptedAt === null,
    };
  });

  /** Perfil base do candidato (RF-02). */
  app.patch('/', async (req) => {
    const data = AccountProfileInput.parse(req.body);
    const { links, ...user } = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: profileSelect,
    });
    return { ...user, links: readProfileLinks(links) };
  });

  /** Todos os dados da conta em JSON, para baixar (RF-04). */
  app.get('/export', async (req, reply) => {
    const day = new Date().toISOString().slice(0, 10);
    return reply
      .header('content-disposition', `attachment; filename="cvpilot-meus-dados-${day}.json"`)
      .header('cache-control', 'private, no-store')
      .send(await exportUserData(req.userId));
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
