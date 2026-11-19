import { describe, expect, it } from 'vitest';
import { sourceHealth } from './source-health';

describe('sourceHealth', () => {
  it('fonte desligada aparece como pausada, mesmo sem erros', () => {
    expect(sourceHealth({ active: false, runs: 10, failures: 0 })).toBe('paused');
  });

  it('sem execuções na janela, está ociosa', () => {
    expect(sourceHealth({ active: true, runs: 0, failures: 0 })).toBe('idle');
  });

  it('sem nenhum problema, está saudável', () => {
    expect(sourceHealth({ active: true, runs: 24, failures: 0 })).toBe('healthy');
  });

  it('com poucos problemas, está instável', () => {
    expect(sourceHealth({ active: true, runs: 10, failures: 4 })).toBe('degraded');
  });

  it('com metade ou mais das execuções com problema, está falhando', () => {
    expect(sourceHealth({ active: true, runs: 10, failures: 5 })).toBe('failing');
    expect(sourceHealth({ active: true, runs: 1, failures: 1 })).toBe('failing');
  });
});
