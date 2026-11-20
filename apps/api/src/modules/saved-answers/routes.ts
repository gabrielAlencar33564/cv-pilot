import { SavedAnswerInput, SavedAnswerUpdateInput } from '@cv-pilot/contracts';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { deleteSavedAnswer, listSavedAnswers, saveAnswer, updateSavedAnswer } from './service';

const IdParam = z.object({ id: z.string() });

/** Banco de respostas dos formulários (ADR 0011): o candidato responde uma vez só. */
export const savedAnswerRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => listSavedAnswers(req.userId));

  app.post('/', async (req, reply) => {
    const { question, answer } = SavedAnswerInput.parse(req.body);
    return reply.code(201).send(await saveAnswer(req.userId, question, answer));
  });

  app.put('/:id', async (req) => {
    const { answer } = SavedAnswerUpdateInput.parse(req.body);
    return updateSavedAnswer(req.userId, IdParam.parse(req.params).id, answer);
  });

  app.delete('/:id', async (req, reply) => {
    await deleteSavedAnswer(req.userId, IdParam.parse(req.params).id);
    return reply.code(204).send();
  });
};
