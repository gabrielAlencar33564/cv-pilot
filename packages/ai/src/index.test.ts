import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAiProvider } from './index';

describe('getAiProvider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exige AI_PROVIDER em vez de cair num provedor padrão', () => {
    vi.stubEnv('AI_PROVIDER', '');
    expect(() => getAiProvider()).toThrow(/AI_PROVIDER precisa ser "claude" ou "noop"/);
  });

  it('o provedor noop devolve um currículo vazio, sem gastar tokens', async () => {
    vi.stubEnv('AI_PROVIDER', 'noop');
    const extracao = await getAiProvider().parseResume({ kind: 'text', text: 'qualquer coisa' });

    expect(extracao.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(extracao.resume.skills).toEqual([]);
  });

  it('o provedor noop não gera embeddings: o match segue só com as regras', async () => {
    vi.stubEnv('AI_PROVIDER', 'noop');

    await expect(getAiProvider().embed(['Dev React'], 'document')).resolves.toBeNull();
  });

  it('o provedor noop não extrai requisitos: a vaga fica sem o "o que falta"', async () => {
    vi.stubEnv('AI_PROVIDER', 'noop');

    await expect(
      getAiProvider().extractJobRequirements({ title: 'Dev React', description: 'React' }),
    ).resolves.toBeNull();
  });
});
