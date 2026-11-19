import { enqueue } from '@cv-pilot/queue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueDailyDigests } from './digest';

const db = vi.hoisted(() => ({ user: { findMany: vi.fn() } }));
vi.mock('@cv-pilot/db', () => ({ prisma: db }));
vi.mock('@cv-pilot/queue', () => ({ enqueue: vi.fn() }));

describe('enqueueDailyDigests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.user.findMany.mockResolvedValue([
      { id: 'em-sp', timezone: 'America/Sao_Paulo' },
      { id: 'em-utc', timezone: 'UTC' },
    ]);
  });

  it('às 8h no fuso do usuário, enfileira um resumo por dia', async () => {
    // 11:00 UTC = 08:00 em São Paulo
    await expect(enqueueDailyDigests(new Date('2026-11-19T11:05:00Z'))).resolves.toBe(1);
    expect(vi.mocked(enqueue)).toHaveBeenCalledWith(
      'notify',
      { kind: 'new_jobs', userId: 'em-sp', day: '2026-11-19' },
      { jobId: 'notify_new_jobs_em-sp_2026-11-19' },
    );
  });

  it('o mesmo dia gera o mesmo jobId nos ticks seguintes da hora', async () => {
    await enqueueDailyDigests(new Date('2026-11-19T11:05:00Z'));
    await enqueueDailyDigests(new Date('2026-11-19T11:55:00Z'));

    const jobIds = vi.mocked(enqueue).mock.calls.map((call) => call[2]?.jobId);
    expect(new Set(jobIds)).toEqual(new Set(['notify_new_jobs_em-sp_2026-11-19']));
  });

  it('fora das 8h locais, não enfileira nada', async () => {
    await expect(enqueueDailyDigests(new Date('2026-11-19T15:00:00Z'))).resolves.toBe(0);
    expect(vi.mocked(enqueue)).not.toHaveBeenCalled();
  });

  it('só procura quem tem conta ativa e perfil de busca ativo', async () => {
    await enqueueDailyDigests(new Date('2026-11-19T08:00:00Z'));

    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, searchProfiles: { some: { active: true } } },
      }),
    );
    expect(vi.mocked(enqueue)).toHaveBeenCalledWith(
      'notify',
      expect.objectContaining({ userId: 'em-utc' }),
      expect.anything(),
    );
  });
});
