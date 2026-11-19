import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SourceBlockedError,
  SourceDisallowedError,
  SourceRateLimitedError,
  createPoliteFetch,
  parseRetryAfter,
  type RobotsCache,
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

/** Cache de robots.txt em memória; começa com os arquivos dados, por origem. */
function cacheDeRobots(inicial: Record<string, string> = {}) {
  const guardados = new Map(Object.entries(inicial));
  const cache: RobotsCache = {
    get: async (origin) => guardados.get(origin) ?? null,
    set: async (origin, body) => {
      guardados.set(origin, body);
    },
  };
  return { cache, guardados };
}

/** fetch falso que responde por URL; o que não estiver no mapa responde 404. */
function fetchPorUrl(respostas: Record<string, () => Response>) {
  const fetch = vi.fn(async (url: URL | string) => {
    const resposta = respostas[String(url)];
    return resposta ? resposta() : new Response('', { status: 404 });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const urlsPedidas = (fetch: ReturnType<typeof fetchPorUrl>) =>
  fetch.mock.calls.map(([url]) => String(url));

const semEspera = vi.fn(async () => {});

describe('createPoliteFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // o robots.txt já está no cache e não proíbe nada: estes testes olham só a requisição
  const liberado = () =>
    cacheDeRobots({ 'https://api.lever.co': '', 'https://site.test': '' }).cache;
  const comResposta = (res: Response) => {
    const fetch = vi.fn().mockResolvedValue(res);
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };
  const educado = () => createPoliteFetch({ throttle: semEspera, robots: liberado() });

  it('espera a vez do host e se identifica pelo User-Agent', async () => {
    const fetch = comResposta(new Response('{}'));
    const throttle = vi.fn(async () => {});

    await createPoliteFetch({ throttle, robots: liberado() })(
      'https://api.lever.co/v0/postings/x?mode=json',
    );

    expect(throttle).toHaveBeenCalledWith('api.lever.co');
    const init = fetch.mock.lastCall?.[1] as { headers: Record<string, string> };
    expect(init.headers['User-Agent']).toMatch(/^CVPilotBot\//);
  });

  it('403 vira SourceBlockedError', async () => {
    comResposta(new Response('', { status: 403 }));

    await expect(educado()('https://site.test/vagas')).rejects.toBeInstanceOf(SourceBlockedError);
  });

  it('429 vira SourceRateLimitedError com o Retry-After', async () => {
    comResposta(new Response('', { status: 429, headers: { 'Retry-After': '30' } }));

    await expect(educado()('https://site.test/vagas')).rejects.toMatchObject({
      name: 'SourceRateLimitedError',
      host: 'site.test',
      retryAfterMs: 30_000,
    });
  });

  it('429 sem Retry-After deixa a espera para o worker decidir', async () => {
    comResposta(new Response('', { status: 429 }));

    const falha = educado()('https://site.test/vagas');
    await expect(falha).rejects.toBeInstanceOf(SourceRateLimitedError);
    await expect(falha).rejects.toMatchObject({ retryAfterMs: null });
  });

  it('outros erros HTTP viram erro comum, que o BullMQ repete', async () => {
    comResposta(new Response('', { status: 503 }));

    const falha = educado()('https://site.test/vagas');
    await expect(falha).rejects.toThrow('HTTP 503');
    await expect(falha).rejects.not.toBeInstanceOf(SourceBlockedError);
  });
});

describe('createPoliteFetch: robots.txt', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ROBOTS = 'https://site.test/robots.txt';
  const educado = (cache: RobotsCache) => createPoliteFetch({ throttle: semEspera, robots: cache });

  it('baixa o robots.txt uma vez, guarda no cache e respeita o Disallow', async () => {
    const fetch = fetchPorUrl({
      [ROBOTS]: () => new Response('User-agent: *\nDisallow: /privado\n'),
      'https://site.test/vagas?pagina=1': () => new Response('{}'),
      'https://site.test/vagas?pagina=2': () => new Response('{}'),
    });
    const { cache, guardados } = cacheDeRobots();
    const politeFetch = educado(cache);

    await politeFetch('https://site.test/vagas?pagina=1');
    await politeFetch('https://site.test/vagas?pagina=2');
    await expect(politeFetch('https://site.test/privado/1')).rejects.toMatchObject({
      name: 'SourceDisallowedError',
      host: 'site.test',
      path: '/privado/1',
    });

    expect(urlsPedidas(fetch).filter((url) => url === ROBOTS)).toHaveLength(1);
    expect(guardados.get('https://site.test')).toContain('Disallow: /privado');
  });

  it('não chama o site quando o caminho é proibido', async () => {
    const fetch = fetchPorUrl({ [ROBOTS]: () => new Response('User-agent: *\nDisallow: /\n') });

    await expect(educado(cacheDeRobots().cache)('https://site.test/vagas')).rejects.toBeInstanceOf(
      SourceDisallowedError,
    );
    expect(urlsPedidas(fetch)).toEqual([ROBOTS]);
  });

  it('usa o robots.txt do cache sem baixar de novo', async () => {
    const fetch = fetchPorUrl({ 'https://site.test/vagas': () => new Response('{}') });
    const { cache } = cacheDeRobots({ 'https://site.test': 'User-agent: *\nDisallow: /admin\n' });

    await educado(cache)('https://site.test/vagas');
    expect(urlsPedidas(fetch)).toEqual(['https://site.test/vagas']);
  });

  it('sem robots.txt (404), nada é proibido, e isso também fica no cache', async () => {
    fetchPorUrl({ 'https://site.test/vagas': () => new Response('{}') });
    const { cache, guardados } = cacheDeRobots();

    await educado(cache)('https://site.test/vagas');
    expect(guardados.get('https://site.test')).toBe('');
  });

  it('robots.txt fora do ar (5xx) bloqueia o acesso, sem guardar no cache', async () => {
    const fetch = fetchPorUrl({ [ROBOTS]: () => new Response('', { status: 503 }) });
    const { cache, guardados } = cacheDeRobots();

    await expect(educado(cache)('https://site.test/vagas')).rejects.toThrow(
      'robots.txt de site.test indisponível (HTTP 503)',
    );
    expect(urlsPedidas(fetch)).toEqual([ROBOTS]);
    expect(guardados.size).toBe(0);
  });

  it('429 no robots.txt adia o job, como em qualquer requisição', async () => {
    fetchPorUrl({ [ROBOTS]: () => new Response('', { status: 429 }) });

    await expect(educado(cacheDeRobots().cache)('https://site.test/vagas')).rejects.toBeInstanceOf(
      SourceRateLimitedError,
    );
  });
});
