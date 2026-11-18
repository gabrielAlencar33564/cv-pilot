import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';
import { applicationRoutes } from './modules/applications/routes';
import { healthRoutes } from './modules/health/routes';
import { jobRoutes } from './modules/jobs/routes';
import { resumeRoutes } from './modules/resumes/routes';
import { searchProfileRoutes } from './modules/search-profiles/routes';
import { sendRuleRoutes } from './modules/send-rules/routes';
import { sourceRoutes } from './modules/sources/routes';
import { authPlugin } from './plugins/auth';
import { errorHandler } from './plugins/errors';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      // nunca logar dados pessoais
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.API_CORS_ORIGIN?.split(',') ?? 'http://localhost:3000',
    credentials: true,
  });
  app.setErrorHandler(errorHandler);

  await app.register(healthRoutes);
  await app.register(authPlugin);

  await app.register(sourceRoutes, { prefix: '/sources' });
  await app.register(searchProfileRoutes, { prefix: '/search-profiles' });
  await app.register(resumeRoutes, { prefix: '/resumes' });
  await app.register(sendRuleRoutes, { prefix: '/send-rules' });
  await app.register(jobRoutes, { prefix: '/jobs' });
  await app.register(applicationRoutes, { prefix: '/applications' });

  return app;
}
