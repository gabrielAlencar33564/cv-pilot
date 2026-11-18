import { SendRuleInput } from '@cv-pilot/contracts';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sendRuleService } from './service';

const IdParam = z.object({ id: z.string() });
const ResolveQuery = z.object({ sourceId: z.string(), searchProfileId: z.string().optional() });

export const sendRuleRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => sendRuleService.list(req.userId));

  /** GET /send-rules/resolve?sourceId=gupy&searchProfileId=... */
  app.get('/resolve', async (req) => {
    const { sourceId, searchProfileId } = ResolveQuery.parse(req.query);
    return { rule: await sendRuleService.resolve(req.userId, sourceId, searchProfileId) };
  });

  app.post('/', async (req, reply) => {
    const rule = await sendRuleService.create(req.userId, SendRuleInput.parse(req.body));
    return reply.code(201).send(rule);
  });

  app.put('/:id', async (req) => {
    const { id } = IdParam.parse(req.params);
    return sendRuleService.update(req.userId, id, SendRuleInput.parse(req.body));
  });

  app.delete('/:id', async (req, reply) => {
    await sendRuleService.remove(req.userId, IdParam.parse(req.params).id);
    return reply.code(204).send();
  });
};
