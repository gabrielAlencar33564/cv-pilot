import { enqueue } from '@cv-pilot/queue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueJobRequirements } from './requirements-queue';

vi.mock('@cv-pilot/queue', () => ({ enqueue: vi.fn() }));

const idDoJob = () => (vi.mocked(enqueue).mock.lastCall?.[2] as { jobId: string }).jobId;

describe('enqueueJobRequirements', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('o mesmo texto gera o mesmo job; um texto novo gera outro', async () => {
    const vaga = { id: 'vaga-1', title: 'Dev React', description: 'React' };

    await enqueueJobRequirements(vaga);
    const primeiro = idDoJob();
    await enqueueJobRequirements(vaga);
    expect(idDoJob()).toBe(primeiro);

    await enqueueJobRequirements({ ...vaga, description: 'React e Node.js' });
    expect(idDoJob()).not.toBe(primeiro);
    expect(idDoJob()).toMatch(/^requirements_vaga-1_/);
    expect(enqueue).toHaveBeenLastCalledWith(
      'job-requirements',
      { jobId: 'vaga-1' },
      expect.anything(),
    );
  });
});
