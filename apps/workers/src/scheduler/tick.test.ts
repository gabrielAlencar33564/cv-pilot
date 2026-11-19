import { getAdapter, type JobSourceAdapter } from '@cv-pilot/adapters';
import { enqueue } from '@cv-pilot/queue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expireStaleJobs } from '../job-expiration';
import { schedulerTick } from './tick';

const db = vi.hoisted(() => ({
  searchProfile: { findMany: vi.fn(), updateMany: vi.fn() },
  source: { findMany: vi.fn() },
  careerBoard: { findMany: vi.fn() },
}));
vi.mock('@cv-pilot/db', () => ({ prisma: db }));
vi.mock('@cv-pilot/queue', () => ({ enqueue: vi.fn() }));
vi.mock('@cv-pilot/adapters', () => ({ getAdapter: vi.fn() }));
vi.mock('../job-expiration', () => ({ expireStaleJobs: vi.fn() }));
vi.mock('./digest', () => ({ enqueueDailyDigests: vi.fn() }));

const AGORA = new Date('2026-11-19T12:00:00Z');
const JANELA = Math.floor(AGORA.getTime() / (60 * 60_000));
const HORA = 60 * 60_000;

const perfil = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  sourceIds: ['gupy', 'greenhouse'],
  keywords: ['react'],
  frequencyMinutes: 360,
  lastSearchedAt: new Date(AGORA.getTime() - 7 * HORA),
  ...o,
});

const filas = () => vi.mocked(enqueue).mock.calls.map(([fila, dados]) => ({ fila, dados }));

describe('schedulerTick', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now: AGORA });
    db.source.findMany.mockResolvedValue([{ id: 'gupy' }, { id: 'greenhouse' }]);
    db.careerBoard.findMany.mockResolvedValue([{ id: 'cb-1', sourceId: 'greenhouse' }]);
    vi.mocked(getAdapter).mockImplementation(
      (id) => ({ fetchBy: id === 'greenhouse' ? 'board' : 'keyword' }) as JobSourceAdapter<unknown>,
    );
    vi.mocked(expireStaleJobs).mockResolvedValue({ closedSources: 0, closedJobs: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dois perfis vencidos com a mesma palavra-chave geram uma ingestão por alvo', async () => {
    db.searchProfile.findMany.mockResolvedValue([perfil('p1'), perfil('p2')]);

    await schedulerTick();
    expect(filas()).toEqual([
      { fila: 'ingest', dados: { sourceId: 'gupy', keyword: 'react' } },
      { fila: 'ingest', dados: { sourceId: 'greenhouse', careerBoardId: 'cb-1' } },
    ]);
    expect(vi.mocked(enqueue).mock.calls[1]?.[2]).toEqual({
      jobId: `ingest_greenhouse_cb-1_${JANELA}`,
    });
    expect(db.searchProfile.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1', 'p2'] } },
      data: { lastSearchedAt: AGORA },
    });
  });

  it('perfil que ainda não venceu não gera ingestão', async () => {
    db.searchProfile.findMany.mockResolvedValue([
      perfil('p1', { lastSearchedAt: new Date(AGORA.getTime() - HORA) }),
    ]);

    await schedulerTick();
    expect(enqueue).not.toHaveBeenCalled();
    expect(db.searchProfile.updateMany).not.toHaveBeenCalled();
  });

  it('perfil novo, editado ou reativado ganha também o backfill', async () => {
    db.searchProfile.findMany.mockResolvedValue([perfil('novo', { lastSearchedAt: null })]);

    await schedulerTick();
    expect(filas()).toContainEqual({ fila: 'backfill', dados: { searchProfileId: 'novo' } });
  });

  it('fonte ativa sem adapter é pulada, e as outras seguem', async () => {
    db.searchProfile.findMany.mockResolvedValue([perfil('p1', { sourceIds: ['gupy', 'catho'] })]);
    db.source.findMany.mockResolvedValue([{ id: 'gupy' }, { id: 'catho' }]);
    vi.mocked(getAdapter).mockImplementation((id) => {
      if (id === 'catho') throw new Error(`Adapter não registrado: ${id}`);
      return { fetchBy: 'keyword' } as JobSourceAdapter<unknown>;
    });

    await schedulerTick();
    expect(filas()).toEqual([{ fila: 'ingest', dados: { sourceId: 'gupy', keyword: 'react' } }]);
  });

  it('expira as vagas antigas a cada rodada', async () => {
    db.searchProfile.findMany.mockResolvedValue([]);

    await schedulerTick();
    expect(expireStaleJobs).toHaveBeenCalledWith(AGORA);
  });
});
