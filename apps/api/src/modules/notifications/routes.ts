import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from './service';

const IdParam = z.object({ id: z.string() });

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async (req) => listNotifications(req.userId));

  // o menu consulta só o contador, de tempos em tempos
  app.get('/unread-count', async (req) => unreadNotificationCount(req.userId));

  app.post('/read-all', async (req, reply) => {
    await markAllNotificationsRead(req.userId);
    return reply.code(204).send();
  });

  app.post('/:id/read', async (req, reply) => {
    await markNotificationRead(req.userId, IdParam.parse(req.params).id);
    return reply.code(204).send();
  });
};
