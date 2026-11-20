import { prisma } from '@cv-pilot/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, uniqueId, type TestUser } from '../../test/db';

describe('métricas das candidaturas (RF-63)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let dono: TestUser;
  let outro: TestUser;
  const sourceIds = [uniqueId('fonte'), uniqueId('fonte')];
  const jobIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
    [dono, outro] = [await signUpTestUser(app), await signUpTestUser(app)];
    await prisma.source.createMany({
      data: sourceIds.map((id, i) => ({
        id,
        displayName: `Site ${i + 1}`,
        kind: 'api',
        applyModes: ['assisted'],
      })),
    });
  });

  afterAll(async () => {
    await deleteTestUsers(dono.id, outro.id);
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.source.deleteMany({ where: { id: { in: sourceIds } } });
    await app.close();
  });

  async function umCurriculo(usuario: TestUser, name: string) {
    const resume = await prisma.resume.create({
      data: {
        userId: usuario.id,
        name,
        versions: {
          create: { version: 1, storageKey: 'x', fileName: 'cv.pdf', mimeType: 'application/pdf' },
        },
      },
      include: { versions: true },
    });
    return resume.versions[0]?.id ?? '';
  }

  async function umaCandidatura(
    usuario: TestUser,
    resumeVersionId: string,
    sourceId: string,
    status: string,
    log: object[] = [],
  ) {
    const job = await prisma.job.create({
      data: { dedupeHash: uniqueId('hash'), title: 'Dev', company: 'Empresa', description: '' },
    });
    jobIds.push(job.id);
    await prisma.application.create({
      data: {
        userId: usuario.id,
        jobId: job.id,
        sourceId,
        resumeVersionId,
        mode: 'assisted',
        status,
        log,
        ...(status === 'needs_action' ? {} : { sentAt: new Date() }),
      },
    });
  }

  it('monta o funil por currículo e por site, só com as candidaturas do dono', async () => {
    const [site1, site2] = sourceIds as [string, string];
    const tecnico = await umCurriculo(dono, 'Técnico');
    const humanizado = await umCurriculo(dono, 'Humanizado');
    await umaCandidatura(dono, tecnico, site1, 'sent');
    await umaCandidatura(dono, tecnico, site1, 'rejected', [
      { type: 'status_changed', from: 'sent', to: 'interview' },
      { type: 'status_changed', from: 'interview', to: 'rejected' },
    ]);
    await umaCandidatura(dono, humanizado, site2, 'offer');
    await umaCandidatura(dono, humanizado, site2, 'needs_action');
    await umaCandidatura(outro, await umCurriculo(outro, 'Alheio'), site1, 'offer');

    const res = await app.inject({
      method: 'GET',
      url: '/applications/metrics',
      headers: dono.headers,
    });

    expect(res.statusCode).toBe(200);
    const metricas = res.json<{
      totals: object;
      byResume: { resumeName: string }[];
      bySource: { sourceName: string; sent: number }[];
      byResumeAndSource: object[];
    }>();
    expect(metricas.totals).toEqual({ sent: 3, responded: 2, interviews: 2, offers: 1 });
    expect(metricas.byResume).toEqual([
      expect.objectContaining({ resumeName: 'Técnico', sent: 2, responded: 1, interviews: 1 }),
      expect.objectContaining({ resumeName: 'Humanizado', sent: 1, responded: 1, offers: 1 }),
    ]);
    expect(metricas.bySource.map((s) => [s.sourceName, s.sent])).toEqual([
      ['Site 1', 2],
      ['Site 2', 1],
    ]);
    expect(metricas.byResumeAndSource).toHaveLength(2);
  });

  it('quem não enviou nada vê tudo zerado', async () => {
    const novo = await signUpTestUser(app);
    const res = await app.inject({
      method: 'GET',
      url: '/applications/metrics',
      headers: novo.headers,
    });
    await deleteTestUsers(novo.id);

    expect(res.json()).toEqual({
      totals: { sent: 0, responded: 0, interviews: 0, offers: 0 },
      byResume: [],
      bySource: [],
      byResumeAndSource: [],
    });
  });
});
