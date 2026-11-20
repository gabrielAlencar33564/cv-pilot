import { JobRequirementsError, getAiProvider } from '@cv-pilot/ai';
import type { QueuePayloads } from '@cv-pilot/queue';
import { UnrecoverableError, type Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jobRequirementsProcessor } from './job-requirements';

const db = vi.hoisted(() => ({ job: { findUnique: vi.fn(), updateMany: vi.fn() } }));
vi.mock('@cv-pilot/db', () => ({ prisma: db }));
vi.mock('@cv-pilot/ai', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAiProvider: vi.fn(),
}));

const extractJobRequirements = vi.fn();
const vaga = {
  title: 'Dev React',
  description: 'Exigimos React.',
  active: true,
  requirements: null,
};
const requisitos = [{ name: 'React', aliases: [], required: true }];
// em teste, o job do BullMQ é montado à mão
const umJob = { data: { jobId: 'vaga-1' } } as Job<QueuePayloads['job-requirements']>;

describe('jobRequirementsProcessor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getAiProvider).mockReturnValue({
      parseResume: vi.fn(),
      embed: vi.fn(),
      extractJobRequirements,
    });
    db.job.findUnique.mockResolvedValue(vaga);
    db.job.updateMany.mockResolvedValue({ count: 1 });
    extractJobRequirements.mockResolvedValue({
      requirements: requisitos,
      usage: { inputTokens: 500, outputTokens: 80 },
    });
  });

  it('manda só o título e a descrição e grava os requisitos', async () => {
    await expect(jobRequirementsProcessor(umJob)).resolves.toEqual({
      requirements: 1,
      saved: true,
    });
    expect(extractJobRequirements).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Dev React', description: 'Exigimos React.' }),
    );
    expect(db.job.updateMany).toHaveBeenCalledWith({
      where: { id: 'vaga-1', title: 'Dev React', description: 'Exigimos React.' },
      data: { requirements: { requirements: requisitos } },
    });
  });

  it('texto alterado durante a extração não recebe os requisitos do texto velho', async () => {
    db.job.updateMany.mockResolvedValue({ count: 0 });

    await expect(jobRequirementsProcessor(umJob)).resolves.toMatchObject({ saved: false });
  });

  it('a segunda execução do mesmo job não chama a IA de novo', async () => {
    db.job.findUnique.mockResolvedValue({ ...vaga, requirements: { requirements: requisitos } });

    await expect(jobRequirementsProcessor(umJob)).resolves.toEqual({
      skipped: 'already_extracted',
    });
    expect(extractJobRequirements).not.toHaveBeenCalled();
  });

  it('vaga fechada ou removida não é analisada', async () => {
    db.job.findUnique.mockResolvedValue(null);

    await expect(jobRequirementsProcessor(umJob)).resolves.toEqual({ skipped: 'inactive' });
    expect(extractJobRequirements).not.toHaveBeenCalled();
  });

  it('com o provedor sem extração (noop), nada é gravado', async () => {
    extractJobRequirements.mockResolvedValue(null);

    await expect(jobRequirementsProcessor(umJob)).resolves.toEqual({
      skipped: 'provider_without_requirements',
    });
    expect(db.job.updateMany).not.toHaveBeenCalled();
  });

  it('recusa da IA não é repetida', async () => {
    extractJobRequirements.mockRejectedValue(new JobRequirementsError('refusal'));

    await expect(jobRequirementsProcessor(umJob)).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('erro temporário sobe como está, para o BullMQ repetir', async () => {
    const erro = new Error('HTTP 529');
    extractJobRequirements.mockRejectedValue(erro);

    await expect(jobRequirementsProcessor(umJob)).rejects.toBe(erro);
  });
});
