import {
  SourceBlockedError,
  SourceHttpError,
  UnsafeUrlError,
  createPoliteFetch,
  getAdapter,
  type JobSourceAdapter,
} from '@cv-pilot/adapters';
import type { QueuePayloads } from '@cv-pilot/queue';
import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { companyDetectProcessor } from './company-detect';

const db = vi.hoisted(() => ({
  companySuggestion: { findUnique: vi.fn(), update: vi.fn() },
  source: { findUnique: vi.fn() },
  careerBoard: { upsert: vi.fn() },
}));
vi.mock('@cv-pilot/db', () => ({ prisma: db }));
vi.mock('@cv-pilot/queue', () => ({ getRedis: vi.fn() }));
vi.mock('../host-throttle', () => ({ createHostThrottle: vi.fn() }));
vi.mock('../robots-cache', () => ({ createRobotsCache: vi.fn() }));
vi.mock('../source-context', () => ({ sourceContext: vi.fn(() => ({})) }));
// o reconhecimento de URL e a leitura do HTML são os de verdade; só a rede é falsa
vi.mock('@cv-pilot/adapters', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createPoliteFetch: vi.fn(),
  getAdapter: vi.fn(),
}));

const paginaDaEmpresa = vi.fn();
const fetchDoBoard = vi.fn();

// em teste, o job do BullMQ é montado à mão
const umJob = (o: Partial<Job> = {}) =>
  ({ data: { suggestionId: 'sugestao-1' }, attemptsMade: 0, opts: { attempts: 4 }, ...o }) as Job<
    QueuePayloads['company-detect']
  >;

const sugestao = (url: string) =>
  db.companySuggestion.findUnique.mockResolvedValue({ url, status: 'pending' });
const gravado = () => db.companySuggestion.update.mock.lastCall?.[0] as { data: object };

describe('companyDetectProcessor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createPoliteFetch).mockReturnValue(paginaDaEmpresa);
    vi.mocked(getAdapter).mockReturnValue({
      fetch: fetchDoBoard,
    } as unknown as JobSourceAdapter<unknown>);
    // um board que existe: a primeira vaga vem
    fetchDoBoard.mockImplementation(async function* () {
      yield { id: 1 };
    });
    db.source.findUnique.mockResolvedValue({ rateLimitReqs: 30, rateLimitMs: 60_000 });
    db.careerBoard.upsert.mockResolvedValue({ id: 'board-1' });
  });

  it('link direto do ATS: confere o board e inclui a empresa no catálogo, sem abrir página', async () => {
    sugestao('https://jobs.lever.co/leverdemo');

    await expect(companyDetectProcessor(umJob())).resolves.toMatchObject({ status: 'added' });
    expect(paginaDaEmpresa).not.toHaveBeenCalled();
    expect(fetchDoBoard).toHaveBeenCalledWith('leverdemo', expect.anything());
    expect(db.careerBoard.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceId_token: { sourceId: 'lever', token: 'leverdemo' } },
        // um board que o admin desligou continua desligado
        update: {},
      }),
    );
    expect(gravado()).toEqual({
      where: { id: 'sugestao-1' },
      data: { status: 'added', sourceId: 'lever', careerBoardId: 'board-1' },
    });
  });

  it('página da própria empresa: acha o embed do ATS no HTML, com a guarda ligada', async () => {
    sugestao('https://empresa.com.br/carreiras');
    paginaDaEmpresa.mockResolvedValue(
      new Response('<script src="https://boards.greenhouse.io/embed/job_board/js?for=empresa">'),
    );

    await expect(companyDetectProcessor(umJob())).resolves.toMatchObject({
      status: 'added',
      sourceId: 'greenhouse',
    });
    expect(paginaDaEmpresa).toHaveBeenCalledWith('https://empresa.com.br/carreiras', {
      headers: { Accept: 'text/html' },
    });
    const opcoes = vi.mocked(createPoliteFetch).mock.calls[0]?.[0];
    expect(opcoes?.guard).toBeTypeOf('function');
  });

  it('empresa na Gupy já é coberta pela busca por palavra-chave', async () => {
    sugestao('https://empresa.gupy.io/');

    await companyDetectProcessor(umJob());
    expect(gravado().data).toEqual({ status: 'covered', sourceId: 'gupy' });
    expect(db.careerBoard.upsert).not.toHaveBeenCalled();
  });

  it('página sem ATS conhecido fica como não detectada', async () => {
    sugestao('https://empresa.com.br/carreiras');
    paginaDaEmpresa.mockResolvedValue(new Response('<a href="mailto:rh@empresa.com.br">RH</a>'));

    await companyDetectProcessor(umJob());
    expect(gravado().data).toEqual({ status: 'not_detected' });
  });

  it('board que não existe no ATS (404) não entra no catálogo', async () => {
    sugestao('https://jobs.lever.co/naoexiste');
    fetchDoBoard.mockImplementation(async function* () {
      yield* [];
      throw new SourceHttpError(404, 'https://api.lever.co/v0/postings/naoexiste');
    });

    await companyDetectProcessor(umJob());
    expect(gravado().data).toEqual({ status: 'not_detected', sourceId: 'lever' });
    expect(db.careerBoard.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ['endereço interno', new UnsafeUrlError('10.0.0.5')],
    ['site que bloqueia o bot', new SourceBlockedError('empresa.com.br')],
  ])('%s fica inacessível e não é repetido', async (_caso, erro) => {
    sugestao('https://empresa.com.br/carreiras');
    paginaDaEmpresa.mockRejectedValue(erro);

    await expect(companyDetectProcessor(umJob())).resolves.toEqual({ status: 'unreachable' });
  });

  it('falha temporária repete; na última tentativa, marca como inacessível', async () => {
    sugestao('https://empresa.com.br/carreiras');
    const erro = new Error('ECONNRESET');
    paginaDaEmpresa.mockRejectedValue(erro);

    await expect(companyDetectProcessor(umJob())).rejects.toBe(erro);
    expect(db.companySuggestion.update).not.toHaveBeenCalled();

    await expect(companyDetectProcessor(umJob({ attemptsMade: 3 }))).rejects.toBe(erro);
    expect(gravado().data).toEqual({ status: 'unreachable' });
  });

  it('a segunda execução do mesmo job não analisa de novo', async () => {
    db.companySuggestion.findUnique.mockResolvedValue({
      url: 'https://jobs.lever.co/x',
      status: 'added',
    });

    await expect(companyDetectProcessor(umJob())).resolves.toEqual({ skipped: true });
    expect(fetchDoBoard).not.toHaveBeenCalled();
  });
});
