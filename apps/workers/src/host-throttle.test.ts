import { describe, expect, it } from 'vitest';
import { createHostThrottle } from './host-throttle';

/** Redis falso com relógio próprio: só o SET NX PX e o PTTL que o throttle usa. */
function redisFalso() {
  const relogio = { agora: 0 };
  const expiraEm = new Map<string, number>();
  const vivo = (key: string) => (expiraEm.get(key) ?? -1) > relogio.agora;
  const redis = {
    set: async (key: string, _valor: string, _px: 'PX', ms: number, _nx: 'NX') => {
      if (vivo(key)) return null;
      expiraEm.set(key, relogio.agora + ms);
      return 'OK' as const;
    },
    pttl: async (key: string) => (vivo(key) ? (expiraEm.get(key) ?? 0) - relogio.agora : -2),
  };
  const esperas: number[] = [];
  const esperar = async (ms: number) => {
    esperas.push(ms);
    relogio.agora += ms;
  };
  // o cliente do ioredis tem dezenas de sobrecargas; o falso cobre só os dois comandos usados
  const store = redis as unknown as Parameters<typeof createHostThrottle>[0];
  return { redis: store, relogio, esperas, esperar };
}

describe('createHostThrottle', () => {
  it('a primeira chamada a um host não espera', async () => {
    const { redis, esperas, esperar } = redisFalso();
    await createHostThrottle(redis, 1000, esperar)('api.lever.co');

    expect(esperas).toEqual([]);
  });

  it('a chamada seguinte ao mesmo host espera o resto do intervalo', async () => {
    const { redis, relogio, esperas, esperar } = redisFalso();
    const throttle = createHostThrottle(redis, 1000, esperar);

    await throttle('api.lever.co');
    relogio.agora += 300;
    await throttle('api.lever.co');

    expect(esperas).toEqual([700]);
  });

  it('hosts diferentes não esperam um pelo outro', async () => {
    const { redis, esperas, esperar } = redisFalso();
    const throttle = createHostThrottle(redis, 1000, esperar);

    await throttle('api.lever.co');
    await throttle('boards-api.greenhouse.io');

    expect(esperas).toEqual([]);
  });

  it('depois do intervalo, passa direto', async () => {
    const { redis, relogio, esperas, esperar } = redisFalso();
    const throttle = createHostThrottle(redis, 1000, esperar);

    await throttle('api.lever.co');
    relogio.agora += 1000;
    await throttle('api.lever.co');

    expect(esperas).toEqual([]);
  });
});
