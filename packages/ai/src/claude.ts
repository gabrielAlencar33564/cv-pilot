import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { ParsedResume } from '@cv-pilot/contracts';
import { RESUME_SYSTEM_PROMPT, resumeUserContent } from './prompts/resume';
import {
  ResumeParseError,
  type AiProvider,
  type ResumeDocument,
  type ResumeExtraction,
} from './types';

const MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 16_000;
/** Se o modelo recusar, o próprio servidor tenta de novo num modelo de reserva, na mesma chamada. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** Provedor real: Claude via SDK oficial (`ANTHROPIC_API_KEY`, ou o perfil do `ant auth login`). */
export class ClaudeAiProvider implements AiProvider {
  constructor(private readonly client: Anthropic = new Anthropic()) {}

  async parseResume(document: ResumeDocument): Promise<ResumeExtraction> {
    let response;
    try {
      response = await this.client.beta.messages.parse({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        system: RESUME_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: resumeUserContent(document) }],
        output_config: { effort: 'medium', format: betaZodOutputFormat(ParsedResume) },
      });
    } catch (err) {
      // pedido malformado não melhora com retentativa; 429, 5xx e rede sobem para o BullMQ repetir
      if (err instanceof Anthropic.BadRequestError) throw new ResumeParseError('provider_rejected');
      throw err;
    }

    if (response.stop_reason === 'refusal') throw new ResumeParseError('refusal');
    if (response.stop_reason === 'max_tokens') throw new ResumeParseError('max_tokens');
    const parsed = ParsedResume.safeParse(response.parsed_output);
    if (!parsed.success) throw new ResumeParseError('invalid_output');

    return {
      resume: parsed.data,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
