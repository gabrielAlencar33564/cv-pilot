import { describe, expect, it, vi } from 'vitest';
import { createRobotsCache } from './robots-cache';

describe('createRobotsCache', () => {
  it('guarda o robots.txt por origem, com validade de 24 horas', async () => {
    const redis = { get: vi.fn(), set: vi.fn() };
    const cache = createRobotsCache(redis);

    await cache.set('https://www.nerdin.com.br', 'User-agent: *\nAllow: /\n');

    expect(redis.set).toHaveBeenCalledWith(
      'robots:https://www.nerdin.com.br',
      'User-agent: *\nAllow: /\n',
      'EX',
      86_400,
    );
  });

  it('devolve null quando a origem não está no cache', async () => {
    const redis = { get: vi.fn().mockResolvedValue(null), set: vi.fn() };
    const cache = createRobotsCache(redis);

    await expect(cache.get('https://site.test')).resolves.toBeNull();
    expect(redis.get).toHaveBeenCalledWith('robots:https://site.test');
  });
});
