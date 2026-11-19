import { NormalizedJob } from '@cv-pilot/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../types';
import postings from './fixtures/postings-leverdemo.json';
import { leverAdapter, type LeverRawJob } from './index';

// Teste de contrato: resposta real da Postings API (empresa de demonstração "leverdemo"),
// reduzida e com a descrição trocada por um trecho neutro (a original citava uma pessoa).
function vagaDaFixture(indice: number): LeverRawJob {
  const posting = postings[indice];
  if (!posting) throw new Error(`a fixture não tem a vaga ${indice}`);
  // o JSON importado tipa workplaceType como string; os valores vêm da própria API do Lever
  return {
    ...posting,
    workplaceType: posting.workplaceType as LeverRawJob['workplaceType'],
    _company: 'leverdemo',
  };
}
const remota = vagaDaFixture(0);
const hibrida = vagaDaFixture(1);
const presencial = vagaDaFixture(2);

function ctxCom(companies: string[], maxResults = 10) {
  const urls: string[] = [];
  const ctx: AdapterContext = {
    http: async (url) => {
      urls.push(url);
      return new Response(JSON.stringify(postings));
    },
    config: { companies },
    log: vi.fn(),
    maxResults,
  };
  return { ctx, urls };
}

async function buscar(keywords: string[], ctx: AdapterContext) {
  const vagas: LeverRawJob[] = [];
  for await (const raw of leverAdapter.search({ keywords }, ctx)) vagas.push(raw);
  return vagas;
}

describe('leverAdapter.normalize', () => {
  it('converte a vaga para o contrato interno', () => {
    for (const vaga of [remota, hibrida, presencial]) {
      expect(() => NormalizedJob.parse(leverAdapter.normalize(vaga))).not.toThrow();
    }
  });

  it('mapeia id, título, empresa, local, link e data de criação', () => {
    expect(leverAdapter.normalize(hibrida)).toMatchObject({
      sourceId: 'lever',
      externalId: 'ad208490-4052-4f91-a57e-433f2d1e484b',
      title: 'Customer Success Manager',
      company: 'leverdemo',
      location: 'Atlanta, Georgia',
      url: 'https://jobs.lever.co/leverdemo/ad208490-4052-4f91-a57e-433f2d1e484b',
      publishedAt: new Date(1788199939703),
    });
  });

  it('traduz o workplaceType e trata "unspecified" como desconhecido', () => {
    expect(leverAdapter.normalize(remota).workModel).toBe('remote');
    expect(leverAdapter.normalize(hibrida).workModel).toBe('hybrid');
    expect(leverAdapter.normalize(presencial).workModel).toBe('onsite');
    expect(
      leverAdapter.normalize({ ...remota, workplaceType: 'unspecified' }).workModel,
    ).toBeNull();
  });
});

describe('leverAdapter.search', () => {
  it('busca a empresa em JSON e filtra pelo título', async () => {
    const { ctx, urls } = ctxCom(['leverdemo']);

    const vagas = await buscar(['engineer'], ctx);
    expect(vagas.map((v) => v.text)).toEqual(['Senior Sales Engineer']);
    expect(urls).toEqual(['https://api.lever.co/v0/postings/leverdemo?mode=json']);
  });

  it('para no limite de vagas por execução, mesmo com várias empresas', async () => {
    const { ctx, urls } = ctxCom(['leverdemo', 'outra-empresa'], 2);

    expect(await buscar(['senior'], ctx)).toHaveLength(2);
    expect(urls).toHaveLength(1);
  });
});
