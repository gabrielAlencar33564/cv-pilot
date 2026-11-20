import { readFileSync } from 'node:fs';
import { NormalizedJob } from '@cv-pilot/contracts';
import { describe, expect, it, vi } from 'vitest';
import { SourceHttpError } from '../http';
import { recognizeAtsUrl } from '../registry';
import type { AdapterContext } from '../types';
import { solidesAdapter, type SolidesRawJob } from './index';

// Teste de contrato: respostas reais do MCP da Solides de 2026-11-20 ("desenvolvedor react"),
// com as descrições encurtadas. Quando o formato mudar, atualize as fixtures.
const fixture = (nome: string) =>
  readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), 'utf-8');
const BUSCA = JSON.parse(fixture('busca.json')) as {
  total_paginas: number;
  vagas: SolidesRawJob[];
};
const DETALHE = fixture('detalhe-941558.json');

interface Pedido {
  method: string;
  tool?: string;
  args?: Record<string, unknown>;
  session?: string;
}

/** Resposta de tool como o servidor manda: SSE com o resultado em texto JSON. */
const sse = (text: string) =>
  new Response(
    `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text }], isError: false } })}\n\n`,
    { headers: { 'content-type': 'text/event-stream' } },
  );

/** Servidor MCP falso: abre sessões e responde às tools pelo nome. */
function servidor(
  tool: (name: string, args: Record<string, unknown>) => Response,
  maxResults = 100,
) {
  const pedidos: Pedido[] = [];
  let sessoes = 0;
  const ctx: AdapterContext = {
    http: async (_url, init) => {
      // o cliente MCP sempre manda o corpo como texto JSON
      const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as {
        method: string;
        params?: { name?: string; arguments?: Record<string, unknown> };
      };
      const session = (init?.headers as Record<string, string>)['mcp-session-id'];
      pedidos.push({
        method: body.method,
        tool: body.params?.name,
        args: body.params?.arguments,
        session,
      });
      if (body.method === 'initialize') {
        sessoes++;
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 0, result: {} }), {
          headers: { 'content-type': 'application/json', 'mcp-session-id': `sessao-${sessoes}` },
        });
      }
      if (body.method === 'notifications/initialized') return new Response(null, { status: 202 });
      return tool(body.params?.name ?? '', body.params?.arguments ?? {});
    },
    log: vi.fn(),
    maxResults,
  };
  return { ctx, pedidos };
}

async function baixar(keyword: string, ctx: AdapterContext) {
  const vagas: SolidesRawJob[] = [];
  for await (const raw of solidesAdapter.fetch(keyword, ctx)) vagas.push(raw);
  return vagas;
}

describe('solidesAdapter.fetch', () => {
  it('abre uma sessão MCP e busca pela palavra-chave, 50 por página', async () => {
    const { ctx, pedidos } = servidor(() => sse(JSON.stringify(BUSCA)));

    const vagas = await baixar('desenvolvedor react', ctx);
    expect(vagas.map((v) => v.id)).toEqual(['941558', '938667']);
    expect(pedidos.map((p) => p.method)).toEqual([
      'initialize',
      'notifications/initialized',
      'tools/call',
    ]);
    expect(pedidos[2]).toMatchObject({
      tool: 'buscar_vagas',
      args: { title: 'desenvolvedor react', page: 1, take: 50 },
      session: 'sessao-1',
    });
  });

  it('pagina até o total de páginas, sem repetir vagas', async () => {
    const { ctx, pedidos } = servidor((_name, args) =>
      // a segunda página repete uma vaga da primeira
      sse(
        JSON.stringify({
          total_paginas: 2,
          vagas: args.page === 1 ? BUSCA.vagas : [BUSCA.vagas[1]],
        }),
      ),
    );

    expect(await baixar('react', ctx)).toHaveLength(2);
    expect(pedidos.filter((p) => p.tool === 'buscar_vagas').map((p) => p.args?.page)).toEqual([
      1, 2,
    ]);
  });

  it('para no limite de vagas por execução', async () => {
    const { ctx } = servidor(() => sse(JSON.stringify(BUSCA)), 1);

    expect(await baixar('react', ctx)).toHaveLength(1);
  });

  it('vaga fora do formato é pulada e registrada, sem derrubar a busca', async () => {
    const { ctx } = servidor(() =>
      sse(JSON.stringify({ total_paginas: 1, vagas: [{ id: 'x' }, BUSCA.vagas[0]] })),
    );

    expect(await baixar('react', ctx)).toHaveLength(1);
    expect(ctx.log).toHaveBeenCalledWith('vaga da Solides fora do formato', expect.anything());
  });

  it('erro da tool vira erro comum, que o BullMQ repete', async () => {
    const { ctx } = servidor(
      () =>
        new Response(
          JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32603, message: 'interno' } }),
          { headers: { 'content-type': 'application/json' } },
        ),
    );

    await expect(baixar('react', ctx)).rejects.toThrow('buscar_vagas falhou (interno)');
  });

  it('sessão expirada (404) é reaberta uma vez', async () => {
    let chamadas = 0;
    const { ctx, pedidos } = servidor(() => {
      chamadas++;
      if (chamadas === 1)
        throw new SourceHttpError(404, 'https://mcp.solides.com.br/ats/candidate');
      return sse(JSON.stringify(BUSCA));
    });

    expect(await baixar('react', ctx)).toHaveLength(2);
    expect(pedidos.filter((p) => p.method === 'initialize')).toHaveLength(2);
    expect(pedidos.at(-1)?.session).toBe('sessao-2');
  });
});

