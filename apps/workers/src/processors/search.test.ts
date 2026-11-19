import { SourceBlockedError, SourceRateLimitedError, getAdapter } from '@cv-pilot/adapters';
import type { QueuePayloads } from '@cv-pilot/queue';
import { DelayedError, UnrecoverableError, type Job } from 'bullmq';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchProcessor } from './search';

const db = vi.hoisted(() => ({
  searchProfile: { findUnique: vi.fn() },
  source: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock('@cv-pilot/db', () => ({ prisma: db }));
vi.mock('@cv-pilot/queue', () => ({ enqueue: vi.fn(), getRedis: vi.fn() }));
vi.mock('@cv-pilot/adapters', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAdapter: vi.fn(),
}));

const AGORA = Date.parse('2026-11-18T12:00:00Z');
const moveToDelayed = vi.fn();
// em teste, o job do BullMQ é montado à mão
const umJob = {
  data: { searchProfileId: 'perfil-1', sourceId: 'gupy' },
  moveToDelayed,
} as unknown as Job<QueuePayloads['search']>;

/** Adapter que falha na primeira página com o erro dado. */
function adapterQueFalhaCom(erro: Error) {
  vi.mocked(getAdapter).mockReturnValue({
    id: 'gupy',
    displayName: 'Gupy',
    kind: 'api',
    // eslint-disable-next-line require-yield -- o adapter falha antes de devolver qualquer vaga
    async *search() {
      throw erro;
    },
    normalize: vi.fn(),
  });
}

const dadosGravados = () =>
  (db.source.update.mock.lastCall?.[0] as { data: Record<string, unknown> } | undefined)?.data;

describe('searchProcessor: bloqueios do site', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: AGORA });
    db.searchProfile.findUnique.mockResolvedValue({ active: true, keywords: ['react'] });
    db.source.findUnique.mockResolvedValue({
      active: true,
      rateLimitMs: 60_000,
      rateLimitReqs: 30,
      config: {},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('403 pausa a fonte e não repete', async () => {
    adapterQueFalhaCom(new SourceBlockedError('portal.gupy.io'));

    await expect(searchProcessor(umJob, 'token')).rejects.toBeInstanceOf(UnrecoverableError);
    expect(dadosGravados()).toMatchObject({ active: false });
    expect(moveToDelayed).not.toHaveBeenCalled();
  });

  it('429 adia o job pelo Retry-After, sem pausar a fonte', async () => {
    adapterQueFalhaCom(new SourceRateLimitedError('portal.gupy.io', 30_000));

    await expect(searchProcessor(umJob, 'token')).rejects.toBeInstanceOf(DelayedError);
    expect(moveToDelayed).toHaveBeenCalledWith(AGORA + 30_000, 'token');
    expect(dadosGravados()).not.toHaveProperty('active');
  });

  it('429 sem Retry-After espera 15 minutos', async () => {
    adapterQueFalhaCom(new SourceRateLimitedError('portal.gupy.io', null));

    await expect(searchProcessor(umJob, 'token')).rejects.toBeInstanceOf(DelayedError);
    expect(moveToDelayed).toHaveBeenCalledWith(AGORA + 15 * 60_000, 'token');
  });

  it('outros erros sobem para o BullMQ repetir, com a fonte ativa', async () => {
    const instavel = new Error('HTTP 503 em https://portal.gupy.io');
    adapterQueFalhaCom(instavel);

    await expect(searchProcessor(umJob, 'token')).rejects.toBe(instavel);
    expect(dadosGravados()).toMatchObject({ lastError: instavel.message });
    expect(dadosGravados()).not.toHaveProperty('active');
  });
});
