import { prisma } from '@cv-pilot/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, uniqueId, type TestUser } from '../../test/db';

describe('alertas no app (RF-70, RF-71)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let dono: TestUser;
  let outro: TestUser;
  const sourceId = uniqueId('fonte');
  let jobId: string;

  beforeAll(async () => {
    app = await buildApp();
    [dono, outro] = [await signUpTestUser(app), await signUpTestUser(app)];
    await prisma.source.create({
      data: { id: sourceId, displayName: 'Fonte de teste', kind: 'api', applyModes: ['assisted'] },
    });
    jobId = (
      await prisma.job.create({
        data: {
          dedupeHash: uniqueId('hash'),
          title: 'Dev React',
          company: 'Empresa X',
          description: '',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await deleteTestUsers(dono.id, outro.id);
    await prisma.job.delete({ where: { id: jobId } });
    await prisma.source.delete({ where: { id: sourceId } });
    await app.close();
  });

  const pedir = (method: 'GET' | 'POST', url: string, usuario = dono) =>
    app.inject({ method, url, headers: usuario.headers });

  /** Um alerta de cada tipo para o dono, como o processor notify grava. */
  async function alertasDoDono() {
    await prisma.notification.deleteMany({ where: { userId: dono.id } });
    const resume = await prisma.resume.create({
      data: {
        userId: dono.id,
        name: 'CV Técnico',
        versions: {
          create: { version: 1, storageKey: 'x', fileName: 'cv.pdf', mimeType: 'application/pdf' },
        },
      },
      include: { versions: true },
    });
    const versionId = resume.versions[0]?.id ?? '';
    const application = await prisma.application.create({
      data: {
        userId: dono.id,
        jobId,
        sourceId,
        resumeVersionId: versionId,
        mode: 'assisted',
        status: 'needs_action',
      },
    });
    const criar = (kind: string, data: object, dedupeKey: string, createdAt: Date) =>
      prisma.notification.create({ data: { userId: dono.id, kind, data, dedupeKey, createdAt } });
    const resumo = await criar(
      'new_jobs',
      { count: 4, day: '2026-11-19' },
      'new_jobs_2026-11-19',
      new Date('2026-11-19T11:00:00Z'),
    );
    const falha = await criar(
      'resume_parse_failed',
      { resumeId: resume.id, resumeVersionId: versionId },
      `resume_parse_failed_${versionId}`,
      new Date('2026-11-19T12:00:00Z'),
    );
    const acao = await criar(
      'needs_action',
      { applicationId: application.id },
      `needs_action_${application.id}`,
      new Date('2026-11-19T13:00:00Z'),
    );
    return { resumo, falha, acao, application };
  }

  it('lista do mais novo para o mais antigo, com a vaga ou o currículo de cada alerta', async () => {
    const { resumo, falha, acao, application } = await alertasDoDono();

    const res = await pedir('GET', '/notifications');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      unreadCount: 3,
      items: [
        expect.objectContaining({
          id: acao.id,
          kind: 'needs_action',
          data: { applicationId: application.id },
          subject: 'Dev React · Empresa X',
          readAt: null,
        }),
        expect.objectContaining({
          id: falha.id,
          kind: 'resume_parse_failed',
          subject: 'CV Técnico',
        }),
        expect.objectContaining({
          id: resumo.id,
          kind: 'new_jobs',
          data: { count: 4, day: '2026-11-19' },
          subject: null,
        }),
      ],
    });
    await prisma.application.delete({ where: { id: application.id } });
  });

  it('deixa fora da lista o alerta num formato desconhecido', async () => {
    await prisma.notification.deleteMany({ where: { userId: dono.id } });
    await prisma.notification.create({
      data: { userId: dono.id, kind: 'tipo_antigo', data: {}, dedupeKey: 'antigo' },
    });

    expect((await pedir('GET', '/notifications')).json()).toMatchObject({ items: [] });
  });

  it('marca um alerta como lido e atualiza o contador', async () => {
    const { acao, application } = await alertasDoDono();

    expect((await pedir('POST', `/notifications/${acao.id}/read`)).statusCode).toBe(204);
    expect((await pedir('GET', '/notifications/unread-count')).json()).toEqual({ count: 2 });
    const lido = await prisma.notification.findUniqueOrThrow({ where: { id: acao.id } });
    expect(lido.readAt).toBeInstanceOf(Date);
    await prisma.application.delete({ where: { id: application.id } });
  });

  it('marca tudo como lido', async () => {
    const { application } = await alertasDoDono();

    expect((await pedir('POST', '/notifications/read-all')).statusCode).toBe(204);
    expect((await pedir('GET', '/notifications/unread-count')).json()).toEqual({ count: 0 });
    await prisma.application.delete({ where: { id: application.id } });
  });

  it('outro usuário não vê nem marca os alertas do dono', async () => {
    const { acao, application } = await alertasDoDono();

    expect((await pedir('GET', '/notifications', outro)).json()).toEqual({
      items: [],
      unreadCount: 0,
    });
    expect((await pedir('POST', `/notifications/${acao.id}/read`, outro)).statusCode).toBe(404);
    expect((await pedir('POST', '/notifications/read-all', outro)).statusCode).toBe(204);
    expect((await pedir('GET', '/notifications/unread-count')).json()).toEqual({ count: 3 });
    await prisma.application.delete({ where: { id: application.id } });
  });
});
