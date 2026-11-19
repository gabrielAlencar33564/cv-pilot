import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '../auth';
import { authPlugin } from './auth';

// o Better Auth fica falso: o teste cobre só a decisão do plugin (aberta, logado ou 401)
vi.mock('../auth', () => ({
  AUTH_PATH: '/auth',
  auth: { api: { getSession: vi.fn() } },
}));
const getSession = vi.mocked(auth.api.getSession);

/** API mínima: só o plugin de autenticação e rotas que devolvem o usuário da requisição. */
async function umaApi() {
  const app = Fastify();
  await app.register(authPlugin);
  app.get('/eu', async (req) => ({ userId: req.userId }));
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/auth/get-session', async () => ({ aberta: true }));
  app.get('/authors', async () => ({ aberta: false }));
  return app;
}

describe('authPlugin', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sem sessão, responde 401', async () => {
    getSession.mockResolvedValue(null);
    const app = await umaApi();

    const res = await app.inject({ url: '/eu' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'unauthorized' });
  });

  it('com sessão, a requisição leva o id do usuário logado', async () => {
    // em teste, a sessão falsa só traz o que o plugin lê
    getSession.mockResolvedValue({ user: { id: 'usuario-7' } } as never);
    const app = await umaApi();

    expect((await app.inject({ url: '/eu' })).json()).toEqual({ userId: 'usuario-7' });
  });

  it('não aceita mais o cabeçalho x-dev-user-id', async () => {
    getSession.mockResolvedValue(null);
    const app = await umaApi();

    const res = await app.inject({ url: '/eu', headers: { 'x-dev-user-id': 'qualquer-um' } });
    expect(res.statusCode).toBe(401);
  });

  it('deixa passar /health e as rotas de login sem sessão', async () => {
    getSession.mockResolvedValue(null);
    const app = await umaApi();

    expect((await app.inject({ url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ url: '/auth/get-session' })).statusCode).toBe(200);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('não confunde outra rota que só começa com "auth"', async () => {
    getSession.mockResolvedValue(null);
    const app = await umaApi();

    expect((await app.inject({ url: '/authors' })).statusCode).toBe(401);
  });
});
