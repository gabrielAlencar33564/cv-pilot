import type { ScoreResult } from './scoring';

/*
 * Nota final do match (RF-40): as regras dizem se a vaga cumpre o perfil; a semelhança entre
 * os embeddings da vaga e do currículo, se o candidato tem o perfil da vaga. Os números abaixo
 * são o ponto de partida: calibrar com o feedback real ("não tenho interesse", respostas das
 * empresas), como pede o item 4 da §2.2 de docs/melhorias.md.
 */

/** Quanto a semelhança pesa na nota final; o resto vem das regras. */
const SEMANTIC_WEIGHT = 0.4;
/**
 * Faixa útil do cosseno entre vaga e currículo: abaixo do piso, textos do mesmo domínio ainda
 * parecem "um pouco iguais" e a semelhança vale zero; do teto para cima, vale 100.
 */
const SIMILARITY_FLOOR = 0.3;
const SIMILARITY_CEILING = 0.8;
const MAX_SCORE = 100;
/** Quantas habilidades em comum aparecem no motivo, para ele caber na tela. */
const MAX_SKILLS_IN_REASON = 6;

/** Cosseno (-1 a 1) para 0-100, dentro da faixa útil. */
export function similarityScore(similarity: number): number {
  const scaled = (similarity - SIMILARITY_FLOOR) / (SIMILARITY_CEILING - SIMILARITY_FLOOR);
  return Math.round(Math.min(1, Math.max(0, scaled)) * MAX_SCORE);
}

interface ResumeComparison {
  /** cosseno entre a vaga e o currículo, ou null quando não há embedding */
  similarity: number | null;
  /** habilidades do currículo que aparecem na vaga */
  sharedSkills: readonly string[];
}

/**
 * Junta a nota das regras e a comparação com o currículo. Vaga bloqueada por regra rígida
 * continua bloqueada; sem embedding, a nota é a das regras.
 */
export function combineWithResume(rule: ScoreResult, resume: ResumeComparison): ScoreResult {
  if (rule.blocked) return rule;
  const reasons = [...rule.reasons];
  if (resume.sharedSkills.length) {
    reasons.push(
      `Habilidades do currículo na vaga: ${resume.sharedSkills.slice(0, MAX_SKILLS_IN_REASON).join(', ')}`,
    );
  }
  if (resume.similarity === null) return { ...rule, reasons };

  const semantic = similarityScore(resume.similarity);
  reasons.push(`Semelhança com o currículo: ${semantic}%`);
  const score = Math.round((1 - SEMANTIC_WEIGHT) * rule.score + SEMANTIC_WEIGHT * semantic);
  return { score, reasons, blocked: false };
}
