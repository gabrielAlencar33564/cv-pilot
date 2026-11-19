import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
/**
 * Id da chave gravado no primeiro byte do arquivo. Rotacionar a chave = nova chave com outro id,
 * mantendo a antiga para decifrar o que já foi gravado.
 */
const CURRENT_KEY_ID = 1;
const HEADER_BYTES = 1 + IV_BYTES + TAG_BYTES;

/** Lê a ENCRYPTION_KEY (32 bytes em base64). Sem fallback: arquivo de currículo nunca vai sem cifra. */
export function encryptionKeyFromEnv(): Buffer {
  const encoded = process.env.ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error(
      'ENCRYPTION_KEY não definida: gere com `openssl rand -base64 32` (veja .env.example)',
    );
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(`ENCRYPTION_KEY precisa ter ${KEY_BYTES} bytes em base64; tem ${key.length}`);
  }
  return key;
}

/** AES-256-GCM com IV aleatório. Formato: id da chave (1) | IV (12) | tag (16) | texto cifrado. */
export function encryptFile(plain: Uint8Array, key: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from([CURRENT_KEY_ID]), iv, cipher.getAuthTag(), encrypted]);
}

/** Falha se a chave estiver errada ou se o arquivo tiver sido alterado (a tag do GCM não confere). */
export function decryptFile(sealed: Uint8Array, key: Buffer): Buffer {
  const data = Buffer.from(sealed.buffer, sealed.byteOffset, sealed.byteLength);
  if (data.length < HEADER_BYTES) throw new Error('arquivo cifrado incompleto');
  const keyId = data[0];
  if (keyId !== CURRENT_KEY_ID) {
    throw new Error(`arquivo cifrado com uma chave desconhecida (id ${keyId})`);
  }

  const iv = data.subarray(1, 1 + IV_BYTES);
  const tag = data.subarray(1 + IV_BYTES, HEADER_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data.subarray(HEADER_BYTES)), decipher.final()]);
}
