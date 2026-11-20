import { prisma } from '@cv-pilot/db';
import { enqueue } from '@cv-pilot/queue';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app';
import { deleteTestUsers, signUpTestUser, uniqueId, type TestUser } from '../../test/db';

// fila falsa: o teste cobre a rota e o banco; o detector tem os testes do worker
vi.mock('@cv-pilot/queue', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  enqueue: vi.fn(),
}));

describe('empresas sugeridas ("Adicionar empresa")', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let dono: TestUser;
  let outro: TestUser;
  const sourceId = uniqueId('fonte');

  beforeAll(async () => {
    app = await buildApp();
    [dono, outro] = [await signUpTestUser(app), await signUpTestUser(app)];
    await prisma.source.create({
      data: { id: sourceId, displayName: 'ATS de teste', kind: 'api', applyModes: ['assisted'] },
    });
  });

  afterAll(async () => {
    await deleteTestUsers(dono.id, outro.id);
    // a cascata leva os boards da fonte
    await prisma.source.delete({ where: { id: sourceId } });
    await app.close();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await prisma.companySuggestion.deleteMany({ where: { userId: { in: [dono.id, outro.id] } } });
  });

  const sugerir = (usuario: TestUser, url: unknown) =>
    app.inject({
      method: 'POST',
      url: '/company-suggestions',
      headers: usuario.headers,
      payload: { url },
    });

  it('registra a página e manda o detector rodar no worker', async () => {
    const res = await sugerir(dono, ' https://empresa.test/carreiras ');

    expect(res.statusCode).toBe(202);
    const sugestao = res.json<{ id: string }>();
    expect(sugestao).toMatchObject({
      url: 'https://empresa.test/carreiras',
      status: 'pending',
      boardToken: null,
    });
    expect(enqueue).toHaveBeenCalledWith(
      'company-detect',
      { suggestionId: sugestao.id },
      { jobId: `company_detect_${sugestao.id}` },
    );
  });

  it.each([
    ['texto que não é endereço', 'empresa'],
    ['outro protocolo', 'ftp://empresa.test/'],
    ['sem endereço', undefined],
  ])('recusa %s com 400', async (_caso, url) => {
    expect((await sugerir(dono, url)).statusCode).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('lista só as sugestões do próprio usuário, com a empresa que entrou no catálogo', async () => {
    const board = await prisma.careerBoard.create({ data: { sourceId, token: 'empresa' } });
    await prisma.companySuggestion.create({
      data: {
        userId: dono.id,
        url: 'https://ats.test/empresa',
        status: 'added',
        sourceId,
        careerBoardId: board.id,
      },
    });
    await sugerir(outro, 'https://outra.test/vagas');

    const lista = await app.inject({
      method: 'GET',
      url: '/company-suggestions',
      headers: dono.headers,
    });
    expect(lista.json()).toEqual([
      expect.objectContaining({ status: 'added', sourceId, boardToken: 'empresa' }),
    ]);
  });

  it('passa de 20 sugestões em 24 h: 429, sem visitar mais sites', async () => {
    await prisma.companySuggestion.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({
        userId: dono.id,
        url: `https://empresa${i}.test/`,
      })),
    });

    const res = await sugerir(dono, 'https://mais-uma.test/');
    expect(res.statusCode).toBe(429);
    expect(res.json()).toMatchObject({ error: 'suggestion_limit_reached' });
    expect(enqueue).not.toHaveBeenCalled();
  });
});
