import { existsSync } from 'node:fs';
import { testDatabase } from '@cv-pilot/db/testing';
import { defineConfig, devices } from '@playwright/test';
import { API_PORT, API_URL, WEB_PORT, WEB_URL } from './support/urls';

// o mesmo .env da raiz; o que já vem do ambiente (CI) tem prioridade
const ROOT_ENV = new URL('../../.env', import.meta.url);
if (existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não definida: configure no .env (veja .env.example)`);
  return value;
}

/** A API e o web do E2E sobem sozinhos (o web com build) e só falam com o banco e o Redis de teste. */
const SERVER_START_TIMEOUT_MS = 300_000;

export default defineConfig({
  testDir: './tests',
  globalSetup: './support/global-setup.ts',
  globalTeardown: './support/global-teardown.ts',
  // os testes dividem o banco de teste
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // sem o Chromium do Playwright instalado, use o navegador da máquina (chrome ou msedge)
        channel: process.env.E2E_BROWSER_CHANNEL || undefined,
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @cv-pilot/api exec tsx src/server.ts',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: SERVER_START_TIMEOUT_MS,
      env: {
        // Getters: as URLs de teste são lidas e validadas quando o Playwright sobe a API, não ao
        // carregar o config. O knip carrega este arquivo para achar os testes, sem .env.
        // testDatabase() recusa o banco de dev antes de a API subir.
        get DATABASE_URL() {
          return testDatabase().url;
        },
        get REDIS_URL() {
          return requiredEnv('TEST_REDIS_URL');
        },
        API_PORT: String(API_PORT),
        API_CORS_ORIGIN: WEB_URL,
        BETTER_AUTH_URL: `${API_URL}/auth`,
        LOG_LEVEL: 'warn',
      },
    },
    {
      // build de produção: o `next dev` compila cada página na primeira visita e às vezes
      // recarrega a página aberta (HMR), apagando o que o teste acabou de preencher.
      // O aviso do `next start` sobre `output: standalone` é esperado: ele serve o build igual.
      command: `pnpm --filter @cv-pilot/web exec next build && pnpm --filter @cv-pilot/web exec next start --port ${WEB_PORT}`,
      url: `${WEB_URL}/login`,
      reuseExistingServer: !process.env.CI,
      timeout: SERVER_START_TIMEOUT_MS,
      env: {
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_DIST_DIR: '.next-e2e',
        // o .env de dev traz NODE_ENV=development, que quebra o build de produção
        NODE_ENV: 'production',
      },
    },
  ],
});
