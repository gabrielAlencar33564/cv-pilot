import { createPoliteFetch, type AdapterContext } from '@cv-pilot/adapters';
import { getRedis } from '@cv-pilot/queue';
import { createHostThrottle } from './host-throttle';
import { logger } from './logger';
import { createRobotsCache } from './robots-cache';

/**
 * Contexto do adapter de uma fonte: o fetch educado no ritmo da fonte, com o intervalo por
 * host e o robots.txt valendo para todas as réplicas juntas (Redis).
 */
export function sourceContext(
  sourceId: string,
  source: { rateLimitReqs: number; rateLimitMs: number },
  maxResults: number,
): AdapterContext {
  return {
    http: createPoliteFetch({
      throttle: createHostThrottle(
        getRedis(),
        Math.ceil(source.rateLimitMs / Math.max(source.rateLimitReqs, 1)),
      ),
      robots: createRobotsCache(getRedis()),
    }),
    log: (msg, data) => logger.info({ sourceId, ...data }, msg),
    maxResults,
  };
}
