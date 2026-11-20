import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { CoverLetterDraft, JobRequirements, ParsedResume } from '@cv-pilot/contracts';
import { COVER_LETTER_SYSTEM_PROMPT, coverLetterUserText } from './prompts/cover-letter';
import {
  JOB_REQUIREMENTS_SYSTEM_PROMPT,
  jobRequirementsUserText,
} from './prompts/job-requirements';
import { RESUME_SYSTEM_PROMPT, resumeUserContent } from './prompts/resume';
import {
  CoverLetterError,
  JobRequirementsError,
  ResumeParseError,
  type AiProvider,
  type CoverLetterRequest,
  type CoverLetterWriting,
  type RequirementsExtraction,
  type ResumeDocument,
  type ResumeExtraction,
} from './types';

const MODEL = 'claude-opus-5-5';
const RESUME_MAX_TOKENS = 16_000;
/** Uma lista de requisitos curtos: folga grande para vagas com dezenas deles. */
const REQUIREMENTS_MAX_TOKENS = 4_000;
/** Uma carta tem de 150 a 400 palavras: folga para o JSON da saída estruturada. */
const COVER_LETTER_MAX_TOKENS = 3_000;
/** Se o modelo recusar, o próprio servidor tenta de novo num modelo de reserva, na mesma chamada. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

type FailureCode = 'refusal' | 'max_tokens' | 'provider_rejected';

/** Pedido malformado não melhora com retentativa; 429, 5xx e rede sobem para o BullMQ repetir. */
function rethrowAsFailure(err: unknown, fail: (code: FailureCode) => Error): never {
  if (err instanceof Anthropic.BadRequestError) throw fail('provider_rejected');
  throw err;
}

/** `refusal` e `max_tokens` cortam a saída: nada parcial é gravado. */
function assertComplete(stopReason: string | null, fail: (code: FailureCode) => Error) {
  if (stopReason === 'refusal' || stopReason === 'max_tokens') throw fail(stopReason);
}

/** Extrações pelo Claude, via SDK oficial (`ANTHROPIC_API_KEY` ou `ant auth login`). */
export class ClaudeAiProvider implements Pick<
  AiProvider,
  'parseResume' | 'extractJobRequirements' | 'writeCoverLetter'
> {
  constructor(private readonly client: Anthropic = new Anthropic()) {}

  async parseResume(document: ResumeDocument): Promise<ResumeExtraction> {
    const fail = (code: FailureCode) => new ResumeParseError(code);
    const response = await this.client.beta.messages
      .parse({
        model: MODEL,
        max_tokens: RESUME_MAX_TOKENS,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        system: RESUME_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: resumeUserContent(document) }],
        output_config: { effort: 'medium', format: betaZodOutputFormat(ParsedResume) },
      })
      .catch((err: unknown) => rethrowAsFailure(err, fail));

    assertComplete(response.stop_reason, fail);
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

  async extractJobRequirements(job: {
    title: string;
    description: string;
  }): Promise<RequirementsExtraction> {
    const fail = (code: FailureCode) => new JobRequirementsError(code);
    const response = await this.client.beta.messages
      .parse({
        model: MODEL,
        max_tokens: REQUIREMENTS_MAX_TOKENS,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        system: JOB_REQUIREMENTS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: jobRequirementsUserText(job) }],
        output_config: { effort: 'low', format: betaZodOutputFormat(JobRequirements) },
      })
      .catch((err: unknown) => rethrowAsFailure(err, fail));

    assertComplete(response.stop_reason, fail);
    const parsed = JobRequirements.safeParse(response.parsed_output);
    if (!parsed.success) throw new JobRequirementsError('invalid_output');

    return {
      requirements: parsed.data.requirements,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async writeCoverLetter(request: CoverLetterRequest): Promise<CoverLetterWriting> {
    const fail = (code: FailureCode) => new CoverLetterError(code);
    const response = await this.client.beta.messages
      .parse({
        model: MODEL,
        max_tokens: COVER_LETTER_MAX_TOKENS,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        system: COVER_LETTER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: coverLetterUserText(request) }],
        output_config: { effort: 'medium', format: betaZodOutputFormat(CoverLetterDraft) },
      })
      .catch((err: unknown) => rethrowAsFailure(err, fail));

    assertComplete(response.stop_reason, fail);
    const parsed = CoverLetterDraft.safeParse(response.parsed_output);
    if (!parsed.success || !parsed.data.body.trim()) throw new CoverLetterError('invalid_output');

    return {
      body: parsed.data.body.trim(),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
