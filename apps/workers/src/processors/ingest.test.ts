import {
  SourceBlockedError,
  SourceDisallowedError,
  SourceRateLimitedError,
  getAdapter,
  type JobSourceAdapter,
} from '@cv-pilot/adapters';
import type { NormalizedJob } from '@cv-pilot/contracts';
import { clearJobEmbedding } from '@cv-pilot/db';
import type { QueuePayloads } from '@cv-pilot/queue';
import { DelayedError, UnrecoverableError, type Job } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeMissing } from '../job-expiration';
import { enqueueMatch } from '../match-queue';
import { recordSourceRun } from '../source-runs';
import { ingestProcessor } from './ingest';

const db = vi.hoisted(() => ({
  careerBoard: { findUnique: vi.fn(), update: vi.fn() },
  source: { findUnique: vi.fn(), update: vi.fn() },
  searchProfile: { findMany: vi.fn() },
  job: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  jobSource: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
}));
vi.mock('@cv-pilot/db', () => ({
  prisma: db,
  clearJobEmbedding: vi.fn(),
  Prisma: { DbNull: 'DbNull' },
}));
vi.mock('@cv-pilot/queue', () => ({ getRedis: vi.fn() }));
vi.mock('@cv-pilot/adapters', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAdapter: vi.fn(),
}));
vi.mock('../match-queue', () => ({ enqueueMatch: vi.fn() }));
vi.mock('../job-expiration', () => ({ closeMissing: vi.fn() }));
vi.mock('../source-runs', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  recordSourceRun: vi.fn(),
}));

const AGORA = Date.parse('2026-11-19T12:00:00Z');
const moveToDelayed = vi.fn();
// em teste, o job do BullMQ é montado à mão
const umJob = (data: QueuePayloads['ingest']) =>
  ({ data, moveToDelayed }) as unknown as Job<QueuePayloads['ingest']>;
const jobDoBoard = umJob({ sourceId: 'greenhouse', careerBoardId: 'cb-1' });

const umaVaga = (o: Partial<NormalizedJob> = {}): NormalizedJob => ({
  sourceId: 'greenhouse',
  externalId: 'empresa:1',
  url: 'https://boards.greenhouse.io/empresa/jobs/1',
  title: 'Desenvolvedor React',
  company: 'Empresa X',
  location: 'São Paulo',
  description: 'Vaga com React e TypeScript.',
  ...o,
});

/** Adapter que devolve as vagas dadas, já normalizadas, ou falha com o erro. */
function adapterCom(vagas: NormalizedJob[] | Error) {
  const adapter: JobSourceAdapter<NormalizedJob> = {
    id: 'greenhouse',
    displayName: 'Greenhouse',
    kind: 'api',
    fetchBy: 'board',
    async *fetch() {
      if (vagas instanceof Error) throw vagas;
      yield* vagas;
    },
    normalize: (raw) => raw,
  };
  vi.mocked(getAdapter).mockReturnValue(adapter);
}

const perfil = (id: string, keywords: string[]) => ({
  id,
  keywords,
  excludeKeywords: [],
  workModels: [],
  seniorities: [],
  contractTypes: [],
  companyBlacklist: [],
  salaryMin: null,
  salaryMax: null,
  location: null,
});

const fonteGravada = () =>
  (db.source.update.mock.lastCall?.[0] as { data: Record<string, unknown> } | undefined)?.data;

