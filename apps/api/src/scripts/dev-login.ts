import { prisma } from '@cv-pilot/db';
import { hashPassword } from 'better-auth/crypto';
import { requiredEnv } from '../config';

/** Usuário de desenvolvimento criado pelo seed do @cv-pilot/db. */
const DEV_EMAIL = 'dev@cvpilot.local';
/** `providerId` do Better Auth para o login por e-mail e senha. */
const CREDENTIAL_PROVIDER = 'credential';

/**
 * Só em dev: dá ao usuário do seed a senha de DEV_USER_PASSWORD, para entrar pela tela de login.
 * Roda junto com o `pnpm db:seed` e pode rodar de novo (troca a senha).
 */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('dev-login não roda em produção');
  }
  const password = await hashPassword(requiredEnv('DEV_USER_PASSWORD'));
  const user = await prisma.user.findUniqueOrThrow({ where: { email: DEV_EMAIL } });

  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: CREDENTIAL_PROVIDER, accountId: user.id } },
    create: { userId: user.id, accountId: user.id, providerId: CREDENTIAL_PROVIDER, password },
    update: { password },
  });
  console.log(`Login de dev pronto: ${DEV_EMAIL} com a senha de DEV_USER_PASSWORD.`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
