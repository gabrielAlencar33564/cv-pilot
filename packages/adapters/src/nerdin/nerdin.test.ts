import { readFileSync } from 'node:fs';
import { NormalizedJob } from '@cv-pilot/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { ListedJob } from '../listed-job';
import type { AdapterContext } from '../types';
import { nerdinAdapter, parseNerdinListing } from './index';

// Teste de contrato: páginas reais de 2026-11-19, reduzidas a três cards e a um JobPosting com a
// descrição encurtada. Quando a Nerdin mudar o HTML, atualize as fixtures e o parser.
const fixture = (nome: string) =>
  readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), 'utf-8');
const LISTAGEM = fixture('listagem.html');
const VAGA = fixture('vaga-94161.html');

/** Contexto com http falso: responde pela URL e guarda o que foi pedido. */
function ctxCom(responder: (url: string) => string, maxResults = 100) {
  const pedidos: { url: string; accept?: string }[] = [];
  const log = vi.fn();
  const ctx: AdapterContext = {
    http: async (url, init) => {
      pedidos.push({ url, accept: (init?.headers as Record<string, string> | undefined)?.Accept });
      return new Response(responder(url));
    },
    log,
    maxResults,
  };
  return { ctx, pedidos, log };
}

async function baixar(ctx: AdapterContext) {
  const vagas: ListedJob[] = [];
  for await (const raw of nerdinAdapter.fetch('', ctx)) vagas.push(raw);
  return vagas;
}

describe('parseNerdinListing', () => {
  it('lê id, link, título sem o selo "Nova", empresa, local e termos de cada card', () => {
    const [primeira] = parseNerdinListing(LISTAGEM);

    expect(primeira).toEqual({
      id: '94161',
      url: 'https://www.nerdin.com.br/vaga_emprego/vaga-instrutor-de-jogos-digitais-itu-94161.php',
      title: 'Instrutor de Jogos digitais - Itú',
      company: 'ASSINCO CURSOS',
      location: 'Itu - SP',
      terms: ['PJ', 'Junior'],
    });
  });

  it('lê todos os cards da página', () => {
    expect(parseNerdinListing(LISTAGEM).map((v) => v.terms)).toEqual([
      ['PJ', 'Junior'],
      ['CLT, PJ', 'Senior', 'Home Office'],
      ['PJ', 'Junior', 'Híbrido'],
    ]);
  });

  it('página sem cards não devolve nada', () => {
    expect(parseNerdinListing('<html><body></body></html>')).toEqual([]);
  });
});

describe('nerdinAdapter.fetch', () => {
  it('pagina até uma página sem vagas novas e pede HTML', async () => {
    // a segunda página repete a primeira, como o site faz depois da última
    const { ctx, pedidos } = ctxCom(() => LISTAGEM);

    expect(await baixar(ctx)).toHaveLength(3);
    expect(pedidos).toEqual([
      { url: 'https://www.nerdin.com.br/vagas.php?pagina=1', accept: 'text/html' },
      { url: 'https://www.nerdin.com.br/vagas.php?pagina=2', accept: 'text/html' },
    ]);
  });

  it('para no limite de vagas por execução', async () => {
    const { ctx, pedidos } = ctxCom(() => LISTAGEM, 2);

    expect(await baixar(ctx)).toHaveLength(2);
    expect(pedidos).toHaveLength(1);
  });
});

describe('nerdinAdapter.detail e normalize', () => {
  const [listada] = parseNerdinListing(LISTAGEM);
  if (!listada) throw new Error('a fixture não tem cards');

  it('baixa a página da vaga, lê o JobPosting e normaliza para o contrato interno', async () => {
    const { ctx } = ctxCom(() => VAGA);
    const completa = await nerdinAdapter.detail?.fetch(listada, ctx);
    if (!completa) throw new Error('a Nerdin tem detail');

    const vaga = nerdinAdapter.normalize(completa);
    expect(() => NormalizedJob.parse(vaga)).not.toThrow();
    expect(vaga).toMatchObject({
      sourceId: 'nerdin',
      externalId: '94161',
      title: 'Instrutor de Jogos digitais - Itú',
      company: 'ASSINCO CURSOS',
      location: 'Itu - SP',
      contractType: 'pj',
      seniority: 'junior',
      workModel: null,
      salaryMin: 3000,
      salaryMax: 3700,
      publishedAt: new Date('2026-03-24T00:00:00'),
    });
    expect(vaga.description).toContain('Ensinar lógica de programação');
  });

  it('o id da vaga vem da listagem, sem baixar a página', () => {
    expect(nerdinAdapter.detail?.idOf(listada)).toBe('94161');
  });

  it('página sem JobPosting avisa no log e normaliza pelo card', async () => {
    const { ctx, log } = ctxCom(() => '<html></html>');
    const semDados = await nerdinAdapter.detail?.fetch(listada, ctx);
    if (!semDados) throw new Error('a Nerdin tem detail');

    expect(log).toHaveBeenCalledWith('página de vaga sem JobPosting', { url: listada.url });
    expect(nerdinAdapter.normalize(semDados)).toMatchObject({
      title: 'Instrutor de Jogos digitais - Itú',
      company: 'ASSINCO CURSOS',
      description: '',
    });
  });
});
