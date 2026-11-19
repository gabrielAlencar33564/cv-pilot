import { configDefaults, defineConfig } from 'vitest/config';

// Testes de integração usam o Postgres de teste (TEST_DATABASE_URL) e rodam fora do `pnpm check`.
const INTEGRATION = 'src/**/*.int.test.ts';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: [...configDefaults.exclude, INTEGRATION],
        },
      },
      {
        test: {
          name: 'integration',
          include: [INTEGRATION],
          globalSetup: ['src/test/integration-setup.ts'],
          env: {
            DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
            LOG_LEVEL: 'silent',
            // login de verdade (Better Auth), com um segredo que só existe nos testes
            BETTER_AUTH_URL: 'http://localhost:4000/auth',
            BETTER_AUTH_SECRET: 'segredo-dos-testes-de-integracao-0000',
          },
          // os arquivos compartilham o mesmo banco: um de cada vez
          fileParallelism: false,
          // cada cadastro faz o hash da senha (scrypt), que é lento de propósito
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
