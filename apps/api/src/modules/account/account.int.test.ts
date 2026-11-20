import { prisma } from '@cv-pilot/db';
import { deleteResumeFile, loadResumeFile } from '@cv-pilot/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app';
import { TEST_PASSWORD, deleteTestUsers, signUpTestUser, type TestUser } from '../../test/db';

// storage falso: o teste cobre a rota e o banco; o S3 real é validado no dev
vi.mock('@cv-pilot/storage', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  loadResumeFile: vi.fn(),
  deleteResumeFile: vi.fn(),
}));

const PDF = Buffer.from('%PDF-1.7 currículo sintético');

describe('conta do usuário (RF-02, RF-04)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const criados: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await deleteTestUsers(...criados);
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function novoUsuario(): Promise<TestUser> {
    const usuario = await signUpTestUser(app);
    criados.push(usuario.id);
    return usuario;
  }

  /** Currículo com uma versão já gravada (o arquivo em si fica no storage falso). */
  async function comCurriculo(usuario: TestUser) {
    const resume = await prisma.resume.create({
      data: {
        userId: usuario.id,
        name: 'CV Técnico',
        versions: {
          create: {
            version: 1,
            storageKey: `${usuario.id}/cv/1-x.pdf`,
            fileName: 'Currículo.pdf',
            mimeType: 'application/pdf',
          },
        },
      },
      include: { versions: true },
    });
    return { resumeId: resume.id, versionId: resume.versions[0]?.id ?? '' };
  }

  it('atualiza o perfil base e devolve os links validados', async () => {
    const usuario = await novoUsuario();

    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: usuario.headers,
      payload: {
        name: 'Ana Exemplo',
        city: 'São Paulo',
        links: { github: 'https://github.com/exemplo' },
        salaryExpectation: 9000,
        availability: '30 dias',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      name: 'Ana Exemplo',
      city: 'São Paulo',
      links: { github: 'https://github.com/exemplo' },
      salaryExpectation: 9000,
    });
  });

  it('recusa link que não é URL', async () => {
    const usuario = await novoUsuario();

    const res = await app.inject({
      method: 'PATCH',
      url: '/me',
      headers: usuario.headers,
      payload: { name: 'Ana', links: { linkedin: 'não é url' } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('exporta os dados da conta sem o hash da senha nem os tokens de sessão', async () => {
    const usuario = await novoUsuario();
    const { resumeId, versionId } = await comCurriculo(usuario);
    await prisma.notification.create({
      data: {
        userId: usuario.id,
        kind: 'new_jobs',
        dedupeKey: 'new_jobs_2026-11-19',
        data: { count: 2, day: '2026-11-19' },
      },
    });
    await prisma.companySuggestion.create({
      data: { userId: usuario.id, url: 'https://empresa.test/carreiras' },
    });

    const res = await app.inject({ method: 'GET', url: '/me/export', headers: usuario.headers });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="cvpilot-meus-dados-/,
    );
    const dados = res.json<Record<string, unknown>>();
    expect(dados).toMatchObject({
      email: usuario.email,
      consents: [expect.objectContaining({ termsVersion: expect.any(String) as string })],
      resumes: [
        expect.objectContaining({
          versions: [
            expect.objectContaining({ file: `/resumes/${resumeId}/versions/${versionId}/file` }),
          ],
        }),
      ],
      notifications: [
        expect.objectContaining({ kind: 'new_jobs', data: { count: 2, day: '2026-11-19' } }),
      ],
      companySuggestions: [
        expect.objectContaining({ url: 'https://empresa.test/carreiras', status: 'pending' }),
      ],
    });
    const texto = res.body;
    expect(texto).not.toContain('"password"');
    expect(texto).not.toContain('"token"');
  });

  it('serve o arquivo do currículo decifrado só para o dono', async () => {
    const dono = await novoUsuario();
    const outro = await novoUsuario();
    const { resumeId, versionId } = await comCurriculo(dono);
    vi.mocked(loadResumeFile).mockResolvedValue(PDF);
    const url = `/resumes/${resumeId}/versions/${versionId}/file`;

    const doDono = await app.inject({ method: 'GET', url, headers: dono.headers });
    expect(doDono.statusCode).toBe(200);
    expect(doDono.headers['content-type']).toBe('application/pdf');
    expect(doDono.headers['cache-control']).toBe('private, no-store');
    expect(doDono.rawPayload.equals(PDF)).toBe(true);

    const deOutro = await app.inject({ method: 'GET', url, headers: outro.headers });
    expect(deOutro.statusCode).toBe(404);
  });

  it('não exclui a conta sem a senha', async () => {
    const usuario = await novoUsuario();

    const res = await app.inject({
      method: 'POST',
      url: '/auth/delete-user',
      headers: usuario.headers,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'PASSWORD_REQUIRED' });
    expect(await prisma.user.count({ where: { id: usuario.id } })).toBe(1);
  });

  it('não exclui a conta com a senha errada', async () => {
    const usuario = await novoUsuario();

    const res = await app.inject({
      method: 'POST',
      url: '/auth/delete-user',
      headers: usuario.headers,
      payload: { password: 'senha-errada-1' },
    });
    expect(res.statusCode).toBe(400);
    expect(await prisma.user.count({ where: { id: usuario.id } })).toBe(1);
  });

  it('com a senha, apaga os arquivos no S3 e a conta inteira', async () => {
    const usuario = await novoUsuario();
    const { resumeId } = await comCurriculo(usuario);
    await prisma.notification.create({
      data: { userId: usuario.id, kind: 'new_jobs', dedupeKey: 'x', data: { count: 1, day: 'x' } },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/delete-user',
      headers: usuario.headers,
      payload: { password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    expect(vi.mocked(deleteResumeFile)).toHaveBeenCalledWith(`${usuario.id}/cv/1-x.pdf`);
    expect(await prisma.user.count({ where: { id: usuario.id } })).toBe(0);
    expect(await prisma.resume.count({ where: { id: resumeId } })).toBe(0);
    expect(await prisma.consentLog.count({ where: { userId: usuario.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: usuario.id } })).toBe(0);
  });

  it('se apagar um arquivo falhar, a conta fica como estava', async () => {
    const usuario = await novoUsuario();
    await comCurriculo(usuario);
    vi.mocked(deleteResumeFile).mockRejectedValue(new Error('storage fora do ar'));

    const res = await app.inject({
      method: 'POST',
      url: '/auth/delete-user',
      headers: usuario.headers,
      payload: { password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    expect(await prisma.user.count({ where: { id: usuario.id } })).toBe(1);
  });
});
