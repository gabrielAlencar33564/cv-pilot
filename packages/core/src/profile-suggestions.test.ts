import type { ParsedResume } from '@cv-pilot/contracts';
import { describe, expect, it } from 'vitest';
import { suggestSearchProfiles } from './profile-suggestions';

const now = new Date('2026-11-19T12:00:00Z');

type Experience = ParsedResume['experiences'][number];

const experiencia = (o: Partial<Experience>): Experience => ({
  company: 'Empresa',
  role: 'Desenvolvedor',
  start: null,
  end: null,
  description: null,
  ...o,
});

const curriculo = (o: Partial<ParsedResume> = {}): ParsedResume => ({
  summary: null,
  skills: [],
  experiences: [],
  education: [],
  languages: [],
  ...o,
});

describe('suggestSearchProfiles', () => {
  it('o cargo atual vira o primeiro perfil, com as habilidades como palavras-chave', () => {
    const [perfil] = suggestSearchProfiles(
      curriculo({
        skills: ['React', 'TypeScript', 'Node.js'],
        experiences: [
          experiencia({ role: 'Desenvolvedor Front-end', start: '2022-01', end: '2022-12' }),
          experiencia({ role: 'Desenvolvedor Full Stack', start: '2023-01', end: null }),
        ],
      }),
      now,
    );

    expect(perfil).toEqual({
      name: 'Desenvolvedor Full Stack',
      keywords: ['Desenvolvedor Full Stack', 'React', 'TypeScript', 'Node.js'],
      seniorities: ['mid'],
    });
  });

  it('sugere no máximo dois perfis, sem repetir o mesmo cargo', () => {
    const perfis = suggestSearchProfiles(
      curriculo({
        experiences: [
          experiencia({ role: 'Analista de Dados', end: null }),
          experiencia({ role: 'analista de dados ', end: '2022' }),
          experiencia({ role: 'Analista de BI', end: '2021' }),
          experiencia({ role: 'Assistente Administrativo', end: '2019' }),
        ],
      }),
      now,
    );

    expect(perfis.map((p) => p.name)).toEqual(['Analista de Dados', 'Analista de BI']);
  });

  it('a senioridade escrita no cargo vale mais que os anos de carreira', () => {
    const [perfil] = suggestSearchProfiles(
      curriculo({
        experiences: [experiencia({ role: 'Engenheira de Software Sênior', start: '2025-01' })],
      }),
      now,
    );

    expect(perfil?.seniorities).toEqual(['senior']);
    // a palavra-chave fica sem a senioridade, para casar com mais vagas
    expect(perfil?.keywords[0]).toBe('Engenheira de Software');
  });

  it('cargos de mesma função com senioridades diferentes contam como um só', () => {
    const perfis = suggestSearchProfiles(
      curriculo({
        experiences: [
          experiencia({ role: 'Dev Back-end Pleno', end: null }),
          experiencia({ role: 'Dev Back-end Júnior', end: '2022' }),
        ],
      }),
      now,
    );

    expect(perfis).toHaveLength(1);
  });

  it.each([
    ['Estagiária de Marketing', 'intern', 'de Marketing'],
    ['Tech Lead', 'lead', 'Tech Lead'],
    ['Gerente de Projetos', 'manager', 'de Projetos'],
    ['Desenvolvedor Jr.', 'junior', 'Desenvolvedor'],
  ])('reconhece a senioridade em "%s"', (role, seniority, keyword) => {
    const [perfil] = suggestSearchProfiles(
      curriculo({ experiences: [experiencia({ role })] }),
      now,
    );

    expect(perfil?.seniorities).toEqual([seniority]);
    expect(perfil?.keywords[0]).toBe(keyword);
  });

  it.each([
    ['2025-06', 'junior'],
    ['2022-01', 'mid'],
    ['2018', 'senior'],
  ])('sem senioridade no cargo, carreira desde %s indica %s', (start, seniority) => {
    const [perfil] = suggestSearchProfiles(
      curriculo({ experiences: [experiencia({ role: 'Designer', start })] }),
      now,
    );

    expect(perfil?.seniorities).toEqual([seniority]);
  });

  it('sem datas, não chuta a senioridade', () => {
    const [perfil] = suggestSearchProfiles(
      curriculo({ experiences: [experiencia({ role: 'Designer' })] }),
      now,
    );

    expect(perfil?.seniorities).toEqual([]);
  });

  it('usa só as primeiras habilidades, sem repetidas, para não diluir a nota', () => {
    const [perfil] = suggestSearchProfiles(
      curriculo({
        skills: ['SQL', 'sql', 'Python', 'Power BI', 'Excel', 'Tableau'],
        experiences: [experiencia({ role: 'Analista de Dados' })],
      }),
      now,
    );

    expect(perfil?.keywords).toEqual(['Analista de Dados', 'SQL', 'Python', 'Power BI', 'Excel']);
  });

  it('sem experiência, sugere um perfil pelas habilidades', () => {
    expect(suggestSearchProfiles(curriculo({ skills: ['Java', 'Spring', 'SQL'] }), now)).toEqual([
      { name: 'Vagas de Java e Spring', keywords: ['Java', 'Spring', 'SQL'], seniorities: [] },
    ]);
  });

  it('currículo sem cargos nem habilidades não gera sugestão', () => {
    expect(suggestSearchProfiles(curriculo(), now)).toEqual([]);
  });
});
