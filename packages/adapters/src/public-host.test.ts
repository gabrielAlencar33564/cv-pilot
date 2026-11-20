import { describe, expect, it, vi } from 'vitest';
import { UnsafeUrlError, assertPublicUrl } from './public-host';

const resolveComo = (...enderecos: string[]) =>
  vi.fn(async () =>
    enderecos.map((address) => ({ address, family: address.includes(':') ? 6 : 4 })),
  );

describe('assertPublicUrl', () => {
  it('aceita um site público em http(s) na porta padrão', async () => {
    const resolve = resolveComo('104.16.1.1');

    await expect(
      assertPublicUrl(new URL('https://empresa.com.br/carreiras'), resolve),
    ).resolves.toBeUndefined();
    expect(resolve).toHaveBeenCalledWith('empresa.com.br');
  });

  it.each([
    ['loopback', 'http://127.0.0.1/'],
    ['metadados da nuvem', 'http://169.254.169.254/latest/meta-data'],
    ['rede privada', 'http://10.0.0.5/'],
    ['rede do Docker', 'http://172.18.0.3/'],
    ['IPv6 local', 'http://[::1]/'],
    ['IPv4 escrito como IPv6', 'http://[::ffff:127.0.0.1]/'],
    ['localhost', 'http://localhost/'],
    ['porta incomum', 'https://empresa.com.br:6379/'],
    ['outro protocolo', 'file:///etc/passwd'],
  ])('barra %s', async (_caso, href) => {
    await expect(assertPublicUrl(new URL(href), resolveComo('104.16.1.1'))).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
  });

  it('barra o nome público que resolve para a rede interna', async () => {
    await expect(
      assertPublicUrl(
        new URL('https://interno.empresa.com/'),
        resolveComo('104.16.1.1', '10.0.0.7'),
      ),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});