describe('ingestProcessor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: AGORA });
    db.careerBoard.findUnique.mockResolvedValue({ id: 'cb-1', token: 'empresa', active: true });
    db.source.findUnique.mockResolvedValue({
      active: true,
      rateLimitMs: 60_000,
      rateLimitReqs: 30,
    });
    db.searchProfile.findMany.mockResolvedValue([
      perfil('perfil-react', ['react']),
      perfil('perfil-java', ['java']),
    ]);
    db.job.findUnique.mockResolvedValue(null);
    db.job.create.mockResolvedValue({ id: 'vaga-1' });
    db.jobSource.findUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('vaga nova vai para o match só dos perfis que podem casar com ela', async () => {
    adapterCom([umaVaga()]);

    await expect(ingestProcessor(jobDoBoard)).resolves.toEqual({
      found: 1,
      changed: 1,
      matches: 1,
    });
    expect(vi.mocked(enqueueMatch).mock.calls).toEqual([['vaga-1', 'perfil-react']]);
  });

  it('registra a execução com as contagens, para o admin', async () => {
    adapterCom([umaVaga()]);
    vi.mocked(closeMissing).mockResolvedValue({ closedSources: 2, closedJobs: 1 });

    await ingestProcessor(jobDoBoard);
    expect(recordSourceRun).toHaveBeenCalledWith({
      sourceId: 'greenhouse',
      careerBoardId: 'cb-1',
      target: 'empresa',
      startedAt: new Date(AGORA),
      status: 'success',
      found: 1,
      changed: 1,
      matches: 1,
      closed: 2,
    });
  });

  it('liga a vaga ao board e fecha as que sumiram dele', async () => {
    adapterCom([umaVaga()]);

    await ingestProcessor(jobDoBoard);
    expect(db.jobSource.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ careerBoardId: 'cb-1' }) as unknown,
        update: expect.objectContaining({ careerBoardId: 'cb-1', closedAt: null }) as unknown,
      }),
    );
    expect(vi.mocked(closeMissing)).toHaveBeenCalledWith(
      { careerBoardId: 'cb-1' },
      new Date(AGORA),
    );
    expect(db.careerBoard.update).toHaveBeenCalledWith({
      where: { id: 'cb-1' },
      data: { lastFetchedAt: new Date(AGORA), lastError: null },
    });
  });

  it('a mesma vaga de novo, sem mudança, não volta para o match', async () => {
    const vaga = umaVaga();
    adapterCom([vaga]);
    db.job.findUnique.mockResolvedValue({
      id: 'vaga-1',
      active: true,
      title: vaga.title,
      company: vaga.company,
      location: vaga.location,
      workModel: null,
      seniority: null,
      contractType: null,
      salaryMin: null,
      salaryMax: null,
      description: vaga.description,
      applyEmail: null,
      publishedAt: null,
    });
    db.jobSource.findUnique.mockResolvedValue({ closedAt: null });

    await expect(ingestProcessor(jobDoBoard)).resolves.toMatchObject({ changed: 0, matches: 0 });
    expect(db.job.update).not.toHaveBeenCalled();
    expect(enqueueMatch).not.toHaveBeenCalled();
  });

  it('descrição nova apaga o embedding e os requisitos da vaga, para o próximo match gerar outros', async () => {
    const vaga = umaVaga();
    adapterCom([{ ...vaga, description: 'Descrição nova, bem mais completa que a anterior.' }]);
    db.job.findUnique.mockResolvedValue({
      id: 'vaga-1',
      active: true,
      title: vaga.title,
      company: vaga.company,
      location: vaga.location,
      workModel: null,
      seniority: null,
      contractType: null,
      salaryMin: null,
      salaryMax: null,
      description: vaga.description,
      applyEmail: null,
      publishedAt: null,
    });
    db.jobSource.findUnique.mockResolvedValue({ closedAt: null });

    await ingestProcessor(jobDoBoard);
    expect(clearJobEmbedding).toHaveBeenCalledWith('vaga-1');
    // o falso do Prisma não tem tipo: o argumento é o que o update recebeu
    const atualizacao = db.job.update.mock.lastCall?.[0] as { data: { requirements?: unknown } };
    expect(atualizacao.data.requirements).toBe('DbNull');
  });

  it('vaga que reaparece depois de fechar é reaberta e volta para o match', async () => {
    const vaga = umaVaga();
    adapterCom([vaga]);
    db.job.findUnique.mockResolvedValue({
      id: 'vaga-1',
      active: false,
      ...vaga,
      location: vaga.location,
      workModel: null,
      seniority: null,
      contractType: null,
      salaryMin: null,
      salaryMax: null,
      applyEmail: null,
      publishedAt: null,
    });
    db.jobSource.findUnique.mockResolvedValue({ closedAt: new Date(AGORA - 86_400_000) });

    await expect(ingestProcessor(jobDoBoard)).resolves.toMatchObject({ changed: 1, matches: 1 });
    expect(db.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ active: true }) as unknown }),
    );
  });

  it('com a lista cortada no teto, não fecha vagas do board', async () => {
    adapterCom(
      Array.from({ length: 1000 }, (_, i) =>
        umaVaga({ externalId: `empresa:${i}`, title: `Vaga ${i}` }),
      ),
    );

    await ingestProcessor(jobDoBoard);
    expect(closeMissing).not.toHaveBeenCalled();
  });

  it('busca por palavra-chave não fecha vagas pela ausência', async () => {
    adapterCom([umaVaga({ sourceId: 'gupy' })]);

    await ingestProcessor(umJob({ sourceId: 'gupy', keyword: 'react' }));
    expect(db.careerBoard.findUnique).not.toHaveBeenCalled();
    expect(closeMissing).not.toHaveBeenCalled();
  });

  it('board desativado não é baixado', async () => {
    db.careerBoard.findUnique.mockResolvedValue({ id: 'cb-1', token: 'empresa', active: false });

    await expect(ingestProcessor(jobDoBoard)).resolves.toEqual({ skipped: true });
    expect(getAdapter).not.toHaveBeenCalled();
  });
});

