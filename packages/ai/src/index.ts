import { ClaudeAiProvider } from './claude';
import type { AiProvider, ResumeExtraction } from './types';

export { ResumeParseError, type AiProvider, type ResumeDocument } from './types';

/** Para dev e testes sem chave: devolve um currículo vazio, sem chamar ninguém. */
class NoopAiProvider implements AiProvider {
  async parseResume(): Promise<ResumeExtraction> {
    return {
      resume: { summary: null, skills: [], experiences: [], education: [], languages: [] },
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}

let provider: AiProvider | undefined;

/** Provedor escolhido por AI_PROVIDER. Sem padrão: um valor faltando não pode virar "sem IA" calado. */
export function getAiProvider(): AiProvider {
  provider ??= createProvider(process.env.AI_PROVIDER);
  return provider;
}

function createProvider(name: string | undefined): AiProvider {
  switch (name) {
    case 'claude':
      return new ClaudeAiProvider();
    case 'noop':
      return new NoopAiProvider();
    default:
      throw new Error(`AI_PROVIDER precisa ser "claude" ou "noop"; recebido "${name ?? ''}"`);
  }
}
