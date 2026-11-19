import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authPlugin, devBypassEnabled } from './auth';

/** API mínima: só o plugin de autenticação e uma rota que devolve o usuário da requisição. */
async function umaApi() {
  const app = Fastify();
  await app.register(authPlugin);
  app.get('/eu', async (req) => ({ userId: req.userId }));
  app.get('/health', async () => ({ status: 'ok' }));
  return app;
}

describe('authPlugin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sem AUTH_DEV_BYPASS, recusa com 401 mesmo fora de produção', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_DEV_BYPASS', '');
    const app = await umaApi();

    const res = await app.inject({ url: '/eu', headers: { 'x-dev-user-id': 'qualquer-um' } });
    expect(res.statusCode).toBe(401);
  });

  it('com AUTH_DEV_BYPASS=true, usa o x-dev-user-id', async () => {
    vi.stubEnv('AUTH_DEV_BYPASS', 'true');
    const app = await umaApi();

    const res = await app.inject({ url: '/eu', headers: { 'x-dev-user-id': 'usuario-7' } });
    expect(res.json()).toEqual({ userId: 'usuario-7' });
  });

  it('com AUTH_DEV_BYPASS=true e sem cabeçalho, usa o usuário do seed', async () => {
    vi.stubEnv('AUTH_DEV_BYPASS', 'true');
    const app = await umaApi();

    expect((await app.inject({ url: '/eu' })).json()).toEqual({ userId: 'dev-user' });
  });

  it('deixa o /health passar sem autenticação', async () => {
    vi.stubEnv('AUTH_DEV_BYPASS', '');
    const app = await umaApi();

    expect((await app.inject({ url: '/health' })).statusCode).toBe(200);
  });

  it('recusa subir com AUTH_DEV_BYPASS=true em produção', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_DEV_BYPASS', 'true');

    await expect(umaApi()).rejects.toThrow(/não é permitido com NODE_ENV=production/);
  });
});

describe('devBypassEnabled', () => {
  it('só aceita o valor exato "true"', () => {
    expect(devBypassEnabled({ AUTH_DEV_BYPASS: '1' })).toBe(false);
    expect(devBypassEnabled({ AUTH_DEV_BYPASS: 'TRUE' })).toBe(false);
    expect(devBypassEnabled({ AUTH_DEV_BYPASS: 'true' })).toBe(true);
  });
});
