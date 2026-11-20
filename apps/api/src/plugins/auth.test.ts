import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '../auth';
import { userIdFromAuthorization } from '../modules/extension-tokens/service';
import { authPlugin } from './auth';

// o Better Auth e os tokens ficam falsos: o teste cobre só a decisão do plugin
vi.mock('../auth', () => ({
  AUTH_PATH: '/auth',
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock('../modules/extension-tokens/service', () => ({ userIdFromAuthorization: vi.fn() }));
const getSession = vi.mocked(auth.api.getSession);
const tokenOwner = vi.mocked(userIdFromAuthorization);

/** API mínima: só o plugin de autenticação e rotas que devolvem o usuário da requisição. */
async function umaApi() {
  const app = Fastify();
  await app.register(authPlugin);
  app.get('/eu', async (req) => ({ userId: req.userId }));
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/auth/get-session', async () => ({ aberta: true }));
  app.get('/authors', async () => ({ aberta: false }));
  app.get('/extension/applications', async (req) => ({ userId: req.userId }));
  app.get('/extension-tokens', async (req) => ({ userId: req.userId }));
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

  it('nas rotas da extensão, o token identifica o usuário', async () => {
    tokenOwner.mockResolvedValue('usuario-9');
    const app = await umaApi();

    const res = await app.inject({
      url: '/extension/applications',
      headers: { authorization: 'Bearer cvp_ext_abc' },
    });
    expect(res.json()).toEqual({ userId: 'usuario-9' });
    expect(tokenOwner).toHaveBeenCalledWith('Bearer cvp_ext_abc');
  });

  it('nas rotas da extensão, a sessão do login não vale: sem token, 401', async () => {
    getSession.mockResolvedValue({ user: { id: 'usuario-7' } } as never);
    tokenOwner.mockResolvedValue(null);
    const app = await umaApi();

    expect((await app.inject({ url: '/extension/applications' })).statusCode).toBe(401);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('fora das rotas da extensão, o token não vale', async () => {
    getSession.mockResolvedValue(null);
    tokenOwner.mockResolvedValue('usuario-9');
    const app = await umaApi();

    const res = await app.inject({
      url: '/extension-tokens',
      headers: { authorization: 'Bearer cvp_ext_abc' },
    });
    expect(res.statusCode).toBe(401);
    expect(tokenOwner).not.toHaveBeenCalled();
  });
});
