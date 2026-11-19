import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SourceBlockedError,
  SourceRateLimitedError,
  createPoliteFetch,
  parseRetryAfter,
} from './http';

describe('parseRetryAfter', () => {
  const agora = Date.parse('2026-11-18T12:00:00Z');

  it('lê o valor em segundos', () => {
    expect(parseRetryAfter('120', agora)).toBe(120_000);
  });

  it('lê uma data HTTP', () => {
    expect(parseRetryAfter('Wed, 18 Nov 2026 12:05:00 GMT', agora)).toBe(300_000);
  });

  it('data no passado vira espera zero', () => {
    expect(parseRetryAfter('Wed, 18 Nov 2026 11:00:00 GMT', agora)).toBe(0);
  });

  it('ausente ou inválido vira null', () => {
    expect(parseRetryAfter(null, agora)).toBeNull();
    expect(parseRetryAfter('   ', agora)).toBeNull();
    expect(parseRetryAfter('daqui a pouco', agora)).toBeNull();
  });
});

describe('createPoliteFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const comResposta = (res: Response) => {
    const fetch = vi.fn().mockResolvedValue(res);
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };
  const semEspera = vi.fn(async () => {});

  it('espera a vez do host e se identifica pelo User-Agent', async () => {
    const fetch = comResposta(new Response('{}'));
    const throttle = vi.fn(async () => {});

    await createPoliteFetch(throttle)('https://api.lever.co/v0/postings/x?mode=json');

    expect(throttle).toHaveBeenCalledWith('api.lever.co');
    const init = fetch.mock.lastCall?.[1] as { headers: Record<string, string> };
    expect(init.headers['User-Agent']).toMatch(/^CVPilotBot\//);
  });

  it('403 vira SourceBlockedError', async () => {
    comResposta(new Response('', { status: 403 }));

    await expect(createPoliteFetch(semEspera)('https://site.test/vagas')).rejects.toBeInstanceOf(
      SourceBlockedError,
    );
  });

  it('429 vira SourceRateLimitedError com o Retry-After', async () => {
    comResposta(new Response('', { status: 429, headers: { 'Retry-After': '30' } }));

    await expect(createPoliteFetch(semEspera)('https://site.test/vagas')).rejects.toMatchObject({
      name: 'SourceRateLimitedError',
      host: 'site.test',
      retryAfterMs: 30_000,
    });
  });

  it('429 sem Retry-After deixa a espera para o worker decidir', async () => {
    comResposta(new Response('', { status: 429 }));

    const falha = createPoliteFetch(semEspera)('https://site.test/vagas');
    await expect(falha).rejects.toBeInstanceOf(SourceRateLimitedError);
    await expect(falha).rejects.toMatchObject({ retryAfterMs: null });
  });

  it('outros erros HTTP viram erro comum, que o BullMQ repete', async () => {
    comResposta(new Response('', { status: 503 }));

    const falha = createPoliteFetch(semEspera)('https://site.test/vagas');
    await expect(falha).rejects.toThrow('HTTP 503');
    await expect(falha).rejects.not.toBeInstanceOf(SourceBlockedError);
  });
});
