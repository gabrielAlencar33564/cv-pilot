import { describe, expect, it } from 'vitest';
import { isPublicPath, safeNextPath } from './session';

describe('safeNextPath', () => {
  it('aceita caminhos internos', () => {
    expect(safeNextPath('/jobs')).toBe('/jobs');
    expect(safeNextPath('/applications?status=sent')).toBe('/applications?status=sent');
  });

  it.each([
    ['//site-malicioso.com', 'protocolo relativo'],
    ['/\\site-malicioso.com', 'barra invertida, que o navegador trata como //'],
    ['https://site-malicioso.com', 'URL absoluta'],
    ['jobs', 'caminho sem barra'],
  ])('recusa %s (%s) e volta para o início', (next) => {
    expect(safeNextPath(next)).toBe('/');
  });

  it('sem destino, volta para o início', () => {
    expect(safeNextPath(null)).toBe('/');
  });
});

describe('isPublicPath', () => {
  it('libera a entrada, o cadastro e os termos', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/cadastro')).toBe(true);
    expect(isPublicPath('/termos')).toBe(true);
  });

  it('não libera outra rota só porque começa parecido', () => {
    expect(isPublicPath('/loginx')).toBe(false);
    expect(isPublicPath('/jobs')).toBe(false);
  });
});
