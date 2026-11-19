import { describe, expect, it } from 'vitest';
import { ruleBasedScore } from './scoring';

type Job = Parameters<typeof ruleBasedScore>[0];
type Profile = Parameters<typeof ruleBasedScore>[1];

const umaVaga = (o: Partial<Job> = {}): Job => ({
  title: 'Desenvolvedor',
  company: 'Empresa X',
  description: '',
  workModel: 'remote',
  location: null,
  seniority: null,
  contractType: null,
  salaryMin: null,
  salaryMax: null,
  ...o,
});

const umPerfil = (o: Partial<Profile> = {}): Profile => ({ keywords: ['react'], ...o });

describe('ruleBasedScore: palavras-chave', () => {
  it.each([
    ['java', 'Vaga para desenvolvedor JavaScript'],
    ['go', 'Conhecimento em algoritmos'],
    ['react', 'Programação reactive com RxJS'],
  ])('"%s" não casa com parte de outra palavra', (keyword, description) => {
    const { score } = ruleBasedScore(umaVaga({ description }), umPerfil({ keywords: [keyword] }));
    expect(score).toBe(0);
  });

  it('casa a palavra inteira ignorando caixa, acentos e pontuação', () => {
    const resultado = ruleBasedScore(
      umaVaga({ description: 'Experiência com REACT, boa comunicação.' }),
      umPerfil({ keywords: ['react', 'comunicacao'] }),
    );
    expect(resultado.reasons).toContain('Palavras-chave: react, comunicacao');
  });

  it('reconhece termos com símbolos: c#, c++, node.js e .net', () => {
    const { reasons } = ruleBasedScore(
      umaVaga({ description: 'Stack: C#, C++ e Node.js. Desejável .NET.' }),
      umPerfil({ keywords: ['c#', 'c++', 'node.js', '.net'] }),
    );
    expect(reasons).toContain('Palavras-chave: c#, c++, node.js, .net');
  });

  it('palavra-chave composta casa como frase, na ordem', () => {
    const perfil = umPerfil({ keywords: ['react native'] });
    expect(ruleBasedScore(umaVaga({ description: 'Apps em React Native' }), perfil).score).toBe(70);
    expect(ruleBasedScore(umaVaga({ description: 'React e apps native' }), perfil).score).toBe(0);
  });

  it('dá nota máxima com todas as palavras-chave e o cargo no título', () => {
    const { score } = ruleBasedScore(
      umaVaga({ title: 'Dev React', description: 'TypeScript' }),
      umPerfil({ keywords: ['react', 'typescript'] }),
    );
    expect(score).toBe(100);
  });
});

describe('ruleBasedScore: regras rígidas', () => {
  const bloqueia = (vaga: Partial<Job>, perfil: Partial<Profile>) =>
    ruleBasedScore(umaVaga({ description: 'react', ...vaga }), umPerfil(perfil));

  it('bloqueia termo excluído só quando aparece inteiro', () => {
    expect(bloqueia({ title: 'Estágio em TI' }, { excludeKeywords: ['estágio'] })).toMatchObject({
      blocked: true,
      reasons: ['Contém termo excluído: estágio'],
    });
    expect(bloqueia({ title: 'Estagiário' }, { excludeKeywords: ['estágio'] }).blocked).toBe(false);
  });

  it('bloqueia empresa da lista de exclusão', () => {
    expect(bloqueia({ company: 'Nubank S.A.' }, { companyBlacklist: ['nubank'] }).blocked).toBe(
      true,
    );
  });

  it('bloqueia senioridade fora da lista; senioridade desconhecida passa', () => {
    expect(bloqueia({ seniority: 'junior' }, { seniorities: ['senior'] })).toMatchObject({
      blocked: true,
      reasons: ['Senioridade diferente'],
    });
    expect(bloqueia({ seniority: null }, { seniorities: ['senior'] }).blocked).toBe(false);
  });

  it('bloqueia tipo de contrato fora da lista', () => {
    expect(bloqueia({ contractType: 'pj' }, { contractTypes: ['clt'] })).toMatchObject({
      blocked: true,
      reasons: ['Tipo de contrato diferente'],
    });
  });

  it('bloqueia salário fora da faixa do perfil; salário desconhecido passa', () => {
    expect(bloqueia({ salaryMax: 8000 }, { salaryMin: 10000 })).toMatchObject({
      blocked: true,
      reasons: ['Salário abaixo do mínimo do perfil'],
    });
    expect(bloqueia({ salaryMin: 20000 }, { salaryMax: 12000 })).toMatchObject({
      blocked: true,
      reasons: ['Salário acima da faixa do perfil'],
    });
    expect(bloqueia({}, { salaryMin: 10000, salaryMax: 12000 }).blocked).toBe(false);
  });

  it('bloqueia vaga presencial em outra cidade, mas não vaga remota', () => {
    const perfil = { location: 'São Paulo' };
    expect(
      bloqueia({ workModel: 'onsite', location: 'Rio de Janeiro - RJ' }, perfil),
    ).toMatchObject({ blocked: true, reasons: ['Fora da localização do perfil'] });
    expect(bloqueia({ workModel: 'onsite', location: 'Sao Paulo - SP' }, perfil).blocked).toBe(
      false,
    );
    expect(bloqueia({ workModel: 'remote', location: 'Rio de Janeiro' }, perfil).blocked).toBe(
      false,
    );
  });

  it('bloqueia modelo de trabalho fora da lista', () => {
    expect(bloqueia({ workModel: 'onsite' }, { workModels: ['remote'] }).blocked).toBe(true);
  });
});
