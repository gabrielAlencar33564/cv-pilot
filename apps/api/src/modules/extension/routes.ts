import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { updateApplication } from '../applications/service';
import { inlineDisposition } from '../resumes/service';
import { extensionProfile, listPendingApplications, pendingApplicationResume } from './service';

/** Prefixo das rotas da extensão: só elas aceitam o token da extensão, e só ele (ADR 0010). */
export const EXTENSION_PATH = '/extension';

const IdParam = z.object({ id: z.string() });

/** O que a extensão do navegador usa no modo assistido. O candidato é quem envia. */
export const extensionRoutes: FastifyPluginAsync = async (app) => {
  app.get('/me', async (req) => extensionProfile(req.userId));

  app.get('/applications', async (req) => listPendingApplications(req.userId));

  /** O currículo para anexar no formulário; nunca fica em cache. */
  app.get('/applications/:id/resume', async (req, reply) => {
    const file = await pendingApplicationResume(req.userId, IdParam.parse(req.params).id);
    return reply
      .header('content-type', file.mimeType)
      .header('content-disposition', inlineDisposition(file.fileName))
      .header('cache-control', 'private, no-store')
      .send(file.content);
  });

  /** O candidato enviou no site: a candidatura sai de "Ação necessária" (RF-62). */
  app.post('/applications/:id/sent', async (req) => {
    const updated = await updateApplication(req.userId, IdParam.parse(req.params).id, {
      status: 'sent',
    });
    return { id: updated.id, status: updated.status };
  });
};
