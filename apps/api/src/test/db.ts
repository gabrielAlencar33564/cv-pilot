import { randomUUID } from 'node:crypto';
import { prisma } from '@cv-pilot/db';
import type { FastifyInstance } from 'fastify';

/** Id único por execução: cada teste cria e apaga os próprios dados. */
export const uniqueId = (prefix: string) => `${prefix}-${randomUUID()}`;

/** Senha dos usuários de teste (só existe no banco de teste). */
export const TEST_PASSWORD = 'senha-de-teste-123';

/** O login confere a origem das requisições; esta é uma das aceitas (API_CORS_ORIGIN). */
export const TEST_ORIGIN = 'http://localhost:3000';

export interface TestUser {
  id: string;
  email: string;
  /** cabeçalhos de uma requisição logada como este usuário */
  headers: { cookie: string; origin: string };
}

/** Cadastra um usuário pela própria rota de login e devolve o cookie da sessão. */
export async function signUpTestUser(app: FastifyInstance): Promise<TestUser> {
  const email = `${uniqueId('usuario')}@teste.local`;
  const res = await app.inject({
    method: 'POST',
    url: '/auth/sign-up/email',
    headers: { origin: TEST_ORIGIN },
    payload: { email, password: TEST_PASSWORD, name: 'Pessoa de Teste' },
  });
  if (res.statusCode !== 200) {
    throw new Error(`cadastro de teste falhou: ${res.statusCode} ${res.body}`);
  }

  const cookie = res.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  const { user } = res.json<{ user: { id: string } }>();
  return { id: user.id, email, headers: { cookie, origin: TEST_ORIGIN } };
}

/** Apagar o usuário leva junto, em cascata, tudo o que pertence a ele (inclusive as sessões). */
export async function deleteTestUsers(...ids: string[]) {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
