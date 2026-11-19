import type { HostThrottle } from '@cv-pilot/adapters';
import type { getRedis } from '@cv-pilot/queue';

type ThrottleStore = Pick<ReturnType<typeof getRedis>, 'set' | 'pttl'>;

/** Espera mínima entre tentativas quando a chave sumiu entre o SET e o PTTL. */
const MIN_RETRY_MS = 50;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * No máximo uma requisição por `intervalMs` para cada host, somando todas as réplicas dos workers.
 * Quem pega a chave (SET NX PX) chama o site; quem não pega espera o tempo que falta (PTTL).
 */
export function createHostThrottle(
  redis: ThrottleStore,
  intervalMs: number,
  wait: (ms: number) => Promise<void> = sleep,
): HostThrottle {
  return async (host) => {
    const key = `host-throttle:${host}`;
    for (;;) {
      if ((await redis.set(key, '1', 'PX', intervalMs, 'NX')) === 'OK') return;
      const remaining = await redis.pttl(key);
      await wait(remaining > 0 ? remaining : MIN_RETRY_MS);
    }
  };
}
