import { describe, expect, it } from 'vitest';
import type { AdapterContext } from '../types';
import { gupyAdapter, type GupyRawJob } from './index';

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

/** Contexto com http falso que devolve as páginas em ordem e guarda as URLs pedidas. */
function ctxComPaginas(paginas: { data: GupyRawJob[]; total: number }[], maxResults = 200) {
  const urls: string[] = [];
  let chamada = 0;
  const ctx: AdapterContext = {
    http: async (url) => {
      urls.push(url);
      const pagina = paginas[chamada++] ?? { data: [], total: 0 };
      return new Response(
        JSON.stringify({ data: pagina.data, pagination: { total: pagina.total } }),
      );
    },
    log: () => {},
    maxResults,
  };
  return { ctx, urls };
}

const vagasComIds = (inicio: number, quantidade: number): GupyRawJob[] =>
  Array.from({ length: quantidade }, (_, i) => ({ ...fixture, id: inicio + i }));

async function baixar(palavra: string, ctx: AdapterContext) {
  const ids: number[] = [];
  for await (const raw of gupyAdapter.fetch(palavra, ctx)) ids.push(raw.id);
  return ids;
}

describe('gupyAdapter.fetch', () => {
  it('busca pela palavra-chave e pagina até o total', async () => {
    const { ctx, urls } = ctxComPaginas([
      { data: vagasComIds(1, 50), total: 60 },
      { data: vagasComIds(51, 10), total: 60 },
    ]);

    expect(await baixar('react native', ctx)).toHaveLength(60);
    expect(urls).toEqual([
      'https://portal.gupy.io/api/job-search/jobs?jobName=react%20native&limit=50&offset=0',
      'https://portal.gupy.io/api/job-search/jobs?jobName=react%20native&limit=50&offset=50',
    ]);
  });

  it('não repete a mesma vaga entre páginas', async () => {
    const { ctx } = ctxComPaginas([
      { data: vagasComIds(1, 50), total: 100 },
      { data: vagasComIds(1, 3), total: 100 },
    ]);

    expect(await baixar('react', ctx)).toHaveLength(50);
  });

  it('para no limite de vagas por execução', async () => {
    const { ctx, urls } = ctxComPaginas([{ data: vagasComIds(1, 50), total: 500 }], 20);

    expect(await baixar('react', ctx)).toHaveLength(20);
    expect(urls).toHaveLength(1);
  });
});
