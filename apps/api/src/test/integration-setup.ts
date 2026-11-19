import { prepareTestDatabase } from '@cv-pilot/db/testing';

/** globalSetup do Vitest: banco de teste criado e com as migrations aplicadas. */
export default async function setup() {
  await prepareTestDatabase();
}