/** Adapter de site com página por vaga: a listagem só traz o id, e o detalhe traz o resto. */
function adapterComDetalhe(ids: string[]) {
  const detalhe = vi.fn(async (listed: { id: string }) => ({ id: listed.id, full: true }));
  const adapter: JobSourceAdapter<{ id: string; full?: boolean }> = {
    id: 'nerdin',
    displayName: 'Nerdin',
    kind: 'html',
    fetchBy: 'feed',
    async *fetch() {
      yield* ids.map((id) => ({ id }));
    },
    detail: { idOf: (listed) => listed.id, fetch: detalhe },
    normalize: (raw) =>
      umaVaga({
        sourceId: 'nerdin',
        externalId: raw.id,
        url: `https://www.nerdin.com.br/vaga_emprego/vaga-${raw.id}.php`,
        title: `Vaga ${raw.id}`,
      }),
  };
  vi.mocked(getAdapter).mockReturnValue(adapter);
  return detalhe;
}

describe('ingestProcessor: listagem completa (feed) com página por vaga', () => {
  const jobDoFeed = umJob({ sourceId: 'nerdin' });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: AGORA });
    db.source.findUnique.mockResolvedValue({
      active: true,
      rateLimitMs: 60_000,
      rateLimitReqs: 30,
    });
    db.searchProfile.findMany.mockResolvedValue([perfil('perfil-react', ['react'])]);
    db.job.findUnique.mockResolvedValue(null);
    db.job.create.mockResolvedValue({ id: 'vaga-nova' });
    db.jobSource.findUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('só baixa a página das vagas que a fonte ainda não tem abertas', async () => {
    const detalhe = adapterComDetalhe(['conhecida', 'nova']);
    // a conhecida já está aberta: o updateMany do lastSeen a encontra
    db.jobSource.updateMany.mockImplementation(({ where }: { where: { externalId: string } }) => ({
      count: where.externalId === 'conhecida' ? 1 : 0,
    }));

    await expect(ingestProcessor(jobDoFeed)).resolves.toEqual({
      found: 2,
      changed: 1,
      matches: 1,
    });
    expect(detalhe.mock.calls.map(([listed]) => listed.id)).toEqual(['nova']);
    expect(db.job.create).toHaveBeenCalledTimes(1);
    expect(db.careerBoard.findUnique).not.toHaveBeenCalled();
  });

  it('fecha o que sumiu da listagem inteira da fonte e registra o alvo como listagem', async () => {
    adapterComDetalhe(['nova']);
    db.jobSource.updateMany.mockResolvedValue({ count: 0 });

    await ingestProcessor(jobDoFeed);
    expect(vi.mocked(closeMissing)).toHaveBeenCalledWith({ sourceId: 'nerdin' }, new Date(AGORA));
    expect(recordSourceRun).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'listagem completa', careerBoardId: null }),
    );
  });
});

