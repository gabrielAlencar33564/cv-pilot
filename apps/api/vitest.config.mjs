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
          },
          // os arquivos compartilham o mesmo banco: um de cada vez
          fileParallelism: false,
        },
      },
    ],
  },
});
