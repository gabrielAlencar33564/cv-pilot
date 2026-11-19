import { prisma } from '@cv-pilot/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import {
  TEST_ORIGIN,
  TEST_PASSWORD,
  deleteTestUsers,
  signUpTestUser,
  uniqueId,
  type TestUser,
} from '../../test/db';

describe('login por e-mail e senha', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const criados: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await deleteTestUsers(...criados);
    await app.close();
  });

  async function novoUsuario(): Promise<TestUser> {
    const usuario = await signUpTestUser(app);
    criados.push(usuario.id);
    return usuario;
  }

  const post = (url: string, payload: Record<string, unknown>, cookie?: string) =>
    app.inject({
      method: 'POST',
      url,
      payload,
      headers: { origin: TEST_ORIGIN, ...(cookie ? { cookie } : {}) },
    });

  const listarPerfis = (cookie?: string) =>
    app.inject({ method: 'GET', url: '/search-profiles', headers: cookie ? { cookie } : {} });

  it('o cadastro já entra: o cookie da sessão abre as rotas protegidas', async () => {
    const usuario = await novoUsuario();

    expect((await listarPerfis(usuario.headers.cookie)).statusCode).toBe(200);
  });

  it('sem sessão, as rotas protegidas respondem 401', async () => {
    expect((await listarPerfis()).statusCode).toBe(401);
  });

  it('o cookie da sessão é httpOnly', async () => {
    const res = await post('/auth/sign-up/email', {
      email: `${uniqueId('usuario')}@teste.local`,
      password: TEST_PASSWORD,
      name: 'Pessoa de Teste',
    });
    criados.push(res.json<{ user: { id: string } }>().user.id);

    const sessao = res.cookies.find((c) => c.name.endsWith('cvpilot.session_token'));
    expect(sessao?.httpOnly).toBe(true);
  });

  it('entra com e-mail e senha e recusa senha errada', async () => {
    const usuario = await novoUsuario();

    const certo = await post('/auth/sign-in/email', {
      email: usuario.email,
      password: TEST_PASSWORD,
    });
    expect(certo.statusCode).toBe(200);
    const errado = await post('/auth/sign-in/email', {
      email: usuario.email,
      password: 'senha-errada-1',
    });
    expect(errado.statusCode).toBe(401);
  });

  it('recusa senha com menos de 8 caracteres no cadastro', async () => {
    const res = await post('/auth/sign-up/email', {
      email: `${uniqueId('usuario')}@teste.local`,
      password: 'curta',
      name: 'Pessoa de Teste',
    });

    expect(res.statusCode).toBe(400);
  });

  it('recusa cadastrar o mesmo e-mail duas vezes', async () => {
    const usuario = await novoUsuario();

    const res = await post('/auth/sign-up/email', {
      email: usuario.email,
      password: TEST_PASSWORD,
      name: 'Outra Pessoa',
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(await prisma.user.count({ where: { email: usuario.email } })).toBe(1);
  });

  it('sair encerra a sessão', async () => {
    const usuario = await novoUsuario();

    expect((await post('/auth/sign-out', {}, usuario.headers.cookie)).statusCode).toBe(200);
    expect((await listarPerfis(usuario.headers.cookie)).statusCode).toBe(401);
  });

  it('troca a senha com a senha atual e entra com a nova', async () => {
    const usuario = await novoUsuario();
    const novaSenha = 'senha-nova-456';

    const troca = await post(
      '/auth/change-password',
      { currentPassword: TEST_PASSWORD, newPassword: novaSenha },
      usuario.headers.cookie,
    );
    expect(troca.statusCode).toBe(200);
    const login = await post('/auth/sign-in/email', { email: usuario.email, password: novaSenha });
    expect(login.statusCode).toBe(200);
  });

  it('guarda só o hash da senha, nunca a senha', async () => {
    const usuario = await novoUsuario();

    const conta = await prisma.account.findFirstOrThrow({
      where: { userId: usuario.id, providerId: 'credential' },
    });
    expect(conta.password).toBeTruthy();
    expect(conta.password).not.toContain(TEST_PASSWORD);
  });
});