describe('ingestProcessor: bloqueios do site', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: AGORA });
    db.careerBoard.findUnique.mockResolvedValue({ id: 'cb-1', token: 'empresa', active: true });
    db.source.findUnique.mockResolvedValue({
      active: true,
      rateLimitMs: 60_000,
      rateLimitReqs: 30,
    });
    db.searchProfile.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('403 pausa a fonte, registra o erro no board e não repete', async () => {
    adapterCom(new SourceBlockedError('boards-api.greenhouse.io'));

    await expect(ingestProcessor(jobDoBoard, 'token')).rejects.toBeInstanceOf(UnrecoverableError);
    expect(fonteGravada()).toMatchObject({ active: false });
    expect(db.careerBoard.update).toHaveBeenCalledWith({
      where: { id: 'cb-1' },
      data: { lastError: expect.any(String) as unknown },
    });
    expect(moveToDelayed).not.toHaveBeenCalled();
  });

  it('robots.txt que proíbe o caminho pausa a fonte e não repete', async () => {
    adapterCom(new SourceDisallowedError('boards-api.greenhouse.io', '/v1/boards/empresa/jobs'));

    await expect(ingestProcessor(jobDoBoard, 'token')).rejects.toBeInstanceOf(UnrecoverableError);
    expect(fonteGravada()).toMatchObject({
      active: false,
      lastError: expect.stringContaining('robots.txt') as unknown,
    });
    expect(moveToDelayed).not.toHaveBeenCalled();
  });

  it.each([
    [new SourceBlockedError('boards-api.greenhouse.io'), 'blocked'],
    [new SourceDisallowedError('boards-api.greenhouse.io', '/v1'), 'blocked'],
    [new SourceRateLimitedError('boards-api.greenhouse.io', 30_000), 'rate_limited'],
    [new Error('HTTP 503'), 'failed'],
  ])('registra a execução que falhou com %s como %s', async (erro, status) => {
    adapterCom(erro);

    await expect(ingestProcessor(jobDoBoard, 'token')).rejects.toBeDefined();
    expect(recordSourceRun).toHaveBeenCalledWith(
      expect.objectContaining({ status, error: erro.message, found: 0 }),
    );
  });

  it('429 adia o job pelo Retry-After, sem pausar a fonte', async () => {
    adapterCom(new SourceRateLimitedError('boards-api.greenhouse.io', 30_000));

    await expect(ingestProcessor(jobDoBoard, 'token')).rejects.toBeInstanceOf(DelayedError);
    expect(moveToDelayed).toHaveBeenCalledWith(AGORA + 30_000, 'token');
    expect(fonteGravada()).not.toHaveProperty('active');
  });

  it('429 sem Retry-After espera 15 minutos', async () => {
    adapterCom(new SourceRateLimitedError('boards-api.greenhouse.io', null));

    await expect(ingestProcessor(jobDoBoard, 'token')).rejects.toBeInstanceOf(DelayedError);
    expect(moveToDelayed).toHaveBeenCalledWith(AGORA + 15 * 60_000, 'token');
  });

  it('outros erros sobem para o BullMQ repetir, sem fechar vagas', async () => {
    const instavel = new Error('HTTP 503 em https://boards-api.greenhouse.io');
    adapterCom(instavel);

    await expect(ingestProcessor(jobDoBoard, 'token')).rejects.toBe(instavel);
    expect(fonteGravada()).toMatchObject({ lastError: instavel.message });
    expect(fonteGravada()).not.toHaveProperty('active');
    expect(closeMissing).not.toHaveBeenCalled();
  });
});
