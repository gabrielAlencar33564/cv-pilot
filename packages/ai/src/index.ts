import { ClaudeAiProvider } from './claude';
import type { AiProvider, ResumeExtraction } from './types';
import { VoyageEmbedder } from './voyage';

export {
  CoverLetterError,
  JobRequirementsError,
  ResumeParseError,
  type AiProvider,
  type ResumeDocument,
} from './types';

/**
 * Para dev e testes sem chave: currículo vazio, sem embeddings, requisitos nem cartas, sem
 * chamar ninguém.
 */
class NoopAiProvider implements AiProvider {
  async parseResume(): Promise<ResumeExtraction> {
    return {
      resume: { summary: null, skills: [], experiences: [], education: [], languages: [] },
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  async embed() {
    return null;
  }

  async extractJobRequirements() {
    return null;
  }

  async writeCoverLetter() {
    return null;
  }
}

let provider: AiProvider | undefined;

/** Provedor escolhido por AI_PROVIDER. Sem padrão: um valor faltando não pode virar "sem IA" calado. */
export function getAiProvider(): AiProvider {
  provider ??= createProvider(process.env.AI_PROVIDER);
  return provider;
}

/** Com o Claude, os embeddings vêm do Voyage: sem a chave, nada sobe calado sem a similaridade. */
function voyageApiKey(): string {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) {
    throw new Error(
      'VOYAGE_API_KEY não definida: com AI_PROVIDER=claude, os embeddings usam o Voyage',
    );
  }
  return key;
}

function createProvider(name: string | undefined): AiProvider {
  switch (name) {
    case 'claude': {
      const claude = new ClaudeAiProvider();
      const voyage = new VoyageEmbedder(voyageApiKey());
      return {
        parseResume: (document) => claude.parseResume(document),
        embed: (texts, inputType) => voyage.embed(texts, inputType),
        extractJobRequirements: (job) => claude.extractJobRequirements(job),
        writeCoverLetter: (request) => claude.writeCoverLetter(request),
      };
    }
    case 'noop':
      return new NoopAiProvider();
    default:
      throw new Error(`AI_PROVIDER precisa ser "claude" ou "noop"; recebido "${name ?? ''}"`);
  }
}
