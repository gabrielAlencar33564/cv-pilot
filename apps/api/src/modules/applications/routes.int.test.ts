import { prisma } from '@cv-pilot/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, uniqueId, type TestUser } from '../../test/db';

describe('kanban de candidaturas (RF-60, RF-62)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let dono: TestUser;
  let outro: TestUser;
  const sourceId = uniqueId('fonte');
  const jobIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
    [dono, outro] = [await signUpTestUser(app), await signUpTestUser(app)];
    await prisma.source.create({
      data: { id: sourceId, displayName: 'Fonte de teste', kind: 'api', applyModes: ['assisted'] },
    });
  });

  afterAll(async () => {
    await deleteTestUsers(dono.id, outro.id);
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.source.delete({ where: { id: sourceId } });
    await app.close();
  });

  async function umaCandidatura(
    status: string,
    carta: { coverLetter?: string; coverLetterStatus?: string } = {},
  ) {
    const job = await prisma.job.create({
      data: { dedupeHash: uniqueId('hash'), title: 'Dev', company: 'Empresa X', description: '' },
    });
    jobIds.push(job.id);
    const resume = await prisma.resume.create({
      data: {
        userId: dono.id,
        name: 'CV',
        versions: {
          create: { version: 1, storageKey: 'x', fileName: 'cv.pdf', mimeType: 'application/pdf' },
        },
      },
      include: { versions: true },
    });
    return prisma.application.create({
      data: {
        userId: dono.id,
        jobId: job.id,
        sourceId,
        resumeVersionId: resume.versions[0]?.id ?? '',
        mode: 'assisted',
        status,
        ...carta,
      },
    });
  }

  const mudar = (id: string, payload: object, usuario = dono) =>
    app.inject({ method: 'PATCH', url: `/applications/${id}`, headers: usuario.headers, payload });

  it('a lista traz as mudanças de status permitidas em cada candidatura', async () => {
    const candidatura = await umaCandidatura('needs_action');

    const res = await app.inject({ method: 'GET', url: '/applications', headers: dono.headers });
    const item = res
      .json<{ id: string; allowedTransitions: string[] }[]>()
      .find((a) => a.id === candidatura.id);
    expect(item?.allowedTransitions).toEqual(['sent', 'failed']);
  });

  it('marca como enviada a candidatura assistida e registra no histórico', async () => {
    const candidatura = await umaCandidatura('needs_action');

    const res = await mudar(candidatura.id, { status: 'sent' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'sent',
      allowedTransitions: expect.arrayContaining(['interview']) as string[],
    });
    const salva = await prisma.application.findUniqueOrThrow({ where: { id: candidatura.id } });
    expect(salva.log).toEqual([
      expect.objectContaining({ type: 'status_changed', from: 'needs_action', to: 'sent' }),
    ]);
  });

  it('recusa transição fora da máquina de estados com 409', async () => {
    const candidatura = await umaCandidatura('suggested');

    const res = await mudar(candidatura.id, { status: 'queued' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'invalid_status_transition' });
    const salva = await prisma.application.findUniqueOrThrow({ where: { id: candidatura.id } });
    expect(salva.status).toBe('suggested');
  });

  it('guarda as anotações sem mexer no status', async () => {
    const candidatura = await umaCandidatura('interview');

    const res = await mudar(candidatura.id, { notes: 'Entrevista técnica na quinta' });
    expect(res.json()).toMatchObject({
      status: 'interview',
      notes: 'Entrevista técnica na quinta',
    });
  });

  it('mandar o mesmo status de volta não é transição nem entra no histórico', async () => {
    const candidatura = await umaCandidatura('suggested');

    const res = await mudar(candidatura.id, { status: 'suggested', notes: 'olhar depois' });
    expect(res.statusCode).toBe(200);
    const salva = await prisma.application.findUniqueOrThrow({ where: { id: candidatura.id } });
    expect(salva.log).toEqual([]);
  });

  it('a lista diz se a carta ainda pode ser editada', async () => {
    const [sugerida, enviada] = [await umaCandidatura('suggested'), await umaCandidatura('sent')];

    const res = await app.inject({ method: 'GET', url: '/applications', headers: dono.headers });
    const editavel = (id: string) =>
      res.json<{ id: string; coverLetterEditable: boolean }[]>().find((a) => a.id === id)
        ?.coverLetterEditable;
    expect(editavel(sugerida.id)).toBe(true);
    expect(editavel(enviada.id)).toBe(false);
  });

  it('o candidato edita a carta antes do envio, e a IA não a sobrescreve depois (RF-54)', async () => {
    const candidatura = await umaCandidatura('needs_action', {
      coverLetter: 'Modelo',
      coverLetterStatus: 'generating',
    });

    const res = await mudar(candidatura.id, { coverLetter: '  Minha carta revisada  ' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      coverLetter: 'Minha carta revisada',
      coverLetterStatus: 'edited',
    });
    // o worker só grava sobre `generating`
    const { count } = await prisma.application.updateMany({
      where: { id: candidatura.id, coverLetterStatus: 'generating' },
      data: { coverLetter: 'carta da IA', coverLetterStatus: 'generated' },
    });
    expect(count).toBe(0);
  });

  it('carta vazia tira a carta da candidatura', async () => {
    const candidatura = await umaCandidatura('suggested', { coverLetter: 'Modelo' });

    const res = await mudar(candidatura.id, { coverLetter: '   ' });
    expect(res.json()).toMatchObject({ coverLetter: null, coverLetterStatus: 'edited' });
  });

  it('depois do envio, a carta não muda: é o que a empresa recebeu', async () => {
    const candidatura = await umaCandidatura('sent', { coverLetter: 'Enviada' });

    const res = await mudar(candidatura.id, { coverLetter: 'Outra' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'cover_letter_locked' });
  });

  it('marcar como enviada antes de a IA terminar mantém a carta que já estava', async () => {
    const candidatura = await umaCandidatura('needs_action', {
      coverLetter: 'Modelo',
      coverLetterStatus: 'generating',
    });

    const res = await mudar(candidatura.id, { status: 'sent' });
    expect(res.json()).toMatchObject({ coverLetter: 'Modelo', coverLetterStatus: null });
  });

  it('exige status ou anotações', async () => {
    const candidatura = await umaCandidatura('sent');

    expect((await mudar(candidatura.id, {})).statusCode).toBe(400);
  });

  it('responde 404 para a candidatura de outro usuário', async () => {
    const candidatura = await umaCandidatura('sent');

    expect((await mudar(candidatura.id, { notes: 'x' }, outro)).statusCode).toBe(404);
  });
});
