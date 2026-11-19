import type { RobotsCache } from '@cv-pilot/adapters';
import type { getRedis } from '@cv-pilot/queue';

type RobotsStore = Pick<ReturnType<typeof getRedis>, 'get' | 'set'>;

/** A RFC 9309 pede para não usar um robots.txt guardado por mais de 24 horas. */
const ROBOTS_TTL_SECONDS = 24 * 60 * 60;

/** O robots.txt de cada origem fica no Redis, compartilhado por todas as réplicas dos workers. */
export function createRobotsCache(redis: RobotsStore): RobotsCache {
  const key = (origin: string) => `robots:${origin}`;
  return {
    get: (origin) => redis.get(key(origin)),
    set: async (origin, body) => {
      await redis.set(key(origin), body, 'EX', ROBOTS_TTL_SECONDS);
    },
  };
}
