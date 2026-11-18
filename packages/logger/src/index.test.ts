import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loggerOptions, withLogContext } from './index';

const capturar = () => {
  const linhas: Record<string, unknown>[] = [];
  const log = pino(loggerOptions('teste'), {
    write: (linha: string) => {
      linhas.push(JSON.parse(linha) as Record<string, unknown>);
    },
  });
  return { log, linhas };
};

describe('logger', () => {
  beforeEach(() => {
    vi.stubEnv('LOG_PRETTY', 'false');
    vi.stubEnv('LOG_LEVEL', 'info');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('identifica o serviço em toda linha', () => {
    const { log, linhas } = capturar();
    log.info('oi');
    expect(linhas[0]).toMatchObject({ service: 'teste', msg: 'oi' });
  });

  it('inclui os campos do contexto e os combina quando aninhados', () => {
    const { log, linhas } = capturar();
    withLogContext({ queue: 'search', jobId: '42' }, () => {
      withLogContext({ attempt: 2 }, () => log.info('dentro'));
    });
    log.info('fora');

    expect(linhas[0]).toMatchObject({ queue: 'search', jobId: '42', attempt: 2 });
    expect(linhas[1]).not.toHaveProperty('jobId');
  });

  it('não vaza campos de uma linha para a seguinte no mesmo contexto', () => {
    const { log, linhas } = capturar();
    withLogContext({ jobId: '42' }, () => {
      log.info({ found: 12 }, 'primeira');
      log.info('segunda');
    });
    expect(linhas[1]).toMatchObject({ jobId: '42', msg: 'segunda' });
    expect(linhas[1]).not.toHaveProperty('found');
  });

  it('mantém o contexto depois de um await', async () => {
    const { log, linhas } = capturar();
    await withLogContext({ jobId: '7' }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      log.info('depois do await');
    });
    expect(linhas[0]).toMatchObject({ jobId: '7' });
  });

  it('mascara dados pessoais no primeiro e no segundo nível', () => {
    const { log, linhas } = capturar();
    log.info({ email: 'a@b.com', user: { phone: '11999999999', id: 'u1' } }, 'dados');
    expect(linhas[0]).toMatchObject({
      email: '[removido]',
      user: { phone: '[removido]', id: 'u1' },
    });
  });

  it('serializa o erro com mensagem e stack', () => {
    const { log, linhas } = capturar();
    log.error({ err: new Error('falhou') }, 'erro');
    expect(linhas[0]).toMatchObject({ err: { type: 'Error', message: 'falhou' } });
    expect((linhas[0]?.err as { stack?: string }).stack).toContain('falhou');
  });
});
