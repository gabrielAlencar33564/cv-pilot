import { TERMS_VERSION } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, type TestUser } from '../../test/db';

describe('aceite dos termos (RF-03)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const criados: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await deleteTestUsers(...criados);
    await app.close();
  });

  async function semAceite(): Promise<TestUser> {
    const usuario = await signUpTestUser(app, { acceptTerms: false });
    criados.push(usuario.id);
    return usuario;
  }

  const aceitar = (usuario: TestUser, termsVersion: string, ip?: string) =>
    app.inject({
      method: 'POST',
      url: '/me/consents',
      headers: { ...usuario.headers, ...(ip ? { 'x-forwarded-for': ip } : {}) },
      payload: { termsVersion },
    });

  it('sem o aceite, o resto do sistema responde 403 consent_required', async () => {
    const usuario = await semAceite();

    const res = await app.inject({ method: 'GET', url: '/resumes', headers: usuario.headers });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'consent_required' });
  });

  it('a conta mostra que falta o aceite e qual é a versão atual', async () => {
    const usuario = await semAceite();

    const res = await app.inject({ method: 'GET', url: '/me', headers: usuario.headers });
    expect(res.json()).toMatchObject({
      email: usuario.email,
      termsVersion: TERMS_VERSION,
      consentRequired: true,
    });
  });

  it('o aceite grava versão, data e IP e libera o sistema', async () => {
    const usuario = await semAceite();

    expect((await aceitar(usuario, TERMS_VERSION, '203.0.113.7')).statusCode).toBe(201);
    const registro = await prisma.consentLog.findFirstOrThrow({ where: { userId: usuario.id } });
    expect(registro).toMatchObject({ termsVersion: TERMS_VERSION, ip: '203.0.113.7' });
    const res = await app.inject({ method: 'GET', url: '/resumes', headers: usuario.headers });
    expect(res.statusCode).toBe(200);
  });

  it('recusa aceitar uma versão que não é a atual', async () => {
    const usuario = await semAceite();

    const res = await aceitar(usuario, '2020-01-01');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'outdated_terms_version' });
    expect(await prisma.consentLog.count({ where: { userId: usuario.id } })).toBe(0);
  });

  it('aceitar de novo a mesma versão não duplica o registro', async () => {
    const usuario = await semAceite();

    await aceitar(usuario, TERMS_VERSION);
    await aceitar(usuario, TERMS_VERSION);
    expect(await prisma.consentLog.count({ where: { userId: usuario.id } })).toBe(1);
  });

  it('sem login, a conta responde 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
  });
});
