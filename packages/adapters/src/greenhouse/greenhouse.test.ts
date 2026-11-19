import { NormalizedJob } from '@cv-pilot/contracts';
import { describe, expect, it } from 'vitest';
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
function ctxCom(maxResults = 10) {
  const urls: string[] = [];
  const ctx: AdapterContext = {
    http: async (url) => {
      urls.push(url);
      return new Response(JSON.stringify(board));
    },
    log: () => {},
    maxResults,
  };
  return { ctx, urls };
}

async function baixar(token: string, ctx: AdapterContext) {
  const vagas: GreenhouseRawJob[] = [];
  for await (const raw of greenhouseAdapter.fetch(token, ctx)) vagas.push(raw);
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

describe('greenhouseAdapter.fetch', () => {
  it('baixa o board inteiro com o conteúdo, sem filtrar pelo perfil', async () => {
    const { ctx, urls } = ctxCom();

    const vagas = await baixar('gitlab', ctx);
    expect(vagas).toHaveLength(board.jobs.length);
    expect(vagas.every((v) => v._board === 'gitlab')).toBe(true);
    expect(urls).toEqual(['https://boards-api.greenhouse.io/v1/boards/gitlab/jobs?content=true']);
  });

  it('para no limite de vagas por execução', async () => {
    const { ctx } = ctxCom(1);

    expect(await baixar('gitlab', ctx)).toHaveLength(1);
  });

  it('board sem vagas não devolve nada', async () => {
    const ctx: AdapterContext = {
      http: async () => new Response(JSON.stringify({})),
      log: () => {},
      maxResults: 10,
    };

    expect(await baixar('vazio', ctx)).toEqual([]);
  });
});
