import type { getRedis } from '@cv-pilot/queue';

type CounterStore = Pick<ReturnType<typeof getRedis>, 'incr' | 'expire' | 'decr'>;

/** O contador some sozinho depois do dia; 48 h cobrem qualquer diferença de fuso. */
const COUNTER_TTL_SECONDS = 48 * 60 * 60;

export interface DailySlot {
  userId: string;
  sourceId: string;
  /** dia no fuso do usuário (`dailyBucket` do core) */
  day: string;
}

const counterKey = (slot: DailySlot) => `daily-apply:${slot.userId}:${slot.sourceId}:${slot.day}`;

/**
 * Reserva uma vaga no limite diário de envios automáticos, por usuário e por fonte (RF-51).
 * O INCR do Redis é atômico: com várias réplicas em paralelo, no máximo `limit` reservas passam.
 */
export async function reserveDailySlot(
  redis: CounterStore,
  slot: DailySlot,
  limit: number,
): Promise<boolean> {
  if (limit <= 0) return false;
  const key = counterKey(slot);
  const used = await redis.incr(key);
  await redis.expire(key, COUNTER_TTL_SECONDS);
  if (used <= limit) return true;
  await redis.decr(key);
  return false;
}

/** Devolve a vaga quando a candidatura que a reservou não chegou a ser criada. */
export async function releaseDailySlot(redis: CounterStore, slot: DailySlot): Promise<void> {
  await redis.decr(counterKey(slot));
}
