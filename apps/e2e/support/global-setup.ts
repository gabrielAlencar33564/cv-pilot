import { prepareTestDatabase } from '@cv-pilot/db/testing';
import { db, E2E_SOURCE, removeE2eLeftovers } from './db';

/** Banco de teste com as migrations, a fonte do E2E e sem restos de execuções anteriores. */
export default async function globalSetup() {
  await prepareTestDatabase();
  await db.source.upsert({ where: { id: E2E_SOURCE.id }, update: E2E_SOURCE, create: E2E_SOURCE });
  await removeE2eLeftovers();
  await db.$disconnect();
}
