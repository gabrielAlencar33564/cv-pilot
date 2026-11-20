import { readFileSync } from 'node:fs';
import { NormalizedJob } from '@cv-pilot/contracts';
import { describe, expect, it, vi } from 'vitest';
import { SourceHttpError } from '../http';
import type { ListedJob } from '../listed-job';
import { recognizeAtsUrl } from '../registry';
import type { AdapterContext } from '../types';
import { parseTotvsBoard, totvsAdapter } from './index';

// Teste de contrato: páginas reais de 2026-11-20 (empresa eureciclo), reduzidas a dois cards e a
// um JobPosting com a descrição encurtada. Quando a TOTVS mudar o HTML, atualize as fixtures.
const fixture = (nome: string) =>
  readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), 'utf-8');
const EMPRESA = fixture('empresa.html');
const VAGA = fixture('vaga-35.html');

/** Contexto com http falso: a resposta pode trazer a URL final, depois dos redirecionamentos. */
function ctxCom(responder: (url: string) => { body: string; finalUrl?: string }, maxResults = 100) {
  const pedidos: string[] = [];
  const ctx: AdapterContext = {
    http: async (url) => {
      pedidos.push(url);
      const { body, finalUrl } = responder(url);
      const res = new Response(body);
      Object.defineProperty(res, 'url', { value: finalUrl ?? url });
      return res;
    },
    log: vi.fn(),
    maxResults,
  };
  return { ctx, pedidos };
}

async function baixar(board: string, ctx: AdapterContext) {
  const vagas: ListedJob[] = [];
  for await (const raw of totvsAdapter.fetch(board, ctx)) vagas.push(raw);
  return vagas;
}

describe('parseTotvsBoard', () => {
  it('lê id (com a empresa), link, título e local de cada card', () => {
    const [primeira, segunda] = parseTotvsBoard('eureciclo', EMPRESA);

    expect(primeira).toEqual({
      id: 'eureciclo:35',
      url: 'https://atracaodetalentos.totvs.app/eureciclo/35/especialista-em-sucesso-do-cliente-ka',
      title: 'Especialista em Sucesso do Cliente KA',
      company: null,
      location: 'São Paulo - SP',
      terms: [],
    });
    expect(segunda?.id).toBe('eureciclo:30');
  });

  it('página sem cards não devolve nada', () => {
    expect(parseTotvsBoard('x', '<html><body></body></html>')).toEqual([]);
  });
});

describe('totvsAdapter.fetch', () => {
  it('lê a página da empresa uma vez e devolve os cards', async () => {
    const { ctx, pedidos } = ctxCom(() => ({
      body: EMPRESA,
      finalUrl: 'https://atracaodetalentos.totvs.app/eureciclo/extended',
    }));

    expect(await baixar('eureciclo', ctx)).toHaveLength(2);
    expect(pedidos).toEqual(['https://atracaodetalentos.totvs.app/eureciclo']);
  });

  it('respeita o limite de vagas por execução', async () => {
    const { ctx } = ctxCom(() => ({ body: EMPRESA }), 1);

    expect(await baixar('eureciclo', ctx)).toHaveLength(1);
  });

  it('empresa que não existe (redireciona para ?status=404) vira 404', async () => {
    const { ctx } = ctxCom(() => ({
      body: '<html></html>',
      finalUrl: 'https://atracaodetalentos.totvs.app/?status=404',
    }));

    await expect(baixar('naoexiste', ctx)).rejects.toBeInstanceOf(SourceHttpError);
    await expect(baixar('naoexiste', ctx)).rejects.toMatchObject({ status: 404 });
  });
});

describe('totvsAdapter: detalhe e normalização', () => {
  it('junta o card e o JobPosting no formato interno', async () => {
    const [card] = parseTotvsBoard('eureciclo', EMPRESA);
    const { ctx } = ctxCom(() => ({ body: VAGA }));
    const vaga = await totvsAdapter.detail?.fetch(card as ListedJob, ctx);

    const normalizada = NormalizedJob.parse(totvsAdapter.normalize(vaga as ListedJob));
    expect(normalizada).toMatchObject({
      sourceId: 'totvs',
      externalId: 'eureciclo:35',
      title: 'Especialista em Sucesso do Cliente KA',
      company: 'eureciclo',
      location: 'São Paulo - SP',
      contractType: 'pj',
      publishedAt: new Date('2026-11-19T20:07:26'),
    });
    expect(normalizada.description).toContain('Especialista em Sucesso do Cliente KA');
    expect(normalizada.description).not.toContain('<strong>');
  });

  it('o detalhe usa o id da listagem, que é o externalId', () => {
    const [card] = parseTotvsBoard('eureciclo', EMPRESA);

    expect(totvsAdapter.detail?.idOf(card as ListedJob)).toBe('eureciclo:35');
  });
});

describe('totvsAdapter.recognize', () => {
  it.each([
    'https://atracaodetalentos.totvs.app/eureciclo',
    'https://atracaodetalentos.totvs.app/eureciclo/35/especialista-em-sucesso-do-cliente-ka',
  ])('%s é o board eureciclo', (href) => {
    expect(recognizeAtsUrl(href)).toEqual({ kind: 'board', sourceId: 'totvs', token: 'eureciclo' });
  });
});
