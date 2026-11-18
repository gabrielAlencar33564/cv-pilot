import { describe, expect, it } from 'vitest';
import { gupyAdapter } from './index';

// Teste de contrato: fixture no formato esperado da API.
// Quando a Gupy mudar o formato, atualize a fixture e o normalize().
const fixture = {
  id: 123,
  name: 'Desenvolvedor Front-end Pleno',
  description: 'React,&nbsp;<b>TypeScript</b>',
  careerPageName: 'Empresa X',
  jobUrl: 'https://empresax.gupy.io/jobs/123',
  type: 'vacancy_legal_entity',
  workplaceType: 'on-site' as const,
  city: 'São Paulo',
  state: 'SP',
  publishedDate: '2026-11-01T10:00:00.000Z',
};

describe('gupyAdapter.normalize', () => {
  it('converte para o formato interno', () => {
    const job = gupyAdapter.normalize(fixture);
    expect(job).toMatchObject({
      sourceId: 'gupy',
      externalId: '123',
      company: 'Empresa X',
      location: 'São Paulo - SP',
      workModel: 'onsite',
      contractType: 'pj',
      description: 'React, TypeScript',
    });
  });
});
