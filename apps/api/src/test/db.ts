import { randomUUID } from 'node:crypto';
import { prisma } from '@cv-pilot/db';

/** Id único por execução: cada teste cria e apaga os próprios dados. */
export const uniqueId = (prefix: string) => `${prefix}-${randomUUID()}`;

export async function createTestUser() {
  const id = uniqueId('usuario');
  return prisma.user.create({ data: { id, email: `${id}@teste.local` } });
}

/** Apagar o usuário leva junto, em cascata, tudo o que pertence a ele. */
export async function deleteTestUsers(...ids: string[]) {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
