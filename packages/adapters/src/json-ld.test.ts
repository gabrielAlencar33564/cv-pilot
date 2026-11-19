import { describe, expect, it } from 'vitest';
import {
  findJobPosting,
  postingContractType,
  postingDate,
  postingLocation,
  postingMonthlySalary,
  type JobPostingLd,
} from './json-ld';

const pagina = (...blocos: string[]) =>
  `<html><head>${blocos
    .map((b) => `<script type="application/ld+json">${b}</script>`)
    .join('')}</head><body></body></html>`;

const vaga = (o: Partial<JobPostingLd> = {}): JobPostingLd => ({
  title: 'Desenvolvedor',
  description: '',
  ...o,
});

describe('findJobPosting', () => {
  it('acha o JobPosting entre outros blocos e ignora o JSON malformado', () => {
    const html = pagina(
      '{ isto não é json',
      JSON.stringify({ '@type': 'Organization', name: 'Empresa' }),
      JSON.stringify({ '@type': 'JobPosting', title: 'Dev React', description: '<p>React</p>' }),
    );

    expect(findJobPosting(html)).toMatchObject({ title: 'Dev React', description: '<p>React</p>' });
  });

  it('lê listas, @graph e @type em lista', () => {
    const grafo = JSON.stringify({
      '@graph': [{ '@type': 'WebSite' }, { '@type': ['JobPosting'], title: 'Dev Java' }],
    });

    expect(findJobPosting(pagina(grafo))?.title).toBe('Dev Java');
  });

  it('sem JobPosting, ou sem título, devolve null', () => {
    expect(findJobPosting(pagina(JSON.stringify({ '@type': 'WebSite' })))).toBeNull();
    expect(
      findJobPosting(pagina(JSON.stringify({ '@type': 'JobPosting', title: ' ' }))),
    ).toBeNull();
    expect(findJobPosting('<html></html>')).toBeNull();
  });
});

describe('campos do JobPosting', () => {
  it('monta o local como cidade e UF', () => {
    const local = { address: { addressLocality: 'Itu', addressRegion: 'SP' } };

    expect(postingLocation(vaga({ jobLocation: local }))).toBe('Itu - SP');
    expect(postingLocation(vaga({ jobLocation: [local] }))).toBe('Itu - SP');
    expect(postingLocation(vaga())).toBeNull();
  });

  it('traduz o contrato só quando há um tipo inequívoco', () => {
    expect(postingContractType(vaga({ employmentType: ['CONTRACTOR'] }))).toBe('pj');
    expect(postingContractType(vaga({ employmentType: 'INTERN' }))).toBe('internship');
    expect(postingContractType(vaga({ employmentType: 'FULL_TIME' }))).toBeNull();
    expect(postingContractType(vaga({ employmentType: ['CONTRACTOR', 'FULL_TIME'] }))).toBeNull();
  });

  it('lê a faixa salarial mensal em reais e descarta outras unidades ou moedas', () => {
    const faixa = { unitText: 'MONTH', minValue: 3000, maxValue: 3700 };

    expect(postingMonthlySalary(vaga({ baseSalary: { currency: 'BRL', value: faixa } }))).toEqual({
      min: 3000,
      max: 3700,
    });
    expect(
      postingMonthlySalary(
        vaga({ baseSalary: { currency: 'BRL', value: { unitText: 'HOUR', value: 80 } } }),
      ),
    ).toEqual({ min: null, max: null });
    expect(postingMonthlySalary(vaga({ baseSalary: { currency: 'USD', value: faixa } }))).toEqual({
      min: null,
      max: null,
    });
  });

  it('lê a data de publicação e ignora data inválida', () => {
    expect(postingDate(vaga({ datePosted: '2026-03-24T00:00:00' }))).toBeInstanceOf(Date);
    expect(postingDate(vaga({ datePosted: 'ontem' }))).toBeNull();
  });
});
