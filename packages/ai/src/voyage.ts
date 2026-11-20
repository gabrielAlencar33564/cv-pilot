import { z } from 'zod';
import { EmbeddingError, type EmbeddingInputType, type Embeddings } from './types';

/*
 * Embeddings pelo Voyage AI, recomendado pela Anthropic (que não tem modelo de embeddings).
 * API HTTP direta, sem SDK: é uma chamada só. Contrato conferido em
 * https://docs.voyageai.com/reference/embeddings-api em 2026-11-19.
 */
const ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-4';
/** Tem que ser a dimensão das colunas `vector(1024)` de Job e ResumeVersion. */
const EMBEDDING_DIMENSIONS = 1024;
/** Limite do Voyage por requisição. */
const MAX_TEXTS_PER_REQUEST = 1000;
const TIMEOUT_MS = 30_000;

const VoyageResponse = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()), index: z.number().int() })),
  usage: z.object({ total_tokens: z.number().int() }),
});

export class VoyageEmbedder {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async embed(texts: string[], inputType: EmbeddingInputType): Promise<Embeddings> {
    if (!texts.length) return { vectors: [], usage: { totalTokens: 0 } };
    if (texts.length > MAX_TEXTS_PER_REQUEST) throw new EmbeddingError('provider_rejected');

    const res = await this.fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: texts,
        model: MODEL,
        input_type: inputType,
        output_dimension: EMBEDDING_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 429 e 5xx passam com o tempo: o erro comum sobe para o BullMQ repetir
    if (res.status === 429 || res.status >= 500) {
      throw new Error(`Voyage respondeu HTTP ${res.status}`);
    }
    // 400 (pedido inválido), 401 (chave) e 403: repetir não resolve
    if (!res.ok) throw new EmbeddingError('provider_rejected');

    const parsed = VoyageResponse.safeParse(await res.json());
    if (!parsed.success) throw new EmbeddingError('invalid_output');
    // a documentação não garante a ordem de `data`: o `index` diz de qual texto é cada vetor
    const vectors = [...parsed.data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
    if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
      throw new EmbeddingError('invalid_output');
    }
    return { vectors, usage: { totalTokens: parsed.data.usage.total_tokens } };
  }
}
