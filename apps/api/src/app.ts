import { loggerOptions } from '@cv-pilot/logger';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import { AUTH_PATH } from './auth';
import { corsOrigins } from './config';
import { ACCOUNT_PATH, accountRoutes } from './modules/account/routes';
import { queuesRoutes } from './modules/admin/queues';
import { adminRoutes } from './modules/admin/routes';
import { applicationRoutes } from './modules/applications/routes';
import { companySuggestionRoutes } from './modules/company-suggestions/routes';
import { authRoutes } from './modules/auth/routes';
import { coverLetterTemplateRoutes } from './modules/cover-letter-templates/routes';
import { EXTENSION_PATH, extensionRoutes } from './modules/extension/routes';
import { extensionTokenRoutes } from './modules/extension-tokens/routes';
import { healthRoutes } from './modules/health/routes';
import { jobRoutes } from './modules/jobs/routes';
import { notificationRoutes } from './modules/notifications/routes';
import { resumeRoutes } from './modules/resumes/routes';
import { savedAnswerRoutes } from './modules/saved-answers/routes';
import { searchProfileRoutes } from './modules/search-profiles/routes';
import { sendRuleRoutes } from './modules/send-rules/routes';
import { sourceRoutes } from './modules/sources/routes';
import { requireAdmin } from './plugins/admin';
import { authPlugin } from './plugins/auth';
import { consentPlugin } from './plugins/consent';
import { errorHandler } from './plugins/errors';

const ADMIN_PATH = '/admin';

export async function buildApp() {
  // mesmo formato e mesmo mascaramento de dados pessoais dos workers (@cv-pilot/logger)
  // atrás do Caddy: o IP do cliente (gravado no aceite dos termos) vem do X-Forwarded-For
  const app = Fastify({ logger: loggerOptions('api'), trustProxy: true });

  await app.register(helmet);
  await app.register(cors, {
    origin: corsOrigins(),
    credentials: true,
    // o padrão do @fastify/cors é só GET, HEAD e POST; o web também edita e exclui
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: AUTH_PATH });
  await app.register(authPlugin);
  await app.register(consentPlugin);

  await app.register(accountRoutes, { prefix: ACCOUNT_PATH });

  await app.register(sourceRoutes, { prefix: '/sources' });
  await app.register(searchProfileRoutes, { prefix: '/search-profiles' });
  await app.register(resumeRoutes, { prefix: '/resumes' });
  await app.register(sendRuleRoutes, { prefix: '/send-rules' });
  await app.register(coverLetterTemplateRoutes, { prefix: '/cover-letter-templates' });
  await app.register(jobRoutes, { prefix: '/jobs' });
  await app.register(applicationRoutes, { prefix: '/applications' });
  await app.register(notificationRoutes, { prefix: '/notifications' });
  await app.register(companySuggestionRoutes, { prefix: '/company-suggestions' });
  await app.register(savedAnswerRoutes, { prefix: '/saved-answers' });
  await app.register(extensionTokenRoutes, { prefix: '/extension-tokens' });
  await app.register(extensionRoutes, { prefix: EXTENSION_PATH });

  // escopo próprio: o hook de ADMIN vale só para as rotas registradas aqui dentro
  await app.register(
    async (admin) => {
      admin.addHook('onRequest', requireAdmin);
      await admin.register(adminRoutes);
      await admin.register(queuesRoutes(ADMIN_PATH));
    },
    { prefix: ADMIN_PATH },
  );

  return app;
}
