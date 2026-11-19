import { prisma } from '@cv-pilot/db';
import { enqueueApplication, releaseDailySlot, reserveDailySlot } from '@cv-pilot/queue';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, uniqueId, type TestUser } from '../../test/db';

// fila e contador falsos: o teste cobre a rota e o banco; o Redis real tem a suíte do @cv-pilot/queue
vi.mock('@cv-pilot/queue', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  enqueueApplication: vi.fn(),
  reserveDailySlot: vi.fn(),
  releaseDailySlot: vi.fn(),
}));

describe('ações na lista de vagas (RF-24, RF-42)', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reserveDailySlot).mockResolvedValue(true);
  });

  /** Vaga com match para um perfil novo do dono; regra, arquivo e carta variam por teste. */
  async function umaVaga({
    comRegra = true,
    comArquivo = true,
    modeloDeCarta,
  }: { comRegra?: boolean; comArquivo?: boolean; modeloDeCarta?: string } = {}) {
    const job = await prisma.job.create({
      data: {
        dedupeHash: uniqueId('hash'),
        title: 'Dev React',
        company: 'Empresa X',
        description: 'Vaga de React com TypeScript',
        sources: {
          create: { sourceId, externalId: uniqueId('ext'), url: 'https://exemplo.test/vaga' },
        },
      },
    });
    jobIds.push(job.id);
    const perfil = await prisma.searchProfile.create({
      data: { userId: dono.id, name: 'Front', keywords: ['react'], sourceIds: [sourceId] },
    });
    const match = await prisma.jobMatch.create({
      data: {
        jobId: job.id,
        searchProfileId: perfil.id,
        score: 90,
        reasons: ['Palavras-chave: react'],
      },
    });
    const resume = await prisma.resume.create({ data: { userId: dono.id, name: 'CV Técnico' } });
    if (comArquivo) {
      await prisma.resumeVersion.create({
        data: {
          resumeId: resume.id,
          version: 1,
          storageKey: 'x',
          fileName: 'cv.pdf',
          mimeType: 'application/pdf',
        },
      });
    }
    const template = modeloDeCarta
      ? await prisma.coverLetterTemplate.create({
          data: { userId: dono.id, name: 'Modelo', body: modeloDeCarta },
        })
      : null;
    if (comRegra) {
      await prisma.sendRule.create({
        data: {
          userId: dono.id,
          sourceId,
          searchProfileId: perfil.id,
          resumeId: resume.id,
          coverLetterTemplateId: template?.id,
        },
      });
    }
    return { job, perfil, match, resume };
  }

  const pedir = (method: 'GET' | 'POST', url: string, usuario: TestUser, payload?: object) =>
    app.inject({ method, url, headers: usuario.headers, ...(payload ? { payload } : {}) });

  it('mostra os detalhes e a pré-visualização do que vai ser enviado', async () => {
    const { match, resume } = await umaVaga();

    const res = await pedir('GET', `/jobs/${match.id}`, dono);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      job: { title: 'Dev React', description: 'Vaga de React com TypeScript' },
      application: null,
      preview: {
        sourceId,
        rule: { mode: 'assisted', reviewBeforeSend: true },
        resume: { id: resume.id, name: 'CV Técnico', version: { version: 1, fileName: 'cv.pdf' } },
        coverLetter: null,
      },
    });
  });

  it('a carta é o modelo da regra preenchido com a vaga e o candidato', async () => {
    const carta = 'Olá, {{empresa}}! Sou {{nome}} e quero a vaga de {{cargo}}.';
    const { match } = await umaVaga({ modeloDeCarta: carta });
    const esperada = 'Olá, Empresa X! Sou Pessoa de Teste e quero a vaga de Dev React.';

    const detalhe = await pedir('GET', `/jobs/${match.id}`, dono);
    expect(detalhe.json()).toMatchObject({ preview: { coverLetter: esperada } });

    const candidatura = (await pedir('POST', `/jobs/${match.id}/apply`, dono)).json<{
      id: string;
    }>();
    const salva = await prisma.application.findUniqueOrThrow({ where: { id: candidatura.id } });
    expect(salva.coverLetter).toBe(esperada);
  });

  it('responde 404 para a vaga de outro usuário', async () => {
    const { match } = await umaVaga();

    expect((await pedir('GET', `/jobs/${match.id}`, outro)).statusCode).toBe(404);
    expect((await pedir('POST', `/jobs/${match.id}/apply`, outro)).statusCode).toBe(404);
  });

  it('candidatar-se entra na fila, dentro do limite diário do perfil', async () => {
    const { match } = await umaVaga();

    const res = await pedir('POST', `/jobs/${match.id}/apply`, dono);
    expect(res.statusCode).toBe(201);
    const candidatura = res.json<{ id: string }>();
    expect(candidatura).toMatchObject({ status: 'queued' });
    expect(vi.mocked(reserveDailySlot).mock.lastCall?.slice(1)).toEqual([
      expect.objectContaining({ userId: dono.id, sourceId }),
      10,
    ]);
    expect(vi.mocked(enqueueApplication)).toHaveBeenCalledWith(candidatura.id);

    const lista = await pedir('GET', '/jobs', dono);
    const item = lista
      .json<{ items: { id: string; application: unknown }[] }>()
      .items.find((i) => i.id === match.id);
    expect(item?.application).toEqual({ id: candidatura.id, status: 'queued' });
  });

  it('não se candidata duas vezes à mesma vaga', async () => {
    const { match } = await umaVaga();

    await pedir('POST', `/jobs/${match.id}/apply`, dono);
    const segunda = await pedir('POST', `/jobs/${match.id}/apply`, dono);
    expect(segunda.statusCode).toBe(409);
    expect(segunda.json()).toEqual({ error: 'already_applied' });
  });

  it('aprova a candidatura que o match deixou sugerida', async () => {
    const { match, job, resume } = await umaVaga();
    const versao = await prisma.resumeVersion.findFirstOrThrow({ where: { resumeId: resume.id } });
    const sugerida = await prisma.application.create({
      data: {
        userId: dono.id,
        jobId: job.id,
        sourceId,
        resumeVersionId: versao.id,
        mode: 'assisted',
        status: 'suggested',
      },
    });

    const res = await pedir('POST', `/jobs/${match.id}/apply`, dono);
    expect(res.json()).toEqual({ id: sugerida.id, status: 'queued' });
  });

  it('com o limite diário atingido, não cria a candidatura', async () => {
    const { match, job } = await umaVaga();
    vi.mocked(reserveDailySlot).mockResolvedValue(false);

    const res = await pedir('POST', `/jobs/${match.id}/apply`, dono);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'daily_limit_reached' });
    expect(await prisma.application.count({ where: { jobId: job.id } })).toBe(0);
    expect(vi.mocked(releaseDailySlot)).not.toHaveBeenCalled();
  });

  it('sem regra de envio para o site, pede para configurar uma', async () => {
    const { match } = await umaVaga({ comRegra: false });

    const res = await pedir('POST', `/jobs/${match.id}/apply`, dono);
    expect(res.json()).toEqual({ error: 'send_rule_required' });
  });

  it('sem arquivo no currículo da regra, pede para enviar um', async () => {
    const { match } = await umaVaga({ comArquivo: false });

    const res = await pedir('POST', `/jobs/${match.id}/apply`, dono);
    expect(res.json()).toEqual({ error: 'resume_file_required' });
  });

  it('"não tenho interesse" tira a vaga da lista e guarda o motivo', async () => {
    const { match } = await umaVaga();

    const res = await pedir('POST', `/jobs/${match.id}/dismiss`, dono, { reason: 'salary' });
    expect(res.statusCode).toBe(204);
    const salvo = await prisma.jobMatch.findUniqueOrThrow({ where: { id: match.id } });
    expect(salvo).toMatchObject({ dismissed: true, dismissedReason: 'salary' });
    const lista = await pedir('GET', '/jobs', dono);
    expect(lista.json<{ items: { id: string }[] }>().items.map((i) => i.id)).not.toContain(
      match.id,
    );
  });

  it('pode pôr a empresa na lista de exclusão do perfil, sem repetir', async () => {
    const { match, perfil } = await umaVaga();

    await pedir('POST', `/jobs/${match.id}/dismiss`, dono, {
      reason: 'company',
      blockCompany: true,
    });
    await pedir('POST', `/jobs/${match.id}/dismiss`, dono, {
      reason: 'company',
      blockCompany: true,
    });
    const atualizado = await prisma.searchProfile.findUniqueOrThrow({ where: { id: perfil.id } });
    expect(atualizado.companyBlacklist).toEqual(['Empresa X']);
  });

  it('recusa motivo que não existe', async () => {
    const { match } = await umaVaga();

    const res = await pedir('POST', `/jobs/${match.id}/dismiss`, dono, { reason: 'qualquer' });
    expect(res.statusCode).toBe(400);
  });
});
