import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { releaseDailySlot, reserveDailySlot } from './daily-limit';
import { getRedis } from './index';

const redis = getRedis();
const userId = `usuario-${randomUUID()}`;
const umSlot = (sourceId = 'gupy') => ({ userId, sourceId, day: '2026-11-18' });

describe('reserveDailySlot (Redis real)', () => {
  afterAll(async () => {
    const chaves = await redis.keys(`daily-apply:${userId}:*`);
    if (chaves.length) await redis.del(...chaves);
    await redis.quit();
  });

  it('com reservas em paralelo, só passam até o limite', async () => {
    const resultados = await Promise.all(
      Array.from({ length: 10 }, () => reserveDailySlot(redis, umSlot('paralelo'), 3)),
    );

    expect(resultados.filter(Boolean)).toHaveLength(3);
    expect(await redis.get(`daily-apply:${userId}:paralelo:2026-11-18`)).toBe('3');
  });

  it('conta cada fonte separadamente', async () => {
    expect(await reserveDailySlot(redis, umSlot('greenhouse'), 1)).toBe(true);
    expect(await reserveDailySlot(redis, umSlot('greenhouse'), 1)).toBe(false);
    expect(await reserveDailySlot(redis, umSlot('lever'), 1)).toBe(true);
  });

  it('o contador expira sozinho', async () => {
    await reserveDailySlot(redis, umSlot('ttl'), 5);

    const ttl = await redis.ttl(`daily-apply:${userId}:ttl:2026-11-18`);
    expect(ttl).toBeGreaterThan(0);
  });

  it('limite zero não reserva nem cria contador', async () => {
    expect(await reserveDailySlot(redis, umSlot('zero'), 0)).toBe(false);
    expect(await redis.exists(`daily-apply:${userId}:zero:2026-11-18`)).toBe(0);
  });

  it('a vaga devolvida pode ser usada de novo', async () => {
    expect(await reserveDailySlot(redis, umSlot('devolve'), 1)).toBe(true);
    await releaseDailySlot(redis, umSlot('devolve'));
    expect(await reserveDailySlot(redis, umSlot('devolve'), 1)).toBe(true);
  });
});
