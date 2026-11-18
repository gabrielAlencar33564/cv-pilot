import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRedis } from './index';

describe('getRedis', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exige REDIS_URL em vez de cair num endereço padrão', () => {
    vi.stubEnv('REDIS_URL', undefined);
    expect(() => getRedis()).toThrow(/REDIS_URL não definida/);
  });

  it('trata REDIS_URL vazia como ausente', () => {
    vi.stubEnv('REDIS_URL', '');
    expect(() => getRedis()).toThrow(/REDIS_URL não definida/);
  });
});
