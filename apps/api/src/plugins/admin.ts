import { prisma } from '@cv-pilot/db';
import type { FastifyRequest } from 'fastify';
import { HttpError } from './errors';

/**
 * Hook das rotas de admin (RF-80/81): só passa quem tem o papel ADMIN. O papel é lido no
 * banco a cada requisição, para valer na hora quando alguém perde o acesso. Os outros
 * usuários recebem 404, como se a rota não existisse.
 */
export async function requireAdmin(req: FastifyRequest) {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
  if (user?.role !== 'ADMIN') throw new HttpError(404, 'not_found');
}
