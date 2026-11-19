import type { AdminSourceRow } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, uniqueId, type TestUser } from '../../test/db';

const HORA = 60 * 60_000;

describe('rotas de admin (RF-35, RF-80, RF-81)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let admin: TestUser;
  let candidato: TestUser;
  const sourceId = uniqueId('fonte');

  beforeAll(async () => {
    app = await buildApp();
    [admin, candidato] = [await signUpTestUser(app), await signUpTestUser(app)];
    await prisma.user.update({ where: { id: admin.id }, data: { role: 'ADMIN' } });
    await prisma.source.create({
      data: { id: sourceId, displayName: 'Fonte de teste', kind: 'api', applyModes: [] },
    });
    const agora = Date.now();
    await prisma.sourceRun.createMany({
      data: [
        // duas execuções nas últimas 24 h, uma com falha; a de 30 h atrás fica fora da janela
        { status: 'success', found: 7, startedAt: new Date(agora - HORA), durationMs: 10 },
        {
          status: 'failed',
          error: 'HTTP 503',
          startedAt: new Date(agora - 2 * HORA),
          durationMs: 5,
        },
        { status: 'failed', startedAt: new Date(agora - 30 * HORA), durationMs: 5 },
      ].map((run) => ({ ...run, sourceId, target: 'empresa' })),
    });
  });

  afterAll(async () => {
    await prisma.source.deleteMany({ where: { id: sourceId } });
    await deleteTestUsers(admin.id, candidato.id);
    await app.close();
  });

  const pedir = (user: TestUser, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
    app.inject({ method, url, headers: user.headers, payload });

  it('quem não é ADMIN recebe 404, como se a rota não existisse', async () => {
    for (const url of ['/admin/sources', `/admin/sources/${sourceId}/runs`, '/admin/queues']) {
      const res = await pedir(candidato, 'GET', url);
      expect(res.statusCode, url).toBe(404);
    }
    const pausar = await pedir(candidato, 'PATCH', `/admin/sources/${sourceId}`, { active: false });
    expect(pausar.statusCode).toBe(404);
    expect((await prisma.source.findUniqueOrThrow({ where: { id: sourceId } })).active).toBe(true);
  });

  it('o /me diz se o usuário é admin, para o web mostrar o menu', async () => {
    expect((await pedir(admin, 'GET', '/me')).json()).toMatchObject({ isAdmin: true });
    expect((await pedir(candidato, 'GET', '/me')).json()).toMatchObject({ isAdmin: false });
  });

  it('mostra a saúde de cada fonte com os números das últimas 24 horas', async () => {
    const res = await pedir(admin, 'GET', '/admin/sources');

    expect(res.statusCode).toBe(200);
    const fonte = res.json<AdminSourceRow[]>().find((s) => s.id === sourceId);
    expect(fonte).toMatchObject({
      active: true,
      health: 'failing',
      runs24h: 2,
      failures24h: 1,
      found24h: 7,
      openJobs: 0,
      careerBoards: 0,
    });
  });

  it('lista as execuções da fonte, da mais recente para a mais antiga', async () => {
    const res = await pedir(admin, 'GET', `/admin/sources/${sourceId}/runs?pageSize=2`);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      total: 3,
      items: [
        { status: 'success', found: 7 },
        { status: 'failed', error: 'HTTP 503' },
      ],
    });
  });

  it('desliga a fonte e ajusta o limite de requisições sem deploy', async () => {
    const res = await pedir(admin, 'PATCH', `/admin/sources/${sourceId}`, {
      active: false,
      rateLimitReqs: 10,
    });

    expect(res.statusCode).toBe(200);
    expect(await prisma.source.findUniqueOrThrow({ where: { id: sourceId } })).toMatchObject({
      active: false,
      rateLimitReqs: 10,
    });
  });

  it('recusa limite fora da faixa e pedido vazio, e responde 404 para fonte que não existe', async () => {
    expect(
      (await pedir(admin, 'PATCH', `/admin/sources/${sourceId}`, { rateLimitMs: 10 })).statusCode,
    ).toBe(400);
    expect((await pedir(admin, 'PATCH', `/admin/sources/${sourceId}`, {})).statusCode).toBe(400);
    const res = await pedir(admin, 'PATCH', '/admin/sources/nao-existe', { active: true });
    expect(res.statusCode).toBe(404);
  });

  it('cadastra uma empresa no catálogo, recusa a repetida e liga e desliga', async () => {
    const criar = await pedir(admin, 'POST', '/admin/career-boards', {
      sourceId,
      token: ' Nubank ',
    });
    expect(criar.statusCode).toBe(201);
    const board = criar.json<{ id: string; token: string }>();
    expect(board.token).toBe('nubank');

    const repetida = await pedir(admin, 'POST', '/admin/career-boards', {
      sourceId,
      token: 'nubank',
    });
    expect(repetida.statusCode).toBe(409);
    expect(repetida.json()).toEqual({ error: 'career_board_exists' });

    const desligar = await pedir(admin, 'PATCH', `/admin/career-boards/${board.id}`, {
      active: false,
    });
    expect(desligar.statusCode).toBe(200);

    const lista = await pedir(admin, 'GET', `/admin/career-boards?sourceId=${sourceId}`);
    expect(lista.json()).toMatchObject({
      total: 1,
      items: [{ token: 'nubank', active: false, openJobs: 0 }],
    });
  });

  it('recusa token inválido e fonte que não existe no catálogo', async () => {
    const invalido = await pedir(admin, 'POST', '/admin/career-boards', {
      sourceId,
      token: 'https://boards.greenhouse.io/x',
    });
    expect(invalido.statusCode).toBe(400);
    const semFonte = await pedir(admin, 'POST', '/admin/career-boards', {
      sourceId: 'nao-existe',
      token: 'empresa',
    });
    expect(semFonte.json()).toEqual({ error: 'source_not_found' });
  });

  it('serve o Bull Board para o admin, com os assets no caminho certo', async () => {
    const pagina = await pedir(admin, 'GET', '/admin/queues');

    expect(pagina.statusCode).toBe(200);
    expect(pagina.body).toContain('<base href="/admin/queues/"');
    const script = /src="(static\/js\/main\.[^"]+\.js)"/.exec(pagina.body)?.[1];
    expect(script).toBeDefined();
    expect((await pedir(admin, 'GET', `/admin/queues/${script}`)).statusCode).toBe(200);

    const filas = await pedir(admin, 'GET', '/admin/queues/api/queues');
    expect(filas.statusCode).toBe(200);
    expect(filas.body).toContain('ingest');
  });
});
