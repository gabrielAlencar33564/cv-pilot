import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { TEST_ORIGIN } from './test/db';

describe('CORS para o web', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['PUT', 'PATCH', 'DELETE'])('libera %s no preflight do web', async (method) => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/applications/qualquer',
      headers: {
        origin: TEST_ORIGIN,
        'access-control-request-method': method,
        'access-control-request-headers': 'content-type',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(TEST_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(String(res.headers['access-control-allow-methods'])).toContain(method);
  });
});
