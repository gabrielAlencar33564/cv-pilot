import { describe, expect, it } from 'vitest';
import { sharedSkills, type ScoreResult } from './scoring';
import { combineWithResume, similarityScore } from './semantic-score';

const regras = (o: Partial<ScoreResult> = {}): ScoreResult => ({
  score: 70,
  reasons: ['Palavras-chave: react'],
  blocked: false,
  ...o,
});

describe('similarityScore', () => {
  it('abaixo do piso vale zero e do teto para cima vale 100', () => {
    expect(similarityScore(0.1)).toBe(0);
    expect(similarityScore(0.3)).toBe(0);
    expect(similarityScore(0.8)).toBe(100);
    expect(similarityScore(0.95)).toBe(100);
  });

  it('entre o piso e o teto, cresce em linha', () => {
    expect(similarityScore(0.55)).toBe(50);
  });
});

describe('combineWithResume', () => {
  it('mistura 60% de regras e 40% de semelhança, e diz a semelhança no motivo', () => {
    const nota = combineWithResume(regras({ score: 70 }), { similarity: 0.8, sharedSkills: [] });

    expect(nota).toEqual({
      score: 82,
      reasons: ['Palavras-chave: react', 'Semelhança com o currículo: 100%'],
      blocked: false,
    });
  });

  it('sem embedding, a nota é a das regras, com as habilidades em comum no motivo', () => {
    const nota = combineWithResume(regras(), {
      similarity: null,
      sharedSkills: ['React', 'TypeScript'],
    });

    expect(nota.score).toBe(70);
    expect(nota.reasons).toContain('Habilidades do currículo na vaga: React, TypeScript');
  });

  it('vaga bloqueada por regra rígida continua bloqueada, por mais parecida que seja', () => {
    const bloqueada = regras({
      score: 0,
      blocked: true,
      reasons: ['Empresa na lista de exclusão'],
    });

    expect(combineWithResume(bloqueada, { similarity: 0.9, sharedSkills: ['React'] })).toBe(
      bloqueada,
    );
  });

  it('mostra no máximo seis habilidades em comum', () => {
    const muitas = ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7'];
    const nota = combineWithResume(regras(), { similarity: null, sharedSkills: muitas });

    expect(nota.reasons.at(-1)).toBe('Habilidades do currículo na vaga: a1, b2, c3, d4, e5, f6');
  });
});

describe('sharedSkills', () => {
  const vaga = {
    title: 'Dev Front-end',
    description: 'Stack: React, TypeScript e Node.js. Java é diferencial.',
  };

  it('acha as habilidades do currículo que aparecem na vaga, como termo inteiro', () => {
    expect(sharedSkills(vaga, ['react', 'JavaScript', 'Node.js', 'Java', 'Go'])).toEqual([
      'react',
      'Node.js',
      'Java',
    ]);
  });

  it('não repete a mesma habilidade escrita de outro jeito', () => {
    expect(sharedSkills(vaga, ['React', 'react', 'REACT'])).toEqual(['React']);
  });
});
