import { NormalizedJob } from '@cv-pilot/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { AdapterContext } from '../types';
import board from './fixtures/board-gitlab.json';
import { greenhouseAdapter, type GreenhouseRawJob } from './index';

// Teste de contrato: resposta real da Job Board API (board "gitlab"), reduzida e sem dados pessoais.
// Quando o Greenhouse mudar o formato, atualize a fixture e o normalize().
function vagaDaFixture(indice: number): GreenhouseRawJob {
  const job = board.jobs[indice];
  if (!job) throw new Error(`a fixture não tem a vaga ${indice}`);
  return { ...job, _board: 'gitlab' };
}
const remota = vagaDaFixture(0);
const presencial = vagaDaFixture(1);

/** Contexto com http falso: devolve a mesma página para qualquer board e guarda as URLs. */
function ctxCom(boards: string[], maxResults = 10) {
  const urls: string[] = [];
  const log = vi.fn();
  const ctx: AdapterContext = {
    http: async (url) => {
      urls.push(url);
      return new Response(JSON.stringify(board));
    },
    config: { boards },
    log,
    maxResults,
  };
  return { ctx, urls, log };
}

async function buscar(keywords: string[], ctx: AdapterContext) {
  const vagas: GreenhouseRawJob[] = [];
  for await (const raw of greenhouseAdapter.search({ keywords }, ctx)) vagas.push(raw);
  return vagas;
}

describe('greenhouseAdapter.normalize', () => {
  it('converte a vaga para o contrato interno', () => {
    expect(() => NormalizedJob.parse(greenhouseAdapter.normalize(remota))).not.toThrow();
  });

  it('mapeia id com o board, empresa, link e data', () => {
    expect(greenhouseAdapter.normalize(remota)).toMatchObject({
      sourceId: 'greenhouse',
      externalId: 'gitlab:8771512002',
      company: 'GitLab',
      url: 'https://job-boards.greenhouse.io/gitlab/jobs/8771512002',
      publishedAt: expect.any(Date) as Date,
    });
  });

  it('decodifica o HTML escapado do conteúdo em texto puro', () => {
    const { description } = greenhouseAdapter.normalize(remota);
    expect(description).toContain('GitLab is the intelligent orchestration platform for DevSecOps');
    expect(description).not.toMatch(/<|&lt;|&quot;/);
  });

  it('reconhece vaga remota pelo local e deixa as demais sem modelo de trabalho', () => {
    expect(greenhouseAdapter.normalize(remota).workModel).toBe('remote');
    expect(greenhouseAdapter.normalize(presencial)).toMatchObject({
      location: 'Bangalore, India',
      workModel: null,
    });
  });
});

describe('greenhouseAdapter.search', () => {
  it('busca cada board com o conteúdo e filtra pelo título', async () => {
    const { ctx, urls } = ctxCom(['gitlab']);

    const vagas = await buscar(['engineer'], ctx);
    expect(vagas.map((v) => v.title)).toEqual(['Backend Engineer, GitLab Orbit']);
    expect(urls).toEqual(['https://boards-api.greenhouse.io/v1/boards/gitlab/jobs?content=true']);
  });

  it('percorre todos os boards configurados', async () => {
    const { ctx, urls } = ctxCom(['gitlab', 'outra-empresa']);

    const vagas = await buscar(['engineer'], ctx);
    expect(urls).toHaveLength(2);
    expect(vagas.map((v) => v._board)).toEqual(['gitlab', 'outra-empresa']);
  });

  it('para no limite de vagas por execução', async () => {
    const { ctx, urls } = ctxCom(['gitlab', 'outra-empresa'], 1);

    expect(await buscar(['engineer'], ctx)).toHaveLength(1);
    expect(urls).toHaveLength(1);
  });

  it('sem boards configurados, avisa e não busca nada', async () => {
    const { ctx, urls, log } = ctxCom([]);

    expect(await buscar(['engineer'], ctx)).toEqual([]);
    expect(urls).toEqual([]);
    expect(log).toHaveBeenCalled();
  });
});
