import type { JobRequirement, ParsedResume } from '@cv-pilot/contracts';
import { describe, expect, it } from 'vitest';
import { requirementsCheck } from './requirements-check';

const curriculo: ParsedResume = {
  summary: 'Desenvolvedora front-end com foco em acessibilidade.',
  skills: ['React', 'Node.js'],
  experiences: [
    {
      company: 'Empresa X',
      role: 'Desenvolvedora Front-end',
      start: '2022-01',
      end: null,
      description: 'Migração do app para TypeScript e testes com Jest.',
    },
  ],
  education: [{ institution: 'Universidade Y', course: 'Ciência da Computação', end: '2021' }],
  languages: [{ name: 'Inglês', level: 'avançado' }],
};

const requisito = (name: string, o: Partial<JobRequirement> = {}): JobRequirement => ({
  name,
  aliases: [],
  required: true,
  ...o,
});

const nomes = (lista: JobRequirement[]) => lista.map((r) => r.name);

describe('requirementsCheck', () => {
  it('separa o que o currículo mostra do que falta, na ordem da vaga', () => {
    const { met, missing } = requirementsCheck(
      [requisito('React'), requisito('Docker'), requisito('Node.js'), requisito('AWS')],
      curriculo,
    );

    expect(nomes(met)).toEqual(['React', 'Node.js']);
    expect(nomes(missing)).toEqual(['Docker', 'AWS']);
  });

  it('procura nas experiências, na formação e nos idiomas, não só nas habilidades', () => {
    const { missing } = requirementsCheck(
      [requisito('TypeScript'), requisito('Ciência da Computação'), requisito('Inglês')],
      curriculo,
    );

    expect(missing).toEqual([]);
  });

  it('um sinônimo no currículo conta como o requisito', () => {
    const { met } = requirementsCheck(
      [requisito('JavaScript', { aliases: ['JS', 'Node.js'] })],
      curriculo,
    );

    expect(nomes(met)).toEqual(['JavaScript']);
  });

  it('alternativas: basta uma delas', () => {
    const { met } = requirementsCheck(
      [requisito('React ou Vue', { aliases: ['React', 'Vue'] })],
      curriculo,
    );

    expect(nomes(met)).toEqual(['React ou Vue']);
  });

  it('casa por termo inteiro e sem acento: "Java" não é "JavaScript", "ingles" é "Inglês"', () => {
    const { met, missing } = requirementsCheck([requisito('Java'), requisito('ingles')], curriculo);

    expect(nomes(missing)).toEqual(['Java']);
    expect(nomes(met)).toEqual(['ingles']);
  });

  it('mantém se o requisito é obrigatório ou diferencial', () => {
    const { missing } = requirementsCheck(
      [requisito('Kubernetes', { required: false })],
      curriculo,
    );

    expect(missing).toEqual([{ name: 'Kubernetes', aliases: [], required: false }]);
  });

  it('vaga sem requisitos não tem nada faltando', () => {
    expect(requirementsCheck([], curriculo)).toEqual({ missing: [], met: [] });
  });
});
