import type { ParsedResume } from '@cv-pilot/contracts';

/**
 * Teto do texto mandado para o embedding (~2 mil tokens). O começo da vaga e do currículo diz
 * o essencial; o resto encarece sem mudar muito o vetor.
 */
const MAX_EMBEDDING_CHARS = 8000;

const clip = (text: string) => text.trim().slice(0, MAX_EMBEDDING_CHARS);

/** Texto da vaga para o embedding: título e descrição. */
export function jobEmbeddingText(job: { title: string; description: string }): string {
  return clip(`${job.title}\n\n${job.description}`);
}

/**
 * Texto do currículo para o embedding: resumo, habilidades e experiências. Formação e idiomas
 * ficam de fora, e nenhum dado de contato existe no `ParsedResume`.
 */
export function resumeEmbeddingText(resume: ParsedResume): string {
  const experiences = resume.experiences.map((e) =>
    [`${e.role} (${e.company})`, e.description].filter(Boolean).join(': '),
  );
  return clip(
    [
      resume.summary,
      resume.skills.length ? `Habilidades: ${resume.skills.join(', ')}` : null,
      ...experiences,
    ]
      .filter(Boolean)
      .join('\n\n'),
  );
}
