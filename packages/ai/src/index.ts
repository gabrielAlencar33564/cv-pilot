import type { LetterTone, NormalizedJob } from '@cv-pilot/contracts';

/** Dados estruturados extraídos de um currículo. */
export interface ParsedResume {
  summary?: string;
  skills: string[];
  experiences: {
    company: string;
    role: string;
    start?: string;
    end?: string;
    description?: string;
  }[];
  education: { institution: string; course: string; end?: string }[];
  languages: { name: string; level?: string }[];
}

/**
 * Interface do provedor de IA. O provedor concreto (definido em AI_PROVIDER)
 * é uma decisão em aberto no PRD; até lá, usa-se o NoopAiProvider.
 */
export interface AiProvider {
  parseResume(text: string): Promise<ParsedResume>;
  writeCoverLetter(input: {
    job: NormalizedJob;
    resume: ParsedResume;
    tone: LetterTone;
    candidateName: string;
  }): Promise<string>;
  embed(text: string): Promise<number[]>;
}

class NoopAiProvider implements AiProvider {
  async parseResume(): Promise<ParsedResume> {
    return { skills: [], experiences: [], education: [], languages: [] };
  }
  async writeCoverLetter({ job, candidateName }: { job: NormalizedJob; candidateName: string }) {
    return `Olá, equipe ${job.company}!\n\nTenho interesse na vaga de ${job.title}.\n\n${candidateName}`;
  }
  async embed(): Promise<number[]> {
    return [];
  }
}

export function getAiProvider(): AiProvider {
  // TODO: instanciar o provedor real conforme AI_PROVIDER
  return new NoopAiProvider();
}