describe('solidesAdapter: detalhe e normalização', () => {
  it('o detalhe troca a descrição cortada pela inteira e reaproveita a sessão', async () => {
    const { ctx, pedidos } = servidor((name) =>
      sse(name === 'detalhar_vaga' ? DETALHE : JSON.stringify(BUSCA)),
    );
    const [primeira] = await baixar('react', ctx);

    const completa = await solidesAdapter.detail?.fetch(primeira as SolidesRawJob, ctx);
    expect(completa?.descricao).toBe((JSON.parse(DETALHE) as { descricao: string }).descricao);
    // o link quebrado do detalhe não substitui o da busca
    expect(completa?.link_candidatura).toBe('https://supporte.vagas.solides.com.br/vaga/941558');
    expect(pedidos.filter((p) => p.method === 'initialize')).toHaveLength(1);
    expect(pedidos.at(-1)).toMatchObject({ tool: 'detalhar_vaga', args: { id: '941558' } });
  });

  it('normaliza para o formato interno', () => {
    const vaga = NormalizedJob.parse(solidesAdapter.normalize(BUSCA.vagas[0] as SolidesRawJob));

    expect(vaga).toMatchObject({
      sourceId: 'solides',
      externalId: '941558',
      url: 'https://supporte.vagas.solides.com.br/vaga/941558',
      company: 'SUPPORTE ARMAZENAGEM, VENDAS E LOGISTICA INTEGRADA LTDA',
      location: 'Uberlândia - MG',
      workModel: 'hybrid',
      seniority: 'lead',
      contractType: 'pj',
      salaryMin: null,
      salaryMax: null,
    });
    expect(vaga.publishedAt?.toISOString()).toBe('2026-10-21T03:00:00.000Z');
  });

  it.each([
    ['Até R$ 3000', null, 3000],
    ['A partir de R$ 2000', 2000, null],
    ['R$ 3000 a R$ 4500', 3000, 4500],
    ['R$ 4.186,80', 4186.8, 4186.8],
    ['Até R$ 4186.8', null, 4186.8],
    ['Não informado', null, null],
  ])('salário "%s" vira de %s a %s', (salario, min, max) => {
    const vaga = solidesAdapter.normalize({ ...(BUSCA.vagas[0] as SolidesRawJob), salario });

    expect([vaga.salaryMin, vaga.salaryMax]).toEqual([min, max]);
  });

  it('vários níveis ou contratos na mesma vaga ficam em branco: na dúvida, null', () => {
    const vaga = solidesAdapter.normalize({
      ...(BUSCA.vagas[0] as SolidesRawJob),
      senioridade: 'Junior, Pleno, Sênior',
      contrato: 'PJ, CLT',
      local: '',
    });

    expect(vaga).toMatchObject({ seniority: null, contractType: null, location: null });
  });
});

describe('solidesAdapter.recognize', () => {
  it.each(['https://vagas.solides.com.br/vagas/todas', 'https://supporte.vagas.solides.com.br/'])(
    '%s já é coberta pela busca',
    (href) => {
      expect(recognizeAtsUrl(href)).toEqual({ kind: 'covered', sourceId: 'solides' });
    },
  );

  it('o site institucional da Solides não é uma página de vagas', () => {
    expect(recognizeAtsUrl('https://solides.com.br/blog')).toBeNull();
  });
});
