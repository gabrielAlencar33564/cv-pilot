import { loggerOptions } from '@cv-pilot/logger';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import { AUTH_PATH } from './auth';
import { corsOrigins } from './config';
import { applicationRoutes } from './modules/applications/routes';
import { authRoutes } from './modules/auth/routes';
import { healthRoutes } from './modules/health/routes';
import { jobRoutes } from './modules/jobs/routes';
import { resumeRoutes } from './modules/resumes/routes';
import { searchProfileRoutes } from './modules/search-profiles/routes';
import { sendRuleRoutes } from './modules/send-rules/routes';
import { sourceRoutes } from './modules/sources/routes';
import { authPlugin } from './plugins/auth';
import { errorHandler } from './plugins/errors';

export async function buildApp() {
  // mesmo formato e mesmo mascaramento de dados pessoais dos workers (@cv-pilot/logger)
  const app = Fastify({ logger: loggerOptions('api') });

  await app.register(helmet);
  await app.register(cors, {
    origin: corsOrigins(),
    credentials: true,
  });
  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: AUTH_PATH });
  await app.register(authPlugin);

  await app.register(sourceRoutes, { prefix: '/sources' });
  await app.register(searchProfileRoutes, { prefix: '/search-profiles' });
  await app.register(resumeRoutes, { prefix: '/resumes' });
  await app.register(sendRuleRoutes, { prefix: '/send-rules' });
  await app.register(jobRoutes, { prefix: '/jobs' });
  await app.register(applicationRoutes, { prefix: '/applications' });

  return app;
}
