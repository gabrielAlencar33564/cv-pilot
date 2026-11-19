import { db, removeE2eLeftovers } from './db';

/** As vagas do E2E não pertencem a ninguém: saem aqui, depois que as contas já foram excluídas. */
export default async function globalTeardown() {
  await removeE2eLeftovers();
  await db.$disconnect();
}
