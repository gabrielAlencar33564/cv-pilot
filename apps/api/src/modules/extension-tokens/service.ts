import { createHash, randomBytes } from 'node:crypto';
import { EXTENSION_TOKEN_PREFIX, type ExtensionTokenRow } from '@cv-pilot/contracts';
import { prisma } from '@cv-pilot/db';
import { HttpError } from '../../plugins/errors';

/** Bytes aleatórios do token: 256 bits, o bastante para guardar só um SHA-256, sem sal. */
const TOKEN_BYTES = 32;
/** Caracteres do token mostrados na lista, depois do prefixo, para reconhecer a chave. */
const VISIBLE_CHARS = 4;
/** Um navegador por chave: poucas bastam, e o limite segura uma conta comprometida. */
const MAX_TOKENS_PER_USER = 5;
/** O "usado por último" só é gravado de tempos em tempos, não a cada requisição. */
const LAST_USED_WRITE_INTERVAL_MS = 5 * 60_000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const tokenRow = {
  id: true,
  name: true,
  prefix: true,
  createdAt: true,
  lastUsedAt: true,
} as const;

const toRow = (t: {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}): ExtensionTokenRow => ({
  ...t,
  createdAt: t.createdAt.toISOString(),
  lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
});

export async function listExtensionTokens(userId: string): Promise<ExtensionTokenRow[]> {
  const tokens = await prisma.extensionToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: tokenRow,
  });
  return tokens.map(toRow);
}

/** Cria uma chave e devolve o token em claro, a única vez que ele sai da API. */
export async function createExtensionToken(userId: string, name: string) {
  const count = await prisma.extensionToken.count({ where: { userId } });
  if (count >= MAX_TOKENS_PER_USER) throw new HttpError(409, 'extension_token_limit');

  const token = `${EXTENSION_TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString('base64url')}`;
  const created = await prisma.extensionToken.create({
    data: {
      userId,
      name,
      tokenHash: hashToken(token),
      prefix: token.slice(0, EXTENSION_TOKEN_PREFIX.length + VISIBLE_CHARS),
    },
    select: tokenRow,
  });
  return { ...toRow(created), token };
}

export async function deleteExtensionToken(userId: string, id: string) {
  const { count } = await prisma.extensionToken.deleteMany({ where: { id, userId } });
  if (!count) throw new HttpError(404, 'extension_token_not_found');
}

/** Dono do token do cabeçalho `Authorization: Bearer ...`, ou null se não houver um válido. */
export async function userIdFromAuthorization(header: string | undefined) {
  const token = header?.match(/^Bearer (\S+)$/)?.[1];
  if (!token?.startsWith(EXTENSION_TOKEN_PREFIX)) return null;

  const tokenHash = hashToken(token);
  const found = await prisma.extensionToken.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });
  if (!found) return null;

  const now = new Date();
  await prisma.extensionToken.updateMany({
    where: {
      tokenHash,
      OR: [
        { lastUsedAt: null },
        { lastUsedAt: { lt: new Date(now.getTime() - LAST_USED_WRITE_INTERVAL_MS) } },
      ],
    },
    data: { lastUsedAt: now },
  });
  return found.userId;
}
