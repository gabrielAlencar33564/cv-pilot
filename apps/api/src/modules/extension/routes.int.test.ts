import { prisma } from '@cv-pilot/db';
import { loadResumeFile } from '@cv-pilot/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, uniqueId, type TestUser } from '../../test/db';

// storage falso: o teste cobre a rota, o token e o banco; a cifra tem os testes do @cv-pilot/storage
vi.mock('@cv-pilot/storage', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  loadResumeFile: vi.fn(),
}));

const PDF = Buffer.from('%PDF-1.7\ncurrículo sintético para teste');

describe('extensão do navegador: chaves e modo assistido (ADR 0010)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let dono: TestUser;
  let outro: TestUser;
  const sourceId = uniqueId('fonte');
  const jobIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
    [dono, outro] = [await signUpTestUser(app), await signUpTestUser(app)];
    await prisma.source.create({
      data: { id: sourceId, displayName: 'Site de teste', kind: 'api', applyModes: ['assisted'] },
    });
    vi.mocked(loadResumeFile).mockResolvedValue(PDF);
  });

  // cada teste cria as próprias chaves, sem esbarrar no limite por conta
  beforeEach(async () => {
    await prisma.extensionToken.deleteMany({ where: { userId: { in: [dono.id, outro.id] } } });
  });

  afterAll(async () => {
    await deleteTestUsers(dono.id, outro.id);
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.source.delete({ where: { id: sourceId } });
    await app.close();
  });

  async function umaChave(usuario: TestUser, name = 'Chrome de casa') {
    const res = await app.inject({
      method: 'POST',
      url: '/extension-tokens',
      headers: usuario.headers,
      payload: { name },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ id: string; token: string; prefix: string }>();
  }

  const daExtensao = (token: string, method: 'GET' | 'POST', url: string) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${token}` } });

  async function umaCandidatura(usuario: TestUser, status: string) {
    const job = await prisma.job.create({
      data: {
        dedupeHash: uniqueId('hash'),
        title: 'Dev React',
        company: 'Empresa X',
        description: '',
        sources: {
          create: { sourceId, externalId: uniqueId('ext'), url: 'https://vagas.exemplo.test/1' },
        },
      },
    });
    jobIds.push(job.id);
    const resume = await prisma.resume.create({
      data: {
        userId: usuario.id,
        name: 'CV Técnico',
        versions: {
          create: { version: 2, storageKey: 'x', fileName: 'cv.pdf', mimeType: 'application/pdf' },
        },
      },
      include: { versions: true },
    });
    return prisma.application.create({
      data: {
        userId: usuario.id,
        jobId: job.id,
        sourceId,
        resumeVersionId: resume.versions[0]?.id ?? '',
        mode: 'assisted',
        status,
        coverLetter: 'Olá, Empresa X!',
        answers: { 'Pretensão salarial': '8000' },
      },
    });
  }

  it('cria a chave, mostra o token uma vez e guarda só o hash', async () => {
    const chave = await umaChave(dono);
    expect(chave.token).toMatch(/^cvp_ext_[\w-]{43}$/);
    expect(chave.prefix).toBe(chave.token.slice(0, 12));

    const salva = await prisma.extensionToken.findUniqueOrThrow({ where: { id: chave.id } });
    expect(salva.tokenHash).not.toContain(chave.token);
    const lista = await app.inject({ url: '/extension-tokens', headers: dono.headers });
    expect(lista.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: chave.id, prefix: chave.prefix })]),
    );
    expect(lista.body).not.toContain(chave.token);
  });

  it('a extensão lê o perfil e as candidaturas em "Ação necessária" do dono da chave', async () => {
    const { token } = await umaChave(dono);
    const pendente = await umaCandidatura(dono, 'needs_action');
    await umaCandidatura(dono, 'suggested');
    await umaCandidatura(outro, 'needs_action');

    const perfil = await daExtensao(token, 'GET', '/extension/me');
    expect(perfil.json()).toMatchObject({ email: dono.email, name: 'Pessoa de Teste' });

    const res = await daExtensao(token, 'GET', '/extension/applications');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      {
        id: pendente.id,
        url: 'https://vagas.exemplo.test/1',
        job: { title: 'Dev React', company: 'Empresa X' },
        source: { displayName: 'Site de teste' },
        coverLetter: 'Olá, Empresa X!',
        coverLetterStatus: null,
        answers: { 'Pretensão salarial': '8000' },
        resume: { name: 'CV Técnico', version: 2, fileName: 'cv.pdf', mimeType: 'application/pdf' },
      },
    ]);
  });

  it('entrega o currículo decifrado só da candidatura pendente do dono', async () => {
    const { token } = await umaChave(dono);
    const pendente = await umaCandidatura(dono, 'needs_action');
    const enviada = await umaCandidatura(dono, 'sent');
    const deOutro = await umaCandidatura(outro, 'needs_action');

    const arquivo = await daExtensao(token, 'GET', `/extension/applications/${pendente.id}/resume`);
    expect(arquivo.statusCode).toBe(200);
    expect(arquivo.headers['content-type']).toBe('application/pdf');
    expect(arquivo.headers['cache-control']).toBe('private, no-store');
    expect(arquivo.rawPayload.equals(PDF)).toBe(true);

    for (const { id } of [enviada, deOutro]) {
      const res = await daExtensao(token, 'GET', `/extension/applications/${id}/resume`);
      expect(res.statusCode).toBe(404);
    }
  });

  it('marca como enviada, com a data e o histórico', async () => {
    const { token } = await umaChave(dono);
    const pendente = await umaCandidatura(dono, 'needs_action');

    const res = await daExtensao(token, 'POST', `/extension/applications/${pendente.id}/sent`);
    expect(res.json()).toEqual({ id: pendente.id, status: 'sent' });
    const salva = await prisma.application.findUniqueOrThrow({ where: { id: pendente.id } });
    expect(salva.sentAt).toBeInstanceOf(Date);
    expect(salva.log).toEqual([
      expect.objectContaining({ type: 'status_changed', from: 'needs_action', to: 'sent' }),
    ]);

    const deNovo = await daExtensao(token, 'POST', `/extension/applications/${pendente.id}/sent`);
    expect(deNovo.statusCode).toBe(200);
    const deOutro = await umaCandidatura(outro, 'needs_action');
    const alheia = await daExtensao(token, 'POST', `/extension/applications/${deOutro.id}/sent`);
    expect(alheia.statusCode).toBe(404);
  });

  it('o token só abre as rotas da extensão, e o cookie do login não abre elas', async () => {
    const { token } = await umaChave(dono);

    const comToken = await app.inject({
      url: '/applications',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(comToken.statusCode).toBe(401);
    const comCookie = await app.inject({ url: '/extension/applications', headers: dono.headers });
    expect(comCookie.statusCode).toBe(401);
    expect((await daExtensao('cvp_ext_inventado', 'GET', '/extension/me')).statusCode).toBe(401);
  });

  it('desconectar a chave corta a extensão na hora', async () => {
    const chave = await umaChave(dono);

    const res = await app.inject({
      method: 'DELETE',
      url: `/extension-tokens/${chave.id}`,
      headers: dono.headers,
    });
    expect(res.statusCode).toBe(204);
    expect((await daExtensao(chave.token, 'GET', '/extension/me')).statusCode).toBe(401);
  });

  it('não apaga a chave de outra pessoa', async () => {
    const chave = await umaChave(dono);

    const res = await app.inject({
      method: 'DELETE',
      url: `/extension-tokens/${chave.id}`,
      headers: outro.headers,
    });
    expect(res.statusCode).toBe(404);
  });

  it('limita as chaves por conta', async () => {
    const usuario = await signUpTestUser(app);
    for (let i = 0; i < 5; i++) await umaChave(usuario, `Navegador ${i}`);

    const sexta = await app.inject({
      method: 'POST',
      url: '/extension-tokens',
      headers: usuario.headers,
      payload: { name: 'Mais um' },
    });
    expect(sexta.statusCode).toBe(409);
    expect(sexta.json()).toEqual({ error: 'extension_token_limit' });
    await deleteTestUsers(usuario.id);
  });

  it('sem o aceite dos termos atuais, a extensão também para (403)', async () => {
    const usuario = await signUpTestUser(app);
    const { token } = await umaChave(usuario);
    await prisma.consentLog.deleteMany({ where: { userId: usuario.id } });

    const res = await daExtensao(token, 'GET', '/extension/applications');
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'consent_required' });
    await deleteTestUsers(usuario.id);
  });
});
