import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { QUEUES, getRedis } from '@cv-pilot/queue';
import { Queue } from 'bullmq';
import type { FastifyPluginAsync } from 'fastify';
import { AUTH_PATH } from '../../auth';
import { requiredEnv } from '../../config';

const QUEUES_PATH = '/queues';

/**
 * Caminho público da API: vazio em dev (porta 4000) e `/api` atrás do Caddy, que tira o
 * prefixo antes de repassar. Sai do BETTER_AUTH_URL, que já traz o caminho do login.
 */
function publicApiPrefix() {
  const path = new URL(requiredEnv('BETTER_AUTH_URL')).pathname.replace(/\/$/, '');
  return path.endsWith(AUTH_PATH) ? path.slice(0, -AUTH_PATH.length) : '';
}

/**
 * Bull Board (RF-80/81): filas pendentes, falhas e retentativas, e o botão de reexecutar.
 * Registrado dentro do escopo do admin, então herda a sessão e a checagem de ADMIN.
 */
export const queuesRoutes = (adminPrefix: string): FastifyPluginAsync =>
  async function queues(app) {
    // instâncias próprias, fechadas com o app; as do `enqueue` (getQueue) seguem abertas.
    // Todas usam a mesma conexão Redis, que o BullMQ não fecha por ser compartilhada.
    const queues = Object.values(QUEUES).map((name) => new Queue(name, { connection: getRedis() }));
    app.addHook('onClose', async () => {
      await Promise.all(queues.map((queue) => queue.close()));
    });

    const serverAdapter = new FastifyAdapter();
    // a interface monta as URLs dos assets e da própria API a partir deste caminho público
    serverAdapter.setBasePath(`${publicApiPrefix()}${adminPrefix}${QUEUES_PATH}`);
    createBullBoard({
      queues: queues.map((queue) => new BullMQAdapter(queue)),
      serverAdapter,
      options: { uiConfig: { boardTitle: 'CV Pilot' } },
    });
    await app.register(serverAdapter.registerPlugin(), { prefix: QUEUES_PATH });
  };
