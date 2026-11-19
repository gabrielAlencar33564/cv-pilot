import { loggerOptions } from '@cv-pilot/logger';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import { AUTH_PATH } from './auth';
import { corsOrigins } from './config';
import { ACCOUNT_PATH, accountRoutes } from './modules/account/routes';
import { applicationRoutes } from './modules/applications/routes';
import { authRoutes } from './modules/auth/routes';
import { healthRoutes } from './modules/health/routes';
import { jobRoutes } from './modules/jobs/routes';
import { resumeRoutes } from './modules/resumes/routes';
import { searchProfileRoutes } from './modules/search-profiles/routes';
import { sendRuleRoutes } from './modules/send-rules/routes';
import { sourceRoutes } from './modules/sources/routes';
import { authPlugin } from './plugins/auth';
import { consentPlugin } from './plugins/consent';
import { errorHandler } from './plugins/errors';

export async function buildApp() {
  // mesmo formato e mesmo mascaramento de dados pessoais dos workers (@cv-pilot/logger)
  // atrás do Caddy: o IP do cliente (gravado no aceite dos termos) vem do X-Forwarded-For
  const app = Fastify({ logger: loggerOptions('api'), trustProxy: true });

  await app.register(helmet);
  await app.register(cors, {
    origin: corsOrigins(),
    credentials: true,
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
  await app.register(jobRoutes, { prefix: '/jobs' });
  await app.register(applicationRoutes, { prefix: '/applications' });

  return app;
}
