import { UnrecoverableError, type Job } from 'bullmq';
import { beforeAll, describe, expect, it } from 'vitest';
import { failureInfo, withJobContext } from './job-logging';
import { logger } from './logger';

const tentativa = (attemptsMade: number, attempts?: number) => ({
  attemptsMade,
  opts: { attempts },
});

describe('failureInfo', () => {
  it('avisa que vai repetir enquanto houver tentativas', () => {
    expect(failureInfo(tentativa(1, 4), new Error('timeout'))).toEqual({
      attempt: 1,
      maxAttempts: 4,
      willRetry: true,
    });
  });

  it('marca como definitiva a falha na última tentativa', () => {
    expect(failureInfo(tentativa(4, 4), new Error('timeout'))).toMatchObject({ willRetry: false });
  });

  it('não repete UnrecoverableError', () => {
    expect(failureInfo(tentativa(1, 4), new UnrecoverableError('403'))).toMatchObject({
      willRetry: false,
    });
  });

  it('sem attempts configurado, trata como tentativa única', () => {
    expect(failureInfo(tentativa(1), new Error('x'))).toMatchObject({
      maxAttempts: 1,
      willRetry: false,
    });
  });
});

describe('withJobContext', () => {
  // em teste, o job do BullMQ é montado à mão
  const job = { id: '1', attemptsMade: 0, data: { searchProfileId: 'p1' } } as Job;

  beforeAll(() => {
    logger.level = 'silent';
  });

  it('devolve o resultado do processor', async () => {
    const processor = withJobContext('search', async () => ({ found: 3 }));
    await expect(processor(job)).resolves.toEqual({ found: 3 });
  });

  it('propaga o erro para o BullMQ decidir a retentativa', async () => {
    const processor = withJobContext('search', async () => {
      throw new Error('falhou');
    });
    await expect(processor(job)).rejects.toThrow('falhou');
  });
});
