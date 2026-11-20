import { MANUAL_SOURCE_ID } from '@cv-pilot/contracts';
import { jobDedupeHash } from '@cv-pilot/core';
import { prisma } from '@cv-pilot/db';
import { enqueueCoverLetter } from '@cv-pilot/queue';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, uniqueId, type TestUser } from '../../test/db';

// fila falsa: o teste cobre a rota e o banco; o worker da carta tem os próprios testes
vi.mock('@cv-pilot/queue', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  enqueueCoverLetter: vi.fn(),
}));

describe('extensão: banco de respostas e vaga salva de qualquer site (ADR 0011)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let dono: TestUser;
  let token: string;
  const jobIds: string[] = [];
  const sourceIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
    dono = await signUpTestUser(app);
    const chave = await app.inject({
      method: 'POST',
      url: '/extension-tokens',
      headers: dono.headers,
      payload: { name: 'Chrome' },
    });
    token = chave.json<{ token: string }>().token;
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await prisma.sendRule.deleteMany({ where: { userId: dono.id } });
    await prisma.savedAnswer.deleteMany({ where: { userId: dono.id } });
  });

  afterAll(async () => {
    // usuário (e candidaturas), depois vagas (e as fontes delas), por fim as fontes de teste
    await deleteTestUsers(dono.id);
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.source.deleteMany({ where: { id: { in: sourceIds } } });
    await app.close();
  });

  const daExtensao = (method: 'GET' | 'POST', url: string, payload?: object) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${token}` },
      ...(payload ? { payload } : {}),
    });

  /** Regra padrão com um currículo que já tem arquivo, e a carta pela IA se pedido. */
  async function regraPadrao({ cartaPorIa = false } = {}) {
    const resume = await prisma.resume.create({
      data: {
        userId: dono.id,
        name: 'CV Geral',
        versions: {
          create: { version: 1, storageKey: 'x', fileName: 'cv.pdf', mimeType: 'application/pdf' },
        },
      },
      include: { versions: true },
    });
    await prisma.sendRule.create({
      data: {
        userId: dono.id,
        resumeId: resume.id,
        generateCoverLetter: cartaPorIa,
        defaultAnswers: { 'Possui CNH?': 'Sim' },
      },
    });
    return resume.versions[0]?.id;
  }

  const vagaDaPagina = () => ({
    url: `https://vagas.exemplo.test/${uniqueId('vaga')}#candidatar`,
    title: `Dev React ${uniqueId('cargo')}`,
    company: 'Empresa Qualquer',
    location: 'Remoto',
    description: 'Vaga de React.',
  });

  it('perguntas novas entram no banco sem resposta; as repetidas só contam mais uma vez', async () => {
    const primeira = await daExtensao('POST', '/extension/questions', {
      questions: ['Aceita viajar?', 'Possui CNH? *', 'aceita viajar'],
    });
    expect(primeira.json()).toEqual({ pending: 2 });

    await prisma.savedAnswer.updateMany({
      where: { userId: dono.id, questionKey: 'possui cnh' },
      data: { answer: 'Sim, categoria B' },
    });
    const segunda = await daExtensao('POST', '/extension/questions', {
      questions: ['POSSUI CNH?', 'Aceita viajar?'],
    });
    expect(segunda.json()).toEqual({ pending: 1 });

    const salvas = await prisma.savedAnswer.findMany({
      where: { userId: dono.id },
      orderBy: { questionKey: 'asc' },
    });
    expect(salvas.map((s) => [s.question, s.timesSeen])).toEqual([
      ['Aceita viajar?', 2],
      ['Possui CNH? *', 2],
    ]);
  });

  it('a extensão recebe só as perguntas respondidas', async () => {
    await prisma.savedAnswer.createMany({
      data: [
        { userId: dono.id, question: 'Possui CNH?', questionKey: 'possui cnh', answer: 'Sim' },
        { userId: dono.id, question: 'Aceita viajar?', questionKey: 'aceita viajar' },
      ],
    });

    expect((await daExtensao('GET', '/extension/answers')).json()).toEqual({
      'Possui CNH?': 'Sim',
    });
  });

  it('recusa formulário com perguntas demais', async () => {
    const questions = Array.from({ length: 31 }, (_, i) => `Pergunta número ${i}`);

    expect((await daExtensao('POST', '/extension/questions', { questions })).statusCode).toBe(400);
  });

  it('salvar a vaga da página cria a candidatura em "Ação necessária" com a regra padrão', async () => {
    const versaoId = await regraPadrao();
    const vaga = vagaDaPagina();

    const res = await daExtensao('POST', '/extension/jobs', vaga);
    expect(res.statusCode).toBe(201);
    const { applicationId } = res.json<{ applicationId: string }>();
    const salva = await prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      include: { job: { include: { sources: true } } },
    });
    jobIds.push(salva.jobId);
    expect(salva).toMatchObject({
      status: 'needs_action',
      mode: 'assisted',
      sourceId: MANUAL_SOURCE_ID,
      resumeVersionId: versaoId,
      answers: { 'Possui CNH?': 'Sim' },
      job: { title: vaga.title, company: 'Empresa Qualquer', location: 'Remoto', active: true },
    });
    expect(salva.job.sources).toEqual([
      expect.objectContaining({ sourceId: MANUAL_SOURCE_ID, url: vaga.url }),
    ]);

    const lista = await daExtensao('GET', '/extension/applications');
    expect(lista.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: applicationId, url: vaga.url })]),
    );
  });

  it('salvar de novo devolve a candidatura que já existe', async () => {
    await regraPadrao();
    const vaga = vagaDaPagina();

    const primeira = (await daExtensao('POST', '/extension/jobs', vaga)).json<{
      applicationId: string;
    }>();
    const segunda = await daExtensao('POST', '/extension/jobs', vaga);
    expect(segunda.statusCode).toBe(200);
    expect(segunda.json()).toEqual({ applicationId: primeira.applicationId, created: false });
    const { jobId } = await prisma.application.findUniqueOrThrow({
      where: { id: primeira.applicationId },
    });
    jobIds.push(jobId);
  });

  it('a vaga que já veio de um site é reaproveitada, com a fonte manual a mais', async () => {
    await regraPadrao();
    const vaga = vagaDaPagina();
    const sourceId = uniqueId('fonte');
    sourceIds.push(sourceId);
    await prisma.source.create({
      data: { id: sourceId, displayName: 'ATS', kind: 'api', applyModes: ['assisted'] },
    });
    const existente = await prisma.job.create({
      data: {
        dedupeHash: jobDedupeHash(vaga),
        title: vaga.title,
        company: vaga.company,
        location: 'Remoto',
        description: 'Descrição completa do ATS.',
        sources: { create: { sourceId, externalId: '1', url: 'https://ats.test/1' } },
      },
    });
    jobIds.push(existente.id);

    const { applicationId } = (await daExtensao('POST', '/extension/jobs', vaga)).json<{
      applicationId: string;
    }>();
    const salva = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(salva.jobId).toBe(existente.id);
    const job = await prisma.job.findUniqueOrThrow({
      where: { id: existente.id },
      include: { sources: true },
    });
    expect(job.description).toBe('Descrição completa do ATS.');
    expect(job.sources.map((s) => s.sourceId).sort()).toEqual([MANUAL_SOURCE_ID, sourceId].sort());
  });

  it('com a carta pela IA na regra, pede a carta ao worker', async () => {
    await regraPadrao({ cartaPorIa: true });

    const { applicationId } = (await daExtensao('POST', '/extension/jobs', vagaDaPagina())).json<{
      applicationId: string;
    }>();
    expect(vi.mocked(enqueueCoverLetter)).toHaveBeenCalledWith(applicationId);
    const { jobId } = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    jobIds.push(jobId);
  });

  it('sem regra de envio, pede para configurar uma', async () => {
    const res = await daExtensao('POST', '/extension/jobs', vagaDaPagina());

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'send_rule_required' });
  });

  it('a fonte manual fica fora da escolha de sites e do admin', async () => {
    await regraPadrao();
    const { applicationId } = (await daExtensao('POST', '/extension/jobs', vagaDaPagina())).json<{
      applicationId: string;
    }>();
    const { jobId } = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    jobIds.push(jobId);

    const fontes = await app.inject({ url: '/sources', headers: dono.headers });
    expect(fontes.json<{ id: string }[]>().map((s) => s.id)).not.toContain(MANUAL_SOURCE_ID);
  });
});
