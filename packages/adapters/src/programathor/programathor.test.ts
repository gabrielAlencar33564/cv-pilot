import { readFileSync } from 'node:fs';
import { NormalizedJob } from '@cv-pilot/contracts';
import { describe, expect, it } from 'vitest';
import type { ListedJob } from '../listed-job';
import type { AdapterContext } from '../types';
import { parseProgramaThorListing, programathorAdapter } from './index';

// Teste de contrato: páginas reais de 2026-11-19, reduzidas a três cards (sem as imagens, que
// vinham com URLs assinadas) e a um JobPosting com a descrição encurtada.
const fixture = (nome: string) =>
  readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), 'utf-8');
const LISTAGEM = fixture('listagem.html');
const VAGA = fixture('vaga-33886.html');

function ctxCom(responder: (url: string) => string, maxResults = 100) {
  const urls: string[] = [];
  const ctx: AdapterContext = {
    http: async (url) => {
      urls.push(url);
      return new Response(responder(url));
    },
    log: () => {},
    maxResults,
  };
  return { ctx, urls };
}

async function baixar(ctx: AdapterContext) {
  const vagas: ListedJob[] = [];
  for await (const raw of programathorAdapter.fetch('', ctx)) vagas.push(raw);
  return vagas;
}

describe('parseProgramaThorListing', () => {
  it('lê id, link, título, empresa e os termos do card', () => {
    const [primeira] = parseProgramaThorListing(LISTAGEM);

    expect(primeira).toMatchObject({
      id: '33724',
      url: 'https://programathor.com.br/jobs/33724-desenvolvedor-a-mobile-flutter-senior',
      title: 'Desenvolvedor(a) Mobile Flutter - Sênior',
      company: 'Ubuntu Future Labs',
      // "Remoto" no lugar do local é o modelo de trabalho, não uma cidade
      location: null,
    });
    for (const termo of ['Remoto', 'Sênior', 'PJ']) expect(primeira?.terms).toContain(termo);
  });

  it('lê todos os cards da página', () => {
    expect(parseProgramaThorListing(LISTAGEM).map((v) => v.id)).toEqual([
      '33724',
      '33685',
      '33924',
    ]);
  });
});

describe('programathorAdapter.fetch', () => {
  it('começa em /jobs, segue em /jobs/page/N e para sem vagas novas', async () => {
    const { ctx, urls } = ctxCom(() => LISTAGEM);

    expect(await baixar(ctx)).toHaveLength(3);
    expect(urls).toEqual([
      'https://programathor.com.br/jobs',
      'https://programathor.com.br/jobs/page/2',
    ]);
  });

  it('para no limite de vagas por execução', async () => {
    const { ctx } = ctxCom(() => LISTAGEM, 1);

    expect(await baixar(ctx)).toHaveLength(1);
  });
});

describe('programathorAdapter.normalize', () => {
  it('junta o card e o JobPosting no contrato interno', async () => {
    const listada: ListedJob = {
      id: '33886',
      url: 'https://programathor.com.br/jobs/33886-python-developer',
      title: 'Python Developer',
      company: 'Botcity',
      location: null,
      terms: ['Botcity', 'Remoto', 'Startup', 'Pleno', 'PJ'],
    };
    const { ctx } = ctxCom(() => VAGA);
    const completa = await programathorAdapter.detail?.fetch(listada, ctx);
    if (!completa) throw new Error('o ProgramaThor tem detail');

    const vaga = programathorAdapter.normalize(completa);
    expect(() => NormalizedJob.parse(vaga)).not.toThrow();
    expect(vaga).toMatchObject({
      sourceId: 'programathor',
      externalId: '33886',
      title: 'Python Developer',
      company: 'Botcity',
      workModel: 'remote',
      seniority: 'mid',
      contractType: 'pj',
      salaryMin: null,
    });
    // a descrição vem em HTML no JSON-LD
    expect(vaga.description).toContain('Git, Python, API, Docker');
    expect(vaga.description).not.toMatch(/<h3>|<p>/);
  });
});
