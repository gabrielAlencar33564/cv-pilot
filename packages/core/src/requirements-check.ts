import type { JobRequirement, ParsedResume } from '@cv-pilot/contracts';
import { containsTerm, tokenize } from './text-match';

/** Todo o texto do currículo onde um requisito pode aparecer. */
function resumeText(resume: ParsedResume): string {
  return [
    resume.summary,
    ...resume.skills,
    ...resume.experiences.flatMap((e) => [e.role, e.description]),
    ...resume.education.map((e) => e.course),
    ...resume.languages.map((l) => l.name),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * O que a vaga pede e o currículo não mostra (RF-41). A IA só extrai os requisitos da vaga; a
 * comparação é feita aqui, por termo inteiro no texto do currículo, com o nome ou um dos
 * sinônimos do requisito. Assim a IA nunca afirma que o candidato tem ou não tem algo, e o
 * erro possível é um requisito aparecer como faltando sem faltar.
 */
export function requirementsCheck(
  requirements: readonly JobRequirement[],
  resume: ParsedResume,
): { missing: JobRequirement[]; met: JobRequirement[] } {
  const tokens = tokenize(resumeText(resume));
  const missing: JobRequirement[] = [];
  const met: JobRequirement[] = [];
  for (const requirement of requirements) {
    const terms = [requirement.name, ...requirement.aliases];
    (terms.some((term) => containsTerm(tokens, term)) ? met : missing).push(requirement);
  }
  return { missing, met };
}
