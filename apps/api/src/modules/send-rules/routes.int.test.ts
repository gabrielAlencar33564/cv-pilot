import { Prisma, prisma } from '@cv-pilot/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, uniqueId, type TestUser } from '../../test/db';

describe('rotas de regras de envio', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let usuario: TestUser;
  let resumeId: string;
  const sourceId = uniqueId('fonte');

  beforeAll(async () => {
    app = await buildApp();
    usuario = await signUpTestUser(app);
    resumeId = (await prisma.resume.create({ data: { userId: usuario.id, name: 'CV Técnico' } }))
      .id;
    await prisma.source.create({
      data: { id: sourceId, displayName: 'Fonte de teste', kind: 'api', applyModes: ['assisted'] },
    });
  });

  afterAll(async () => {
    await deleteTestUsers(usuario.id);
    await prisma.source.delete({ where: { id: sourceId } });
    await app.close();
  });

  const criarRegra = (body: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/send-rules',
      headers: usuario.headers,
      payload: { resumeId, ...body },
    });

  it('o índice único recusa dois escopos nulos iguais', async () => {
    const regra = { userId: usuario.id, resumeId, sourceId: null, searchProfileId: null };
    await prisma.sendRule.create({ data: regra });

    const duplicada = prisma.sendRule.create({ data: regra });
    await expect(duplicada).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await expect(duplicada).rejects.toMatchObject({ code: 'P2002' });
    await prisma.sendRule.deleteMany({ where: { userId: usuario.id } });
  });

  it('responde 409 a uma das duas regras criadas ao mesmo tempo', async () => {
    const [a, b] = await Promise.all([criarRegra({ sourceId }), criarRegra({ sourceId })]);

    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409]);
    const conflito = a.statusCode === 409 ? a : b;
    expect(conflito.json()).toEqual({ error: 'send_rule_scope_already_exists' });
    expect(await prisma.sendRule.count({ where: { userId: usuario.id, sourceId } })).toBe(1);
  });
});
