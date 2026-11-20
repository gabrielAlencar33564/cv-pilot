import type { ParsedResume } from '@cv-pilot/contracts';
import { describe, expect, it } from 'vitest';
import { jobEmbeddingText, resumeEmbeddingText } from './embedding-text';

const curriculo = (o: Partial<ParsedResume> = {}): ParsedResume => ({
  summary: 'Desenvolvedora front-end com 5 anos de experiência.',
  skills: ['React', 'TypeScript'],
  experiences: [
    {
      company: 'Empresa Fictícia',
      role: 'Desenvolvedora Front-end',
      start: '2021-01',
      end: null,
      description: 'Construí o painel de vendas.',
    },
  ],
  education: [{ institution: 'Universidade X', course: 'Computação', end: null }],
  languages: [{ name: 'Inglês', level: 'avançado' }],
  ...o,
});

describe('jobEmbeddingText', () => {
  it('junta título e descrição e corta textos enormes', () => {
    expect(jobEmbeddingText({ title: 'Dev React', description: 'Stack React.' })).toBe(
      'Dev React\n\nStack React.',
    );
    expect(jobEmbeddingText({ title: 'Dev', description: 'x'.repeat(20_000) })).toHaveLength(8000);
  });
});

describe('resumeEmbeddingText', () => {
  it('usa resumo, habilidades e experiências, sem formação nem idiomas', () => {
    const texto = resumeEmbeddingText(curriculo());

    expect(texto).toBe(
      [
        'Desenvolvedora front-end com 5 anos de experiência.',
        'Habilidades: React, TypeScript',
        'Desenvolvedora Front-end (Empresa Fictícia): Construí o painel de vendas.',
      ].join('\n\n'),
    );
    expect(texto).not.toContain('Universidade');
    expect(texto).not.toContain('Inglês');
  });

  it('pula o que estiver vazio', () => {
    const texto = resumeEmbeddingText(
      curriculo({
        summary: null,
        skills: [],
        experiences: [
          { company: 'Y', role: 'Analista', start: null, end: null, description: null },
        ],
      }),
    );

    expect(texto).toBe('Analista (Y)');
  });
});
