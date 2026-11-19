import type { QueuePayloads } from '@cv-pilot/queue';
import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueMatch } from '../match-queue';
import { backfillProcessor } from './backfill';

const db = vi.hoisted(() => ({
  searchProfile: { findUnique: vi.fn() },
  job: { findMany: vi.fn() },
}));
vi.mock('@cv-pilot/db', () => ({ prisma: db }));
vi.mock('../match-queue', () => ({ enqueueMatch: vi.fn() }));

// em teste, o job do BullMQ é montado à mão
const umJob = { data: { searchProfileId: 'perfil-1' } } as Job<QueuePayloads['backfill']>;

const perfil = (o: Record<string, unknown> = {}) => ({
  id: 'perfil-1',
  active: true,
  sourceIds: ['greenhouse'],
  keywords: ['react'],
  excludeKeywords: [],
  workModels: [],
  seniorities: [],
  contractTypes: [],
  companyBlacklist: [],
  salaryMin: null,
  salaryMax: null,
  location: null,
  ...o,
});

const umaVaga = (id: string, description: string) => ({
  id,
  title: 'Desenvolvedor',
  company: 'Empresa X',
  description,
  location: null,
  workModel: null,
  seniority: null,
  contractType: null,
  salaryMin: null,
  salaryMax: null,
});

describe('backfillProcessor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.searchProfile.findUnique.mockResolvedValue(perfil());
  });

  it('manda para o match só as vagas abertas que podem casar com o perfil', async () => {
    db.job.findMany.mockResolvedValue([
      umaVaga('vaga-react', 'Stack: React'),
      umaVaga('vaga-vendas', 'Vaga de vendas'),
    ]);

    await expect(backfillProcessor(umJob)).resolves.toEqual({ scanned: 2, matches: 1 });
    expect(vi.mocked(enqueueMatch).mock.calls).toEqual([['vaga-react', 'perfil-1']]);
    expect(db.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          active: true,
          sources: { some: { sourceId: { in: ['greenhouse'] }, closedAt: null } },
        },
      }),
    );
  });

  it('perfil pausado ou removido não faz nada', async () => {
    db.searchProfile.findUnique.mockResolvedValue(perfil({ active: false }));
    await expect(backfillProcessor(umJob)).resolves.toEqual({ skipped: true });

    db.searchProfile.findUnique.mockResolvedValue(null);
    await expect(backfillProcessor(umJob)).resolves.toEqual({ skipped: true });
    expect(db.job.findMany).not.toHaveBeenCalled();
  });
});
