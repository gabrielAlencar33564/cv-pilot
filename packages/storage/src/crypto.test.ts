import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decryptFile, encryptFile, encryptionKeyFromEnv } from './crypto';

const umaChave = () => randomBytes(32);
const pdf = Buffer.from('%PDF-1.7 currículo de teste');

describe('encryptFile / decryptFile', () => {
  it('decifra o que cifrou', () => {
    const chave = umaChave();
    expect(decryptFile(encryptFile(pdf, chave), chave).equals(pdf)).toBe(true);
  });

  it('não guarda o conteúdo em claro', () => {
    const cifrado = encryptFile(pdf, umaChave());
    expect(cifrado.includes(Buffer.from('%PDF'))).toBe(false);
  });

  it('usa um IV novo a cada arquivo', () => {
    const chave = umaChave();
    expect(encryptFile(pdf, chave).equals(encryptFile(pdf, chave))).toBe(false);
  });

  it('falha com a chave errada', () => {
    expect(() => decryptFile(encryptFile(pdf, umaChave()), umaChave())).toThrow();
  });

  it('falha se o arquivo cifrado for alterado', () => {
    const chave = umaChave();
    const cifrado = encryptFile(pdf, chave);
    const ultimo = cifrado.length - 1;
    cifrado.writeUInt8(cifrado.readUInt8(ultimo) ^ 0xff, ultimo);
    expect(() => decryptFile(cifrado, chave)).toThrow();
  });

  it('recusa arquivo cifrado com outra chave (id desconhecido)', () => {
    const chave = umaChave();
    const cifrado = encryptFile(pdf, chave);
    cifrado[0] = 9;
    expect(() => decryptFile(cifrado, chave)).toThrow(/chave desconhecida/);
  });
});

describe('encryptionKeyFromEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exige ENCRYPTION_KEY', () => {
    vi.stubEnv('ENCRYPTION_KEY', '');
    expect(() => encryptionKeyFromEnv()).toThrow(/ENCRYPTION_KEY não definida/);
  });

  it('recusa chave que não tem 32 bytes', () => {
    vi.stubEnv('ENCRYPTION_KEY', randomBytes(16).toString('base64'));
    expect(() => encryptionKeyFromEnv()).toThrow(/32 bytes/);
  });

  it('aceita 32 bytes em base64', () => {
    const chave = umaChave();
    vi.stubEnv('ENCRYPTION_KEY', chave.toString('base64'));
    expect(encryptionKeyFromEnv().equals(chave)).toBe(true);
  });
});
