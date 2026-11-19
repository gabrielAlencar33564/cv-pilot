import { randomUUID } from 'node:crypto';
import { prisma } from '@cv-pilot/db';
import { enqueue } from '@cv-pilot/queue';
import { storeResumeFile } from '@cv-pilot/storage';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, type TestUser } from '../../test/db';

// storage e fila falsos: o teste cobre a rota e o banco; o S3 real é validado no dev
vi.mock('@cv-pilot/storage', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  storeResumeFile: vi.fn(),
  deleteResumeFile: vi.fn(),
}));
vi.mock('@cv-pilot/queue', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  enqueue: vi.fn(),
}));

const PDF = Buffer.from('%PDF-1.7\ncurrículo sintético para teste');
const SEIS_MB = 6 * 1024 * 1024;

/** Corpo multipart/form-data com um arquivo no campo `file`. */
function comArquivo(fileName: string, content: Buffer) {
  const boundary = `cvpilot-${randomUUID()}`;
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        'Content-Type: application/octet-stream\r\n\r\n',
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

describe('upload de currículo', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let dono: TestUser;
  let outro: TestUser;
  let resumeId: string;

  beforeAll(async () => {
    app = await buildApp();
    [dono, outro] = [await signUpTestUser(app), await signUpTestUser(app)];
    resumeId = (await prisma.resume.create({ data: { userId: dono.id, name: 'CV Técnico' } })).id;
  });

  afterAll(async () => {
    await deleteTestUsers(dono.id, outro.id);
    await app.close();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await prisma.resumeVersion.deleteMany({ where: { resumeId } });
  });

  const enviar = (usuario: TestUser, arquivo: ReturnType<typeof comArquivo>) =>
    app.inject({
      method: 'POST',
      url: `/resumes/${resumeId}/versions`,
      payload: arquivo.payload,
      headers: { ...arquivo.headers, ...usuario.headers },
    });

  it('grava a versão 1, cifra no storage e enfileira a extração', async () => {
    const res = await enviar(dono, comArquivo('Maria_CV.pdf', PDF));

    expect(res.statusCode).toBe(201);
    const versao = res.json<{ id: string }>();
    expect(versao).toMatchObject({
      version: 1,
      fileName: 'Maria_CV.pdf',
      mimeType: 'application/pdf',
      parseStatus: 'pending',
    });
    expect(versao).not.toHaveProperty('storageKey');
    expect(vi.mocked(storeResumeFile)).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${dono.id}/${resumeId}/1-[0-9a-f-]+\\.pdf$`)),
      PDF,
    );
    expect(vi.mocked(enqueue)).toHaveBeenCalledWith(
      'resume-parse',
      { resumeVersionId: versao.id },
      { jobId: `resume-parse_${versao.id}` },
    );
  });

  it('numera as versões seguintes', async () => {
    await enviar(dono, comArquivo('v1.pdf', PDF));
    const res = await enviar(dono, comArquivo('v2.pdf', PDF));

    expect(res.json()).toMatchObject({ version: 2 });
  });

  it('guarda só o nome do arquivo, sem o caminho enviado pelo navegador', async () => {
    const res = await enviar(dono, comArquivo('C:\\fakepath\\cv.pdf', PDF));

    expect(res.json()).toMatchObject({ fileName: 'cv.pdf' });
  });

  it('recusa arquivo que não é PDF nem DOCX, mesmo com a extensão .pdf', async () => {
    const res = await enviar(dono, comArquivo('falso.pdf', Buffer.from('<html></html>')));

    expect(res.statusCode).toBe(415);
    expect(res.json()).toEqual({ error: 'unsupported_file_type' });
    expect(vi.mocked(storeResumeFile)).not.toHaveBeenCalled();
  });

  it('responde 404 para o currículo de outro usuário, sem gravar nada', async () => {
    const res = await enviar(outro, comArquivo('cv.pdf', PDF));

    expect(res.statusCode).toBe(404);
    expect(vi.mocked(storeResumeFile)).not.toHaveBeenCalled();
    expect(await prisma.resumeVersion.count({ where: { resumeId } })).toBe(0);
  });

  it('recusa arquivo acima de 5 MB', async () => {
    const res = await enviar(
      dono,
      comArquivo('grande.pdf', Buffer.concat([PDF, Buffer.alloc(SEIS_MB)])),
    );

    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ error: 'file_too_large' });
  });

  it('exige um arquivo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/resumes/${resumeId}/versions`,
      payload: { nada: true },
      headers: dono.headers,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'file_required' });
  });

  it('lista as versões com o status da extração, sem a chave do storage', async () => {
    await enviar(dono, comArquivo('cv.pdf', PDF));
    const res = await app.inject({
      method: 'GET',
      url: '/resumes',
      headers: dono.headers,
    });

    const [curriculo] = res.json<{ versions: Record<string, unknown>[] }[]>();
    expect(curriculo?.versions[0]).toMatchObject({ version: 1, parseStatus: 'pending' });
    expect(curriculo?.versions[0]).not.toHaveProperty('storageKey');
  });

  describe('perfis sugeridos pelo currículo (onboarding)', () => {
    const sugestoes = (usuario = dono) =>
      app.inject({
        method: 'GET',
        url: `/resumes/${resumeId}/profile-suggestions`,
        headers: usuario.headers,
      });

    const versao = (o: object) =>
      prisma.resumeVersion.create({
        data: {
          resumeId,
          version: 1,
          storageKey: 'x',
          fileName: 'cv.pdf',
          mimeType: 'application/pdf',
          ...o,
        },
      });

    it('sugere perfis a partir dos dados extraídos da última versão', async () => {
      const { id } = await versao({
        parseStatus: 'parsed',
        parsed: {
          summary: null,
          skills: ['React', 'TypeScript'],
          experiences: [
            {
              company: 'Empresa X',
              role: 'Desenvolvedora Front-end Pleno',
              start: '2023-01',
              end: null,
              description: null,
            },
          ],
          education: [],
          languages: [],
        },
      });

      const res = await sugestoes();
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        resumeId,
        versionId: id,
        suggestions: [
          {
            name: 'Desenvolvedora Front-end Pleno',
            keywords: ['Desenvolvedora Front-end', 'React', 'TypeScript'],
            seniorities: ['mid'],
          },
        ],
      });
    });

    it('enquanto a extração não terminou, responde 409', async () => {
      await versao({ parseStatus: 'pending' });

      expect((await sugestoes()).json()).toEqual({ error: 'resume_not_parsed' });
    });

    it('responde 404 para o currículo de outro usuário', async () => {
      await versao({ parseStatus: 'parsed', parsed: {} });

      expect((await sugestoes(outro)).statusCode).toBe(404);
    });
  });
});
