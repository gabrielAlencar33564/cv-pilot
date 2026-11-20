// Só para testes (integração e E2E): importado por `@cv-pilot/db/testing`, nunca pelo código da app.
import { execSync } from 'node:child_process';
import { Prisma, PrismaClient } from '@prisma/client';

const TEST_DB_SUFFIX = '_test';
const SAFE_DB_NAME = /^[a-z0-9_]+$/;

/** URL e nome do banco de teste. Recusa qualquer URL que possa ser o banco de dev. */
export function testDatabase(): { url: string; name: string } {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL não definida: configure no .env (veja .env.example)');
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL é igual a DATABASE_URL: os testes nunca rodam no banco de dev',
    );
  }
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith(TEST_DB_SUFFIX) || !SAFE_DB_NAME.test(name)) {
    throw new Error(`O banco de teste precisa terminar em "${TEST_DB_SUFFIX}": recebido "${name}"`);
  }
  return { url, name };
}

/**
 * Erros do Postgres quando o banco já existe: `42P04` (duplicate_database) ou, se dois CREATE
 * correm ao mesmo tempo, `23505` (unique_violation no catálogo `pg_database`).
 */
const DATABASE_EXISTS_CODES = ['42P04', '23505'];

const isDatabaseExists = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  DATABASE_EXISTS_CODES.includes(String(err.meta?.code));

async function createDatabaseIfMissing(url: string, name: string) {
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
  try {
    const found = await admin.$queryRaw<unknown[]>`
      SELECT 1 FROM pg_database WHERE datname = ${name}`;
    // CREATE DATABASE não aceita parâmetro; o nome já foi validado por SAFE_DB_NAME
    if (!found.length) await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } catch (err) {
    // as integrações da API, dos workers e da queue sobem juntas (Turbo) e disputam a criação:
    // quem perde encontra o banco pronto, e o `migrate deploy` seguinte espera pelo lock
    if (!isDatabaseExists(err)) throw err;
  } finally {
    await admin.$disconnect();
  }
}

/** Cria o banco de teste se faltar e aplica as migrations nele. Devolve a URL. */
export async function prepareTestDatabase(): Promise<string> {
  const { url, name } = testDatabase();
  await createDatabaseIfMissing(url, name);
  // comando fixo, sem nada interpolado; o shell resolve o pnpm.cmd no Windows
  execSync('pnpm --filter @cv-pilot/db exec prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
  return url;
}
