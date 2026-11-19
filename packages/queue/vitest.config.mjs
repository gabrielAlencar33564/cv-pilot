import { configDefaults, defineConfig } from 'vitest/config';

// Testes de integração usam o Redis de teste (TEST_REDIS_URL) e rodam fora do `pnpm check`.
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
          env: { REDIS_URL: process.env.TEST_REDIS_URL ?? '', LOG_LEVEL: 'silent' },
        },
      },
    ],
  },
});
