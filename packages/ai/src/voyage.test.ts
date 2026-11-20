import { describe, expect, it, vi } from 'vitest';
import { EmbeddingError } from './types';
import { VoyageEmbedder } from './voyage';

const vetor = (valor: number) => Array.from({ length: 1024 }, () => valor);

/** fetch falso que devolve a resposta dada e guarda o pedido. */
function fetchCom(status: number, corpo: unknown) {
  return vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(corpo), { status }),
  );
}

describe('VoyageEmbedder', () => {
  it('pede voyage-4 com 1024 dimensões e devolve os vetores na ordem dos textos', async () => {
    // a resposta vem fora de ordem: quem manda é o index
    const fetch = fetchCom(200, {
      data: [
        { embedding: vetor(0.2), index: 1 },
        { embedding: vetor(0.1), index: 0 },
      ],
      usage: { total_tokens: 42 },
    });

    const resultado = await new VoyageEmbedder('chave', fetch).embed(
      ['vaga', 'currículo'],
      'document',
    );

    expect(resultado.vectors.map((v) => v[0])).toEqual([0.1, 0.2]);
    expect(resultado.usage).toEqual({ totalTokens: 42 });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('https://api.voyageai.com/v1/embeddings');
    // o corpo vai como texto JSON; outro tipo aqui já é erro
    expect(typeof init?.body).toBe('string');
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
      input: ['vaga', 'currículo'],
      model: 'voyage-4',
      input_type: 'document',
      output_dimension: 1024,
    });
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer chave');
  });

  it('lista vazia não chama a API', async () => {
    const fetch = fetchCom(200, {});

    await expect(new VoyageEmbedder('chave', fetch).embed([], 'document')).resolves.toEqual({
      vectors: [],
      usage: { totalTokens: 0 },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([429, 503])('HTTP %i vira erro comum, que o BullMQ repete', async (status) => {
    const falha = new VoyageEmbedder('chave', fetchCom(status, {})).embed(['x'], 'document');

    await expect(falha).rejects.toThrow(`HTTP ${status}`);
    await expect(falha).rejects.not.toBeInstanceOf(EmbeddingError);
  });

  it.each([400, 401])('HTTP %i é recusa definitiva', async (status) => {
    await expect(
      new VoyageEmbedder('chave', fetchCom(status, { detail: 'x' })).embed(['x'], 'document'),
    ).rejects.toMatchObject({ code: 'provider_rejected' });
  });

  it('vetor com outra dimensão não cabe na coluna e é recusado', async () => {
    const fetch = fetchCom(200, {
      data: [{ embedding: [0.1, 0.2], index: 0 }],
      usage: { total_tokens: 1 },
    });

    await expect(new VoyageEmbedder('chave', fetch).embed(['x'], 'document')).rejects.toMatchObject(
      { code: 'invalid_output' },
    );
  });
});
